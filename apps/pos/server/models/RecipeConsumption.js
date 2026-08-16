/**
 * RecipeConsumption Model — log consumption bahan (M6.2).
 *
 * Mencatat pengurangan stok ingredient yang terjadi karena penjualan produk
 * F&B ber-recipe. Terikat pada transaksi penjualan (saleId) — basis
 * idempotency: transaksi yang sama TIDAK boleh mengurangi stok dua kali
 * (unique index saleId + productId).
 *
 * status: "applied" (bahan sudah dikurangi) | "reversed" (void → dikembalikan)
 *
 * @module server/models/RecipeConsumption
 */

import mongoose from "mongoose";

const consumptionIngredientSchema = new mongoose.Schema({
    itemId:   { type: String, required: true },
    kode:     { type: String, default: "" },
    nama:     { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    unit:     { type: String, default: "" }
}, { _id: false });

const recipeConsumptionSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    // Referensi transaksi penjualan (Penjualan._id) + nomor nota (display).
    saleId:      { type: String, required: true },
    saleNomor:   { type: String, default: "" },
    // Produk F&B yang dijual (Barang._id) + snapshot display.
    productId:   { type: String, required: true },
    productKode: { type: String, default: "" },
    productNama: { type: String, default: "" },
    recipeId:    { type: String, default: "" },
    quantity:    { type: Number, default: 1 }, // jumlah produk terjual
    ingredients: { type: [consumptionIngredientSchema], default: [] },
    status:      { type: String, default: "applied", enum: ["applied", "reversed"] },
    reversedAt:  { type: Date, default: null },
    reversedBy:  { type: String, default: "" },
    createdBy:   { type: String, default: null }
}, { timestamps: true });

// Idempotency: satu VARIAN (recipeId) produk pada satu transaksi hanya boleh
// dikonsumsi sekali. (saleId, productId) TIDAK cukup — produk bisa punya
// beberapa varian aktif (M6.2-FIX v0.42 "produk varian").
recipeConsumptionSchema.index({ saleId: 1, productId: 1, recipeId: 1 }, { unique: true });

export const RecipeConsumption = mongoose.model("RecipeConsumption", recipeConsumptionSchema);
