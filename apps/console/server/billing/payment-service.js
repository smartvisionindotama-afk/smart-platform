/**
 * PaymentService (SP-029 M6 §22-25, §42).
 *
 * Payment abstraction + idempotency (transactionReference unique).
 * Verifikasi payment SERVER-SIDE — tidak percaya payload client.
 * Mode default: SIMULATION (tanpa mutasi finansial nyata / provider eksternal).
 *
 * @module console/server/billing/payment-service
 */

import { Payment } from "../models/Payment.js";
import { Invoice } from "../models/Invoice.js";
import { Subscription } from "../models/Subscription.js";
import { SubscriptionChange } from "../models/SubscriptionChange.js";
import { Entitlement } from "../models/Entitlement.js";
import { transitionInvoice } from "./invoice-service.js";
import { canTransition, addBillingCycle } from "./billing-core.js";
import { syncEntitlementsFromSubscription } from "./entitlement-service.js";

const SIMULATION_MODE = process.env.BILLING_PAYMENT_MODE !== "live";

/**
 * Catat payment untuk invoice (idempotent by transactionReference).
 * @param {object} params
 * @param {string} params.invoiceId
 * @param {number} params.amount
 * @param {string} [params.method]
 * @param {string} [params.provider]
 * @param {string} [params.transactionReference]
 * @param {string} [params.actor]
 * @returns {Promise<{ created: boolean, payment: object }>}
 */
export async function recordPayment({ invoiceId, amount, method = "BANK_TRANSFER", provider = "manual", transactionReference = "", actor = "" }) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error("Invoice tidak ditemukan");
    if (["PAID", "VOID", "CANCELLED"].includes(invoice.status)) {
        throw new Error(`Invoice berstatus ${invoice.status} — tidak bisa dibayar`);
    }

    const ref = transactionReference || `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Idempotency: reference sama → kembalikan payment existing.
    const existing = await Payment.findOne({ transactionReference: ref });
    if (existing) {
        return { created: false, payment: existing };
    }

    const payment = await Payment.create({
        invoiceId,
        companyId: invoice.companyId,
        amount: Math.trunc(Number(amount)),
        currency: invoice.currency || "IDR",
        method,
        provider,
        transactionReference: ref,
        status: "PENDING",
        metadata: { simulation: SIMULATION_MODE },
        createdBy: actor
    });

    return { created: true, payment };
}

/**
 * Verifikasi payment (server-side) → tandai PAID + invoice PAID.
 * Mode simulation: verifikasi otomatis berhasil.
 *
 * Anti-race (M6-FIX v2): transisi status PENDING→PAID dilakukan via
 * conditional update — dua request konkuren tidak bisa double-settle
 * (yang kalah dapat updatedCount 0 dan langsung return).
 *
 * @param {object} payment Dokumen payment
 * @param {string} [actor]
 * @returns {Promise<object>}
 */
export async function verifyPayment(payment, actor = "") {
    if (payment.status === "PAID") return payment;
    if (payment.status === "CANCELLED" || payment.status === "REFUNDED") {
        throw new Error(`Payment berstatus ${payment.status} — tidak bisa diverifikasi`);
    }

    // Conditional update: hanya satu request yang berhasil transisi PENDING→PAID.
    const now = new Date();
    const r = await Payment.updateOne(
        { _id: payment._id, status: payment.status },
        { $set: { status: "PAID", paidAt: now, verifiedAt: now, verifiedBy: actor || "system" } }
    );
    if (!r.modifiedCount) {
        // Request lain sudah memproses (atau status berubah) — muat ulang & return.
        const fresh = await Payment.findById(payment._id);
        return fresh || payment;
    }
    payment.status = "PAID";
    payment.paidAt = now;
    payment.verifiedAt = now;
    payment.verifiedBy = actor || "system";

    // Update invoice → PAID
    const invoice = await Invoice.findById(payment.invoiceId);
    if (invoice && !["PAID", "VOID", "CANCELLED"].includes(invoice.status)) {
        // State machine: DRAFT → ISSUED → PAID. Issue otomatis bila masih DRAFT
        // (sama seperti webhook — M6-FIX konsistensi).
        if (invoice.status === "DRAFT") {
            await transitionInvoice(invoice, "ISSUED", actor || "system");
        }
        await transitionInvoice(invoice, "PAID", actor || "system");
        // M6-FIX: payment PAID → sinkronkan subscription + entitlement
        // (TRIAL→ACTIVE, PAST_DUE/SUSPENDED→ACTIVE, ACTIVE→renew endDate,
        //  entitlement plan features diaktifkan; company-based → entitlement
        //  yang ditagih valid sampai akhir periode).
        // Gagal settle TIDAK membatalkan payment/invoice PAID — dicatat audit
        // agar tidak ada state menggantung (invoice PAID + subscription lama).
        try {
            const settled = await settlePostPayment(invoice, actor || "system");
            payment.settle = settled;
        } catch (settleErr) {
            payment.settle = { settled: false, reason: "settle_failed", error: settleErr.message };
            console.error("[Payment] settlePostPayment gagal:", settleErr.message);
            // Audit failure (tetap return sukses — invoice sudah PAID).
            try {
                const { audit } = await import("../security.js");
                audit.superadminActivity({
                    actorId: "", actorName: actor || "system",
                    action: "payment.settle_failed", targetType: "payment", targetId: payment.transactionReference,
                    targetName: payment.transactionReference,
                    metadata: { invoiceId: String(payment.invoiceId), error: settleErr.message },
                    ip: "", userAgent: ""
                });
            } catch { /* audit failure tidak memblokir */ }
        }
    }

    return payment;
}

/**
 * Settle pasca-pembayaran: kaitan invoice → subscription → entitlement
 * (SP-029 M6-FIX, M6 §55). Idempotent — aman dipanggil dari verify maupun webhook.
 *
 * - Invoice berbasis SUBSCRIPTION: status non-ACTIVE → ACTIVE (resume/trial_to_active),
 *   ACTIVE → perpanjang endDate sesuai billingCycle (renew), lalu sync entitlement
 *   plan features + perpanjang effectiveUntil entitlement.
 * - Invoice COMPANY-BASED (subscriptionId null): entitlement yang ditagih (enabled
 *   & harga > 0) diperpanjang effectiveUntil sampai periodEnd — pembayaran = hak
 *   pakai fitur pada periode tersebut.
 *
 * @param {object} invoice Dokumen invoice (harus sudah PAID)
 * @param {string} actor
 * @returns {Promise<object>}
 */
export async function settlePostPayment(invoice, actor = "system") {
    if (!invoice || invoice.status !== "PAID") {
        return { settled: false, reason: "invoice_not_paid" };
    }

    // ── Invoice berbasis subscription ──
    if (invoice.subscriptionId) {
        const sub = await Subscription.findById(invoice.subscriptionId);
        if (!sub) return { settled: false, reason: "subscription_not_found" };

        const oldStatus = sub.status;
        let changeType = null;
        const now = new Date();

        if (sub.status === "TRIAL") {
            if (!canTransition("TRIAL", "ACTIVE").ok) return { settled: false, reason: `invalid_transition:${sub.status}` };
            sub.status = "ACTIVE";
            sub.trialStart = null;
            sub.trialEnd = null;
            changeType = "trial_to_active";
        } else if (["PAST_DUE", "SUSPENDED"].includes(sub.status)) {
            if (!canTransition(sub.status, "ACTIVE").ok) return { settled: false, reason: `invalid_transition:${sub.status}` };
            sub.status = "ACTIVE";
            changeType = "resume";
        } else if (sub.status === "ACTIVE") {
            changeType = "renew";
        } else {
            // CANCELLED/EXPIRED — payment tidak menghidupkan kembali; flag eksplisit
            // agar operator tahu uang tercatat tapi akses tidak dipulihkan.
            return { settled: false, reason: `subscription_${sub.status.toLowerCase()}`, invoicePaid: true, message: "Invoice PAID tetapi subscription tidak diaktifkan ulang (status terminal)" };
        }

        // Renew/perpanjang: base = max(endDate, now); +1 cycle (sumber tunggal).
        if (sub.status === "ACTIVE") {
            const base = sub.endDate && sub.endDate > now ? sub.endDate : now;
            sub.endDate = addBillingCycle(base, sub.billingCycle);
            if (!sub.startDate) sub.startDate = now;
            if (sub.trialEnd) { sub.trialEnd = null; sub.trialStart = null; }
        }

        await sub.save();

        // Riwayat perubahan subscription (audit trail M6 §15).
        await SubscriptionChange.create({
            subscriptionId: sub._id,
            companyId: sub.companyId,
            changeType,
            oldPlanId: sub.planId,
            newPlanId: sub.planId,
            oldStatus,
            newStatus: sub.status,
            effectiveDate: new Date(),
            proration: "none",
            reason: `payment settled (invoice ${invoice.invoiceNumber})`,
            createdBy: actor
        });

        // Entitlement mengikuti plan (idempotent; MANUAL override dipertahankan).
        const sync = await syncEntitlementsFromSubscription({
            companyId: sub.companyId,
            subscription: sub,
            actor,
            reason: "payment settled"
        });

        return { settled: true, subscription: sub, sync, changeType };
    }

    // ── Invoice company-based (tanpa subscription) ──
    // Fitur yang ditagih berhak dipakai sampai akhir periode invoice.
    const billedFeatureIds = (invoice.items || [])
        .filter(it => it.kind === "feature" && it.refId)
        .map(it => it.refId);
    let updatedEnts = 0;
    if (billedFeatureIds.length) {
        const r = await Entitlement.updateMany(
            { companyId: invoice.companyId, featureId: { $in: billedFeatureIds }, enabled: true },
            { $set: { effectiveUntil: invoice.periodEnd } }
        );
        updatedEnts = r.modifiedCount || 0;
    }
    return { settled: true, companyBased: true, updatedEntitlements: updatedEnts };
}

export default { recordPayment, verifyPayment, settlePostPayment, SIMULATION_MODE };
