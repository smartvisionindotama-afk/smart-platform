/**
 * Health Checkers — SP-027 M4.
 *
 * Setiap checker INDEPENDEN dan fail-safe:
 *   - Kegagalan SATU checker tidak boleh menggagalkan yang lain.
 *   - Timeout diterapkan di semua operasi I/O (hindari hang).
 *   - Implementasi di-inject (fetchImpl/osImpl/statfsImpl/execImpl) agar
 *     unit-testable tanpa jaringan/OS asli.
 *
 * @module console/server/monitoring/checkers
 */

import os from "os";
import fs from "fs";
import { execFile } from "child_process";
import { classifyHttp, classifyResource } from "./health.js";

/**
 * HTTP health check (aplikasi / API).
 * @param {string} endpoint URL health endpoint
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=3000]
 * @param {number} [opts.warnMs=500]
 * @param {number} [opts.degradedMs=1500]
 * @param {Function} [opts.fetchImpl]
 * @returns {Promise<{status: string, responseTime: number, message: string, httpStatus: number|null}>}
 */
export async function checkHttpHealth(endpoint, opts = {}) {
    const {
        timeoutMs = 3000,
        warnMs = 500,
        degradedMs = 1500,
        fetchImpl = globalThis.fetch
    } = opts;

    const start = Date.now();
    let res;
    try {
        const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
            ? AbortSignal.timeout(timeoutMs)
            : undefined;
        // redirect: "manual" — jangan ikuti redirect (defense-in-depth SSRF:
        // endpoint health milik operator TIDAK boleh mengarahkan server ke
        // alamat internal lain). 3xx diperlakukan sebagai DOWN.
        res = await fetchImpl(endpoint, { signal, redirect: "manual" });
    } catch (err) {
        return {
            status: "DOWN",
            responseTime: Date.now() - start,
            message: err?.name === "TimeoutError" ? "Timeout" : "Endpoint tidak dapat dijangkau",
            httpStatus: null
        };
    }

    let ok = res.ok;
    let httpStatus = res.status;
    if (httpStatus >= 300 && httpStatus < 400) {
        return { status: "DOWN", responseTime: Date.now() - start, message: `HTTP ${httpStatus} (redirect tidak diikuti)`, httpStatus };
    }
    let body = null;
    try {
        body = await res.json();
    } catch { /* non-JSON body — pakai status HTTP saja */ }

    // Health contract: body.status harus "ok"/"healthy" bila ada
    if (body && typeof body.status === "string" && !["ok", "healthy"].includes(body.status)) {
        ok = false;
    }

    const responseTime = Date.now() - start;
    if (!ok) {
        return { status: "DOWN", responseTime, message: `HTTP ${httpStatus}`, httpStatus };
    }
    const state = classifyHttp(responseTime, warnMs, degradedMs);
    return {
        status: state,
        responseTime,
        message: `HTTP ${httpStatus} dalam ${responseTime}ms`,
        httpStatus,
        version: body?.version || null
    };
}

/**
 * Database (MongoDB) health check — ping ringan, tidak ada query berat.
 * @param {object} [opts]
 * @param {object} [opts.mongooseImpl] Mongoose instance (default: import)
 * @param {number} [opts.timeoutMs=3000]
 * @returns {Promise<{status: string, responseTime: number, message: string, readyState: number}>}
 */
export async function checkDatabaseHealth(opts = {}) {
    const { mongooseImpl = null, timeoutMs = 3000 } = opts;
    if (!mongooseImpl || !mongooseImpl.connection || !mongooseImpl.connection.db) {
        return { status: "DOWN", responseTime: -1, message: "Koneksi database tidak tersedia", readyState: 0 };
    }
    try {
        const start = Date.now();
        const result = await Promise.race([
            mongooseImpl.connection.db.admin().command({ ping: 1 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
        ]);
        const responseTime = Date.now() - start;
        if (result && result.ok === 1) {
            return {
                status: classifyHttp(responseTime, 500, 1500),
                responseTime,
                message: `MongoDB ping OK dalam ${responseTime}ms`,
                readyState: mongooseImpl.connection.readyState
            };
        }
        return { status: "DOWN", responseTime, message: "Ping tidak mengembalikan ok", readyState: mongooseImpl.connection.readyState };
    } catch (err) {
        return { status: "DOWN", responseTime: -1, message: err.message || "Gagal ping database", readyState: 0 };
    }
}

/**
 * Infrastructure health check (CPU / memory / disk / load / uptime).
 * @param {object} [opts]
 * @param {object} [opts.osImpl]
 * @param {Function} [opts.statfsImpl] fs.statfsSync
 * @param {string[]} [opts.diskPaths]
 * @param {object} [opts.thresholds] { cpuWarnPct, cpuDegradedPct, memoryWarnPct, memoryDegradedPct, diskWarnPct, diskDegradedPct }
 * @returns {object} Infrastructure metrics + status
 */
export function checkInfrastructure(opts = {}) {
    const {
        osImpl = os,
        statfsImpl = fs.statfsSync,
        diskPaths = ["/"],
        thresholds = {}
    } = opts;

    const {
        cpuWarnPct = 100, cpuDegradedPct = 200,
        memoryWarnPct = 80, memoryDegradedPct = 90,
        diskWarnPct = 80, diskDegradedPct = 90
    } = thresholds;

    const cores = osImpl.cpus().length || 1;
    const loadAvg = osImpl.loadavg() || [0, 0, 0];
    const load1 = loadAvg[0] / cores;
    const load5 = loadAvg[1] / cores;
    const load15 = loadAvg[2] / cores;

    const totalMem = osImpl.totalmem() || 0;
    const freeMem = osImpl.freemem() ?? totalMem;
    const usedMem = Math.max(0, totalMem - freeMem);
    const memPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;

    const disks = [];
    for (const p of diskPaths) {
        try {
            const st = statfsImpl(p);
            const total = st.blocks * st.bsize;
            const free = st.bfree * st.bsize;
            const used = Math.max(0, total - free);
            const pct = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
            disks.push({
                path: p,
                totalBytes: total,
                usedBytes: used,
                freeBytes: free,
                usagePct: pct,
                status: classifyResource(pct, diskWarnPct, diskDegradedPct)
            });
        } catch {
            disks.push({ path: p, status: "UNKNOWN", message: "tidak dapat dibaca" });
        }
    }
    const diskStates = disks.map(d => d.status).filter(s => s !== "UNKNOWN");

    const cpuStatus = classifyResource(load1 * 100, cpuWarnPct, cpuDegradedPct);
    const memStatus = classifyResource(memPct, memoryWarnPct, memoryDegradedPct);
    const diskStatus = diskStates.length ? diskStates.sort((a, b) => (STATE_RANK_ASC[a] ?? 0) - (STATE_RANK_ASC[b] ?? 0)).pop() : "UNKNOWN";

    return {
        cpu: { cores, load1, load5, load15, status: cpuStatus },
        memory: { totalBytes: totalMem, usedBytes: usedMem, freeBytes: freeMem, usagePct: memPct, status: memStatus },
        disk: { disks, worst: diskStatus },
        uptime: { seconds: osImpl.uptime() || 0 },
        nodeVersion: typeof process !== "undefined" ? process.version : null,
        status: worstOf([cpuStatus, memStatus, diskStatus])
    };
}

/** Ranking status untuk worst-wins. */
const STATE_RANK_ASC = { HEALTHY: 0, UNKNOWN: 1, WARNING: 2, DEGRADED: 3, DOWN: 4 };

function worstOf(states) {
    let worst = "HEALTHY";
    for (const s of states) {
        if ((STATE_RANK_ASC[s] ?? -1) > (STATE_RANK_ASC[worst] ?? -1)) worst = s;
    }
    return worst;
}

/**
 * Process (PM2) health check — pm2 jlist.
 * @param {object} [opts]
 * @param {Function} [opts.execImpl] child_process.execFile
 * @param {string} [opts.pm2Name] "pm2"
 * @param {number} [opts.timeoutMs=3000]
 * @returns {Promise<{available: boolean, status: string, processes: object[], message?: string}>}
 */
export function checkProcesses(opts = {}) {
    const {
        execImpl = execFile,
        pm2Name = "pm2",
        timeoutMs = 3000
    } = opts;

    return new Promise(resolve => {
        execImpl(pm2Name, ["jlist"], { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
            if (err) {
                return resolve({ available: false, status: "UNKNOWN", processes: [], message: "PM2 tidak tersedia" });
            }
            try {
                const list = JSON.parse(stdout);
                if (!Array.isArray(list)) {
                    return resolve({ available: false, status: "UNKNOWN", processes: [], message: "Respons PM2 tidak valid" });
                }
                const processes = list.map(p => {
                    const env = p.pm2_env || {};
                    const rawStatus = String(env.status || "unknown").toLowerCase();
                    const status = rawStatus === "online" ? "ONLINE"
                        : rawStatus === "stopped" ? "STOPPED"
                            : rawStatus === "errored" ? "ERRORED"
                                : rawStatus === "launching" ? "LAUNCHING"
                                    : String(env.status || "UNKNOWN").toUpperCase();
                    const num = v => {
                        const n = Number(v);
                        return Number.isFinite(n) ? n : null;
                    };
                    return {
                        name: p.name,
                        status,
                        pid: p.pid != null ? num(p.pid) : null,
                        cpu: env.cpu != null ? Math.round((num(env.cpu) ?? 0) * 10) / 10 : null,
                        memory: env.memory != null ? num(env.memory) : null,
                        uptimeMs: env.pm_uptime ? Math.max(0, Date.now() - num(env.pm_uptime)) : null,
                        restarts: env.restart_time != null ? num(env.restart_time) : null,
                        version: env.version || null
                    };
                });
                const nonOnline = processes.filter(p => p.status !== "ONLINE");
                const status = nonOnline.length === 0 ? "HEALTHY"
                    : nonOnline.length === processes.length && processes.length > 0 ? "DOWN"
                        : "WARNING";
                resolve({ available: true, status, processes });
            } catch (parseErr) {
                resolve({ available: false, status: "UNKNOWN", processes: [], message: "Gagal parse output PM2" });
            }
        });
    });
}

export default { checkHttpHealth, checkDatabaseHealth, checkInfrastructure, checkProcesses };
