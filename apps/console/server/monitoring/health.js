/**
 * Health States & Classification — SP-027 M4.
 *
 * Status konsisten di seluruh monitoring:
 *   HEALTHY   — normal
 *   WARNING   — mulai melambat / penggunaan resource tinggi (belum kritis)
 *   DEGRADED  — performa buruk / resource sangat tinggi
 *   DOWN      — tidak dapat dijangkau / gagal
 *   UNKNOWN   — belum dicek / checker tidak tersedia
 *
 * Fungsi-fungsi di sini PURE — mudah di-unit-test tanpa dependensi.
 *
 * @module console/server/monitoring/health
 */

export const HEALTH_STATES = ["HEALTHY", "WARNING", "DEGRADED", "DOWN", "UNKNOWN"];

/** Ranking untuk memilih status terburuk. */
export const STATE_RANK = { HEALTHY: 0, UNKNOWN: 1, WARNING: 2, DEGRADED: 3, DOWN: 4 };

/**
 * Gabungkan beberapa status → status platform keseluruhan (worst-wins).
 * Case-insensitive (kontrak contoh memakai lowercase "healthy").
 * @param {string[]} states
 * @returns {string}
 */
export function combineStates(states = []) {
    let worst = "HEALTHY";
    for (const s of states) {
        if (!s) continue;
        const norm = String(s).toUpperCase();
        if ((STATE_RANK[norm] ?? -1) > STATE_RANK[worst]) {
            worst = norm;
        }
    }
    return worst;
}

/**
 * Klasifikasi status HTTP check berdasarkan response time.
 * @param {number} responseTimeMs
 * @param {number} [warnMs=500]
 * @param {number} [degradedMs=1500]
 * @returns {"HEALTHY"|"WARNING"|"DEGRADED"}
 */
export function classifyHttp(responseTimeMs, warnMs = 500, degradedMs = 1500) {
    const t = Number(responseTimeMs) || 0;
    if (t >= degradedMs) return "DEGRADED";
    if (t >= warnMs) return "WARNING";
    return "HEALTHY";
}

/**
 * Klasifikasi penggunaan resource (persen) berdasarkan threshold.
 * @param {number} usagePct
 * @param {number} [warnPct=80]
 * @param {number} [degradedPct=90]
 * @returns {"HEALTHY"|"WARNING"|"DEGRADED"}
 */
export function classifyResource(usagePct, warnPct = 80, degradedPct = 90) {
    const v = Number(usagePct) || 0;
    if (v >= degradedPct) return "DEGRADED";
    if (v >= warnPct) return "WARNING";
    return "HEALTHY";
}

/**
 * Status health-check contract yang reusable (SP-027 M4 §5).
 * @param {object} parts
 * @param {object} [parts.services] Map { serviceId: status }
 * @returns {{ status: string, timestamp: number, services: object }}
 */
export function platformHealthContract(parts = {}) {
    const services = parts.services || {};
    const status = combineStates(Object.values(services));
    return {
        status,
        timestamp: Date.now(),
        services
    };
}

export default {
    HEALTH_STATES,
    STATE_RANK,
    combineStates,
    classifyHttp,
    classifyResource,
    platformHealthContract
};
