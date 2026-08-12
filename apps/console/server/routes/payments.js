/**
 * Payments API Routes (SP-029 M6 §22-25, §37, §53).
 *
 * Payment abstraction + provider abstraction. Mode default SIMULATION
 * (BILLING_PAYMENT_MODE !== "live") — tidak ada mutasi finansial nyata.
 * Webhook diverifikasi server-side + idempotent (transactionReference unique).
 *
 * Endpoint:
 *   GET    /api/payments
 *   GET    /api/payments/:id
 *   POST   /api/payments              — catat payment (idempotent by reference)
 *   POST   /api/payments/:id/verify   — verifikasi server-side
 *   POST   /api/payments/:id/refund   — refund foundation
 *   POST   /api/payments/webhook      — webhook provider (verified + idempotent)
 *
 * @module console/server/routes/payments
 */

import { Router } from "express";
import { security, audit } from "../security.js";
import { Payment } from "../models/Payment.js";
import { Invoice } from "../models/Invoice.js";
import { recordPayment, verifyPayment, settlePostPayment } from "../billing/payment-service.js";
import { transitionInvoice } from "../billing/invoice-service.js";

const router = Router();

const SIMULATION_MODE = process.env.BILLING_PAYMENT_MODE !== "live";

// ⚠️ Webhook DIDAftarkan SEBELUM router.use(authenticate) — provider
// payment tidak punya JWT superadmin; verifikasi via secret (M6 §24).
// Route ini tetap: diverifikasi secret + idempotent + audited.
/**
 * POST /api/payments/webhook — webhook provider.
 * Diverifikasi (token/secret header), idempotent by transactionReference.
 * Dalam mode simulation, dipanggil manual/oleh sistem — tidak memproses
 * payload client tanpa verifikasi.
 */
router.post("/webhook", async (req, res) => {
    const expected = process.env.BILLING_WEBHOOK_SECRET;
    const received = req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace(/^Bearer /i, "");
    if (!expected || received !== expected) {
        audit.superadminActivity({
            actorId: "", actorName: "webhook",
            action: "payment.webhook_rejected", targetType: "payment", targetId: "",
            targetName: "", metadata: { reason: "invalid_secret" },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        return res.status(401).json({ error: "invalid webhook secret" });
    }

    try {
        const { invoiceId, transactionReference, amount, status } = req.body || {};
        if (!invoiceId || !transactionReference) {
            return res.status(400).json({ error: "invoiceId dan transactionReference wajib" });
        }

        // Idempotency: sudah ada → kembalikan tanpa duplikasi.
        const existing = await Payment.findOne({ transactionReference });
        if (existing) return res.json({ duplicate: true, payment: existing });

        const invoiceDoc = await Invoice.findById(invoiceId);
        if (!invoiceDoc) return res.status(404).json({ error: "Invoice tidak ditemukan" });
        const payment = await Payment.create({
            invoiceId,
            companyId: invoiceDoc.companyId,
            amount: Math.trunc(Number(amount) || 0),
            currency: "IDR",
            method: "MANUAL",
            provider: "webhook",
            transactionReference,
            status: status === "paid" ? "PAID" : "PENDING",
            paidAt: status === "paid" ? new Date() : null,
            verifiedAt: status === "paid" ? new Date() : null,
            verifiedBy: "webhook",
            createdBy: "webhook"
        });

        if (status === "paid") {
            if (invoiceDoc && !["PAID", "VOID", "CANCELLED"].includes(invoiceDoc.status)) {
                // State machine: DRAFT → ISSUED → PAID. Issue otomatis bila masih DRAFT.
                if (invoiceDoc.status === "DRAFT") {
                    await transitionInvoice(invoiceDoc, "ISSUED", "webhook");
                }
                await transitionInvoice(invoiceDoc, "PAID", "webhook");
                // M6-FIX: payment PAID → sinkronkan subscription + entitlement.
                await settlePostPayment(invoiceDoc, "webhook");
            }
        }

        audit.superadminActivity({
            actorId: "", actorName: "webhook",
            action: "payment.webhook_processed", targetType: "payment", targetId: transactionReference,
            targetName: transactionReference,
            metadata: { invoiceId, amount: payment.amount, status },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.status(201).json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.use(security.authenticate, security.requireSuperAdmin);

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.invoiceId) filter.invoiceId = req.query.invoiceId;
        const total = await Payment.countDocuments(filter);
        const data = await Payment.find(filter)
            .populate("invoiceId", "invoiceNumber total status")
            .populate("companyId", "code name")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit).limit(limit).lean();
        res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const item = await Payment.findById(req.params.id)
            .populate("invoiceId", "invoiceNumber total status")
            .populate("companyId", "code name").lean();
        if (!item) return res.status(404).json({ error: "Payment tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/payments — catat payment (mode simulation default). */
router.post("/", async (req, res) => {
    try {
        const { invoiceId, amount, method = "BANK_TRANSFER", provider = "manual", transactionReference = "" } = req.body || {};
        if (!invoiceId) return res.status(400).json({ error: "invoiceId wajib" });
        const a = Number(amount);
        if (Number.isNaN(a) || a <= 0 || !Number.isInteger(a)) {
            return res.status(400).json({ error: "amount wajib integer > 0 (minor units)" });
        }
        const result = await recordPayment({
            invoiceId, amount: a, method, provider, transactionReference,
            actor: req.user.name || ""
        });

        if (result.created) {
            audit.superadminActivity({
                actorId: req.user.id, actorName: req.user.name,
                action: "payment.record", targetType: "payment", targetId: result.payment.transactionReference,
                targetName: result.payment.transactionReference,
                metadata: { invoiceId, amount: a, method, provider, simulation: SIMULATION_MODE },
                ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
            });
            return res.status(201).json(result.payment);
        }
        res.json({ ...result.payment.toObject?.() ?? result.payment, duplicate: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/payments/:id/verify — verifikasi server-side. */
router.post("/:id/verify", async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ error: "Payment tidak ditemukan" });
        const verified = await verifyPayment(payment, req.user.name || "system");
        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "payment.verify", targetType: "payment", targetId: verified.transactionReference,
            targetName: verified.transactionReference,
            metadata: { invoiceId: String(verified.invoiceId), amount: verified.amount, simulation: SIMULATION_MODE },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(verified);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** POST /api/payments/:id/refund — refund foundation (status → REFUNDED). */
router.post("/:id/refund", async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ error: "Payment tidak ditemukan" });
        if (payment.status !== "PAID") {
            return res.status(400).json({ error: `Hanya payment PAID yang bisa direfund (sekarang ${payment.status})` });
        }
        const { reason = "" } = req.body || {};
        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ error: "Reason refund wajib minimal 5 karakter" });
        }
        payment.status = "REFUNDED";
        payment.refundedAt = new Date();
        payment.refundReason = reason.trim();
        payment.refundedBy = req.user.name || "";
        await payment.save();

        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "payment.refund", targetType: "payment", targetId: payment.transactionReference,
            targetName: payment.transactionReference,
            metadata: { invoiceId: String(payment.invoiceId), amount: payment.amount, reason },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
