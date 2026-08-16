import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M6.2 — F&B Recipe / BOM Engine.
 * Engine murni (consumption/cost/validation) + integrasi konsumsi dengan
 * mock model (idempotency & reversal) — tanpa database.
 */

// ── Mock model (di-mock sebelum service di-import) ──
const mocks = {
    Recipe: {
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
        deleteOne: vi.fn(),
        countDocuments: vi.fn(),
        find: vi.fn()
    },
    RecipeConsumption: {
        findOne: vi.fn(),
        create: vi.fn(),
        find: vi.fn(),
        updateOne: vi.fn()
    },
    Barang: {
        find: vi.fn(),
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn()
    }
};

vi.mock("../models/Recipe.js", () => ({ Recipe: mocks.Recipe }));
vi.mock("../models/RecipeConsumption.js", () => ({ RecipeConsumption: mocks.RecipeConsumption }));
vi.mock("../models/Barang.js", () => ({ Barang: mocks.Barang }));

const {
    calculateRecipeConsumption,
    calculateRecipeCost,
    validateRecipeIngredients,
    validateRecipePayload,
    createRecipe,
    updateRecipe,
    duplicateRecipe,
    deleteRecipe,
    applyRecipeConsumption,
    revertRecipeConsumption
} = await import("../services/recipe.js");

const NASI_GORENG_RECIPE = {
    _id: "r1",
    productId: "p-nasgor",
    productKode: "BRG-NG",
    productNama: "Nasi Goreng",
    name: "Nasi Goreng Spesial",
    version: 1,
    status: "active",
    ingredients: [
        { itemId: "i-telur", kode: "BRG-T", nama: "Telur", quantity: 2, unit: "pcs" },
        { itemId: "i-beras", kode: "BRG-B", nama: "Beras", quantity: 0.2, unit: "kg" }
    ]
};

beforeEach(() => {
    vi.clearAllMocks();
    // Default: Barang.findOne mengembalikan chainable .select().lean()
    mocks.Barang.findOne.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    }));
    // Default: Recipe / RecipeConsumption findOne → tidak ditemukan
    mocks.Recipe.findOne.mockImplementation(() => chainResolve(null));
    mocks.RecipeConsumption.findOne.mockImplementation(() => chainResolve(null));
});

/** Bungkus nilai agar mendukung .lean() (chainable seperti mongoose). */
function chainResolve(value) {
    return { lean: vi.fn().mockResolvedValue(value) };
}

/** Chainable .sort().select().lean() — untuk getNextRecipeVersion. */
function chainSortResolve(value) {
    const q = { lean: vi.fn().mockResolvedValue(value) };
    q.select = vi.fn().mockReturnValue(q);
    q.sort = vi.fn().mockReturnValue(q);
    return q;
}

/** Chainable .select().lean() — untuk cek behavior Barang (cek behavior). */
function chainSelectResolve(value) {
    const q = { lean: vi.fn().mockResolvedValue(value) };
    q.select = vi.fn().mockReturnValue(q);
    return q;
}

describe("calculateRecipeConsumption — engine konsumsi (M6.2)", () => {
    it("penjualan 3 porsi → 6 telur & 0.6 kg beras (2×3, 0.2×3)", () => {
        const out = calculateRecipeConsumption(NASI_GORENG_RECIPE, 3);
        expect(out).toHaveLength(2);
        const telur = out.find(i => i.itemId === "i-telur");
        const beras = out.find(i => i.itemId === "i-beras");
        expect(telur.quantity).toBe(6);
        expect(telur.unit).toBe("pcs");
        expect(beras.quantity).toBe(0.6);
        expect(beras.unit).toBe("kg");
    });

    it("multiplikasi quantity: 5 porsi → 10 telur, 1.0 kg beras", () => {
        const out = calculateRecipeConsumption(NASI_GORENG_RECIPE, 5);
        expect(out.find(i => i.itemId === "i-telur").quantity).toBe(10);
        expect(out.find(i => i.itemId === "i-beras").quantity).toBe(1);
    });

    it("quantity 0 / negatif → konsumsi kosong (tidak negatif)", () => {
        expect(calculateRecipeConsumption(NASI_GORENG_RECIPE, 0)).toEqual([]);
        expect(calculateRecipeConsumption(NASI_GORENG_RECIPE, -3)).toEqual([]);
        expect(calculateRecipeConsumption(NASI_GORENG_RECIPE, "x")).toEqual([]);
    });

    it("recipe tanpa ingredient / null → kosong", () => {
        expect(calculateRecipeConsumption(null, 3)).toEqual([]);
        expect(calculateRecipeConsumption({ ingredients: [] }, 3)).toEqual([]);
    });
});

describe("calculateRecipeCost — HPP (M6.2)", () => {
    const itemCosts = [
        { itemId: "i-telur", cost: 2500 },
        { itemId: "i-beras", cost: 12000 }
    ];

    it("totalCost = Σ qty × cost (2×2500 + 0.2×12000 = 7400)", () => {
        const cost = calculateRecipeCost(NASI_GORENG_RECIPE, itemCosts);
        expect(cost.recipeId).toBe("r1");
        expect(cost.totalCost).toBe(7400);
        expect(cost.costPerServing).toBe(7400);
        expect(cost.items).toHaveLength(2);
    });

    it("item tanpa cost (harga_beli tidak tersedia) → totalCost null (jangan mengarang)", () => {
        const cost = calculateRecipeCost(NASI_GORENG_RECIPE, [{ itemId: "i-telur", cost: 0 }]);
        expect(cost.totalCost).toBeNull();
        expect(cost.costPerServing).toBeNull();
    });
});

describe("validateRecipeIngredients — aturan ingredient (M6.2)", () => {
    const items = [
        { _id: "i-telur", kode: "BRG-T", nama: "Telur", satuan: "pcs" },
        { _id: "i-beras", kode: "BRG-B", nama: "Beras", satuan: "kg" }
    ];

    it("ingredient valid diterima & dinormalisasi (unit dari item bila kosong)", () => {
        const r = validateRecipeIngredients([
            { itemId: "i-telur", quantity: 2, unit: "pcs" },
            { itemId: "i-beras", quantity: 0.2 }
        ], items);
        expect(r.ok).toBe(true);
        expect(r.value[0]).toMatchObject({ itemId: "i-telur", quantity: 2, unit: "pcs" });
        expect(r.value[1]).toMatchObject({ itemId: "i-beras", quantity: 0.2, unit: "kg" });
    });

    it("ingredient duplikat ditolak", () => {
        const r = validateRecipeIngredients([
            { itemId: "i-telur", quantity: 2 },
            { itemId: "i-telur", quantity: 1 }
        ], items);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("duplikat");
    });

    it("quantity invalid (0 / negatif / bukan angka) ditolak", () => {
        for (const q of [0, -1, "abc"]) {
            const r = validateRecipeIngredients([{ itemId: "i-telur", quantity: q }], items);
            expect(r.ok).toBe(false);
            expect(r.error).toContain("> 0");
        }
    });

    it("item yang tidak ada ditolak (referensi harus Barang existing)", () => {
        const r = validateRecipeIngredients([{ itemId: "i-hantu", quantity: 1 }], items);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("tidak ditemukan");
    });

    it("tanpa ingredient / kosong ditolak (minimal 1)", () => {
        expect(validateRecipeIngredients([], items).ok).toBe(false);
        expect(validateRecipeIngredients(undefined, items).ok).toBe(false);
        expect(validateRecipeIngredients(null, items).ok).toBe(false);
    });

    it("unit tidak konsisten dengan satuan item ditolak", () => {
        const r = validateRecipeIngredients([{ itemId: "i-beras", quantity: 1, unit: "liter" }], items);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("konsisten");
    });
});

describe("validateRecipePayload — produk & nama (M6.2)", () => {
    const items = [
        { _id: "p-nasgor", kode: "BRG-NG", nama: "Nasi Goreng", satuan: "Porsi" },
        { _id: "i-telur", kode: "BRG-T", nama: "Telur", satuan: "pcs" }
    ];

    it("payload valid → ok + snapshot produk", () => {
        const r = validateRecipePayload({
            productId: "p-nasgor",
            name: "Nasi Goreng Spesial",
            ingredients: [{ itemId: "i-telur", quantity: 2, unit: "pcs" }]
        }, items);
        expect(r.ok).toBe(true);
        expect(r.value.productKode).toBe("BRG-NG");
        expect(r.value.productNama).toBe("Nasi Goreng");
    });

    it("produk tidak ada ditolak", () => {
        const r = validateRecipePayload({ productId: "p-hantu", name: "X", ingredients: [] }, items);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("tidak ditemukan");
    });

    it("nama recipe wajib diisi", () => {
        const r = validateRecipePayload({ productId: "p-nasgor", name: "", ingredients: [{ itemId: "i-telur", quantity: 1 }] }, items);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("Nama recipe");
    });

    it("M6.2-FIX — produk model SIMPLE (behavior recipe) ditolak sbg produk Recipe F&B", () => {
        const simpleItems = [
            { _id: "p-simple", kode: "BRG-S", nama: "Kopi Susu Simple", satuan: "Gelas", behavior: "recipe" },
            { _id: "i-telur", kode: "BRG-T", nama: "Telur", satuan: "pcs" }
        ];
        const r = validateRecipePayload({
            productId: "p-simple",
            name: "Kopi Susu",
            ingredients: [{ itemId: "i-telur", quantity: 1, unit: "pcs" }]
        }, simpleItems);
        expect(r.ok).toBe(false);
        expect(r.error).toContain("Recipe F&B");
        expect(r.error).toContain("Terhubung");
    });

    it("produk TERHUBUNG (behavior recipe-fnb) diterima sbg produk Recipe F&B", () => {
        const linkedItems = [
            { _id: "p-fnb", kode: "BRG-F", nama: "Nasi Goreng F&B", satuan: "Porsi", behavior: "recipe-fnb" },
            { _id: "i-telur", kode: "BRG-T", nama: "Telur", satuan: "pcs" }
        ];
        const r = validateRecipePayload({
            productId: "p-fnb",
            name: "Nasi Goreng Spesial",
            ingredients: [{ itemId: "i-telur", quantity: 2, unit: "pcs" }]
        }, linkedItems);
        expect(r.ok).toBe(true);
    });
});

describe("createRecipe / updateRecipe / duplicateRecipe / deleteRecipe — lifecycle varian (M6.2-FIX v0.42)", () => {
    const payload = {
        productId: "p-nasgor",
        productKode: "BRG-NG",
        productNama: "Nasi Goreng",
        name: "Nasi Goreng Spesial",
        description: "",
        harga: 25000,
        ingredients: [{ itemId: "i-telur", quantity: 2, unit: "pcs" }]
    };

    it("createRecipe → langsung status active (varian baru, TANPA archive active lain)", async () => {
        mocks.Recipe.findOne.mockImplementationOnce(() => chainSortResolve({ version: 1 }));
        mocks.Recipe.create.mockImplementation(async (doc) => ({ ...doc, _id: "r-new" }));
        const r = await createRecipe({ companyCode: "PT-001", payload, user: "admin" });
        expect(r.status).toBe("active");
        expect(r.version).toBe(2);
        expect(r.harga).toBe(25000);
        // v0.42 — produk boleh punya BANYAK varian aktif; TIDAK archive active lain
        expect(mocks.Recipe.updateMany).not.toHaveBeenCalled();
    });

    it("updateRecipe → edit di tempat, status tetap active, harga ikut tersimpan, TANPA archive active lain", async () => {
        const existing = {
            ...NASI_GORENG_RECIPE,
            status: "active",
            save: vi.fn().mockResolvedValue(true)
        };
        mocks.Recipe.findOne.mockImplementationOnce(() => Promise.resolve(existing));
        const updated = await updateRecipe({ id: "r1", companyCode: "PT-001", payload: { ...payload, name: "Nasi Goreng Premium", harga: 27000 }, user: "admin" });
        expect(updated._id).toBe("r1");
        expect(updated.name).toBe("Nasi Goreng Premium");
        expect(updated.harga).toBe(27000);
        expect(updated.status).toBe("active");
        expect(existing.save).toHaveBeenCalledTimes(1);
        // TIDAK ada Recipe.create / updateMany (varian, bukan archive)
        expect(mocks.Recipe.create).not.toHaveBeenCalled();
        expect(mocks.Recipe.updateMany).not.toHaveBeenCalled();
    });

    it("updateRecipe → edit archived juga TIDAK archive active lain (varian tetap banyak)", async () => {
        const existing = {
            ...NASI_GORENG_RECIPE,
            status: "archived",
            save: vi.fn().mockResolvedValue(true)
        };
        mocks.Recipe.findOne.mockImplementationOnce(() => Promise.resolve(existing));
        const updated = await updateRecipe({ id: "r1", companyCode: "PT-001", payload: { ...payload, name: "Nasi Goreng Premium" }, user: "admin" });
        expect(updated.status).toBe("active");
        expect(mocks.Recipe.updateMany).not.toHaveBeenCalled();
    });

    it("duplicateRecipe → salinan varian baru langsung aktif, TANPA archive active lain, harga ikut disalin", async () => {
        const source = { ...NASI_GORENG_RECIPE, harga: 26000 };
        // source (di-await langsung tanpa .lean()) + next version (chain .sort().select().lean())
        mocks.Recipe.findOne.mockImplementationOnce(() => Promise.resolve(source));
        mocks.Recipe.findOne.mockImplementationOnce(() => chainSortResolve({ version: 1 }));
        mocks.Recipe.create.mockImplementation(async (doc) => ({ ...doc, _id: "r-copy" }));
        const dup = await duplicateRecipe({ id: "r1", companyCode: "PT-001", user: "admin" });
        expect(dup._id).toBe("r-copy");
        expect(dup.status).toBe("active");
        expect(dup.name).toBe("Nasi Goreng Spesial (copy)");
        expect(dup.harga).toBe(26000);
        expect(dup.version).toBe(2);
        expect(mocks.Recipe.updateMany).not.toHaveBeenCalled();
    });

    it("deleteRecipe → hapus permanen (deleteOne, bukan archive)", async () => {
        mocks.Recipe.deleteOne.mockResolvedValue({ deletedCount: 1 });
        const ok = await deleteRecipe({ id: "r1", companyCode: "PT-001" });
        expect(ok).toBe(true);
        expect(mocks.Recipe.deleteOne).toHaveBeenCalledWith({ _id: "r1", companyCode: "PT-001" });
    });

    it("deleteRecipe → recipe tidak ditemukan → false", async () => {
        mocks.Recipe.deleteOne.mockResolvedValue({ deletedCount: 0 });
        expect(await deleteRecipe({ id: "r1", companyCode: "PT-001" })).toBe(false);
    });
});

describe("applyRecipeConsumption — integrasi konsumsi (M6.2)", () => {
    const sale = { _id: "sale-001", nomor: "13082026-0001", gudang: "Gudang Utama" };
    const items = [
        { kode: "BRG-NG", nama: "Nasi Goreng", qty: 3, productId: "p-nasgor" },
        { kode: "BRG-AIR", nama: "Air Mineral", qty: 1, productId: "p-air" }
    ];

    it("produk ber-recipe aktif → konsumsi diterapkan + log dibuat", async () => {
        mocks.Recipe.findOne.mockImplementationOnce(() => chainResolve(NASI_GORENG_RECIPE)); // by productId
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        mocks.RecipeConsumption.create.mockImplementation(async (doc) => ({ ...doc, _id: "c1" }));

        const applied = await applyRecipeConsumption({ companyCode: "PT-001", sale, items, user: "admin" });

        // Hanya produk ber-recipe yang dikonsumsi (air mineral tanpa recipe dilewati)
        expect(applied).toHaveLength(1);
        expect(mocks.RecipeConsumption.create).toHaveBeenCalledTimes(1);
        const logDoc = mocks.RecipeConsumption.create.mock.calls[0][0];
        expect(logDoc.saleId).toBe("sale-001");
        expect(logDoc.productId).toBe("p-nasgor");
        // 2 × 3 dan 0.2 × 3
        expect(logDoc.ingredients.find(i => i.itemId === "i-telur").quantity).toBe(6);
        expect(logDoc.ingredients.find(i => i.itemId === "i-beras").quantity).toBe(0.6);
        // stok ingredient dikurangi 2 kali (2 ingredient)
        expect(mocks.Barang.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it("produk tanpa recipe aktif → TIDAK ada konsumsi (Retail tidak berubah)", async () => {
        const applied = await applyRecipeConsumption({ companyCode: "PT-001", sale, items, user: "admin" });
        expect(applied).toHaveLength(0);
        expect(mocks.RecipeConsumption.create).not.toHaveBeenCalled();
        expect(mocks.Barang.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("idempotency: log konsumsi sudah ada utk sale+product → dilewati (tidak 2×)", async () => {
        mocks.Recipe.findOne.mockImplementationOnce(() => chainResolve(NASI_GORENG_RECIPE));
        mocks.RecipeConsumption.findOne.mockImplementationOnce(() => chainResolve({ _id: "c-lama", status: "applied" }));
        const applied = await applyRecipeConsumption({ companyCode: "PT-001", sale, items, user: "admin" });
        expect(applied).toHaveLength(0);
        expect(mocks.Barang.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("M6.2-FIX — produk model SIMPLE (behavior recipe) TIDAK dikonsumsi realtime", async () => {
        // Barang.findOne (cek behavior) → behavior "recipe" (model simple)
        mocks.Barang.findOne.mockImplementationOnce(() => chainResolve({ _id: "p-nasgor", behavior: "recipe" }));
        const applied = await applyRecipeConsumption({ companyCode: "PT-001", sale, items, user: "admin" });
        // Produk simple dilewati walau punya recipe aktif — penyesuaian stok via opname
        expect(applied).toHaveLength(0);
        expect(mocks.RecipeConsumption.create).not.toHaveBeenCalled();
        expect(mocks.Barang.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("produk TERHUBUNG (behavior recipe-fnb) → konsumsi realtime tetap jalan", async () => {
        // Barang.findOne (cek behavior) → behavior "recipe-fnb" (terhubung F&B)
        mocks.Barang.findOne.mockImplementationOnce(() => chainResolve({ _id: "p-nasgor", behavior: "recipe-fnb" }));
        mocks.Recipe.findOne.mockImplementationOnce(() => chainResolve(NASI_GORENG_RECIPE));
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        mocks.RecipeConsumption.create.mockImplementation(async (doc) => ({ ...doc, _id: "c1" }));

        const applied = await applyRecipeConsumption({ companyCode: "PT-001", sale, items, user: "admin" });
        expect(applied).toHaveLength(1);
        expect(mocks.RecipeConsumption.create).toHaveBeenCalledTimes(1);
    });

    it("M6.2-FIX v0.42 — item membawa recipeId VARIAN → konsumsi memakai ingredient varian itu", async () => {
        const variantRecipe = {
            _id: "r-varian-pake-gula",
            productId: "p-nasgor",
            productKode: "BRG-NG",
            productNama: "Nasi Goreng",
            name: "Pake Gula",
            version: 2,
            status: "active",
            ingredients: [
                { itemId: "i-telur", kode: "BRG-T", nama: "Telur", quantity: 3, unit: "pcs" },
                { itemId: "i-gula", kode: "BRG-G", nama: "Gula", quantity: 1, unit: "sdm" }
            ]
        };
        // Barang.findOne (cek behavior) → recipe-fnb; Recipe.findOne by recipeId → varian
        mocks.Barang.findOne.mockImplementationOnce(() => chainResolve({ _id: "p-nasgor", behavior: "recipe-fnb" }));
        mocks.Recipe.findOne.mockImplementationOnce(() => chainResolve(variantRecipe));
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        mocks.RecipeConsumption.create.mockImplementation(async (doc) => ({ ...doc, _id: "c-var" }));

        const applied = await applyRecipeConsumption({
            companyCode: "PT-001",
            sale,
            items: [{ kode: "BRG-NG", nama: "Nasi Goreng (Pake Gula)", qty: 2, productId: "p-nasgor", recipeId: "r-varian-pake-gula" }],
            user: "kasir"
        });
        expect(applied).toHaveLength(1);
        const logDoc = mocks.RecipeConsumption.create.mock.calls[0][0];
        expect(logDoc.recipeId).toBe("r-varian-pake-gula");
        // ingredient varian: 3 × 2 = 6 telur + 1 × 2 = 2 gula
        expect(logDoc.ingredients.find(i => i.itemId === "i-telur").quantity).toBe(6);
        expect(logDoc.ingredients.find(i => i.itemId === "i-gula").quantity).toBe(2);
    });

    it("M6.2-FIX v0.42 — 2 varian berbeda dalam 1 transaksi: keduanya dikonsumsi (unique per recipeId)", async () => {
        const vGula = {
            _id: "r-gula", productId: "p-nasgor", productKode: "BRG-NG", productNama: "Nasi Goreng",
            name: "Pake Gula", version: 2, status: "active",
            ingredients: [{ itemId: "i-gula", kode: "BRG-G", nama: "Gula", quantity: 1, unit: "sdm" }]
        };
        const vTanpa = {
            _id: "r-tanpa", productId: "p-nasgor", productKode: "BRG-NG", productNama: "Nasi Goreng",
            name: "Tanpa Gula", version: 1, status: "active",
            ingredients: [{ itemId: "i-garam", kode: "BRG-GRM", nama: "Garam", quantity: 0.5, unit: "sdm" }]
        };
        // Barang.findOne per item (2×) → recipe-fnb (chainable .select().lean());
        // Recipe.findOne by recipeId (2×) → varian masing-masing.
        mocks.Barang.findOne.mockImplementationOnce(() => chainSelectResolve({ _id: "p-nasgor", behavior: "recipe-fnb" }));
        mocks.Barang.findOne.mockImplementationOnce(() => chainSelectResolve({ _id: "p-nasgor", behavior: "recipe-fnb" }));
        mocks.Recipe.findOne.mockImplementationOnce(() => chainResolve(vGula));
        mocks.Recipe.findOne.mockImplementationOnce(() => chainResolve(vTanpa));
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        mocks.RecipeConsumption.create.mockImplementation(async (doc) => ({ ...doc, _id: "c-var" }));

        const applied = await applyRecipeConsumption({
            companyCode: "PT-001",
            sale,
            items: [
                { kode: "BRG-NG", nama: "Nasi Goreng (Pake Gula)", qty: 1, productId: "p-nasgor", recipeId: "r-gula" },
                { kode: "BRG-NG", nama: "Nasi Goreng (Tanpa Gula)", qty: 1, productId: "p-nasgor", recipeId: "r-tanpa" }
            ],
            user: "kasir"
        });
        expect(applied).toHaveLength(2);
        expect(mocks.RecipeConsumption.create).toHaveBeenCalledTimes(2);
        const recipeIds = mocks.RecipeConsumption.create.mock.calls.map(c => c[0].recipeId);
        expect(recipeIds).toContain("r-gula");
        expect(recipeIds).toContain("r-tanpa");
    });
});

describe("revertRecipeConsumption — reversal void (M6.2)", () => {
    it("log applied → stok ingredient dikembalikan + status reversed", async () => {
        const sale = { _id: "sale-001", gudang: "Gudang Utama" };
        mocks.RecipeConsumption.find.mockImplementationOnce(() => chainResolve([
            {
                _id: "c1",
                companyCode: "PT-001",
                saleId: "sale-001",
                ingredients: [
                    { itemId: "i-telur", quantity: 6, unit: "pcs" },
                    { itemId: "i-beras", quantity: 0.6, unit: "kg" }
                ]
            }
        ]));
        mocks.Barang.findOneAndUpdate.mockResolvedValue({});
        mocks.RecipeConsumption.updateOne.mockResolvedValue({});

        const reverted = await revertRecipeConsumption({ companyCode: "PT-001", sale, user: "admin" });
        expect(reverted).toEqual(["c1"]);
        expect(mocks.Barang.findOneAndUpdate).toHaveBeenCalledTimes(2);
        expect(mocks.RecipeConsumption.updateOne).toHaveBeenCalledWith(
            { _id: "c1" },
            expect.objectContaining({ $set: expect.objectContaining({ status: "reversed" }) })
        );
    });

    it("tanpa log applied → tidak ada reversal", async () => {
        mocks.RecipeConsumption.find.mockImplementationOnce(() => chainResolve([]));
        const reverted = await revertRecipeConsumption({ companyCode: "PT-001", sale: { _id: "sale-x" }, user: "admin" });
        expect(reverted).toEqual([]);
        expect(mocks.Barang.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
