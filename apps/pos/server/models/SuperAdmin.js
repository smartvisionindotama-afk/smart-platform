import mongoose from "mongoose";

/**
 * SuperAdmin Model — terpisah dari User (app users).
 *
 * Superadmin digunakan oleh developer/platform admin, bukan oleh
 * pengguna aplikasi. Disimpan di collection terpisah "superadmins".
 */
const superAdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    role: { type: String, default: "superadmin" },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null }
}, { timestamps: true });

// Strip password from JSON output
superAdminSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

export const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);
