import { describe, it, expect } from "vitest";
import { selectCompanyListPayload } from "../routes/companies.js";

/**
 * SP-027 PRE-M5 — regression test untuk root cause #1.
 *
 * Bug lama: GET /api/companies selalu mengembalikan payload RINGAN (tanpa
 * _id/active/email) walau request terautentikasi → semua company tampil
 * SUSPEND dan Edit jatuh ke mode CREATE. Fix: soft-auth mengisi req.auth
 * untuk request ber-token valid; payload penuh hanya untuk yang authed.
 */
const DOCS = [
    {
        _id: "64f000000000000000000001",
        code: "PT-001",
        name: "PT Smart Vision Indotama",
        jenis: "PT",
        email: "info@smartvision.co.id",
        active: true,
        isActive: true,
        status: "active",
        logo: null,
        workspace: "warehouse"
    },
    {
        _id: "64f000000000000000000002",
        code: "CMP-002",
        name: "CV Karya Mandiri",
        jenis: "CV",
        email: "info@karyamandiri.co.id",
        active: true,
        isActive: true,
        status: "active",
        logo: null,
        workspace: "warehouse"
    }
];

describe("selectCompanyListPayload — perusahaan (SP-027 PRE-M5)", () => {
    it("authed=true → dokumen penuh (id, active, email tersedia)", () => {
        const payload = selectCompanyListPayload({ authed: true, docs: DOCS });
        expect(payload).toHaveLength(2);
        expect(payload[0]._id).toBe(DOCS[0]._id);
        expect(payload[0].active).toBe(true);
        expect(payload[0].email).toBe("info@smartvision.co.id");
    });

    it("authed=false → payload ringan (TANPA _id/active/email) — aman untuk publik", () => {
        const payload = selectCompanyListPayload({ authed: false, docs: DOCS });
        expect(payload).toHaveLength(2);
        for (const c of payload) {
            expect(c._id).toBeUndefined();
            expect(c.id).toBeUndefined();
            expect(c.active).toBeUndefined();
            expect(c.email).toBeUndefined();
            expect(c.code).toBeDefined();
            expect(c.name).toBeDefined();
        }
    });

    it("authed=false → tidak membocorkan field sensitif lain (status, legalId, taxId)", () => {
        const withLegal = [
            { ...DOCS[0], legalId: "L-001", taxId: "01.234.567.8-999.000", orgKetua: "X" }
        ];
        const payload = selectCompanyListPayload({ authed: false, docs: withLegal });
        expect(payload[0].legalId).toBeUndefined();
        expect(payload[0].taxId).toBeUndefined();
        expect(payload[0].orgKetua).toBeUndefined();
    });

    it("docs kosong → array kosong (bukan error)", () => {
        expect(selectCompanyListPayload({ authed: true, docs: [] })).toEqual([]);
        expect(selectCompanyListPayload({ authed: false, docs: [] })).toEqual([]);
    });

    it("authed=false → status tidak bisa disimpulkan dari payload (mencegah false SUSPEND)", () => {
        // Regresi lama: UI membaca `active` dari payload ringan → undefined → semua
        // company tampil "Suspended". Payload ringan TIDAK memuat active sama sekali.
        const payload = selectCompanyListPayload({ authed: false, docs: DOCS });
        expect(Object.prototype.hasOwnProperty.call(payload[0], "active")).toBe(false);
    });
});
