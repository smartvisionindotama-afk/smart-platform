import { describe, it, expect, vi } from "vitest";
import { verifyGoogleCredential } from "../src/google-verify.js";

/** Buat fake Response minimal. */
function fakeRes({ ok = true, status = 200, user }) {
    return {
        ok,
        status,
        async json() {
            return user;
        }
    };
}

describe("google-verify — verifyGoogleCredential", () => {
    it("menolak tanpa credential (401)", async () => {
        const r = await verifyGoogleCredential(null, { fetchImpl: vi.fn() });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("menolak credential non-string (401)", async () => {
        const r = await verifyGoogleCredential(12345, { fetchImpl: vi.fn() });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("menerima credential valid + email cocok", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            fakeRes({ user: { email: "user@gmail.com", name: "User", verified_email: true } })
        );
        const r = await verifyGoogleCredential("valid-token", { expectedEmail: "user@gmail.com", fetchImpl });
        expect(r.ok).toBe(true);
        expect(r.user.email).toBe("user@gmail.com");
        // Pastikan header Authorization membawa token client
        const [url, opts] = fetchImpl.mock.calls[0];
        expect(url).toBe("https://www.googleapis.com/oauth2/v3/userinfo");
        expect(opts.headers.Authorization).toBe("Bearer valid-token");
    });

    it("email tidak cocok → 401 (mencegah account takeover)", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            fakeRes({ user: { email: "attacker@gmail.com", name: "Attacker" } })
        );
        const r = await verifyGoogleCredential("token", { expectedEmail: "victim@gmail.com", fetchImpl });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("Google menolak token (401) → verifikasi gagal", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(fakeRes({ ok: false, status: 401, user: { error: "invalid_token" } }));
        const r = await verifyGoogleCredential("expired-token", { fetchImpl });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("network error → 503 (jangan bocorkan detail)", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
        const r = await verifyGoogleCredential("token", { fetchImpl });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(503);
    });

    it("respons Google tanpa email → 401", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(fakeRes({ user: { sub: "123", name: "X" } }));
        const r = await verifyGoogleCredential("token", { fetchImpl });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("email_verified=false → 401 (defense-in-depth)", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            fakeRes({ user: { email: "unverified@gmail.com", email_verified: false } })
        );
        const r = await verifyGoogleCredential("token", { fetchImpl });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(401);
    });

    it("email_verified tidak ada (field opsional) → tetap diterima", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            fakeRes({ user: { email: "normal@gmail.com" } })
        );
        const r = await verifyGoogleCredential("token", { expectedEmail: "normal@gmail.com", fetchImpl });
        expect(r.ok).toBe(true);
    });
});
