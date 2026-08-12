/**
 * Application Registry Loader — SP-027 M4 §6.
 *
 * Memuat registry default (apps.config.js) + memperbolehkan override/perluasan
 * via env `MONITORING_APPS_JSON` (array JSON; id yang sama menimpa, id baru
 * ditambahkan). Dengan ini aplikasi baru bisa ditambahkan tanpa redesign dan
 * tanpa ubah kode — cukup konfigurasi.
 *
 * @module console/server/monitoring/registry
 */

import { MONITORING_APPS } from "./apps.config.js";

/**
 * Normalisasi entri registry.
 * @param {object} app
 * @returns {object}
 */
export function normalizeApp(app = {}) {
    return {
        id: String(app.id || app.slug || ""),
        name: app.name || app.id || app.slug || "Unknown",
        domain: app.domain || "",
        environment: app.environment || "unknown",
        healthEndpoint: app.healthEndpoint || "",
        apiEndpoint: app.apiEndpoint || "",
        status: app.status === "inactive" ? "inactive" : "active",
        monitoringEnabled: app.monitoringEnabled !== false && app.status !== "inactive"
            ? Boolean(app.healthEndpoint)
            : false
    };
}

/**
 * List registry aplikasi (default + env override).
 * @param {object} [env] Environment (default process.env)
 * @returns {object[]}
 */
export function listRegistry(env = process.env) {
    let apps = MONITORING_APPS.map(normalizeApp);

    const raw = env.MONITORING_APPS_JSON;
    if (raw && typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const byId = new Map(apps.map(a => [a.id, a]));
                for (const item of parsed) {
                    const norm = normalizeApp(item);
                    if (!norm.id) continue;
                    byId.set(norm.id, norm); // timpa atau tambah
                }
                apps = [...byId.values()];
            } else {
                console.warn("[Monitoring] MONITORING_APPS_JSON bukan array — diabaikan");
            }
        } catch (err) {
            console.warn("[Monitoring] Gagal parse MONITORING_APPS_JSON:", err.message);
        }
    }

    return apps;
}

/**
 * Aplikasi yang benar-benar dipantau (monitoringEnabled).
 * @param {object} [env]
 * @returns {object[]}
 */
export function listMonitoredApps(env = process.env) {
    return listRegistry(env).filter(a => a.monitoringEnabled);
}

export default { normalizeApp, listRegistry, listMonitoredApps };
