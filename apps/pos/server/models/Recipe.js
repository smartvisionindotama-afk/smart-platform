/**
 * Recipe Model — F&B Recipe / BOM (M6.2).
 *
 * Produk F&B (Barang) dapat memiliki BEBERAPA recipe AKTIF sekaligus —
 * masing-masing adalah VARIAN produk (M6.2-FIX v0.42 "produk varian"),
 * mis. "Kopi Susu Manis" → varian "Pake Gula" & "Tanpa Gula". Di layar
 * kasir produk tampil 1 kartu; saat diorder kasir memilih varian.
 * Recipe mereferensikan item/Barang existing sebagai ingredient.
 *
 * Field `harga` = harga jual VARIAN (Rp). 0 = fallback ke harga_jual produk
 * (Barang) — untuk backward compat recipe lama tanpa harga varian.
 *
 * Lifecycle: recipe dibuat LANGSUNG active (konsep draft dihapus dari UX);
 * archived dipakai hanya bila user menghapus varian via action Hapus (hard
 * delete) atau menonaktifkan varian lama.
 *
 * Batasan V1:
 *   - tidak ada konversi unit kompleks — unit harus konsisten dgn item existing
 *   - consumption engine: ingredient.quantity × jumlah produk terjual
 *
 * @module server/models/Recipe
 */

import mongoose from "mongoose";

const recipeIngredientSchema = new mongoose.Schema({
    // Referensi item/Barang existing (Barang._id). Snapshot kode/nama dipakai
    // display & audit — sumber kebenaran stok tetap Barang.
    itemId:   { type: String, required: true },
    kode:     { type: String, default: "" },
    nama:     { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    unit:     { type: String, default: "" }
}, { _id: false });

const recipeSchema = new mongoose.Schema({
    companyCode: { type: String, required: true, index: true },
    // Produk (Barang) yang resep ini miliki. Snapshot kode/nama utk display.
    productId:   { type: String, required: true, index: true },
    productKode: { type: String, default: "" },
    productNama: { type: String, default: "" },
    name:        { type: String, required: true },
    description: { type: String, default: "" },
    // M6.2-FIX v0.42 — harga jual varian (Rp); 0 = fallback harga_jual produk
    harga:       { type: Number, default: 0, min: 0 },
    version:     { type: Number, default: 1 },
    status:      { type: String, default: "draft", enum: ["draft", "active", "archived"] },
    ingredients: { type: [recipeIngredientSchema], default: [] },
    createdBy:   { type: String, default: null },
    updatedBy:   { type: String, default: null }
}, { timestamps: true });

// Satu kombinasi (company, product, version) unik.
recipeSchema.index({ companyCode: 1, productId: 1, version: 1 }, { unique: true });

export const Recipe = mongoose.model("Recipe", recipeSchema);
