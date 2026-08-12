import { describe, it, expect, vi } from "vitest";
import { createAuditLogger } from "../src/audit.js";

function mockModel() {
    return { create: vi.fn().mockResolvedValue({}) };
}

describe("audit logger", () => {
    it("login menulis entry action login", async () => {
        const model = mockModel();
        const audit = createAuditLogger(model);
        await audit.login({ actorId: "USR1", actorName: "Admin", ip: "1.2.3.4" });
        const doc = model.create.mock.calls[0][0];
        expect(doc.action).toBe("login");
        expect(doc.category).toBe("auth");
        expect(doc.actorId).toBe("USR1");
        expect(doc.result).toBe("success");
    });

    it("failedLogin menulis result failed", async () => {
        const model = mockModel();
        const audit = createAuditLogger(model);
        await audit.failedLogin({ actorName: "unknown", ip: "1.2.3.4" });
        const doc = model.create.mock.calls[0][0];
        expect(doc.action).toBe("login.failed");
        expect(doc.result).toBe("failed");
    });

    it("superadminActivity memakai category superadmin.activity", async () => {
        const model = mockModel();
        const audit = createAuditLogger(model);
        await audit.superadminActivity({ action: "superadmin.create", actorId: "SA1", targetName: "newadmin" });
        const doc = model.create.mock.calls[0][0];
        expect(doc.category).toBe("superadmin.activity");
        expect(doc.action).toBe("superadmin.create");
    });

    it("gagal menulis tidak melempar error (fail-open logging)", async () => {
        const model = { create: vi.fn().mockRejectedValue(new Error("db down")) };
        const audit = createAuditLogger(model);
        await expect(audit.login({ actorId: "USR1" })).resolves.toBeUndefined();
    });
});
