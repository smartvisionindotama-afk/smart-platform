import { describe, it, expect } from "vitest";
import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    sha256,
    signImpersonationToken,
    verifyImpersonationToken,
    randomSecret,
    refreshTokenExpiryMs,
    accessTokenTtlSeconds
} from "../src/tokens.js";

const cfg = {
    jwtSecret: "test-secret",
    jwtRefreshSecret: "test-refresh-secret",
    jwtExpiresIn: "15m",
    jwtRefreshExpiresIn: "7d",
    impersonationTtlMs: 120000
};

const user = { id: "USR1", name: "Admin", username: "admin", role: "owner", companyCode: "PT-001" };

describe("tokens (JWT)", () => {
    it("access token sign & verify", () => {
        const token = signAccessToken(user, cfg, "user");
        const payload = verifyAccessToken(token, cfg);
        expect(payload.sub).toBe("USR1");
        expect(payload.type).toBe("user");
        expect(payload.role).toBe("owner");
        expect(payload.companyCode).toBe("PT-001");
    });

    it("access token ditolak jika secret salah", () => {
        const token = signAccessToken(user, cfg, "user");
        expect(() => verifyAccessToken(token, { ...cfg, jwtSecret: "wrong" })).toThrow();
    });

    it("refresh token sign & verify (jti ada)", () => {
        const token = signRefreshToken(user, cfg, "user");
        const payload = verifyRefreshToken(token, cfg);
        expect(payload.sub).toBe("USR1");
        expect(payload.jti).toBeTruthy();
    });

    it("refresh token ditolak jika di-verify dengan secret access", () => {
        const token = signRefreshToken(user, cfg, "user");
        expect(() => verifyAccessToken(token, cfg)).toThrow();
    });

    it("sha256 konsisten", () => {
        expect(sha256("abc")).toBe(sha256("abc"));
        expect(sha256("abc")).not.toBe("abc");
    });

    it("impersonation token sign & verify", () => {
        const payload = {
            superAdminId: "SA1",
            superAdminName: "Super Admin",
            companyCode: "PT-001",
            companyName: "PT Smart Vision Indotama",
            userId: "PT-001-admin",
            userName: "Admin PT Smart Vision Indotama",
            role: "owner",
            application: "inventory"
        };
        const token = signImpersonationToken(payload, cfg, 120000);
        const verified = verifyImpersonationToken(token, cfg);
        expect(verified.type).toBe("impersonation");
        expect(verified.companyCode).toBe("PT-001");
        expect(verified.superAdminId).toBe("SA1");
    });

    it("impersonation token ditolak jika bukan tipe impersonation", () => {
        const access = signAccessToken(user, cfg, "user");
        expect(() => verifyImpersonationToken(access, cfg)).toThrow();
    });

    it("randomSecret menghasilkan hex", () => {
        expect(randomSecret(16)).toMatch(/^[0-9a-f]{32}$/);
    });

    it("ttl helper menghitung dengan benar", () => {
        expect(refreshTokenExpiryMs(cfg)).toBe(7 * 24 * 60 * 60 * 1000);
        expect(accessTokenTtlSeconds(cfg)).toBe(15 * 60);
    });
});
