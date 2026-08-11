/**
 * Google Auth Route — Simplified Google Sign-In integration.
 *
 * The client-side uses Google OAuth2 to get an access token,
 * then fetches user info from https://www.googleapis.com/oauth2/v3/userinfo.
 * The verified email/name is sent to this endpoint for authentication.
 *
 * POST /api/auth/google
 *   Body: { credential, email, name }
 *     - credential: Google OAuth2 access token (for optional server-side verification)
 *     - email: User's email from Google's verified userinfo API
 *     - name: User's display name from Google
 *
 * Responses:
 *   200 { exists: true, user }  → Auto-login
 *   404 { exists: false, googleUser } → First time, prompt registration
 *
 * @module server/routes/auth-google
 */

import { Router } from "express";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { verifyGoogleCredential } from "../../../../packages/smart-security/src/index.js";
import { security, audit } from "../security.js";

const router = Router();

/**
 * GET /api/auth/google/config
 *
 * Ekspos Google OAuth Client ID ke client (login page). Client ID BUKAN
 * rahasia (dikirim ke browser oleh Google sendiri); hanya origin yang
 * terdaftar di Google Cloud Console yang bisa memakainya.
 *
 * Sebelum SP-027 M3 hardening, client mengandalkan VITE_GOOGLE_CLIENT_ID
 * yang tidak pernah di-set saat build → tombol Google selalu error
 * "Login Google belum dikonfigurasi". Endpoint ini menjadikan server
 * (apps/inventory/server/.env) sumber kebenaran konfigurasi.
 */
router.get("/config", (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
});

/**
 * POST /api/auth/google
 *
 * Flow (SP-027 M3 hardening):
 * 1. TERIMA credential (access token Google) dari client
 * 2. VERIFIKASI di server: panggil Google userinfo endpoint dengan credential
 *    — endpoint ini MENERBITKAN JWT, jadi server tidak boleh mempercayai
 *    klaim email dari client tanpa verifikasi (mencegah account takeover).
 * 3. Jika user sudah ada → login (return user + company + token)
 * 4. Jika belum → return 404 untuk redirect ke registrasi
 */
router.post("/", async (req, res) => {
    try {
        const { email, name, credential } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email tidak ditemukan dari akun Google" });
        }

        // ── Verifikasi credential di server (wajib, SP-027 M3 hardening) ──
        // Endpoint ini MENERBITKAN JWT, jadi server tidak boleh mempercayai
        // klaim email dari client tanpa verifikasi ke Google userinfo API.
        const verify = await verifyGoogleCredential(credential, { expectedEmail: email });
        if (!verify.ok) {
            if (verify.status >= 500) console.error("[Google Auth] Verifikasi gagal:", verify.error);
            return res.status(verify.status).json({ error: verify.error });
        }
        const googleUser = verify.user;

        const displayName = name || email.split("@")[0];

        // Check if user exists with this email
        const existingUser = await User.findOne({
            email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
            active: true
        }).select("-password").lean();

        if (existingUser) {
            // Validasi: company masih ada dan aktif
            if (existingUser.companyCode) {
                const company = await Company.findOne({ code: existingUser.companyCode });
                if (!company) {
                    return res.status(403).json({
                        error: "Perusahaan Anda telah dihapus. Silakan hubungi admin untuk informasi lebih lanjut."
                    });
                }
                if (company.active === false) {
                    return res.status(403).json({
                        error: "Status perusahaan tidak aktif. Silakan hubungi admin aplikasi Anda."
                    });
                }
            }

            // Email sudah terdaftar — auto-login langsung (SP-027 M3: issue JWT pair)
            const safeUser = {
                id: existingUser._id,
                name: existingUser.name,
                email: existingUser.email,
                username: existingUser.username,
                role: existingUser.role || "admin",
                companyCode: existingUser.companyCode || existingUser.institution || null
            };
            const pair = await security.issueTokens(safeUser, "user", req, res);

            audit.login({
                actorId: String(existingUser._id),
                actorName: existingUser.name,
                actorType: "user",
                metadata: { method: "google" },
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || ""
            });

            return res.status(200).json({
                exists: true,
                user: {
                    id: existingUser._id,
                    name: existingUser.name,
                    email: existingUser.email,
                    username: existingUser.username,
                    role: existingUser.role || "admin",
                    institution: existingUser.companyCode || existingUser.institution || ""
                },
                ...pair
            });
        }

        // First time → return info for registration
        return res.status(404).json({
            exists: false,
            googleUser: {
                email: email,
                name: displayName,
                picture: null
            }
        });
    } catch (err) {
        console.error("[Google Auth] Error:", err.message);
        res.status(500).json({ error: err.message || "Gagal autentikasi Google" });
    }
});

export default router;
