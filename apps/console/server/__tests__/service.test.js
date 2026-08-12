import { describe, it, expect, vi } from "vitest";
import { runFullCheck, platformHealth } from "../monitoring/service.js";

const cfg = {
    cacheTtlMs: 0,
    checkTimeoutMs: 2000,
    responseWarnMs: 500,
    responseDegradedMs: 1500,
    cpuWarnPct: 100,
    cpuDegradedPct: 200,
    memoryWarnPct: 80,
    memoryDegradedPct: 90,
    diskWarnPct: 80,
    diskDegradedPct: 90,
    diskPaths: ["/"]
};

/** Environment dengan registry default (console + inventory). */
const env = { MONITORING_APPS_JSON: "" };

function makeCheckers({ inventoryStatus = "HEALTHY", consoleStatus = "HEALTHY", dbStatus = "HEALTHY", infraStatus = "HEALTHY", pm2Status = "HEALTHY" } = {}) {
    return {
        checkHttpHealth: vi.fn(async (endpoint, opts) => {
            if (endpoint.includes("3001")) {
                return { status: inventoryStatus, responseTime: 40, message: "HTTP 200 dalam 40ms", httpStatus: 200, version: "1.0.0" };
            }
            return { status: consoleStatus, responseTime: 30, message: "HTTP 200 dalam 30ms", httpStatus: 200, version: "1.0.0" };
        }),
        checkDatabaseHealth: vi.fn(async () => ({ status: dbStatus, responseTime: 5, message: "ping ok", readyState: 1 })),
        checkInfrastructure: vi.fn(() => ({
            status: infraStatus,
            cpu: { status: infraStatus, cores: 4, load1: 0.5 },
            memory: { status: infraStatus, usagePct: 50 },
            disk: { worst: infraStatus },
            uptime: { seconds: 3600 }
        })),
        checkProcesses: vi.fn(async () => ({ available: true, status: pm2Status, processes: [{ name: "console-api", status: "ONLINE" }] }))
    };
}

describe("monitoring service — runFullCheck", () => {
    it("semua sehat → platform HEALTHY + summary benar", async () => {
        const data = await runFullCheck({ force: true, config: cfg, env, checkers: makeCheckers() });
        expect(data.status).toBe("HEALTHY");
        expect(data.summary.monitoredApps).toBe(2);
        expect(data.summary.healthy).toBe(2);
        expect(data.summary.down).toBe(0);
        expect(data.services.console.status).toBe("HEALTHY");
        expect(data.services.inventory.status).toBe("HEALTHY");
        expect(data.services.mongodb.status).toBe("HEALTHY");
        expect(data.applications.filter(a => a.monitoringEnabled)).toHaveLength(2);
    });

    it("Inventory DOWN → platform DOWN, tetapi Console tetap HEALTHY (isolasi kegagalan)", async () => {
        const data = await runFullCheck({
            force: true,
            config: cfg,
            env,
            checkers: makeCheckers({ inventoryStatus: "DOWN", dbStatus: "HEALTHY", infraStatus: "HEALTHY", pm2Status: "HEALTHY" })
        });
        expect(data.services.inventory.status).toBe("DOWN");
        expect(data.services.console.status).toBe("HEALTHY"); // Console TIDAK ikut gagal
        expect(data.services.mongodb.status).toBe("HEALTHY");
        expect(data.applications.find(a => a.id === "inventory").status).toBe("DOWN");
        expect(data.status).toBe("DOWN");
        expect(data.summary.down).toBe(1);
    });

    it("Database DOWN → platform DOWN tapi aplikasi tetap dicek", async () => {
        const data = await runFullCheck({
            force: true,
            config: cfg,
            env,
            checkers: makeCheckers({ inventoryStatus: "HEALTHY", dbStatus: "DOWN", infraStatus: "HEALTHY", pm2Status: "HEALTHY" })
        });
        expect(data.database.status).toBe("DOWN");
        expect(data.services.mongodb.status).toBe("DOWN");
        expect(data.services.inventory.status).toBe("HEALTHY");
        expect(data.status).toBe("DOWN");
    });

    it("PM2 tidak tersedia → UNKNOWN (bukan crash)", async () => {
        const checkers = makeCheckers();
        checkers.checkProcesses = vi.fn(async () => ({ available: false, status: "UNKNOWN", processes: [], message: "PM2 tidak tersedia" }));
        const data = await runFullCheck({ force: true, config: cfg, env, checkers });
        expect(data.processes.status).toBe("UNKNOWN");
        expect(data.services.console.status).toBe("HEALTHY"); // tetap jalan
    });

    it("infrastruktur WARNING → platform WARNING", async () => {
        const data = await runFullCheck({
            force: true,
            config: cfg,
            env,
            checkers: makeCheckers({ inventoryStatus: "HEALTHY", dbStatus: "HEALTHY", infraStatus: "WARNING", pm2Status: "HEALTHY" })
        });
        expect(data.infrastructure.status).toBe("WARNING");
        expect(data.status).toBe("WARNING");
    });
});

describe("monitoring service — platformHealth contract", () => {
    it("contract reusable: { status, timestamp, services }", async () => {
        const contract = await platformHealth({ config: cfg, env, checkers: makeCheckers() });
        expect(contract.status).toBe("HEALTHY");
        expect(contract.timestamp).toBeTypeOf("number");
        expect(contract.services).toEqual({ console: "HEALTHY", inventory: "HEALTHY", mongodb: "HEALTHY" });
    });
});
