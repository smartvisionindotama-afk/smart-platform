/**
 * Invoices API Routes (SP-029 M6 §18-20, §36, §53).
 *
 * Invoice dibuat server-side (InvoiceService) — anti double-billing,
 * nomor unik reproducible, perhitungan integer minor units.
 *
 * Endpoint:
 *   GET    /api/invoices
 *   GET    /api/invoices/:id
 *   POST   /api/invoices/generate      — generate untuk subscription+period (idempotent)
 *   POST   /api/invoices/:id/issue
 *   POST   /api/invoices/:id/void
 *   POST   /api/invoices/:id/transition  — PENDING/OVERDUE/CANCELLED (validated)
 *
 * @module console/server/routes/invoices
 */

import { Router } from "express";
import mongoose from "mongoose";
import { security, audit } from "../security.js";
import { Invoice } from "../models/Invoice.js";
import { createInvoiceForPeriod, createCompanyInvoiceForPeriod, transitionInvoice } from "../billing/invoice-service.js";

const router = Router();
router.use(security.authenticate, security.requireSuperAdmin);

router.get("/", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.companyId) filter.companyId = req.query.companyId;
        const total = await Invoice.countDocuments(filter);
        const data = await Invoice.find(filter)
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
        const item = await Invoice.findById(req.params.id).populate("companyId", "code name").lean();
        if (!item) return res.status(404).json({ error: "Invoice tidak ditemukan" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/invoices/generate-company — invoice langsung per company + periode (idempotent). */
router.post("/generate-company", async (req, res) => {
    try {
        const { companyId, periodStart, periodEnd, discount = 0, taxRate = 0, notes = "" } = req.body || {};
        if (!companyId || !periodStart || !periodEnd) {
            return res.status(400).json({ error: "companyId, periodStart, periodEnd wajib" });
        }
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({ error: "companyId tidak valid" });
        }
        const result = await createCompanyInvoiceForPeriod({
            companyId,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            actor: req.user.name || "",
            discount,
            taxRate,
            notes
        });

        if (result.created) {
            audit.superadminActivity({
                actorId: req.user.id, actorName: req.user.name,
                action: "invoice.create_company", targetType: "invoice", targetId: result.invoice.invoiceNumber,
                targetName: result.invoice.invoiceNumber,
                metadata: { companyId, total: result.invoice.total, periodStart, periodEnd },
                ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
            });
            return res.status(201).json(result.invoice);
        }
        res.json({ ...(result.invoice.toObject?.() ?? result.invoice), duplicate: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** POST /api/invoices/generate — idempotent (anti double-billing). */
router.post("/generate", async (req, res) => {
    try {
        const { subscriptionId, periodStart, periodEnd, discount = 0, taxRate = 0, addonItems = [] } = req.body || {};
        if (!subscriptionId || !periodStart || !periodEnd) {
            return res.status(400).json({ error: "subscriptionId, periodStart, periodEnd wajib" });
        }
        const result = await createInvoiceForPeriod({
            subscriptionId,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            actor: req.user.name || "",
            discount,
            taxRate,
            addonItems: Array.isArray(addonItems) ? addonItems : []
        });

        if (result.created) {
            audit.superadminActivity({
                actorId: req.user.id, actorName: req.user.name,
                action: "invoice.create", targetType: "invoice", targetId: result.invoice.invoiceNumber,
                targetName: result.invoice.invoiceNumber,
                metadata: { subscriptionId, total: result.invoice.total, periodStart, periodEnd },
                ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
            });
            return res.status(201).json(result.invoice);
        }
        res.json({ ...result.invoice.toObject?.() ?? result.invoice, duplicate: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/:id/issue", async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ error: "Invoice tidak ditemukan" });
        const updated = await transitionInvoice(invoice, "ISSUED", req.user.name);
        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "invoice.issue", targetType: "invoice", targetId: updated.invoiceNumber, targetName: updated.invoiceNumber,
            metadata: { total: updated.total },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/:id/void", async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ error: "Invoice tidak ditemukan" });
        const updated = await transitionInvoice(invoice, "VOID", req.user.name);
        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: "invoice.void", targetType: "invoice", targetId: updated.invoiceNumber, targetName: updated.invoiceNumber,
            metadata: { reason: req.body?.reason || "" },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** POST /:id/transition — PENDING/OVERDUE/CANCELLED (validated state machine). */
router.post("/:id/transition", async (req, res) => {
    try {
        const { status } = req.body || {};
        if (!["PENDING", "OVERDUE", "CANCELLED", "FAILED"].includes(status)) {
            return res.status(400).json({ error: "Status target harus PENDING/OVERDUE/CANCELLED/FAILED" });
        }
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ error: "Invoice tidak ditemukan" });
        const updated = await transitionInvoice(invoice, status, req.user.name);
        audit.superadminActivity({
            actorId: req.user.id, actorName: req.user.name,
            action: `invoice.${String(status).toLowerCase()}`, targetType: "invoice", targetId: updated.invoiceNumber, targetName: updated.invoiceNumber,
            metadata: { to: status, reason: req.body?.reason || "" },
            ip: req.ip || "", userAgent: req.headers["user-agent"] || ""
        });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
