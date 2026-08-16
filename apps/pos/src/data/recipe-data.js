/**
 * Recipe Data Services — F&B Recipe / BOM (M6.2).
 *
 * API-first (GET/POST/PUT /api/recipes). Endpoint recipe dilindungi gate
 * capability F&B + permission pos.recipe.manage di server; error diteruskan
 * ke UI (bukan fallback diam-diam) agar state error tampil.
 *
 * @module pos/data/recipe
 */

import { apiCall } from "./api.js";

/**
 * List recipe (company-scoped).
 * @param {object} [params] { page, limit, status, productId, search }
 * @returns {Promise<{data: Array, pagination: object}>}
 */
export async function listRecipes(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    const q = qs.toString();
    const res = await apiCall("GET", `/recipes${q ? `?${q}` : ""}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Detail recipe. */
export async function getRecipe(id) {
    const res = await apiCall("GET", `/recipes/${id}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Cost / HPP recipe (harga_beli item existing; null bila cost tidak tersedia). */
export async function getRecipeCost(id) {
    const res = await apiCall("GET", `/recipes/${id}/cost`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Create recipe (draft). */
export async function createRecipe(data) {
    const res = await apiCall("POST", "/recipes", data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Update recipe (in-place, langsung aktif — tanpa versi draft baru). */
export async function updateRecipe(id, data) {
    const res = await apiCall("PUT", `/recipes/${id}`, data);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Duplikat recipe — salinan baru langsung aktif. */
export async function duplicateRecipe(id) {
    const res = await apiCall("POST", `/recipes/${id}/duplicate`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Hapus recipe permanen. */
export async function deleteRecipe(id) {
    const res = await apiCall("DELETE", `/recipes/${id}`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Aktifkan recipe (archive active lain untuk produk sama). */
export async function activateRecipe(id) {
    const res = await apiCall("POST", `/recipes/${id}/activate`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

/** Archive recipe (soft). */
export async function archiveRecipe(id) {
    const res = await apiCall("POST", `/recipes/${id}/archive`);
    if (res !== null) return res;
    throw new Error("Server tidak tersedia");
}

export default {
    listRecipes,
    getRecipe,
    getRecipeCost,
    createRecipe,
    updateRecipe,
    duplicateRecipe,
    deleteRecipe,
    activateRecipe,
    archiveRecipe
};
