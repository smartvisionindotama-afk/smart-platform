/**
 * Registration Route — Handle new company + admin user registration.
 *
 * POST /api/auth/register
 *   Body: { jenis, name, adminName, adminEmail, adminPassword, phone, address }
 *   Auto-generates company code based on jenis prefix.
 *
 * @module server/routes/register
 */

import { Router } from "express";
import crypto from "crypto";
import { Company } from "../models/Company.js";
import { User } from "../models/User.js";
import { hashPassword, validateNewPassword } from "../../../../packages/smart-security/src/index.js";
import { security, audit } from "../security.js";

const router = Router();

/**
 * Generate the next company code based on jenis prefix.
 * E.g. untuk "PT" → cari PT-XXX terakhir → generate PT-(next).
 *
 * @param {string} jenis - Jenis perusahaan (PT, CV, dll)
 * @returns {Promise<string>} Generated code like "PT-001"
 */
async function generateCompanyCode(jenis, companyModel, desaCode) {
    const Model = companyModel || Company;

    // BUMDes & Pemdes: use desa code directly
    if ((jenis === "BUMDes" || jenis === "Pemdes") && desaCode) {
        return `${jenis}-${desaCode}`;
    }

    // Determine prefix from jenis
    const prefixMap = {
        "PT": "PT",
        "CV": "CV",
        "Yayasan": "YS",
        "Perorangan": "PO",
        "Koperasi": "KP",
        "Firma": "FA",
        "Perorangan": "PO",
        "BUMDes": "BD",
        "Pemdes": "PMD",
        "Lainnya": "LA"
    };
    const prefix = prefixMap[jenis] || "LA";

    // Cari semua kode dengan prefix tersebut, lalu cari nomor terbesar secara numerik
    const allCodes = await Company.find({
        code: { $regex: `^${prefix}-\\d+$` }
    }).select("code").lean();

    let maxNum = 0;
    for (const doc of allCodes) {
        if (doc && doc.code) {
            const m = doc.code.match(/^(\w+)-(\d+)$/);
            if (m) {
                const num = parseInt(m[2], 10);
                if (num > maxNum) maxNum = num;
            }
        }
    }
    const nextNumber = maxNum + 1;

    return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

/**
 * Create company + admin user with retry on duplicate code.
 *
 * @param {object} params - Parameters object
 * @param {string} params.code - Company code
 * @param {string} params.companyJenis - Company type
 * @param {string} params.name - Company name
 * @param {string} params.address - Company address
 * @param {string} params.phone - Company phone
 * @param {string} params.adminEmail - Admin email
 * @param {string} params.finalPassword - Admin password
 * @param {boolean} params.isGoogle - Whether registration is from Google
 * @param {boolean} [params.isRetry] - Whether this is a retry attempt
 * @returns {Promise<object>} Created company and user
 */
async function createCompanyAndUser({ code, companyJenis, name, adminName, address, phone, adminEmail, finalPassword, isGoogle }) {
    const company = await Company.create({
        code,
        jenis: companyJenis,
        name: name.trim(),
        address: (address || "").trim(),
        phone: (phone || "").trim(),
        email: adminEmail.trim(),
        active: true,
        isActive: true,
        status: "active"
    });

    const username = adminEmail.trim().split("@")[0];
    const hashedPassword = await hashPassword(finalPassword, security.bcryptRound);
    // Ensure unique username by appending random suffix if duplicate
    let createdUser;
    try {
        createdUser = await User.create({
            username,
            password: hashedPassword,
            name: adminName.trim(),
            email: adminEmail.trim(),
            role: "owner",
            companyCode: code,
            active: true,
            status: "active",
            createdBy: isGoogle ? "google" : "registration"
        });
    } catch (userErr) {
        // If username is duplicate, add random suffix
        if (userErr.code === 11000) {
            const suffix = crypto.randomBytes(3).toString("hex");
            createdUser = await User.create({
                username: `${username}_${suffix}`,
                password: hashedPassword,
                name: adminName.trim(),
                email: adminEmail.trim(),
                role: "owner",
                companyCode: code,
                active: true,
                status: "active",
                createdBy: isGoogle ? "google" : "registration"
            });
        } else {
            throw userErr;
        }
    }

    console.log(`[Register] Company ${code} created with admin ${adminEmail}`);

    return {
        company: { id: company._id, code: company.code, name: company.name, jenis: company.jenis },
        user: { id: createdUser._id, username: createdUser.username, name: createdUser.name, email: createdUser.email, role: createdUser.role, institution: code, companyCode: code }
    };
}

/**
 * POST /api/auth/register
 * Create a new company + admin (owner) user.
 */
router.post("/", async (req, res) => {
    try {
        const { jenis, name, adminName, adminEmail, adminPassword, phone, address, desaCode, code: reqCode } = req.body;

        // ── Validasi ──
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Nama perusahaan wajib diisi" });
        }
        if (!adminName || !adminName.trim()) {
            return res.status(400).json({ error: "Nama admin wajib diisi" });
        }
        if (!adminEmail || !adminEmail.trim()) {
            return res.status(400).json({ error: "Email admin wajib diisi" });
        }
        // Jika dari Google, generate random password (user tidak perlu tahu)
        const isGoogle = req.body.isGoogle === true;
        let finalPassword = adminPassword;
        if (isGoogle) {
            finalPassword = crypto.randomBytes(20).toString("hex"); // 40 char random
        } else {
            const passCheck = validateNewPassword(adminPassword);
            if (!passCheck.ok) {
                return res.status(400).json({ error: passCheck.error });
            }
        }

        // ── Generate company code ──
        const companyJenis = jenis || "PT";
        // If code is already provided (e.g. BUMDes-3515112008 from client), use it directly
        // Otherwise, generate automatically
        const code = reqCode || await generateCompanyCode(companyJenis, Company, desaCode);

        // ── Cek duplicate email untuk admin user ──
        const existingUser = await User.findOne({
            email: { $regex: `^${adminEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
            active: true
        });
        if (existingUser) {
            return res.status(409).json({ error: "Email admin sudah terdaftar. Silakan login." });
        }

        // ── Create Company + User (with auto-retry on duplicate code) ──
        try {
            const result = await createCompanyAndUser({
                code,
                companyJenis,
                name: name.trim(),
                adminName: adminName.trim(),
                address: (address || "").trim(),
                phone: (phone || "").trim(),
                adminEmail: adminEmail.trim(),
                finalPassword,
                isGoogle
            });

            // SP-027 M3: issue access+refresh token untuk auto-login setelah registrasi
            const pair = await security.issueTokens(result.user, "user", req, res);

            audit.log({
                action: "register",
                category: "auth",
                actorId: String(result.user.id),
                actorName: result.user.name,
                targetType: "company",
                targetId: result.company.code,
                targetName: result.company.name,
                ip: req.ip || "",
                userAgent: req.headers["user-agent"] || ""
            });

            return res.status(201).json({ ...result, ...pair });
        } catch (createErr) {
            if (createErr.code === 11000) {
                // Duplicate code → retry with auto-generated code
                console.log(`[Register] Code ${code} conflict, retrying with auto-generated code...`);
                const newCode = await generateCompanyCode(companyJenis, Company, desaCode);
                const retryResult = await createCompanyAndUser({
                    code: newCode,
                    companyJenis,
                    name: name.trim(),
                    adminName: adminName.trim(),
                    address: (address || "").trim(),
                    phone: (phone || "").trim(),
                    adminEmail: adminEmail.trim(),
                    finalPassword,
                    isGoogle
                });
                console.log(`[Register] Retry success: Company ${newCode}`);
                const pair = await security.issueTokens(retryResult.user, "user", req, res);
                return res.status(201).json({ ...retryResult, ...pair });
            }
            throw createErr;
        }
    } catch (err) {
        console.error("[Register] Error:", err.message);
        if (err.code === 11000) {
            return res.status(409).json({ error: "Kode perusahaan sudah digunakan. Silakan coba lagi." });
        }
        res.status(500).json({ error: err.message || "Gagal mendaftarkan perusahaan" });
    }
});

/**
 * GET /api/auth/generate-code?jenis=PT
 * Generate preview company code without creating anything.
 * Used by registration form to show live preview.
 */
router.get("/code", async (req, res) => {
    try {
        const jenis = req.query.jenis || "PT";
        const code = await generateCompanyCode(jenis, Company);
        res.json({ code });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
