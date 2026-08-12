import { describe, it, expect } from "vitest";
import { escapeRegex, buildAuditQuery, parseAuditPagination } from "../routes/audit.js";

/**
 * SP-027 PRE-M5 round 3 — regression test untuk route GET /api/audit.
 *
 * Halaman Activity Log sebelumnya memakai data MOCK statis. Route baru
 * mengekspos SecurityAuditLog (M3) dengan search + pagination. Fungsi murni
 * di bawah di-test agar filter pencarian aman (regex injection) dan
 * pagination selalu dalam batas wajar.
 */

describe("escapeRegex — input user aman untuk $regex (SP-027 PRE-M5)", () => {
    it("escape metacharacters regex", () => {
        expect(escapeRegex("a.b")).toBe("a\\.b");
        expect(escapeRegex("(a+)")).toBe("\\(a\\+\\)");
        expect(escapeRegex("a[bc]d")).toBe("a\\[bc\\]d");
        expect(escapeRegex("a$^b")).toBe("a\\$\\^b");
        expect(escapeRegex("a*b?c|d")).toBe("a\\*b\\?c\\|d");
    });

    it("tidak mengubah teks polos", () => {
        expect(escapeRegex("Login Gagal")).toBe("Login Gagal");
        expect(escapeRegex("superadmin")).toBe("superadmin");
    });

    it("input non-string dipaksa jadi string (tidak throw)", () => {
        expect(escapeRegex(undefined)).toBe("undefined");
        expect(escapeRegex(null)).toBe("null");
        expect(escapeRegex(42)).toBe("42");
    });
});

describe("buildAuditQuery — filter pencarian audit (SP-027 PRE-M5)", () => {
    it("tanpa search → filter kosong (semua record)", () => {
        expect(buildAuditQuery("")).toEqual({});
        expect(buildAuditQuery("   ")).toEqual({});
        expect(buildAuditQuery(undefined)).toEqual({});
    });

    it("dengan search → $or atas 5 field, regex ter-escape", () => {
        const q = buildAuditQuery("admin.user");
        expect(q.$or).toHaveLength(5);
        for (const cond of q.$or) {
            const inner = Object.values(cond)[0]; // { actorName: { $regex, $options } }
            expect(inner.$regex).toBe("admin\\.user");
            expect(inner.$options).toBe("i");
        }
        // Field yang dicari
        const fields = q.$or.map(c => Object.keys(c)[0]);
        expect(fields).toEqual(["actorName", "actorId", "action", "targetName", "targetId"]);
    });

    it("search dengan metacharacter tidak menghasilkan regex berbahaya", () => {
        // "(a+)+" bila tidak di-escape bisa jadi ReDoS; setelah escape jadi literal
        const q = buildAuditQuery("(a+)+");
        for (const cond of q.$or) {
            const inner = Object.values(cond)[0];
            expect(inner.$regex).toBe("\\(a\\+\\)\\+");
        }
    });
});

describe("parseAuditPagination — clamp pagination (SP-027 PRE-M5)", () => {
    it("default page=1, limit=10", () => {
        expect(parseAuditPagination({})).toEqual({ page: 1, limit: 10 });
    });

    it("page/limit valid dipakai apa adanya", () => {
        expect(parseAuditPagination({ page: "3", limit: "25" })).toEqual({ page: 3, limit: 25 });
    });

    it("page negatif/0 di-clamp ke 1 (mencegah negative skip)", () => {
        expect(parseAuditPagination({ page: "-5" })).toEqual({ page: 1, limit: 10 });
        expect(parseAuditPagination({ page: "0" })).toEqual({ page: 1, limit: 10 });
    });

    it("limit negatif di-clamp ke 1; limit > 100 di-clamp ke 100; 0 → default 10", () => {
        expect(parseAuditPagination({ limit: "-3" })).toEqual({ page: 1, limit: 1 });
        // parseInt("0") = 0 → falsy → fallback default 10 (0 dianggap tidak disediakan)
        expect(parseAuditPagination({ limit: "0" })).toEqual({ page: 1, limit: 10 });
        expect(parseAuditPagination({ limit: "999" })).toEqual({ page: 1, limit: 100 });
    });

    it("nilai non-angka → fallback default", () => {
        expect(parseAuditPagination({ page: "abc", limit: "xyz" })).toEqual({ page: 1, limit: 10 });
    });
});
