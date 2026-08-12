/**
 * Seed script — SMART Console Server (Platform domain).
 *
 * SP-027 Milestone 2: seed Company & SuperAdmin dipindah dari
 * apps/inventory/server/seed.js ke sini (Platform Backend Separation).
 *
 * Skips seeding if data already exists (idempotent).
 */

import crypto from "crypto";
import { Company } from "./models/Company.js";
import { SuperAdmin } from "./models/SuperAdmin.js";
import { Application } from "./models/Application.js";
import { DeploymentEnvironment } from "./models/DeploymentEnvironment.js";
import { Plan } from "./models/Plan.js";
import { Feature } from "./models/Feature.js";
import { Entitlement } from "./models/Entitlement.js";
import { Subscription } from "./models/Subscription.js";
import { hashPassword } from "../../../packages/smart-security/src/index.js";

const TENANT_ID = "PT-001";
const BCRYPT_ROUND = parseInt(process.env.BCRYPT_ROUND || "10", 10);

// Aplikasi platform awal — sama dengan APPS_REGISTRY client (SP-027 M1),
// kini menjadi data MongoDB (SP-027 PRE-M5 round 5): dapat ditambah/diedit/
// dihapus via halaman Applications tanpa mengubah kode.
const APPLICATION_SEED = [
    {
        slug: "inventory", name: "Inventory", code: "INV", icon: "📦",
        active: true, domain: "https://inv.e-profit.id/", version: "1.0.0",
        description: "Manajemen inventori gudang dan stok barang",
        workspace: "warehouse", environment: "production",
        healthEndpoint: "https://inv.e-profit.id/api/health"
    },
    {
        slug: "accounting", name: "Accounting", code: "ACC", icon: "💰",
        active: false, domain: "", version: "0.1.0",
        description: "Akuntansi dan pembukuan keuangan",
        workspace: "corporate", environment: "staging"
    },
    {
        slug: "pos", name: "SMART Kasir", code: "POS", icon: "🛒",
        active: true, domain: "https://pos.e-profit.id/", version: "0.1.0",
        description: "Point of Sale untuk kasir dan transaksi",
        workspace: "pos", environment: "staging",
        healthEndpoint: "https://pos.e-profit.id/api/health"
    },
    {
        slug: "payroll", name: "Payroll", code: "PAY", icon: "🧾",
        active: false, domain: "", version: "0.1.0",
        description: "Penggajian dan administrasi karyawan",
        workspace: "default", environment: "staging"
    },
    {
        slug: "hrm", name: "HRM", code: "HRM", icon: "👥",
        active: false, domain: "", version: "0.1.0",
        description: "Human Resource Management",
        workspace: "default", environment: "staging"
    },
    {
        slug: "crm", name: "CRM", code: "CRM", icon: "🤝",
        active: false, domain: "", version: "0.1.0",
        description: "Customer Relationship Management",
        workspace: "default", environment: "staging"
    },
    {
        slug: "wms", name: "WMS", code: "WMS", icon: "🏭",
        active: false, domain: "", version: "0.1.0",
        description: "Warehouse Management System",
        workspace: "warehouse", environment: "staging"
    },
    {
        slug: "ai", name: "AI", code: "AI", icon: "🤖",
        active: false, domain: "", version: "0.1.0",
        description: "Artificial Intelligence Services",
        workspace: "default", environment: "staging"
    }
];

const COMPANY_SEED = [
    {
        tenantId: TENANT_ID, tenantCode: TENANT_ID,
        code: "PT-001", jenis: "PT", name: "PT Smart Vision Indotama",
        address: "Jl. Sudirman No. 123, Jakarta", phone: "021-12345678", email: "info@smartvision.co.id",
        taxId: "01.234.567.8-999.000", active: true, isActive: true, logo: null,
        workspace: "warehouse", timezone: "Asia/Jakarta", currency: "IDR", language: "id",
        legalId: "", legalPerdes: "24", legalPerdesDate: "2023-10-06", legalAhu: "AHU-04168.AH.01.33.TAHUN 2024",
        legalNib: "", legalNpwp: "01.234.567.8-999.000", legalInduk: "", legalIjin: "",
        orgPenasehat: "", orgPengawas: "", orgKetua: "", orgSekretaris: "", orgBendahara: "",
        // SP-029 M2 — Konfigurasi produk & akses aplikasi (demo):
        // PT-001 terhubung ke Inventory + POS (contoh aktivasi roadmap Task 4).
        apps: ["inventory", "pos"],
        businessType: "Jasa", lokasiMode: "single", jumlahGudang: 1, jumlahKasir: 2,
        lisensiStatus: "active", lisensiExpiresAt: null
    },
    {
        tenantId: "CMP-002", tenantCode: "CMP-002",
        code: "CMP-002", jenis: "CV", name: "CV Karya Mandiri",
        address: "Jl. Merdeka No. 45, Bandung", phone: "022-87654321", email: "info@karyamandiri.co.id",
        taxId: "02.345.678.9-888.000", active: true, isActive: true, logo: null,
        workspace: "warehouse", timezone: "Asia/Jakarta", currency: "IDR", language: "id",
        legalId: "", legalPerdes: "12", legalPerdesDate: "2022-05-15", legalAhu: "",
        legalNib: "", legalNpwp: "02.345.678.9-888.000", legalInduk: "", legalIjin: "",
        orgPenasehat: "", orgPengawas: "", orgKetua: "", orgSekretaris: "", orgBendahara: "",
        apps: ["inventory"],
        businessType: "Manufacturing", lokasiMode: "multi", jumlahGudang: 2, jumlahKasir: 1,
        lisensiStatus: "trial", lisensiExpiresAt: null
    }
];

// ── SP-029 M6 — Feature catalog & Plans (configuration, bukan hardcode UI) ──
const FEATURE_SEED = [
    // Harga default KATALOG (integer minor units, IDR = rupiah). Dapat di-
    // override per perusahaan via Entitlement.price (M6-FIX: harga per fitur).
    { slug: "ep_profit", name: "e-Profit", description: "Aplikasi akuntansi & pembukuan e-Profit", category: "app", unit: "FEATURE", price: 150000 },
    { slug: "inventory", name: "SMART Inventory", description: "Manajemen inventori gudang dan stok", category: "app", unit: "FEATURE", price: 100000 },
    { slug: "pos", name: "SMART Kasir", description: "Point of Sale kasir", category: "app", unit: "FEATURE", price: 75000 },
    { slug: "smartwms", name: "SmartWMS", description: "Warehouse Management System", category: "app", unit: "FEATURE", price: 250000 },
    { slug: "santripintar", name: "Santri Pintar", description: "Aplikasi pondok pesantren", category: "app", unit: "FEATURE", price: 120000 },
    { slug: "sitampan", name: "SITAMPAN", description: "Sistem Informasi Tampilan", category: "app", unit: "FEATURE", price: 100000 },
    { slug: "desa_insight", name: "Desa Insight", description: "Analitik data desa", category: "app", unit: "FEATURE", price: 90000 },
    { slug: "advanced_reporting", name: "Advanced Reporting", description: "Laporan lanjutan & analitik", category: "reporting", unit: "FEATURE", price: 50000 },
    { slug: "ai_accounting", name: "AI Accounting Assistant", description: "Asisten akuntansi berbasis AI", category: "ai", unit: "AI_TOKEN", price: 100000 },
    { slug: "api_access", name: "API Access", description: "Akses API platform", category: "api", unit: "API_CALL", price: 50000 }
];

// Harga integer minor units (IDR = rupiah). Plan-feature mapping + limits.
const PLAN_SEED = [
    {
        slug: "free", name: "Free", description: "Paket awal untuk mencoba platform",
        billingCycle: "MONTHLY", price: 0, currency: "IDR", sortOrder: 1,
        features: ["ep_profit"], limits: { users: 2, storage_gb: 1 }
    },
    {
        slug: "starter", name: "Starter", description: "Untuk usaha kecil",
        billingCycle: "MONTHLY", price: 99000, currency: "IDR", sortOrder: 2,
        features: ["ep_profit", "inventory", "advanced_reporting"],
        limits: { users: 5, transactions: 1000, storage_gb: 1 }
    },
    {
        slug: "pro", name: "Pro", description: "Untuk usaha menengah",
        billingCycle: "MONTHLY", price: 199000, currency: "IDR", sortOrder: 3,
        features: ["ep_profit", "inventory", "pos", "smartwms", "advanced_reporting"],
        limits: { users: 10, transactions: 10000, storage_gb: 5 }
    },
    {
        slug: "enterprise", name: "Enterprise", description: "Untuk organisasi besar",
        billingCycle: "MONTHLY", price: 499000, currency: "IDR", sortOrder: 4,
        features: ["ep_profit", "inventory", "pos", "smartwms", "santripintar", "sitampan", "desa_insight", "advanced_reporting", "ai_accounting", "api_access"],
        limits: { users: 50, transactions: 100000, storage_gb: 100 }
    }
];

// SP-027 M3: tidak ada lagi password hardcoded. Password superadmin seed
// berasal dari ENV (SEED_SUPERADMIN_PASSWORD) atau random (bootstrap) —
// selalu di-hash bcrypt sebelum disimpan.
async function buildSuperAdminSeed() {
    const password = process.env.SEED_SUPERADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    const hashed = await hashPassword(password, BCRYPT_ROUND);
    const source = process.env.SEED_SUPERADMIN_PASSWORD ? "ENV" : "RANDOM";
    return {
        seed: [
            {
                username: "superadmin",
                password: hashed,
                name: "Super Admin",
                email: "superadmin@smart.id",
                role: "superadmin",
                active: true
            }
        ],
        password,
        source
    };
}

/**
 * Seed platform collections with data only if empty.
 * @returns {Promise<object>} Count of documents created per collection
 */
export async function seedAll() {
    const counts = {};

    const companyCount = await Company.countDocuments();
    if (companyCount === 0) {
        await Company.insertMany(COMPANY_SEED);
        counts.companies = COMPANY_SEED.length;
    }

    const superAdminCount = await SuperAdmin.countDocuments();
    if (superAdminCount === 0) {
        const { seed: superAdminSeed, password, source } = await buildSuperAdminSeed();
        await SuperAdmin.insertMany(superAdminSeed);
        counts.superadmins = superAdminSeed.length;
        console.log("[Seed] ⚠️  SuperAdmin seed dibuat (" + source + ").");
        console.log("[Seed] ⚠️  Initial password superadmin: " + password);
        console.log("[Seed] ⚠️  Simpan password ini & segera ganti setelah login pertama.");
    }

    // SP-027 PRE-M5 round 5: seed aplikasi platform (registry → MongoDB).
    const appCount = await Application.countDocuments();
    if (appCount === 0) {
        await Application.insertMany(APPLICATION_SEED);
        counts.applications = APPLICATION_SEED.length;
    }

    // SP-027 M5: seed environment abstraction (development/staging/production)
    // untuk setiap aplikasi — idempotent, hanya menambah yang belum ada.
    const apps = await Application.find({}).select("_id slug").lean();
    const envNames = ["development", "staging", "production"];
    let envCreated = 0;
    for (const app of apps) {
        for (const name of envNames) {
            const exists = await DeploymentEnvironment.exists({ applicationId: app._id, name });
            if (!exists) {
                await DeploymentEnvironment.create({
                    applicationId: app._id,
                    name,
                    target: name === "production" && app.slug === "inventory" ? "inventory-api" : "",
                    branch: "main",
                    status: "configured",
                    monitoringEnabled: true
                });
                envCreated += 1;
            }
        }
    }
    if (envCreated > 0) {
        counts.environments = envCreated;
    }

    // ── SP-029 M6 — Feature catalog (idempotent per slug) ──
    // Upsert $setOnInsert: harga katalog default diisi hanya saat feature BARU;
    // feature existing (termasuk harga yang sudah diubah user) TIDAK ditimpa.
    let featureCreated = 0;
    for (const f of FEATURE_SEED) {
        const res = await Feature.findOneAndUpdate(
            { slug: f.slug },
            { $setOnInsert: { ...f, status: "active", sortOrder: FEATURE_SEED.indexOf(f) } },
            { upsert: true, new: true }
        );
        if (res) featureCreated += 1;
    }
    if (featureCreated > 0) counts.features = featureCreated;

    // ── SP-029 M6 — Plans (idempotent per slug) ──
    let planCreated = 0;
    for (const p of PLAN_SEED) {
        const exists = await Plan.exists({ slug: p.slug });
        if (!exists) {
            await Plan.create({ ...p, status: "active" });
            planCreated += 1;
        }
    }
    if (planCreated > 0) counts.plans = planCreated;

    // ── SP-029 M6 — Grandfathering legacy companies (M6 §56) ──
    // Company existing yang BELUM punya subscription TIDAK diblokir.
    // Beri entitlement legacy (source=MANUAL, audit trail) dari plan default
    // sehingga company lama tetap mendapat fitur aplikasi yang terdaftar.
    const legacyPlan = await Plan.findOne({ slug: "free" }).lean();
    const allFeatures = await Feature.find({}).lean();
    const companies = await Company.find({ active: true }).lean();
    let legacyEnt = 0;
    for (const company of companies) {
        const hasSub = await Subscription.exists({ companyId: company._id });
        if (hasSub) continue;
        for (const feature of allFeatures) {
            const exists = await Entitlement.exists({ companyId: company._id, featureSlug: feature.slug });
            if (exists) continue;
            const enabled = legacyPlan ? legacyPlan.features.includes(feature.slug) : true;
            await Entitlement.create({
                companyId: company._id,
                featureId: feature._id,
                featureSlug: feature.slug,
                enabled,
                limit: legacyPlan?.limits?.[feature.slug] ?? null,
                // Source PLAN (bukan MANUAL) agar subscription aktif kelak menimpa
                // entitlement ini; reason legacy menandai bahwa ini grandfathering
                // (M6 §56) — company existing TIDAK diblokir.
                source: "PLAN",
                reason: "legacy grandfathering (M6 §56) — company existing tanpa subscription",
                createdBy: "seed"
            });
            legacyEnt += 1;
        }
    }
    if (legacyEnt > 0) counts.legacyEntitlements = legacyEnt;

    return counts;
}
