/**
 * Database Connection — SMART Console Server.
 *
 * Satu MongoDB yang sama dengan Inventory Server (tidak ada perubahan schema).
 * Seed hanya untuk data Platform (Company + SuperAdmin) dan hanya berjalan
 * saat collection masih kosong.
 */

import mongoose from "mongoose";
import { seedAll } from "./seed.js";
import { migratePasswords } from "./security.js";

/**
 * Connect to MongoDB Community Server.
 *
 * @returns {Promise<string>} Connection URI
 */
export async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection.host;
    }

    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_inventory";
    console.log(`[Console DB] Connecting to MongoDB at ${uri.replace(/\/\/.*@/, "//***@")}`);

    await mongoose.connect(uri, {
        // Mongoose 8+ default connection options are sensible
    });

    console.log("[Console DB] Connected to MongoDB");

    // Seed platform data (Company + SuperAdmin) — skip jika sudah ada
    const counts = await seedAll();
    console.log(`[Console DB] Seeded: ${JSON.stringify(counts)}`);

    // SP-027 M3: migrasi password plaintext → bcrypt (idempotent)
    const migrated = await migratePasswords();
    if (migrated > 0) {
        console.log(`[Console DB] Migrasi password ke bcrypt selesai: ${migrated} akun`);
    }

    return uri;
}

/**
 * Disconnect from MongoDB.
 * Data tetap aman di disk — hanya koneksi yang ditutup.
 */
export async function disconnectDB() {
    await mongoose.disconnect();
    console.log("[Console DB] Disconnected from MongoDB");
}
