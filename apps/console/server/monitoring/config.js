/**
 * Monitoring Configuration — env-driven, defaults aman (SP-027 M4).
 *
 * Seluruh parameter monitoring dapat di-set via environment variable.
 * Default dipilih agar tidak agresif (hindari false positive).
 *
 * @module console/server/monitoring/config
 */

function parseIntSafe(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Build monitoring config.
 * @param {object} [env] Environment (default process.env)
 * @returns {object}
 */
export function monitoringConfig(env = process.env) {
    return {
        // Timeout & threshold response time (ms)
        checkTimeoutMs: parseIntSafe(env.MONITORING_CHECK_TIMEOUT_MS, 3000),
        responseWarnMs: parseIntSafe(env.MONITORING_RESPONSE_WARN_MS, 500),
        responseDegradedMs: parseIntSafe(env.MONITORING_RESPONSE_DEGRADED_MS, 1500),

        // Threshold resource (%)
        cpuWarnPct: parseIntSafe(env.MONITORING_CPU_WARN_PCT, 100), // load1 per-core × 100
        cpuDegradedPct: parseIntSafe(env.MONITORING_CPU_DEGRADED_PCT, 200),
        memoryWarnPct: parseIntSafe(env.MONITORING_MEMORY_WARN_PCT, 80),
        memoryDegradedPct: parseIntSafe(env.MONITORING_MEMORY_DEGRADED_PCT, 90),
        diskWarnPct: parseIntSafe(env.MONITORING_DISK_WARN_PCT, 80),
        diskDegradedPct: parseIntSafe(env.MONITORING_DISK_DEGRADED_PCT, 90),

        // Retensi history (hari) — jangan simpan tanpa batas
        retentionDays: parseIntSafe(env.MONITORING_RETENTION_DAYS, 7),

        // Cache hasil check (ms) agar polling dashboard tidak membanjiri service
        cacheTtlMs: parseIntSafe(env.MONITORING_CACHE_TTL_MS, 4000),

        // Path disk yang dipantau
        diskPaths: (env.MONITORING_DISK_PATHS || "/,/srv")
            .split(",").map(s => s.trim()).filter(Boolean)
    };
}

export default monitoringConfig;
