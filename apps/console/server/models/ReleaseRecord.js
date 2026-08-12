/**
 * ReleaseRecord Model — release management (SP-027 M5 §7).
 *
 * Release adalah entitas terpisah dari build dan deployment:
 * BUILD ≠ RELEASE ≠ DEPLOYMENT.
 * Release: { version, commit, artifact } — siap di-deploy ke environment.
 *
 * @module console/server/models/ReleaseRecord
 */

import mongoose from "mongoose";

const releaseRecordSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },

    version: { type: String, required: true },   // semver: v1.0.0
    commit: { type: String, default: "" },
    branch: { type: String, default: "main" },

    buildId: { type: mongoose.Schema.Types.ObjectId, ref: "BuildRecord", default: null },
    artifact: {
        path: { type: String, default: "" },
        sizeBytes: { type: Number, default: null },
        hash: { type: String, default: "" }
    },

    notes: { type: String, default: "" },
    status: { type: String, default: "created", enum: ["created", "deployed", "rolled_back"] },

    createdBy: { type: String, default: "" },
    deployedAt: { type: Date, default: null }
}, { timestamps: true });

// Versi unik per aplikasi
releaseRecordSchema.index({ applicationId: 1, version: 1 }, { unique: true });
releaseRecordSchema.index({ applicationId: 1, createdAt: -1 });

export const ReleaseRecord = mongoose.model("ReleaseRecord", releaseRecordSchema);
export default ReleaseRecord;
