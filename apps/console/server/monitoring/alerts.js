/**
 * Alert Severity Model — fondasi alert (SP-027 M4 §8).
 *
 * Milestone ini belum membangun notification platform penuh; yang disiapkan:
 *   - Severity: INFO / WARNING / ERROR / CRITICAL
 *   - Pemetaan health state → severity
 *   - Builder event monitoring (dipakai oleh history recorder)
 *
 * Aturan anti false-positive: alert hanya dihasilkan untuk state non-HEALTHY
 * atau transisi (recovery). Health check ringan tidak memicu alert.
 *
 * @module console/server/monitoring/alerts
 */

export const SEVERITY = {
    INFO: "INFO",
    WARNING: "WARNING",
    ERROR: "ERROR",
    CRITICAL: "CRITICAL"
};

/** Health state → severity. */
export function severityForState(state) {
    switch (state) {
        case "DOWN": return SEVERITY.CRITICAL;
        case "DEGRADED": return SEVERITY.ERROR;
        case "WARNING": return SEVERITY.WARNING;
        case "HEALTHY": return SEVERITY.INFO;
        default: return SEVERITY.WARNING; // UNKNOWN → warning ringan
    }
}

/**
 * Build event monitoring (struktur SP-027 M4 §9).
 * @param {object} input
 * @param {string} input.service Nama service (mis. "inventory-api")
 * @param {string} input.metric Nama metrik (mis. "health", "response_time", "cpu", "disk")
 * @param {string} input.status Health state (HEALTHY/WARNING/DEGRADED/DOWN/UNKNOWN)
 * @param {string|number} [input.value] Nilai metrik
 * @param {string} [input.message] Pesan operasional
 * @returns {object} Event monitoring
 */
export function buildMonitoringEvent({ service, metric, status, value = null, message = "" }) {
    return {
        timestamp: Date.now(),
        service: String(service || "unknown"),
        metric: String(metric || "health"),
        status: String(status || "UNKNOWN"),
        value,
        severity: severityForState(status),
        message: String(message || "")
    };
}

export default { SEVERITY, severityForState, buildMonitoringEvent };
