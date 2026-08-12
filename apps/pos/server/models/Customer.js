import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
    companyCode: { type: String, required: true },
    kode: { type: String, required: true },
    // M6-FIX — kode kartu NFC member (diisi admin; kasir men-tap kartu NFC →
    // kode NFC dibaca & dicocokkan ke member ini). Opsional.
    kodeNfc: { type: String, default: "" },
    nama: { type: String, required: true },
    kontak: { type: String, default: "" },
    telepon: { type: String, default: "" },
    email: { type: String, default: "" },
    alamat: { type: String, default: "" },
    deskripsi: { type: String, default: "" },
    active: { type: Boolean, default: true },
    status: { type: String, default: "active", enum: ["active", "inactive", "archived"] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

customerSchema.index({ companyCode: 1, kode: 1 }, { unique: true });

export const Customer = mongoose.model("Customer", customerSchema);
