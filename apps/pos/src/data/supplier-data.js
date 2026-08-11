/**
 * Supplier Data Service — API-first with in-memory fallback.
 *
 * @module supplier-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

const SUPPLIER_TYPES = ["PT", "CV", "Perorangan", "BUMDes", "Koperasi", "Lainnya"];

function createSeedData() {
    const C = currentCompanyCode() || "";

    const now = Date.now();
    return [
        { id: "1",  companyCode: C, kode: "SPL-001", nama: "PT Bumi Resources",         kontak: "Budi",   telepon: "021-1111111", email: "budi@bumiresources.com", alamat: "Jl. Sudirman No.1, Jakarta", deskripsi: "Supplier bahan bangunan utama", active: true, createdAt: now, updatedAt: now },
        { id: "2",  companyCode: C, kode: "SPL-002", nama: "CV Karya Abadi",            kontak: "Ani",    telepon: "022-2222222", email: "ani@karyaabadi.co.id", alamat: "Jl. Merdeka No.45, Bandung", deskripsi: "Supplier cat dan kimia", active: true, createdAt: now, updatedAt: now },
        { id: "3",  companyCode: C, kode: "SPL-003", nama: "UD Terminal Jaya",          kontak: "Cahyo",  telepon: "031-3333333", email: "cahyo@terminaljaya.com", alamat: "Jl. Raya No.78, Surabaya", deskripsi: "Supplier pipa dan besi", active: true, createdAt: now, updatedAt: now },
        { id: "4",  companyCode: C, kode: "SPL-004", nama: "PT Indah Karya Perkasa",    kontak: "Dewi",   telepon: "061-4444444", email: "dewi@indahkarya.com", alamat: "Jl. Gatot Subroto No.23, Medan", deskripsi: "Supplier material elektrikal", active: true, createdAt: now, updatedAt: now },
        { id: "5",  companyCode: C, kode: "SPL-005", nama: "CV Sinar Jaya Logam",       kontak: "Eko",    telepon: "0541-555555", email: "eko@sinarjaya.co.id", alamat: "Jl. Pahlawan No.12, Samarinda", deskripsi: "Supplier besi beton dan baja ringan", active: true, createdAt: now, updatedAt: now },
        { id: "6",  companyCode: C, kode: "SPL-006", nama: "Toko Bangunan Makmur",      kontak: "Fitri",  telepon: "021-6666666", email: "fitri@tokomakmur.com", alamat: "Jl. Ahmad Yani No.56, Jakarta", deskripsi: "Supplier material finishing", active: true, createdAt: now, updatedAt: now },
        { id: "7",  companyCode: C, kode: "SPL-007", nama: "PT Multi Guna Semesta",     kontak: "Gunawan",telepon: "024-7777777", email: "gunawan@multiguna.com", alamat: "Jl. Pandanaran No.90, Semarang", deskripsi: "Supplier semen dan material cor", active: true, createdAt: now, updatedAt: now },
        { id: "8",  companyCode: C, kode: "SPL-008", nama: "CV Bintang Terang Electric", kontak: "Hendra", telepon: "031-8888888", email: "hendra@bintangterang.co.id", alamat: "Jl. Diponegoro No.34, Surabaya", deskripsi: "Supplier kabel dan panel listrik", active: true, createdAt: now, updatedAt: now },
    ];
}

let items = createSeedData();
let nextId = "9";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/SPL-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `SPL-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listSupplierLocal(params = {}) {
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

async function getSupplierLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const companyCode = currentCompanyCode();
    if (companyCode && item.companyCode !== companyCode) return null;
    return { ...item };
}

async function createSupplierLocal(data) {
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

async function updateSupplierLocal(id, data) {
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

async function deleteSupplierLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listSupplier(params = {}) { return apiListFallback("/api/supplier", params, () => listSupplierLocal(params)); }
export async function getSupplier(id) { return apiGetFallback("/api/supplier", id, () => getSupplierLocal(id)); }
export async function createSupplier(data) {
    try {
        const result = await apiCall("POST", "/supplier", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createSupplierLocal(data);
}
export async function updateSupplier(id, data) {
    try {
        const result = await apiCall("PUT", `/supplier/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateSupplierLocal(id, data);
}
export async function deleteSupplier(id) { return apiDeleteFallback("/api/supplier", id, () => deleteSupplierLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("supplier", items, kode);
}

export function getSupplierTypes() { return [...SUPPLIER_TYPES]; }
export function resetSupplierData() { items = createSeedData(); nextId = "9"; }
