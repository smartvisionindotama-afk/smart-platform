/**
 * Settings Route — pengaturan aplikasi per perusahaan (M3-FIX v19 + v21).
 *
 * GET /api/settings       — baca pengaturan (default aman bila belum ada)
 * PUT /api/settings       — simpan pengaturan (permission settings.company.edit)
 *
 * Dipakai: radio "Pajak Transaksi" + pengaturan "Gudang Kasir" di menu
 * Transaksi → Penjualan (Admin). Kasir membaca hasilnya via
 * GET /api/pos/kasir-data (taxEnabled + gudang terhubung).
 *
 * @module server/routes/settings
 */

import { Router } from "express";
import { Setting } from "../models/Setting.js";
import { Warehouse } from "../models/Warehouse.js";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { normalizeCompanyConfig } from "../services/company-config.js";
import { normalizeGudangPayload } from "../services/pos-gudang.js";
import { security } from "../security.js";

const router = Router();

/** Default pengaturan saat belum pernah disimpan. */
function defaults() {
    return { taxEnabled: true, gudangTerkoneksi: [], gudangKasir: [] };
}

/**
 * Konteks pengaturan: dokumen Setting + gudang aktif + user kasir +
 * konfigurasi company (dari Master Platform).
 */
async function loadContext(companyCode) {
    const [setting, warehouses, kasirUsers, company] = await Promise.all([
        Setting.findOne({ companyCode }).lean(),
        Warehouse.find({ companyCode, active: true, status: { $ne: "archived" } })
            .select("kode nama").sort({ nama: 1 }).lean(),
        User.find({ companyCode, role: { $regex: /^kasir$/i }, active: true })
            .select("username name role").sort({ username: 1 }).lean(),
        Company.findOne({ code: companyCode }).lean()
    ]);
    return {
        setting,
        warehouses: (warehouses || []).map(w => ({ kode: w.kode, nama: w.nama || w.kode })),
        kasirUsers: (kasirUsers || []).map(u => ({ username: u.username, nama: u.name || u.username })),
        companyConfig: normalizeCompanyConfig(company)
    };
}

/**
 * GET / — baca pengaturan perusahaan ini.
 * Tanpa permission khusus (global auth + companyScope sudah menjamin
 * autentikasi & scoping). Default taxEnabled=true bila belum ada dokumen.
 */
router.get("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        // Wajib header company — cegah pembacaan lintas company saat header hilang
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const { setting, warehouses, kasirUsers, companyConfig } = await loadContext(companyCode);
        const d = defaults();
        res.json({
            taxEnabled: setting ? setting.taxEnabled !== false : d.taxEnabled,
            gudangTerkoneksi: (setting && Array.isArray(setting.gudangTerkoneksi)) ? setting.gudangTerkoneksi : d.gudangTerkoneksi,
            gudangKasir: (setting && Array.isArray(setting.gudangKasir)) ? setting.gudangKasir : d.gudangKasir,
            warehouses,
            kasirUsers,
            companyConfig
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT / — simpan pengaturan (upsert per company).
 * Body: { taxEnabled?, gudangTerkoneksi?: string[], gudangKasir?: [{kasir, kodeGudang}] }
 * Permission: settings.company.edit (Admin/Owner).
 */
router.put("/", security.permission("settings.company.edit"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const { warehouses, kasirUsers } = await loadContext(companyCode);

        // Parse boolean toleran: true/"true"/1 → aktif; false/"false"/0 → off
        const raw = req.body && req.body.taxEnabled;
        const taxEnabled = raw === true || raw === "true" || raw === 1 || raw === "1"
            ? true
            : (raw === false || raw === "false" || raw === 0 || raw === "0" ? false : defaults().taxEnabled);

        // Normalisasi gudang-kasir: kode gudang tak dikenal diabaikan; nama
        // gudang/kasir diisi server (bukan dari client).
        const g = normalizeGudangPayload(req.body || {}, warehouses);
        const validKasir = new Set(kasirUsers.map(u => u.username.toLowerCase()));
        const gudangKasir = g.gudangKasir
            .filter(e => validKasir.has(e.kasir.toLowerCase()))
            .map(e => ({
                ...e,
                namaKasir: kasirUsers.find(u => u.username.toLowerCase() === e.kasir.toLowerCase())?.nama || e.kasir
            }));

        const setting = await Setting.findOneAndUpdate(
            { companyCode },
            {
                $set: {
                    taxEnabled,
                    gudangTerkoneksi: g.gudangTerkoneksi,
                    gudangKasir,
                    updatedBy: req.headers["x-user-name"] || "System"
                },
                $setOnInsert: {
                    createdBy: req.headers["x-user-name"] || "System"
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.json({
            taxEnabled: setting.taxEnabled !== false,
            gudangTerkoneksi: setting.gudangTerkoneksi || [],
            gudangKasir: setting.gudangKasir || [],
            warehouses,
            kasirUsers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
