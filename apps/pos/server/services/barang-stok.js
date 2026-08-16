/**
 * Barang Stok Helper — SKU-aware stock adjustment (M6.2-FIX v0.43).
 *
 * Barang ber-varian (marketplace SKU) menyimpan stok PER KOMBINASI di
 * `Barang.skus[].stok`, plus stok agregat `Barang.stok` (Σ seluruh SKU)
 * agar laporan/kasir tetap konsisten tanpa migrasi.
 *
 * Helper ini menyatukan logika decrement/reversal yang tadinya tersebar
 * di penjualan & retur: item dengan `skuKode` meng-update SKU spesifik +
 * sinkron agregat; item tanpa SKU memakai $inc stok utama (behavior lama).
 *
 * @module pos/server/services/barang-stok
 */

import mongoose from "mongoose";
import { Barang } from "../models/Barang.js";

/**
 * Kurangi/tambahkan stok barang (delta negatif = terjual, positif = kembali).
 * SKU-aware: bila item membawa `skuKode`, stok kombinasi di-update + agregat
 * disinkronkan; bila tidak, $inc stok utama (existing behavior).
 *
 * @param {object} params
 * @param {string} params.companyCode
 * @param {object} params.item Item transaksi ({ kode, qty, skuKode })
 * @param {number} params.delta Perubahan stok (+/- qty)
 * @param {string} [params.gudang] Nama gudang transaksi (scoping fallback)
 * @param {string} [params.id] Barang._id eksplisit (dari katalog kasir)
 * @returns {Promise<boolean>} true bila berhasil (best effort — error dicatat)
 */
export async function adjustBarangStok({ companyCode, item, delta, gudang = "", id = null }) {
    const qty = Number(item.qty) || 0;
    if (!companyCode || !item || !item.kode || qty <= 0) return false;

    const query = { companyCode };
    if (id && mongoose.Types.ObjectId.isValid(String(id))) {
        query._id = id;
    } else if (gudang) {
        const doc = await Barang.findOne({ companyCode, kode: item.kode, gudang }).select("_id").lean()
            || await Barang.findOne({ companyCode, kode: item.kode, gudang: "" }).select("_id").lean();
        if (doc) query._id = doc._id;
        else query.kode = item.kode;
    } else {
        query.kode = item.kode;
    }

    // SKU varian: update stok kombinasi spesifik + sinkron agregat
    if (item.skuKode) {
        const doc = await Barang.findOne(query).select("skus stok").lean().catch(() => null);
        if (doc && Array.isArray(doc.skus) && doc.skus.length) {
            const idx = doc.skus.findIndex(s => String(s.kode || "") === String(item.skuKode));
            if (idx >= 0) {
                const updated = [...doc.skus];
                updated[idx] = {
                    ...updated[idx],
                    stok: Math.max(0, (Number(updated[idx].stok) || 0) + delta)
                };
                const agg = updated.reduce((sum, s) => sum + (Number(s.stok) || 0), 0);
                await Barang.findByIdAndUpdate(doc._id, { $set: { skus: updated, stok: agg } })
                    .catch(err => {
                        console.warn(`[BarangStok] Failed to adjust SKU stock for ${item.kode} (${item.skuKode}):`, err.message);
                    });
                return true;
            }
        }
    }

    await Barang.findOneAndUpdate(query, { $inc: { stok: delta } }).catch(err => {
        console.warn(`[BarangStok] Failed to adjust stock for ${item.kode}:`, err.message);
    });
    return true;
}
