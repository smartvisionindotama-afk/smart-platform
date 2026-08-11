import { Router } from "express";
import { SuperAdmin } from "../models/SuperAdmin.js";

const router = Router();

/**
 * POST /api/superadmins/login
 * Authenticate superadmin by username/email and password.
 */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username dan password wajib diisi" });
        }

        const lower = username.toLowerCase();
        const sa = await SuperAdmin.findOne({
            $or: [
                { username: { $regex: `^${escapeRegex(lower)}$`, $options: "i" } },
                { email: { $regex: `^${escapeRegex(lower)}$`, $options: "i" } }
            ],
            active: true
        });

        if (!sa || sa.password !== password) {
            return res.status(401).json({ error: "Username atau password salah" });
        }

        res.json({
            id: sa._id,
            username: sa.username,
            name: sa.name,
            email: sa.email,
            role: "superadmin",
            institution: "PLATFORM"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/superadmins
 * List all superadmins (without passwords).
 */
router.get("/", async (req, res) => {
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
 * Create a new superadmin.
 */
router.post("/", async (req, res) => {
    try {
        const { username, password, name, email, active } = req.body;
        if (!username || !password || !name) {
            return res.status(400).json({ error: "Username, password, dan nama wajib diisi" });
        }

        const existing = await SuperAdmin.findOne({ username: { $regex: `^${escapeRegex(username.toLowerCase())}$`, $options: "i" } });
        if (existing) {
            return res.status(409).json({ error: "Username sudah terdaftar" });
        }

        const sa = await SuperAdmin.create({
            username: username.toLowerCase(),
            password,
            name,
            email: email || "",
            active: active !== false
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
 * Update a superadmin.
 */
router.put("/:id", async (req, res) => {
    try {
        const { password, name, email, active } = req.body;
        const update = {};
        if (password) update.password = password;
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

        res.json(sa.toJSON());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/superadmins/:id
 * Delete a superadmin.
 */
router.delete("/:id", async (req, res) => {
    try {
        const sa = await SuperAdmin.findByIdAndDelete(req.params.id);
        if (!sa) {
            return res.status(404).json({ error: "Superadmin tidak ditemukan" });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default router;
