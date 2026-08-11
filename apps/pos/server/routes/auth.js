import { Router } from "express";
import { User } from "../models/User.js";
import { SuperAdmin } from "../models/SuperAdmin.js";
import { Company } from "../models/Company.js";
import { sendResetPasswordEmailAsync, generateToken } from "../services/email.js";
import {
    verifyPassword,
    hashPassword,
    validateLoginInput,
    validateNewPassword,
    verifyImpersonationToken,
    verifyRefreshToken
} from "../../../../packages/smart-security/src/index.js";
import { security, audit } from "../security.js";
import { enforcePosEntitlement } from "../services/entitlement-check.js";
import { POS_APP_SLUG, companyHasAppAccess, normalizeCompanyConfig } from "../services/company-config.js";

const router = Router();

// Forgot Password — send reset email
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ error: "Email wajib diisi" });
        }

        // Cari user atau superadmin dengan email tersebut
        let account = await User.findOne({
            email: { $regex: `^${escapeRegex(email.toLowerCase())}$`, $options: "i" },
            active: true
        });

        let accountType = "user";
        if (!account) {
            account = await SuperAdmin.findOne({
                email: { $regex: `^${escapeRegex(email.toLowerCase())}$`, $options: "i" },
                active: true
            });
            accountType = "superadmin";
        }

        // Selalu return success meskipun email tidak ditemukan (security)
        if (!account) {
            return res.json({ message: "Jika email terdaftar, link reset password telah dikirim" });
        }

        // Generate reset token (berlaku 1 jam)
        const token = generateToken();
        account.resetToken = token;
        account.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await account.save();

        // Kirim email (fire-and-forget — tidak blocking response)
        sendResetPasswordEmailAsync(account.email, token, account.name, accountType);

        res.json({ message: "Jika email terdaftar, link reset password telah dikirim" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset Password — validate token and update password (bcrypt hash)
router.post("/reset-password", async (req, res) => {
    try {
        const { token, email, password } = req.body;
        if (!token || !email || !password) {
            return res.status(400).json({ error: "Token, email, dan password baru wajib diisi" });
        }

        const passCheck = validateNewPassword(password);
        if (!passCheck.ok) {
            return res.status(400).json({ error: passCheck.error });
        }

        // Cari user
        let account = await User.findOne({
            email: { $regex: `^${escapeRegex(email.toLowerCase())}$`, $options: "i" },
            resetToken: token,
            resetTokenExpiry: { $gt: new Date() },
            active: true
        });

        let accountType = "user";
        if (!account) {
            account = await SuperAdmin.findOne({
                email: { $regex: `^${escapeRegex(email.toLowerCase())}$`, $options: "i" },
                resetToken: token,
                resetTokenExpiry: { $gt: new Date() },
                active: true
            });
            accountType = "superadmin";
        }

        if (!account) {
            return res.status(400).json({ error: "Token tidak valid atau sudah kadaluarsa" });
        }

        // Update password (bcrypt) dan hapus token
        account.password = await hashPassword(password, security.bcryptRound);
        account.resetToken = null;
        account.resetTokenExpiry = null;
        await account.save();

        audit.passwordChange({
            actorId: String(account._id),
            actorName: account.name,
            actorType: accountType === "superadmin" ? "superadmin" : "user",
            targetType: accountType,
            targetId: String(account._id),
            targetName: account.username || account.email,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        console.log(`[Auth] Password reset successful for ${account.email} (${accountType})`);

        res.json({ message: "Password berhasil direset. Silakan login dengan password baru." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login — validate username/email and password (bcrypt) + issue JWT pair
router.post("/login", async (req, res) => {
    const input = validateLoginInput(req.body);
    if (!input.ok) {
        return res.status(400).json({ error: input.error });
    }

    const lower = input.username.toLowerCase();
    const ip = req.ip || "";
    const userAgent = req.headers["user-agent"] || "";

    let user = null;
    try {
        user = await User.findOne({
            $or: [
                { username: { $regex: `^${escapeRegex(lower)}$`, $options: "i" } },
                { email: { $regex: `^${escapeRegex(lower)}$`, $options: "i" } }
            ],
            active: true
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    // Dokumen Company milik user (di-load saat cek aktif/aktivasi/entitlement)
    let company = null;

    if (!user || !(await verifyPassword(input.password, user.password))) {
        audit.failedLogin({
            actorName: lower,
            actorType: "user",
            targetName: lower,
            ip,
            userAgent
        });
        return res.status(401).json({ error: "Username atau password salah" });
    }

    // Check if user's company exists and is active
    let entitlementStatus = null;
    if (user.companyCode) {
        company = await Company.findOne({ code: user.companyCode });
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

        // SP-029 M2 — Product Activation (Rule 4/17): company harus terhubung
        // ke aplikasi POS di Master Platform (Company.apps). Gate di sini
        // melindungi login USER biasa (bukan hanya impersonation) — defense
        // in depth. Perilaku lama: company tanpa akses → 403 + audit.
        if (!companyHasAppAccess(company)) {
            audit.failedLogin({
                actorId: String(user._id),
                actorName: user.name,
                actorType: "user",
                targetName: user.companyCode || "",
                metadata: { reason: "app_not_connected", application: POS_APP_SLUG },
                ip,
                userAgent
            });
            return res.status(403).json({
                error: `Perusahaan "${user.companyCode}" belum terhubung ke aplikasi POS. Aktifkan akses aplikasi di Master Platform (Edit Perusahaan → Akses Aplikasi).`
            });
        }

        // SP-029 M6-FIX: enforcement entitlement (controlled, M6 §55-56).
        // Mode off (default) → tanpa perubahan; flag → izinkan + tandai;
        // block → tolak bila entitlement inventory disabled & bukan legacy.
        const ent = await enforcePosEntitlement(user.companyCode);
        entitlementStatus = ent.status;
        if (!ent.allowed) {
            audit.failedLogin({
                actorId: String(user._id),
                actorName: user.name,
                actorType: "user",
                targetName: user.companyCode || "",
                metadata: { reason: "entitlement_denied", mode: ent.status.mode },
                ip,
                userAgent
            });
            return res.status(ent.httpStatus || 403).json({ error: ent.error });
        }
    }

    const safeUser = {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        companyCode: user.companyCode || null
    };

    const pair = await security.issueTokens(safeUser, "user", req, res);

    audit.login({
        actorId: String(user._id),
        actorName: user.name,
        actorType: "user",
        targetType: "company",
        targetId: user.companyCode || "",
        ip,
        userAgent
    });

    res.json({
        id: String(user._id),
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        institution: user.companyCode || "",
        companyCode: user.companyCode,
        entitlement: entitlementStatus,
        // SP-029 M2 — konfigurasi produk (dibaca client untuk perilaku UI)
        companyConfig: normalizeCompanyConfig(company),
        ...pair
    });
});

/**
 * GET /api/auth/me
 * Profil user dari access token (dipakai client untuk validasi sesi).
 */
router.get("/me", security.authenticate, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        email: req.user.email || "",
        role: req.user.role,
        institution: req.user.companyCode || "",
        companyCode: req.user.companyCode
    });
});

/**
 * POST /api/auth/refresh
 * Rotasi refresh token → pasangan baru.
 */
router.post("/refresh", security.refreshHandler);

/**
 * POST /api/auth/logout
 * Revoke refresh token + audit logout.
 */
router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body || {};
    let actorName = "user";
    if (refreshToken && typeof refreshToken === "string") {
        try {
            const payload = verifyRefreshTokenLocal(refreshToken);
            actorName = payload?.name || "user";
        } catch {
            // token invalid — tetap lanjut revoke
        }
    }
    audit.logout({
        actorName,
        actorType: "user",
        ip: req.ip || "",
        userAgent: req.headers["user-agent"] || ""
    });
    return security.logoutHandler(req, res);
});

/**
 * POST /api/auth/impersonate
 * Tukar impersonation token (ditandatangani Console) → pasangan token asli
 * untuk sesi impersonasi. Hanya token valid bertipe impersonation yang lolos.
 */
router.post("/impersonate", async (req, res) => {
    try {
        const { token } = req.body || {};
        if (!token || typeof token !== "string") {
            return res.status(400).json({ error: "Token impersonasi diperlukan" });
        }

        let payload;
        try {
            payload = verifyImpersonationToken(token, security.config);
        } catch {
            return res.status(401).json({ error: "Token impersonasi tidak valid atau kadaluarsa" });
        }

        const { companyCode, companyName } = payload;
        if (!companyCode) {
            return res.status(400).json({ error: "companyCode tidak ditemukan di token" });
        }

        // Verifikasi company masih ada & aktif
        const company = await Company.findOne({ code: companyCode });
        if (!company) {
            return res.status(403).json({ error: "Perusahaan tidak ditemukan" });
        }
        if (company.active === false) {
            return res.status(403).json({ error: "Status perusahaan tidak aktif" });
        }

        // SP-029 M6-FIX: enforcement entitlement pada impersonation (sama seperti login).
        const ent = await enforcePosEntitlement(companyCode);
        const entitlementStatus = ent.status;
        if (!ent.allowed) {
            audit.superadminActivity?.({
                actorId: payload.superAdminId || null,
                actorName: payload.superAdminName || "Super Admin",
                action: "impersonation.denied_entitlement",
                targetType: "company",
                targetId: companyCode,
                targetName: companyName,
                metadata: { reason: "entitlement_denied" },
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || ""
            });
            return res.status(ent.httpStatus || 403).json({ error: ent.error });
        }

        // SP-027 PRE-M5 round 4 (defense in depth): company harus terhubung ke
        // aplikasi tujuan. Token impersonation hanya diterbitkan Console setelah
        // cek ini lolos; cek di sini melindungi bila token lama/eksternal bocor.
        const targetApp = payload.application || POS_APP_SLUG;
        if (!companyHasAppAccess(company, targetApp)) {
            return res.status(403).json({
                error: `Perusahaan "${companyCode}" belum terhubung ke aplikasi "${targetApp}". Hubungi Super Admin platform.`
            });
        }

        const impUser = {
            id: payload.userId || `${companyCode}-admin`,
            username: payload.userId || `${companyCode}-admin`,
            name: payload.userName || `Admin ${companyName}`,
            email: "",
            role: "owner",
            companyCode
        };

        const pair = await security.issueTokens(impUser, "user", req, res);

        audit.companySwitch({
            actorId: payload.superAdminId || null,
            actorName: payload.superAdminName || "Super Admin",
            actorType: "superadmin",
            action: "impersonation.start",
            targetType: "company",
            targetId: companyCode,
            targetName: companyName,
            metadata: { application: payload.application || "inventory", impersonatedUserId: impUser.id },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({
            id: impUser.id,
            username: impUser.username,
            name: impUser.name,
            email: "",
            role: "owner",
            institution: companyCode,
            companyCode,
            companyName,
            application: payload.application || POS_APP_SLUG,
            impersonating: true,
            // SP-029 M2 — konfigurasi produk untuk sesi impersonasi
            companyConfig: normalizeCompanyConfig(company),
            superAdmin: {
                id: payload.superAdminId || null,
                name: payload.superAdminName || ""
            },
            entitlement: entitlementStatus,
            ...pair
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Verifikasi refresh token lokal untuk menangkap identitas saat logout.
 * Tidak throw — return null jika invalid.
 */
function verifyRefreshTokenLocal(token) {
    try {
        return verifyRefreshToken(token, security.config);
    } catch {
        return null;
    }
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default router;
