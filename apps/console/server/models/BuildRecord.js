/**
 * BuildRecord Model — pipeline build (SP-027 M5 §6).
 *
 * BUILD ≠ RELEASE ≠ DEPLOYMENT. Build merepresentasikan pipeline:
 * source → install → test → build → artifact.
 * Log disimpan (bukan hanya status) agar dapat ditelusuri.
 *
 * @module console/server/models/BuildRecord
 */

import mongoose from "mongoose";

const buildRecordSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    environment: { type: String, default: "development", enum: ["development", "staging", "production"] },

    commit: { type: String, default: "" },
    branch: { type: String, default: "main" },

    status: {
        type: String,
        default: "QUEUED",
        enum: ["QUEUED", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"]
    },
    steps: [{
        name: { type: String },          // install | test | build | package
        status: { type: String, enum: ["PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED"] },
        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },
        log: { type: String, default: "" }
    }],
    logs: { type: [String], default: [] }, // log pipeline (per langkah)

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },

    artifact: {
        path: { type: String, default: "" },
        sizeBytes: { type: Number, default: null },
        hash: { type: String, default: "" }
    },

    triggeredBy: { type: String, default: "" },
    error: { type: String, default: "" }
}, { timestamps: true });

buildRecordSchema.index({ applicationId: 1, createdAt: -1 });
buildRecordSchema.index({ status: 1, createdAt: -1 });

export const BuildRecord = mongoose.model("BuildRecord", buildRecordSchema);
export default BuildRecord;
