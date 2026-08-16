import { Router } from "express";
import { Company } from "../models/Company.js";
import { User } from "../models/User.js";
import { hashPassword, validateNewPassword } from "../../../../packages/smart-security/src/index.js";
import { security, audit } from "../security.js";
import { BUSINESS_TYPES, normalizeCompanyConfigFields } from "../config/business-types.js";
import { TRANSACTION_TYPES, validateTransactionTypes } from "../../../../packages/smart-core/src/transaction-types/transaction-types.js";

const router = Router();

/**
 * Pilih payload list company berdasarkan autentikasi (SP-027 PRE-M5 regression fix).
 *
 * - Terautentikasi (req.auth terisi, via soft-auth): kembalikan dokumen penuh
 *   (termasuk `_id`, `active`, `email`) — dipakai halaman Console Super Admin.
 * - Anonim: hanya field ringan (fallback logo halaman login), tanpa profil lengkap.
 *
 * @param {object} opts
 * @param {boolean} opts.authed Apakah request membawa access token valid
 * @param {Array} opts.docs Dokumen Company (mongoose docs / plain objects)
 * @returns {Array}
 */
/** Slug aplikasi bawaan (fallback bila Application collection belum ter-seed). */
const FALLBACK_APP_SLUGS = new Set(["inventory", "accounting", "pos", "payroll", "hrm", "crm", "wms", "ai"]);

/**
 * Normalisasi field `apps` — hanya slug yang dikenal yang disimpan,
 * tanpa duplikat. Input tak dikenal dibuang (fungsi murni — testable).
 *
 * SP-027 PRE-M5 round 5: daftar slug yang dikenal datang dari registry
 * MongoDB (Application collection) agar aplikasi baru yang ditambahkan
 * via halaman Applications bisa langsung dihubungkan ke perusahaan.
 *
 * @param {unknown} raw
 * @param {Set<string>|string[]} [knownSlugs] Slug aplikasi terdaftar
 *   (default: fallback bawaan)
 * @returns {string[]}
 */
export function normalizeApps(raw, knownSlugs = FALLBACK_APP_SLUGS) {
    if (!Array.isArray(raw)) return [];
    const known = knownSlugs instanceof Set ? knownSlugs : new Set(knownSlugs || []);
    return [...new Set(raw.filter(s => typeof s === "string" && known.has(s)))];
}

/**
 * Ambil slug aplikasi terdaftar dari registry MongoDB (untuk normalizeApps).
 * @returns {Promise<Set<string>>}
 */
async function loadKnownAppSlugs() {
    try {
        const { Application } = await import("../models/Application.js");
        const apps = await Application.find({}).select("slug").lean();
        const slugs = new Set(apps.map(a => a.slug));
        return slugs.size ? slugs : FALLBACK_APP_SLUGS;
    } catch {
        return FALLBACK_APP_SLUGS;
    }
}

/**
 * Daftar field yang boleh di-update pada PUT /api/companies/:id.
 *
 * Diekspor agar bisa di-regression-test: field konfigurasi produk
 * (SP-029 M2 — businessType/lokasiMode/jumlahGudang/jumlahKasir/lisensi) WAJIB
 * ada di sini. Bug live pernah terjadi: server lama tanpa field ini di daftar
 * → PUT sukses tapi nilai kembali ke awal (field diabaikan diam-diam).
 */
export const COMPANY_UPDATE_FIELDS = [
    "code", "jenis", "name", "address", "phone", "email", "taxId",
    // F&B QR Menu — nomor WhatsApp resto (diisi Settings → Company POS)
    "whatsapp",
    "logo", "favicon",
    "legalId", "legalPerdes", "legalPerdesDate", "legalAhu", "legalNib", "legalNpwp", "legalInduk", "legalIjin",
    "orgPenasehat", "orgPengawas", "orgKetua", "orgSekretaris", "orgBendahara",
    "active", "isActive", "status",
    "workspace", "timezone", "currency", "language", "theme",
    "features",
    "apps",
    // SP-029 M2 — Konfigurasi produk (POS)
    "businessType", "lokasiMode", "jumlahGudang", "jumlahKasir",
    "lisensiStatus", "lisensiExpiresAt",
    // SP-029 POS V1 — Transaction Capability (jenis transaksi kasir)
    "transactionTypes",
    // F&B V1 — WhatsApp Gateway (Settings → Konfigurasi WA di POS)
    "waProviderUrl", "waSecretKey", "waSenderNumber",
    "updatedBy"
];

export function selectCompanyListPayload({ authed, docs }) {
    if (authed) {
        return docs;
    }
    return (docs || []).map(c => ({
        code: c.code,
        name: c.name,
        jenis: c.jenis,
        logo: c.logo || null,
        workspace: c.workspace || null
    }));
}

/**
 * GET /api/companies/business-types
 * Katalog Business Type (SP-029 M2 [USULAN]) — dibaca UI Console untuk
 * dropdown konfigurasi POS. Daftar konfigurasi, bukan data sensitif.
 */
router.get("/business-types", (req, res) => {
    res.json({ data: BUSINESS_TYPES });
});

/**
 * GET /api/companies/transaction-types
 * Katalog Transaction Capability (SP-029 POS V1) — Available Capabilities
 * yang tersedia di platform, dengan metadata (key/label/description).
 * Dibaca UI Console untuk checkbox "Jenis Transaksi Kasir".
 * Sumber kebenaran: registry @smart/core (satu tempat, bukan hardcode).
 */
router.get("/transaction-types", (req, res) => {
    res.json({ data: TRANSACTION_TYPES });
});

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

        // SP-027 M3: untuk request UNAUTHENTICATED (dipakai halaman login sebagai
        // fallback logo), kembalikan hanya field ringan — jangan bocorkan profil
        // lengkap perusahaan ke publik.
        // SP-027 PRE-M5: req.auth kini terisi saat token valid (soft-auth),
        // sehingga Super Admin yang login mendapat payload penuh.
        const payload = selectCompanyListPayload({ authed: Boolean(req.auth), docs: data });

        res.json({ data: payload, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
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
        if (companyData.apps !== undefined) {
            companyData.apps = normalizeApps(companyData.apps, await loadKnownAppSlugs());
        }
        // Normalisasi konfigurasi produk (POS) — whitelist & clamp (SP-029 M2)
        Object.assign(companyData, normalizeCompanyConfigFields(companyData));

        // Transaction Capability (SP-029 POS V1) — validasi ketat: hanya
        // capability terdaftar, tanpa duplikat; array kosong diperbolehkan.
        // Unknown/duplikat → 400 (TIDAK dibuang diam-diam).
        if (companyData.transactionTypes !== undefined) {
            const ttCheck = validateTransactionTypes(companyData.transactionTypes);
            if (!ttCheck.ok) {
                return res.status(400).json({ error: ttCheck.error });
            }
            companyData.transactionTypes = ttCheck.value;
        }

        // Validasi password SEBELUM Company.create (hindari partial create)
        if (adminUsername && adminPassword) {
            const passCheck = validateNewPassword(adminPassword);
            if (!passCheck.ok) {
                return res.status(400).json({ error: passCheck.error });
            }
        }

        const item = await Company.create(companyData);

        // Auto-create admin user (owner role) for the new company
        if (adminUsername && adminPassword) {
            try {
                await User.create({
                    username: adminUsername,
                    password: await hashPassword(adminPassword, security.bcryptRound),
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

        audit.superadminActivity({
            actorId: req.user?.id || null,
            actorName: req.user?.name || "System",
            action: "company.create",
            targetType: "company",
            targetId: item.code,
            targetName: item.name,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.status(201).json(item);
    } catch (err) {
        // Handle duplicate key error from MongoDB
        if (err.code === 11000) {
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

        // Whitelist slug aplikasi di `apps` — hanya slug yang terdaftar di
        // registry MongoDB yang disimpan; input tak dikenal dibuang.
        if (companyData.apps !== undefined) {
            companyData.apps = normalizeApps(companyData.apps, await loadKnownAppSlugs());
        }
        // Normalisasi konfigurasi produk (POS) — whitelist & clamp (SP-029 M2)
        Object.assign(companyData, normalizeCompanyConfigFields(companyData));

        // Transaction Capability (SP-029 POS V1) — validasi ketat (sama
        // seperti POST): unknown/duplikat ditolak 400, kosong diperbolehkan.
        if (companyData.transactionTypes !== undefined) {
            const ttCheck = validateTransactionTypes(companyData.transactionTypes);
            if (!ttCheck.ok) {
                return res.status(400).json({ error: ttCheck.error });
            }
            companyData.transactionTypes = ttCheck.value;
        }

        // Validasi password admin SEBELUM company di-save (hindari partial update)
        if (adminPassword) {
            const passCheck = validateNewPassword(adminPassword);
            if (!passCheck.ok) {
                return res.status(400).json({ error: passCheck.error });
            }
        }

        // ── Gunakan findById + manual assign + save() ──
        // agar pre('save') hook jalan dan logo tersimpan dengan benar.
        // findByIdAndUpdate bisa gagal diam-diam (return old doc) pada kondisi tertentu.
        const fieldsToUpdate = COMPANY_UPDATE_FIELDS;
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
                    if (adminPassword) {
                        const passCheck = validateNewPassword(adminPassword);
                        if (!passCheck.ok) {
                            return res.status(400).json({ error: passCheck.error });
                        }
                        updateData.password = await hashPassword(adminPassword, security.bcryptRound);
                    }
                    if (Object.keys(updateData).length > 0) {
                        await User.findByIdAndUpdate(ownerUser._id, { $set: updateData });
                        console.log(`[Companies] Updated owner user for ${oldCode}`);
                    }
                } else if (adminPassword) {
                    // Create new owner user for old companies that don't have one yet
                    const passCheck = validateNewPassword(adminPassword);
                    if (!passCheck.ok) {
                        return res.status(400).json({ error: passCheck.error });
                    }
                    await User.create({
                        username: adminUsername,
                        password: await hashPassword(adminPassword, security.bcryptRound),
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

        audit.superadminActivity({
            actorId: req.user?.id || null,
            actorName: req.user?.name || "System",
            action: "company.update",
            targetType: "company",
            targetId: item.code,
            targetName: item.name,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

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

        audit.superadminActivity({
            actorId: req.user?.id || null,
            actorName: req.user?.name || "System",
            action: "company.delete",
            targetType: "company",
            targetId: item.code,
            targetName: item.name,
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
