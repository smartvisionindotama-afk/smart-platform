/**
 * SMART Console — System Information Service.
 *
 * Menyediakan data untuk halaman System Information.
 * Mongo/Server/Node status masih placeholder (belum ada probe) — SP-027 M1.
 *
 * @module console/services/system
 */

import { CONSOLE_CONFIG } from "../config/index.js";

/**
 * Get system information.
 * @returns {Promise<object>}
 */
export async function getSystemInfo() {
    // Placeholder probe (masih UNKNOWN — belum ada health check server)
    return {
        platformVersion: CONSOLE_CONFIG.version,
        buildVersion: CONSOLE_CONFIG.buildVersion,
        environment: CONSOLE_CONFIG.environment,
        apiUrl: CONSOLE_CONFIG.apiUrl,
        mongoStatus: null, // placeholder
        serverStatus: null, // placeholder
        nodeVersion: null // placeholder
    };
}
