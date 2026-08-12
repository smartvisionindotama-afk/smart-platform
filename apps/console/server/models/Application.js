/**
 * Application Model — daftar aplikasi platform (SP-027 PRE-M5 round 5).
 *
 * Sebelumnya daftar aplikasi hanya registry STATIS (APPS_REGISTRY client +
 * BUILTIN_APPS @smart/core + apps.config.js monitoring) — tidak ada model
 * MongoDB, tidak ada CRUD, dan perubahan UI hilang saat refresh. Model ini
 * menjadi sumber kebenaran aplikasi untuk Console: halaman Applications
 * (CRUD), perusahaan (Akses Aplikasi), dan impersonation (gating).
 *
 * Field mengikuti APPS_REGISTRY client (slug/name/code/icon/active/domain/
 * version/description/workspace) + environment untuk keperluan deployment.
 */

import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
    // Identity
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, default: "" },
    name: { type: String, required: true },

    // Branding
    icon: { type: String, default: "📦" },
    description: { type: String, default: "" },

    // Deployment
    domain: { type: String, default: "" },
    environment: { type: String, default: "staging", enum: ["production", "staging", "development"] },
    workspace: { type: String, default: "default" },

    // SP-027 M5 — Deployment config (trusted source untuk Deployment Worker):
    // command build/start TIDAK boleh berasal dari input user saat deploy;
    // didefinisikan sekali di sini (registry) lalu divalidasi server-side.
    repository: { type: String, default: "" },
    branch: { type: String, default: "main" },
    buildCommand: { type: String, default: "npm run build" },
    testCommand: { type: String, default: "npm test" },
    startCommand: { type: String, default: "pm2 start" },
    deploymentTarget: { type: String, default: "" }, // dir tujuan / pm2 app name
    healthEndpoint: { type: String, default: "" },  // URL health check pasca-deploy

    // Status
    version: { type: String, default: "0.1.0" },
    active: { type: Boolean, default: true },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

applicationSchema.index({ name: 1 });
applicationSchema.index({ active: 1 });

export const Application = mongoose.model("Application", applicationSchema);
export default Application;
