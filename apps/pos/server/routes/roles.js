import { Router } from "express";
import { Role } from "../models/Role.js";
import { audit } from "../security.js";

const router = Router();

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

// Role bawaan sistem — tidak boleh dihapus (agar user & akses tetap aman)
const BUILTIN_ROLES = ["supervisor", "operator", "admin", "owner", "superadmin"];

/** Pastikan setiap role punya dokumen permission (linkage role ↔ permission). */
async function ensurePermissionDoc(roleName) {
    try {
        const { Permission } = await import("../models/Permission.js");
        const exists = await Permission.findOne({ roleName });
        if (!exists) await Permission.create({ roleName, permissions: [] });
    } catch (e) {
        console.warn(`[Roles] ensurePermissionDoc(${roleName}) failed:`, e.message);
    }
}

// List with search & pagination
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();
        let query = {};
        if (search) {
            query.$or = [
                { label: { $regex: search, $options: "i" } },
                { name: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Role.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Role.find(query)
            .sort({ level: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get by ID
router.get("/:id", async (req, res) => {
    try {
        const item = await Role.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create
router.post("/", async (req, res) => {
    try {
        if (!req.body.name || !req.body.label) {
            return res.status(400).json({ error: "ID Role dan Nama Role wajib diisi" });
        }
        const item = await Role.create(req.body);
        // Buat mapping permission kosong agar role langsung siap dikelola di halaman Permission
        await ensurePermissionDoc(item.name);

        audit.log({
            ...auditMeta(req),
            action: "role.create",
            category: "permission",
            targetType: "role",
            targetId: String(item._id),
            targetName: item.name
        });

        res.status(201).json(item);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update
router.put("/:id", async (req, res) => {
    try {
        const existing = await Role.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        // ID role bawaan tidak boleh diganti (akan memutus linkage user → permission)
        if (BUILTIN_ROLES.includes(existing.name) && req.body.name && req.body.name !== existing.name) {
            return res.status(400).json({ error: `ID role bawaan "${existing.name}" tidak dapat diubah` });
        }
        const item = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });

        audit.log({
            ...auditMeta(req),
            action: "role.update",
            category: "permission",
            targetType: "role",
            targetId: String(item._id),
            targetName: item.name
        });

        res.json(item);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete
router.delete("/:id", async (req, res) => {
    try {
        const existing = await Role.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (BUILTIN_ROLES.includes(existing.name)) {
            return res.status(400).json({ error: `Role bawaan "${existing.label}" tidak dapat dihapus` });
        }
        await Role.findByIdAndDelete(req.params.id);
        // Bersihkan mapping permission milik role tersebut
        try {
            const { Permission } = await import("../models/Permission.js");
            await Permission.deleteOne({ roleName: existing.name });
        } catch (e) {
            console.warn(`[Roles] Permission cleanup for ${existing.name} failed:`, e.message);
        }

        audit.log({
            ...auditMeta(req),
            action: "role.delete",
            category: "permission",
            targetType: "role",
            targetId: req.params.id,
            targetName: existing.name
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
