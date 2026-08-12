import { describe, it, expect, vi } from "vitest";
import { generateHistoryEvents, recordEvents, stateChanged, recordTransition } from "../monitoring/history.js";

describe("history — anti-flood (SP-027 M4 §8/§9)", () => {
    const checks = (status) => [
        { service: "inventory-api", metric: "health", status, value: 40, message: "msg" },
        { service: "mongodb", metric: "health", status: "HEALTHY", value: 5, message: "ok" }
    ];

    it("observasi pertama DOWN → 1 event", async () => {
        const events = await generateHistoryEvents(checks("DOWN"));
        expect(events.length).toBe(1);
        expect(events[0].status).toBe("DOWN");
        expect(events[0].service).toBe("inventory-api");
    });

    it("DOWN bertahan (siklus berikutnya sama) → TIDAK direkam ulang (no flood)", async () => {
        await generateHistoryEvents(checks("DOWN")); // siklus 1 → 1 event
        const events2 = await generateHistoryEvents(checks("DOWN")); // siklus 2 sama
        expect(events2.length).toBe(0);
    });

    it("transisi DOWN → WARNING direkam (state berubah)", async () => {
        await generateHistoryEvents(checks("DOWN"));
        const events = await generateHistoryEvents(checks("WARNING"));
        expect(events.length).toBe(1);
        expect(events[0].status).toBe("WARNING");
    });

    it("recovery ke HEALTHY → event INFO recovery", async () => {
        await generateHistoryEvents(checks("DOWN"));
        const events = await generateHistoryEvents(checks("HEALTHY"));
        expect(events.length).toBe(1);
        expect(events[0].status).toBe("HEALTHY");
        expect(events[0].message).toContain("pulih");
    });

    it("HEALTHY stabil → tidak ada event", async () => {
        await generateHistoryEvents(checks("HEALTHY"));
        const events = await generateHistoryEvents(checks("HEALTHY"));
        expect(events.length).toBe(0);
    });

    it("stateChanged: perubahan → true, sama → false", () => {
        expect(stateChanged("svc-a", "DOWN")).toBe(false); // pertama kali: prev undefined
        expect(stateChanged("svc-a", "DOWN")).toBe(false); // sama
        expect(stateChanged("svc-a", "HEALTHY")).toBe(true); // berubah
        expect(recordTransition("svc-a", "WARNING")).toBe("HEALTHY"); // return prev
    });
});

describe("history — recordEvents fail-open", () => {
    it("tanpa koneksi DB → 0 (tidak throw)", async () => {
        const Model = { db: { readyState: 0 }, insertMany: vi.fn() };
        const n = await recordEvents([{ service: "x", status: "DOWN" }], { Model });
        expect(n).toBe(0);
        expect(Model.insertMany).not.toHaveBeenCalled();
    });

    it("DB tersambung → insertMany dipanggil", async () => {
        const Model = {
            db: { readyState: 1 },
            insertMany: vi.fn().mockResolvedValue([{ _id: "1" }, { _id: "2" }])
        };
        const n = await recordEvents([{ service: "x", status: "DOWN" }, { service: "y", status: "WARNING" }], { Model });
        expect(n).toBe(2);
    });

    it("insertMany error → 0 (fail-open)", async () => {
        const Model = {
            db: { readyState: 1 },
            insertMany: vi.fn().mockRejectedValue(new Error("boom"))
        };
        const n = await recordEvents([{ service: "x", status: "DOWN" }], { Model });
        expect(n).toBe(0);
    });
});
