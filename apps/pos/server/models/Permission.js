import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema({
    roleName: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
    tenantId: { type: String, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

export const Permission = mongoose.model("Permission", permissionSchema);
