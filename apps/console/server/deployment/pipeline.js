/**
 * Deployment Pipeline — controlled execution (SP-027 M5 §19, §23, §24).
 *
 * GOLDEN RULE M5: DILARANG arbitrary shell execution.
 *
 *   DILARANG: execute(commandFromUser)
 *
 * Command hanya berasal dari TRUSTED APPLICATION CONFIGURATION (field
 * Application.buildCommand / testCommand / startCommand) dan diproses
 * melalui ALLOWLIST program + argumen, dengan cwd terbatas pada direktori
 * workspace yang diizinkan. Super Admin memilih Application + Environment
 * + Release — TIDAK memasukkan shell command bebas.
 *
 * Default execution mode: "simulate" (aman) — pipeline mencatat langkah &
 * log yang akan dijalankan tanpa mengeksekusi ke server produksi
 * (SP-027 M5 §25: jangan auto-deploy production hanya untuk menguji M5).
 * Aktifkan eksekusi nyata dengan env DEPLOYMENT_EXECUTION=real untuk
 * environment development saja (staging/production tetap simulate).
 *
 * Verifikasi pasca-deploy: health check NYATA (M4 checkHttpHealth) — sukses
 * hanya jika deploy selesai DAN health check berhasil.
 *
 * @module console/server/deployment/pipeline
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { checkHttpHealth } from "../monitoring/checkers.js";

/** Program yang diizinkan untuk eksekusi (allowlist). */
const ALLOWED_BIN = new Set(["npm", "node", "git", "pm2"]);

/** Direktori kerja yang diizinkan (workspace root project). */
const ALLOWED_CWD = [
    path.resolve(process.env.DEPLOYMENT_WORKSPACE || "/srv")
];

/** Environment yang BOLEH dieksekusi nyata (default: tidak ada → simulate). */
function realExecutionAllowed(environment) {
    if (process.env.DEPLOYMENT_EXECUTION !== "real") return false;
    return environment === "development";
}

/**
 * Validasi command (bin + args) terhadap allowlist — mencegah command
 * injection / arbitrary execution.
 * @param {string} raw Command mentah (dari Application config)
 * @returns {{ ok: boolean, bin?: string, args?: string[], error?: string }}
 */
export function validateCommand(raw) {
    const cmd = String(raw || "").trim();
    if (!cmd) return { ok: false, error: "command kosong" };
    const parts = cmd.split(/\s+/);
    const bin = parts[0];
    if (!ALLOWED_BIN.has(bin)) {
        return { ok: false, error: `program \"${bin}\" tidak diizinkan (allowlist: ${[...ALLOWED_BIN].join(", ")})` };
    }
    // Argumen dibatasi: tidak boleh shell metachar (; | && > < ` $ ( ) *)
    const args = parts.slice(1);
    const dangerous = /[;&|><`$()*\n]/;
    for (const a of args) {
        if (dangerous.test(a)) {
            return { ok: false, error: `argumen \"${a}\" mengandung karakter berbahaya` };
        }
    }
    return { ok: true, bin, args };
}

/**
 * Validasi cwd — harus berada dalam workspace yang diizinkan.
 * @param {string} dir
 * @returns {boolean}
 */
export function validateCwd(dir) {
    if (!dir) return false;
    const resolved = path.resolve(dir);
    return ALLOWED_CWD.some(base => resolved === base || resolved.startsWith(base + path.sep));
}

/**
 * Jalankan command (real) — hanya bila diizinkan; selainnya simulate.
 * @param {string} command
 * @param {string} cwd
 * @param {object} [opts] { timeoutMs, environment }
 * @returns {Promise<{ ok: boolean, simulated: boolean, code: number|null, output: string }>}
 */
export async function runCommand(command, cwd, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 120000;
    const environment = opts.environment || "";
    const v = validateCommand(command);
    if (!v.ok) {
        return { ok: false, simulated: false, code: null, output: `[BLOCKED] ${v.error}` };
    }
    if (!validateCwd(cwd)) {
        return { ok: false, simulated: false, code: null, output: `[BLOCKED] cwd tidak diizinkan: ${cwd}` };
    }

    // Mode simulate: catat apa yang akan dijalankan, tanpa eksekusi nyata.
    // Real execution hanya untuk environment development saat
    // DEPLOYMENT_EXECUTION=real — staging/production SELALU simulate (aman).
    if (!realExecutionAllowed(environment)) {
        return {
            ok: true,
            simulated: true,
            code: 0,
            output: `[SIMULATED] ${command} (cwd: ${cwd}) — eksekusi nyata dinonaktifkan untuk environment \"${environment || "?"}\"`
        };
    }

    return new Promise((resolve) => {
        const child = spawn(v.bin, v.args, { cwd, timeout: timeoutMs });
        let output = "";
        child.stdout.on("data", d => { output += d; });
        child.stderr.on("data", d => { output += d; });
        child.on("error", err => resolve({ ok: false, simulated: false, code: null, output: `[ERROR] ${err.message}` }));
        child.on("close", code => resolve({ ok: code === 0, simulated: false, code, output }));
    });
}

/**
 * Jalankan satu langkah pipeline (deploy/verify/health-check).
 * @param {object} opts
 * @param {object} opts.app Dokumen Application (trusted config)
 * @param {string} opts.environment
 * @param {object} [opts.release]
 * @returns {Promise<{ ok: boolean, log: string, health?: object }>}
 */
export async function runPipelineStep(opts) {
    const { app, environment, release } = opts;
    const cwd = path.resolve(process.env.DEPLOYMENT_WORKSPACE || "/srv");

    const logs = [];
    const step = (name, fn) => fn().then(r => {
        logs.push(`[${name}] ${r.simulated ? "(simulated) " : ""}${r.ok ? "OK" : "FAIL"} — ${r.output.split("\n").filter(Boolean).slice(-3).join(" | ")}`);
        return r;
    });

    // 1. DEPLOY — command dari trusted config (startCommand), dijalankan di
    //    workspace. Untuk staging/production: simulate (aman).
    let deploy = { ok: false, simulated: true, code: null, output: "" };
    if (release) {
        const startCmd = app.startCommand || "pm2 restart";
        deploy = await step("deploy", () => runCommand(startCmd, cwd, { environment }));
    } else {
        logs.push("[deploy] SKIPPED — tidak ada release");
    }

    // 2. VERIFY — proses/status check ringan (untuk development real).
    //    Production: simulate.
    let verify = { ok: true, simulated: true, output: "Verification simulated (aman)" };
    logs.push(`[verify] ${verify.output}`);

    // 3. HEALTH CHECK — NYATA (M4) terhadap healthEndpoint aplikasi.
    //    SP-027 M5 §19: Deployment dianggap SUCCESS HANYA jika deployment
    //    selesai DAN health check berhasil. Tanpa healthEndpoint → tidak
    //    bisa diverifikasi → deployment TIDAK SUCCESS (hindari sukses palsu).
    let health = null;
    let healthOk = false;
    if (app.healthEndpoint) {
        try {
            health = await checkHttpHealth(app.healthEndpoint, {
                timeoutMs: 15000,
                warnMs: 2000,
                degradedMs: 5000
            });
            healthOk = health.status === "HEALTHY";
            logs.push(`[health-check] ${health.status} — ${health.message || ""} (${health.responseTime}ms)`);
        } catch (err) {
            logs.push(`[health-check] ERROR — ${err.message}`);
            health = { status: "UNKNOWN", message: err.message, responseTime: null };
        }
    } else {
        logs.push("[health-check] SKIPPED — tidak ada healthEndpoint → deployment tidak dapat diverifikasi (FAILED)");
    }

    // SUCCESS hanya jika deploy + verify + health check (jika dikonfigurasi) lolos.
    const ok = deploy.ok && verify.ok && healthOk;
    return {
        ok,
        log: logs.join("\n"),
        health: health ? { httpStatus: health.httpStatus, responseTimeMs: health.responseTime, ok: healthOk, message: health.message } : null
    };
}

export default { validateCommand, validateCwd, runCommand, runPipelineStep };
