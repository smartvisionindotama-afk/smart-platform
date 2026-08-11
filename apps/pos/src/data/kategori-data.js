/**
 * Kategori Data Service — API-first with in-memory fallback.
 *
 * @module kategori-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        { id: "1",  companyCode: C, kode: "KAT-001", nama: "Material Bangunan", deskripsi: "Bahan-bahan material konstruksi bangunan", active: true, createdAt: now, updatedAt: now },
        { id: "2",  companyCode: C, kode: "KAT-002", nama: "Cat",               deskripsi: "Cat tembok, cat kayu, dan cat besi", active: true, createdAt: now, updatedAt: now },
        { id: "3",  companyCode: C, kode: "KAT-003", nama: "Pipa",              deskripsi: "Pipa PVC, pipa besi, dan perlengkapannya", active: true, createdAt: now, updatedAt: now },
        { id: "4",  companyCode: C, kode: "KAT-004", nama: "Elektrikal",        deskripsi: "Peralatan dan material listrik", active: true, createdAt: now, updatedAt: now },
        { id: "5",  companyCode: C, kode: "KAT-005", nama: "Perekat",           deskripsi: "Lem, sealant, dan perekat lainnya", active: true, createdAt: now, updatedAt: now },
        { id: "6",  companyCode: C, kode: "KAT-006", nama: "Sanitary",          deskripsi: "Peralatan sanitair kamar mandi", active: true, createdAt: now, updatedAt: now },
        { id: "7",  companyCode: C, kode: "KAT-007", nama: "Peralatan",         deskripsi: "Alat-alat kerja dan peralatan", active: true, createdAt: now, updatedAt: now },
        { id: "8",  companyCode: C, kode: "KAT-008", nama: "Safety",            deskripsi: "Alat keselamatan kerja (APD)", active: true, createdAt: now, updatedAt: now },
        { id: "9",  companyCode: C, kode: "KAT-009", nama: "Lainnya",           deskripsi: "Kategori lainnya", active: true, createdAt: now, updatedAt: now }
    ];
}

let items = createSeedData();
let nextId = "10";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/KAT-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `KAT-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listKategoriLocal(params = {}) {
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

async function getKategoriLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createKategoriLocal(data) {
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

async function updateKategoriLocal(id, data) {
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

async function deleteKategoriLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listKategori(params = {}) { return apiListFallback("/api/kategori", params, () => listKategoriLocal(params)); }
export async function getKategori(id) { return apiGetFallback("/api/kategori", id, () => getKategoriLocal(id)); }
export async function createKategori(data) {
    try {
        const result = await apiCall("POST", "/kategori", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createKategoriLocal(data);
}
export async function updateKategori(id, data) {
    try {
        const result = await apiCall("PUT", `/kategori/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateKategoriLocal(id, data);
}
export async function deleteKategori(id) { return apiDeleteFallback("/api/kategori", id, () => deleteKategoriLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("kategori", items, kode);
}
