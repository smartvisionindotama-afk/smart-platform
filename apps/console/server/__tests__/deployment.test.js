import { describe, it, expect, afterEach } from "vitest";
import { isValidSemver, normalizeVersion } from "../routes/releases.js";
import { validateCommand, validateCwd, runCommand } from "../deployment/pipeline.js";
import { enqueue, ensureStarted, stopQueue, queueStats } from "../deployment/queue.js";

/**
 * SP-027 M5 — Deployment Center unit test.
 *
 * Menguji pure functions (tanpa MongoDB):
 *  - release version validation (semver)
 *  - command allowlist / command injection protection
 *  - cwd whitelist (path traversal protection)
 *  - runCommand mode simulate (default aman — tidak eksekusi nyata)
 *  - job queue (enqueue tanpa handler aman; worker memproses job)
 */

// ══════════════════════════════════════════════════════════
// Release version validation (SP-027 M5 §7)
// ══════════════════════════════════════════════════════════

describe("isValidSemver — validasi versi release", () => {
    it("menerima semver standar", () => {
        expect(isValidSemver("1.0.0")).toBe(true);
        expect(isValidSemver("v1.0.0")).toBe(true);
        expect(isValidSemver("2.14.3")).toBe(true);
    });

    it("menerima pre-release label", () => {
        expect(isValidSemver("1.2.3-beta.1")).toBe(true);
        expect(isValidSemver("1.2.3-alpha")).toBe(true);
    });

    it("menolak format bukan semver", () => {
        expect(isValidSemver("1.0")).toBe(false);
        expect(isValidSemver("1")).toBe(false);
        expect(isValidSemver("v1")).toBe(false);
        expect(isValidSemver("latest")).toBe(false);
        expect(isValidSemver("1.0.0.0")).toBe(false);
        expect(isValidSemver("")).toBe(false);
        expect(isValidSemver(null)).toBe(false);
        expect(isValidSemver(undefined)).toBe(false);
        expect(isValidSemver("1.0.0; rm -rf /")).toBe(false);
    });

    it("normalizeVersion menambahkan prefix v", () => {
        expect(normalizeVersion("1.0.0")).toBe("v1.0.0");
        expect(normalizeVersion("v1.0.0")).toBe("v1.0.0");
        expect(normalizeVersion(" 2.0.1 ")).toBe("v2.0.1");
    });
});

// ══════════════════════════════════════════════════════════
// Command allowlist — NO arbitrary shell execution (M5 §23-24)
// ══════════════════════════════════════════════════════════

describe("validateCommand — allowlist & injection protection", () => {
    it("menerima command dari trusted config (npm/node/git/pm2)", () => {
        expect(validateCommand("npm run build").ok).toBe(true);
        expect(validateCommand("npm test").ok).toBe(true);
        expect(validateCommand("pm2 restart").ok).toBe(true);
        expect(validateCommand("git pull").ok).toBe(true);
        expect(validateCommand("node index.js").ok).toBe(true);
    });

    it("menolak program di luar allowlist", () => {
        const r = validateCommand("rm -rf /");
        expect(r.ok).toBe(false);
        expect(r.error).toContain("tidak diizinkan");
    });

    it("menolak command injection (shell metachar)", () => {
        expect(validateCommand("npm run build && rm -rf /").ok).toBe(false);
        expect(validateCommand("npm run build; cat /etc/passwd").ok).toBe(false);
        expect(validateCommand("npm run build | sh").ok).toBe(false);
        expect(validateCommand("npm run build > /tmp/x").ok).toBe(false);
        expect(validateCommand("npm run build `id`").ok).toBe(false);
        expect(validateCommand("npm run build $(id)").ok).toBe(false);
    });

    it("menolak command kosong", () => {
        expect(validateCommand("").ok).toBe(false);
        expect(validateCommand(null).ok).toBe(false);
    });
});

describe("validateCwd — whitelist direktori workspace", () => {
    it("menerima workspace root (/srv)", () => {
        expect(validateCwd("/srv")).toBe(true);
    });

    it("menolak path di luar workspace", () => {
        expect(validateCwd("/etc")).toBe(false);
        expect(validateCwd("/tmp")).toBe(false);
        expect(validateCwd("")).toBe(false);
        expect(validateCwd(null)).toBe(false);
    });
});

describe("runCommand — mode simulate default (aman)", () => {
    it("tanpa DEPLOYMENT_EXECUTION=real → simulate (ok, tidak eksekusi)", async () => {
        const r = await runCommand("npm run build", "/srv", { environment: "production" });
        expect(r.ok).toBe(true);
        expect(r.simulated).toBe(true);
        expect(r.output).toContain("[SIMULATED]");
    });

    it("staging selalu simulate walau DEPLOYMENT_EXECUTION=real", async () => {
        process.env.DEPLOYMENT_EXECUTION = "real";
        try {
            const r = await runCommand("npm run build", "/srv", { environment: "staging" });
            expect(r.simulated).toBe(true);
        } finally {
            delete process.env.DEPLOYMENT_EXECUTION;
        }
    });

    it("command tidak valid → diblokir sebelum eksekusi", async () => {
        const r = await runCommand("rm -rf /", "/srv", { environment: "production" });
        expect(r.ok).toBe(false);
        expect(r.output).toContain("[BLOCKED]");
    });
});

// ══════════════════════════════════════════════════════════
// Job queue — async worker, bukan sync HTTP deploy (M5 §18)
// ══════════════════════════════════════════════════════════

describe("deployment queue — job processing", () => {
    afterEach(() => {
        stopQueue();
    });

    it("enqueue tanpa handler tidak crash (job aman menunggu)", () => {
        stopQueue();
        enqueue({ id: "build-x", type: "build", payload: {} });
        expect(queueStats().queued).toBeGreaterThanOrEqual(1);
        stopQueue();
    });

    it("worker memproses job setelah handler didaftarkan", async () => {
        stopQueue();
        const processed = [];
        enqueue({ id: "build-1", type: "build", payload: { x: 1 } });
        enqueue({ id: "deploy-1", type: "deploy", payload: { x: 2 } });

        ensureStarted(async (job) => {
            processed.push(job.id);
        });

        // Tunggu worker memproses (polling dengan timeout)
        const deadline = Date.now() + 4000;
        while (processed.length < 2 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
        }
        stopQueue();

        expect(processed).toContain("build-1");
        expect(processed).toContain("deploy-1");
        expect(queueStats().queued).toBe(0);
    });
});
