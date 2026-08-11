/**
 * Database Connection.
 *
 * Uses MongoDB Community Server (production) via MONGO_URI from .env.
 * Default: mongodb://127.0.0.1:27017/smart_inventory
 * Seed hanya sekali saat pertama kali database kosong.
 */

import mongoose from "mongoose";
import { seedAll } from "./seed.js";
import { migratePasswords } from "./security.js";

/**
 * Connect to MongoDB Community Server.
 * Data is persisted in MongoDB data directory (/var/lib/mongodb).
 *
 * @returns {Promise<string>} Connection URI
 */
export async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection.host;
    }

    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_inventory";
    console.log(`[DB] Connecting to MongoDB at ${uri.replace(/\/\/.*@/, "//***@")}`);

    await mongoose.connect(uri, {
        // Mongoose 8+ default connection options are sensible
    });

    console.log("[DB] Connected to MongoDB");

    // Seed initial data — seedAll() otomatis skip jika data sudah ada
    const counts = await seedAll();
    console.log(`[DB] Seeded: ${JSON.stringify(counts)}`);

    // SP-027 M3: migrasi password plaintext → bcrypt (idempotent)
    const migrated = await migratePasswords();
    if (migrated > 0) {
        console.log(`[DB] Migrasi password ke bcrypt selesai: ${migrated} akun`);
    }

    return uri;
}

/**
 * Disconnect from MongoDB.
 * Data tetap aman di disk — hanya koneksi yang ditutup.
 */
export async function disconnectDB() {
    await mongoose.disconnect();
    console.log("[DB] Disconnected from MongoDB");
}
