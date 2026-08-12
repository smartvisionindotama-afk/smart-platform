import mongoose from "mongoose";

/**
 * SecurityAuditLog Model — jejak keamanan (login/logout/failed login/
 * password change/role change/company switch/aktivitas super admin).
 *
 * SP-027 M3: collection baru, terpisah dari ActivityLog (log bisnis).
 */
const securityAuditLogSchema = new mongoose.Schema(
    {
        actorId: { type: String, default: null },
        actorName: { type: String, default: "System" },
        actorType: { type: String, enum: ["user", "superadmin", "system"], default: "system" },
        action: { type: String, required: true },
        category: { type: String, default: "general" },
        targetType: { type: String, default: null },
        targetId: { type: String, default: null },
        targetName: { type: String, default: "" },
        result: { type: String, enum: ["success", "failed"], default: "success" },
        ip: { type: String, default: "" },
        userAgent: { type: String, default: "" },
        metadata: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

securityAuditLogSchema.index({ createdAt: -1 });
securityAuditLogSchema.index({ actorId: 1, createdAt: -1 });
securityAuditLogSchema.index({ action: 1, createdAt: -1 });

export const SecurityAuditLog = mongoose.model("SecurityAuditLog", securityAuditLogSchema);
export default SecurityAuditLog;
