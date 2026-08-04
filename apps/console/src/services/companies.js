/**
 * SMART Console — Company Data Service.
 *
 * API-first dengan in-memory fallback (sama seperti pola @smart/api).
 * Console menampilkan SEMUA perusahaan (platform-wide), tanpa scoping company.
 *
 * @module console/services/companies
 */

import {
    apiListFallback,
    apiCreateFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback
} from "@smart/api";

// ── Local fallback ──

const _companySeed = () => [
    { id: "1", code: "PT-001", jenis: "PT/CV/Perorangan", name: "PT Smart Vision Indotama",
        address: "Jl. Sudirman No. 123, Jakarta", phone: "021-12345678", email: "info@smartvision.co.id",
        taxId: "01.234.567.8-999.000", active: true, logo: null,
        createdAt: Date.now(), updatedAt: Date.now() },
    { id: "2", code: "CMP-002", jenis: "PT/CV/Perorangan", name: "CV Karya Mandiri",
        address: "Jl. Merdeka No. 45, Bandung", phone: "022-87654321", email: "info@karyamandiri.co.id",
        taxId: "02.345.678.9-888.000", active: true, logo: null,
        createdAt: Date.now(), updatedAt: Date.now() }
];

const companies = _companySeed();
let companyNextId = "3";

function nextCompanyId() {
    const id = companyNextId;
    companyNextId = String(Number(companyNextId) + 1);
    return id;
}

function delay(ms = 150) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function listCompaniesLocal(params = {}) {
    await delay(200);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = [...companies];
    if (search) {
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.code.toLowerCase().includes(search) ||
            c.email.toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: filtered.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getCompanyLocal(id) {
    await delay(100);
    return companies.find(c => String(c.id) === String(id)) || null;
}

async function createCompanyLocal(data) {
    await delay(150);
    const now = Date.now();
    const code = data.code || `PT-${String(Number(companyNextId)).padStart(3, "0")}`;

    const existing = companies.find(c => c.code === code);
    if (existing) {
        throw new Error(`Kode "${code}" sudah digunakan oleh ${existing.name}. Silakan gunakan kode lain.`);
    }
    const item = {
        id: nextCompanyId(), code, name: data.name,
        address: data.address || "", phone: data.phone || "", email: data.email || "",
        taxId: data.taxId || "", jenis: data.jenis || "PT/CV/Perorangan", active: data.active !== false,
        logo: data.logo || null,
        createdAt: now, updatedAt: now
    };
    companies.unshift(item);
    return { ...item };
}

async function updateCompanyLocal(id, data) {
    await delay(150);
    const idx = companies.findIndex(c => String(c.id) === String(id));
    if (idx === -1) return null;

    const oldCode = companies[idx].code;
    const newCode = data.code;

    if (newCode && newCode !== oldCode) {
        const dup = companies.find(c => c.code === newCode && String(c.id) !== String(id));
        if (dup) {
            throw new Error(`Kode "${newCode}" sudah digunakan oleh ${dup.name}. Silakan gunakan kode lain.`);
        }
    }

    companies[idx] = { ...companies[idx], ...data, id: companies[idx].id, updatedAt: Date.now() };
    return { ...companies[idx] };
}

async function deleteCompanyLocal(id) {
    await delay(100);
    const idx = companies.findIndex(c => String(c.id) === String(id));
    if (idx === -1) return false;
    companies.splice(idx, 1);
    return true;
}

// ── Public API ──

/**
 * List semua perusahaan (platform-wide).
 */
export async function listCompanies(params = {}) {
    return apiListFallback("/api/companies", params, () => listCompaniesLocal(params));
}

export async function getCompany(id) {
    return apiGetFallback("/api/companies", id, () => getCompanyLocal(id));
}

export async function createCompany(data) {
    return apiCreateFallback("/api/companies", data, () => createCompanyLocal(data));
}

export async function updateCompany(id, data) {
    return apiUpdateFallback("/api/companies", id, data, () => updateCompanyLocal(id, data));
}

export async function deleteCompany(id) {
    return apiDeleteFallback("/api/companies", id, () => deleteCompanyLocal(id));
}

/**
 * Cari perusahaan berdasarkan kode (bukan MongoDB ID).
 */
export async function getCompanyByCode(code) {
    if (!code) return null;
    try {
        const result = await listCompanies({ page: 1, limit: 999 });
        const company = result.data.find(c => c.code === code);
        if (company) return company;
    } catch {
        // fall through ke local
    }
    return companies.find(c => c.code === code) || null;
}
