/**
 * DeploymentRecord Model — deployment entity (SP-027 M5 §8).
 *
 * Deployment merepresentasikan aksi menempatkan RELEASE ke ENVIRONMENT:
 *
 *   Deployment #2026-00031
 *   Application : SMART Inventory
 *   Environment : Production
 *   Version     : v1.4.2
 *   Commit      : abc123
 *   Triggered By: Super Admin
 *   Status      : SUCCESS
 *
 * Status: QUEUED → RUNNING → SUCCESS | FAILED | CANCELLED | ROLLED_BACK
 *
 * @module console/server/models/DeploymentRecord
 */

import mongoose from "mongoose";

const deploymentRecordSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    environment: { type: String, required: true, enum: ["development", "staging", "production"] },

    version: { type: String, default: "" },        // release version yang di-deploy
    commit: { type: String, default: "" },
    releaseId: { type: mongoose.Schema.Types.ObjectId, ref: "ReleaseRecord", default: null },
    buildId: { type: mongoose.Schema.Types.ObjectId, ref: "BuildRecord", default: null },

    status: {
        type: String,
        default: "QUEUED",
        enum: ["QUEUED", "RUNNING", "SUCCESS", "FAILED", "CANCELLED", "ROLLED_BACK"]
    },
    steps: [{
        name: { type: String },                    // deploy | verify | health-check
        status: { type: String, enum: ["PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED"] },
        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },
        log: { type: String, default: "" }
    }],
    logs: { type: String, default: "" },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },

    healthCheck: {
        httpStatus: { type: Number, default: null },
        responseTimeMs: { type: Number, default: null },
        ok: { type: Boolean, default: false },
        message: { type: String, default: "" }
    },

    triggeredBy: { type: String, default: "" },
    rollbackOf: { type: mongoose.Schema.Types.ObjectId, ref: "DeploymentRecord", default: null },
    error: { type: String, default: "" }
}, { timestamps: true });

deploymentRecordSchema.index({ applicationId: 1, createdAt: -1 });
deploymentRecordSchema.index({ environment: 1, createdAt: -1 });
deploymentRecordSchema.index({ status: 1, createdAt: -1 });

export const DeploymentRecord = mongoose.model("DeploymentRecord", deploymentRecordSchema);
export default DeploymentRecord;
