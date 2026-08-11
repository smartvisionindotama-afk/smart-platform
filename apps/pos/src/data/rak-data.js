/**
 * Rak Data Service — API-first with in-memory fallback.
 *
 * @module rak-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        { id: "1",  companyCode: C, kode: "RAK-001", nama: "Rak A1",   lokasi: "Lt 1", gudang: "GDG-001", deskripsi: "Barang cepat habis", active: true, createdAt: now, updatedAt: now },
        { id: "2",  companyCode: C, kode: "RAK-002", nama: "Rak A2",   lokasi: "Lt 1", gudang: "GDG-001", deskripsi: "Barang ukuran sedang", active: true, createdAt: now, updatedAt: now },
        { id: "3",  companyCode: C, kode: "RAK-003", nama: "Rak B1",   lokasi: "Lt 2", gudang: "GDG-001", deskripsi: "Barang tahan lama", active: true, createdAt: now, updatedAt: now },
        { id: "4",  companyCode: C, kode: "RAK-004", nama: "Rak E1",   lokasi: "Depan", gudang: "GDG-001", deskripsi: "Display pelanggan", active: true, createdAt: now, updatedAt: now },
        { id: "5",  companyCode: C, kode: "RAK-005", nama: "Rak E2",   lokasi: "Belakang", gudang: "GDG-001", deskripsi: "Produk musiman", active: true, createdAt: now, updatedAt: now }
    ];
}

let items = createSeedData();
let nextId = "6";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/RAK-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `RAK-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listRakLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = filterData(items);
    if (search) filtered = filtered.filter(item => item.nama.toLowerCase().includes(search) || item.kode.toLowerCase().includes(search) || item.lokasi.toLowerCase().includes(search) || (item.gudang || "").toLowerCase().includes(search));
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: filtered.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getRakLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createRakLocal(data) {
    await delay(200);
    const now = Date.now();
    const newKode = data.kode || generateKode();
    const companyCode = currentCompanyCode();
    const existing = findDuplicateKode(items, newKode);
    if (existing) {
        throw new Error(`Kode "${newKode}" sudah digunakan untuk ${existing.nama}. Silakan gunakan kode lain.`);
    }
    const newItem = { id: nextStringId(), ...tagData({}), kode: newKode, nama: data.nama, lokasi: data.lokasi || "", gudang: data.gudang || "", deskripsi: data.deskripsi || "", active: data.active !== false, createdAt: now, updatedAt: now };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateRakLocal(id, data) {
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

async function deleteRakLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listRak(params = {}) { return apiListFallback("/api/rak", params, () => listRakLocal(params)); }
export async function getRak(id) { return apiGetFallback("/api/rak", id, () => getRakLocal(id)); }
export async function createRak(data) {
    try {
        const result = await apiCall("POST", "/rak", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createRakLocal(data);
}
export async function updateRak(id, data) {
    try {
        const result = await apiCall("PUT", `/rak/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateRakLocal(id, data);
}
export async function deleteRak(id) { return apiDeleteFallback("/api/rak", id, () => deleteRakLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("rak", items, kode);
}
