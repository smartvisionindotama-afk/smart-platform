/**
 * InvoiceService (SP-029 M6 §18-20, §25, §27).
 *
 * Invoice dibuat SERVER-SIDE dengan perhitungan integer minor units.
 * Anti double-billing: unique index (subscriptionId, periodStart, periodEnd)
 * + cek eksplisit sebelum create.
 *
 * @module console/server/billing/invoice-service
 */

import { Invoice } from "../models/Invoice.js";
import { Subscription } from "../models/Subscription.js";
import { Plan } from "../models/Plan.js";
import { Company } from "../models/Company.js";
import { Entitlement } from "../models/Entitlement.js";
import { Feature } from "../models/Feature.js";
import { buildInvoiceNumber, calculateInvoiceTotal, periodKey, buildCompanyItems } from "./billing-core.js";
import { nextSequence, syncCounterFromExisting } from "./counter.js";

/**
 * Buat invoice untuk subscription pada periode tertentu (idempotent).
 * @param {object} params
 * @param {string} params.subscriptionId
 * @param {Date} params.periodStart
 * @param {Date} params.periodEnd
 * @param {string} [params.actor]
 * @param {number} [params.discount=0]
 * @param {number} [params.taxRate=0]
 * @param {Array} [params.addonItems] [{ label, amount, quantity }]
 * @returns {Promise<{ created: boolean, invoice: object }>}
 */
export async function createInvoiceForPeriod({
    subscriptionId,
    periodStart,
    periodEnd,
    actor = "",
    discount = 0,
    taxRate = 0,
    addonItems = []
}) {
    const sub = await Subscription.findById(subscriptionId);
    if (!sub) throw new Error("Subscription tidak ditemukan");
    const plan = await Plan.findById(sub.planId).lean();
    if (!plan) throw new Error("Plan tidak ditemukan");

    // Anti double-billing: cek eksplisit (selain unique index).
    const existing = await Invoice.findOne({ subscriptionId, periodStart, periodEnd });
    if (existing) {
        return { created: false, invoice: existing };
    }

    const planAmount = sub.price != null ? Math.trunc(sub.price) : Math.trunc(plan.price || 0);

    const addonTotal = addonItems.reduce((sum, a) => sum + Math.trunc(Number(a.amount || 0) * Number(a.quantity || 1)), 0);
    const calc = calculateInvoiceTotal({ subtotal: planAmount, addons: addonTotal, discount, taxRate });

    // Nomor invoice: sequence per bulan — ATOMIK via counter (anti race).
    // Sinkronisasi counter dengan invoice existing bulan ini (M6-FIX): jika
    // counter belum ada, diinisialisasi dari nomor terbesar yang sudah dipakai
    // sehingga tidak terjadi tabrakan nomor (unique invoiceNumber).
    const now = new Date();
    const counterKey = `invoice:${periodKey(now)}`;
    await syncCounterFromExisting(counterKey, `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/`);
    const seq = await nextSequence(counterKey);
    const invoiceNumber = buildInvoiceNumber(seq, now);

    const items = [
        { kind: "plan", label: `${plan.name} (${sub.billingCycle})`, amount: planAmount, quantity: 1, unitPrice: planAmount, refType: "plan", refId: String(plan._id) },
        ...addonItems.map(a => ({ kind: "addon", label: a.label, amount: Math.trunc(Number(a.amount) * Number(a.quantity || 1)), quantity: a.quantity || 1, unitPrice: Math.trunc(Number(a.amount)) })),
        ...(discount > 0 ? [{ kind: "discount", label: "Discount", amount: -Math.trunc(discount), quantity: 1, unitPrice: -Math.trunc(discount) }] : []),
        ...(calc.tax > 0 ? [{ kind: "tax", label: `Tax ${taxRate}%`, amount: calc.tax, quantity: 1, unitPrice: calc.tax }] : [])
    ];

    const invoice = await Invoice.create({
        companyId: sub.companyId,
        subscriptionId: sub._id,
        invoiceNumber,
        periodStart,
        periodEnd,
        items,
        subtotal: calc.subtotal,
        discount: calc.discount,
        tax: calc.tax,
        taxRate: Number(taxRate) || 0,
        total: calc.total,
        currency: sub.currency || "IDR",
        status: "DRAFT",
        createdBy: actor
    });

    return { created: true, invoice };
}

/**
 * Buat invoice langsung untuk satu COMPANY (tanpa wajib subscription) —
 * M6-FIX "Invoice by Company". Item = fitur-fitur yang ENABLED dengan harga
 * (override perusahaan Entitlement.price ?? katalog Feature.price).
 *
 * Idempotent anti double-billing per (companyId, periodStart, periodEnd) untuk
 * invoice tanpa subscription (partial unique index + cek eksplisit).
 *
 * @param {object} params
 * @param {string} params.companyId
 * @param {Date} params.periodStart
 * @param {Date} params.periodEnd
 * @param {string} [params.actor]
 * @param {number} [params.discount=0]
 * @param {number} [params.taxRate=0]
 * @param {string} [params.notes]
 * @returns {Promise<{ created: boolean, invoice: object }>}
 */
export async function createCompanyInvoiceForPeriod({
    companyId,
    periodStart,
    periodEnd,
    actor = "",
    discount = 0,
    taxRate = 0,
    notes = ""
}) {
    const company = await Company.findById(companyId).lean();
    if (!company) throw new Error("Company tidak ditemukan");

    // Anti double-billing per company+periode (invoice company-based).
    const existing = await Invoice.findOne({ companyId, periodStart, periodEnd, subscriptionId: null });
    if (existing) {
        return { created: false, invoice: existing };
    }

    // Fitur enabled dengan harga efektif (override ?? katalog) — pure function.
    const ents = await Entitlement.find({ companyId, enabled: true }).lean();
    const featureIds = ents.map(e => e.featureId).filter(Boolean);
    const features = await Feature.find({ _id: { $in: featureIds } }).lean();
    const items = buildCompanyItems(ents, features);
    if (!items.length) {
        throw new Error("Tidak ada fitur yang dapat ditagih — aktifkan fitur atau atur harga fitur terlebih dahulu");
    }

    const subtotal = items.reduce((s, it) => s + it.amount, 0);
    const calc = calculateInvoiceTotal({ subtotal, discount, taxRate });

    const now = new Date();
    const counterKey = `invoice:${periodKey(now)}`;
    await syncCounterFromExisting(counterKey, `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/`);
    const seq = await nextSequence(counterKey);
    const invoiceNumber = buildInvoiceNumber(seq, now);

    let invoice;
    try {
        invoice = await Invoice.create({
            companyId,
            subscriptionId: null,
            invoiceNumber,
            periodStart,
            periodEnd,
            items: [
                ...items,
                ...(discount > 0 ? [{ kind: "discount", label: "Discount", amount: -Math.trunc(discount), quantity: 1, unitPrice: -Math.trunc(discount) }] : []),
                ...(calc.tax > 0 ? [{ kind: "tax", label: `Tax ${taxRate}%`, amount: calc.tax, quantity: 1, unitPrice: calc.tax }] : [])
            ],
            subtotal: calc.subtotal,
            discount: calc.discount,
            tax: calc.tax,
            taxRate: Number(taxRate) || 0,
            total: calc.total,
            currency: company.currency || "IDR",
            status: "DRAFT",
            notes,
            createdBy: actor
        });
    } catch (err) {
        // Race: dua request konkuren periode sama → unique index. Kembalikan
        // yang sudah ada sebagai duplicate (bukan error mentah E11000).
        if (err?.code === 11000) {
            const dup = await Invoice.findOne({ companyId, periodStart, periodEnd, subscriptionId: null });
            if (dup) return { created: false, invoice: dup };
        }
        throw err;
    }

    return { created: true, invoice };
}

/**
 * Transisi status invoice (validasi server-side).
 * @param {object} invoice Dokumen invoice
 * @param {string} toStatus
 * @param {string} [actor]
 * @returns {Promise<object>}
 */
export async function transitionInvoice(invoice, toStatus, actor = "") {
    const VALID = {
        DRAFT: ["ISSUED", "VOID", "CANCELLED"],
        ISSUED: ["PENDING", "PAID", "OVERDUE", "VOID", "CANCELLED"],
        PENDING: ["PAID", "OVERDUE", "CANCELLED", "FAILED"],
        OVERDUE: ["PAID", "CANCELLED"],
        PAID: [],      // terminal
        VOID: [],      // terminal
        CANCELLED: []  // terminal
    };
    const allowed = VALID[invoice.status] || [];
    if (!allowed.includes(toStatus)) {
        throw new Error(`Transisi invoice tidak valid: ${invoice.status} → ${toStatus}`);
    }
    const patch = { status: toStatus, updatedBy: actor };
    if (toStatus === "ISSUED") patch.issuedAt = new Date();
    if (toStatus === "PAID") patch.paidAt = new Date();
    Object.assign(invoice, patch);
    await invoice.save();
    return invoice;
}

export default { createInvoiceForPeriod, createCompanyInvoiceForPeriod, transitionInvoice };
