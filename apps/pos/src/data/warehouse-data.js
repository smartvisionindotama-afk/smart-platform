/**
 * Warehouse Data Service — API-first with in-memory fallback.
 *
 * @module warehouse-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        { id: "1", companyCode: C, kode: "WH-001", nama: "Gudang Utama",   alamat: "Jl. Industri No. 1, Jakarta", kontak: "Bambang", telepon: "021-1111111", deskripsi: "Gudang pusat penyimpanan barang", active: true, createdAt: now, updatedAt: now },
        { id: "2", companyCode: C, kode: "WH-002", nama: "Gudang Cabang",   alamat: "Jl. Raya No. 10, Bandung",   kontak: "Siti",    telepon: "022-2222222", deskripsi: "Gudang cabang untuk distribusi wilayah barat", active: true, createdAt: now, updatedAt: now },
        { id: "3", companyCode: C, kode: "WH-003", nama: "Gudang Transit",  alamat: "Kawasan Pelabuhan Tanjung Priok", kontak: "Agus", telepon: "021-3333333", deskripsi: "Gudang transit untuk barang impor/ekspor", active: true, createdAt: now, updatedAt: now }
    ];
}

let items = createSeedData();
let nextId = "4";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/WH-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `WH-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listWarehouseLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = filterData(items);
    if (search) filtered = filtered.filter(item => item.nama.toLowerCase().includes(search) || item.kode.toLowerCase().includes(search) || item.alamat.toLowerCase().includes(search));
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: filtered.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getWarehouseLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createWarehouseLocal(data) {
    await delay(200);
    const now = Date.now();
    const newKode = data.kode || generateKode();
    const companyCode = currentCompanyCode();
    const existing = findDuplicateKode(items, newKode);
    if (existing) {
        throw new Error(`Kode "${newKode}" sudah digunakan untuk ${existing.nama}. Silakan gunakan kode lain.`);
    }
    const newItem = { id: nextStringId(), ...tagData({}), kode: newKode, nama: data.nama, alamat: data.alamat || "", kontak: data.kontak || "", telepon: data.telepon || "", deskripsi: data.deskripsi || "", active: data.active !== false, createdAt: now, updatedAt: now };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateWarehouseLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return null;
    if (data.kode !== undefined && data.kode.toLowerCase() !== items[index].kode.toLowerCase()) {
        const existing = findDuplicateKode(items, data.kode, id);
        if (existing) {
            throw new Error(`Kode "${data.kode}" sudah digunakan untuk ${existing.nama}. Silakan gunakan kode lain.`);
        }
    }
    items[index] = { ...items[index], ...data, id: items[index].id, updatedAt: Date.now() };
    return { ...items[index] };
}

async function deleteWarehouseLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listWarehouse(params = {}) { return apiListFallback("/api/warehouse", params, () => listWarehouseLocal(params)); }
export async function getWarehouse(id) { return apiGetFallback("/api/warehouse", id, () => getWarehouseLocal(id)); }
export async function createWarehouse(data) {
    try {
        const result = await apiCall("POST", "/warehouse", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createWarehouseLocal(data);
}
export async function updateWarehouse(id, data) {
    try {
        const result = await apiCall("PUT", `/warehouse/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateWarehouseLocal(id, data);
}
export async function deleteWarehouse(id) { return apiDeleteFallback("/api/warehouse", id, () => deleteWarehouseLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("warehouse", items, kode);
}
