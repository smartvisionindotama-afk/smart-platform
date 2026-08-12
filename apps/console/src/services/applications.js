/**
 * SMART Console — Applications Service (API-first).
 *
 * SP-027 PRE-M5 round 5: aplikasi platform kini disimpan di MongoDB
 * (model Application, route /api/applications) — service ini memakai API
 * sebagai sumber kebenaran, dengan fallback in-memory hanya saat server
 * tidak tersedia (pola sama seperti services/companies.js).
 *
 * Registry awal (APPS_REGISTRY) menjadi seed server, bukan satu-satunya
 * sumber — aplikasi baru bisa ditambahkan via UI dan PERSISTEN.
 *
 * @module console/services/applications
 */

import { apiListFallback, apiGetFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback } from "@smart/api";
import { APPS_REGISTRY } from "../config/index.js";

// ── In-memory fallback (hanya jika server tidak tersedia) ──

const _apps = APPS_REGISTRY.map(a => ({ ...a }));

function delay(ms = 150) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function listApplicationsLocal(params = {}) {
    await delay(120);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    const status = params.status || "all";

    let filtered = [..._apps];
    if (search) {
        filtered = filtered.filter(a =>
            a.name.toLowerCase().includes(search) ||
            a.slug.toLowerCase().includes(search) ||
            a.code.toLowerCase().includes(search) ||
            a.description.toLowerCase().includes(search)
        );
    }
    if (status === "active") filtered = filtered.filter(a => a.active);
    if (status === "inactive") filtered = filtered.filter(a => !a.active);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return {
        data: filtered.slice(start, start + limit),
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

async function getApplicationLocal(slug) {
    await delay(80);
    return _apps.find(a => a.slug === slug) || null;
}

async function createApplicationLocal(data) {
    await delay(150);
    const slug = String(data.slug || "").trim().toLowerCase();
    if (!slug) throw new Error("Slug aplikasi wajib diisi");
    if (_apps.find(a => a.slug === slug)) {
        throw new Error(`Slug \"${slug}\" sudah digunakan`);
    }
    const item = {
        slug,
        name: data.name || "",
        code: data.code || "",
        icon: data.icon || "📦",
        description: data.description || "",
        domain: data.domain || "",
        version: data.version || "0.1.0",
        active: data.active !== false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    _apps.unshift(item);
    return { ...item };
}

async function updateApplicationLocal(slug, data) {
    await delay(150);
    const idx = _apps.findIndex(a => a.slug === slug);
    if (idx === -1) return null;
    _apps[idx] = { ..._apps[idx], ...data, slug, updatedAt: Date.now() };
    return { ..._apps[idx] };
}

async function toggleApplicationLocal(slug) {
    await delay(120);
    const idx = _apps.findIndex(a => a.slug === slug);
    if (idx === -1) return null;
    _apps[idx].active = !_apps[idx].active;
    return { ..._apps[idx] };
}

async function deleteApplicationLocal(slug) {
    await delay(120);
    const idx = _apps.findIndex(a => a.slug === slug);
    if (idx === -1) return false;
    _apps.splice(idx, 1);
    return true;
}

// ── Public API (server-first) ──

/**
 * List aplikasi dengan search, filter status, pagination.
 * @param {object} [params]
 * @returns {Promise<{data: object[], pagination: object}>}
 */
export async function listApplications(params = {}) {
    return apiListFallback("/api/applications", params, () => listApplicationsLocal(params));
}

/**
 * Get single app by slug.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function getApplication(slug) {
    return apiGetFallback("/api/applications", slug, () => getApplicationLocal(slug));
}

/**
 * Buat aplikasi baru (persisten di server).
 * @param {object} data { slug, name, code, icon, description, domain, version, active }
 * @returns {Promise<object>}
 */
export async function createApplication(data) {
    return apiCreateFallback("/api/applications", data, () => createApplicationLocal(data));
}

/**
 * Update aplikasi (persisten di server).
 * @param {string} slug
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateApplication(slug, data) {
    return apiUpdateFallback("/api/applications", slug, data, () => updateApplicationLocal(slug, data));
}

/**
 * Toggle status active aplikasi (persisten di server).
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function toggleApplication(slug) {
    const current = await getApplication(slug);
    if (!current) return null;
    return updateApplication(slug, { active: !current.active });
}

/**
 * Hapus aplikasi (persisten di server). Ditolak server bila masih
 * terhubung ke perusahaan.
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
export async function deleteApplication(slug) {
    return apiDeleteFallback("/api/applications", slug, () => deleteApplicationLocal(slug));
}

/**
 * Get total count of applications.
 * @returns {Promise<number>}
 */
export async function countApplications() {
    try {
        const res = await listApplications({ page: 1, limit: 1 });
        return res?.pagination?.total ?? 0;
    } catch {
        return _apps.length;
    }
}
