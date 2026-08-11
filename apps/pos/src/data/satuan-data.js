/**
 * Satuan Data Service — API-first with in-memory fallback.
 *
 * @module satuan-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        { id: "1",  companyCode: C, kode: "STN-001", nama: "Pcs",    deskripsi: "Piece / buah", active: true, createdAt: now, updatedAt: now },
        { id: "2",  companyCode: C, kode: "STN-002", nama: "Kg",     deskripsi: "Kilogram", active: true, createdAt: now, updatedAt: now },
        { id: "3",  companyCode: C, kode: "STN-003", nama: "Meter",  deskripsi: "Meter panjang", active: true, createdAt: now, updatedAt: now },
        { id: "4",  companyCode: C, kode: "STN-004", nama: "Liter",  deskripsi: "Liter volume", active: true, createdAt: now, updatedAt: now },
        { id: "5",  companyCode: C, kode: "STN-005", nama: "Galon",  deskripsi: "Galon (5 liter)", active: true, createdAt: now, updatedAt: now },
        { id: "6",  companyCode: C, kode: "STN-006", nama: "Sak",    deskripsi: "Sak / karung", active: true, createdAt: now, updatedAt: now },
        { id: "7",  companyCode: C, kode: "STN-007", nama: "Dus",    deskripsi: "Dus / box", active: true, createdAt: now, updatedAt: now },
        { id: "8",  companyCode: C, kode: "STN-008", nama: "Batang", deskripsi: "Batang / lonjor", active: true, createdAt: now, updatedAt: now },
        { id: "9",  companyCode: C, kode: "STN-009", nama: "Lembar", deskripsi: "Lembaran", active: true, createdAt: now, updatedAt: now },
        { id: "10", companyCode: C, kode: "STN-010", nama: "Kaleng", deskripsi: "Kaleng", active: true, createdAt: now, updatedAt: now },
        { id: "11", companyCode: C, kode: "STN-011", nama: "Roll",   deskripsi: "Roll / gulungan", active: true, createdAt: now, updatedAt: now },
        { id: "12", companyCode: C, kode: "STN-012", nama: "Box",    deskripsi: "Box / kardus", active: true, createdAt: now, updatedAt: now }
    ];
}

let items = createSeedData();
let nextId = "13";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/STN-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `STN-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listSatuanLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = filterData(items);
    if (search) filtered = filtered.filter(item => item.nama.toLowerCase().includes(search) || item.kode.toLowerCase().includes(search));
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: filtered.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getSatuanLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createSatuanLocal(data) {
    await delay(200);
    const now = Date.now();
    const newKode = data.kode || generateKode();
    const companyCode = currentCompanyCode();
    const existing = findDuplicateKode(items, newKode);
    if (existing) {
        throw new Error(`Kode "${newKode}" sudah digunakan untuk ${existing.nama}. Silakan gunakan kode lain.`);
    }
    const newItem = { id: nextStringId(), ...tagData({}), kode: newKode, nama: data.nama, deskripsi: data.deskripsi || "", active: data.active !== false, createdAt: now, updatedAt: now };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateSatuanLocal(id, data) {
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

async function deleteSatuanLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listSatuan(params = {}) { return apiListFallback("/api/satuan", params, () => listSatuanLocal(params)); }
export async function getSatuan(id) { return apiGetFallback("/api/satuan", id, () => getSatuanLocal(id)); }
export async function createSatuan(data) {
    try {
        const result = await apiCall("POST", "/satuan", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createSatuanLocal(data);
}
export async function updateSatuan(id, data) {
    try {
        const result = await apiCall("PUT", `/satuan/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateSatuanLocal(id, data);
}
export async function deleteSatuan(id) { return apiDeleteFallback("/api/satuan", id, () => deleteSatuanLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("satuan", items, kode);
}
