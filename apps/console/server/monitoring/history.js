/**
 * Monitoring History Recorder — SP-027 M4 §9.
 *
 * Menyimpan event monitoring ke collection `monitoringevents` (model
 * MonitoringEvent). Tujuan:
 *   - Hanya mencatat yang bermakna: state non-HEALTHY ATAU transisi state
 *     (termasuk recovery → INFO). Health check normal yang sehat tidak
 *     membanjiri history (anti false-positive & noise).
 *   - Fail-open: kegagalan menulis history TIDAK boleh menggagalkan monitoring.
 *   - Retensi via TTL index (MONITORING_RETENTION_DAYS).
 *
 * @module console/server/monitoring/history
 */

import { buildMonitoringEvent } from "./alerts.js";

/** State per-service terakhir (in-memory) untuk deteksi transisi. */
const _prevStates = new Map();

/**
 * Rekam transisi state dan kembalikan state sebelumnya (undefined jika baru).
 * @param {string} service
 * @param {string} state
 * @returns {string|undefined} State sebelumnya
 */
export function recordTransition(service, state) {
    const key = String(service);
    const prev = _prevStates.get(key);
    _prevStates.set(key, String(state || "UNKNOWN"));
    return prev;
}

/**
 * Bandingkan state baru vs state terakhir. Return true jika berubah.
 * @param {string} service
 * @param {string} state
 * @returns {boolean}
 */
export function stateChanged(service, state) {
    const prev = recordTransition(service, state);
    return prev !== undefined && prev !== String(state || "UNKNOWN");
}

/**
 * Rekam event (fail-open, batasi ukuran batch).
 * @param {object[]} events
 * @param {object} [opts]
 * @param {object} [opts.Model] MonitoringEvent model (default: lazy import)
 * @returns {Promise<number>} Jumlah tersimpan (0 jika gagal)
 */
export async function recordEvents(events = [], opts = {}) {
    if (!Array.isArray(events) || events.length === 0) return 0;
    let Model = opts.Model;
    if (!Model) {
        const { MonitoringEvent } = await import("../models/MonitoringEvent.js");
        Model = MonitoringEvent;
    }
    // Jangan biarkan insertMany menunggu koneksi selamanya (mongoose buffering)
    if (!Model.db || Model.db.readyState !== 1) {
        return 0;
    }
    try {
        const docs = events.slice(0, 50).map(e => buildMonitoringEvent(e));
        const result = await Model.insertMany(docs, { ordered: false });
        return Array.isArray(result) ? result.length : 0;
    } catch (err) {
        console.warn("[Monitoring] Gagal menyimpan history:", err.message);
        return 0;
    }
}

/**
 * Generate event yang harus direkam dari hasil check.
 * Aturan ANTI-FLOOD (SP-027 M4 §8/§9 — hindari false positive & noise):
 *   - Rekam hanya pada TRANSISI state (atau observasi pertama state non-HEALTHY).
 *   - State non-HEALTHY yang bertahan lama TIDAK direkam berulang tiap siklus
 *     (satu insiden = satu event; retensi TTL membersihkan sisanya).
 *   - Recovery (transisi → HEALTHY) direkam sebagai INFO.
 * @param {object} checks Hasil runFullCheck (array berisi { service, status, metric, value, message })
 * @returns {Promise<object[]>} Events untuk direkam
 */
export async function generateHistoryEvents(checks = []) {
    const events = [];
    for (const c of checks) {
        if (!c || !c.service) continue;
        const state = String(c.status || "UNKNOWN");
        const prev = recordTransition(c.service, state);
        const isNewOrChanged = prev === undefined || prev !== state;

        if (state !== "HEALTHY") {
            if (isNewOrChanged) {
                // Observasi baru / transisi ke non-HEALTHY → satu event per insiden
                events.push({
                    service: c.service,
                    metric: c.metric || "health",
                    status: state,
                    value: c.value ?? null,
                    message: c.message || `${c.service} ${state}`
                });
            }
        } else if (isNewOrChanged && prev !== undefined) {
            // Transisi → HEALTHY (recovery)
            events.push({
                service: c.service,
                metric: c.metric || "health",
                status: "HEALTHY",
                value: c.value ?? null,
                message: `${c.service} pulih`
            });
        }
    }
    return events;
}

/**
 * Ambil history terbaru.
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @param {object} [opts.Model]
 * @returns {Promise<object[]>}
 */
export async function listRecentHistory(opts = {}) {
    const { limit = 50, Model } = opts;
    let M = Model;
    if (!M) {
        const { MonitoringEvent } = await import("../models/MonitoringEvent.js");
        M = MonitoringEvent;
    }
    if (!M.db || M.db.readyState !== 1) {
        return [];
    }
    try {
        const docs = await M.find({}).sort({ timestamp: -1 }).limit(Math.min(Math.max(limit, 1), 200)).lean();
        return docs.map(d => ({
            id: String(d._id),
            timestamp: d.timestamp,
            service: d.service,
            metric: d.metric,
            status: d.status,
            value: d.value,
            severity: d.severity,
            message: d.message
        }));
    } catch (err) {
        console.warn("[Monitoring] Gagal membaca history:", err.message);
        return [];
    }
}

export default { stateChanged, recordEvents, generateHistoryEvents, listRecentHistory };
