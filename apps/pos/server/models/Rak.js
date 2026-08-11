import mongoose from "mongoose";

const rakSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    lokasi: { type: String, default: "" },
    gudang: { type: String, default: "" },
    deskripsi: { type: String, default: "" },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "archived"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

rakSchema.index({ companyCode: 1, kode: 1 }, { unique: true });

export const Rak = mongoose.model("Rak", rakSchema);
