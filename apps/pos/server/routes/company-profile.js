/**
 * Company Profile Route — profil perusahaan dari sisi POS.
 *
 * KENAPA ADA (F&B V1-FIX / Settings → Company):
 * Settings → Company di admin POS membutuhkan data company yang dikelola
 * Master Platform (console, DB bersama). SEBELUMNYA halaman ini memanggil
 * /api/companies/:id di console — TAPI console MENOLAK token POS (audience
 * isolation SP-027 M3: console expectedAudience="console", token POS
 * ber-audience "inventory") → GET selalu 401 → form edit kosong (kode/nama
 * harus diinput ulang) dan PUT selalu 401 → simpanan jatuh ke fallback lokal
 * client (tidak pernah masuk DB). Solusi: baca/tulis profil company lewat
 * SERVER POS (token POS valid di sini, DB yang SAMA).
 *
 * Identitas company (code + name) TIDAK bisa diubah dari POS — diatur
 * Console. Endpoint ini hanya mengelola konfigurasi: kontak, alamat, logo,
 * legalitas, organisasi, dan whatsapp (QR Menu).
 *
 *   GET /api/company-profile  — profil company aktif (auth + company scope)
 *   PUT /api/company-profile  — update whitelist (permission settings.company.edit)
 *
 * @module server/routes/company-profile
 */

import { Router } from "express";
import { Company } from "../models/Company.js";
import { security } from "../security.js";

const router = Router();

/**
 * Field yang boleh di-update dari POS — SEMUA TANPA code/name (identitas
 * dikelola Console). Tambahan field baru di form Settings → Company harus
 * masuk daftar ini (pola COMPANY_UPDATE_FIELDS di console).
 */
const PROFILE_UPDATE_FIELDS = [
    "jenis", "address", "phone", "email", "taxId",
    "logo", "favicon",
    "whatsapp", // F&B QR Menu — redirect wa.me
    "legalId", "legalPerdes", "legalPerdesDate", "legalAhu", "legalNib", "legalNpwp", "legalInduk", "legalIjin",
    "orgPenasehat", "orgPengawas", "orgKetua", "orgSekretaris", "orgBendahara"
];

/** Shape profil yang dikirim ke client (id + field relevan form). */
function toProfile(doc) {
    const o = doc && doc.toObject ? doc.toObject() : doc || {};
    return {
        id: o._id ? String(o._id) : "",
        code: o.code || "",
        name: o.name || "",
        jenis: o.jenis || "",
        address: o.address || "",
        phone: o.phone || "",
        email: o.email || "",
        taxId: o.taxId || "",
        whatsapp: o.whatsapp || "",
        logo: o.logo || null,
        favicon: o.favicon || null,
        legalId: o.legalId || "",
        legalPerdes: o.legalPerdes || "",
        legalPerdesDate: o.legalPerdesDate || "",
        legalAhu: o.legalAhu || "",
        legalNib: o.legalNib || "",
        legalNpwp: o.legalNpwp || o.taxId || "",
        legalInduk: o.legalInduk || "",
        legalIjin: o.legalIjin || "",
        orgPenasehat: o.orgPenasehat || "",
        orgPengawas: o.orgPengawas || "",
        orgKetua: o.orgKetua || "",
        orgSekretaris: o.orgSekretaris || "",
        orgBendahara: o.orgBendahara || ""
    };
}

/** Company code aktif: header (di-set companyScope) → fallback token. */
function companyCodeOf(req) {
    return String(req.headers["x-company-code"] || (req.user && req.user.companyCode) || "").trim();
}

/**
 * GET / — profil company aktif (tanpa permission khusus; global auth +
 * companyScope sudah menjamin autentikasi & scoping).
 */
router.get("/", async (req, res) => {
    try {
        const companyCode = companyCodeOf(req);
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const company = await Company.findOne({ code: companyCode });
        if (!company) return res.status(404).json({ error: "Perusahaan tidak ditemukan" });
        res.json({ data: toProfile(company) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT / — update profil (whitelist). code/name TIDAK pernah diubah di sini.
 * Permission: settings.company.edit (Admin/Owner).
 */
router.put("/", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = companyCodeOf(req);
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const company = await Company.findOne({ code: companyCode });
        if (!company) return res.status(404).json({ error: "Perusahaan tidak ditemukan" });

        // Whitelist — field tak dikenal (termasuk code/name) DIABAIKAN.
        const body = req.body || {};
        const $set = {};
        for (const field of PROFILE_UPDATE_FIELDS) {
            if (body[field] !== undefined) {
                $set[field] = (typeof body[field] === "string") ? body[field].trim() : body[field];
            }
        }
        if (Object.keys($set).length === 0) {
            return res.status(400).json({ error: "Tidak ada field yang dapat diperbarui" });
        }
        $set.updatedBy = req.headers["x-user-name"] || req.user?.name || "System";

        const saved = await Company.findOneAndUpdate(
            { code: companyCode },
            { $set },
            { new: true, runValidators: true }
        );
        res.json({ data: toProfile(saved) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
