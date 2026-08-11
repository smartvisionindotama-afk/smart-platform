import { Router } from "express";
import { User } from "../models/User.js";
import { hashPassword, validateNewPassword } from "../../../../packages/smart-security/src/index.js";
import { security, audit } from "../security.js";
import { loadCompanyConfig, checkKasirLimit } from "../services/company-limits.js";

const router = Router();

/**
 * Map error Mongo duplicate key (E11000) → pesan ramah. Tanpa ini admin
 * melihat pesan mentah "E11000 duplicate key error ... username_1 ..."
 * saat username/email sudah dipakai (mis. user role kasir yang tidak tampil
 * karena daftar sempat jatuh ke fallback lokal).
 * @param {Error} err
 * @returns {string}
 */
function friendlyError(err) {
    if (err && err.code === 11000) {
        const key = err.keyPattern ? Object.keys(err.keyPattern)[0] : "data";
        if (key === "username") {
            return "Username sudah digunakan — muat ulang daftar user untuk melihatnya.";
        }
        return `Nilai ${key} sudah digunakan.`;
    }
    return err.message;
}

/** Audit helper — isi aktor dari req.user (token). */
function auditMeta(req) {
    return {
        actorId: req.user?.id || null,
        actorName: req.user?.name || req.user?.username || "System",
        actorType: "user",
        ip: req.ip || "",
        userAgent: req.headers["user-agent"] || ""
    };
}

// List with search & pagination
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();
        const allCompanies = req.query.allCompanies === "true";

        const query = {};
        if (!allCompanies && req.headers["x-company-code"]) {
            query.companyCode = req.headers["x-company-code"];
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const total = await User.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Helper: check if a user belongs to the requesting company.
 */
function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true;
    return item.companyCode === companyCode;
}

// Get by ID (scoped to company)
router.get("/:id", async (req, res) => {
    try {
        const item = await User.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) {
            return res.status(404).json({ error: "Not found" });
        }
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create (auto-tag with company from header) — password di-hash bcrypt
router.post("/", async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data.password) data.password = "changeme123";
        const passCheck = validateNewPassword(data.password);
        if (!passCheck.ok) {
            return res.status(400).json({ error: passCheck.error });
        }
        data.password = await hashPassword(data.password, security.bcryptRound);
        // Auto-tag with company code from header
        const companyCode = req.headers["x-company-code"];
        if (companyCode && !data.companyCode) {
            data.companyCode = companyCode;
        }

        // SP-029 M2 (Rule 17): kuota kasir dari Master Platform (Company.jumlahKasir).
        // Hanya user ber-role "kasir" yang dihitung — admin/owner tidak terbatas.
        const newRole = String(data.role || "").toLowerCase();
        if (companyCode && newRole === "kasir") {
            const cfg = await loadCompanyConfig(companyCode);
            const activeKasir = await User.countDocuments({
                companyCode,
                role: { $regex: /^kasir$/i },
                active: true
            });
            const check = checkKasirLimit(cfg, activeKasir);
            if (!check.allowed) {
                return res.status(400).json({ error: check.message, limit: check.limit, current: check.current });
            }
        }

        const item = await User.create(data);

        audit.log({
            ...auditMeta(req),
            action: "user.create",
            category: "user.manage",
            targetType: "user",
            targetId: String(item._id),
            targetName: item.username
        });

        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ error: friendlyError(err) });
    }
});

// Update (scoped to company) — password (jika diisi) di-hash bcrypt
router.put("/:id", async (req, res) => {
    try {
        const existing = await User.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) {
            return res.status(404).json({ error: "Not found" });
        }
        const data = { ...req.body };
        // Only update password if provided
        if (data.password === undefined || data.password === "") {
            delete data.password;
        } else {
            const passCheck = validateNewPassword(data.password);
            if (!passCheck.ok) {
                return res.status(400).json({ error: passCheck.error });
            }
            data.password = await hashPassword(data.password, security.bcryptRound);
        }

        const passwordChanged = !!data.password;
        const roleChanged = !!data.role && data.role !== existing.role;

        // SP-029 M2-FIX (v12 review): cegah bypass kuota kasir via edit role.
        // Ubah user non-kasir → kasir melewati cek POST — cek ulang di sini,
        // hitung user kasir aktif LAIN (exclude user yang sedang diedit) agar
        // edit user yang sudah terhitung (ganti password/nama) tidak diblokir.
        const newRole = String(data.role || "").toLowerCase();
        const targetCompany = existing.companyCode || req.headers["x-company-code"];
        if (targetCompany && newRole === "kasir" && String(existing.role || "").toLowerCase() !== "kasir") {
            const cfg = await loadCompanyConfig(targetCompany);
            const otherKasir = await User.countDocuments({
                _id: { $ne: existing._id },
                companyCode: targetCompany,
                role: { $regex: /^kasir$/i },
                active: true
            });
            const check = checkKasirLimit(cfg, otherKasir);
            if (!check.allowed) {
                return res.status(400).json({ error: check.message, limit: check.limit, current: check.current });
            }
        }

        const item = await User.findByIdAndUpdate(req.params.id, data, { new: true });

        const meta = auditMeta(req);
        if (passwordChanged) {
            audit.passwordChange({
                ...meta,
                targetType: "user",
                targetId: String(item._id),
                targetName: item.username
            });
        }
        if (roleChanged) {
            audit.roleChange({
                ...meta,
                targetType: "user",
                targetId: String(item._id),
                targetName: item.username,
                metadata: { from: existing.role, to: item.role }
            });
        }
        audit.log({
            ...meta,
            action: "user.update",
            category: "user.manage",
            targetType: "user",
            targetId: String(item._id),
            targetName: item.username
        });

        res.json(item);
    } catch (err) {
        res.status(400).json({ error: friendlyError(err) });
    }
});

// Delete (scoped to company)
router.delete("/:id", async (req, res) => {
    try {
        const existing = await User.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) {
            return res.status(404).json({ error: "Not found" });
        }
        await User.findByIdAndDelete(req.params.id);

        audit.log({
            ...auditMeta(req),
            action: "user.delete",
            category: "user.manage",
            targetType: "user",
            targetId: req.params.id,
            targetName: existing.username
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
