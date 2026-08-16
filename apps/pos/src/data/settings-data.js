/**
 * Settings Data Services — API-first with in-memory fallback.
 *
 * Data persistence untuk Company, User, Role, Permission via backend Express + MongoDB.
 * Jika backend tidak tersedia, fallback ke in-memory array (tanpa localStorage).
 * Sesuai roadmap: Sprint 1 — MongoDB + Repository Pattern.
 *
 * Uses @smart/core for multi-tenant company context
 * and @smart/api for API fallback utilities.
 *
 * @module settings-data
 */

import {
    apiCall,
    apiListFallback,
    apiCreateFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback,
    buildQuery,
    normalizeList,
    normalizeItem,
    isApiAvailable
} from "./api.js";

import { currentCompanyCode, filterData, tagData, delay } from "./helpers.js";
import { Permission } from "@smart/core";

// ═══════════════════════════════════════════════
//  Company (master data — not tenant-scoped)
// ═══════════════════════════════════════════════

/**
 * Base URL API Platform (Console). Sejak SP-027 M2, data company dilayani
 * apps/console (master.e-profit.id) — origin inventory TIDAK punya route
 * /api/companies (401/404 sejak M3). GET publik console (payload ringan:
 * code/name/jenis/logo/workspace) cukup untuk logo & nama company.
 * Override dev/staging via window.__APP_URLS__?.console.
 * @returns {string} Base URL ("" = same-origin)
 */
function consoleBaseUrl() {
    try {
        const override = typeof window !== "undefined" && window.__APP_URLS__?.console;
        if (override) return String(override).replace(/\/?$/, "");
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.hostname === "master.e-profit.id") {
        return "";
    }
    return "https://master.e-profit.id";
}

function _filterCompanies(items) {
    const code = currentCompanyCode();
    if (!code) return items;
    return items.filter(item => item.code === code);
}

const _companySeed = () => [
    { id: "1", code: "PT-001", jenis: "PT/CV/Perorangan", name: "PT Smart Vision Indotama",
        address: "Jl. Sudirman No. 123, Jakarta", phone: "021-12345678", email: "info@smartvision.co.id",
        taxId: "01.234.567.8-999.000", active: true, logo: null,
        legalId: "", legalPerdes: "24", legalPerdesDate: "2023-10-06", legalAhu: "AHU-04168.AH.01.33.TAHUN 2024",
        legalNib: "", legalNpwp: "01.234.567.8-999.000", legalInduk: "", legalIjin: "",
        orgPenasehat: "", orgPengawas: "", orgKetua: "", orgSekretaris: "", orgBendahara: "",
        createdAt: Date.now(), updatedAt: Date.now() },
    { id: "2", code: "CMP-002", jenis: "PT/CV/Perorangan", name: "CV Karya Mandiri",
        address: "Jl. Merdeka No. 45, Bandung", phone: "022-87654321", email: "info@karyamandiri.co.id",
        taxId: "02.345.678.9-888.000", active: true, logo: null,
        legalId: "", legalPerdes: "12", legalPerdesDate: "2022-05-15", legalAhu: "",
        legalNib: "", legalNpwp: "02.345.678.9-888.000", legalInduk: "", legalIjin: "",
        orgPenasehat: "", orgPengawas: "", orgKetua: "", orgSekretaris: "", orgBendahara: "",
        createdAt: Date.now(), updatedAt: Date.now() }
];
let companies = _companySeed();
let companyNextId = "3";

function nextCompanyId() {
    const id = companyNextId;
    companyNextId = String(Number(companyNextId) + 1);
    return id;
}

// ── Company: Local fallback ──

async function listCompaniesLocal(params = {}) {
    await delay(200);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = _filterCompanies([...companies]);
    if (search) filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.code.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.legalId.toLowerCase().includes(search)
    );
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

    // Cek duplicate code
    const existing = companies.find(c => c.code === code);
    if (existing) {
        throw new Error(`Kode "${code}" sudah digunakan oleh ${existing.name}. Silakan gunakan kode lain.`);
    }
    const item = {
        id: nextCompanyId(), code, name: data.name,
        address: data.address || "", phone: data.phone || "", email: data.email || "",
        taxId: data.taxId || "", jenis: data.jenis || "PT/CV/Perorangan", active: data.active !== false,
        logo: data.logo || null,
        legalId: data.legalId || "", legalPerdes: data.legalPerdes || "", legalPerdesDate: data.legalPerdesDate || "",
        legalAhu: data.legalAhu || "", legalNib: data.legalNib || "", legalNpwp: data.legalNpwp || "",
        legalInduk: data.legalInduk || "", legalIjin: data.legalIjin || "",
        orgPenasehat: data.orgPenasehat || "", orgPengawas: data.orgPengawas || "",
        orgKetua: data.orgKetua || "", orgSekretaris: data.orgSekretaris || "", orgBendahara: data.orgBendahara || "",
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

    // Cek duplicate code (kecuali kode lama sama)
    if (newCode && newCode !== oldCode) {
        const dup = companies.find(c => c.code === newCode && String(c.id) !== String(id));
        if (dup) {
            throw new Error(`Kode "${newCode}" sudah digunakan oleh ${dup.name}. Silakan gunakan kode lain.`);
        }
    }

    companies[idx] = { ...companies[idx], ...data, id: companies[idx].id, updatedAt: Date.now() };

    // If company code changed, sync all users with the old code
    if (newCode && oldCode && oldCode !== newCode) {
        let synced = 0;
        appUsers.forEach(u => {
            if (u.companyCode === oldCode) {
                u.companyCode = newCode;
                synced++;
            }
        });
        if (synced > 0) {
            console.log(`[Local] Synced ${synced} users: ${oldCode} → ${newCode}`);
        }
    }

    return { ...companies[idx] };
}

async function deleteCompanyLocal(id) {
    await delay(100);
    const idx = companies.findIndex(c => String(c.id) === String(id));
    if (idx === -1) return false;
    companies.splice(idx, 1);
    return true;
}

// ── Company: Public API ──

/**
 * Profil company dari SERVER POS (F&B V1-FIX / Settings → Company).
 * Console MENOLAK token POS (audience isolation SP-027 M3: console
 * expectedAudience "console", token POS ber-audience "inventory") —
 * GET/PUT /api/companies/:id di console selalu 401 → form edit kosong dan
 * simpanan diam-diam jatuh ke fallback lokal (TIDAK tersimpan ke DB).
 * Server POS membaca/menulis dokumen Company yang SAMA (DB bersama) dengan
 * token POS yang valid. Fallback console tetap dipertahankan.
 * @returns {Promise<object|null>} Profil company (id, code, name, ...) | null
 */
async function fetchCompanyProfile() {
    try {
        const res = await apiCall("GET", "/company-profile");
        if (res && res.data) return normalizeItem(res.data);
    } catch (err) {
        console.warn("[Settings] Gagal ambil company-profile:", err?.message);
    }
    return null;
}

export async function listCompanies(params = {}) {
    const code = currentCompanyCode();
    // POS context: data company dibaca dari server POS (lengkap: kontak,
    // alamat, whatsapp, logo, legal, org) — bukan daftar publik console yang
    // hanya memuat code/name/jenis/logo (payload tereduksi utk request tanpa
    // token console yang valid).
    const profile = await fetchCompanyProfile();
    if (profile) {
        const limit = params.limit || 10;
        return { data: [profile], pagination: { page: 1, limit, total: 1, totalPages: 1 } };
    }
    // Fallback lama: daftar publik console (payload ringan).
    const options = {
        baseUrl: consoleBaseUrl(),
        ...(code ? { companyCode: code } : {})
    };
    const result = await apiListFallback("/api/companies", params, () => listCompaniesLocal(params), options);
    // Safety net — apply client-side company scoping for API responses
    // Match against multiple possible linking fields (code, tenantId, tenantCode, companyCode)
    if (code && result && result.data && result.data.length > 0) {
        const filtered = result.data.filter(item =>
            String(item.code) === String(code) ||
            String(item.tenantId) === String(code) ||
            String(item.tenantCode) === String(code) ||
            String(item.companyCode) === String(code)
        );
        result.data = filtered;
        result.pagination.total = filtered.length;
        result.pagination.totalPages = Math.max(1, Math.ceil(filtered.length / (params.limit || 10)));
    }
    return result;
}

/**
 * List ALL companies without company code filtering.
 * Used for display purposes (e.g., resolving company names in User settings).
 */
export async function listAllCompanies(params = {}) {
    // companyCode: null → JANGAN kirim header x-company-code (list ALL lintas
    // company, bukan hanya company sesi aktif) — lihat apiFetch di @smart/api.
    return apiListFallback("/api/companies", params, () => listCompaniesLocal(params), { baseUrl: consoleBaseUrl(), companyCode: null });
}

export async function getCompany(id) {
    // POS context: profil diambil dari server POS (data existing dari console
    // via DB bersama) — form edit terisi otomatis, tanpa input ulang kode/nama.
    const profile = await fetchCompanyProfile();
    if (profile) return profile;
    return apiGetFallback("/api/companies", id, () => getCompanyLocal(id));
}

export async function createCompany(data) {
    return apiCreateFallback("/api/companies", data, () => createCompanyLocal(data));
}

export async function updateCompany(id, data) {
    // POS context: simpan lewat server POS (whitelist; code/name diabaikan
    // server — identitas dikelola Console). Sebelumnya PUT console selalu
    // 401 → simpanan hanya di fallback lokal (TIDAK masuk DB).
    const { code, name, ...payload } = data || {};
    try {
        const res = await apiCall("PUT", "/company-profile", payload);
        if (res && res.data) return normalizeItem(res.data);
    } catch (err) {
        console.warn("[Settings] Gagal simpan company-profile:", err?.message);
    }
    return apiUpdateFallback("/api/companies", id, data, () => updateCompanyLocal(id, data));
}

export async function deleteCompany(id) {
    return apiDeleteFallback("/api/companies", id, () => deleteCompanyLocal(id));
}

/**
 * Find a company by its code (not MongoDB ID).
 * Used for fetching company data (e.g., logo) for the current context.
 *     * @param {string} code Company code like "PT-001"

 * @returns {Promise<object|null>}
 */
export async function getCompanyByCode(code) {
    if (!code) return null;
    try {
        // Kirim companyCode EKSPLISIT (bukan company sesi) agar console memfilter
        // ke company yang diminta — getCompanyByCode bisa dipanggil untuk code
        // selain company aktif (mis. lintas dokumen/transaksi).
        const result = await apiListFallback(
            "/api/companies",
            { page: 1, limit: 999 },
            () => listCompaniesLocal({ page: 1, limit: 999 }),
            { baseUrl: consoleBaseUrl(), companyCode: code }
        );
        const company = (result?.data || []).find(c => c.code === code);
        if (company) return company;
    } catch {
        // fall through to local
    }
    // Local fallback
    return companies.find(c => c.code === code) || null;
}


// ═══════════════════════════════════════════════
//  User (tenant-scoped by companyCode)
// ═══════════════════════════════════════════════

const ROLE_OPTIONS = ["supervisor", "operator", "admin", "owner", "kasir", "chef"];

const _userSeed = () => [
    { id: "1", username: "admin",    password: "admin123",    name: "Administrator",     email: "admin@smart.id",    role: "owner",    companyCode: "PT-001", active: true, createdAt: Date.now(), updatedAt: Date.now() },
    { id: "2", username: "operator", password: "operator123", name: "Operator Gudang",   email: "operator@smart.id", role: "operator", companyCode: "PT-001", active: true, createdAt: Date.now(), updatedAt: Date.now() }
];
let appUsers = _userSeed();
let userNextId = "3";

function nextUserId() {
    const id = userNextId;
    userNextId = String(Number(userNextId) + 1);
    return id;
}

// ── User: Local fallback ──

async function listUsersLocal(params = {}) {
    await delay(200);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = params.allCompanies ? [...appUsers] : filterData(appUsers);
    if (search) filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
    );
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map(u => {
        const { password, ...rest } = u;
        return rest;
    });
    return { data: items, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getUserLocal(id, bypassGuard = false) {
    await delay(100);
    const user = appUsers.find(u => String(u.id) === String(id));
    if (!user) return null;
    if (!bypassGuard) {
        const code = currentCompanyCode();
        if (code && user.companyCode !== code) return null;
    }
    const userCopy = { ...user };
    delete userCopy.password;
    return userCopy;
}

async function createUserLocal(data) {
    await delay(150);
    const now = Date.now();
    const item = {
        id: nextUserId(), username: data.username, password: data.password || "changeme123", name: data.name,
        email: data.email || "", role: data.role || "supervisor",
        companyCode: data.companyCode || currentCompanyCode() || "",
        active: data.active !== false, createdAt: now, updatedAt: now
    };
    appUsers.unshift(item);
    const newUser = { ...item };
    delete newUser.password;
    return newUser;
}

async function updateUserLocal(id, data, bypassGuard = false) {
    await delay(150);
    const idx = appUsers.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return null;
    if (!bypassGuard) {
        const code = currentCompanyCode();
        if (code && appUsers[idx].companyCode !== code) return null;
    }
    const newCompanyCode = data.companyCode || appUsers[idx].companyCode;
    const safeData = { ...data };
    if (safeData.password === undefined) {
        delete safeData.password;
    } else {
        safeData.password = String(safeData.password);
    }
    appUsers[idx] = { ...appUsers[idx], ...safeData, id: appUsers[idx].id, companyCode: newCompanyCode, updatedAt: Date.now() };
    const result = { ...appUsers[idx] };
    delete result.password;
    return result;
}

async function deleteUserLocal(id, bypassGuard = false) {
    await delay(100);
    const idx = appUsers.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return false;
    if (!bypassGuard) {
        const code = currentCompanyCode();
        if (code && appUsers[idx].companyCode !== code) return false;
    }
    appUsers.splice(idx, 1);
    return true;
}

// ── User: Public API ──

export async function listUsers(params = {}) {
    const code = currentCompanyCode();
    const options = code ? { companyCode: code } : {};

    // M3-FIX v28b — PAGINATION BENAR. Sebelumnya allCompanies=true (dikirim
    // module) membuat SERVER mempage di SEMUA company, lalu client memfilter
    // companyCode sendiri → user company lain mengisi halaman 1 (sort
    // createdAt desc) sehingga user PT-001 yang lebih lama (owner, operator)
    // tenggelam ke halaman global berikutnya dan tidak pernah tampil (kasus:
    // hanya role kasir yang muncul di tabel). Bila konteks company aktif,
    // paksa allCompanies=false → SERVER yang memfilter companyCode + paginate
    // per-company (benar & konsisten).
    if (code) {
        params = { ...params, allCompanies: false };
    }

    // M3-FIX v28 — jangan diam-diam jatuh ke seed lokal [admin, operator]
    // saat server hidup tapi GET gagal (mis. 500 sesaat / 401): seed lokal
    // menyembunyikan user nyata (mis. role kasir) sehingga kasir1 "tidak
    // tampil" padahal ada di DB — menyesatkan admin. Bila API sehat → error
    // server diteruskan (module menampilkan alert); hanya jaringan down yang
    // memakai fallback offline.
    if (await isApiAvailable()) {
        const qs = buildQuery(params);
        const res = await apiCall("GET", `/users${qs}`);
        const normalized = normalizeList(res);
        if (code && normalized?.data?.length) {
            const filtered = normalized.data.filter(item =>
                String(item.companyCode) === String(code)
            );
            normalized.data = filtered;
            normalized.pagination.total = filtered.length;
            normalized.pagination.totalPages = Math.max(1, Math.ceil(filtered.length / (params.limit || 10)));
        }
        return normalized;
    }

    const result = await apiListFallback("/api/users", params, () => listUsersLocal(params), options);

    // Safety net — client-side company scoping for API responses
    if (code && result && result.data && result.data.length > 0) {
        const filtered = result.data.filter(item =>
            String(item.companyCode) === String(code)
        );
        result.data = filtered;
        result.pagination.total = filtered.length;
        result.pagination.totalPages = Math.max(1, Math.ceil(filtered.length / (params.limit || 10)));
    }
    return result;
}

export async function getUser(id, bypassGuard = false) {
    // Note: bypassGuard only applies in local fallback; API handles auth separately
    return apiGetFallback("/api/users", id, () => getUserLocal(id, bypassGuard));
}

export async function createUser(data) {
    return apiCreateFallback("/api/users", data, () => createUserLocal(data));
}

export async function updateUser(id, data, bypassGuard = false) {
    return apiUpdateFallback("/api/users", id, data, () => updateUserLocal(id, data, bypassGuard));
}

export async function deleteUser(id, bypassGuard = false) {
    return apiDeleteFallback("/api/users", id, () => deleteUserLocal(id, bypassGuard));
}

/**
 * Daftar role yang bisa dipilih untuk user.
 * Gabungan role bawaan + role kustom yang dibuat via Settings → Role.
 * @returns {Promise<string[]>}
 */
export async function getRoleOptions() {
    const merged = [...ROLE_OPTIONS];
    try {
        const result = await listRoles({ page: 1, limit: 999 });
        const custom = (result.data || []).map(r => r.name);
        for (const name of custom) {
            if (!merged.includes(name)) merged.push(name);
        }
    } catch (e) {
        console.warn("[Settings] getRoleOptions fallback ke bawaan:", e);
    }
    return merged;
}

/**
 * Authenticate a user by username/email and password (local only).
 * Returns user data on success, or throws an error with specific message.
 */
export function authenticateUser(identifier, password) {
    const lower = identifier.toLowerCase();
    const user = appUsers.find(
        u => (u.username.toLowerCase() === lower || u.email.toLowerCase() === lower) && u.active !== false
    );
    if (!user) return null;
    if (user.password !== password) return null;

    // Check if user's company is active
    if (user.companyCode) {
        const company = companies.find(c => c.code === user.companyCode);
        if (company && company.active === false) {
            throw new Error("Status perusahaan tidak aktif. Silahkan hubungi admin aplikasi Anda.");
        }
    }

    return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        institution: user.companyCode || "PT-001",
        companyCode: user.companyCode
    };
}


// ═══════════════════════════════════════════════
//  Role (tenant-scoped by companyCode)
// ═══════════════════════════════════════════════

const _roleSeed = () => [
    { id: "1", name: "supervisor", label: "Supervisor",      level: 10, description: "Mengawasi operasional gudang" },
    { id: "2", name: "operator",   label: "Operator Gudang",  level: 30, description: "Operator gudang" },
    { id: "3", name: "admin",      label: "Admin",            level: 70, description: "Mengelola sistem inventory" },
    { id: "4", name: "owner",      label: "Owner",            level: 100,description: "Pemilik / Super Admin" }
];
let roleDefs = _roleSeed();
let roleNextId = "5";

function nextRoleId() {
    const id = roleNextId;
    roleNextId = String(Number(roleNextId) + 1);
    return id;
}

// ── Role: Local fallback ──

async function listRolesLocal(params = {}) {
    await delay(200);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = [...roleDefs]; // Roles are global — no company filtering
    if (search) filtered = filtered.filter(r =>
        r.label.toLowerCase().includes(search) || r.name.toLowerCase().includes(search)
    );
    filtered.sort((a, b) => b.level - a.level);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: filtered.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getRoleLocal(id) {
    await delay(100);
    const role = roleDefs.find(r => String(r.id) === String(id));
    if (!role) return null;
    return { ...role };
}

async function createRoleLocal(data) {
    await delay(150);
    const now = Date.now();
    const item = {
        id: nextRoleId(), name: data.name, label: data.label, level: Number(data.level) || 10,
        description: data.description || "", createdAt: now, updatedAt: now
    };
    roleDefs.unshift(item);
    return { ...item };
}

async function updateRoleLocal(id, data) {
    await delay(150);
    const idx = roleDefs.findIndex(r => String(r.id) === String(id));
    if (idx === -1) return null;
    roleDefs[idx] = { ...roleDefs[idx], ...data, id: roleDefs[idx].id, updatedAt: Date.now() };
    return { ...roleDefs[idx] };
}

async function deleteRoleLocal(id) {
    await delay(100);
    const idx = roleDefs.findIndex(r => String(r.id) === String(id));
    if (idx === -1) return false;
    roleDefs.splice(idx, 1);
    return true;
}

// ── Role: Public API ──

export async function listRoles(params = {}) {
    return apiListFallback("/api/roles", params, () => listRolesLocal(params));
}

export async function getRole(id) {
    return apiGetFallback("/api/roles", id, () => getRoleLocal(id));
}

export async function createRole(data) {
    return apiCreateFallback("/api/roles", data, () => createRoleLocal(data));
}

export async function updateRole(id, data) {
    return apiUpdateFallback("/api/roles", id, data, () => updateRoleLocal(id, data));
}

export async function deleteRole(id) {
    return apiDeleteFallback("/api/roles", id, () => deleteRoleLocal(id));
}


// ═══════════════════════════════════════════════
//  Permission (role-permission mapping)
// ═══════════════════════════════════════════════

/**
 * Namespace-based Permission Catalog.
 * Format: {application}.{resource}.{action}
 *
 * Contoh:
 *   inventory.dashboard.view
 *   inventory.barang.read
 *   inventory.barang.create
 *   settings.company.edit
 *   settings.user.manage
 */
export const PERMISSION_CATALOG = [
    "inventory.dashboard.view",
    "inventory.barang.read", "inventory.barang.create", "inventory.barang.update", "inventory.barang.delete",
    "inventory.category.read", "inventory.category.create", "inventory.category.update", "inventory.category.delete",
    "inventory.rak.read", "inventory.rak.create", "inventory.rak.update", "inventory.rak.delete",
    "inventory.satuan.read", "inventory.satuan.create", "inventory.satuan.update", "inventory.satuan.delete",
    "inventory.warehouse.read", "inventory.warehouse.create", "inventory.warehouse.update", "inventory.warehouse.delete",
    "inventory.supplier.read", "inventory.supplier.create", "inventory.supplier.update", "inventory.supplier.delete",
    "inventory.customer.read", "inventory.customer.create", "inventory.customer.update", "inventory.customer.delete",
    "inventory.pembelian.read", "inventory.pembelian.create", "inventory.pembelian.approve",
    "inventory.sales.read", "inventory.sales.create",
    "inventory.transfer.read", "inventory.transfer.create",
    "inventory.inventory.view",
    "inventory.stock.adjust", "inventory.stock.opname",
    "inventory.report.view", "inventory.report.export",
    "settings.company.edit", "settings.company.create", "settings.company.update", "settings.company.delete",
    "settings.user.manage",
    "settings.role.manage",
    "settings.permission.manage",
    // M6.2 — F&B Recipe/BOM (Admin/Owner)
    "pos.recipe.manage",
    // F&B Customer Ordering V1 — QR Menu, Order Meja, Kitchen (kasir/chef/admin)
    "pos.qr.manage",
    "pos.order.view",
    "pos.order.confirm",
    "pos.kitchen.view",
    "pos.kitchen.update"
];

const _permSeed = () => ({
    supervisor: ["inventory.dashboard.view", "inventory.barang.read", "inventory.supplier.read", "inventory.pembelian.read", "inventory.report.view"],
    operator:   ["inventory.barang.create", "inventory.pembelian.create", "inventory.stock.adjust"],
    admin:      ["inventory.barang.update", "inventory.barang.create", "inventory.supplier.create", "inventory.supplier.update", "inventory.pembelian.approve", "inventory.stock.opname", "inventory.report.export"],
    owner:    ["*"]
});
let rolePermissions = _permSeed();

// ── Permission: Local fallback ──

async function getRolePermissionsLocal(roleName) {
    await delay(100);
    return rolePermissions[roleName] || [];
}

async function grantPermissionToRoleLocal(roleName, permission) {
    await delay(100);
    if (!rolePermissions[roleName]) rolePermissions[roleName] = [];
    if (!rolePermissions[roleName].includes(permission)) rolePermissions[roleName].push(permission);
    return true;
}

async function revokePermissionFromRoleLocal(roleName, permission) {
    await delay(100);
    if (!rolePermissions[roleName]) return false;
    const idx = rolePermissions[roleName].indexOf(permission);
    if (idx === -1) return false;
    rolePermissions[roleName].splice(idx, 1);
    return true;
}

async function getRolesWithPermissionsLocal(params = {}) {
    await delay(200);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const scopedRoles = [...roleDefs]; // Roles are global — no company filtering
    const entries = scopedRoles.map(r => ({
        id: r.id, name: r.name, label: r.label, level: r.level,
        permissions: rolePermissions[r.name] || [],
        permissionCount: (rolePermissions[r.name] || []).length
    }));
    const total = entries.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return { data: entries.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

// ── Permission: Public API ──

/**
 * Get roles with their permissions.
 * API: GET /api/permissions/roles
 */
export async function getRolesWithPermissions(params = {}) {
    return apiListFallback("/api/permissions/roles", params, () => getRolesWithPermissionsLocal(params));
}

/**
 * Get permissions for a specific role.
 * API: GET /api/permissions/roles/:roleName
 */
export async function getRolePermissions(roleName) {
    try {
        const result = await apiCall("GET", `/permissions/roles/${roleName}`);
        if (result !== null) return result;
    } catch {
        // fall through
    }
    return getRolePermissionsLocal(roleName);
}

/**
 * Grant a permission to a role.
 * API: POST /api/permissions/grant
 */
export async function grantPermissionToRole(roleName, permission) {
    let ok = false;
    try {
        const result = await apiCall("POST", "/permissions/grant", { roleName, permission });
        if (result !== null && result.success !== false) ok = true;
    } catch {
        // fall through ke lokal
    }
    if (!ok) {
        ok = await grantPermissionToRoleLocal(roleName, permission);
    }
    // Sinkronkan ke permission manager sesi aktif agar Permission.can() langsung akurat
    if (ok) {
        try { Permission.grant(roleName, permission); } catch (e) { console.warn("[Settings] Permission.grant local:", e); }
    }
    return ok;
}

/**
 * Revoke a permission from a role.
 * API: POST /api/permissions/revoke
 */
export async function revokePermissionFromRole(roleName, permission) {
    let ok = false;
    try {
        const result = await apiCall("POST", "/permissions/revoke", { roleName, permission });
        if (result !== null && result.success !== false) ok = true;
    } catch {
        // fall through ke lokal
    }
    if (!ok) {
        ok = await revokePermissionFromRoleLocal(roleName, permission);
    }
    // Sinkronkan ke permission manager sesi aktif agar Permission.can() langsung akurat
    if (ok) {
        try { Permission.revoke(roleName, permission); } catch (e) { console.warn("[Settings] Permission.revoke local:", e); }
    }
    return ok;
}

export function getPermissionGroups() {
    const groups = {};
    PERMISSION_CATALOG.forEach(p => {
        const [resource] = p.split(".");
        if (!groups[resource]) groups[resource] = [];
        groups[resource].push(p);
    });
    return groups;
}


// ═══════════════════════════════════════════════
//  POS App Settings (M3-FIX v19) — per company
// ═══════════════════════════════════════════════

let posSettingsCache = null;

/** True bila error murni jaringan (fetch gagal) — bukan error dari server. */
function _isNetErr(e) {
    return e && typeof e.message === "string" && e.message.includes("Failed to fetch");
}

/**
 * Baca pengaturan aplikasi (taxEnabled) — API-first, fallback cache/default.
 * Dipakai halaman Transaksi → Penjualan (Admin) utk radio Pajak.
 * @returns {Promise<{taxEnabled: boolean}>}
 */
export async function getPosSettings() {
    try {
        const res = await apiCall("GET", "/settings");
        if (res !== null) {
            posSettingsCache = res;
            return res;
        }
    } catch (e) {
        // Error server (mis. 401) diteruskan; hanya jaringan down yg pakai cache
        if (!_isNetErr(e)) throw e;
    }
    return posSettingsCache || { taxEnabled: true };
}

/**
 * Simpan pengaturan aplikasi (taxEnabled). Error server diteruskan ke UI.
 * @param {{taxEnabled: boolean}} data
 * @returns {Promise<{taxEnabled: boolean}>}
 */
export async function setPosSettings(data) {
    const res = await apiCall("PUT", "/settings", data);
    if (res !== null) {
        posSettingsCache = res;
        return res;
    }
    throw new Error("Server tidak tersedia");
}

// ═══════════════════════════════════════════════
//  Transaction Capability (M6.1) — per company
//  Source of truth: backend (Company.transactionTypes).
//  Endpoint: GET/PUT /api/pos/settings/transaction-capabilities
// ═══════════════════════════════════════════════

/**
 * Baca jenis transaksi yang diaktifkan untuk perusahaan (M6.1).
 * @returns {Promise<{transactionTypes: string[]}>}
 */
export async function getTransactionCapabilities() {
    const res = await apiCall("GET", "/pos/settings/transaction-capabilities");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Simpan jenis transaksi yang diaktifkan untuk perusahaan (M6.1).
 * Menerima array (kanonik) ATAU object boolean (M6) — server menormalkan.
 * Error server (mis. validasi) diteruskan ke UI.
 * @param {string[]|object} payload [{ "retail", "fnb" } | { retail: true, fnb: true }]
 * @returns {Promise<{transactionTypes: string[]}>}
 */
export async function setTransactionCapabilities(payload) {
    const body = Array.isArray(payload)
        ? { transactionTypes: payload }
        : payload;
    const res = await apiCall("PUT", "/pos/settings/transaction-capabilities", body);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

// ═══════════════════════════════════════════════
//  WhatsApp Gateway (F&B V1) — Settings → Konfigurasi WA
//  Endpoint: GET/PUT /api/pos/settings/wa
//  Secret key TIDAK dikembalikan server (hanya hasSecretKey) — admin
//  mengganti dengan mengetik nilai baru; kosong = pertahankan existing.
// ═══════════════════════════════════════════════

/**
 * Baca konfigurasi gateway WhatsApp (provider URL, secret ada/tidak, sender).
 * @returns {Promise<{wa: {providerUrl: string, hasSecretKey: boolean, senderNumber: string}}>}
 */
export async function getWaSettings() {
    const res = await apiCall("GET", "/pos/settings/wa");
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Simpan konfigurasi gateway WhatsApp.
 * @param {object} data { providerUrl?, secretKey?, senderNumber?, clearSecretKey? }
 * @returns {Promise<{wa: object}>}
 */
export async function setWaSettings(data) {
    const res = await apiCall("PUT", "/pos/settings/wa", data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/**
 * Test koneksi gateway WhatsApp — kirim pesan uji coba ke nomor tujuan.
 * Memakai nilai form saat ini (bisa belum disimpan); tidak mengubah DB.
 * @param {object} data { phone, message?, providerUrl?, secretKey?, senderNumber? }
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testWaSettings(data) {
    const res = await apiCall("POST", "/pos/settings/wa/test", data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}
