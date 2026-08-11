import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    role: { type: String, default: "supervisor" },
    companyCode: { type: String, default: "" },
    tenantId: { type: String, default: null },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "suspended"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null }
}, { timestamps: true });

// Strip password from JSON output
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

export const User = mongoose.model("User", userSchema);
