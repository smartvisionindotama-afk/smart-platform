import { describe, it, expect, vi } from "vitest";
import { createMiddleware, hasPermission } from "../src/middleware.js";
import { signAccessToken, signRefreshToken, sha256 } from "../src/tokens.js";

const cfg = {
    jwtSecret: "test-secret",
    jwtRefreshSecret: "test-refresh-secret",
    jwtExpiresIn: "15m",
    jwtRefreshExpiresIn: "7d",
    impersonationTtlMs: 120000
};

function mockRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
    return res;
}

function mockReq(overrides = {}) {
    return {
        headers: {},
        body: {},
        ip: "127.0.0.1",
        ...overrides
    };
}

const rolePerms = {
    owner: ["*"],
    operator: ["inventory.barang.read", "inventory.barang.create"]
};

const security = createMiddleware({
    cfg,
    RefreshToken: {
        create: vi.fn().mockResolvedValue({}),
        findOne: vi.fn().mockResolvedValue(null),
        updateOne: vi.fn().mockResolvedValue({})
    },
    getUserById: vi.fn().mockResolvedValue({ id: "USR1", name: "Admin", role: "owner", companyCode: "PT-001" }),
    getRolePermissions: vi.fn(async role => rolePerms[role] || [])
});

const user = { id: "USR1", name: "Admin", username: "admin", role: "owner", companyCode: "PT-001" };

describe("middleware — hasPermission", () => {
    it("wildcard penuh", () => {
        expect(hasPermission(["*"], "inventory.barang.create")).toBe(true);
    });
    it("eksak", () => {
        expect(hasPermission(["inventory.barang.read"], "inventory.barang.read")).toBe(true);
    });
    it("prefix wildcard", () => {
        expect(hasPermission(["inventory.barang.*"], "inventory.barang.delete")).toBe(true);
    });
    it("tidak cocok", () => {
        expect(hasPermission(["inventory.barang.read"], "settings.user.manage")).toBe(false);
    });
});

describe("middleware — authenticate", () => {
    it("menolak tanpa token (401)", async () => {
        const res = mockRes();
        await security.authenticate(mockReq(), res, () => {});
        expect(res.statusCode).toBe(401);
    });

    it("menolak token tidak valid (401)", async () => {
        const res = mockRes();
        await security.authenticate(mockReq({ headers: { authorization: "Bearer invalid.token.here" } }), res, () => {});
        expect(res.statusCode).toBe(401);
    });

    it("menerima token valid dan mengisi req.user", async () => {
        const token = signAccessToken(user, cfg, "user");
        let called = false;
        const res = mockRes();
        await security.authenticate(mockReq({ headers: { authorization: `Bearer ${token}` } }), res, () => { called = true; });
        expect(called).toBe(true);
        expect(res.statusCode).toBe(200);
    });
});

describe("middleware — authenticate soft mode (SP-027 PRE-M5 regression fix)", () => {
    // Soft-auth dipakai endpoint publik yang memberikan payload penuh hanya
    // kepada user terautentikasi (GET /api/companies di Console).
    it("tanpa token → lanjut tanpa req.auth (soft)", async () => {
        const req = mockReq();
        const res = mockRes();
        let called = false;
        await security.authenticate(req, res, () => { called = true; }, { soft: true });
        expect(called).toBe(true);
        expect(req.auth).toBeUndefined();
        expect(res.statusCode).toBe(200); // tidak 401
    });

    it("token tidak valid → lanjut sebagai publik, tanpa 401 (soft)", async () => {
        const req = mockReq({ headers: { authorization: "Bearer invalid.token.here" } });
        const res = mockRes();
        let called = false;
        await security.authenticate(req, res, () => { called = true; }, { soft: true });
        expect(called).toBe(true);
        expect(req.auth).toBeUndefined();
        expect(res.statusCode).toBe(200);
    });

    it("token valid → req.auth terisi (soft)", async () => {
        const token = signAccessToken({ ...user, role: "superadmin" }, cfg, "superadmin");
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const res = mockRes();
        let called = false;
        await security.authenticate(req, res, () => { called = true; }, { soft: true });
        expect(called).toBe(true);
        expect(req.auth).toBeDefined();
        expect(req.auth.type).toBe("superadmin");
    });

    it("mode non-soft tetap menolak tanpa token (401) — tidak berubah", async () => {
        const res = mockRes();
        await security.authenticate(mockReq(), res, () => {});
        expect(res.statusCode).toBe(401);
    });
});

describe("middleware — permission", () => {
    /** Jalankan authenticate dulu agar req.auth terisi dari token. */
    async function authedReq(token, headers = {}) {
        const req = mockReq({ headers: { authorization: `Bearer ${token}`, ...headers } });
        const res = mockRes();
        await security.authenticate(req, res, () => {});
        return { req, res };
    }

    it("owner dengan * lolos", async () => {
        const token = signAccessToken({ ...user, role: "owner" }, cfg, "user");
        const { req, res } = await authedReq(token);
        let called = false;
        const mw = security.permission("settings.user.manage");
        await mw(req, res, () => { called = true; });
        expect(called).toBe(true);
    });

    it("operator tanpa permission ditolak (403)", async () => {
        const token = signAccessToken({ ...user, role: "operator" }, cfg, "user");
        const { req, res } = await authedReq(token);
        const mw = security.permission("settings.user.manage");
        await mw(req, res, () => {});
        expect(res.statusCode).toBe(403);
    });

    it("operator dengan permission lolos", async () => {
        const token = signAccessToken({ ...user, role: "operator" }, cfg, "user");
        const { req, res } = await authedReq(token);
        let called = false;
        const mw = security.permission("inventory.barang.read");
        await mw(req, res, () => { called = true; });
        expect(called).toBe(true);
    });
});

describe("middleware — companyScope", () => {
    /** Jalankan authenticate dulu agar req.auth terisi dari token. */
    async function authedReq(token, headers = {}) {
        const req = mockReq({ headers: { authorization: `Bearer ${token}`, ...headers } });
        const res = mockRes();
        await security.authenticate(req, res, () => {});
        return { req, res };
    }

    it("menolak header perusahaan tidak sesuai (403)", async () => {
        const token = signAccessToken(user, cfg, "user");
        const { req, res } = await authedReq(token, { "x-company-code": "CMP-OTHER" });
        await security.companyScope(req, res, () => {});
        expect(res.statusCode).toBe(403);
    });

    it("mengisi header dari token jika kosong", async () => {
        const token = signAccessToken(user, cfg, "user");
        const { req, res } = await authedReq(token);
        let nextCalled = false;
        await security.companyScope(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
        expect(req.headers["x-company-code"]).toBe("PT-001");
    });

    it("superadmin lolos tanpa scope", async () => {
        const token = signAccessToken({ ...user, id: "SA1" }, cfg, "superadmin");
        const { req, res } = await authedReq(token);
        let nextCalled = false;
        await security.companyScope(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });
});

describe("middleware — audience (cross-server token isolation)", () => {
    it("token dari server lain (aud salah) ditolak (401)", async () => {
        const secConsole = createMiddleware({
            cfg,
            RefreshToken: { create: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() },
            getUserById: vi.fn(),
            getRolePermissions: vi.fn(async () => []),
            expectedAudience: "console"
        });
        // Token diterbitkan "inventory" (aud salah untuk console)
        const token = signAccessToken(user, { ...cfg, audience: "inventory" }, "user", "inventory");
        const res = mockRes();
        await secConsole.authenticate(mockReq({ headers: { authorization: `Bearer ${token}` } }), res, () => {});
        expect(res.statusCode).toBe(401);
    });

    it("token dengan aud yang benar diterima", async () => {
        const secConsole = createMiddleware({
            cfg,
            RefreshToken: { create: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() },
            getUserById: vi.fn(),
            getRolePermissions: vi.fn(async () => []),
            expectedAudience: "console"
        });
        const token = signAccessToken(user, { ...cfg, audience: "console" }, "user", "console");
        let called = false;
        const res = mockRes();
        await secConsole.authenticate(mockReq({ headers: { authorization: `Bearer ${token}` } }), res, () => { called = true; });
        expect(called).toBe(true);
    });

    it("refresh meneruskan klaim token ke getUserById (sesi non-DB)", async () => {
        const rt = signRefreshToken({ ...user, id: "PT-001-admin", name: "Admin PT" }, cfg, "user", "inventory");
        const getUserById = vi.fn().mockResolvedValue({
            id: "PT-001-admin",
            name: "Admin PT",
            role: "owner",
            companyCode: "PT-001"
        });
        const sec = createMiddleware({
            cfg,
            RefreshToken: {
                create: vi.fn().mockResolvedValue({}),
                findOne: vi.fn().mockResolvedValue({
                    tokenHash: sha256(rt),
                    revokedAt: null,
                    expiresAt: new Date(Date.now() + 60000)
                }),
                updateOne: vi.fn().mockResolvedValue({})
            },
            getUserById,
            getRolePermissions: vi.fn(async () => []),
            expectedAudience: "inventory"
        });
        const res = mockRes();
        await sec.refreshHandler(mockReq({ body: { refreshToken: rt } }), res, () => {});
        expect(res.statusCode).toBe(200);
        expect(getUserById).toHaveBeenCalledWith("PT-001-admin", "user", expect.objectContaining({ role: "owner" }));
    });
});

describe("middleware — httpOnly refresh cookie (SP-027 M3 hardening)", () => {
    const cookieCfg = { ...cfg, cookieName: "smart_refresh", cookieSecure: false };

    function cookieRes() {
        const res = mockRes();
        res.cookies = [];
        res.cookie = (name, value, opts) => {
            res.cookies.push({ name, value, opts });
        };
        res.clearCookie = (name, opts) => {
            res.cookies.push({ name, value: "", opts, cleared: true });
        };
        return res;
    }

    it("issueTokens mengeset httpOnly cookie refresh token", async () => {
        const sec = createMiddleware({
            cfg: cookieCfg,
            RefreshToken: { create: vi.fn().mockResolvedValue({}) },
            getUserById: vi.fn(),
            getRolePermissions: vi.fn(async () => [])
        });
        const req = mockReq();
        const res = cookieRes();
        const pair = await sec.issueTokens(user, "user", req, res);
        expect(pair.accessToken).toBeTruthy();
        expect(pair.refreshToken).toBeTruthy();
        expect(res.cookies).toHaveLength(1);
        expect(res.cookies[0].name).toBe("smart_refresh");
        expect(res.cookies[0].value).toBe(pair.refreshToken);
        expect(res.cookies[0].opts.httpOnly).toBe(true);
    });

    it("refresh membaca refresh token dari cookie (tanpa body)", async () => {
        const rt = signRefreshToken(user, cookieCfg, "user", "inventory");
        const sec = createMiddleware({
            cfg: cookieCfg,
            RefreshToken: {
                create: vi.fn().mockResolvedValue({}),
                findOne: vi.fn().mockResolvedValue({
                    tokenHash: sha256(rt),
                    revokedAt: null,
                    expiresAt: new Date(Date.now() + 60000)
                }),
                updateOne: vi.fn().mockResolvedValue({})
            },
            getUserById: vi.fn().mockResolvedValue({ id: "USR1", name: "Admin", role: "owner", companyCode: "PT-001" }),
            getRolePermissions: vi.fn(async () => [])
        });
        const res = cookieRes();
        await sec.refreshHandler(
            mockReq({ headers: { cookie: `smart_refresh=${encodeURIComponent(rt)}` }, body: {} }),
            res,
            () => {}
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeTruthy();
        // Rotasi → cookie baru di-set
        expect(res.cookies.length).toBe(1);
        expect(res.cookies[0].value).toBe(res.body.refreshToken);
    });

    it("refresh gagal → cookie dibersihkan (clearCookie)", async () => {
        const rt = signRefreshToken(user, cookieCfg, "user", "inventory");
        const sec = createMiddleware({
            cfg: cookieCfg,
            RefreshToken: {
                create: vi.fn(),
                findOne: vi.fn().mockResolvedValue({
                    tokenHash: sha256(rt),
                    revokedAt: new Date(),
                    expiresAt: new Date(Date.now() + 60000)
                }),
                updateOne: vi.fn()
            },
            getUserById: vi.fn(),
            getRolePermissions: vi.fn(async () => [])
        });
        const res = cookieRes();
        await sec.refreshHandler(
            mockReq({ headers: { cookie: `smart_refresh=${encodeURIComponent(rt)}` }, body: {} }),
            res,
            () => {}
        );
        expect(res.statusCode).toBe(401);
        expect(res.cookies.length).toBe(1);
        expect(res.cookies[0].cleared).toBe(true);
    });

    it("logout me-revoke token dari cookie + clear cookie", async () => {
        const rt = signRefreshToken(user, cookieCfg, "user", "inventory");
        const updateOne = vi.fn().mockResolvedValue({});
        const sec = createMiddleware({
            cfg: cookieCfg,
            RefreshToken: { updateOne },
            getUserById: vi.fn(),
            getRolePermissions: vi.fn(async () => [])
        });
        const res = cookieRes();
        await sec.logoutHandler(
            mockReq({ headers: { cookie: `smart_refresh=${encodeURIComponent(rt)}` }, body: {} }),
            res,
            () => {}
        );
        expect(res.statusCode).toBe(200);
        expect(updateOne).toHaveBeenCalled();
        expect(res.cookies.length).toBe(1);
        expect(res.cookies[0].cleared).toBe(true);
    });
});

describe("middleware — refresh & logout", () => {
    it("refresh menolak tanpa refresh token (401)", async () => {
        const res = mockRes();
        await security.refreshHandler(mockReq({ body: {} }), res, () => {});
        expect(res.statusCode).toBe(401);
    });

    it("refresh menolak refresh token yang sudah direvoke (401)", async () => {
        const rt = signRefreshToken(user, cfg, "user");
        const model = {
            create: vi.fn().mockResolvedValue({}),
            findOne: vi.fn().mockResolvedValue({
                tokenHash: sha256(rt),
                revokedAt: new Date(),
                expiresAt: new Date(Date.now() + 60000)
            }),
            updateOne: vi.fn().mockResolvedValue({})
        };
        const sec = createMiddleware({
            cfg,
            RefreshToken: model,
            getUserById: vi.fn().mockResolvedValue({ id: "USR1", role: "owner", companyCode: "PT-001" }),
            getRolePermissions: vi.fn(async () => [])
        });
        const res = mockRes();
        await sec.refreshHandler(mockReq({ body: { refreshToken: rt } }), res, () => {});
        expect(res.statusCode).toBe(401);
    });

    it("refresh valid → issue pasangan token baru (rotasi)", async () => {
        const rt = signRefreshToken(user, cfg, "user");
        const model = {
            create: vi.fn().mockResolvedValue({}),
            findOne: vi.fn().mockResolvedValue({
                tokenHash: sha256(rt),
                revokedAt: null,
                expiresAt: new Date(Date.now() + 60000)
            }),
            updateOne: vi.fn().mockResolvedValue({})
        };
        const sec = createMiddleware({
            cfg,
            RefreshToken: model,
            getUserById: vi.fn().mockResolvedValue({ id: "USR1", name: "Admin", role: "owner", companyCode: "PT-001" }),
            getRolePermissions: vi.fn(async () => [])
        });
        const res = mockRes();
        await sec.refreshHandler(mockReq({ body: { refreshToken: rt } }), res, () => {});
        expect(res.statusCode).toBe(200);
        expect(res.body.accessToken).toBeTruthy();
        expect(res.body.refreshToken).toBeTruthy();
        expect(res.body.refreshToken).not.toBe(rt);
    });

    it("logout me-revoke refresh token", async () => {
        const rt = signRefreshToken(user, cfg, "user");
        const res = mockRes();
        await security.logoutHandler(mockReq({ body: { refreshToken: rt } }), res, () => {});
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true });
    });
});
