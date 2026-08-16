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
    // F&B QR Menu — nomor WhatsApp resto (diisi di Settings → Company POS).
    // Dipakai halaman /m/:identifier utk redirect customer ke wa.me.
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

    // Application access (SP-027 PRE-M5 round 4):
    // slug aplikasi yang diizinkan untuk company ini (mis. ["inventory"]).
    // Sumber kebenaran server — UI Companies (Registered Apps & Login As)
    // dan impersonation token membaca dari sini.
    apps: { type: [String], default: [] },

    // ── SMART Kasir / Product Configuration (SP-029 M2 [USULAN] — Rule 17) ──
    // Konfigurasi produk yang dibaca POS (dan produk lain) untuk menentukan
    // perilaku awal. SSOT: Master Platform (master.e-profit.id).
    // Default aman & backward-compatible — semua field additive.
    businessType: { type: String, default: "" }, // Retail/Cafe/Restaurant/dst — lihat config/business-types.js
    lokasiMode: { type: String, default: "single", enum: ["single", "multi"] },
    jumlahGudang: { type: Number, default: 1, min: 0 },
    jumlahKasir: { type: Number, default: 1, min: 0 },
    lisensiStatus: { type: String, default: "active", enum: ["active", "trial", "expired"] },
    lisensiExpiresAt: { type: Date, default: null },

    // ── Transaction Capability (SP-029 — POS V1) ──
    // Daftar capability jenis transaksi yang diaktifkan untuk perusahaan
    // (mis. ["retail", "fnb"]). Source of truth: registry @smart/core
    // (transaction-types). Default V1 = ["retail"] (backward compatible
    // dengan perilaku POS saat ini); array kosong diperbolehkan (bisnis
    // tanpa transaksi aktif). Field additive — company lama tanpa field ini
    // tetap dapat membuka POS (fallback normalize di POS server/client).
    transactionTypes: { type: [String], default: () => [...DEFAULT_TRANSACTION_TYPES] },

    // ── WhatsApp Gateway (F&B V1 — Settings → Konfigurasi WA di POS) ──
    // Konfigurasi gateway per-company utk notifikasi status order via WA
    // (Sidobe). Diisi dari Settings → Konfigurasi WA (admin POS) — field
    // additive; company lama tanpa field ini memakai fallback env SIDOBE_*.
    waProviderUrl:  { type: String, default: "" },
    waSecretKey:    { type: String, default: "" },
    waSenderNumber: { type: String, default: "" },

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
