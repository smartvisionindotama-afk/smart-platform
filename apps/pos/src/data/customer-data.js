/**
 * Customer Data Service — API-first with in-memory fallback.
 *
 * @module customer-data
 */

import { apiCall, apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay, checkKodeExists as checkKodeExistsHelper, findDuplicateKode } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        { id: "1", companyCode: C, kode: "CUS-001", nama: "PT Maju Bersama",      kontak: "Hendra", telepon: "021-4444444", email: "hendra@majubersama.com",     alamat: "Jl. Sudirman No. 50, Jakarta", deskripsi: "Pelanggan tetap material bangunan", active: true, createdAt: now, updatedAt: now },
        { id: "2", companyCode: C, kode: "CUS-002", nama: "CV Indah Jaya",        kontak: "Indah",  telepon: "031-5555555", email: "indah@indahjaya.co.id",       alamat: "Jl. Tunjungan No. 20, Surabaya", deskripsi: "Distributor cat dan finishing", active: true, createdAt: now, updatedAt: now },
        { id: "3", companyCode: C, kode: "CUS-003", nama: "Toko Bangunan Subur",  kontak: "Subur",   telepon: "022-6666666", email: "subur@tokosubur.com",         alamat: "Jl. Merdeka No. 15, Bandung", deskripsi: "Toko retail bangunan", active: true, createdAt: now, updatedAt: now },
        { id: "4", companyCode: C, kode: "CUS-004", nama: "PT Karya Cipta Utama", kontak: "Cipto",   telepon: "061-7777777", email: "cipto@karyacipta.co.id",       alamat: "Jl. Ahmad Yani No. 5, Medan", deskripsi: "Kontraktor proyek perumahan", active: true, createdAt: now, updatedAt: now }
    ];
}

let items = createSeedData();
let nextId = "5";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }
function generateKode() {
    const maxNum = items.reduce((max, item) => { const m = item.kode.match(/CUS-(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    return `CUS-${String(maxNum + 1).padStart(3, "0")}`;
}

async function listCustomerLocal(params = {}) {
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

async function getCustomerLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createCustomerLocal(data) {
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

async function updateCustomerLocal(id, data) {
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

async function deleteCustomerLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

// ── Public API ──

export async function listCustomer(params = {}) { return apiListFallback("/api/customer", params, () => listCustomerLocal(params)); }
export async function getCustomer(id) { return apiGetFallback("/api/customer", id, () => getCustomerLocal(id)); }
export async function createCustomer(data) {
    try {
        const result = await apiCall("POST", "/customer", data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return createCustomerLocal(data);
}
export async function updateCustomer(id, data) {
    try {
        const result = await apiCall("PUT", `/customer/${id}`, data);
        if (result !== null) return result;
    } catch (err) {
        if (err.message?.includes("sudah digunakan")) throw err;
    }
    return updateCustomerLocal(id, data);
}
export async function deleteCustomer(id) { return apiDeleteFallback("/api/customer", id, () => deleteCustomerLocal(id)); }

export async function checkKodeExists(kode) {
    return checkKodeExistsHelper("customer", items, kode);
}

/**
 * Cari member (Customer) berdasarkan kode — verifikasi kartu member di kasir
 * (M3-FIX v20). API check-kode (exists + nama), fallback lokal bila jaringan down.
 * @param {string} kode Kode member (contoh: MBR-001)
 * @returns {Promise<{kode:string, nama:string, id:string}|null>}
 */
export async function getMemberByKode(kode) {
    const key = String(kode || "").trim();
    if (!key) return null;
    try {
        const res = await apiCall("GET", `/customer/check-kode/${encodeURIComponent(key)}`);
        if (res !== null) {
            if (res.exists) return { kode: key, nama: res.nama || key, id: res.id || "" };
            return null;
        }
    } catch {
        // jaringan down → fall through ke lokal
    }
    const local = items.find(i => String(i.kode).toLowerCase() === key.toLowerCase());
    return local ? { kode: local.kode, nama: local.nama, id: local.id } : null;
}
