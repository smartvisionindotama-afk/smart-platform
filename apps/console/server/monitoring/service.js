/**
 * Monitoring Service — orchestrator (SP-027 M4).
 *
 * Menjalankan seluruh check (aplikasi, service, database, infrastruktur,
 * proses) secara PARALEL dengan isolasi kegagalan: satu service DOWN tidak
 * menggagalkan yang lain (SP-027 M4 §12). Hasil di-cache singkat agar polling
 * dashboard tidak membanjiri service yang dipantau.
 *
 * @module console/server/monitoring/service
 */

import mongoose from "mongoose";
import { monitoringConfig } from "./config.js";
import { listRegistry, listMonitoredApps } from "./registry.js";
import { checkHttpHealth, checkDatabaseHealth, checkInfrastructure, checkProcesses } from "./checkers.js";
import { combineStates } from "./health.js";
import { generateHistoryEvents, recordEvents } from "./history.js";

/** Cache hasil check terakhir (in-memory). */
let _cache = { at: 0, data: null };

/**
 * Ambil config monitoring (di-inject untuk test).
 * @param {object} [opts]
 * @returns {object}
 */
function getConfig(opts = {}) {
    return opts.config || monitoringConfig();
}

/**
 * Run satu siklus check penuh.
 * @param {object} [opts]
 * @param {boolean} [opts.force=false] Lewati cache
 * @param {object} [opts.config]
 * @param {object} [opts.mongooseImpl]
 * @param {object} [opts.checkers] Override checker (untuk test)
 * @returns {Promise<object>}
 */
export async function runFullCheck(opts = {}) {
    const cfg = getConfig(opts);
    const now = Date.now();
    if (!opts.force && _cache.data && now - _cache.at < cfg.cacheTtlMs) {
        return _cache.data;
    }

    const checkers = opts.checkers || {};
    const http = checkers.checkHttpHealth || checkHttpHealth;
    const dbCheck = checkers.checkDatabaseHealth || checkDatabaseHealth;
    const infra = checkers.checkInfrastructure || checkInfrastructure;
    const procs = checkers.checkProcesses || checkProcesses;

    const env = opts.env || process.env;
    const registry = listRegistry(env);
    const monitored = listMonitoredApps(env);

    // ── Check aplikasi (parallel, isolated) ──
    const appChecks = await Promise.allSettled(
        monitored.map(app => http(app.healthEndpoint, {
            timeoutMs: cfg.checkTimeoutMs,
            warnMs: cfg.responseWarnMs,
            degradedMs: cfg.responseDegradedMs
        }).then(health => ({ app, health })))
    );

    const applications = registry.map(app => {
        if (!app.monitoringEnabled) {
            return {
                id: app.id, name: app.name, domain: app.domain, environment: app.environment,
                status: "UNKNOWN", monitoringEnabled: false,
                responseTime: null, message: "Monitoring nonaktif", httpStatus: null, version: null
            };
        }
        const settled = appChecks.find(r => r.status === "fulfilled" && r.value && r.value.app.id === app.id);
        if (!settled) {
            return {
                id: app.id, name: app.name, domain: app.domain, environment: app.environment,
                status: "UNKNOWN", monitoringEnabled: true,
                responseTime: null, message: "Checker gagal", httpStatus: null, version: null
            };
        }
        const { health } = settled.value;
        return {
            id: app.id, name: app.name, domain: app.domain, environment: app.environment,
            status: health.status, monitoringEnabled: true,
            responseTime: health.responseTime, message: health.message,
            httpStatus: health.httpStatus, version: health.version
        };
    });

    // ── Check service: console-api, inventory-api, mongodb (isolated) ──
    const serviceIds = ["console", "inventory"];
    const serviceChecks = await Promise.allSettled(
        serviceIds.map(id => {
            const app = monitored.find(a => a.id === id);
            if (!app) return Promise.resolve({ status: "UNKNOWN", message: "Tidak terdaftar", responseTime: null });
            return http(app.healthEndpoint, {
                timeoutMs: cfg.checkTimeoutMs,
                warnMs: cfg.responseWarnMs,
                degradedMs: cfg.responseDegradedMs
            });
        })
    );

    const services = {};
    serviceIds.forEach((id, i) => {
        const app = monitored.find(a => a.id === id);
        const settled = serviceChecks[i];
        services[id] = {
            id,
            name: app ? app.name : id,
            status: settled.status === "fulfilled" ? settled.value.status : "UNKNOWN",
            responseTime: settled.status === "fulfilled" ? settled.value.responseTime : null,
            message: settled.status === "fulfilled" ? settled.value.message : "Checker gagal"
        };
    });

    // ── Database (pakai koneksi mongoose server ini) ──
    const database = await dbCheck({ mongooseImpl: opts.mongooseImpl || mongoose, timeoutMs: cfg.checkTimeoutMs });
    services.mongodb = {
        id: "mongodb",
        name: "MongoDB",
        status: database.status,
        responseTime: database.responseTime >= 0 ? database.responseTime : null,
        message: database.message
    };

    // ── Infrastructure & processes (fail-safe: error → UNKNOWN) ──
    let infrastructure;
    try {
        infrastructure = infra({
            diskPaths: cfg.diskPaths,
            thresholds: {
                cpuWarnPct: cfg.cpuWarnPct, cpuDegradedPct: cfg.cpuDegradedPct,
                memoryWarnPct: cfg.memoryWarnPct, memoryDegradedPct: cfg.memoryDegradedPct,
                diskWarnPct: cfg.diskWarnPct, diskDegradedPct: cfg.diskDegradedPct
            }
        });
    } catch (err) {
        infrastructure = { status: "UNKNOWN", message: err.message, cpu: { status: "UNKNOWN" }, memory: { status: "UNKNOWN" }, disk: { worst: "UNKNOWN" }, uptime: { seconds: 0 } };
    }

    let processes;
    try {
        processes = await procs({ timeoutMs: cfg.checkTimeoutMs });
    } catch (err) {
        processes = { available: false, status: "UNKNOWN", processes: [], message: err.message };
    }

    // ── Status platform ──
    const allStates = [
        ...serviceIds.map(id => services[id].status),
        services.mongodb.status,
        infrastructure.status,
        processes.status
    ];
    const platformStatus = combineStates(allStates);

    const summary = {
        registeredApps: registry.length,
        monitoredApps: applications.filter(a => a.monitoringEnabled).length,
        totalApps: applications.filter(a => a.monitoringEnabled).length,
        healthy: applications.filter(a => a.monitoringEnabled && a.status === "HEALTHY").length,
        warning: applications.filter(a => a.monitoringEnabled && a.status === "WARNING").length,
        degraded: applications.filter(a => a.monitoringEnabled && a.status === "DEGRADED").length,
        down: applications.filter(a => a.monitoringEnabled && a.status === "DOWN").length,
        unknown: applications.filter(a => a.monitoringEnabled && a.status === "UNKNOWN").length
    };

    const result = {
        timestamp: now,
        status: platformStatus,
        summary,
        applications,
        services,
        database,
        infrastructure,
        processes
    };

    // ── History (fail-open) ──
    try {
        const checkList = [
            ...serviceIds.map(id => ({ service: `${id}-api`, metric: "health", status: services[id].status, value: services[id].responseTime, message: services[id].message })),
            { service: "mongodb", metric: "health", status: services.mongodb.status, value: services.mongodb.responseTime, message: services.mongodb.message },
            { service: "infrastructure", metric: "infra", status: infrastructure.status, message: infrastructure.message || "" },
            { service: "process-manager", metric: "pm2", status: processes.status, message: processes.message || "" }
        ];
        const events = await generateHistoryEvents(checkList);
        if (events.length) {
            await recordEvents(events, opts);
        }
    } catch (err) {
        console.warn("[Monitoring] Gagal proses history:", err.message);
    }

    _cache = { at: Date.now(), data: result };
    return result;
}

/**
 * Kontrak health platform (SP-027 M4 §5) — reusable.
 * @param {object} [opts]
 * @returns {Promise<{status: string, timestamp: number, services: object}>}
 */
export async function platformHealth(opts = {}) {
    const full = await runFullCheck({ force: true, ...opts });
    const services = {};
    for (const [id, s] of Object.entries(full.services)) {
        services[id] = s.status;
    }
    return { status: full.status, timestamp: full.timestamp, services };
}

export default { runFullCheck, platformHealth };
