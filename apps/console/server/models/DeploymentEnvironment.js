/**
 * DeploymentEnvironment Model — abstraction environment (SP-027 M5 §5).
 *
 * Setiap aplikasi memiliki environment: development, staging, production.
 * Jika infrastructure saat ini hanya memiliki production, environment lain
 * tetap ada sebagai abstraction (status configured/disabled) — tidak
 * memaksa membuat server baru.
 *
 * @module console/server/models/DeploymentEnvironment
 */

import mongoose from "mongoose";

const deploymentEnvironmentSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    name: { type: String, required: true, enum: ["development", "staging", "production"] },

    // Deployment target: tujuan fisik (pm2 app name / dir). Kosong = belum dikonfigurasi.
    target: { type: String, default: "" },
    branch: { type: String, default: "main" },

    status: { type: String, default: "configured", enum: ["configured", "disabled"] },
    monitoringEnabled: { type: Boolean, default: true },

    // State rilis terakhir
    currentVersion: { type: String, default: "" },
    lastDeploymentAt: { type: Date, default: null },
    lastDeploymentStatus: { type: String, default: "", enum: ["", "QUEUED", "RUNNING", "SUCCESS", "FAILED", "CANCELLED", "ROLLED_BACK"] },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

// Satu kombinasi (application, name) — environment unik per aplikasi
deploymentEnvironmentSchema.index({ applicationId: 1, name: 1 }, { unique: true });

export const DeploymentEnvironment = mongoose.model("DeploymentEnvironment", deploymentEnvironmentSchema);
export default DeploymentEnvironment;
