/**
 * Seed script — populates MongoDB with initial data on first connection.
 * Skips seeding if data already exists.
 *
 * All data is now focused on Food & Beverage industry (F&B).
 * Sesuai dengan jenis usaha klien.
 */

// SP-027 M2: Company & SuperAdmin seeds dipindah ke apps/console/server/seed.js
// (Platform Backend Separation). Inventory seed hanya untuk business domain.
// SP-027 M3: password seed tidak lagi hardcoded — dari ENV atau random,
// selalu di-hash bcrypt sebelum disimpan.
import crypto from "crypto";
import { User } from "./models/User.js";
import { hashPassword } from "../../../packages/smart-security/src/index.js";
import { Role } from "./models/Role.js";
import { Permission } from "./models/Permission.js";
import { Barang } from "./models/Barang.js";
import { Kategori } from "./models/Kategori.js";
import { Satuan } from "./models/Satuan.js";
import { Warehouse } from "./models/Warehouse.js";
import { Customer } from "./models/Customer.js";
import { ActivityLog } from "./models/ActivityLog.js";

const TENANT_ID = "PT-001";
const BCRYPT_ROUND = parseInt(process.env.BCRYPT_ROUND || "10", 10);

/**
 * Bangun seed user (admin & operator) — password dari ENV atau random,
 * di-hash bcrypt. Dipanggil hanya saat collection User masih kosong.
 * @returns {Promise<{seed: object[], credentials: Array<{username,password,source}>}>}
 */
async function buildUserSeed() {
    const defs = [
        {
            username: "admin",
            password: process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url"),
            source: process.env.SEED_ADMIN_PASSWORD ? "ENV" : "RANDOM",
            name: "Administrator",
            email: "admin@smart.id",
            role: "owner",
            companyCode: "PT-001",
            tenantId: TENANT_ID,
            active: true
        },
        {
            username: "operator",
            password: process.env.SEED_OPERATOR_PASSWORD || crypto.randomBytes(9).toString("base64url"),
            source: process.env.SEED_OPERATOR_PASSWORD ? "ENV" : "RANDOM",
            name: "Operator Gudang",
            email: "operator@smart.id",
            role: "operator",
            companyCode: "PT-001",
            tenantId: TENANT_ID,
            active: true
        },
        // SP-029 M3 — role Kasir: akses layar kasir (pos.kasir.use)
        {
            username: "kasir",
            password: process.env.SEED_KASIR_PASSWORD || crypto.randomBytes(9).toString("base64url"),
            source: process.env.SEED_KASIR_PASSWORD ? "ENV" : "RANDOM",
            name: "Kasir",
            email: "kasir@smart.id",
            role: "kasir",
            companyCode: "PT-001",
            tenantId: TENANT_ID,
            active: true
        }
    ];

    const seed = [];
    const credentials = [];
    for (const def of defs) {
        const { password, source, ...rest } = def;
        seed.push({ ...rest, password: await hashPassword(password, BCRYPT_ROUND) });
        credentials.push({ username: def.username, password, source });
    }
    return { seed, credentials };
}

const ROLE_TEMPLATES = [
    { name: "supervisor", label: "Supervisor",      level: 10, description: "Mengawasi operasional gudang" },
    // SP-029 M3 — Kasir: layar kasir POS (hanya akses penjualan kasir)
    { name: "kasir",      label: "Kasir",            level: 20, description: "Kasir penjualan (POS)" },
    // F&B V1 — Chef: kitchen display (lihat order + ubah status kitchen SAJA).
    // TIDAK bisa: Company Settings, User Management, Role Management, Payment
    // Settings, Bank Accounts, QRIS, Transaction Void, Financial Reports.
    { name: "chef",       label: "Chef",             level: 25, description: "Dapur F&B — kitchen order (F&B)" },
    { name: "operator",   label: "Operator Gudang",  level: 30, description: "Operator gudang" },
    { name: "admin",      label: "Admin",            level: 70, description: "Mengelola sistem inventory" },
    { name: "owner",      label: "Owner",            level: 100,description: "Pemilik / Super Admin" }
];

// Baseline permission format namespace (konsisten dengan PERMISSION_CATALOG di frontend)
// PRD V1 (keputusan PO 2026-08-10):
//   - kasir: + Customer, Riwayat transaksi (sales.read), Shift (pos.shift.*)
//   - admin: + pos.transaction.void (hanya admin/owner yang boleh void)
const PERMISSION_TEMPLATES = {
    supervisor: ["inventory.dashboard.view", "inventory.barang.read", "inventory.supplier.read", "inventory.pembelian.read", "inventory.report.view"],
    // SP-029 M3 + PRD V1 — kasir: dashboard + layar kasir + katalog + customer +
    // riwayat transaksi (read) + shift (buka/tutup). TANPA akses ubah master.
    kasir:      ["inventory.dashboard.view", "pos.kasir.use", "inventory.barang.read", "inventory.customer.read", "inventory.sales.read", "pos.shift.open", "pos.shift.close", "pos.transaction.hold", "pos.order.view", "pos.order.confirm"],
    // F&B V1 — Chef: hanya kitchen (view + update status). Tanpa dashboard
    // (default page admin) — halaman kitchen dibuka via menu/route langsung.
    chef:       ["pos.kitchen.view", "pos.kitchen.update"],
    operator:   ["inventory.barang.read", "inventory.barang.create", "inventory.pembelian.create", "inventory.stock.adjust"],
    admin:      ["inventory.barang.update", "inventory.barang.create", "inventory.supplier.create", "inventory.supplier.update", "inventory.pembelian.approve", "inventory.stock.opname", "inventory.report.export", "pos.transaction.void", "pos.shift.open", "pos.shift.close", "pos.transaction.hold", "pos.recipe.manage", "pos.qr.manage", "pos.order.view", "pos.order.confirm", "pos.kitchen.view", "pos.kitchen.update"],
    owner:      ["*"]
};

// ── Migrasi permission format lama → namespace baru (idempotent) ──
// Format lama: "barang.view", "purchase.approve", dst.
// Format baru: "inventory.barang.read", "inventory.pembelian.approve", dst.
const OLD_TO_NEW_PERM = {
    "dashboard.view": "inventory.dashboard.view",
    "barang.view": "inventory.barang.read",
    "barang.create": "inventory.barang.create",
    "barang.update": "inventory.barang.update",
    "barang.delete": "inventory.barang.delete",
    "category.view": "inventory.category.read",
    "category.create": "inventory.category.create",
    "category.update": "inventory.category.update",
    "category.delete": "inventory.category.delete",
    "rak.view": "inventory.rak.read",
    "rak.create": "inventory.rak.create",
    "rak.update": "inventory.rak.update",
    "rak.delete": "inventory.rak.delete",
    "satuan.view": "inventory.satuan.read",
    "satuan.create": "inventory.satuan.create",
    "satuan.update": "inventory.satuan.update",
    "satuan.delete": "inventory.satuan.delete",
    "unit.view": "inventory.satuan.read",
    "unit.create": "inventory.satuan.create",
    "unit.update": "inventory.satuan.update",
    "unit.delete": "inventory.satuan.delete",
    "inventory.unit.read": "inventory.satuan.read",
    "inventory.unit.create": "inventory.satuan.create",
    "inventory.unit.update": "inventory.satuan.update",
    "inventory.unit.delete": "inventory.satuan.delete",
    "warehouse.view": "inventory.warehouse.read",
    "warehouse.create": "inventory.warehouse.create",
    "warehouse.update": "inventory.warehouse.update",
    "warehouse.delete": "inventory.warehouse.delete",
    "supplier.view": "inventory.supplier.read",
    "supplier.create": "inventory.supplier.create",
    "supplier.update": "inventory.supplier.update",
    "supplier.delete": "inventory.supplier.delete",
    "customer.view": "inventory.customer.read",
    "customer.create": "inventory.customer.create",
    "customer.update": "inventory.customer.update",
    "customer.delete": "inventory.customer.delete",
    "sales.view": "inventory.sales.read",
    "sales.create": "inventory.sales.create",
    "purchase.view": "inventory.pembelian.read",
    "purchase.create": "inventory.pembelian.create",
    "purchase.approve": "inventory.pembelian.approve",
    "transfer.view": "inventory.transfer.read",
    "transfer.create": "inventory.transfer.create",
    "inventory.view": "inventory.inventory.view",
    "stock.adjust": "inventory.stock.adjust",
    "stock.opname": "inventory.stock.opname",
    "report.view": "inventory.report.view",
    "report.export": "inventory.report.export",
    "company.edit": "settings.company.edit",
    "company.create": "settings.company.create",
    "company.update": "settings.company.update",
    "company.delete": "settings.company.delete",
    "user.manage": "settings.user.manage",
    "role.manage": "settings.role.manage",
    "permission.manage": "settings.permission.manage"
};

/**
 * Normalisasi array permission:
 * - map format lama → baru
 * - pertahankan "*" dan SEMUA permission format namespace (min. 3 segmen:
 *   app.resource.action) dari namespace apa pun — agar permission baru di
 *   masa depan (mis. audit.view, hr.employee.read) tidak ikut terbuang
 * - buang hanya format lama 1–2 segmen yang tidak dikenal
 */
function normalizeRolePermissions(perms) {
    const out = [];
    for (const p of (perms || [])) {
        if (p === "*") { if (!out.includes("*")) out.push("*"); continue; }
        const mapped = OLD_TO_NEW_PERM[p];
        if (mapped) { if (!out.includes(mapped)) out.push(mapped); continue; }
        if (p.split(".").length >= 3) {
            if (!out.includes(p)) out.push(p);
            continue;
        }
        // format lama 1–2 segmen tak dikenal → dibuang
    }
    return out;
}

/**
 * Repair permission yang sudah ada di DB (idempotent, aman dijalankan tiap boot):
 * 1. Migrasi nama lama → baru, buang garbage
 * 2. Merge permission baru dari template ke dokumen existing (additive —
 *    mis. pos.transaction.hold untuk role kasir/admin di DB lama)
 * 3. Pastikan setiap role bawaan punya dokumen permission (baseline)
 */
async function repairRolePermissions() {
    let fixed = 0;
    const all = await Permission.find().lean();
    for (const doc of all) {
        const normalized = normalizeRolePermissions(doc.permissions);
        const before = [...(doc.permissions || [])].sort();
        const after = [...normalized].sort();
        if (before.length !== after.length || before.some((v, i) => v !== after[i])) {
            await Permission.updateOne({ _id: doc._id }, { $set: { permissions: normalized } });
            fixed++;
        }
    }
    for (const r of ROLE_TEMPLATES) {
        const template = PERMISSION_TEMPLATES[r.name] || [];
        const existing = await Permission.findOne({ roleName: r.name });
        if (!existing) {
            await Permission.create({ roleName: r.name, permissions: template });
            fixed++;
        } else if (template.length) {
            // Merge additive: permission baru (mis. pos.transaction.hold) ditambahkan
            // ke dokumen existing tanpa menghapus permission custom perusahaan.
            const current = normalizeRolePermissions(existing.permissions || []);
            const missing = template.filter(p => !current.includes(p));
            if (missing.length) {
                await Permission.updateOne({ _id: existing._id }, { $set: { permissions: [...current, ...missing] } });
                fixed++;
            }
        }
    }
    return fixed;
}

// ── F&B Kategori ──
const KATEGORI_SEED = [
    { companyCode: "PT-001", kode: "KAT-001", nama: "Minuman",       icon: "🥤", deskripsi: "Minuman ringan, jus, soda, dan minuman kemasan" },
    { companyCode: "PT-001", kode: "KAT-002", nama: "Makanan Ringan", icon: "🍫", deskripsi: "Cemilan, snack, keripik, dan kue kering" },
    { companyCode: "PT-001", kode: "KAT-003", nama: "Bumbu & Saus",  icon: "🧂", deskripsi: "Bumbu masak, saus sambal, kecap, dan bumbu instan" },
    { companyCode: "PT-001", kode: "KAT-004", nama: "Bahan Baku",    icon: "🍚", deskripsi: "Bahan mentah untuk produksi makanan dan minuman" },
    { companyCode: "PT-001", kode: "KAT-005", nama: "Frozen Food",   icon: "🧊", deskripsi: "Makanan beku, daging beku, dan produk olahan beku" },
    { companyCode: "PT-001", kode: "KAT-006", nama: "Susu & Olahan", icon: "🥛", deskripsi: "Susu segar, susu UHT, yoghurt, dan keju" },
    { companyCode: "PT-001", kode: "KAT-007", nama: "Roti & Kue",    icon: "🍞", deskripsi: "Roti tawar, roti manis, dan aneka kue" },
    { companyCode: "PT-001", kode: "KAT-008", nama: "Kemasan",       icon: "📦", deskripsi: "Kemasan gelas, botol, mika, dan kertas" },
    { companyCode: "PT-001", kode: "KAT-009", nama: "Lainnya",       icon: "🏷️", deskripsi: "Kategori lainnya" }
];

// ── F&B Satuan ──
const SATUAN_SEED = [
    { companyCode: "PT-001", kode: "STN-001", nama: "Pcs",    deskripsi: "Piece / buah" },
    { companyCode: "PT-001", kode: "STN-002", nama: "Kg",     deskripsi: "Kilogram" },
    { companyCode: "PT-001", kode: "STN-003", nama: "Gram",   deskripsi: "Gram" },
    { companyCode: "PT-001", kode: "STN-004", nama: "Liter",  deskripsi: "Liter" },
    { companyCode: "PT-001", kode: "STN-005", nama: "Ml",     deskripsi: "Mililiter" },
    { companyCode: "PT-001", kode: "STN-006", nama: "Pack",   deskripsi: "Pak / bungkus" },
    { companyCode: "PT-001", kode: "STN-007", nama: "Dus",    deskripsi: "Dus / box" },
    { companyCode: "PT-001", kode: "STN-008", nama: "Botol",  deskripsi: "Botol" },
    { companyCode: "PT-001", kode: "STN-009", nama: "Gelas",  deskripsi: "Gelas / cup" },
    { companyCode: "PT-001", kode: "STN-010", nama: "Kaleng", deskripsi: "Kaleng" },
    { companyCode: "PT-001", kode: "STN-011", nama: "Karton", deskripsi: "Karton / kardus besar" },
    { companyCode: "PT-001", kode: "STN-012", nama: "Sachet", deskripsi: "Sachet / kemasan kecil" }
];

const WAREHOUSE_SEED = [
    { companyCode: "PT-001", kode: "WH-001", nama: "Gudang Utama",    alamat: "Jl. Industri No. 1, Jakarta",     kontak: "Bambang", telepon: "021-1111111", deskripsi: "Gudang pusat penyimpanan barang" },
    { companyCode: "PT-001", kode: "WH-002", nama: "Gudang Cabang",   alamat: "Jl. Raya No. 10, Bandung",       kontak: "Siti",    telepon: "022-2222222", deskripsi: "Gudang cabang untuk distribusi wilayah barat" },
    { companyCode: "PT-001", kode: "WH-003", nama: "Cold Storage",   alamat: "Kawasan Industri Pulogadung",     kontak: "Agus",   telepon: "021-3333333", deskripsi: "Gudang pendingin untuk frozen food" }
];

const CUSTOMER_SEED = [
    { companyCode: "PT-001", kode: "CUS-001", nama: "Restoran Sari Rasa",    kontak: "Pak Budi", telepon: "021-4444444", email: "bud@sarirasa.com",     alamat: "Jl. Gatot Subroto No. 50, Jakarta",  deskripsi: "Restoran mitra tetap" },
    { companyCode: "PT-001", kode: "CUS-002", nama: "Cafe Kopi Kita",        kontak: "Maya",    telepon: "031-5555555", email: "maya@kopikita.co.id",    alamat: "Jl. Tunjungan No. 20, Surabaya",     deskripsi: "Cafe mitra" },
    { companyCode: "PT-001", kode: "CUS-003", nama: "Hotel Grand Indonesia", kontak: "Agung",   telepon: "022-6666666", email: "agung@grand.id",           alamat: "Jl. Merdeka No. 15, Bandung",        deskripsi: "Hotel yang memesan catering" },
    { companyCode: "PT-001", kode: "CUS-004", nama: "Katering Prima Enak",   kontak: "Susi",    telepon: "061-7777777", email: "susi@primaenak.co.id",    alamat: "Jl. Ahmad Yani No. 5, Medan",        deskripsi: "Perusahaan katering" }
];

// ── F&B Barang ──
const BARANG_SEED = [
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-001", nama: "Air Mineral 600ml",                kategori: "Minuman",       satuan: "Botol",  harga_beli: 2500,   harga_jual: 4000,   stok: 500, stok_minimum: 50,   deskripsi: "Air mineral kemasan botol 600ml" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-002", nama: "Kopi Sachet 50pcs",                kategori: "Minuman",       satuan: "Pack",   harga_beli: 45000,  harga_jual: 55000,  stok: 30,  stok_minimum: 10,   deskripsi: "Kopi bubuk sachet isi 50" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-003", nama: "Gula Pasir 1kg",                  kategori: "Bahan Baku",    satuan: "Kg",     harga_beli: 15000,  harga_jual: 18000,  stok: 60,  stok_minimum: 15,   deskripsi: "Gula pasir putih kemasan 1kg" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-004", nama: "Tepung Terigu 1kg",                kategori: "Bahan Baku",    satuan: "Kg",     harga_beli: 12000,  harga_jual: 15000,  stok: 80,  stok_minimum: 20,   deskripsi: "Tepung terigu protein sedang" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-005", nama: "Minyak Goreng 2L",                kategori: "Bahan Baku",    satuan: "Liter",  harga_beli: 30000,  harga_jual: 38000,  stok: 40,  stok_minimum: 10,   deskripsi: "Minyak goreng kemasan 2 liter" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-006", nama: "Nugget Ayam 500g",                kategori: "Frozen Food",   satuan: "Pack",   harga_beli: 28000,  harga_jual: 35000,  stok: 25,  stok_minimum: 10,   deskripsi: "Nugget ayam beku 500 gram" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-007", nama: "Sosis Sapi 1kg",                  kategori: "Frozen Food",   satuan: "Kg",     harga_beli: 55000,  harga_jual: 70000,  stok: 15,  stok_minimum: 5,    deskripsi: "Sosis sapi beku 1kg" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-008", nama: "Kecap Manis Botol 600ml",          kategori: "Bumbu & Saus",  satuan: "Botol",  harga_beli: 18000,  harga_jual: 25000,  stok: 50,  stok_minimum: 10,   deskripsi: "Kecap manis botol 600ml" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-009", nama: "Saus Sambal Botol 350ml",          kategori: "Bumbu & Saus",  satuan: "Botol",  harga_beli: 12000,  harga_jual: 18000,  stok: 45,  stok_minimum: 10,   deskripsi: "Saus sambal botol 350ml" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-010", nama: "Keripik Kentang 100g",             kategori: "Makanan Ringan", satuan: "Pcs",    harga_beli: 8000,   harga_jual: 12000,  stok: 100, stok_minimum: 20,   deskripsi: "Keripik kentang gurih 100 gram" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-011", nama: "Susu UHT Full Cream 1L",           kategori: "Susu & Olahan", satuan: "Karton", harga_beli: 180000, harga_jual: 220000, stok: 10,  stok_minimum: 3,    deskripsi: "Susu UHT full cream 1 liter per karton (12 pcs)" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-012", nama: "Roti Tawar Kupas",                kategori: "Roti & Kue",    satuan: "Pcs",    harga_beli: 28000,  harga_jual: 35000,  stok: 8,   stok_minimum: 5,    deskripsi: "Roti tawar kupas per bungkus" },
    // ── SP-029 M3 — item JASA (behavior service, tidak memakai stok) ──
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-013", nama: "Jasa Katering per Porsi",       kategori: "Lainnya",      satuan: "Porsi", harga_beli: 0,      harga_jual: 25000,  stok: 0,   stok_minimum: 0,    deskripsi: "Jasa katering nasi kotak per porsi", behavior: "service" },
    { companyCode: "PT-001", tenantId: TENANT_ID, kode: "BRG-014", nama: "Ongkos Kirim",                  kategori: "Lainnya",      satuan: "Paket", harga_beli: 0,      harga_jual: 15000,  stok: 0,   stok_minimum: 0,    deskripsi: "Biaya pengiriman pesanan", behavior: "service" }
];

/**
 * Seed all collections with data only if empty.
 * Activity logs are seeded from actual Barang collection if it has data,
 * otherwise from the BARANG_SEED array (fresh install).
 * @returns {Promise<object>} Count of documents created per collection
 */
export async function seedAll() {
    const counts = {};

    const userCount = await User.countDocuments();
    if (userCount === 0) {
        const { seed: userSeed, credentials } = await buildUserSeed();
        await User.insertMany(userSeed);
        counts.users = userSeed.length;
        console.log("[Seed] ⚠️  User seed dibuat (" + credentials.map(c => c.username + ":" + c.source).join(", ") + ").");
        for (const cred of credentials) {
            console.log("[Seed] ⚠️  Initial password " + cred.username + ": " + cred.password);
        }
        console.log("[Seed] ⚠️  Simpan password ini & segera ganti setelah login pertama.");
    }

    // Roles: Create GLOBAL roles (not per-company)
    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
        await Role.insertMany(ROLE_TEMPLATES);
        counts.roles = ROLE_TEMPLATES.length;
    } else {
        // Idempotent-ADDITIVE: role bawaan baru (mis. chef F&B V1) ditambahkan
        // ke DB yang sudah ada — seed lama hanya jalan saat DB kosong, sehingga
        // DB live tidak punya role chef → Settings Roles/Permission & dropdown
        // user tidak menampilkan chef (user chef tak bisa dibuat / kelola).
        let added = 0;
        for (const tpl of ROLE_TEMPLATES) {
            const exists = await Role.findOne({ name: tpl.name }).select("_id").lean();
            if (!exists) {
                await Role.create(tpl);
                added++;
            }
        }
        if (added > 0) {
            counts.roles = added;
            console.log(`[Seed] Role bawaan ditambahkan (idempotent): ${added}`);
        }
    }

    // Permissions: Create GLOBAL permissions
    const permCount = await Permission.countDocuments();
    if (permCount === 0) {
        const permDocs = ROLE_TEMPLATES.map(r => ({
            roleName: r.name,
            permissions: PERMISSION_TEMPLATES[r.name] || []
        }));
        await Permission.insertMany(permDocs);
        counts.permissions = permDocs.length;
    }

    // Repair/migrasi permission yang sudah ada (format lama → baru, idempotent)
    const repaired = await repairRolePermissions();
    if (repaired > 0) {
        console.log(`[Seed] Permissions normalized: ${repaired} doc(s) updated`);
    }

    const barangCount = await Barang.countDocuments();
    if (barangCount === 0) {
        await Barang.insertMany(BARANG_SEED);
        counts.barang = BARANG_SEED.length;
    }

    // ── Kategori ──
    const kategoriCount = await Kategori.countDocuments();
    if (kategoriCount === 0) {
        await Kategori.insertMany(KATEGORI_SEED);
        counts.kategori = KATEGORI_SEED.length;
    }

    // ── Satuan ──
    const satuanCount = await Satuan.countDocuments();
    if (satuanCount === 0) {
        await Satuan.insertMany(SATUAN_SEED);
        counts.satuan = SATUAN_SEED.length;
    }

    // ── Warehouse ──
    const warehouseCount = await Warehouse.countDocuments();
    if (warehouseCount === 0) {
        await Warehouse.insertMany(WAREHOUSE_SEED);
        counts.warehouse = WAREHOUSE_SEED.length;
    }

    // ── Customer ──
    const customerCount = await Customer.countDocuments();
    if (customerCount === 0) {
        await Customer.insertMany(CUSTOMER_SEED);
        counts.customer = CUSTOMER_SEED.length;
    }

    // ── Activity Logs ──
    // Clean up stale seeded activity logs (entries with fake IDs from old seeds)
    // and re-seed from actual Barang collection data
    const staleCount = await ActivityLog.countDocuments({ resourceId: /^seed-/ });
    if (staleCount > 0) {
        await ActivityLog.deleteMany({ resourceId: /^seed-/ });
        console.log(`[Seed] Cleaned ${staleCount} stale activity log(s)`);
    }

    // Seed activity logs from actual Barang collection if it has data,
    // otherwise from BARANG_SEED array (fresh install)
    const existCount = await ActivityLog.countDocuments({ resource: "barang" });
    if (existCount === 0) {
        const existingBarang = await Barang.find({}).limit(6).sort({ createdAt: -1 }).lean();
        const sourceItems = existingBarang.length > 0 ? existingBarang : BARANG_SEED;

        const activitySeed = sourceItems.map((b, i) => ({
            companyCode: b.companyCode || "PT-001",
            action: i < 2 ? "create" : i < 4 ? "update" : "create",
            resource: "barang",
            resourceId: `seed-${b.kode}`,
            resourceName: b.nama,
            resourceCode: b.kode,
            userName: "System",
            createdAt: new Date(Date.now() - (5 - i) * 60000) // staggered 1-5 menit lalu
        }));

        await ActivityLog.insertMany(activitySeed);
        counts.activity = activitySeed.length;
    }

    return counts;
}
