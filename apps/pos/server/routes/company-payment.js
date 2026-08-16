/**
 * Company Payment Route — QRIS + Bank Accounts (F&B V1).
 *
 * Settings → Company → Payment Settings (POS).
 *   GET  /api/company-payment/qris               — baca QRIS company
 *   PUT  /api/company-payment/qris               — upload/update QRIS
 *   POST /api/company-payment/qris/disable       — nonaktifkan QRIS
 *   GET  /api/company-payment/bank-accounts      — daftar rekening
 *   POST /api/company-payment/bank-accounts      — tambah rekening (maks 3 aktif)
 *   PUT  /api/company-payment/bank-accounts/:id  — ubah rekening
 *   DELETE /api/company-payment/bank-accounts/:id— hapus rekening
 *
 * QRIS harus milik COMPANY tsb (companyCode scope — BUKAN QRIS SMART VISION).
 * Maksimal 3 rekening AKTIF (enforcement server-side; nonaktif bukan hapus).
 * Permission: settings.company.edit (Admin/Owner).
 *
 * @module server/routes/company-payment
 */

import { Router } from "express";
import { CompanyQris } from "../models/CompanyQris.js";
import { BankAccount } from "../models/BankAccount.js";
import { security } from "../security.js";

const router = Router();
const MAX_ACTIVE_BANKS = 3;

// ── QRIS Company ──

/** GET /qris — baca QRIS company (null bila belum upload). */
router.get("/qris", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const qris = await CompanyQris.findOne({ companyCode }).lean();
        res.json({ qris: qris || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /qris — upload / update QRIS company.
 * Body: { qrisImage: string (data URI), active?: boolean }
 * qrisImage wajib (V1: data URI hasil kompresi client, pola sama foto produk).
 */
router.put("/qris", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const qrisImage = String(req.body?.qrisImage || "").trim();
        if (!qrisImage) return res.status(400).json({ error: "Gambar QRIS wajib diisi" });
        if (qrisImage.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: "Gambar QRIS terlalu besar (maks 5MB)" });
        }

        const qris = await CompanyQris.findOneAndUpdate(
            { companyCode },
            {
                $set: {
                    qrisImage,
                    active: req.body?.active !== false,
                    updatedBy: req.headers["x-user-name"] || "System"
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json(qris);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /qris/disable — nonaktifkan QRIS (dipakai bila salah upload). */
router.post("/qris/disable", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const qris = await CompanyQris.findOneAndUpdate(
            { companyCode },
            { $set: { active: false, updatedBy: req.headers["x-user-name"] || "System" } },
            { new: true }
        );
        if (!qris) return res.status(404).json({ error: "QRIS belum diupload" });
        res.json(qris);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Bank Accounts ──

/** GET /bank-accounts — daftar rekening company. */
router.get("/bank-accounts", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const accounts = await BankAccount.find({ companyCode }).sort({ createdAt: 1 }).lean();
        res.json({ data: accounts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Normalisasi payload rekening (lempar Error bila tidak valid). */
function normalizeBankPayload(body) {
    const bankName = String(body?.bankName || "").trim();
    const accountNumber = String(body?.accountNumber || "").trim();
    const accountName = String(body?.accountName || "").trim();
    if (!bankName) throw new Error("Nama bank wajib diisi");
    if (!accountNumber) throw new Error("Nomor rekening wajib diisi");
    if (!accountName) throw new Error("Atas nama rekening wajib diisi");
    if (bankName.length > 60 || accountNumber.length > 40 || accountName.length > 80) {
        throw new Error("Data rekening terlalu panjang");
    }
    return { bankName, accountNumber, accountName, active: body?.active !== false };
}

/**
 * POST /bank-accounts — tambah rekening.
 * Maksimal 3 rekening AKTIF per company (menambah melebihi → 409).
 */
router.post("/bank-accounts", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        let payload;
        try {
            payload = normalizeBankPayload(req.body);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        if (payload.active) {
            const activeCount = await BankAccount.countDocuments({ companyCode, active: true });
            if (activeCount >= MAX_ACTIVE_BANKS) {
                return res.status(409).json({ error: `Maksimal ${MAX_ACTIVE_BANKS} rekening aktif — nonaktifkan salah satu rekening terlebih dahulu` });
            }
        }

        try {
            const account = await BankAccount.create({
                companyCode,
                ...payload,
                createdBy: req.headers["x-user-name"] || "System"
            });
            return res.status(201).json(account);
        } catch (err) {
            if (err && err.code === 11000) {
                return res.status(409).json({ error: "Rekening sudah terdaftar (bank + nomor yang sama)" });
            }
            throw err;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** PUT /bank-accounts/:id — ubah rekening (max 3 aktif tetap dijaga). */
router.put("/bank-accounts/:id", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const account = await BankAccount.findOne({ _id: req.params.id, companyCode });
        if (!account) return res.status(404).json({ error: "Rekening tidak ditemukan" });
        let payload;
        try {
            payload = normalizeBankPayload({ ...req.body, active: req.body?.active !== undefined ? req.body.active : account.active });
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        // Aktifkan rekening yang tadinya nonaktif → cek kuota
        if (payload.active && !account.active) {
            const activeCount = await BankAccount.countDocuments({ companyCode, active: true });
            if (activeCount >= MAX_ACTIVE_BANKS) {
                return res.status(409).json({ error: `Maksimal ${MAX_ACTIVE_BANKS} rekening aktif — nonaktifkan salah satu rekening terlebih dahulu` });
            }
        }

        account.bankName = payload.bankName;
        account.accountNumber = payload.accountNumber;
        account.accountName = payload.accountName;
        account.active = payload.active;
        account.updatedBy = req.headers["x-user-name"] || "System";
        try {
            await account.save();
        } catch (err) {
            if (err && err.code === 11000) {
                return res.status(409).json({ error: "Rekening sudah terdaftar (bank + nomor yang sama)" });
            }
            throw err;
        }
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** DELETE /bank-accounts/:id — hapus rekening (hard delete, admin hanya). */
router.delete("/bank-accounts/:id", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const account = await BankAccount.findOneAndDelete({ _id: req.params.id, companyCode });
        if (!account) return res.status(404).json({ error: "Rekening tidak ditemukan" });
        res.json({ ok: true, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
