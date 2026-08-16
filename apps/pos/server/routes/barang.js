import { Router } from "express";
import { Barang } from "../models/Barang.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { formatError } from "../utils/format-error.js";

const router = Router();

// List with search & pagination
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();
        const companyCode = req.headers["x-company-code"];

        let query = {};
        if (companyCode) query.companyCode = companyCode;
        if (search) {
            query.$or = [
                { kode: { $regex: search, $options: "i" } },
                { nama: { $regex: search, $options: "i" } },
                { kategori: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Barang.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Barang.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check kode existence (BEFORE /:id to avoid route conflict)
// SELALU discope per gudang (kode yang sama di gudang berbeda dianggap VALID —
// konsisten dengan validasi POST/PUT). `excludeId` = dokumen yang sedang diedit
// (di-exclude agar edit barang dengan kode yang sama TIDAK dianggap duplikat).
router.get("/check-kode/:kode", async (req, res) => {
    try {
        const kode = req.params.kode;
        const gudang = req.query.gudang || "";
        const excludeId = req.query.excludeId || "";
        const companyCode = req.headers["x-company-code"];
        const escaped = kode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const query = { kode: { $regex: new RegExp("^" + escaped + "$", "i") } };
        if (companyCode) query.companyCode = companyCode;
        // Scope ke gudang SELALU (termasuk gudang kosong) — jangan pernah
        // cocokkan lintas gudang (kode sama di gudang beda = legal).
        if (gudang) {
            query.gudang = gudang;
        } else {
            // Bucket gudang kosong: item legacy tanpa field gudang ikut cocok.
            query.gudang = { $in: ["", null] };
        }
        // Edit mode: kecualikan barang yang sedang diedit
        if (excludeId && /^[0-9a-fA-F]{24}$/.test(excludeId)) {
            query._id = { $ne: excludeId };
        }
        const item = await Barang.findOne(query);
        if (item) {
            return res.json({ exists: true, nama: item.nama, id: item._id.toString() });
        }
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Helper: check if a barang belongs to the requesting company.
 */
function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true; // no company filter = allow
    return item.companyCode === companyCode;
}

/**
 * Normalisasi VARIAN produk (M6.2-FIX v0.43 — marketplace SKU):
 *  - varianDef: [{ nama, nilai[] }] — dimensi varian (ukuran/warna/topping)
 *  - skus:      [{ kode, label, foto, harga, harga_khusus, stok }] — tiap
 *    kombinasi = 1 SKU; `harga` = pelanggan umum, `harga_khusus` = member.
 *  - stok utama dihitung ulang = Σ stok seluruh SKU (agregat untuk
 *    laporan/kasir); bila tanpa SKU, stok = nilai yang dikirim (existing).
 *  - harga_jual global di-derive = harga SKU termurah ("mulai") agar
 *    list/detail/fallback offline tetap menampilkan harga bermakna.
 * @param {object} data Body request (mutated)
 */
function normalizeVarian(data) {
    if (!Array.isArray(data.skus)) return; // field tidak dikirim → biarkan

    const varianDef = Array.isArray(data.varianDef)
        ? data.varianDef
            .filter(d => d && String(d.nama || "").trim() && Array.isArray(d.nilai))
            .map(d => ({
                nama: String(d.nama).trim(),
                nilai: d.nilai.map(n => String(n || "").trim()).filter(Boolean)
            }))
            .filter(d => d.nilai.length)
        : [];

    const skus = Array.isArray(data.skus)
        ? data.skus
            .filter(s => s && String(s.kode || "").trim())
            .map(s => ({
                kode: String(s.kode).trim(),
                label: String(s.label || "").trim(),
                // M6.2-FIX v0.43 — foto per SKU (opsional, data URI)
                foto: String(s.foto || ""),
                harga: Math.max(0, Number(s.harga) || 0),
                // M6.2-FIX — harga khusus per SKU utk member (0 = pakai harga)
                harga_khusus: Math.max(0, Number(s.harga_khusus) || 0),
                stok: Math.max(0, Number(s.stok) || 0)
            }))
        : [];

    data.varianDef = varianDef;
    data.skus = skus;
    if (skus.length) {
        // Barang ber-varian: stok utama = agregat seluruh SKU
        data.stok = skus.reduce((sum, s) => sum + s.stok, 0);
        // Harga "mulai" = SKU termurah (utk list/detail/fallback offline).
        data.harga_jual = Math.min(...skus.map(s => s.harga));
    }
}

// Get by ID (scoped to company)
router.get("/:id", async (req, res) => {
    try {
        const item = await Barang.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) {
            return res.status(404).json({ error: "Not found" });
        }
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create (manual kode from user input, auto-tag with company from header)
router.post("/", async (req, res) => {
    try {
        const data = { ...req.body };
        
        // Kode barang MUST be provided by user (manual, barcode, or QR)
        if (!data.kode || !data.kode.trim()) {
            return res.status(400).json({ error: "Kode barang wajib diisi (manual, barcode, atau QR code)" });
        }
        data.kode = data.kode.trim(); // Normalize early

        // M6.2-FIX v0.43 — normalisasi varian/SKU + stok agregat
        normalizeVarian(data);

        // Auto-tag with company code from header
        const companyCode = req.headers["x-company-code"];
        if (companyCode && !data.companyCode) {
            data.companyCode = companyCode;
        }

        // ── Validasi Duplikat Kode (case-insensitive) — scoped per gudang ──
        const escaped = data.kode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const dupQuery = { kode: { $regex: new RegExp("^" + escaped + "$", "i") }, gudang: data.gudang || "" };
        if (companyCode) dupQuery.companyCode = companyCode;
        const existing = await Barang.findOne(dupQuery);
        if (existing) {
            return res.status(409).json({
                error: `Kode "${data.kode}" sudah digunakan untuk barang "${existing.nama}" di gudang "${existing.gudang}", gunakan kode barang lain`
            });
        }

        const item = await Barang.create(data);

        // Log activity
        try {
            await ActivityLog.create({
                companyCode,
                action: "create",
                resource: "barang",
                resourceId: item._id.toString(),
                resourceName: item.nama,
                resourceCode: item.kode,
                userName: req.headers["x-user-name"] || "System"
            });
        } catch { /* ignore log errors */ }

        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Barang") });
    }
});

// Update (scoped to company)
router.put("/:id", async (req, res) => {
    try {
        const existing = await Barang.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) {
            return res.status(404).json({ error: "Not found" });
        }

        // ── Validasi Duplikat Kode (jika kode diubah, case-insensitive, scoped per gudang) ──
        if (req.body.kode) req.body.kode = req.body.kode.trim(); // Normalize early
        const newKode = req.body.kode;
        // Bandingkan case-insensitive: "brg-001" == "BRG-001" (dianggap sama, skip validasi)
        if (newKode && newKode.toLowerCase() !== existing.kode.toLowerCase()) {
            const companyCode = req.headers["x-company-code"];
            const escaped = newKode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const dupQueryPut = {
                kode: { $regex: new RegExp("^" + escaped + "$", "i") },
                gudang: req.body.gudang || existing.gudang,
                _id: { $ne: existing._id } // exclude current item
            };
            if (companyCode) dupQueryPut.companyCode = companyCode;
            const duplicate = await Barang.findOne(dupQueryPut);
            if (duplicate) {
                return res.status(409).json({
                    error: `Kode "${newKode}" sudah digunakan untuk barang "${duplicate.nama}" di gudang "${duplicate.gudang}", gunakan kode barang lain`
                });
            }
        }

        // M6.2-FIX v0.43 — normalisasi varian/SKU sebelum update (stok agregat)
        const updateData = { ...req.body };
        normalizeVarian(updateData);

        const item = await Barang.findByIdAndUpdate(req.params.id, updateData, { new: true });

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "barang",
                resourceId: item._id.toString(),
                resourceName: item.nama,
                resourceCode: item.kode,
                userName: req.headers["x-user-name"] || "System"
            });
        } catch { /* ignore log errors */ }

        res.json(item);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Barang") });
    }
});

// Delete (scoped to company)
router.delete("/:id", async (req, res) => {
    try {
        const existing = await Barang.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) {
            return res.status(404).json({ error: "Not found" });
        }

        // Log activity before delete
        try {
            const companyCode = req.headers["x-company-code"];
            await ActivityLog.create({
                companyCode,
                action: "delete",
                resource: "barang",
                resourceId: req.params.id,
                resourceName: existing.nama,
                resourceCode: existing.kode,
                userName: req.headers["x-user-name"] || "System"
            });
        } catch { /* ignore log errors */ }

        await Barang.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
