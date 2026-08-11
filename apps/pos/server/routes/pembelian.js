/**
 * Pembelian Route — Purchase Order CRUD.
 *
 * GET    /       — List with search, pagination, company scoping
 * GET    /:id    — Get single PO
 * POST   /       — Create PO with auto-generated nomor
 * PUT    /:id    — Update PO (only if status = draft)
 * DELETE /:id    — Delete PO (only if status = draft)
 * PATCH  /:id/status — Update status (draft → confirmed → received, or cancelled)
 *
 * @module server/routes/pembelian
 */

import { Router } from "express";
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
 * GET / — List purchase orders.
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
                { supplier: { $regex: search, $options: "i" } },
                { supplierName: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Pembelian.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Pembelian.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single purchase order.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await Pembelian.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create purchase order.
 * Body: { tanggal, supplier, supplierName, items, diskon, catatan }
 */
router.post("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) {
            return res.status(400).json({ error: "Company code required" });
        }

        const { tanggal, supplier, supplierName, kirimKe, kirimKeNama, items, diskon, catatan } = req.body;

        if (!supplier || !supplier.trim()) {
            return res.status(400).json({ error: "Supplier wajib diisi" });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
        }

        // Validate & calculate items
        const validatedItems = items.map(item => {
            const qty = Number(item.qty) || 0;
            const harga = Number(item.harga) || 0;
            const diskon = Number(item.diskon) || 0;
            return {
                kode: item.kode || "",
                nama: item.nama || "",
                satuan: item.satuan || "",
                qty,
                harga,
                diskon,
                subtotal: Math.max(0, (qty * harga) - diskon)
            };
        });

        const total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const diskonVal = Number(diskon) || 0;

        const nomor = await Pembelian.generateNomor(companyCode);

        const po = await Pembelian.create({
            companyCode,
            nomor,
            tanggal: tanggal || new Date(),
            supplier: supplier.trim(),
            supplierName: supplierName || "",
            kirimKe: kirimKe || "",
            kirimKeNama: kirimKeNama || "",
            items: validatedItems,
            total,
            diskon: diskonVal,
            grandTotal: Math.max(0, total - diskonVal),
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
                resource: "pembelian",
                resourceId: po._id.toString(),
                resourceName: `${supplierName || supplier} - ${nomor}`,
                resourceCode: nomor,
                details: `${validatedItems.length} item, total: ${po.grandTotal}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Pembelian] Failed to log activity:", logErr.message);
        }

        res.status(201).json(po);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Pembelian") });
    }
});

/**
 * PUT /:id — Update purchase order (only if status = draft).
 */
router.put("/:id", async (req, res) => {
    try {
        const existing = await Pembelian.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft") {
            return res.status(400).json({ error: "Hanya PO dengan status Draft yang bisa diedit" });
        }

        const { tanggal, supplier, supplierName, kirimKe, kirimKeNama, items, diskon, catatan } = req.body;

        const updateData = {};
        if (tanggal !== undefined) updateData.tanggal = tanggal;
        if (supplier !== undefined) updateData.supplier = supplier.trim();
        if (supplierName !== undefined) updateData.supplierName = supplierName;
        if (kirimKe !== undefined) updateData.kirimKe = kirimKe;
        if (kirimKeNama !== undefined) updateData.kirimKeNama = kirimKeNama;
        if (catatan !== undefined) updateData.catatan = catatan;
        if (diskon !== undefined) updateData.diskon = Number(diskon);
        updateData.updatedBy = req.headers["x-user-name"] || "System";

        if (items !== undefined) {
            if (!items || items.length === 0) {
                return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
            }
            const validatedItems = items.map(item => {
                const qty = Number(item.qty) || 0;
                const harga = Number(item.harga) || 0;
                const diskon = Number(item.diskon) || 0;
                return {
                    kode: item.kode || "",
                    nama: item.nama || "",
                    satuan: item.satuan || "",
                    qty,
                    harga,
                    diskon,
                    subtotal: Math.max(0, (qty * harga) - diskon)
                };
            });
            updateData.items = validatedItems;
            updateData.total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
            updateData.grandTotal = Math.max(0, updateData.total - (updateData.diskon || existing.diskon || 0));
        }

        const updated = await Pembelian.findByIdAndUpdate(
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
                resource: "pembelian",
                resourceId: existing._id.toString(),
                resourceName: `${supplierName || existing.supplierName || existing.supplier} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Update PO ${existing.nomor}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Pembelian] Failed to log activity:", logErr.message);
        }

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Pembelian") });
    }
});

/**
 * DELETE /:id — Delete purchase order (all statuses allowed).
 * Reverses stock if PO has status "received".
 */
router.delete("/:id", async (req, res) => {
    try {
        const existing = await Pembelian.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        // If PO was received, reverse stock
        if (existing.status === "received") {
            for (const item of existing.items) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: -item.qty } }
                ).catch(err => {
                    console.warn(`[Pembelian] Failed to reverse stock for ${item.kode}:`, err.message);
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
                resource: "pembelian",
                resourceId: existing._id.toString(),
                resourceName: `${existing.supplierName || existing.supplier} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Hapus PO ${existing.nomor} (${existing.status})`,
                userName
            });
        } catch (logErr) {
            console.warn("[Pembelian] Failed to log activity:", logErr.message);
        }

        await Pembelian.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /:id/status — Update PO status.
 * Body: { status: "confirmed" | "received" | "cancelled" }
 *
 * Status flow:
 *   draft → confirmed (confirm order)
 *   confirmed → received (barang masuk, stok bertambah)
 *   draft/canfirmed → cancelled
 *
 * When status = "received", update stok barang otomatis.
 */
router.patch("/:id/status", async (req, res) => {
    try {
        const existing = await Pembelian.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const newStatus = req.body.status;
        const validTransitions = {
            "draft": ["confirmed", "cancelled"],
            "confirmed": ["received", "cancelled"],
            "received": ["cancelled"],
            "cancelled": []
        };

        const allowed = validTransitions[existing.status] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                error: `Tidak bisa mengubah status dari "${existing.status}" ke "${newStatus}"`
            });
        }

        // If receiving goods, update barang stock
        if (newStatus === "received" && existing.status === "confirmed") {
            for (const item of existing.items) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: item.qty } }
                ).catch(err => {
                    console.warn(`[Pembelian] Failed to update stock for ${item.kode}:`, err.message);
                });
            }
        }

        // If cancelling a received PO, reverse stock
        if (newStatus === "cancelled" && existing.status === "received") {
            for (const item of existing.items) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: -item.qty } }
                ).catch(err => {
                    console.warn(`[Pembelian] Failed to reverse stock for ${item.kode}:`, err.message);
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
                resource: "pembelian",
                resourceId: existing._id.toString(),
                resourceName: `${existing.supplierName || existing.supplier} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Status: ${oldStatus} → ${newStatus}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Pembelian] Failed to log activity:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
