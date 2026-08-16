/**
 * Recipe Service — F&B Recipe / BOM Engine (M6.2).
 *
 * Engine-first: seluruh perhitungan murni (pure, testable) terpisah dari
 * akses DB. Integrasi stock mengikuti pola stock mutation existing (tidak
 * membuat stock engine kedua).
 *
 * ── Engine (pure) ──
 *   calculateRecipeConsumption(recipe, quantity)
 *       → ingredient.quantity × quantity (contoh: 2 telur × 3 = 6 telur)
 *   calculateRecipeCost(recipe, itemCosts)
 *       → Σ ingredient.quantity × cost (harga_beli item existing)
 *   validateRecipeIngredients(ingredients, items)
 *       → item harus ada, quantity > 0, tanpa duplikat, unit konsisten
 *
 * ── DB (thin) ──
 *   listRecipes / getRecipeById / createRecipe / updateRecipe /
 *   activateRecipe / archiveRecipe / getActiveRecipeByProduct
 *
 * Aturan (M6.2-FIX v0.42 — "produk varian"):
 *   - satu produk → BEBERAPA recipe AKTIF sekaligus = VARIAN produk
 *     (mis. Kopi Susu Manis → varian "Pake Gula" & "Tanpa Gula")
 *   - recipe baru / edit / duplikat LANGSUNG berstatus active
 *   - edit SELALU mengubah dokumen yang sama (in-place, tanpa versi baru)
 *   - Hapus = hard delete permanen (log RecipeConsumption menyimpan snapshot
 *     ingredients, jadi reversal void tetap aman setelah recipe dihapus)
 *   - `harga` per varian (0 = fallback harga_jual produk di kasir)
 *   - konsumsi stok memakai recipeId VARIAN yang dipilih di transaksi
 *     (bukan "recipe aktif tunggal per produk") — fallback ke recipe aktif
 *     pertama untuk data lama tanpa recipeId di item
 *
 * @module pos/server/services/recipe
 */

import { Recipe } from "../models/Recipe.js";
import { RecipeConsumption } from "../models/RecipeConsumption.js";
import { Barang } from "../models/Barang.js";

/** Pembulatan untuk menghindari noise float (0.2×3 = 0.6000000000000001). */
export function roundQty(n, decimals = 4) {
    const f = Math.pow(10, decimals);
    return Math.round((Number(n) || 0) * f) / f;
}

/**
 * Engine — hitung konsumsi ingredient untuk N unit produk terjual.
 * @param {object} recipe Dokumen Recipe (field ingredients[])
 * @param {number} quantity Jumlah produk terjual (> 0)
 * @returns {Array<{itemId:string, kode:string, nama:string, quantity:number, unit:string}>}
 */
export function calculateRecipeConsumption(recipe, quantity) {
    const qty = Number(quantity) || 0;
    if (!recipe || !Array.isArray(recipe.ingredients) || qty <= 0) return [];
    return recipe.ingredients.map(ing => ({
        itemId: String(ing.itemId || ""),
        kode: ing.kode || "",
        nama: ing.nama || "",
        quantity: roundQty(ing.quantity * qty),
        unit: ing.unit || ""
    }));
}

/**
 * Engine — biaya recipe (HPP dasar).
 * recipeCost = Σ ingredient.quantity × ingredient.cost
 *
 * cost memakai harga_beli (harga pokok) item existing. Bila salah satu
 * ingredient tidak memiliki cost yang reliable (harga_beli <= 0 / tidak
 * tersedia), totalCost & costPerServing dikembalikan null (jangan mengarang
 * nilai) — dependency didokumentasikan.
 *
 * @param {object} recipe Dokumen Recipe
 * @param {Array<{itemId:string, cost?:number}>} itemCosts Daftar cost per item
 * @returns {{recipeId: string, totalCost: number|null, costPerServing: number|null, items: Array}}
 */
export function calculateRecipeCost(recipe, itemCosts = []) {
    const costMap = new Map(itemCosts.map(c => [String(c.itemId), Number(c.cost) || 0]));
    const ingredients = (recipe && Array.isArray(recipe.ingredients)) ? recipe.ingredients : [];
    const items = ingredients.map(ing => {
        const cost = costMap.get(String(ing.itemId));
        return {
            itemId: String(ing.itemId || ""),
            kode: ing.kode || "",
            nama: ing.nama || "",
            quantity: roundQty(ing.quantity),
            unit: ing.unit || "",
            cost: typeof cost === "number" && cost > 0 ? cost : null,
            lineTotal: typeof cost === "number" && cost > 0 ? roundQty(ing.quantity * cost, 2) : null
        };
    });
    const hasMissingCost = items.some(i => i.cost === null);
    const totalCost = hasMissingCost
        ? null
        : roundQty(items.reduce((s, i) => s + i.lineTotal, 0), 2);
    return {
        recipeId: recipe ? String(recipe._id || recipe.id || "") : "",
        totalCost,
        // Recipe mendefinisikan bahan per SATU porsi produk → cost per serving
        // = total cost resep (belum ada konversi batch pada V1).
        costPerServing: totalCost,
        items
    };
}

/**
 * Validasi ingredient (pure) — aturan V1:
 *   - item harus mereferensikan Barang existing (dari daftar items yang
 *     di-resolve server; yang tidak ada → ditolak)
 *   - quantity numeric > 0 (0 / negatif → ditolak)
 *   - tidak boleh duplikat itemId dalam satu recipe
 *   - minimal 1 ingredient
 *   - unit konsisten dengan satuan item existing (jika item.satuan terisi dan
 *     unit yang dikirim beda → ditolak; unit kosong → diisi dari item.satuan)
 * @param {Array} ingredients Input ingredient dari client
 * @param {Array} items Daftar Barang yang di-resolve (dokumen/lean)
 * @returns {{ok: true, value: Array} | {ok: false, error: string}}
 */
export function validateRecipeIngredients(ingredients, items) {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return { ok: false, error: "Recipe harus memiliki minimal 1 ingredient" };
    }
    const itemMap = new Map(items.map(b => [String(b._id), b]));
    const seen = new Set();
    const out = [];
    for (const ing of ingredients) {
        const itemId = String((ing && ing.itemId) || "");
        if (!itemId) return { ok: false, error: "Ingredient wajib memiliki itemId" };
        const item = itemMap.get(itemId);
        if (!item) {
            return { ok: false, error: `Ingredient item \"${itemId}\" tidak ditemukan` };
        }
        if (seen.has(itemId)) {
            return { ok: false, error: `Ingredient duplikat: \"${item.nama || item.kode || itemId}\"` };
        }
        seen.add(itemId);
        const quantity = Number(ing.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { ok: false, error: `Quantity ingredient \"${item.nama || item.kode || itemId}\" harus angka > 0` };
        }
        const itemUnit = String(item.satuan || "").trim();
        const reqUnit = String((ing.unit === undefined || ing.unit === null) ? "" : ing.unit).trim();
        if (itemUnit && reqUnit && reqUnit.toLowerCase() !== itemUnit.toLowerCase()) {
            return { ok: false, error: `Unit ingredient \"${item.nama || item.kode}\" (${reqUnit}) tidak konsisten dengan satuan item (${itemUnit})` };
        }
        out.push({
            itemId,
            kode: item.kode || "",
            nama: item.nama || "",
            quantity: roundQty(quantity),
            unit: reqUnit || itemUnit
        });
    }
    return { ok: true, value: out };
}

/**
 * Validasi payload create/update recipe (pure) — setelah items di-resolve.
 * @param {object} data Body client
 * @param {Array} items Daftar Barang ter-resolve (termasuk produk)
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
export function validateRecipePayload(data, items) {
    const productId = String((data && data.productId) || "");
    if (!productId) return { ok: false, error: "Produk wajib diisi" };
    const product = items.find(b => String(b._id) === productId);
    if (!product) return { ok: false, error: `Produk \"${productId}\" tidak ditemukan` };
    // M6.2-FIX — sinkron dengan Master → Barang: produk model SIMPLE
    // (behavior "recipe", tanpa stok) tidak bisa dijadikan Recipe F&B karena
    // bahan tidak dikonsumsi realtime (penyesuaian via stok opname). User
    // harus mengubah tipe barang ke "Resep / Menu (Terhubung Recipe F&B)".
    if (String(product.behavior || "trading") === "recipe") {
        return {
            ok: false,
            error: `Produk \"${product.nama || product.kode || productId}\" bertipe Resep (tanpa stok) — tidak bisa dibuatkan Recipe F&B. Ubah tipe barang menjadi \"Resep / Menu (Terhubung Recipe F&B)\" di Master → Barang.`
        };
    }
    const name = String((data && data.name) || "").trim();
    if (!name) return { ok: false, error: "Nama recipe wajib diisi" };
    const ingCheck = validateRecipeIngredients(data && data.ingredients, items);
    if (!ingCheck.ok) return { ok: false, error: ingCheck.error };
    return {
        ok: true,
        value: {
            productId,
            productKode: product.kode || "",
            productNama: product.nama || "",
            name,
            description: String((data && data.description) || "").slice(0, 500),
            // M6.2-FIX v0.42 — harga varian (Rp); 0 = fallback harga_jual produk
            harga: Math.max(0, Number(data && data.harga) || 0),
            ingredients: ingCheck.value
        }
    };
}

/** Ambil versi tertinggi recipe untuk produk (untuk version increment). */
export async function getNextRecipeVersion(companyCode, productId) {
    const last = await Recipe.findOne({ companyCode, productId })
        .sort({ version: -1 })
        .select("version")
        .lean();
    return (last && Number(last.version)) ? Number(last.version) + 1 : 1;
}

/**
 * List recipe (company-scoped) dengan filter opsional status/productId/search.
 */
export async function listRecipes({ companyCode, status, productId, search, page = 1, limit = 20 }) {
    const q = { companyCode };
    if (status) q.status = status;
    if (productId) q.productId = productId;
    if (search) {
        q.$or = [
            { name: { $regex: String(search), $options: "i" } },
            { productNama: { $regex: String(search), $options: "i" } },
            { productKode: { $regex: String(search), $options: "i" } }
        ];
    }
    const total = await Recipe.countDocuments(q);
    const data = await Recipe.find(q)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Detail recipe — wajib company-scoped. */
export async function getRecipeById(id, companyCode) {
    const recipe = await Recipe.findOne({ _id: id, companyCode }).lean();
    return recipe || null;
}

/** Recipe AKTIF untuk sebuah produk (satu per produk — dijamin activate). */
export async function getActiveRecipeByProduct(productId, companyCode) {
    return Recipe.findOne({ companyCode, productId, status: "active" }).lean();
}

/**
 * Create recipe — LANGSUNG AKTIF, varian baru utk produk (M6.2-FIX v0.42):
 * produk boleh punya BANYAK recipe aktif sekaligus (= varian), jadi recipe
 * aktif lain utk produk yang sama TIDAK di-archive.
 * @param {object} payload Hasil validateRecipePayload (sudah ternormalisasi)
 */
export async function createRecipe({ companyCode, payload, user }) {
    const version = await getNextRecipeVersion(companyCode, payload.productId);
    return Recipe.create({
        companyCode,
        ...payload,
        version,
        status: "active",
        createdBy: user,
        updatedBy: user
    });
}

/**
 * Update recipe — SELALU edit di tempat (in-place), tanpa versi draft baru
 * (M6.2-FIX v0.42 "produk varian"): beberapa recipe aktif per produk
 * diperbolehkan, jadi recipe aktif lain TIDAK di-archive.
 * @returns {Promise<object>} Recipe yang diubah
 */
export async function updateRecipe({ id, companyCode, payload, user }) {
    const existing = await Recipe.findOne({ _id: id, companyCode });
    if (!existing) return null;
    existing.productId = payload.productId;
    existing.productKode = payload.productKode;
    existing.productNama = payload.productNama;
    existing.name = payload.name;
    existing.description = payload.description;
    existing.harga = payload.harga || 0;
    existing.ingredients = payload.ingredients;
    existing.status = "active"; // edit = langsung aktif
    existing.updatedBy = user;
    await existing.save();
    return existing;
}

/**
 * Duplicate recipe — salinan varian baru yang LANGSUNG AKTIF (M6.2-FIX
 * v0.42). Nama diberi akhiran " (copy)"; version = versi berikutnya utk
 * produk tsb. Recipe aktif lain TIDAK di-archive (varian).
 * @param {object} opts { id, companyCode, user }
 * @returns {Promise<object|null>} Recipe salinan
 */
export async function duplicateRecipe({ id, companyCode, user }) {
    const source = await Recipe.findOne({ _id: id, companyCode });
    if (!source) return null;
    const version = await getNextRecipeVersion(companyCode, source.productId);
    return Recipe.create({
        companyCode,
        productId: source.productId,
        productKode: source.productKode || "",
        productNama: source.productNama || "",
        name: `${source.name} (copy)`,
        description: source.description || "",
        harga: source.harga || 0,
        ingredients: Array.isArray(source.ingredients) ? source.ingredients.map(i => ({ ...i })) : [],
        version,
        status: "active",
        createdBy: user,
        updatedBy: user
    });
}

/**
 * Hapus recipe permanen (M6.2-FIX v0.38). Log RecipeConsumption menyimpan
 * snapshot ingredients — reversal void tetap aman setelah recipe dihapus.
 * @param {object} opts { id, companyCode }
 * @returns {Promise<boolean>} true bila terhapus
 */
export async function deleteRecipe({ id, companyCode }) {
    const result = await Recipe.deleteOne({ _id: id, companyCode });
    return Boolean(result && result.deletedCount > 0);
}

/**
 * Activate recipe — hanya satu active per produk:
 * semua recipe active untuk produk tsb di-archive dulu, lalu target di-activate.
 */
export async function activateRecipe({ id, companyCode, user }) {
    const recipe = await Recipe.findOne({ _id: id, companyCode });
    if (!recipe) return null;
    if (recipe.status === "archived") {
        const err = new Error("Recipe yang di-archive tidak bisa diaktifkan — buat versi baru");
        err.status = 400;
        throw err;
    }
    await Recipe.updateMany(
        { companyCode, productId: recipe.productId, status: "active" },
        { $set: { status: "archived", updatedBy: user } }
    );
    recipe.status = "active";
    recipe.updatedBy = user;
    await recipe.save();
    return recipe;
}

/** Archive recipe (soft). */
export async function archiveRecipe({ id, companyCode, user }) {
    const recipe = await Recipe.findOneAndUpdate(
        { _id: id, companyCode },
        { $set: { status: "archived", updatedBy: user } },
        { new: true }
    );
    return recipe;
}

/**
 * Kurangi stok ingredient (pola stock mutation existing — best effort,
 * scoped company + gudang transaksi; kegagalan dicatat, tidak menggagalkan
 * transaksi utama). Satu-satunya tempat mutasi stok ingredient di V1.
 * @private
 */
async function reduceIngredientStock(companyCode, ing, sale) {
    const q = { companyCode, _id: ing.itemId };
    if (sale && sale.gudang) {
        const doc = await Barang.findOne({ ...q, gudang: sale.gudang }).select("_id").lean()
            || await Barang.findOne({ ...q, gudang: "" }).select("_id").lean();
        if (doc) q._id = doc._id;
        else delete q.gudang;
    }
    await Barang.findOneAndUpdate(
        q,
        { $inc: { stok: -ing.quantity } }
    ).catch(err => {
        console.warn(`[Recipe] Gagal kurangi stok ingredient ${ing.kode} (${ing.itemId}):`, err.message);
    });
}

/**
 * Kembalikan stok ingredient saat void (pola reversal existing). @private
 */
async function increaseIngredientStock(companyCode, ing, sale) {
    const q = { companyCode, _id: ing.itemId };
    if (sale && sale.gudang) {
        const doc = await Barang.findOne({ ...q, gudang: sale.gudang }).select("_id").lean()
            || await Barang.findOne({ ...q, gudang: "" }).select("_id").lean();
        if (doc) q._id = doc._id;
        else delete q.gudang;
    }
    await Barang.findOneAndUpdate(
        q,
        { $inc: { stok: ing.quantity } }
    ).catch(err => {
        console.warn(`[Recipe] Gagal kembalikan stok ingredient ${ing.kode} (${ing.itemId}):`, err.message);
    });
}

/**
 * Terapkan konsumsi bahan untuk item F&B ber-recipe pada transaksi penjualan.
 *
 * VARIAN (M6.2-FIX v0.42): satu produk boleh punya beberapa recipe aktif.
 * Item transaksi membawa `recipeId` VARIAN yang dipilih kasir → konsumsi
 * memakai ingredient recipe varian tsb. Fallback backward-compat: item tanpa
 * recipeId (data lama) memakai recipe aktif pertama utk produk (by productId,
 * lalu by productKode).
 *
 * Idempotency: tiap (saleId, productId + recipeId) hanya dikonsumsi SEKALI —
 * dicek via RecipeConsumption + unique index DB. Produk tanpa recipe aktif →
 * dilewati (perilaku Retail existing tidak berubah).
 *
 * @param {object} opts
 * @param {string} opts.companyCode
 * @param {object} opts.sale Dokumen Penjualan yang baru dibuat
 * @param {Array} opts.items Item transaksi ({kode, qty, productId?, recipeId?})
 * @param {string} [opts.user]
 * @returns {Promise<Array>} Log konsumsi yang diterapkan
 */
export async function applyRecipeConsumption({ companyCode, sale, items, user }) {
    const applied = [];
    if (!sale || !Array.isArray(items) || !items.length) return applied;
    for (const item of items) {
        const qty = Number(item.qty) || 0;
        if (qty <= 0) continue;
        // M6.2-FIX — model SIMPLE (behavior "recipe") TIDAK dikonsumsi realtime:
        // penyesuaian stok dilakukan manual via stok opname. Hanya produk
        // tipe terhubung (recipe-fnb) / ber-recipe yang dikonsumsi saat terjual.
        if (item.productId) {
            try {
                const prod = await Barang.findOne({ _id: item.productId, companyCode }).select("behavior").lean();
                if (prod && prod.behavior === "recipe") continue;
            } catch { /* best effort — tetap diproses (backward compat) */ }
        }
        let recipe = null;
        // VARIAN: item membawa recipeId varian yang dipilih kasir → pakai itu.
        if (item.recipeId) {
            try {
                recipe = await Recipe.findOne({ _id: item.recipeId, companyCode, status: "active" }).lean();
            } catch { /* invalid id — fallback */ }
        }
        if (!recipe && item.productId) recipe = await getActiveRecipeByProduct(item.productId, companyCode);
        if (!recipe && item.kode) {
            recipe = await Recipe.findOne({ companyCode, productKode: item.kode, status: "active" }).lean();
        }
        if (!recipe) continue; // produk tanpa recipe → tetap retail seperti sekarang
        const consumption = calculateRecipeConsumption(recipe, qty);
        if (!consumption.length) continue;
        // Idempotency guard (plus unique index { saleId, productId, recipeId })
        const existing = await RecipeConsumption.findOne({
            saleId: String(sale._id),
            productId: recipe.productId,
            recipeId: String(recipe._id)
        }).lean();
        if (existing) continue;
        for (const ing of consumption) {
            await reduceIngredientStock(companyCode, ing, sale);
        }
        try {
            const log = await RecipeConsumption.create({
                companyCode,
                saleId: String(sale._id),
                saleNomor: sale.nomor || "",
                productId: recipe.productId,
                productKode: recipe.productKode || item.kode || "",
                productNama: recipe.productNama || item.nama || "",
                recipeId: String(recipe._id),
                quantity: qty,
                ingredients: consumption,
                status: "applied",
                createdBy: user || "System"
            });
            applied.push(log);
        } catch (err) {
            // Unique index → konsumsi ganda tertolak.
            console.warn("[Recipe] Gagal catat konsumsi (mungkin duplikat):", err.message);
        }
    }
    return applied;
}

/**
 * Reversal konsumsi saat transaksi F&B di-void: kembalikan stok ingredient
 * dan tandai log konsumsi "reversed". Aman karena void hanya boleh dari
 * status "paid" (gate existing) — tidak bisa void dua kali.
 *
 * TODO (M6.3+): bila reversal diminta di luar jalur void (mis. retur parsial),
 * tambahkan guard transaksi agar stok tidak ganda dikembalikan.
 *
 * @returns {Promise<string[]>} id log yang di-reverse
 */
export async function revertRecipeConsumption({ companyCode, sale, user }) {
    const saleId = String((sale && sale._id) || "");
    const reverted = [];
    if (!saleId) return reverted;
    const records = await RecipeConsumption.find({ companyCode, saleId, status: "applied" }).lean();
    for (const rec of records) {
        for (const ing of rec.ingredients || []) {
            await increaseIngredientStock(companyCode, ing, sale);
        }
        await RecipeConsumption.updateOne(
            { _id: rec._id },
            { $set: { status: "reversed", reversedAt: new Date(), reversedBy: user || "System" } }
        );
        reverted.push(String(rec._id));
    }
    return reverted;
}

export default {
    roundQty,
    calculateRecipeConsumption,
    calculateRecipeCost,
    validateRecipeIngredients,
    validateRecipePayload,
    getNextRecipeVersion,
    listRecipes,
    getRecipeById,
    getActiveRecipeByProduct,
    createRecipe,
    updateRecipe,
    duplicateRecipe,
    deleteRecipe,
    activateRecipe,
    archiveRecipe,
    applyRecipeConsumption,
    revertRecipeConsumption
};
