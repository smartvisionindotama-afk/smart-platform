/**
 * Recipes Route — F&B Recipe / BOM CRUD (M6.2).
 *
 * GET  /            — list recipe (company-scoped, filter status/product/search)
 * GET  /:id         — detail recipe
 * GET  /:id/cost    — perhitungan cost/HPP recipe
 * POST /            — create recipe (LANGSUNG aktif) — permission pos.recipe.manage
 * PUT  /:id         — update recipe in-place (langsung aktif, tanpa versi baru)
 * POST /:id/duplicate — salin recipe baru (langsung aktif)
 * DELETE /:id       — hapus recipe permanen
 * POST /:id/activate — aktifkan recipe (archive active lain utk produk sama)
 * POST /:id/archive  — archive recipe (soft, tanpa delete permanen)
 *
 * Gate:
 *   - requireTransactionType("fnb") — Recipe/BOM TIDAK boleh dipakai bila
 *     capability F&B nonaktif (enforcement backend).
 *   - permission pos.recipe.manage — Admin/Owner (kasir TIDAK diberi).
 *
 * @module server/routes/recipes
 */

import { Router } from "express";
import mongoose from "mongoose";
import { Barang } from "../models/Barang.js";
import { security } from "../security.js";
import { requireTransactionType } from "../services/transaction-capability.js";
import {
    validateRecipePayload,
    listRecipes,
    getRecipeById,
    createRecipe,
    updateRecipe,
    duplicateRecipe,
    deleteRecipe,
    activateRecipe,
    archiveRecipe,
    calculateRecipeCost
} from "../services/recipe.js";

const router = Router();

/** Gate F&B capability utk SEMUA endpoint recipe (Recipe/BOM ≠ POS Retail). */
router.use(requireTransactionType("fnb"));

/** Resolve Barang (produk + ingredient) company-scoped dari id yang diminta. */
async function resolveItems(companyCode, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    return Barang.find({ companyCode, _id: { $in: unique } }).lean();
}

function parsePagination(req) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    return { page, limit };
}

/** GET / — list recipe. */
router.get("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const { page, limit } = parsePagination(req);
        const result = await listRecipes({
            companyCode,
            status: req.query.status || "",
            productId: req.query.productId || "",
            search: req.query.search || "",
            page,
            limit
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /:id — detail recipe. */
router.get("/:id", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const recipe = await getRecipeById(req.params.id, companyCode);
        if (!recipe) return res.status(404).json({ error: "Not found" });
        res.json(recipe);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** GET /:id/cost — perhitungan cost/HPP (harga_beli item existing). */
router.get("/:id/cost", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const recipe = await getRecipeById(req.params.id, companyCode);
        if (!recipe) return res.status(404).json({ error: "Not found" });
        const itemIds = (recipe.ingredients || []).map(i => i.itemId);
        const items = itemIds.length
            ? await Barang.find({ companyCode, _id: { $in: itemIds } }).select("_id harga_beli").lean()
            : [];
        const cost = calculateRecipeCost(recipe, items.map(i => ({ itemId: String(i._id), cost: i.harga_beli })));
        res.json(cost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST / — create recipe (draft). */
router.post("/", security.permission("pos.recipe.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });

        const data = req.body || {};
        const ids = [data.productId, ...((data.ingredients || []).map(i => i && i.itemId))];
        const items = await resolveItems(companyCode, ids);
        const check = validateRecipePayload(data, items);
        if (!check.ok) return res.status(400).json({ error: check.error });

        const recipe = await createRecipe({
            companyCode,
            payload: check.value,
            user: req.headers["x-user-name"] || "System"
        });
        res.status(201).json(recipe);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** PUT /:id — update recipe in-place (langsung aktif, tanpa versi baru). */
router.put("/:id", security.permission("pos.recipe.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const data = req.body || {};
        const ids = [data.productId, ...((data.ingredients || []).map(i => i && i.itemId))];
        const items = await resolveItems(companyCode, ids);
        const check = validateRecipePayload(data, items);
        if (!check.ok) return res.status(400).json({ error: check.error });

        const updated = await updateRecipe({
            id: req.params.id,
            companyCode,
            payload: check.value,
            user: req.headers["x-user-name"] || "System"
        });
        if (!updated) return res.status(404).json({ error: "Not found" });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** POST /:id/duplicate — salin recipe baru (langsung aktif). */
router.post("/:id/duplicate", security.permission("pos.recipe.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const recipe = await duplicateRecipe({
            id: req.params.id,
            companyCode,
            user: req.headers["x-user-name"] || "System"
        });
        if (!recipe) return res.status(404).json({ error: "Not found" });
        res.status(201).json(recipe);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/** DELETE /:id — hapus recipe permanen. */
router.delete("/:id", security.permission("pos.recipe.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const deleted = await deleteRecipe({ id: req.params.id, companyCode });
        if (!deleted) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /:id/activate — aktifkan recipe (archive active lain utk produk sama). */
router.post("/:id/activate", security.permission("pos.recipe.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const recipe = await activateRecipe({
            id: req.params.id,
            companyCode,
            user: req.headers["x-user-name"] || "System"
        });
        if (!recipe) return res.status(404).json({ error: "Not found" });
        res.json(recipe);
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

/** POST /:id/archive — archive recipe (soft). */
router.post("/:id/archive", security.permission("pos.recipe.manage"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID recipe tidak valid" });
        }
        const recipe = await archiveRecipe({
            id: req.params.id,
            companyCode,
            user: req.headers["x-user-name"] || "System"
        });
        if (!recipe) return res.status(404).json({ error: "Not found" });
        res.json(recipe);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
