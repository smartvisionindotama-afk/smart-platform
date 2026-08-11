/**
 * Environment Loader — SMART Inventory Server.
 *
 * WAJIB di-import PALING PERTAMA (sebelum security.js / routes) karena ESM
 * mengevaluasi import sebelum body module — jika .env dimuat di body index.js,
 * securityConfig() (yang membaca process.env) akan berjalan lebih dulu dan
 * memakai secret ephemeral acak. Dengan env.js, .env termuat saat import
 * pertama dievaluasi.
 *
 * @module inventory/server/env
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, ".env");

export function loadEnvFile(filePath = envPath) {
    if (!fs.existsSync(filePath)) {
        return false;
    }
    const envContent = fs.readFileSync(filePath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key && !process.env[key]) {
            process.env[key] = val;
        }
    }
    return true;
}

export const loaded = loadEnvFile();
if (loaded) {
    console.log("[Server] Loaded .env file");
}

export default { loadEnvFile, loaded };
