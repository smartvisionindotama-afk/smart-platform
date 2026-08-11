/**
 * Demo Bootstrap — SMART Kasir (SP-029 M3).
 *
 * Menyiapkan data demo untuk melihat hasil POS (idempotent, aman diulang):
 *   1. Company PT-001 mendapat akses aplikasi "pos" (gate login M2)
 *   2. Role & Permission "kasir" (pos.kasir.use + inventory.barang.read)
 *   3. User demo "kasir" (password dari DEMO_KASIR_PASSWORD atau default)
 *   4. Item jasa (behavior service) BRG-013 & BRG-014 untuk PT-001
 *
 * Menjalankan: node scripts/demo-bootstrap.js
 * Environment: DEMO_KASIR_PASSWORD (opsional, default "Kasir@2026!")
 */
import "../env.js"; // WAJIB load .env (MONGO_URI, dst) sebelum koneksi
import mongoose from "mongoose";
import { hashPassword } from "../../../../packages/smart-security/src/index.js";
import { User } from "../models/User.js";
import { Role } from "../models/Role.js";
import { Permission } from "../models/Permission.js";
import { Barang } from "../models/Barang.js";

// Schema minimal Company (model asli ada di apps/console) — strict:false agar
// hanya memodifikasi field yang dibutuhkan tanpa bergantung pada path console.
const Company = mongoose.model("Company", new mongoose.Schema({
    code: { type: String },
    apps: { type: [String], default: [] }
}, { strict: false }));

const COMPANY_CODE = "PT-001";
const DEMO_KASIR_PASSWORD = process.env.DEMO_KASIR_PASSWORD || "Kasir@2026!";
const BCRYPT_ROUND = parseInt(process.env.BCRYPT_ROUND || "10", 10);

const SERVICE_ITEMS = [
    { kode: "BRG-013", nama: "Jasa Katering per Porsi", kategori: "Lainnya", satuan: "Porsi", harga_jual: 25000, deskripsi: "Jasa katering nasi kotak per porsi" },
    { kode: "BRG-014", nama: "Ongkos Kirim", kategori: "Lainnya", satuan: "Paket", harga_jual: 15000, deskripsi: "Biaya pengiriman pesanan" }
];

async function run() {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_inventory";
    console.log("[Bootstrap] Menyambungkan ke MongoDB...");
    await mongoose.connect(uri);

    // 1. Company PT-001 → akses aplikasi "pos"
    const comp = await Company.findOneAndUpdate(
        { code: COMPANY_CODE },
        { $addToSet: { apps: "pos" } },
        { new: true }
    );
    if (comp) {
        console.log(`[Bootstrap] Company ${COMPANY_CODE} apps: ${(comp.apps || []).join(", ")}`);
    } else {
        console.log(`[Bootstrap] ⚠️ Company ${COMPANY_CODE} tidak ditemukan — login user POS tetap 403 sampai akses diaktifkan.`);
    }

    // 2. Role & Permission kasir
    const role = await Role.findOneAndUpdate(
        { name: "kasir" },
        { $setOnInsert: { name: "kasir", label: "Kasir", level: 20, description: "Kasir penjualan (POS)" } },
        { upsert: true, new: true }
    );
    console.log(`[Bootstrap] Role kasir: ${role._id ? "siap" : "?"}`);
    const perm = await Permission.findOneAndUpdate(
        { roleName: "kasir" },
        { $set: { permissions: ["inventory.dashboard.view", "pos.kasir.use", "inventory.barang.read"] } },
        { upsert: true, new: true }
    );
    console.log(`[Bootstrap] Permission kasir: ${(perm.permissions || []).join(", ")}`);

    // 3. User demo kasir
    const hashed = await hashPassword(DEMO_KASIR_PASSWORD, BCRYPT_ROUND);
    const user = await User.findOneAndUpdate(
        { username: "kasir" },
        {
            $set: {
                name: "Kasir",
                email: "kasir@smart.id",
                role: "kasir",
                companyCode: COMPANY_CODE,
                tenantId: COMPANY_CODE,
                active: true,
                status: "active"
            },
            $setOnInsert: { password: hashed }
        },
        { upsert: true, new: true }
    );
    if (!user.password || String(user.password).length < 10) {
        // Upsert lama tanpa password baru → perbarui hash
        await User.updateOne({ _id: user._id }, { $set: { password: hashed } });
    }
    console.log(`[Bootstrap] User demo: username=kasir, password=${DEMO_KASIR_PASSWORD}, role=kasir`);

    // 4. Item jasa
    for (const item of SERVICE_ITEMS) {
        const existing = await Barang.findOne({ companyCode: COMPANY_CODE, kode: item.kode });
        if (!existing) {
            await Barang.create({
                companyCode: COMPANY_CODE,
                tenantId: COMPANY_CODE,
                behavior: "service",
                active: true,
                status: "active",
                stok: 0,
                stok_minimum: 0,
                harga_beli: 0,
                ...item
            });
            console.log(`[Bootstrap] Barang jasa dibuat: ${item.kode} — ${item.nama}`);
        } else {
            await Barang.updateOne({ _id: existing._id }, { $set: { behavior: "service", active: true } });
            console.log(`[Bootstrap] Barang jasa sudah ada: ${item.kode}`);
        }
    }

    console.log("[Bootstrap] Selesai ✓");
    await mongoose.disconnect();
}

run().catch(err => {
    console.error("[Bootstrap] Gagal:", err);
    process.exit(1);
});
