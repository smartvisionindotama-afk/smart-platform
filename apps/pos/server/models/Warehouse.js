import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    kode: { type: String, required: true },
    nama: { type: String, required: true },
    alamat: { type: String, default: "" },
    kontak: { type: String, default: "" },
    telepon: { type: String, default: "" },
    deskripsi: { type: String, default: "" },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "archived"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

warehouseSchema.index({ companyCode: 1, kode: 1 }, { unique: true });

export const Warehouse = mongoose.model("Warehouse", warehouseSchema);
