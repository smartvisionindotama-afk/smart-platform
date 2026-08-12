import { describe, it, expect } from "vitest";
import {
    classifyHttp,
    classifyResource,
    combineStates,
    platformHealthContract,
    HEALTH_STATES,
    STATE_RANK
} from "../monitoring/health.js";

describe("health — state model", () => {
    it("memiliki 5 state konsisten", () => {
        expect(HEALTH_STATES).toEqual(["HEALTHY", "WARNING", "DEGRADED", "DOWN", "UNKNOWN"]);
        expect(STATE_RANK.HEALTHY).toBe(0);
        expect(STATE_RANK.DOWN).toBe(4);
    });

    it("classifyHttp: cepat → HEALTHY", () => {
        expect(classifyHttp(120)).toBe("HEALTHY");
    });

    it("classifyHttp: >= warn → WARNING", () => {
        expect(classifyHttp(500)).toBe("WARNING");
        expect(classifyHttp(700)).toBe("WARNING");
    });

    it("classifyHttp: >= degraded → DEGRADED", () => {
        expect(classifyHttp(1500)).toBe("DEGRADED");
        expect(classifyHttp(3000)).toBe("DEGRADED");
    });

    it("classifyHttp: nilai non-numerik → HEALTHY (tidak crash)", () => {
        expect(classifyHttp(null)).toBe("HEALTHY");
        expect(classifyHttp("abc")).toBe("HEALTHY");
    });

    it("classifyResource: threshold default 80/90", () => {
        expect(classifyResource(50)).toBe("HEALTHY");
        expect(classifyResource(85)).toBe("WARNING");
        expect(classifyResource(95)).toBe("DEGRADED");
    });

    it("classifyResource: threshold kustom", () => {
        expect(classifyResource(105, 100, 200)).toBe("WARNING");
        expect(classifyResource(210, 100, 200)).toBe("DEGRADED");
    });
});

describe("health — combineStates (worst-wins)", () => {
    it("semua sehat → HEALTHY", () => {
        expect(combineStates(["HEALTHY", "HEALTHY", "HEALTHY"])).toBe("HEALTHY");
    });

    it("satu DOWN → DOWN", () => {
        expect(combineStates(["HEALTHY", "DOWN", "WARNING"])).toBe("DOWN");
    });

    it("WARNING lebih buruk dari UNKNOWN", () => {
        expect(combineStates(["UNKNOWN", "WARNING"])).toBe("WARNING");
    });

    it("array kosong → HEALTHY", () => {
        expect(combineStates([])).toBe("HEALTHY");
    });
});

describe("health — platform contract (reusable)", () => {
    it("membangun contract { status, timestamp, services }", () => {
        const contract = platformHealthContract({
            services: { console: "healthy", inventory: "healthy", mongodb: "healthy" }
        });
        expect(contract.status).toBe("HEALTHY");
        expect(typeof contract.timestamp).toBe("number");
        expect(contract.services.console).toBe("healthy");
    });

    it("status contract mengikuti service terburuk", () => {
        const contract = platformHealthContract({
            services: { console: "healthy", inventory: "down", mongodb: "healthy" }
        });
        expect(contract.status).toBe("DOWN");
    });
});
