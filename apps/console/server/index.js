/**
 * SMART Console — Platform Backend API Server.
 *
 * SP-027 Milestone 2 — Platform Backend Separation.
 * SP-027 Milestone 3 — Security Foundation:
 *   - helmet security headers
 *   - CORS dari ENV
 *   - rate limiting (auth + umum)
 *   - global authenticate untuk seluruh endpoint privat (superadmin JWT)
 *   - endpoint publik whitelist (login, refresh, register, logo, wilayah, health)
 *
 * Backend khusus domain Platform (Console):
 *   /api/platform/*   — logo platform & app logo (file-based storage)
 *   /api/companies/*  — company management (tenant provisioning)
 *   /api/superadmins/* — super admin management & login
 *   /api/wilayah/*    — master data wilayah (shared/data/wilayah.json)
 *   /api/auth/register/* — company registration + kode preview
 *
 * Tidak mengandung business logic Inventory. Business domain dilayani
 * oleh apps/inventory/server (port 3001).
 */

// Load .env TERLEBIH DAHULU (sebelum import lain yang membaca process.env)
import "./env.js";

import express from "express";
import cors from "cors";
import { connectDB, disconnectDB } from "./db.js";

import superadminRoutes from "./routes/superadmins.js";
import companyRoutes from "./routes/companies.js";
import platformRoutes, { serveFavicon } from "./routes/platform.js";
import wilayahRoutes from "./routes/wilayah.js";
import registerRoutes from "./routes/register.js";
import monitoringRoutes from "./routes/monitoring.js";
import auditRoutes from "./routes/audit.js";
import applicationRoutes from "./routes/applications.js";
import environmentRoutes from "./routes/environments.js";
import buildRoutes from "./routes/builds.js";
import releaseRoutes from "./routes/releases.js";
import deploymentRoutes from "./routes/deployments.js";
import databaseRoutes from "./routes/database.js";
// SP-029 M6 — Billing & Subscription Center
import planRoutes from "./routes/plans.js";
import featureRoutes from "./routes/features.js";
import subscriptionRoutes from "./routes/subscriptions.js";
import entitlementRoutes from "./routes/entitlements.js";
import usageRoutes from "./routes/usage.js";
import invoiceRoutes from "./routes/invoices.js";
import paymentRoutes from "./routes/payments.js";
import billingSummaryRoutes from "./routes/billing-summary.js";
import systemPasswordRoutes from "./routes/system-password.js";
import { startDeploymentWorker } from "./deployment/worker.js";
import {
    helmetHeaders,
    corsOrigins,
    authLimiter,
    apiLimiter,
    security
} from "./security.js";

const app = express();

// Trust proxy — server berjalan di belakang nginx (X-Forwarded-For/Proto).
// WAJIB: tanpa ini express-rate-limit v7 melempar ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// saat nginx mengirim header X-Forwarded-For (500 sesaat pada request browser),
// dan rate limiting salah mengidentifikasi IP (selalu IP nginx, bukan klien).
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3002;

// ── Security middleware (SP-027 M3) ──
app.use(helmetHeaders);
app.use(cors({
    origin: corsOrigins,
    credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// Health check (publik) — kontrak health (SP-027 M4 §5)
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "console-api",
        version: "1.0.0",
        uptime: Math.round(process.uptime()),
        timestamp: Date.now()
    });
});

// Rate limiting
app.use("/api/superadmins/login", authLimiter);
app.use("/api/superadmins/refresh", authLimiter);
// Ganti password sudo — limiter ketat (anti brute-force tebak password sudo)
app.use("/api/system-password/change", authLimiter);
app.use("/api", apiLimiter);

// ── Global authentication (SP-027 M3) ──
// Endpoint publik (whitelist, method-aware) tetap terbuka — yang lain wajib
// access token superadmin. GET /api/companies dibuka karena dipakai halaman
// login sebagai fallback logo (perilaku lama dipertahankan).
// Catatan: di dalam app.use("/api", ...), req.path sudah RELATIF ke /api
// (contoh: "/superadmins/login").
const PUBLIC_RULES = [
    { prefix: "/health", methods: ["GET"] },
    { prefix: "/superadmins/login", methods: ["POST"] },
    { prefix: "/superadmins/refresh", methods: ["POST"] },
    // Logout publik: hanya me-revoke refresh token (bisa logout walau access token kedaluwarsa)
    { prefix: "/superadmins/logout", methods: ["POST"] },
    { prefix: "/auth/register", methods: ["GET", "POST"] },
    { prefix: "/platform/logo", methods: ["GET"] },
    { prefix: "/platform/app-logo", methods: ["GET"] },
    // Hanya GET /api/companies (list) publik — GET /:id (detail + adminUsername)
    // tetap butuh autentikasi. Data list untuk unauthenticated dipangkas di route.
    // softAuth: jika request membawa access token VALID, req.auth diisi sehingga
    // route mengembalikan payload penuh (id/active/email) untuk Super Admin
    // yang sedang login; tanpa token → payload ringan (fallback logo halaman login).
    { prefix: "/companies", methods: ["GET"], exact: true, softAuth: true },
    // SP-029 M2: katalog business type (konfigurasi publik seperti /wilayah)
    { prefix: "/companies/business-types", methods: ["GET"] },
    // SP-029 POS V1: katalog transaction capability (metadata publik)
    { prefix: "/companies/transaction-types", methods: ["GET"] },
    { prefix: "/wilayah", methods: ["GET"] },
    // SP-029 M6: webhook payment provider — diverifikasi via BILLING_WEBHOOK_SECRET
    // (bukan JWT superadmin); idempotent + audited di dalam route.
    { prefix: "/payments/webhook", methods: ["POST"] },
    // SP-029 M6-FIX: entitlement service check untuk APLIKASI (Inventory dst) —
    // diverifikasi via header x-entitlement-key (BILLING_SERVICE_KEY), bukan JWT
    // superadmin; fail-closed di dalam route.
    { prefix: "/entitlements/service/check", methods: ["GET"] }
];

app.use("/api", (req, res, next) => {
    const p = req.path;
    const rule = PUBLIC_RULES.find(rule => {
        const pathOk = rule.exact
            ? p === rule.prefix
            : p === rule.prefix || p.startsWith(rule.prefix + "/");
        return pathOk && rule.methods.includes(req.method);
    });
    if (!rule) {
        return security.authenticate(req, res, next);
    }
    // Soft-auth: jalankan authenticate; token valid → req.auth terisi,
    // token tidak ada/tidak valid → lanjut sebagai publik (tanpa 401).
    if (rule.softAuth) {
        return security.authenticate(req, res, next, { soft: true });
    }
    return next();
});

// Favicon dinamis — logo aplikasi sesuai domain (SP-029 M6-FIX).
// nginx (location = /favicon.svg|ico) mem-proxy ke sini; dipilih berdasarkan Host.
app.get("/favicon.svg", serveFavicon);
app.get("/favicon.ico", serveFavicon);

// Routes — Platform domain only
app.use("/api/superadmins", superadminRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/wilayah", wilayahRoutes);
app.use("/api/auth/register", registerRoutes);
// Monitoring Center (SP-027 M4) — dilindungi authenticate + requireSuperAdmin di dalam route
app.use("/api/monitoring", monitoringRoutes);
// Audit log (SP-027 M3 data → halaman Activity Log) — dilindungi sama seperti monitoring
app.use("/api/audit", auditRoutes);
// Applications registry (SP-027 PRE-M5 round 5) — CRUD aplikasi platform,
// dilindungi authenticate + requireSuperAdmin di dalam route
app.use("/api/applications", applicationRoutes);
// Deployment Center (SP-027 M5) — environments/builds/releases/deployments/database
app.use("/api/environments", environmentRoutes);
app.use("/api/builds", buildRoutes);
app.use("/api/releases", releaseRoutes);
app.use("/api/deployments", deploymentRoutes);
app.use("/api/database", databaseRoutes);
// Billing & Subscription Center (SP-029 M6) — plans/features/subscriptions/entitlements/usage/invoices/payments
app.use("/api/plans", planRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/entitlements", entitlementRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/billing", billingSummaryRoutes);
// System password (SP-029 M6-FIX) — ganti password sudo/OS user dari Console,
// dilindungi authenticate + requireSuperAdmin di dalam route
app.use("/api/system-password", systemPasswordRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error("[Console Server Error]", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});

// Start server
async function start() {
    try {
        await connectDB();
        // SP-027 M5: start Deployment Worker (queue in-memory) setelah DB siap
        startDeploymentWorker();
        app.listen(PORT, () => {
            console.log(`[Console Server] SMART Console API running on http://localhost:${PORT}`);
            console.log(`[Console Server] Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (err) {
        console.error("[Console Server] Failed to start:", err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on("SIGINT", async () => {
    await disconnectDB();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await disconnectDB();
    process.exit(0);
});

start();
