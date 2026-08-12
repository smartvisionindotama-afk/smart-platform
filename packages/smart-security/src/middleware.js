/**
 * Middleware — authenticate / authorize / permission / company scope /
 * refresh token / logout.
 *
 * SP-027 M3: seluruh otorisasi dilakukan di SERVER. Middleware reusable
 * dan di-inject dengan model (RefreshToken) + resolver per server.
 *
 * @module @smart/security/middleware
 */

import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    sha256,
    refreshTokenExpiryMs,
    accessTokenTtlSeconds
} from "./tokens.js";
import { parseCookies, buildCookie, clearCookie } from "./cookies.js";

/**
 * Cek apakah array permission memenuhi permission yang diminta.
 * Mendukung wildcard "*" dan prefix "app.resource.*".
 * @param {string[]} perms
 * @param {string} required
 * @returns {boolean}
 */
export function hasPermission(perms, required) {
    if (!Array.isArray(perms) || perms.length === 0) {
        return false;
    }
    if (perms.includes("*")) {
        return true;
    }
    if (perms.includes(required)) {
        return true;
    }
    const reqParts = required.split(".");
    for (const p of perms) {
        if (typeof p === "string" && p.endsWith(".*")) {
            const prefix = p.slice(0, -2).split(".");
            if (
                reqParts.length >= prefix.length &&
                prefix.every((part, i) => reqParts[i] === part)
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Factory middleware keamanan.
 * @param {object} opts
 * @param {object} opts.cfg Security config
 * @param {object} opts.RefreshToken Mongoose model RefreshToken
 * @param {Function} opts.getUserById async (id, type, claims) => user|null — user harus { id|_id, name, username, email, role, companyCode }
 * @param {Function} [opts.getRolePermissions] async (role) => string[] — resolver permission role
 * @param {string} [opts.expectedAudience] "console" | "inventory" — jika di-set, token dari server lain DITOLAK (audience check)
 * @param {string} [opts.audience] Audience untuk token yang diterbitkan server ini
 * @returns {object} Middleware set
 */
export function createMiddleware({ cfg, RefreshToken, getUserById, getRolePermissions, expectedAudience, audience }) {
    const ownAudience = audience || expectedAudience || null;

    function audienceMatches(payload) {
        if (!expectedAudience) {
            return true; // tidak dikonfigurasi → tidak enforce (backward compat / test)
        }
        if (!payload.aud) {
            return false; // token lama tanpa klaim aud → tolak di server yang enforce
        }
        return payload.aud === expectedAudience;
    }

    async function extractAuthPayload(req) {
        const header = req.headers.authorization || "";
        if (!header.startsWith("Bearer ")) {
            return null;
        }
        const token = header.slice(7).trim();
        if (!token) {
            return null;
        }
        try {
            const payload = verifyAccessToken(token, cfg);
            if (!audienceMatches(payload)) {
                return null;
            }
            return payload;
        } catch {
            return null;
        }
    }

    /**
     * authenticate — verifikasi access token di header Authorization.
     * @param {object} [options]
     * @param {boolean} [options.soft] Mode soft: jika token tidak ada/tidak
     *   valid, LANJUTKAN tanpa req.auth (endpoint tetap berjalan sebagai
     *   publik). Dipakai endpoint publik yang memberi payload lebih lengkap
     *   hanya kepada user terautentikasi (mis. GET /api/companies).
     */
    async function authenticate(req, res, next, options = {}) {
        const payload = await extractAuthPayload(req);
        if (!payload) {
            if (options.soft) {
                return next();
            }
            return res.status(401).json({ error: "Unauthorized — token tidak valid atau kadaluarsa" });
        }
        req.auth = payload;
        req.user = {
            id: payload.sub,
            type: payload.type,
            name: payload.name,
            username: payload.username,
            role: payload.role,
            companyCode: payload.companyCode || null
        };
        next();
    }

    /**
     * requireSuperAdmin — endpoint khusus platform Super Admin.
     */
    function requireSuperAdmin(req, res, next) {
        if (!req.auth || req.auth.type !== "superadmin") {
            return res.status(403).json({ error: "Forbidden — akses khusus Super Admin" });
        }
        next();
    }

    /**
     * permission(required) — verifikasi permission via resolver role di server.
     */
    function permission(required) {
        return async function permissionMiddleware(req, res, next) {
            if (!req.auth) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            if (req.auth.type === "superadmin") {
                return next();
            }
            let perms = [];
            try {
                perms = (await getRolePermissions(req.auth.role)) || [];
            } catch {
                perms = [];
            }
            if (hasPermission(perms, required)) {
                return next();
            }
            return res.status(403).json({ error: `Forbidden — permission "${required}" diperlukan` });
        };
    }

    /**
     * methodPermissions(map) — pilih permission berdasarkan HTTP method.
     * Contoh: { POST: "inventory.barang.create", PUT: "inventory.barang.update", DELETE: "inventory.barang.delete" }
     */
    function methodPermissions(map) {
        return (req, res, next) => {
            const required = map[req.method];
            if (!required) {
                return next();
            }
            return permission(required)(req, res, next);
        };
    }

    /**
     * resourcePermissions(resource) — permission CRUD per resource master data.
     * GET: opsional read (default: dibuka untuk auth + company scope saja,
     * agar dropdown lintas-halaman tidak patah — backward compatible).
     */
    function resourcePermissions(resource, readOpen = true) {
        const map = {
            GET: readOpen ? null : `inventory.${resource}.read`,
            POST: `inventory.${resource}.create`,
            PUT: `inventory.${resource}.update`,
            DELETE: `inventory.${resource}.delete`
        };
        return methodPermissions(map);
    }

    /**
     * companyScope — verifikasi Company Access:
     * - superadmin: platform-wide (skip)
     * - user: token.companyCode wajib sama dengan header x-company-code
     *   (atau diisi dari token agar tidak ada "no header = semua data").
     */
    function companyScope(req, res, next) {
        if (!req.auth) {
            return next();
        }
        if (req.auth.type === "superadmin") {
            return next();
        }
        const tokenCompany = req.auth.companyCode;
        // Defense-in-depth: user-token tanpa companyCode → tolak (hindari "tanpa
        // header = semua data"). Superadmin sudah di-skip di atas.
        if (!tokenCompany) {
            return res.status(403).json({ error: "Forbidden — akun tidak memiliki akses perusahaan" });
        }
        const headerCompany = req.headers["x-company-code"];
        if (headerCompany && headerCompany !== tokenCompany) {
            return res.status(403).json({ error: "Forbidden — akses perusahaan tidak sesuai" });
        }
        if (!headerCompany) {
            req.headers["x-company-code"] = tokenCompany;
        }
        next();
    }

    /** Set cookie refresh token httpOnly (jika res tersedia). */
    function setRefreshCookie(res, refreshToken) {
        if (!res) return;
        const maxAgeSeconds = refreshTokenExpiryMs(cfg) / 1000;
        const opts = {
            httpOnly: true,
            secure: cfg.cookieSecure,
            sameSite: "lax",
            path: "/"
        };
        if (typeof res.cookie === "function") {
            // M6-FIX v4 — Express `res.cookie` menginterpretasi `maxAge` sebagai
            // MILIDETIK (res.cookie → expires = Date.now() + maxAge, lalu
            // Max-Age header = maxAge/1000). Mengirim detik (maxAgeSeconds)
            // membuat cookie refresh kedaluwarsa ~10 menit, bukan 7 hari →
            // kasir yang jeda >10 menit (mis. saat tutup shift) selalu dapat
            // 401 "token tidak valid" (refresh cookie sudah mati).
            res.cookie(cfg.cookieName, refreshToken, { ...opts, maxAge: maxAgeSeconds * 1000 });
        } else if (typeof res.setHeader === "function") {
            // Jalur non-Express: buildCookie memakai maxAgeSeconds (detik) — benar.
            res.setHeader("Set-Cookie", buildCookie(cfg.cookieName, refreshToken, { ...opts, maxAgeSeconds }));
        }
    }

    /** Hapus cookie refresh token (logout / refresh gagal). */
    function clearRefreshCookie(res) {
        if (!res) return;
        if (typeof res.clearCookie === "function") {
            res.clearCookie(cfg.cookieName, { httpOnly: true, secure: cfg.cookieSecure, sameSite: "lax", path: "/" });
        } else if (typeof res.setHeader === "function") {
            res.setHeader("Set-Cookie", clearCookie(cfg.cookieName, { secure: cfg.cookieSecure }));
        }
    }

    /** Ambil refresh token dari cookie (prioritas) lalu body (backward compat). */
    function extractRefreshToken(req) {
        const cookieToken = parseCookies(req.headers?.cookie || "")[cfg.cookieName];
        const bodyToken = req.body?.refreshToken;
        return (cookieToken && typeof cookieToken === "string" && cookieToken) || (bodyToken && typeof bodyToken === "string" && bodyToken) || null;
    }

    /**
     * issueTokens — buat pasangan access + refresh token, simpan refresh
     * token (hash) ke store, dan set httpOnly cookie (jika res diberikan).
     * @param {object} user
     * @param {string} type
     * @param {object} req
     * @param {object} [res] Express response — untuk set httpOnly cookie
     * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number }>}
     */
    async function issueTokens(user, type, req, res) {
        const accessToken = signAccessToken(user, cfg, type, ownAudience);
        const refreshToken = signRefreshToken(user, cfg, type, ownAudience);
        try {
            await RefreshToken.create({
                tokenHash: sha256(refreshToken),
                userId: String(user.id ?? user._id ?? ""),
                userType: type,
                role: user.role || null,
                companyCode: user.companyCode || user.institution || null,
                expiresAt: new Date(Date.now() + refreshTokenExpiryMs(cfg)),
                ip: req.ip || req.socket?.remoteAddress || "",
                userAgent: (req.headers["user-agent"] || "").slice(0, 300),
                createdAt: new Date()
            });
        } catch (err) {
            console.warn("[Security] gagal menyimpan refresh token:", err.message);
        }
        setRefreshCookie(res, refreshToken);
        return {
            accessToken,
            refreshToken,
            expiresIn: accessTokenTtlSeconds(cfg)
        };
    }

    /**
     * refreshHandler — POST (cookie httpOnly atau body { refreshToken })
     * → verifikasi + rotasi (revoke lama, issue baru).
     */
    async function refreshHandler(req, res) {
        const refreshToken = extractRefreshToken(req);
        if (!refreshToken) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: "Refresh token diperlukan" });
        }

        let payload;
        try {
            payload = verifyRefreshToken(refreshToken, cfg);
            if (!audienceMatches(payload)) {
                return res.status(401).json({ error: "Refresh token tidak valid" });
            }
        } catch {
            clearRefreshCookie(res);
            return res.status(401).json({ error: "Refresh token tidak valid" });
        }

        const tokenHash = sha256(refreshToken);
        let stored = null;
        try {
            stored = await RefreshToken.findOne({ tokenHash });
        } catch {
            stored = null;
        }
        if (!stored || stored.revokedAt) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: "Refresh token telah dicabut" });
        }
        if (!stored.expiresAt || new Date(stored.expiresAt) < new Date()) {
            try {
                await RefreshToken.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
            } catch { /* ignore */ }
            clearRefreshCookie(res);
            return res.status(401).json({ error: "Refresh token kadaluarsa" });
        }

        let user = null;
        try {
            user = await getUserById(payload.sub, payload.type, payload);
        } catch {
            user = null;
        }
        if (!user) {
            try {
                await RefreshToken.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
            } catch { /* ignore */ }
            clearRefreshCookie(res);
            return res.status(401).json({ error: "Akun tidak ditemukan" });
        }

        // Rotasi token
        try {
            await RefreshToken.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
        } catch { /* ignore */ }

        const pair = await issueTokens(user, payload.type, req, res);
        return res.json(pair);
    }

    /**
     * logoutHandler — POST (cookie httpOnly atau body { refreshToken })
     * → revoke token di store + hapus cookie.
     */
    async function logoutHandler(req, res) {
        const refreshToken = extractRefreshToken(req);
        if (refreshToken) {
            try {
                await RefreshToken.updateOne(
                    { tokenHash: sha256(refreshToken) },
                    { $set: { revokedAt: new Date() } }
                );
            } catch { /* ignore */ }
        }
        clearRefreshCookie(res);
        return res.json({ success: true });
    }

    return {
        config: cfg,
        bcryptRound: cfg.bcryptRound,
        authenticate,
        requireSuperAdmin,
        permission,
        methodPermissions,
        resourcePermissions,
        companyScope,
        issueTokens,
        refreshHandler,
        logoutHandler
    };
}

export default { createMiddleware, hasPermission };
