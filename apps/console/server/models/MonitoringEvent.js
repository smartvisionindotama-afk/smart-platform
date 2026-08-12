/**
 * MonitoringEvent — penyimpanan event monitoring (SP-027 M4 §9).
 *
 * Struktur minimal:
 *   timestamp, service, metric, status, value, severity, message
 *
 * Retensi: TTL index pada createdAt (default 7 hari, configurable via
 * MONITORING_RETENTION_DAYS) — data monitoring tidak disimpan tanpa batas.
 * Collection: monitoringevents
 *
 * @module console/server/models/MonitoringEvent
 */

import mongoose from "mongoose";

const monitoringEventSchema = new mongoose.Schema(
    {
        timestamp: { type: Number, default: Date.now }, // epoch ms
        service: { type: String, required: true, index: true },
        metric: { type: String, default: "health", index: true },
        status: { type: String, default: "UNKNOWN" },
        value: { type: mongoose.Schema.Types.Mixed, default: null },
        severity: { type: String, default: "WARNING", index: true },
        message: { type: String, default: "" }
    },
    {
        timestamps: true,
        collection: "monitoringevents"
    }
);

// TTL retention — dokumen otomatis dihapus oleh MongoDB setelah N hari
// (MONITORING_RETENTION_DAYS, default 7) — data monitoring tidak disimpan tanpa batas.
const retentionDays = parseInt(process.env.MONITORING_RETENTION_DAYS, 10) || 7;
monitoringEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionDays * 24 * 60 * 60 });

export const MonitoringEvent = mongoose.model("MonitoringEvent", monitoringEventSchema);
export default MonitoringEvent;
