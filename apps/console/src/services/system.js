/**
 * SMART Console — System Information Service.
 *
 * SP-027 M1: placeholder. SP-027 M4: status nyata dari Monitoring API
 * (database, server/infrastruktur, node version).
 *
 * @module console/services/system
 */

import { authorizedFetch } from "@smart/api";
import { CONSOLE_CONFIG } from "../config/index.js";
import { getMonitoringOverview } from "./monitoring.js";

/**
 * Get system information.
 * @returns {Promise<object>}
 */
export async function getSystemInfo() {
    let monitoring = null;
    try {
        monitoring = await getMonitoringOverview();
    } catch {
        // Monitoring API tidak tersedia → placeholder (graceful)
    }

    return {
        platformVersion: CONSOLE_CONFIG.version,
        buildVersion: CONSOLE_CONFIG.buildVersion,
        environment: CONSOLE_CONFIG.environment,
        apiUrl: CONSOLE_CONFIG.apiUrl,
        mongoStatus: monitoring?.database?.status || monitoring?.services?.mongodb?.status || null,
        serverStatus: monitoring?.infrastructure?.status || null,
        nodeVersion: monitoring?.infrastructure?.nodeVersion || null
    };
}

/**
 * POST /api/system-password/change — ganti password sudo (OS user) di server.
 *
 * Hanya superadmin. Password dikirim via HTTPS (bukan cookie/URL), tidak pernah
 * dicatat di log server. Memerlukan password sudo saat ini untuk otentikasi.
 *
 * @param {string} currentPassword Password sudo saat ini
 * @param {string} newPassword Password baru (min 10 karakter, huruf+angka)
 * @returns {Promise<object>} { ok, message }
 * @throws {Error} Pesan error dari server
 */
export async function changeSudoPassword(currentPassword, newPassword) {
    const res = await authorizedFetch("/api/system-password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
    }
    return await res.json();
}
