/**
 * Qr Tables Route — QR Menu Meja admin (F&B V1).
 *
 * Admin mengelola meja + link QR permanen:
 *   GET    /api/qr-tables            — daftar meja (company scope)
 *   POST   /api/qr-tables            — tambah meja
 *   PUT    /api/qr-tables/:id        — ubah meja
 *   DELETE /api/qr-tables/:id        — hapus meja
 *   POST   /api/qr-tables/:id/qr     — buat link QR (sekali saja — PERMANEN)
 *   POST   /api/qr-tables/:id/qr/disable — nonaktifkan QR meja
 *
 * Link QR: https://pos.e-profit.id/m/{qrIdentifier}. `qrIdentifier` dibuat
 * SEKALI (permanent) — cetak ulang / preview / download TIDAK membuat link
 * baru. Server resolve: identifier → company → lokasi → table.
 *
 * Permission: pos.qr.manage (Admin/Owner).
 *
 * @module server/routes/qr-tables
 */

import { Router } from "express";
import { QrTable } from "../models/QrTable.js";
import { Warehouse } from "../models/Warehouse.js";
import { security } from "../security.js";
import { generateToken } from "../services/qr-menu.js";

const router = Router();

/** Normalisasi payload meja (pure-ish, lempar Error bila tidak valid). */
function normalizeTablePayload(body) {
    const nomorMeja = String(body?.nomorMeja || "").trim();
    if (!nomorMeja) throw new Error("Nomor meja wajib diisi");
    if (nomorMeja.length > 40) throw new Error("Nomor meja terlalu panjang (maks 40 karakter)");
    const lokasiId = String(body?.lokasiId || "").trim();
    return { nomorMeja, lokasiId };
}

/** GET / — daftar meja (dengan info lokasi), terbaru dulu. */
router.get("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const q = companyCode ? { companyCode } : {};
        const tables = await QrTable.find(q).sort({ createdAt: -1 }).lean();
        // QR Menu Link dihitung SERVER untuk tiap meja (model hanya menyimpan
        // qrIdentifier). Tanpa ini client tidak pernah menerima qrLink dari
        // daftar → aksi Generate/Preview/Cetak gagal "Link QR belum dibuat"
        // walau link sudah pernah dibuat (identifier permanen sama).
        const baseUrl = req.app.get("qrBaseUrl") || `${req.protocol}://${req.get("host")}`;
        const data = tables.map(t => ({
            ...t,
            qrLink: t.qrIdentifier ? `${baseUrl}/m/${t.qrIdentifier}` : ""
        }));
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST / — tambah meja baru. */
router.post("/", security.permission("pos.qr.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        let payload;
        try {
            payload = normalizeTablePayload(req.body, companyCode);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        // Lokasi default: gudang pertama (fallback) — resolve nama utk display.
        let lokasiNama = "";
        if (payload.lokasiId) {
            const w = await Warehouse.findOne({ companyCode, _id: payload.lokasiId }).select("kode nama").lean();
            if (!w) return res.status(400).json({ error: "Lokasi tidak ditemukan" });
            lokasiNama = w.nama || w.kode || "";
        } else {
            const first = await Warehouse.findOne({ companyCode }).select("kode nama").sort({ createdAt: 1 }).lean();
            if (first) {
                payload.lokasiId = String(first._id);
                lokasiNama = first.nama || first.kode || "";
            }
        }

        const table = await QrTable.create({
            companyCode,
            lokasiId: payload.lokasiId,
            lokasiNama,
            nomorMeja: payload.nomorMeja,
            createdBy: req.headers["x-user-name"] || "System"
        });
        res.status(201).json(table);
    } catch (err) {
        // Duplicate key (company, lokasi, nomor meja) → 409
        if (err && err.code === 11000) {
            return res.status(409).json({ error: "Nomor meja sudah terdaftar di lokasi ini" });
        }
        res.status(500).json({ error: err.message });
    }
});

/** PUT /:id — ubah meja (nomor / lokasi). QR identifier TIDAK berubah. */
router.put("/:id", security.permission("pos.qr.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        let payload;
        try {
            payload = normalizeTablePayload(req.body, companyCode);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
        const table = await QrTable.findOne({ _id: req.params.id, companyCode });
        if (!table) return res.status(404).json({ error: "Meja tidak ditemukan" });

        let lokasiNama = table.lokasiNama || "";
        if (payload.lokasiId) {
            const w = await Warehouse.findOne({ companyCode, _id: payload.lokasiId }).select("kode nama").lean();
            if (!w) return res.status(400).json({ error: "Lokasi tidak ditemukan" });
            lokasiNama = w.nama || w.kode || "";
        }
        table.nomorMeja = payload.nomorMeja;
        table.lokasiId = payload.lokasiId;
        table.lokasiNama = lokasiNama;
        table.updatedBy = req.headers["x-user-name"] || "System";
        try {
            await table.save();
        } catch (err) {
            if (err && err.code === 11000) {
                return res.status(409).json({ error: "Nomor meja sudah terdaftar di lokasi ini" });
            }
            throw err;
        }
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** DELETE /:id — hapus meja. */
router.delete("/:id", security.permission("pos.qr.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const table = await QrTable.findOneAndDelete({ _id: req.params.id, companyCode });
        if (!table) return res.status(404).json({ error: "Meja tidak ditemukan" });
        res.json({ ok: true, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/qr — buat link QR MENU meja.
 * HANYA meja yang belum punya identifier yang dibuatkan link (permanent):
 * cetak ulang / preview TIDAK membuat link baru — identifier yang sama.
 * @returns {{ qrIdentifier, qrLink }}
 */
router.post("/:id/qr", security.permission("pos.qr.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const table = await QrTable.findOne({ _id: req.params.id, companyCode });
        if (!table) return res.status(404).json({ error: "Meja tidak ditemukan" });

        if (!table.qrIdentifier) {
            table.qrIdentifier = generateToken(10);
            table.active = true;
            table.updatedBy = req.headers["x-user-name"] || "System";
            await table.save();
        }

        const baseUrl = req.app.get("qrBaseUrl") || `${req.protocol}://${req.get("host")}`;
        res.json({
            qrIdentifier: table.qrIdentifier,
            qrLink: `${baseUrl}/m/${table.qrIdentifier}`,
            active: table.active
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /:id/qr/disable — nonaktifkan QR meja (customer lihat \"QR Menu tidak aktif\"). */
router.post("/:id/qr/disable", security.permission("pos.qr.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const table = await QrTable.findOneAndUpdate(
            { _id: req.params.id, companyCode },
            { $set: { active: false, updatedBy: req.headers["x-user-name"] || "System" } },
            { new: true }
        );
        if (!table) return res.status(404).json({ error: "Meja tidak ditemukan" });
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
