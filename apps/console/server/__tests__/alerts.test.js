import { describe, it, expect } from "vitest";
import { SEVERITY, severityForState, buildMonitoringEvent } from "../monitoring/alerts.js";

describe("alerts — severity model", () => {
    it("memiliki 4 level severity", () => {
        expect(SEVERITY).toEqual({ INFO: "INFO", WARNING: "WARNING", ERROR: "ERROR", CRITICAL: "CRITICAL" });
    });

    it("memetakan health state → severity", () => {
        expect(severityForState("DOWN")).toBe("CRITICAL");
        expect(severityForState("DEGRADED")).toBe("ERROR");
        expect(severityForState("WARNING")).toBe("WARNING");
        expect(severityForState("HEALTHY")).toBe("INFO");
        expect(severityForState("UNKNOWN")).toBe("WARNING");
    });

    it("buildMonitoringEvent menghasilkan struktur SP-027 M4 §9", () => {
        const ev = buildMonitoringEvent({
            service: "inventory-api",
            metric: "response_time",
            status: "WARNING",
            value: 1850,
            message: "API response degraded"
        });
        expect(ev.timestamp).toBeTypeOf("number");
        expect(ev.service).toBe("inventory-api");
        expect(ev.metric).toBe("response_time");
        expect(ev.status).toBe("WARNING");
        expect(ev.value).toBe(1850);
        expect(ev.severity).toBe("WARNING");
        expect(ev.message).toBe("API response degraded");
    });

    it("severity event DOWN = CRITICAL", () => {
        const ev = buildMonitoringEvent({ service: "x", status: "DOWN", message: "down" });
        expect(ev.severity).toBe("CRITICAL");
    });
});
