/**
 * SMART Kasir — Backend API Server (M1 clone SMART Inventory).
 *
 * Express server with MongoDB (satu DB yang sama dengan platform).
 * Serves REST API untuk POS — reuse seluruh engine inventory.
 *
 * SP-027 M3 — Security Foundation:
 *   - helmet security headers
 *   - CORS dari ENV
 *   - rate limiting (auth + umum)
 *   - global authenticate + company scope untuk seluruh endpoint privat
 *   - permission middleware (server-side RBAC) untuk settings & master data
 */

// Load .env TERLEBIH DAHULU (sebelum import lain yang membaca process.env)
import "./env.js";

import express from "express";
import cors from "cors";
import { connectDB, disconnectDB } from "./db.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import roleRoutes from "./routes/roles.js";
import permissionRoutes from "./routes/permissions.js";
import barangRoutes from "./routes/barang.js";
import kategoriRoutes from "./routes/kategori.js";
import satuanRoutes from "./routes/satuan.js";
import warehouseRoutes from "./routes/warehouse.js";
import supplierRoutes from "./routes/supplier.js";
import customerRoutes from "./routes/customer.js";
import rakRoutes from "./routes/rak.js";
import activityRoutes from "./routes/activity.js";
import googleAuthRoutes from "./routes/auth-google.js";
import pembelianRoutes from "./routes/pembelian.js";
import penjualanRoutes from "./routes/penjualan.js";
import salesRoutes from "./routes/sales.js";
import barangGudangRoutes from "./routes/barang-gudang.js";
import transferRoutes from "./routes/transfer.js";
import stockOpnameRoutes from "./routes/stock-opname.js";
import inventoryMonitoringRoutes from "./routes/inventory-monitoring.js";
import returPembelianRoutes from "./routes/retur-pembelian.js";
import returPenjualanRoutes from "./routes/retur-penjualan.js";
import laporanRoutes from "./routes/laporan.js";
import posRoutes from "./routes/pos.js";
import posConfigRoutes, { settingsRouter as posSettingsRouter } from "./routes/pos-config.js";
import recipeRoutes from "./routes/recipes.js";
import settingsRoutes from "./routes/settings.js";
// Settings → Company: profil company dibaca/ditulis server POS (token POS
// ditolak console — audience isolation), DB bersama.
import companyProfileRoutes from "./routes/company-profile.js";
// F&B Customer Ordering V1 — QR Menu Meja, Order Meja, Kitchen, Payment, Push
import qrTableRoutes from "./routes/qr-tables.js";
import tableOrderRoutes from "./routes/table-orders.js";
import kitchenRoutes from "./routes/kitchen.js";
import companyPaymentRoutes from "./routes/company-payment.js";
import pushRoutes from "./routes/push.js";
import qrPublicRoutes from "./routes/qr-public.js";
// Payment Proof V1 — verifikasi bukti pembayaran kasir + bell notifikasi
import paymentProofRoutes from "./routes/payment-proofs.js";
// Role-Based Notification Center (F&B V1) — bell cashier & kitchen
import notificationRoutes from "./routes/notifications.js";
// F&B V1 — migration index PushSubscription (drop legacy unique index)
import { ensurePushIndexes } from "./models/PushSubscription.js";
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

const PORT = process.env.PORT || 3001;

// ── Security middleware (SP-027 M3) ──
app.use(helmetHeaders);
app.use(cors({
    origin: corsOrigins,
    credentials: true
}));
app.use(express.json({ limit: "10mb" }));

// Health check (publik) — kontrak health (SP-027 M4 §5), ringan & independen
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "pos-api",
        version: "1.0.0",
        uptime: Math.round(process.uptime()),
        timestamp: Date.now()
    });
});

// Rate limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/refresh", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/impersonate", authLimiter);
app.use("/api", apiLimiter);

// ── Global authentication (SP-027 M3) ──
// Endpoint publik (whitelist, method-aware) tetap terbuka — yang lain wajib
// access token. Login/register/forgot/reset/google/impersonate tidak butuh token.
// Catatan: di dalam app.use("/api", ...), req.path sudah RELATIF ke /api
// (contoh: "/auth/login").
const PUBLIC_RULES = [
    { prefix: "/health", methods: ["GET"] },
    { prefix: "/auth/login", methods: ["POST"] },
    { prefix: "/auth/refresh", methods: ["POST"] },
    // Logout publik: hanya me-revoke refresh token (bisa logout walau access token kedaluwarsa)
    { prefix: "/auth/logout", methods: ["POST"] },
    { prefix: "/auth/forgot-password", methods: ["POST"] },
    { prefix: "/auth/reset-password", methods: ["POST"] },
    { prefix: "/auth/register", methods: ["GET", "POST"] },
    { prefix: "/auth/generate-code", methods: ["GET"] },
    { prefix: "/auth/google", methods: ["POST"] },
    // Konfigurasi Google OAuth (client ID) untuk halaman login — publik, client
    // ID bukan secret (hanya origin terdaftar di Google Cloud Console yang valid).
    { prefix: "/auth/google/config", methods: ["GET"] },
    { prefix: "/auth/impersonate", methods: ["POST"] },
    // F&B Customer Ordering V1 — endpoint PUBLIK customer (tanpa login):
    // resolve QR meja + menu, create order, status order, web push.
    // Multi-tenant di-resolve server dari qrIdentifier (company→lokasi→table).
    { prefix: "/qr/menu", methods: ["GET"] },
    { prefix: "/qr/orders", methods: ["GET", "POST"] },
    { prefix: "/push/public-key", methods: ["GET"] },
    { prefix: "/push/subscribe", methods: ["POST"] }
];

app.use("/api", (req, res, next) => {
    const p = req.path;
    const isPublic = PUBLIC_RULES.some(
        rule =>
            (p === rule.prefix || p.startsWith(rule.prefix + "/")) &&
            rule.methods.includes(req.method)
    );
    if (isPublic) {
        return next();
    }
    return security.authenticate(req, res, next);
});

// ── Company scope (SP-027 M3) ──
// Superadmin: platform-wide. User: token.companyCode wajib cocok dengan
// header x-company-code (atau diisi dari token).
app.use("/api", security.companyScope);

// ── Routes ──
// SP-027 M2: Platform routes (superadmins, companies, platform, wilayah,
// auth/register) dipindah ke apps/console/server (port 3002).

// Settings — permission penuh (server-side RBAC)
app.use("/api/users", security.permission("settings.user.manage"), userRoutes);
app.use("/api/roles", security.methodPermissions({
    POST: "settings.role.manage",
    PUT: "settings.role.manage",
    DELETE: "settings.role.manage"
}), roleRoutes);
app.use("/api/permissions", security.methodPermissions({
    POST: "settings.permission.manage"
}), permissionRoutes);

// Master data — permission pada operasi tulis (create/update/delete),
// GET dibuka untuk authenticated + company scope (dropdown lintas halaman).
app.use("/api/barang", security.resourcePermissions("barang"), barangRoutes);
app.use("/api/kategori", security.resourcePermissions("category"), kategoriRoutes);
app.use("/api/satuan", security.resourcePermissions("satuan"), satuanRoutes);
app.use("/api/warehouse", security.resourcePermissions("warehouse"), warehouseRoutes);
app.use("/api/rak", security.resourcePermissions("rak"), rakRoutes);
app.use("/api/supplier", security.resourcePermissions("supplier"), supplierRoutes);
app.use("/api/customer", security.resourcePermissions("customer"), customerRoutes);

// Transaksi & laporan — authenticated + company scope (tanpa perubahan
// permission agar business logic tidak berubah — backward compatible).
app.use("/api/auth", authRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/auth/google", googleAuthRoutes);
app.use("/api/pembelian", pembelianRoutes);
app.use("/api/penjualan", penjualanRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/barang-gudang", barangGudangRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/stock-opname", stockOpnameRoutes);
app.use("/api/inventory-monitoring", inventoryMonitoringRoutes);
app.use("/api/retur-pembelian", returPembelianRoutes);
app.use("/api/retur-penjualan", returPenjualanRoutes);
app.use("/api/laporan", laporanRoutes);

// SP-029 M3 — kasir endpoints (authenticated + company scope global di atas)
app.use("/api/pos", posRoutes);
// SP-029 POS V1 / M6.1 — Transaction Capability config (GET/PUT)
//   /api/pos/config/transaction-types (kanonik) + /transaction-capabilities (alias)
app.use("/api/pos/config", posConfigRoutes);
// M6.1 — spesifikasi Settings: GET/PUT /api/pos/settings/transaction-capabilities
app.use("/api/pos/settings", posSettingsRouter);
// M6.2 — F&B Recipe/BOM (gate fnb + permission pos.recipe.manage di dalam route)
app.use("/api/recipes", recipeRoutes);
app.use("/api/settings", settingsRoutes);
// Settings → Company (profil company) — GET publik-authed, PUT settings.company.edit
app.use("/api/company-profile", companyProfileRoutes);

// ── F&B Customer Ordering V1 (QR Menu + Table Order + Chef + Push) ──
// Base URL link QR (env POS_BASE_URL, fallback host request).
app.set("qrBaseUrl", process.env.POS_BASE_URL || null);
// Publik customer (PUBLIC_RULES di atas) — resolve tenant dari qrIdentifier.
app.use("/api/qr", qrPublicRoutes);
// Admin: QR Menu Meja (pos.qr.manage)
app.use("/api/qr-tables", qrTableRoutes);
// Kasir: Order Meja (pos.order.view / pos.order.confirm)
app.use("/api/table-orders", tableOrderRoutes);
// Chef: Kitchen (pos.kitchen.view / pos.kitchen.update)
app.use("/api/kitchen", kitchenRoutes);
// Settings → Company → Payment Settings (settings.company.edit)
app.use("/api/company-payment", companyPaymentRoutes);
// Web push customer (public-key GET publik, subscribe POST publik)
app.use("/api/push", pushRoutes);
// Payment Proof V1 — verifikasi bukti pembayaran (kasir: pos.order.confirm)
app.use("/api/payment-proofs", paymentProofRoutes);
// Role-Based Notification Bell (F&B V1) — ?role=cashier (pos.order.view)
// / ?role=kitchen (pos.kitchen.view). Endpoint ini menangani bell kasir DAN
// kitchen (notification center, bukan sekadar icon — event tersimpan penuh).
app.use("/api/notifications", notificationRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error("[Server Error]", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});

// Start server
async function start() {
    try {
        await connectDB();
        // F&B V1 — migration PushSubscription: drop legacy unique index
        // {companyCode, endpoint} agar browser yang sama bisa terikat banyak
        // order (idempotent; kegagalan hanya di-log, tidak menggagalkan boot).
        ensurePushIndexes().catch(err => {
            console.warn("[Server] ensurePushIndexes:", err && err.message ? err.message : err);
        });
        app.listen(PORT, () => {
            console.log(`[Server] SMART Kasir API running on http://localhost:${PORT}`);
            console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (err) {
        console.error("[Server] Failed to start:", err);
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
