import { Router } from "express";
import { Permission } from "../models/Permission.js";
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

// Get all roles with their permissions
router.get("/roles", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { Role } = await import("../models/Role.js");
        const roles = await Role.find({}).sort({ level: -1 });
        const perms = await Permission.find();

        const permMap = {};
        perms.forEach(p => { permMap[p.roleName] = p.permissions; });

        const entries = roles.map(r => ({
            id: r._id, name: r.name, label: r.label, level: r.level,
            permissions: permMap[r.name] || [],
            permissionCount: (permMap[r.name] || []).length
        }));

        const total = entries.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;

        res.json({ data: entries.slice(start, start + limit), pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get permissions for a specific role
router.get("/roles/:roleName", async (req, res) => {
    try {
        const perm = await Permission.findOne({ roleName: req.params.roleName });
        res.json(perm ? perm.permissions : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Grant permission to role
router.post("/grant", async (req, res) => {
    try {
        const { roleName, permission } = req.body;
        let perm = await Permission.findOne({ roleName });
        if (!perm) {
            perm = await Permission.create({ roleName, permissions: [permission] });
        } else if (!perm.permissions.includes(permission)) {
            perm.permissions.push(permission);
            await perm.save();
        }

        audit.log({
            ...auditMeta(req),
            action: "permission.grant",
            category: "permission",
            targetType: "role",
            targetId: roleName,
            targetName: roleName,
            metadata: { permission }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Revoke permission from role
router.post("/revoke", async (req, res) => {
    try {
        const { roleName, permission } = req.body;
        const perm = await Permission.findOne({ roleName });
        if (!perm) return res.status(404).json({ error: "Role not found" });

        const idx = perm.permissions.indexOf(permission);
        if (idx === -1) return res.json({ success: false });

        perm.permissions.splice(idx, 1);
        await perm.save();

        audit.log({
            ...auditMeta(req),
            action: "permission.revoke",
            category: "permission",
            targetType: "role",
            targetId: roleName,
            targetName: roleName,
            metadata: { permission }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;
