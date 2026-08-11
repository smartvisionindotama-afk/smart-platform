import mongoose from "mongoose";

/**
 * RefreshToken Model — store token (hash) untuk revoke & rotasi.
 *
 * SP-027 M3: refresh token disimpan sebagai SHA-256 hash (bukan plaintext).
 * Collection baru (tidak mengubah schema collection yang sudah ada).
 */
const refreshTokenSchema = new mongoose.Schema(
    {
        tokenHash: { type: String, required: true, unique: true },
        userId: { type: String, required: true },
        userType: { type: String, enum: ["user", "superadmin"], default: "user" },
        role: { type: String, default: null },
        companyCode: { type: String, default: null },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date, default: null },
        ip: { type: String, default: "" },
        userAgent: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, userType: 1 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export default RefreshToken;
