import { describe, it, expect, vi } from "vitest";
import { checkHttpHealth, checkDatabaseHealth, checkInfrastructure, checkProcesses } from "../monitoring/checkers.js";

/** Fake Response minimal. */
function fakeRes({ ok = true, status = 200, body = {} } = {}) {
    return {
        ok,
        status,
        async json() {
            return body;
        }
    };
}

describe("checkers — checkHttpHealth", () => {
    it("200 cepat → HEALTHY + responseTime", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(fakeRes({ body: { status: "ok", version: "1.0.0" } }));
        const r = await checkHttpHealth("http://x/api/health", { fetchImpl });
        expect(r.status).toBe("HEALTHY");
        expect(r.responseTime).toBeGreaterThanOrEqual(0);
        expect(r.version).toBe("1.0.0");
        expect(r.message).toContain("200");
    });

    it("200 lambat (> warnMs) → WARNING", async () => {
        const fetchImpl = vi.fn().mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 30));
            return fakeRes();
        });
        const r = await checkHttpHealth("http://x/api/health", { fetchImpl, warnMs: 10, degradedMs: 100 });
        expect(r.status).toBe("WARNING");
    });

    it("200 sangat lambat (>= degradedMs) → DEGRADED", async () => {
        const fetchImpl = vi.fn().mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 60));
            return fakeRes();
        });
        const r = await checkHttpHealth("http://x/api/health", { fetchImpl, warnMs: 10, degradedMs: 30 });
        expect(r.status).toBe("DEGRADED");
    });

    it("HTTP 500 → DOWN", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(fakeRes({ ok: false, status: 500 }));
        const r = await checkHttpHealth("http://x/api/health", { fetchImpl });
        expect(r.status).toBe("DOWN");
        expect(r.httpStatus).toBe(500);
    });

    it("network error → DOWN (Endpoint tidak dapat dijangkau)", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const r = await checkHttpHealth("http://x/api/health", { fetchImpl });
        expect(r.status).toBe("DOWN");
        expect(r.message).toBe("Endpoint tidak dapat dijangkau");
    });

    it("health contract status != ok/healthy → DOWN", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(fakeRes({ body: { status: "error" } }));
        const r = await checkHttpHealth("http://x/api/health", { fetchImpl });
        expect(r.status).toBe("DOWN");
    });
});

describe("checkers — checkDatabaseHealth", () => {
    it("ping ok → HEALTHY", async () => {
        const mongooseImpl = {
            connection: {
                readyState: 1,
                db: { admin: () => ({ command: vi.fn().mockResolvedValue({ ok: 1 }) }) }
            }
        };
        const r = await checkDatabaseHealth({ mongooseImpl });
        expect(r.status).toBe("HEALTHY");
        expect(r.readyState).toBe(1);
    });

    it("tanpa koneksi → DOWN", async () => {
        const r = await checkDatabaseHealth({ mongooseImpl: null });
        expect(r.status).toBe("DOWN");
    });

    it("ping gagal → DOWN", async () => {
        const mongooseImpl = {
            connection: {
                readyState: 0,
                db: { admin: () => ({ command: vi.fn().mockRejectedValue(new Error("connection closed")) }) }
            }
        };
        const r = await checkDatabaseHealth({ mongooseImpl });
        expect(r.status).toBe("DOWN");
    });
});

describe("checkers — checkInfrastructure", () => {
    function osImpl({ load = [0.4, 0.3, 0.2], total = 4 * 1024 ** 3, free = 2 * 1024 ** 3, cores = 4, uptime = 3600 } = {}) {
        return {
            loadavg: () => load,
            totalmem: () => total,
            freemem: () => free,
            cpus: () => new Array(cores).fill({}),
            uptime: () => uptime
        };
    }
    function statfsImpl(usagePct) {
        return (p) => {
            const bsize = 4096;
            const blocks = 100000;
            const total = blocks * bsize;
            const used = Math.round(total * usagePct / 100);
            return { bsize, blocks, bfree: Math.floor((total - used) / bsize) };
        };
    }

    it("resource normal → HEALTHY", () => {
        const r = checkInfrastructure({ osImpl: osImpl(), statfsImpl: statfsImpl(50) });
        expect(r.status).toBe("HEALTHY");
        expect(r.cpu.status).toBe("HEALTHY");
        expect(r.memory.status).toBe("HEALTHY");
        expect(r.disk.worst).toBe("HEALTHY");
    });

    it("memory 85% → WARNING", () => {
        const r = checkInfrastructure({ osImpl: osImpl({ total: 1000, free: 150 }), statfsImpl: statfsImpl(50) });
        expect(r.memory.usagePct).toBe(85);
        expect(r.memory.status).toBe("WARNING");
        expect(r.status).toBe("WARNING");
    });

    it("disk 95% → DEGRADED", () => {
        const r = checkInfrastructure({ osImpl: osImpl(), statfsImpl: statfsImpl(95) });
        expect(r.disk.worst).toBe("DEGRADED");
        expect(r.status).toBe("DEGRADED");
    });

    it("beberapa disk → worst-wins tanpa crash", () => {
        const statfs = (p) => {
            const bsize = 4096, blocks = 100000;
            const total = blocks * bsize;
            const pct = p === "/srv" ? 95 : 40; // /srv penuh 95%
            const used = Math.round(total * pct / 100);
            return { bsize, blocks, bfree: Math.floor((total - used) / bsize) };
        };
        const r = checkInfrastructure({ osImpl: osImpl(), statfsImpl: statfs, diskPaths: ["/", "/srv"] });
        expect(r.disk.disks).toHaveLength(2);
        expect(r.disk.worst).toBe("DEGRADED");
        expect(r.status).toBe("DEGRADED");
    });

    it("load1 per-core tinggi → WARNING/DEGRADED", () => {
        const r = checkInfrastructure({ osImpl: osImpl({ load: [4.4, 2, 1], cores: 4 }), statfsImpl: statfsImpl(50) });
        // load1 4.4 / 4 cores = 1.1 → 110% → WARNING (threshold 100/200)
        expect(r.cpu.status).toBe("WARNING");
    });

    it("statfs gagal → disk UNKNOWN tanpa crash", () => {
        const r = checkInfrastructure({ osImpl: osImpl(), statfsImpl: () => { throw new Error("ENOENT"); } });
        expect(r.disk.worst).toBe("UNKNOWN");
        // Tidak crash; status keseluruhan jadi UNKNOWN (tidak bisa ditentukan)
        expect(r.status).toBe("UNKNOWN");
    });
});

describe("checkers — checkProcesses (PM2)", () => {
    it("semua online → HEALTHY", async () => {
        const pm2List = [
            { name: "console-api", pid: 100, pm2_env: { status: "online", cpu: 0.5, memory: 104857600, restart_time: 1, pm_uptime: Date.now() - 60000 } },
            { name: "inventory-api", pid: 101, pm2_env: { status: "online", cpu: 1.2, memory: 209715200, restart_time: 0, pm_uptime: Date.now() - 120000 } }
        ];
        const execImpl = vi.fn((cmd, args, opts, cb) => cb(null, JSON.stringify(pm2List)));
        const r = await checkProcesses({ execImpl });
        expect(r.available).toBe(true);
        expect(r.status).toBe("HEALTHY");
        expect(r.processes).toHaveLength(2);
        expect(r.processes[0]).toMatchObject({ name: "console-api", status: "ONLINE" });
        expect(r.processes[0].restarts).toBe(1);
        expect(r.processes[0].cpu).toBe(0.5);
    });

    it("satu errored → WARNING", async () => {
        const pm2List = [
            { name: "console-api", pm2_env: { status: "online" } },
            { name: "inventory-api", pm2_env: { status: "errored" } }
        ];
        const execImpl = vi.fn((cmd, args, opts, cb) => cb(null, JSON.stringify(pm2List)));
        const r = await checkProcesses({ execImpl });
        expect(r.status).toBe("WARNING");
        expect(r.processes[1].status).toBe("ERRORED");
    });

    it("semua mati → DOWN", async () => {
        const pm2List = [
            { name: "console-api", pm2_env: { status: "stopped" } },
            { name: "inventory-api", pm2_env: { status: "stopped" } }
        ];
        const execImpl = vi.fn((cmd, args, opts, cb) => cb(null, JSON.stringify(pm2List)));
        const r = await checkProcesses({ execImpl });
        expect(r.status).toBe("DOWN");
    });

    it("pm2 tidak tersedia → UNKNOWN (graceful)", async () => {
        const execImpl = vi.fn((cmd, args, opts, cb) => cb(new Error("command not found")));
        const r = await checkProcesses({ execImpl });
        expect(r.available).toBe(false);
        expect(r.status).toBe("UNKNOWN");
        expect(r.processes).toEqual([]);
    });

    it("output tidak valid → UNKNOWN", async () => {
        const execImpl = vi.fn((cmd, args, opts, cb) => cb(null, "not json"));
        const r = await checkProcesses({ execImpl });
        expect(r.status).toBe("UNKNOWN");
    });
});
