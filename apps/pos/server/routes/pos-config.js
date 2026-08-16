/**
 * POS Config Route — Transaction Capability (SP-029 POS V1 / M6.1).
 *
 * Endpoint baca & simpan jenis transaksi yang diaktifkan untuk perusahaan.
 * Penyimpanan pada field Company.transactionTypes (dokumen Company yang sama
 * dengan Console — DB bersama). Validasi ketat mengikuti registry @smart/core.
 *
 * Dua nama endpoint (pola konvensi existing + spesifikasi M6):
 *   GET/PUT /api/pos/config/transaction-types          (kanonik, V1)
 *   GET/PUT /api/pos/config/transaction-capabilities    (alias M6)
 *   GET/PUT /api/pos/settings/transaction-capabilities  (M6 — Settings)
 *
 * PUT menerima DUA bentuk payload (dinormalisasi ke array):
 *   { transactionTypes: ["retail", "fnb"] }   (kanonik)
 *   { retail: true, fnb: true, ... }          (object boolean M6)
 *
 * Keamanan:
 *   - autentikasi + company scope global (index.js) — user TIDAK bisa
 *     membaca/mengubah konfigurasi company lain.
 *   - PUT wajib permission settings.company.edit (Admin/Owner).
 *
 * @module server/routes/pos-config
 */

import { Router } from "express";
import { Company } from "../models/Company.js";
import { security } from "../security.js";
import { getCompanyTransactionTypes, parseTransactionCapabilitiesPayload } from "../services/transaction-capability.js";
import { normalizeCompanyConfig } from "../services/company-config.js";
import { DEFAULT_WA_PROVIDER_URL, normalizeProviderBase, sendWaText } from "../services/wa-notify.js";

/** Whitelist helper — ambil field konfigurasi WA dari company (masked). */
function waConfigOf(company) {
    return {
        // URL disimpan PENUH (mis. .../send-message) sesuai spek Settings.
        providerUrl: String(company.waProviderUrl || ""),
        // Secret TIDAK pernah dikirim balik ke client — hanya flag ada/tidak.
        hasSecretKey: Boolean(company.waSecretKey),
        senderNumber: String(company.waSenderNumber || "")
    };
}

/**
 * GET handler — baca jenis transaksi aktif (default V1 untuk company lama).
 * Response minimal: { transactionTypes: ["retail", "fnb"] }
 */
export async function getTransactionCapabilities(req, res) {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const transactionTypes = await getCompanyTransactionTypes(companyCode);
        res.json({ transactionTypes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * PUT handler — simpan jenis transaksi aktif.
 * Validasi: hanya capability terdaftar, tanpa duplikat; unknown/duplikat → 400;
 * array kosong diperbolehkan. Permission settings.company.edit (route).
 */
export async function updateTransactionCapabilities(req, res) {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const check = parseTransactionCapabilitiesPayload(req.body);
        if (!check.ok) {
            return res.status(400).json({ error: check.error });
        }

        const company = await Company.findOneAndUpdate(
            { code: companyCode },
            {
                $set: {
                    transactionTypes: check.value,
                    updatedBy: req.headers["x-user-name"] || "System"
                }
            },
            { new: true, setDefaultsOnInsert: true }
        );
        if (!company) {
            return res.status(404).json({ error: "Perusahaan tidak ditemukan" });
        }

        const config = normalizeCompanyConfig(company);
        res.json({ transactionTypes: config.transactionTypes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Router utama — mount di /api/pos/config.
 * Path kanonik V1 (/transaction-types) + alias M6 (/transaction-capabilities).
 */
const router = Router();
router.get("/transaction-types", getTransactionCapabilities);
router.put("/transaction-types", security.permission("settings.company.edit"), updateTransactionCapabilities);
router.get("/transaction-capabilities", getTransactionCapabilities);
router.put("/transaction-capabilities", security.permission("settings.company.edit"), updateTransactionCapabilities);

/**
 * GET /api/pos/settings/wa — baca konfigurasi WhatsApp gateway.
 * Secret key TIDAK dikembalikan (hanya hasSecretKey) — form menampilkan
 * placeholder terkunci; admin mengganti dengan mengetik nilai baru.
 */
export async function getWaConfig(req, res) {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const company = await Company.findOne({ code: companyCode }).lean();
        if (!company) return res.status(404).json({ error: "Perusahaan tidak ditemukan" });
        res.json({ wa: waConfigOf(company) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * PUT /api/pos/settings/wa — simpan konfigurasi WhatsApp gateway.
 * Body: { providerUrl?, secretKey?, senderNumber?, clearSecretKey? }
 *   - providerUrl  : URL penuh endpoint (mis. .../send-message); kosong →
 *     default Sidobe. Harus http(s) bila diisi.
 *   - secretKey    : bila terisi → ganti; bila kosong → PERTAHANKAN secret
 *     existing (admin tidak perlu mengetik ulang). Kosongkan dengan
 *     clearSecretKey: true.
 *   - senderNumber : nomor pengirim (opsional), digit saja.
 * Permission: settings.company.edit.
 */
export async function updateWaConfig(req, res) {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const company = await Company.findOne({ code: companyCode });
        if (!company) return res.status(404).json({ error: "Perusahaan tidak ditemukan" });

        const providerUrl = String(req.body?.providerUrl || "").trim().slice(0, 300);
        if (providerUrl && !/^https?:\/\//i.test(providerUrl)) {
            return res.status(400).json({ error: "Provider API URL harus diawali http(s)://" });
        }
        // Validasi URL bila diisi (base endpoint harus valid).
        if (providerUrl) {
            try {
                const base = normalizeProviderBase(providerUrl);
                new URL(base);
            } catch {
                return res.status(400).json({ error: "Provider API URL tidak valid" });
            }
        }

        // Secret: ganti bila diisi; pertahankan bila kosong; hapus via flag.
        const secretKey = String(req.body?.secretKey || "").trim();
        const clearSecretKey = req.body?.clearSecretKey === true;
        const nextSecret = clearSecretKey
            ? ""
            : (secretKey || company.waSecretKey || "");

        const senderNumber = String(req.body?.senderNumber || "").replace(/[^\d+]/g, "").slice(0, 20);

        company.waProviderUrl = providerUrl;
        company.waSecretKey = nextSecret;
        company.waSenderNumber = senderNumber;
        company.updatedBy = req.headers["x-user-name"] || "System";
        await company.save();

        res.json({ wa: waConfigOf(company) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /api/pos/settings/wa/test — Test Koneksi: kirim pesan uji coba.
 * Body: { phone, message?, providerUrl?, secretKey?, senderNumber? }
 *
 * Memakai NILAI FORM SAAT INI (bisa belum disimpan) supaya admin bisa menguji
 * sebelum Simpan — providerUrl/secretKey/senderNumber dari body. Secret kosong
 * di body → fallback secret company tersimpan → env. Endpoint ini TIDAK
 * menyimpan apa pun ke DB.
 * Permission: settings.company.edit.
 */
export async function testWaConfig(req, res) {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const phone = String(req.body?.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
        if (!phone) {
            return res.status(400).json({ error: "Nomor tujuan wajib diisi" });
        }
        const message = String(req.body?.message || "").trim().slice(0, 500)
            || "Test koneksi WhatsApp dari SMART Kasir ✅";

        // Konfigurasi: nilai form (bisa belum disimpan) → fallback company → env.
        let cfg = {
            providerUrl: String(req.body?.providerUrl || "").trim(),
            secretKey: String(req.body?.secretKey || "").trim(),
            senderNumber: String(req.body?.senderNumber || "").replace(/[^\d+]/g, "").slice(0, 20)
        };
        if (!cfg.secretKey) {
            try {
                const company = await Company.findOne({ code: companyCode }).lean();
                if (company) {
                    cfg.secretKey = String(company.waSecretKey || "");
                    if (!cfg.providerUrl) cfg.providerUrl = String(company.waProviderUrl || "");
                    if (!cfg.senderNumber) cfg.senderNumber = String(company.waSenderNumber || "");
                }
            } catch { /* fallback env di dalam sendWaText */ }
        }

        const result = await sendWaText(phone, message, cfg);
        if (!result.ok) {
            if (result.error === "no-secret") {
                return res.status(400).json({ error: "Secret key belum diisi — isi Secret Key lalu coba lagi" });
            }
            if (result.error === "no-phone") {
                return res.status(400).json({ error: "Nomor tujuan tidak valid" });
            }
            const detail = result.error || "terjadi kesalahan";
            console.warn(`[WaConfig] Test koneksi gagal (${companyCode}):`, detail);
            return res.status(502).json({ error: `Gagal mengirim pesan uji — ${detail}` });
        }
        res.json({ ok: true, message: "Pesan uji coba terkirim" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Router alias Settings (spesifikasi M6) — mount di /api/pos/settings.
 */
export const settingsRouter = Router();
settingsRouter.get("/transaction-capabilities", getTransactionCapabilities);
settingsRouter.put("/transaction-capabilities", security.permission("settings.company.edit"), updateTransactionCapabilities);
// F&B V1 — Settings → Konfigurasi WA (gateway notifikasi WhatsApp)
settingsRouter.get("/wa", getWaConfig);
settingsRouter.put("/wa", security.permission("settings.company.edit"), updateWaConfig);
settingsRouter.post("/wa/test", security.permission("settings.company.edit"), testWaConfig);

export default router;
