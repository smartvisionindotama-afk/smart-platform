/**
 * Sales Data Service — API-first with in-memory fallback.
 *
 * @module sales-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        { id: "1", companyCode: C, kode: "SLS-001", nama: "Andi Sales",       kontak: "Andi",    telepon: "081-1111111", email: "andi@sales.com",      alamat: "Jl. Merdeka No. 10, Jakarta", deskripsi: "Sales area Jakarta Pusat", active: true, createdAt: now, updatedAt: now },
        { id: "2", companyCode: C, kode: "SLS-002", nama: "Budi Santoso",     kontak: "Budi",    telepon: "081-2222222", email: "budi@sales.com",      alamat: "Jl. Sudirman No. 20, Bandung", deskripsi: "Sales area Bandung", active: true, createdAt: now, updatedAt: now },
        { id: "3", companyCode: C, kode: "SLS-003", nama: "Citra Dewi",       kontak: "Citra",   telepon: "081-3333333", email: "citra@sales.com",     alamat: "Jl. Tunjungan No. 30, Surabaya", deskripsi: "Sales area Surabaya", active: true, createdAt: now, updatedAt: now },
        { id: "4", companyCode: C, kode: "SLS-004", nama: "Dedi Kurniawan",   kontak: "Dedi",    telepon: "081-4444444", email: "dedi@sales.com",      alamat: "Jl. Diponegoro No. 40, Medan", deskripsi: "Sales area Medan", active: true, createdAt: now, updatedAt: now }
    ];
}

let items = createSeedData();
let nextId = "5";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/SLS-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `SLS-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listSalesLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = filterData(items);
    if (search) filtered = filtered.filter(item => item.nama.toLowerCase().includes(search) || item.kode.toLowerCase().includes(search) || item.kontak?.toLowerCase().includes(search));
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: filtered.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getSalesLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createSalesLocal(data) {
    await delay(200);
    const now = Date.now();
    const newKode = data.kode || generateKode();
    const companyCode = currentCompanyCode();
    const existing = findDuplicateKode(items, newKode);
    if (existing) {
        throw new Error(`Kode "${newKode}" sudah digunakan untuk ${existing.nama}. Silakan gunakan kode lain.`);
    }
    const newItem = { id: nextStringId(), ...tagData({}), kode: newKode, nama: data.nama, kontak: data.kontak || "", telepon: data.telepon || "", email: data.email || "", alamat: data.alamat || "", deskripsi: data.deskripsi || "", active: data.active !== false, createdAt: now, updatedAt: now };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateSalesLocal(id, data) {
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

async function deleteSalesLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listSales(params = {}) { return apiListFallback("/api/sales", params, () => listSalesLocal(params)); }
export async function getSales(id) { return apiGetFallback("/api/sales", id, () => getSalesLocal(id)); }
export async function createSales(data) {
    try {
        const result = await apiCall("POST", "/sales", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createSalesLocal(data);
}
export async function updateSales(id, data) {
    try {
        const result = await apiCall("PUT", `/sales/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateSalesLocal(id, data);
}
export async function deleteSales(id) { return apiDeleteFallback("/api/sales", id, () => deleteSalesLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("sales", items, kode);
}
