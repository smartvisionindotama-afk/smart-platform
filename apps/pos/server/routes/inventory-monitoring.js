/**
 * Inventory Monitoring Route — Stock overview, statistics & movement data.
 *
 * GET  /stats            — Summary statistics (total barang, stok, nilai, etc.)
 * GET  /by-warehouse     — Stock grouped by warehouse
 * GET  /low-stock        — Barang with stock below minimum
 * GET  /out-of-stock     — Barang with zero stock
 * GET  /recent-movement  — Recent stock movements from Pembelian & Penjualan
 * GET  /stock-value      — Total inventory value (harga_beli × stok)
 *
 * @module server/routes/inventory-monitoring
 */

import { Router } from "express";
import { Barang } from "../models/Barang.js";
import { Pembelian } from "../models/Pembelian.js";
import { Penjualan } from "../models/Penjualan.js";

const router = Router();

/**
 * GET /stats — Summary statistics.
 * Returns:
 *   - totalBarang: Total items
 *   - totalStok: Sum of all stock
 *   - lowStock: Items with 0 < stok <= stok_minimum
 *   - outOfStock: Items with stok = 0
 *   - totalNilaiBeli: Total inventory value (harga_beli × stok)
 *   - totalNilaiJual: Total retail value (harga_jual × stok)
 *   - totalGudang: Total warehouses
 *   - totalKategori: Total categories
 */
router.get("/stats", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        let query = { status: { $ne: "archived" } };
        if (companyCode) query.companyCode = companyCode;

        const allBarang = await Barang.find(query).select("stok stok_minimum harga_beli harga_jual gudang kategori").lean();

        const totalBarang = allBarang.length;
        const totalStok = allBarang.reduce((sum, b) => sum + (b.stok || 0), 0);
        const totalNilaiBeli = allBarang.reduce((sum, b) => sum + ((b.harga_beli || 0) * (b.stok || 0)), 0);
        const totalNilaiJual = allBarang.reduce((sum, b) => sum + ((b.harga_jual || 0) * (b.stok || 0)), 0);
        const lowStock = allBarang.filter(b => (b.stok || 0) > 0 && (b.stok || 0) <= (b.stok_minimum || 0)).length;
        const outOfStock = allBarang.filter(b => (b.stok || 0) === 0).length;

        // Unique values
        const gudangSet = new Set(allBarang.filter(b => b.gudang).map(b => b.gudang));
        const kategoriSet = new Set(allBarang.filter(b => b.kategori).map(b => b.kategori));

        res.json({
            totalBarang,
            totalStok,
            totalNilaiBeli,
            totalNilaiJual,
            lowStock,
            outOfStock,
            totalGudang: gudangSet.size,
            totalKategori: kategoriSet.size
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /by-warehouse — Stock grouped by warehouse.
 */
router.get("/by-warehouse", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        let query = { status: { $ne: "archived" } };
        if (companyCode) query.companyCode = companyCode;

        const allBarang = await Barang.find(query).select("gudang stok nama kode").lean();

        // Group by warehouse
        const warehouseMap = {};
        for (const b of allBarang) {
            const gudang = b.gudang || "Tanpa Gudang";
            if (!warehouseMap[gudang]) {
                warehouseMap[gudang] = { gudang, totalItem: 0, totalStok: 0 };
            }
            warehouseMap[gudang].totalItem++;
            warehouseMap[gudang].totalStok += b.stok || 0;
        }

        const data = Object.values(warehouseMap).sort((a, b) => a.gudang.localeCompare(b.gudang));

        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /low-stock — Barang with stock below minimum.
 */
router.get("/low-stock", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        let matchQuery = { status: { $ne: "archived" } };
        if (companyCode) matchQuery.companyCode = companyCode;

        // $expr condition: stok > 0 AND stok <= stok_minimum
        matchQuery.$expr = {
            $and: [
                { $gt: ["$stok", 0] },
                { $lte: ["$stok", "$stok_minimum"] }
            ]
        };

        const total = await Barang.countDocuments(matchQuery);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Barang.find(matchQuery)
            .select("kode nama satuan gudang stok stok_minimum harga_jual")
            .sort({ stok: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /out-of-stock — Barang with zero stock.
 */
router.get("/out-of-stock", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        let query = { status: { $ne: "archived" }, stok: 0 };
        if (companyCode) query.companyCode = companyCode;

        const total = await Barang.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Barang.find(query)
            .select("kode nama satuan gudang stok stok_minimum harga_jual")
            .sort({ nama: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /recent-movement — Recent stock movements from recent Pembelian & Penjualan.
 * Returns combined list of recent stock-affecting transactions.
 */
router.get("/recent-movement", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const limit = parseInt(req.query.limit) || 10;

        let baseQuery = {};
        if (companyCode) baseQuery.companyCode = companyCode;

        // Get recent received pembelian (stock in)
        const recentPembelian = await Pembelian.find({
            ...baseQuery,
            status: "received"
        })
            .select("nomor tanggal supplier supplierName items grandTotal status createdBy")
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean();

        // Get recent delivered penjualan (stock out)
        const recentPenjualan = await Penjualan.find({
            ...baseQuery,
            status: { $in: ["delivered", "invoiced", "paid"] }
        })
            .select("nomor tanggal pelanggan pelangganNama items grandTotal status createdBy")
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean();

        // Combine and format
        const movements = [];

        for (const p of recentPembelian) {
            const itemCount = p.items?.reduce((sum, i) => sum + (i.qty || 0), 0) || 0;
            movements.push({
                tanggal: p.tanggal,
                nomor: p.nomor,
                type: "in",
                label: "Pembelian",
                icon: "🛒",
                ref: p.supplierName || p.supplier,
                itemCount,
                total: p.grandTotal || 0,
                createdBy: p.createdBy || ""
            });
        }

        for (const p of recentPenjualan) {
            const itemCount = p.items?.reduce((sum, i) => sum + (i.qty || 0), 0) || 0;
            movements.push({
                tanggal: p.tanggal,
                nomor: p.nomor,
                type: "out",
                label: "Penjualan",
                icon: "💰",
                ref: p.pelangganNama || p.pelanggan,
                itemCount,
                total: p.grandTotal || 0,
                createdBy: p.createdBy || ""
            });
        }

        // Sort by date descending
        movements.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        // Limit
        const limited = movements.slice(0, limit);

        res.json({ data: limited, total: limited.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /stock-value — Total inventory value summary.
 * Grouped by warehouse and category.
 */
router.get("/stock-value", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        let query = { status: { $ne: "archived" } };
        if (companyCode) query.companyCode = companyCode;

        const allBarang = await Barang.find(query).select("kode nama gudang kategori stok harga_beli harga_jual satuan").lean();

        const totalNilaiBeli = allBarang.reduce((sum, b) => sum + ((b.harga_beli || 0) * (b.stok || 0)), 0);
        const totalNilaiJual = allBarang.reduce((sum, b) => sum + ((b.harga_jual || 0) * (b.stok || 0)), 0);

        // By warehouse
        const byWarehouse = {};
        for (const b of allBarang) {
            const g = b.gudang || "Tanpa Gudang";
            if (!byWarehouse[g]) byWarehouse[g] = { gudang: g, nilaiBeli: 0, nilaiJual: 0, itemCount: 0 };
            byWarehouse[g].nilaiBeli += (b.harga_beli || 0) * (b.stok || 0);
            byWarehouse[g].nilaiJual += (b.harga_jual || 0) * (b.stok || 0);
            byWarehouse[g].itemCount++;
        }

        // By category
        const byKategori = {};
        for (const b of allBarang) {
            const k = b.kategori || "Tanpa Kategori";
            if (!byKategori[k]) byKategori[k] = { kategori: k, nilaiBeli: 0, nilaiJual: 0, itemCount: 0 };
            byKategori[k].nilaiBeli += (b.harga_beli || 0) * (b.stok || 0);
            byKategori[k].nilaiJual += (b.harga_jual || 0) * (b.stok || 0);
            byKategori[k].itemCount++;
        }

        res.json({
            totalNilaiBeli,
            totalNilaiJual,
            byWarehouse: Object.values(byWarehouse).sort((a, b) => a.gudang.localeCompare(b.gudang)),
            byKategori: Object.values(byKategori).sort((a, b) => a.kategori.localeCompare(b.kategori))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
