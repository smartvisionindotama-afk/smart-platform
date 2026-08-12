import { describe, it, expect } from "vitest";
import { normalizeApp, listRegistry, listMonitoredApps } from "../monitoring/registry.js";

describe("registry — normalizeApp", () => {
    it("normalisasi entri lengkap", () => {
        const app = normalizeApp({
            id: "inventory",
            name: "SMART Inventory",
            domain: "https://inv.e-profit.id",
            healthEndpoint: "http://127.0.0.1:3001/api/health"
        });
        expect(app.id).toBe("inventory");
        expect(app.name).toBe("SMART Inventory");
        expect(app.monitoringEnabled).toBe(true);
    });

    it("monitoringEnabled false bila tanpa healthEndpoint", () => {
        expect(normalizeApp({ id: "x", name: "X" }).monitoringEnabled).toBe(false);
    });

    it("status inactive → monitoringEnabled false", () => {
        const app = normalizeApp({ id: "x", name: "X", status: "inactive", healthEndpoint: "http://x/api/health" });
        expect(app.monitoringEnabled).toBe(false);
        expect(app.status).toBe("inactive");
    });

    it("normalizeApp aman terhadap input kosong", () => {
        const app = normalizeApp({});
        expect(app.id).toBe("");
        expect(app.monitoringEnabled).toBe(false);
    });
});

describe("registry — extensibility (tanpa redesign)", () => {
    it("default registry memuat console + inventory yang dipantau", () => {
        const registry = listRegistry({});
        const ids = registry.map(a => a.id);
        expect(ids).toContain("console");
        expect(ids).toContain("inventory");
        const monitored = listMonitoredApps({});
        expect(monitored.map(a => a.id).sort()).toEqual(["console", "inventory"]);
    });

    it("registry default berisi aplikasi masa depan (nonaktif)", () => {
        const ids = listRegistry({}).map(a => a.id);
        for (const id of ["wms", "eprofit", "santripintar", "sitampan", "desainsight"]) {
            expect(ids).toContain(id);
        }
    });

    it("env MONITORING_APPS_JSON menimpa & menambah aplikasi", () => {
        const env = {
            MONITORING_APPS_JSON: JSON.stringify([
                { id: "inventory", healthEndpoint: "http://127.0.0.1:3999/api/health" },
                { id: "smartwms", name: "SmartWMS", healthEndpoint: "http://127.0.0.1:4000/api/health" }
            ])
        };
        const registry = listRegistry(env);
        const inventory = registry.find(a => a.id === "inventory");
        expect(inventory.healthEndpoint).toBe("http://127.0.0.1:3999/api/health"); // tertimpa
        expect(registry.find(a => a.id === "smartwms")).toBeTruthy(); // ditambah
        expect(listMonitoredApps(env).map(a => a.id)).toContain("smartwms");
    });

    it("env JSON invalid → fallback ke default tanpa crash", () => {
        const registry = listRegistry({ MONITORING_APPS_JSON: "{not-json" });
        expect(registry.length).toBeGreaterThan(0);
    });
});
