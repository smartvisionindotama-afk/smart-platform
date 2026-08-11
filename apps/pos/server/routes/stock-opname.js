/**
 * Stock Opname Route — CRUD + Reconciliation.
 *
 * GET    /              — List with search, pagination, company scoping
 * GET    /:id           — Get single opname record
 * POST   /              — Create new opname with auto-generated nomor
 * PUT    /:id           — Update opname (only if status = draft)
 * DELETE /:id           — Delete opname (only if status = draft/in_progress)
 * PATCH  /:id/status    — Update status
 * POST   /:id/reconcile — Reconcile: apply selisih to actual stock
 * GET    /barang-stock   — Get list of all barang with current stock for opname
 *
 * @module server/routes/stock-opname
 */

import { Router } from "express";
import { StockOpname } from "../models/StockOpname.js";
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
 * GET /barang-stock — Get all barang with current stock for opname initialization.
 * Supports optional gudang filter.
 */
router.get("/barang-stock", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const gudang = (req.query.gudang || "").trim();

        let query = { status: { $ne: "archived" } };
        if (companyCode) query.companyCode = companyCode;
        if (gudang) query.gudang = gudang;

        const items = await Barang.find(query)
            .select("kode nama satuan gudang rak stok stok_minimum")
            .sort({ nama: 1 });

        res.json({ data: items, total: items.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET / — List stock opname records.
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
                { gudangNama: { $regex: search, $options: "i" } },
                { keterangan: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const total = await StockOpname.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await StockOpname.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single stock opname record.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await StockOpname.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create new stock opname.
 * Body: { tanggal, gudang, gudangNama, keterangan, items }
 * items: [{ kode, nama, satuan, gudang, rak, stokSistem, stokFisik, keterangan }]
 */
router.post("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) {
            return res.status(400).json({ error: "Company code required" });
        }

        const { tanggal, gudang, gudangNama, keterangan, items } = req.body;

        if ((!gudang || !gudang.trim()) && (!items || items.length === 0)) {
            return res.status(400).json({ error: "Gudang atau items wajib diisi" });
        }

        // If items not provided, auto-populate from Barang collection
        let opnameItems = [];
        if (items && items.length > 0) {
            opnameItems = items.map(item => {
                const stokSistem = Number(item.stokSistem) || 0;
                const stokFisik = item.stokFisik !== undefined ? Number(item.stokFisik) : stokSistem;
                return {
                    kode: item.kode || "",
                    nama: item.nama || "",
                    satuan: item.satuan || "",
                    gudang: item.gudang || gudang || "",
                    rak: item.rak || "",
                    stokSistem,
                    stokFisik,
                    selisih: stokFisik - stokSistem,
                    keterangan: item.keterangan || ""
                };
            });
        } else {
            // Auto-load all barang for this warehouse
            const barangQuery = { status: { $ne: "archived" }, companyCode };
            if (gudang) barangQuery.gudang = gudang;
            const allBarang = await Barang.find(barangQuery)
                .select("kode nama satuan gudang rak stok")
                .sort({ nama: 1 });

            opnameItems = allBarang.map(b => ({
                kode: b.kode,
                nama: b.nama,
                satuan: b.satuan || "",
                gudang: b.gudang || gudang || "",
                rak: b.rak || "",
                stokSistem: b.stok || 0,
                stokFisik: b.stok || 0,
                selisih: 0,
                keterangan: ""
            }));
        }

        // Calculate totals
        const totalItem = opnameItems.length;
        const totalSelisih = opnameItems.reduce((sum, item) => sum + Math.abs(item.selisih), 0);

        const nomor = await StockOpname.generateNomor(companyCode);

        const opname = await StockOpname.create({
            companyCode,
            nomor,
            tanggal: tanggal || new Date(),
            gudang: gudang || "",
            gudangNama: gudangNama || gudang || "",
            keterangan: keterangan || "",
            items: opnameItems,
            totalItem,
            totalSelisih,
            status: "draft",
            createdBy: req.headers["x-user-name"] || "System"
        });

        // Log activity
        try {
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "create",
                resource: "stock_opname",
                resourceId: opname._id.toString(),
                resourceName: `${gudangNama || gudang} - ${nomor}`,
                resourceCode: nomor,
                details: `${totalItem} item`,
                userName
            });
        } catch (logErr) {
            console.warn("[StockOpname] Failed to log activity:", logErr.message);
        }

        res.status(201).json(opname);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "StockOpname") });
    }
});

/**
 * PUT /:id — Update stock opname (only if status = draft).
 */
router.put("/:id", async (req, res) => {
    try {
        const existing = await StockOpname.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft" && existing.status !== "in_progress") {
            return res.status(400).json({ error: "Hanya opname dengan status Draft atau In Progress yang bisa diedit" });
        }

        const { tanggal, gudang, gudangNama, keterangan, items } = req.body;

        const updateData = {};
        if (tanggal !== undefined) updateData.tanggal = tanggal;
        if (gudang !== undefined) updateData.gudang = gudang;
        if (gudangNama !== undefined) updateData.gudangNama = gudangNama;
        if (keterangan !== undefined) updateData.keterangan = keterangan;
        updateData.updatedBy = req.headers["x-user-name"] || "System";

        if (items !== undefined) {
            const opnameItems = items.map(item => {
                const stokSistem = Number(item.stokSistem) || 0;
                const stokFisik = item.stokFisik !== undefined ? Number(item.stokFisik) : stokSistem;
                return {
                    kode: item.kode || "",
                    nama: item.nama || "",
                    satuan: item.satuan || "",
                    gudang: item.gudang || gudang || existing.gudang || "",
                    rak: item.rak || "",
                    stokSistem,
                    stokFisik,
                    selisih: stokFisik - stokSistem,
                    keterangan: item.keterangan || ""
                };
            });
            updateData.items = opnameItems;
            updateData.totalItem = opnameItems.length;
            updateData.totalSelisih = opnameItems.reduce((sum, item) => sum + Math.abs(item.selisih), 0);
        }

        const updated = await StockOpname.findByIdAndUpdate(
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
                resource: "stock_opname",
                resourceId: existing._id.toString(),
                resourceName: `${existing.gudangNama || existing.gudang} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Update opname ${existing.nomor}`,
                userName
            });
        } catch (logErr) {
            console.warn("[StockOpname] Failed to log activity:", logErr.message);
        }

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "StockOpname") });
    }
});

/**
 * DELETE /:id — Delete stock opname (only if status = draft/in_progress).
 */
router.delete("/:id", async (req, res) => {
    try {
        const existing = await StockOpname.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft" && existing.status !== "in_progress" && existing.status !== "cancelled") {
            return res.status(400).json({ error: "Hanya opname dengan status Draft, In Progress, atau Cancelled yang bisa dihapus" });
        }

        // Log activity before delete
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "delete",
                resource: "stock_opname",
                resourceId: existing._id.toString(),
                resourceName: `${existing.gudangNama || existing.gudang} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Hapus opname ${existing.nomor} (${existing.status})`,
                userName
            });
        } catch (logErr) {
            console.warn("[StockOpname] Failed to log activity:", logErr.message);
        }

        await StockOpname.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /:id/status — Update opname status.
 * Body: { status: "in_progress" | "completed" | "cancelled" }
 */
router.patch("/:id/status", async (req, res) => {
    try {
        const existing = await StockOpname.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const newStatus = req.body.status;
        const validTransitions = {
            "draft": ["in_progress", "cancelled"],
            "in_progress": ["completed", "cancelled"],
            "completed": [],
            "cancelled": ["draft"]
        };

        const allowed = validTransitions[existing.status] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                error: `Tidak bisa mengubah status dari "${existing.status}" ke "${newStatus}"`
            });
        }

        const oldStatus = existing.status;
        existing.status = newStatus;
        existing.updatedBy = req.headers["x-user-name"] || "System";

        if (newStatus === "completed") {
            existing.completedAt = new Date();
            existing.completedBy = req.headers["x-user-name"] || "System";
        }

        await existing.save();

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            const statusLabels = { draft: "Draft", in_progress: "Proses", completed: "Selesai", cancelled: "Batal" };
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "stock_opname",
                resourceId: existing._id.toString(),
                resourceName: `${existing.gudangNama || existing.gudang} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Status: ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`,
                userName
            });
        } catch (logErr) {
            console.warn("[StockOpname] Failed to log activity:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/reconcile — Reconcile stock: apply selisih to actual Barang stock.
 * Only works when status = "completed".
 * Updates stok barang based on selisih (stokFisik - stokSistem).
 */
router.post("/:id/reconcile", async (req, res) => {
    try {
        const existing = await StockOpname.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        if (existing.status !== "completed") {
            return res.status(400).json({ error: "Hanya opname dengan status Completed yang bisa di-reconcile" });
        }

        const companyCode = existing.companyCode;
        const userName = req.headers["x-user-name"] || "System";
        const results = { success: 0, failed: 0, errors: [] };

        // Apply selisih to each barang's stok
        for (const item of existing.items) {
            if (item.selisih === 0) {
                results.success++;
                continue;
            }

            try {
                // Set stok to stokFisik (absolute update, not incremental)
                await Barang.findOneAndUpdate(
                    { companyCode, kode: item.kode },
                    { $set: { stok: item.stokFisik, updatedBy: userName } }
                );
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push({ kode: item.kode, error: err.message });
            }
        }

        // Update opname record — mark as reconciled
        existing.set("reconciledAt", new Date());
        existing.set("reconciledBy", userName);
        existing.updatedBy = userName;
        await existing.save();

        // Log activity
        try {
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "stock_opname",
                resourceId: existing._id.toString(),
                resourceName: `${existing.gudangNama || existing.gudang} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Reconcile: ${results.success} sukses, ${results.failed} gagal`,
                userName
            });
        } catch (logErr) {
            console.warn("[StockOpname] Failed to log activity:", logErr.message);
        }

        res.json({
            success: true,
            message: `Reconcile selesai: ${results.success} barang berhasil disesuaikan, ${results.failed} gagal`,
            results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
