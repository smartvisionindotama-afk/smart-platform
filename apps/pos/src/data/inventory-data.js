/**
 * Inventory Monitoring Data Service — Stock overview & statistics.
 *
 * Terhubung dengan data MASTER BARANG — menggunakan data service yang SAMA
 * dengan halaman Master → Barang (listBarang, listPembelian, listPenjualan).
 *
 * Strategy: API-first via apiCall, fallback ke komputasi lokal dari data service existing.
 *
 * @module inventory/data/inventory-data
 */

import { apiCall, isApiAvailable } from "./api.js";
import { currentCompanyCode, filterData, delay } from "./helpers.js";

/**
 * Compute inventory stats from an array of barang items (local fallback).
 * @param {object[]} allBarang
 * @returns {object}
 */
function computeStatsFromBarang(allBarang) {
    const totalBarang = allBarang.length;
    const totalStok = allBarang.reduce((sum, b) => sum + (b.stok || 0), 0);
    const totalNilaiBeli = allBarang.reduce((sum, b) => sum + ((b.harga_beli || 0) * (b.stok || 0)), 0);
    const totalNilaiJual = allBarang.reduce((sum, b) => sum + ((b.harga_jual || 0) * (b.stok || 0)), 0);
    const lowStock = allBarang.filter(b => (b.stok || 0) > 0 && (b.stok || 0) <= (b.stok_minimum || 0)).length;
    const outOfStock = allBarang.filter(b => (b.stok || 0) === 0).length;
    const gudangSet = new Set(allBarang.filter(b => b.gudang).map(b => b.gudang));
    const kategoriSet = new Set(allBarang.filter(b => b.kategori).map(b => b.kategori));

    return {
        totalBarang,
        totalStok,
        totalNilaiBeli,
        totalNilaiJual,
        lowStock,
        outOfStock,
        totalGudang: gudangSet.size,
        totalKategori: kategoriSet.size
    };
}

/**
 * Compute warehouse stock grouping from barang items (local fallback).
 * @param {object[]} allBarang
 * @returns {{data: object[]}}
 */
function computeWarehouseFromBarang(allBarang) {
    const warehouseMap = {};
    for (const b of allBarang) {
        const gudang = b.gudang || "Tanpa Gudang";
        if (!warehouseMap[gudang]) {
            warehouseMap[gudang] = { gudang, totalItem: 0, totalStok: 0 };
        }
        warehouseMap[gudang].totalItem++;
        warehouseMap[gudang].totalStok += b.stok || 0;
    }
    return {
        data: Object.values(warehouseMap).sort((a, b) => a.gudang.localeCompare(b.gudang))
    };
}

/**
 * Compute low stock / out of stock items from barang items (local fallback).
 * @param {object[]} allBarang
 * @param {string} type — "low" or "out"
 * @param {object} params — { page, limit }
 * @returns {{data: object[], pagination: object}}
 */
function computeItemsFromBarang(allBarang, type = "low", params = {}) {
    const page = params.page || 1;
    const limit = params.limit || 10;

    let filtered;
    if (type === "low") {
        filtered = allBarang.filter(b => (b.stok || 0) > 0 && (b.stok || 0) <= (b.stok_minimum || 0));
    } else {
        filtered = allBarang.filter(b => (b.stok || 0) === 0);
    }

    filtered.sort((a, b) => (a.stok || 0) - (b.stok || 0));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return {
        data: paged,
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

/**
 * Fetch all barang data (API-first, fallback to local data service).
 * Uses the SAME listBarang service as Master → Barang page.
 */
async function fetchAllBarang() {
    const { listBarang } = await import("./barang-data.js");
    try {
        // Try to get all items from the existing barang service
        // (which itself is API-first with in-memory fallback)
        const result = await listBarang({ page: 1, limit: 9999 });
        return result.data || [];
    } catch {
        return [];
    }
}

// ═══════════════════════════════════════════════
//  Public API — API-first via apiCall,
//  fallback ke komputasi lokal dari data service yang SAMA dengan Barang
// ═══════════════════════════════════════════════

/**
 * Get inventory summary statistics.
 * Data dari Barang yang SAMA dengan Master → Barang.
 */
export async function getInventoryStats() {
    // Try API first
    try {
        const result = await apiCall("GET", "/inventory-monitoring/stats");
        if (result !== null) return result;
    } catch {}

    // Fallback: compute from barang data service (sama dengan Master → Barang)
    const allBarang = await fetchAllBarang();
    return computeStatsFromBarang(allBarang);
}

/**
 * Get stock grouped by warehouse.
 */
export async function getStockByWarehouse() {
    try {
        const result = await apiCall("GET", "/inventory-monitoring/by-warehouse");
        if (result !== null) return result;
    } catch {}

    const allBarang = await fetchAllBarang();
    return computeWarehouseFromBarang(allBarang);
}

/**
 * Get low stock items (stok > 0 && stok <= stok_minimum).
 */
export async function getLowStockItems(params = {}) {
    try {
        const query = new URLSearchParams(params).toString();
        const result = await apiCall("GET", `/inventory-monitoring/low-stock?${query}`);
        if (result !== null) return result;
    } catch {}

    const allBarang = await fetchAllBarang();
    return computeItemsFromBarang(allBarang, "low", params);
}

/**
 * Get out of stock items (stok = 0).
 */
export async function getOutOfStockItems(params = {}) {
    try {
        const query = new URLSearchParams(params).toString();
        const result = await apiCall("GET", `/inventory-monitoring/out-of-stock?${query}`);
        if (result !== null) return result;
    } catch {}

    const allBarang = await fetchAllBarang();
    return computeItemsFromBarang(allBarang, "out", params);
}

/**
 * Get recent stock movements.
 * Dari data Pembelian & Penjualan yang SAMA dengan halaman Transaksi.
 */
export async function getRecentMovements(limit = 10) {
    try {
        const result = await apiCall("GET", `/inventory-monitoring/recent-movement?limit=${limit}`);
        if (result !== null) return result;
    } catch {}

    // Local fallback: compute from pembelian & penjualan data services
    try {
        const { listPembelian } = await import("./pembelian-data.js");
        const { listPenjualan } = await import("./penjualan-data.js");

        const [beliResult, jualResult] = await Promise.all([
            listPembelian({ page: 1, limit: 10 }),
            listPenjualan({ page: 1, limit: 10 })
        ]);

        const movements = [];

        for (const p of (beliResult.data || [])) {
            if (p.status !== "received") continue;
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

        for (const p of (jualResult.data || [])) {
            if (!["delivered", "invoiced", "paid"].includes(p.status)) continue;
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

        movements.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        return { data: movements.slice(0, limit), total: Math.min(movements.length, limit) };
    } catch {
        return { data: [], total: 0 };
    }
}

/**
 * Get inventory stock value summary.
 */
export async function getStockValue() {
    try {
        const result = await apiCall("GET", "/inventory-monitoring/stock-value");
        if (result !== null) return result;
    } catch {}

    const allBarang = await fetchAllBarang();
    const totalNilaiBeli = allBarang.reduce((sum, b) => sum + ((b.harga_beli || 0) * (b.stok || 0)), 0);
    const totalNilaiJual = allBarang.reduce((sum, b) => sum + ((b.harga_jual || 0) * (b.stok || 0)), 0);

    const byWarehouse = {};
    for (const b of allBarang) {
        const g = b.gudang || "Tanpa Gudang";
        if (!byWarehouse[g]) byWarehouse[g] = { gudang: g, nilaiBeli: 0, nilaiJual: 0, itemCount: 0 };
        byWarehouse[g].nilaiBeli += (b.harga_beli || 0) * (b.stok || 0);
        byWarehouse[g].nilaiJual += (b.harga_jual || 0) * (b.stok || 0);
        byWarehouse[g].itemCount++;
    }

    const byKategori = {};
    for (const b of allBarang) {
        const k = b.kategori || "Tanpa Kategori";
        if (!byKategori[k]) byKategori[k] = { kategori: k, nilaiBeli: 0, nilaiJual: 0, itemCount: 0 };
        byKategori[k].nilaiBeli += (b.harga_beli || 0) * (b.stok || 0);
        byKategori[k].nilaiJual += (b.harga_jual || 0) * (b.stok || 0);
        byKategori[k].itemCount++;
    }

    return {
        totalNilaiBeli,
        totalNilaiJual,
        byWarehouse: Object.values(byWarehouse).sort((a, b) => a.gudang.localeCompare(b.gudang)),
        byKategori: Object.values(byKategori).sort((a, b) => a.kategori.localeCompare(b.kategori))
    };
}
