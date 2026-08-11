/**
 * ReturPembelian Route — Purchase Return CRUD.
 *
 * GET    /             — List with search, pagination, company scoping
 * GET    /:id          — Get single retur
 * POST   /             — Create retur with auto-generated nomor
 * PUT    /:id          — Update retur (only if status = draft)
 * DELETE /:id          — Delete retur (reversal stok jika status = returned)
 * PATCH  /:id/status   — Update status (draft → returned)
 *
 * Stock: berkurang saat retur dikonfirmasi (barang kembali ke supplier),
 *        reversal bertambah saat retur dihapus.
 *
 * @module server/routes/retur-pembelian
 */

import { Router } from "express";
import { ReturPembelian } from "../models/ReturPembelian.js";
import { Pembelian } from "../models/Pembelian.js";
import { Barang } from "../models/Barang.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { formatError } from "../utils/format-error.js";

const router = Router();

/** Helper: check company ownership */
function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true;
    return item.companyCode === companyCode;
}

/**
 * Validasi item retur terhadap PO asal: qty retur tidak boleh melebihi qty PO.
 * @param {boolean} [checkStatus=true] — true saat create (POST); false saat edit (PUT)
 *        agar retur yang PO-nya dibatalkan setelah dibuat tetap bisa diedit.
 * @returns {Promise<string|null>} Pesan error, atau null jika valid.
 */
async function validateItemsAgainstPo(companyCode, idPO, items, checkStatus = true) {
    // Mode manual (tanpa PO): idPO kosong → lewati validasi terhadap PO asal
    if (!idPO) return null;
    let po = null;
    try { po = await Pembelian.findById(idPO); } catch { po = null; }
    if (!po) return "PO asal tidak ditemukan";
    if (checkStatus && (po.status === "draft" || po.status === "cancelled")) {
        return `PO asal (${po.status}) tidak bisa diretur — hanya PO Dikonfirmasi/Diterima`;
    }
    if (companyCode && po.companyCode !== companyCode) return "PO asal tidak valid untuk perusahaan ini";
    for (const item of items) {
        const poItem = (po.items || []).find(i => i.kode === item.kode);
        if (!poItem) return `Item ${item.kode || item.nama} tidak ditemukan di PO asal`;
        if (item.qty > poItem.qty) {
            return `Qty retur ${item.kode || item.nama} (${item.qty}) melebihi qty PO (${poItem.qty})`;
        }
    }
    return null;
}

/**
 * GET / — List purchase returns.
 */
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
                { nomor: { $regex: search, $options: "i" } },
                { nomorPO: { $regex: search, $options: "i" } },
                { supplier: { $regex: search, $options: "i" } },
                { supplierName: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const total = await ReturPembelian.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await ReturPembelian.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single purchase return.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await ReturPembelian.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create purchase return.
 * Body: { tanggal, nomorPO, idPO, supplier, supplierName, items, catatan }
 */
router.post("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) {
            return res.status(400).json({ error: "Company code required" });
        }

        const { tanggal, nomorPO, idPO, supplier, supplierName, items, catatan } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
        }

        // Validate & calculate items
        const validatedItems = items.map(item => {
            const qty = Number(item.qty) || 0;
            const harga = Number(item.harga) || 0;
            return {
                kode: item.kode || "",
                nama: item.nama || "",
                satuan: item.satuan || "",
                qty,
                harga,
                subtotal: Math.max(0, qty * harga)
            };
        });

        // Validasi qty retur terhadap PO asal
        const poError = await validateItemsAgainstPo(companyCode, idPO, validatedItems);
        if (poError) {
            return res.status(400).json({ error: poError });
        }

        const total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const nomor = await ReturPembelian.generateNomor(companyCode);

        const retur = await ReturPembelian.create({
            companyCode,
            nomor,
            tanggal: tanggal || new Date(),
            nomorPO: nomorPO || "",
            idPO: idPO || "",
            supplier: supplier || "",
            supplierName: supplierName || "",
            items: validatedItems,
            total,
            catatan: catatan || "",
            status: "draft",
            createdBy: req.headers["x-user-name"] || "System"
        });

        // Log activity
        try {
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "create",
                resource: "retur-pembelian",
                resourceId: retur._id.toString(),
                resourceName: `${supplierName || supplier} - ${nomor}`,
                resourceCode: nomor,
                details: `${validatedItems.length} item, total: ${retur.total}`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPembelian] Failed to log activity:", logErr.message);
        }

        res.status(201).json(retur);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "ReturPembelian") });
    }
});

/**
 * PUT /:id — Update purchase return (only if status = draft).
 */
router.put("/:id", async (req, res) => {
    try {
        const existing = await ReturPembelian.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft") {
            return res.status(400).json({ error: "Hanya retur dengan status Draft yang bisa diedit" });
        }

        const { tanggal, nomorPO, idPO, supplier, supplierName, items, catatan } = req.body;

        const updateData = {};
        if (tanggal !== undefined) updateData.tanggal = tanggal;
        if (nomorPO !== undefined) updateData.nomorPO = nomorPO;
        if (idPO !== undefined) updateData.idPO = idPO;
        if (supplier !== undefined) updateData.supplier = supplier;
        if (supplierName !== undefined) updateData.supplierName = supplierName;
        if (catatan !== undefined) updateData.catatan = catatan;
        updateData.updatedBy = req.headers["x-user-name"] || "System";

        if (items !== undefined) {
            if (!items || items.length === 0) {
                return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
            }
            const validatedItems = items.map(item => {
                const qty = Number(item.qty) || 0;
                const harga = Number(item.harga) || 0;
                return {
                    kode: item.kode || "",
                    nama: item.nama || "",
                    satuan: item.satuan || "",
                    qty,
                    harga,
                    subtotal: Math.max(0, qty * harga)
                };
            });
            const poError = await validateItemsAgainstPo(
                req.headers["x-company-code"],
                idPO !== undefined ? idPO : existing.idPO,
                validatedItems,
                false // edit mode: jangan blokir jika PO sudah dibatalkan setelah retur dibuat
            );
            if (poError) {
                return res.status(400).json({ error: poError });
            }
            updateData.items = validatedItems;
            updateData.total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        }

        const updated = await ReturPembelian.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "retur-pembelian",
                resourceId: existing._id.toString(),
                resourceName: `${supplierName || existing.supplierName || existing.supplier} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Update retur ${existing.nomor}`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPembelian] Failed to log activity:", logErr.message);
        }

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "ReturPembelian") });
    }
});

/**
 * DELETE /:id — Delete purchase return (all statuses).
 * Reverses stock if retur has status "returned" (stok ditambah kembali).
 */
router.delete("/:id", async (req, res) => {
    try {
        const existing = await ReturPembelian.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        // If retur was returned (stock already decreased), reverse it
        if (existing.status === "returned") {
            for (const item of existing.items) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: item.qty } }
                ).catch(err => {
                    console.warn(`[ReturPembelian] Failed to reverse stock for ${item.kode}:`, err.message);
                });
            }
        }

        // Log activity before delete
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "delete",
                resource: "retur-pembelian",
                resourceId: existing._id.toString(),
                resourceName: `${existing.supplierName || existing.supplier} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Hapus retur ${existing.nomor} (${existing.status})`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPembelian] Failed to log activity:", logErr.message);
        }

        await ReturPembelian.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /:id/status — Update retur status.
 * Body: { status: "returned" }
 *
 * When status = "returned", kurangi stok barang otomatis (barang kembali ke supplier).
 */
router.patch("/:id/status", async (req, res) => {
    try {
        const existing = await ReturPembelian.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const newStatus = req.body.status;
        const validTransitions = {
            "draft": ["returned"],
            "returned": []
        };

        const allowed = validTransitions[existing.status] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                error: `Tidak bisa mengubah status dari "${existing.status}" ke "${newStatus}"`
            });
        }

        // If returning goods, update barang stock (berkurang)
        if (newStatus === "returned") {
            for (const item of existing.items) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: -item.qty } }
                ).catch(err => {
                    console.warn(`[ReturPembelian] Failed to update stock for ${item.kode}:`, err.message);
                });
            }
        }

        const oldStatus = existing.status;
        existing.status = newStatus;
        existing.updatedBy = req.headers["x-user-name"] || "System";
        await existing.save();

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "retur-pembelian",
                resourceId: existing._id.toString(),
                resourceName: `${existing.supplierName || existing.supplier} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Status: ${oldStatus} → ${newStatus}`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPembelian] Failed to log activity:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
