/**
 * SMART Console — Applications Service (mock repository).
 *
 * SP-027 M1: "Data masih boleh menggunakan mock repository."
 * Registry dasar diambil dari config (APPS_REGISTRY), mutable di memori.
 *
 * @module console/services/applications
 */

import { APPS_REGISTRY } from "../config/index.js";

// ── In-memory repository ──

const _apps = APPS_REGISTRY.map(a => ({ ...a }));

function delay(ms = 150) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * List aplikasi dengan search, filter status, dan pagination.
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.search]
 * @param {string} [params.status="all"] "all" | "active" | "inactive"
 * @returns {Promise<{data: object[], pagination: object}>}
 */
export async function listApplications(params = {}) {
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

/**
 * Get single app by slug.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function getApplication(slug) {
    await delay(80);
    return _apps.find(a => a.slug === slug) || null;
}

/**
 * Update application fields (edit).
 * @param {string} slug
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateApplication(slug, data) {
    await delay(150);
    const idx = _apps.findIndex(a => a.slug === slug);
    if (idx === -1) return null;
    _apps[idx] = { ..._apps[idx], ...data, slug };
    return { ..._apps[idx] };
}

/**
 * Toggle active status aplikasi.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function toggleApplication(slug) {
    await delay(120);
    const idx = _apps.findIndex(a => a.slug === slug);
    if (idx === -1) return null;
    _apps[idx].active = !_apps[idx].active;
    return { ..._apps[idx] };
}

/**
 * Get total count of applications.
 * @returns {Promise<number>}
 */
export async function countApplications() {
    return _apps.length;
}
