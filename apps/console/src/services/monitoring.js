/**
 * SMART Console — Monitoring Center Service (SP-027 M4).
 *
 * Mengambil data monitoring dari API Console (apps/console/server),
 * bukan dari business API Inventory (Golden Rule 3).
 *
 * @module console/services/monitoring
 */

import { authorizedFetch } from "@smart/api";

const API_BASE = "/api/monitoring";

/** Request helper: 401/error → throw dengan pesan. */
async function getJson(path) {
    const res = await authorizedFetch(`${API_BASE}${path}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Monitoring API error: ${res.status}`);
    }
    return res.json();
}

/**
 * Ringkasan platform lengkap (dashboard).
 * @param {boolean} [force] Force fresh check (default: server-side cache)
 * @returns {Promise<object>}
 */
export async function getMonitoringOverview() {
    return getJson("/overview");
}

/**
 * Health aplikasi (registry).
 * @returns {Promise<object>}
 */
export async function getMonitoringApplications() {
    return getJson("/applications");
}

/**
 * Health service (console-api, inventory-api, mongodb).
 * @returns {Promise<object>}
 */
export async function getMonitoringServices() {
    return getJson("/services");
}

/**
 * Infrastruktur (CPU/RAM/Disk/Load/Uptime).
 * @returns {Promise<object>}
 */
export async function getMonitoringInfrastructure() {
    return getJson("/infrastructure");
}

/**
 * Health MongoDB.
 * @returns {Promise<object>}
 */
export async function getMonitoringDatabase() {
    return getJson("/database");
}

/**
 * Status proses (PM2).
 * @returns {Promise<object>}
 */
export async function getMonitoringProcesses() {
    return getJson("/processes");
}

/**
 * Event monitoring terbaru (retensi TTL).
 * @param {number} [limit=50]
 * @returns {Promise<object>}
 */
export async function getMonitoringHistory(limit = 50) {
    return getJson(`/history?limit=${encodeURIComponent(limit)}`);
}

// ── Auto refresh settings (SP-027 M4 §10) ──

const REFRESH_KEY = "smart_monitoring_refresh_seconds";
const DEFAULT_REFRESH = 30;

/** Opsi interval refresh (detik) — konfigurable, default 30s. */
export const REFRESH_OPTIONS = [15, 30, 60, 120];

/**
 * Interval refresh aktif (detik).
 * @returns {number}
 */
export function getRefreshInterval() {
    try {
        const v = parseInt(localStorage.getItem(REFRESH_KEY), 10);
        if (REFRESH_OPTIONS.includes(v)) return v;
    } catch { /* localStorage unavailable */ }
    return DEFAULT_REFRESH;
}

/**
 * Simpan interval refresh.
 * @param {number} seconds
 */
export function setRefreshInterval(seconds) {
    try {
        localStorage.setItem(REFRESH_KEY, String(seconds));
    } catch { /* localStorage unavailable */ }
}

export default {
    getMonitoringOverview,
    getMonitoringApplications,
    getMonitoringServices,
    getMonitoringInfrastructure,
    getMonitoringDatabase,
    getMonitoringProcesses,
    getMonitoringHistory,
    REFRESH_OPTIONS,
    getRefreshInterval,
    setRefreshInterval
};
