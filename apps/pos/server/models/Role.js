import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    level: { type: Number, default: 10 },
    description: { type: String, default: "" },
    companyCode: { type: String, default: "" },
    tenantId: { type: String, default: null },
    status: { type: String, default: "active", enum: ["active", "inactive"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

export const Role = mongoose.model("Role", roleSchema);
