import mongoose from "mongoose";
import { DEFAULT_TRANSACTION_TYPES } from "../../../../packages/smart-core/src/transaction-types/transaction-types.js";

const companySchema = new mongoose.Schema({
    // Tenant identity
    tenantId: { type: String, default: null }, // For multi-tenant: same as code initially
    tenantCode: { type: String, default: null },

    // Core identity
    code: { type: String, required: true, unique: true },
    jenis: { type: String, default: "PT" },

    // Company name
    name: { type: String, required: true },

    // Contact
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    // F&B QR Menu — nomor WhatsApp resto (diisi di Settings → Company).
    // Dipakai halaman /m/:identifier utk mengarahkan customer ke wa.me
    // (chat kasir). Kosong = alur QR Menu web normal (tanpa redirect WA).
    whatsapp: { type: String, default: "" },

    // Legal
    taxId: { type: String, default: "" },
    legalId: { type: String, default: "" },
    legalPerdes: { type: String, default: "" },
    legalPerdesDate: { type: String, default: "" },
    legalAhu: { type: String, default: "" },
    legalNib: { type: String, default: "" },
    legalNpwp: { type: String, default: "" },
    legalInduk: { type: String, default: "" },
    legalIjin: { type: String, default: "" },

    // Organization structure
    orgPenasehat: { type: String, default: "" },
    orgPengawas: { type: String, default: "" },
    orgKetua: { type: String, default: "" },
    orgSekretaris: { type: String, default: "" },
    orgBendahara: { type: String, default: "" },

    // Branding
    logo: { type: String, default: null },
    favicon: { type: String, default: null },
    workspace: { type: String, default: "default" },
    timezone: { type: String, default: "Asia/Jakarta" },
    currency: { type: String, default: "IDR" },
    language: { type: String, default: "id" },
    theme: { type: String, default: "light" },

    // Feature flags
    features: { type: Object, default: {} },

    // Application access (SP-027 PRE-M5 round 4): slug aplikasi yang diizinkan
    // untuk company ini. Disimpan oleh Console server; dibaca di sini untuk
    // memvalidasi impersonation token (defense in depth, DB sama).
    apps: { type: [String], default: [] },

    // ── Product Configuration (SP-029 M2 — Rule 17) ──
    // Konfigurasi produk ditulis Master Platform (console) pada dokumen company
    // yang SAMA (DB bersama). Dideklarasikan juga di sini agar schema POS
    // eksplisit & self-documenting — enforcement dibaca via company-limits.js.
    businessType: { type: String, default: "" },
    lokasiMode: { type: String, default: "single", enum: ["single", "multi"] },
    jumlahGudang: { type: Number, default: 1, min: 0 },
    jumlahKasir: { type: Number, default: 1, min: 0 },
    lisensiStatus: { type: String, default: "active", enum: ["active", "trial", "expired"] },
    lisensiExpiresAt: { type: Date, default: null },

    // ── Transaction Capability (SP-029 — POS V1) ──
    // Sama seperti deklarasi di Console (DB bersama). Default V1 = ["retail"]
    // (backward compatible); array kosong diperbolehkan. Fallback untuk
    // company lama tanpa field ini ditangani normalizeCompanyConfig.
    transactionTypes: { type: [String], default: () => [...DEFAULT_TRANSACTION_TYPES] },

    // ── WhatsApp Gateway (F&B V1 — Settings → Konfigurasi WA) ──
    // Konfigurasi gateway per-company untuk kirim notifikasi status order
    // via WhatsApp (Sidobe). Diatur admin dari Settings → Konfigurasi WA.
    // Additive; company lama tanpa field ini → fallback env SIDOBE_* di
    // service wa-notify (provider default api.sidobe.com/wa/v1).
    // `whatsapp` (nomor restoran utk checkout) terpisah dari gateway ini.
    waProviderUrl:  { type: String, default: "" },   // mis. https://api.sidobe.com/wa/v1/send-message
    waSecretKey:    { type: String, default: "" },   // X-Secret-Key (dari dashboard Sidobe)
    waSenderNumber: { type: String, default: "" },   // Nomor pengirim (opsional)

    // Status
    active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

// Auto-set tenantId from code on create
companySchema.pre("save", function (next) {
    if (!this.tenantId) this.tenantId = this.code;
    if (!this.tenantCode) this.tenantCode = this.code;
    next();
});

export const Company = mongoose.model("Company", companySchema);
