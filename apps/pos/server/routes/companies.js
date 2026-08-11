import { Router } from "express";
import { Company } from "../models/Company.js";
import { User } from "../models/User.js";

const router = Router();

// List with search, pagination & company scoping
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();

        // Filter by company code (from header or query param)
        const companyCode = req.headers['x-company-code'] || req.query.companyCode || '';

        let query = {};

        if (companyCode) {
            // Match against code, tenantId, tenantCode — any of these could link user to company
            query.$or = [
                { code: companyCode },
                { tenantId: companyCode },
                { tenantCode: companyCode }
            ];
        }

        if (search) {
            const searchQuery = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { code: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { legalId: { $regex: search, $options: "i" } }
                ]
            };
            if (companyCode) {
                // Combine company filter with search — both must match
                query = {
                    $and: [
                        { $or: query.$or },
                        { $or: searchQuery.$or }
                    ]
                };
            } else {
                query = searchQuery;
            }
        }

        const total = await Company.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Company.find(query)
            .sort({ createdAt: -1 })
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
        const item = await Company.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });

        // Include admin username for this company
        const itemObj = item.toObject();
        try {
            const admin = await User.findOne({ companyCode: item.code, role: "owner" }).select("username").lean();
            if (admin) {
                itemObj.adminUsername = admin.username;
            }
        } catch (adminErr) {
            console.warn("[Companies] Failed to fetch admin for", item.code, adminErr.message);
        }

        res.json(itemObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create
router.post("/", async (req, res) => {
    try {
        // Cek duplicate code sebelum create
        const existing = req.body.code ? await Company.findOne({ code: req.body.code }) : null;
        if (existing) {
            return res.status(409).json({
                error: `Kode "${req.body.code}" sudah digunakan oleh ${existing.name || 'perusahaan lain'}. Silakan gunakan kode lain.`
            });
        }

        // Extract admin credentials before creating company
        const { adminUsername, adminPassword, ...companyData } = req.body;

        const item = await Company.create(companyData);

        // Auto-create admin user (owner role) for the new company
        if (adminUsername && adminPassword) {
            try {
                await User.create({
                    username: adminUsername,
                    password: adminPassword,
                    name: `Admin ${item.name}`,
                    email: item.email || "",
                    role: "owner",
                    companyCode: item.code,
                    active: true,
                    createdBy: "superadmin"
                });
                console.log(`[Companies] Created admin user "${adminUsername}" for company ${item.code}`);
            } catch (userErr) {
                // If user creation fails, still return the company but log warning
                console.error(`[Companies] Failed to create admin user for ${item.code}:`, userErr.message);
            }
        }

        res.status(201).json(item);
    } catch (err) {
        // Handle duplicate key error from MongoDB
        if (err.code === 11000) {
            const dupField = Object.keys(err.keyPattern || {})[0] || 'code';
            return res.status(409).json({ error: `Kode perusahaan sudah digunakan. Silakan gunakan kode lain.` });
        }
        res.status(400).json({ error: err.message });
    }
});

// Update (with user companyCode sync & admin user update)
router.put("/:id", async (req, res) => {
    try {
        const existing = await Company.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });

        const oldCode = existing.code;
        const newCode = req.body.code;

        // Cek duplicate code (kecuali kode sama dengan yg lama)
        if (newCode && newCode !== oldCode) {
            const dup = await Company.findOne({ code: newCode, _id: { $ne: req.params.id } });
            if (dup) {
                return res.status(409).json({
                    error: `Kode "${newCode}" sudah digunakan oleh ${dup.name || 'perusahaan lain'}. Silakan gunakan kode lain.`
                });
            }
        }

        // Extract admin fields before updating company
        const { adminUsername, adminPassword, ...companyData } = req.body;

        // ── Gunakan findById + manual assign + save() ──
        // agar pre('save') hook jalan dan logo tersimpan dengan benar.
        // findByIdAndUpdate bisa gagal diam-diam (return old doc) pada kondisi tertentu.
        const fieldsToUpdate = [
            "code", "jenis", "name", "address", "phone", "email", "taxId",
            "logo", "favicon",
            "legalId", "legalPerdes", "legalPerdesDate", "legalAhu", "legalNib", "legalNpwp", "legalInduk", "legalIjin",
            "orgPenasehat", "orgPengawas", "orgKetua", "orgSekretaris", "orgBendahara",
            "active", "isActive", "status",
            "workspace", "timezone", "currency", "language", "theme",
            "features",
            "updatedBy"
        ];
        for (const field of fieldsToUpdate) {
            if (companyData[field] !== undefined) {
                existing[field] = companyData[field];
            }
        }
        const item = await existing.save();
        console.log(`[Companies] Updated ${item.code}: logo=${item.logo ? "yes (" + item.logo.substring(0, 40) + "...)" : "null"}`);

        // Update or create owner user if admin fields provided
        if (adminUsername) {
            try {
                const ownerUser = await User.findOne({ companyCode: oldCode, role: "owner" });
                if (ownerUser) {
                    const updateData = {};
                    if (adminUsername) updateData.username = adminUsername;
                    if (adminPassword) updateData.password = adminPassword;
                    if (Object.keys(updateData).length > 0) {
                        await User.findByIdAndUpdate(ownerUser._id, { $set: updateData });
                        console.log(`[Companies] Updated owner user for ${oldCode}`);
                    }
                } else if (adminPassword) {
                    // Create new owner user for old companies that don't have one yet
                    await User.create({
                        username: adminUsername,
                        password: adminPassword,
                        name: `Admin ${item.name}`,
                        email: item.email || "",
                        role: "owner",
                        companyCode: oldCode,
                        active: true,
                        createdBy: "superadmin"
                    });
                    console.log(`[Companies] Created owner user "${adminUsername}" for ${oldCode}`);
                }
            } catch (userErr) {
                console.error("[Companies] Failed to update/create owner user:", userErr.message);
            }
        }

        // If company code changed, sync all users
        if (newCode && oldCode && oldCode !== newCode) {
            try {
                const userResult = await User.updateMany(
                    { companyCode: oldCode },
                    { $set: { companyCode: newCode } }
                );
                console.log(`[Companies] Synced ${userResult.modifiedCount} users: ${oldCode} → ${newCode}`);
            } catch (syncErr) {
                console.error("[Companies] Failed to sync companyCodes:", syncErr);
            }
        }

        res.json(item.toObject());
    } catch (err) {
        console.error("[Companies] PUT error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

// Delete — also deactivate all users associated with this company
router.delete("/:id", async (req, res) => {
    try {
        const item = await Company.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });

        // Nonaktifkan semua user yang terdaftar di perusahaan ini
        // agar tidak bisa login lagi meskipun company sudah dihapus
        try {
            const userResult = await User.updateMany(
                { companyCode: item.code },
                { $set: { active: false, status: "inactive" } }
            );
            if (userResult.modifiedCount > 0) {
                console.log(`[Companies] Deactivated ${userResult.modifiedCount} users for deleted company ${item.code}`);
            }
        } catch (userErr) {
            console.error(`[Companies] Failed to deactivate users for ${item.code}:`, userErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
