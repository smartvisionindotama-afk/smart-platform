import mongoose from "mongoose";

const kategoriSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    deskripsi: { type: String, default: "" },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "archived"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

kategoriSchema.index({ companyCode: 1, kode: 1 }, { unique: true });

export const Kategori = mongoose.model("Kategori", kategoriSchema);
