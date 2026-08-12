import { Router } from "express";
import { SuperAdmin } from "../models/SuperAdmin.js";
import { Company } from "../models/Company.js";
import { Application } from "../models/Application.js";
import { hashPassword, verifyPassword, validateLoginInput, validateNewPassword, signImpersonationToken } from "../../../../packages/smart-security/src/index.js";
import { security, audit } from "../security.js";

const router = Router();

/**
 * Apakah company memiliki akses ke aplikasi (slug)? — fungsi murni (testable).
 *
 * SP-027 PRE-M5 round 4: akses company→app kini disimpan di server (Company.apps),
 * bukan hanya state in-memory browser. Impersonation hanya boleh untuk company
 * yang terhubung ke aplikasi tujuan.
 *
 * @param {object|null} company Dokumen Company (boleh null)
 * @param {string} appSlug Slug aplikasi tujuan (mis. "inventory")
 * @returns {boolean}
 */
export function companyHasAppAccess(company, appSlug) {
    if (!company || !appSlug) return false;
    if (Array.isArray(company.apps)) {
        return company.apps.includes(appSlug);
    }
    return false;
}

/**
 * POST /api/superadmins/login
 * Authenticate superadmin — bcrypt compare + issue access/refresh token.
 */
router.post("/login", async (req, res) => {
    const input = validateLoginInput(req.body);
    if (!input.ok) {
        return res.status(400).json({ error: input.error });
    }

    const lower = input.username.toLowerCase();
    let sa = null;
    try {
        sa = await SuperAdmin.findOne({
            $or: [
                { username: { $regex: `^${escapeRegex(lower)}$`, $options: "i" } },
                { email: { $regex: `^${escapeRegex(lower)}$`, $options: "i" } }
            ],
            active: true
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    const ip = req.ip || "";
    const userAgent = req.headers["user-agent"] || "";

    if (!sa || !(await verifyPassword(input.password, sa.password))) {
        audit.failedLogin({
            actorName: lower,
            actorType: "superadmin",
            targetName: lower,
            ip,
            userAgent
        });
        return res.status(401).json({ error: "Username atau password salah" });
    }

    const user = {
        id: sa._id,
        username: sa.username,
        name: sa.name,
        email: sa.email,
        role: "superadmin",
        companyCode: null
    };

    const pair = await security.issueTokens(user, "superadmin", req, res);

    audit.login({
        actorId: String(sa._id),
        actorName: sa.name,
        actorType: "superadmin",
        ip,
        userAgent
    });

    res.json({
        id: String(sa._id),
        username: sa.username,
        name: sa.name,
        email: sa.email,
        role: "superadmin",
        institution: "PLATFORM",
        ...pair
    });
});

/**
 * POST /api/superadmins/refresh
 * Rotasi refresh token → pasangan baru.
 */
router.post("/refresh", security.refreshHandler);

/**
 * POST /api/superadmins/logout
 * Revoke refresh token + audit logout.
 */
router.post("/logout", async (req, res) => {
    const ip = req.ip || "";
    const userAgent = req.headers["user-agent"] || "";
    audit.logout({ actorName: "superadmin", actorType: "superadmin", ip, userAgent });
    return security.logoutHandler(req, res);
});

/**
 * GET /api/superadmins/me
 * Profil superadmin dari access token (dipakai client untuk validasi sesi).
 */
router.get("/me", security.authenticate, security.requireSuperAdmin, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        name: req.user.name,
        role: "superadmin",
        institution: "PLATFORM"
    });
});

/**
 * POST /api/superadmins/impersonation-token
 * Keluarkan token impersonation bertanda tangan (handoff Console → app).
 *
 * SP-027 PRE-M5 round 4: hanya company yang TERHUBUNG ke aplikasi (Company.apps)
 * yang boleh di-impersonate — konsisten dengan UI "Registered Apps".
 */
router.post("/impersonation-token", security.authenticate, security.requireSuperAdmin, async (req, res) => {
    try {
        const { appSlug, companyCode, companyName } = req.body || {};
        if (!appSlug || !companyCode || !companyName) {
            return res.status(400).json({ error: "appSlug, companyCode, dan companyName wajib diisi" });
        }

        // Aplikasi tujuan harus terdaftar & aktif di registry (SP-027 PRE-M5
        // round 5: Application collection) — mencegah slug acak.
        const appDoc = await Application.findOne({ slug: appSlug }).lean();
        if (!appDoc || appDoc.active === false) {
            return res.status(404).json({ error: `Aplikasi "${appSlug}" tidak terdaftar atau tidak aktif` });
        }

        // Akses harus disetujui oleh Super Admin via Edit Company → Akses Aplikasi.
        // Urutan: company ada → aktif → punya akses aplikasi (agar pesan error
        // sesuai kondisi sebenarnya).
        const company = await Company.findOne({ code: companyCode });
        if (!company) {
            return res.status(404).json({ error: `Perusahaan "${companyCode}" tidak ditemukan` });
        }
        if (company.active === false) {
            audit.superadminActivity({
                actorId: req.user.id,
                actorName: req.user.name,
                action: "impersonation.denied",
                targetType: "company",
                targetId: company.code,
                targetName: company.name,
                metadata: { application: appSlug, reason: "company_inactive" },
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || ""
            });
            return res.status(403).json({ error: "Status perusahaan tidak aktif" });
        }
        if (!companyHasAppAccess(company, appSlug)) {
            audit.superadminActivity({
                actorId: req.user.id,
                actorName: req.user.name,
                action: "impersonation.denied",
                targetType: "company",
                targetId: company.code,
                targetName: company.name,
                metadata: { application: appSlug, reason: "company_not_connected" },
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || ""
            });
            return res.status(403).json({
                error: `Perusahaan "${companyCode}" belum terhubung ke aplikasi "${appSlug}". Aktifkan akses aplikasi di Edit Perusahaan terlebih dahulu.`
            });
        }

        const token = signImpersonationToken(
            {
                superAdminId: req.user.id,
                superAdminName: req.user.name,
                companyCode,
                companyName,
                userId: `${companyCode}-admin`,
                userName: `Admin ${companyName}`,
                role: "owner",
                application: appSlug
            },
            security.config
        );

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "impersonation.token",
            targetType: "company",
            targetId: companyCode,
            targetName: companyName,
            metadata: { application: appSlug },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/superadmins
 * List all superadmins (without passwords) — protected.
 */
router.get("/", security.authenticate, security.requireSuperAdmin, async (req, res) => {
    try {
        const list = await SuperAdmin.find().sort({ createdAt: -1 });
        // Password otomatis di-strip by toJSON()
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/superadmins
 * Create a new superadmin — password di-hash bcrypt.
 */
router.post("/", security.authenticate, security.requireSuperAdmin, async (req, res) => {
    try {
        const { username, password, name, email, active } = req.body;
        if (!username || !password || !name) {
            return res.status(400).json({ error: "Username, password, dan nama wajib diisi" });
        }
        const passCheck = validateNewPassword(password);
        if (!passCheck.ok) {
            return res.status(400).json({ error: passCheck.error });
        }

        const existing = await SuperAdmin.findOne({ username: { $regex: `^${escapeRegex(username.toLowerCase())}$`, $options: "i" } });
        if (existing) {
            return res.status(409).json({ error: "Username sudah terdaftar" });
        }

        const hashed = await hashPassword(password, security.bcryptRound);
        const sa = await SuperAdmin.create({
            username: username.toLowerCase(),
            password: hashed,
            name,
            email: email || "",
            active: active !== false
        });

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "superadmin.create",
            targetType: "superadmin",
            targetId: String(sa._id),
            targetName: sa.username,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.status(201).json(sa.toJSON());
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Username sudah terdaftar" });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/superadmins/:id
 * Update superadmin — password (opsional) di-hash bcrypt + audit password change.
 */
router.put("/:id", security.authenticate, security.requireSuperAdmin, async (req, res) => {
    try {
        const { password, name, email, active } = req.body;
        const update = {};
        if (password) {
            const passCheck = validateNewPassword(password);
            if (!passCheck.ok) {
                return res.status(400).json({ error: passCheck.error });
            }
            update.password = await hashPassword(password, security.bcryptRound);
        }
        if (name !== undefined) update.name = name;
        if (email !== undefined) update.email = email;
        if (active !== undefined) update.active = active;
        update.updatedAt = Date.now();

        const sa = await SuperAdmin.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        );

        if (!sa) {
            return res.status(404).json({ error: "Superadmin tidak ditemukan" });
        }

        if (password) {
            audit.passwordChange({
                actorId: req.user.id,
                actorName: req.user.name,
                actorType: "superadmin",
                targetType: "superadmin",
                targetId: String(sa._id),
                targetName: sa.username,
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || ""
            });
        }
        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "superadmin.update",
            targetType: "superadmin",
            targetId: String(sa._id),
            targetName: sa.username,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json(sa.toJSON());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/superadmins/:id
 * Delete superadmin.
 */
router.delete("/:id", security.authenticate, security.requireSuperAdmin, async (req, res) => {
    try {
        const sa = await SuperAdmin.findByIdAndDelete(req.params.id);
        if (!sa) {
            return res.status(404).json({ error: "Superadmin tidak ditemukan" });
        }

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "superadmin.delete",
            targetType: "superadmin",
            targetId: req.params.id,
            targetName: sa.username,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default router;
