/**
 * Barang Data Service — API-first with in-memory fallback.
 *
 * Data persistence melalui backend Express + MongoDB (Vite proxy /api/* → port 3001).
 * Jika backend tidak tersedia, fallback ke in-memory array (tanpa localStorage).
 * Sesuai roadmap: Sprint 1 — MongoDB + Repository Pattern.
 *
 * Uses @smart/core for multi-tenant company context
 * and @smart/api for API fallback utilities.
 *
 * @module barang-data
 */

import {
    apiCall,
    apiListFallback,
    apiCreateFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback
} from "./api.js";

import { currentCompanyCode, filterData, tagData, delay } from "./helpers.js";

// ═══════════════════════════════════════════════
//  Seed Data (fallback ketika backend tidak ada)
// ═══════════════════════════════════════════════

/**
 * Seed data — 12 sample items for development & testing.
 * @returns {object[]}
 */
function createSeedData() {
    const C = currentCompanyCode() || "";

    const now = Date.now();
    return [
        { id: "1",  companyCode: C, kode: "BRG-001", nama: "Semen Tiga Roda 50kg",       kategori: "Material Bangunan", satuan: "Sak",  harga_beli: 52000,  harga_jual: 58000,  stok: 150, stok_minimum: 20,  deskripsi: "Semen Portland tipe I", active: true, createdAt: now, updatedAt: now },
        { id: "2",  companyCode: C, kode: "BRG-002", nama: "Besi Beton 10mm",             kategori: "Material Bangunan", satuan: "Batang", harga_beli: 35000,  harga_jual: 42000,  stok: 200, stok_minimum: 50,  deskripsi: "Besi beton ulir SNI", active: true, createdAt: now, updatedAt: now },
        { id: "3",  companyCode: C, kode: "BRG-003", nama: "Cat Tembok Dulux 5kg",        kategori: "Cat",               satuan: "Galon", harga_beli: 85000,  harga_jual: 105000, stok: 45,  stok_minimum: 10,  deskripsi: "Cat interior warna putih", active: true, createdAt: now, updatedAt: now },
        { id: "4",  companyCode: C, kode: "BRG-004", nama: "Pipa PVC 3/4 Inch",           kategori: "Pipa",              satuan: "Meter", harga_beli: 8000,   harga_jual: 12000,  stok: 500, stok_minimum: 100, deskripsi: "Pipa PVC AW standar", active: true, createdAt: now, updatedAt: now },
        { id: "5",  companyCode: C, kode: "BRG-005", nama: "Kabel Listrik 2.5mm",         kategori: "Elektrikal",        satuan: "Meter", harga_beli: 4500,   harga_jual: 6500,   stok: 800, stok_minimum: 200, deskripsi: "Kabel NYM 2x2.5mm", active: true, createdAt: now, updatedAt: now },
        { id: "6",  companyCode: C, kode: "BRG-006", nama: "Paku Beton 5cm",              kategori: "Material Bangunan", satuan: "Kg",    harga_beli: 12000,  harga_jual: 18000,  stok: 75,  stok_minimum: 30,  deskripsi: "Paku beton hitam", active: true, createdAt: now, updatedAt: now },
        { id: "7",  companyCode: C, kode: "BRG-007", nama: "Keramik 40x40",               kategori: "Material Bangunan", satuan: "Dus",   harga_beli: 45000,  harga_jual: 55000,  stok: 60,  stok_minimum: 15,  deskripsi: "Keramik polished ivory", active: true, createdAt: now, updatedAt: now },
        { id: "8",  companyCode: C, kode: "BRG-008", nama: "Lem GP 1kg",                  kategori: "Perekat",           satuan: "Kg",    harga_beli: 15000,  harga_jual: 22000,  stok: 90,  stok_minimum: 25,  deskripsi: "Lem putih serbaguna", active: true, createdAt: now, updatedAt: now },
        { id: "9",  companyCode: C, kode: "BRG-009", nama: "Kran Air 1/2 Inch",            kategori: "Sanitary",         satuan: "Pcs",   harga_beli: 22000,  harga_jual: 32000,  stok: 35,  stok_minimum: 10,  deskripsi: "Kran air tembaga", active: true, createdAt: now, updatedAt: now },
        { id: "10", companyCode: C, kode: "BRG-010", nama: "Saklar Broco 1 Gang",          kategori: "Elektrikal",       satuan: "Pcs",   harga_beli: 8500,   harga_jual: 13500,  stok: 120, stok_minimum: 30,  deskripsi: "Saklar seri standar SNI", active: true, createdAt: now, updatedAt: now },
        { id: "11", companyCode: C, kode: "BRG-011", nama: "Triplek 12mm",                kategori: "Material Bangunan", satuan: "Lembar", harga_beli: 78000,  harga_jual: 95000,  stok: 25,  stok_minimum: 10,  deskripsi: "Triplek multipleks 122x244cm", active: true, createdAt: now, updatedAt: now },
        { id: "12", companyCode: C, kode: "BRG-012", nama: "Cat Kayu Melamine 1kg",       kategori: "Cat",               satuan: "Kaleng", harga_beli: 38000,  harga_jual: 48000,  stok: 40,  stok_minimum: 10,  deskripsi: "Cat kayu warna mahoni", active: true, createdAt: now, updatedAt: now },
        // SP-029 M3 — item jasa (behavior service, tanpa stok)
        { id: "13", companyCode: C, kode: "BRG-013", nama: "Jasa Pasang Keramik",          kategori: "Jasa",             satuan: "M2",    harga_beli: 0,      harga_jual: 25000,  stok: 0,   stok_minimum: 0,    deskripsi: "Jasa pemasangan keramik per meter persegi", behavior: "service", active: true, createdAt: now, updatedAt: now },
        { id: "14", companyCode: C, kode: "BRG-014", nama: "Ongkos Kirim",                 kategori: "Jasa",             satuan: "Paket", harga_beli: 0,      harga_jual: 15000,  stok: 0,   stok_minimum: 0,    deskripsi: "Biaya pengiriman pesanan", behavior: "service", active: true, createdAt: now, updatedAt: now }
    ];
}

/** @type {object[]} In-memory items (fallback) — NOT persisted to localStorage */
let items = createSeedData();
let nextId = "15"; // String ID for in-memory fallback consistency

/**
 * Generate next sequential string ID for in-memory fallback.
 * @returns {string}
 */
function nextStringId() {
    const id = nextId;
    nextId = String(Number(nextId) + 1);
    return id;
}

/**
 * Generate next kode for a new item.
 * @returns {string}
 */
function generateKode() {
    const maxNum = items.reduce((max, item) => {
        const match = item.kode.match(/BRG-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `BRG-${String(maxNum + 1).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════
//  Local fallback implementations
// ═══════════════════════════════════════════════

async function listBarangLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();

    let filtered = filterData(items);
    if (search) {
        filtered = filtered.filter(item =>
            item.kode.toLowerCase().includes(search) ||
            item.nama.toLowerCase().includes(search) ||
            item.kategori.toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);
    return {
        data: paged,
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

async function getBarangLocal(id) {
    await delay(150);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const companyCode = currentCompanyCode();
    if (companyCode && item.companyCode !== companyCode) return null;
    return { ...item };
}

async function createBarangLocal(data) {
    await delay(200);
    const now = Date.now();
    const newKode = data.kode || generateKode();
    const companyCode = currentCompanyCode();

    // ── Validasi Duplikat Kode (scoped per gudang) ──
    const existing = items.find(i => i.kode === newKode && i.gudang === data.gudang && (!companyCode || i.companyCode === companyCode));
    if (existing) {
        throw new Error(`Kode "${newKode}" sudah digunakan untuk barang "${existing.nama}" di gudang "${existing.gudang}", gunakan kode barang lain`);
    }

    const newItem = {
        id: nextStringId(),
        ...tagData({}),
        kode: newKode,
        nama: data.nama,
        kategori: data.kategori || "",
        satuan: data.satuan || "",
        rak: data.rak || "",
        gudang: data.gudang || "",
        harga_beli: Number(data.harga_beli) || 0,
        harga_jual: Number(data.harga_jual) || 0,
        stok: Number(data.stok) || 0,
        stok_minimum: Number(data.stok_minimum) || 0,
        // SP-029 M3 — tipe barang & foto (opsional)
        behavior: data.behavior || "trading",
        // M6.2-FIX v0.40 — Dijual/Tidak Dijual (default true — backward compat)
        dijual: data.dijual !== false,
        foto: data.foto || "",
        deskripsi: data.deskripsi || "",
        active: data.active !== false,
        createdAt: now,
        updatedAt: now
    };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateBarangLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const companyCode = currentCompanyCode();
    if (companyCode && items[index].companyCode !== companyCode) return null;

    // ── Validasi Duplikat Kode (jika kode diubah, scoped per gudang) ──
    if (data.kode !== undefined && data.kode !== items[index].kode) {
        const gudangBarang = data.gudang !== undefined ? data.gudang : items[index].gudang;
        const existing = items.find(i =>
            String(i.id) !== String(id) &&
            i.kode === data.kode &&
            i.gudang === gudangBarang &&
            (!companyCode || i.companyCode === companyCode)
        );
        if (existing) {
            throw new Error(`Kode "${data.kode}" sudah digunakan untuk barang "${existing.nama}" di gudang "${existing.gudang}", gunakan kode barang lain`);
        }
    }

    const updated = {
        ...items[index],
        kode: data.kode !== undefined ? data.kode : items[index].kode,
        nama: data.nama !== undefined ? data.nama : items[index].nama,
        kategori: data.kategori !== undefined ? data.kategori : items[index].kategori,
        satuan: data.satuan !== undefined ? data.satuan : items[index].satuan,
        rak: data.rak !== undefined ? data.rak : items[index].rak,
        gudang: data.gudang !== undefined ? data.gudang : items[index].gudang,
        harga_beli: data.harga_beli !== undefined ? Number(data.harga_beli) : items[index].harga_beli,
        harga_jual: data.harga_jual !== undefined ? Number(data.harga_jual) : items[index].harga_jual,
        stok: data.stok !== undefined ? Number(data.stok) : items[index].stok,
        stok_minimum: data.stok_minimum !== undefined ? Number(data.stok_minimum) : items[index].stok_minimum,
        behavior: data.behavior !== undefined ? data.behavior : (items[index].behavior || "trading"),
        dijual: data.dijual !== undefined ? data.dijual !== false : (items[index].dijual !== false),
        foto: data.foto !== undefined ? data.foto : (items[index].foto || ""),
        deskripsi: data.deskripsi !== undefined ? data.deskripsi : items[index].deskripsi,
        active: data.active !== undefined ? data.active : items[index].active,
        updatedAt: Date.now()
    };
    items[index] = updated;
    return { ...updated };
}

async function deleteBarangLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

async function countBarangLocal() {
    return filterData(items).length;
}

// ═══════════════════════════════════════════════
//  Public API — API-first, fallback ke in-memory
// ═══════════════════════════════════════════════

/**
 * List items with optional search and pagination.
 * API: GET /api/barang
 *
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.search]
 * @returns {Promise<{data: object[], pagination: object}>}
 */
export async function listBarang(params = {}) {
    return apiListFallback("/api/barang", params, () => listBarangLocal(params));
}

/**
 * Get a single item by ID.
 * API: GET /api/barang/:id
 *
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
export async function getBarang(id) {
    return apiGetFallback("/api/barang", id, () => getBarangLocal(id));
}

/**
 * Create a new item.
 * API: POST /api/barang
 *
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createBarang(data) {
    try {
        const result = await apiCall("POST", "/barang", data);
        if (result !== null) return result; // API sukses
    } catch (err) {
        // 409 Conflict / duplicate — jangan fallback ke local, propagate error
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    // API tidak tersedia atau error non-duplicate → fallback ke local
    return createBarangLocal(data);
}

/**
 * Update an existing item.
 * API: PUT /api/barang/:id
 *
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateBarang(id, data) {
    try {
        const result = await apiCall("PUT", `/barang/${id}`, data);
        if (result !== null) return result; // API sukses
    } catch (err) {
        // 409 Conflict / duplicate — jangan fallback ke local, propagate error
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    // API tidak tersedia atau error non-duplicate → fallback ke local
    return updateBarangLocal(id, data);
}

/**
 * Delete an item by ID.
 * API: DELETE /api/barang/:id
 *
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
export async function deleteBarang(id) {
    return apiDeleteFallback("/api/barang", id, () => deleteBarangLocal(id));
}

/**
 * Check if a kode already exists in the database.
 * API: GET /api/barang/check-kode/:kode
 *
 * Returns { exists, nama, id } — real-time lookup for form validation.
 *
 * @param {string} kode
 * @param {string} [gudang] Scope per gudang — kode sama di gudang beda dianggap valid
 * @param {string} [excludeId] ID barang yang sedang diedit (di-exclude dari pengecekan)
 * @returns {Promise<{exists: boolean, nama?: string, id?: string}>}
 */
export async function checkKodeExists(kode, gudang, excludeId) {
    try {
        let url = `/barang/check-kode/${encodeURIComponent(kode)}`;
        const params = [];
        if (gudang) params.push(`gudang=${encodeURIComponent(gudang)}`);
        if (excludeId) params.push(`excludeId=${encodeURIComponent(excludeId)}`);
        if (params.length) url += `?${params.join("&")}`;
        const result = await apiCall("GET", url);
        if (result !== null) return result;
    } catch (err) {
        console.warn("[checkKodeExists] API call failed, using local fallback:", err?.message);
    }
    // Local fallback — cari items dengan companyCode cocok, discope per gudang
    // Seed data (companyCode kosong) tetap ketemu via (!i.companyCode)
    // Parameter companyCode null = tanpa konteks tenant → semua item ketemu via (!companyCode)
    const companyCode = currentCompanyCode();
    const local = items.find(i => {
        if (i.kode !== kode) return false;
        if (companyCode && i.companyCode && i.companyCode !== companyCode) return false;
        if (excludeId && String(i.id) === String(excludeId)) return false; // item yang diedit
        // Scope ke gudang — kode sama di gudang beda dianggap valid; gudang
        // kosong = bucket sendiri (item tanpa gudang ikut cocok).
        const itemGudang = i.gudang || "";
        if (gudang) return itemGudang === gudang;
        return itemGudang === "";
    });
    if (local) {
        console.warn(`[checkKodeExists] Found local duplicate: ${local.kode} — ${local.nama} (gudang: ${local.gudang})`);
    }
    return local ? { exists: true, nama: local.nama, id: local.id } : { exists: false };
}

/**
 * Get total count of items (filtered by company).
 * @returns {Promise<number>}
 */
export async function countBarang() {
    try {
        const result = await listBarang({ page: 1, limit: 1 });
        return result.pagination.total;
    } catch {
        return countBarangLocal();
    }
}

/**
 * Reset to seed data (useful for testing / demo).
 */
export function resetData() {
    items = createSeedData();
    nextId = "15";
}

// Framework First: formatRupiah adalah util global → dari @smart/core,
// bukan didefinisikan ulang per aplikasi (pos & inventory re-export sama).
export { formatRupiah } from "@smart/core";
