import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
    companyCode: { type: String, default: null },
    action: { type: String, required: true, enum: ["create", "update", "delete"] },
    resource: { type: String, required: true },
    resourceId: { type: String, default: null },
    resourceName: { type: String, default: "" },
    resourceCode: { type: String, default: "" },
    details: { type: String, default: "" },
    userId: { type: String, default: null },
    userName: { type: String, default: "System" }
}, { timestamps: true });

// Index for fast queries
activityLogSchema.index({ companyCode: 1, createdAt: -1 });
activityLogSchema.index({ resource: 1, createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
