/**
 * Stock Opname Data Service — API-first with in-memory fallback.
 *
 * @module inventory/data/stock-opname-data
 */

import { apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback, apiCall } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay } from "./helpers.js";

// ═══════════════════════════════════════════════
//  In-memory fallback state
// ═══════════════════════════════════════════════

let items = [];
let nextId = 1;
let nextSeq = 1;

function generateNomor() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const seq = String(nextSeq).padStart(4, "0");
    nextSeq++;
    return `SO-${dd}${mm}${yyyy}-${seq}`;
}

// ═══════════════════════════════════════════════
//  Local fallback implementations
// ═══════════════════════════════════════════════

async function listStockOpnameLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();

    let filtered = filterData(items);
    if (search) {
        filtered = filtered.filter(item =>
            item.nomor.toLowerCase().includes(search) ||
            (item.gudangNama || "").toLowerCase().includes(search) ||
            item.status.toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);
    return {
        data: paged,
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

async function getStockOpnameLocal(id) {
    await delay(150);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createStockOpnameLocal(data) {
    await delay(200);
    const now = Date.now();
    const companyCode = currentCompanyCode();
    const newItem = {
        id: String(nextId++),
        ...tagData({}),
        nomor: generateNomor(),
        tanggal: data.tanggal || new Date().toISOString(),
        gudang: data.gudang || "",
        gudangNama: data.gudangNama || data.gudang || "",
        keterangan: data.keterangan || "",
        items: (data.items || []).map(item => ({
            kode: item.kode || "",
            nama: item.nama || "",
            satuan: item.satuan || "",
            gudang: item.gudang || data.gudang || "",
            rak: item.rak || "",
            stokSistem: Number(item.stokSistem) || 0,
            stokFisik: item.stokFisik !== undefined ? Number(item.stokFisik) : (Number(item.stokSistem) || 0),
            selisih: (item.stokFisik !== undefined ? Number(item.stokFisik) : (Number(item.stokSistem) || 0)) - (Number(item.stokSistem) || 0),
            keterangan: item.keterangan || ""
        })),
        totalItem: data.items ? data.items.length : 0,
        totalSelisih: data.items ? data.items.reduce((sum, item) => sum + Math.abs((item.stokFisik !== undefined ? Number(item.stokFisik) : (Number(item.stokSistem) || 0)) - (Number(item.stokSistem) || 0)), 0) : 0,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        createdBy: "System",
        updatedBy: null
    };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateStockOpnameLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return null;

    const updated = {
        ...items[index],
        ...data,
        items: data.items !== undefined ? data.items.map(item => ({
            kode: item.kode || "",
            nama: item.nama || "",
            satuan: item.satuan || "",
            gudang: item.gudang || data.gudang || items[index].gudang || "",
            rak: item.rak || "",
            stokSistem: Number(item.stokSistem) || 0,
            stokFisik: item.stokFisik !== undefined ? Number(item.stokFisik) : (Number(item.stokSistem) || 0),
            selisih: (item.stokFisik !== undefined ? Number(item.stokFisik) : (Number(item.stokSistem) || 0)) - (Number(item.stokSistem) || 0),
            keterangan: item.keterangan || ""
        })) : items[index].items,
        totalItem: data.items !== undefined ? data.items.length : items[index].totalItem,
        totalSelisih: data.items !== undefined ? data.items.reduce((sum, item) => sum + Math.abs((item.stokFisik !== undefined ? Number(item.stokFisik) : (Number(item.stokSistem) || 0)) - (Number(item.stokSistem) || 0)), 0) : items[index].totalSelisih,
        updatedAt: Date.now()
    };
    items[index] = updated;
    return { ...updated };
}

async function deleteStockOpnameLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

async function updateStockOpnameStatusLocal(id, newStatus) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return null;

    const validTransitions = {
        "draft": ["in_progress", "cancelled"],
        "in_progress": ["completed", "cancelled"],
        "completed": [],
        "cancelled": ["draft"]
    };

    const allowed = validTransitions[items[index].status] || [];
    if (!allowed.includes(newStatus)) {
        throw new Error(`Tidak bisa mengubah status dari "${items[index].status}" ke "${newStatus}"`);
    }

    items[index].status = newStatus;
    items[index].updatedAt = Date.now();
    if (newStatus === "completed") {
        items[index].completedAt = new Date().toISOString();
        items[index].completedBy = "System";
    }

    return { ...items[index] };
}

async function reconcileStockLocal(id) {
    await delay(300);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    if (items[index].status !== "completed") {
        throw new Error("Hanya opname dengan status Completed yang bisa di-reconcile");
    }
    items[index].reconciledAt = new Date().toISOString();
    items[index].reconciledBy = "System";
    items[index].updatedAt = Date.now();
    return { ...items[index], message: `Reconcile selesai: ${items[index].items.length} barang disesuaikan` };
}

// ═══════════════════════════════════════════════
//  Public API — API-first, fallback ke in-memory
// ═══════════════════════════════════════════════

export async function listStockOpname(params = {}) {
    return apiListFallback("/api/stock-opname", params, () => listStockOpnameLocal(params));
}

export async function getStockOpname(id) {
    return apiGetFallback("/api/stock-opname", id, () => getStockOpnameLocal(id));
}

export async function createStockOpname(data) {
    return apiCreateFallback("/api/stock-opname", data, () => createStockOpnameLocal(data));
}

export async function updateStockOpname(id, data) {
    return apiUpdateFallback("/api/stock-opname", id, data, () => updateStockOpnameLocal(id, data));
}

export async function deleteStockOpname(id) {
    return apiDeleteFallback("/api/stock-opname", id, () => deleteStockOpnameLocal(id));
}

/**
 * Update stock opname status.
 */
export async function updateStockOpnameStatus(id, status) {
    try {
        const result = await apiCall("PATCH", `/stock-opname/${id}/status`, { status });
        if (result !== null) return result;
    } catch (err) {
        console.warn("[StockOpname] Status update API failed:", err.message);
    }
    return updateStockOpnameStatusLocal(id, status);
}

/**
 * Reconcile stock opname — apply selisih to actual stock.
 */
export async function reconcileStockOpname(id) {
    try {
        const result = await apiCall("POST", `/stock-opname/${id}/reconcile`);
        if (result !== null) return result;
    } catch (err) {
        console.warn("[StockOpname] Reconcile API failed:", err.message);
    }
    return reconcileStockLocal(id);
}

/**
 * Get all barang with current stock (for opname initialization).
 * API-first, fallback ke data service Barang yang SAMA dengan Master → Barang.
 */
export async function getBarangForOpname(gudang = "") {
    // Try API first
    try {
        let url = "/api/stock-opname/barang-stock";
        if (gudang) url += `?gudang=${encodeURIComponent(gudang)}`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
    } catch {}

    // Fallback: gunakan data service Barang yang sama dengan halaman Master
    try {
        const { listBarang } = await import("./barang-data.js");
        const result = await listBarang({ page: 1, limit: 9999 });
        const allBarang = result.data || [];

        let filtered = allBarang;
        if (gudang) {
            filtered = allBarang.filter(b => b.gudang === gudang);
        }

        const mapped = filtered.map(b => ({
            kode: b.kode,
            nama: b.nama,
            satuan: b.satuan || "",
            gudang: b.gudang || gudang || "",
            rak: b.rak || "",
            stok: b.stok || 0
        }));

        return { data: mapped, total: mapped.length };
    } catch {
        return { data: [], total: 0 };
    }
}
