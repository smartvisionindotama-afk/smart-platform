/**
 * ReturPenjualan Route — Sales Return CRUD.
 *
 * GET    /             — List with search, pagination, company scoping
 * GET    /:id          — Get single retur
 * POST   /             — Create retur with auto-generated nomor
 * PUT    /:id          — Update retur (only if status = draft)
 * DELETE /:id          — Delete retur (reversal stok jika status = returned)
 * PATCH  /:id/status   — Update status (draft → returned)
 *
 * Stock: bertambah saat retur dikonfirmasi (barang kembali dari pelanggan),
 *        reversal berkurang saat retur dihapus.
 *
 * @module server/routes/retur-penjualan
 */

import { Router } from "express";
import { ReturPenjualan } from "../models/ReturPenjualan.js";
import { Penjualan } from "../models/Penjualan.js";
import { Barang } from "../models/Barang.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { formatError } from "../utils/format-error.js";
import { splitPosItemsByBehavior } from "../services/pos-transaction.js";

const router = Router();

/** Helper: check company ownership */
function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true;
    return item.companyCode === companyCode;
}

/**
 * Ambil peta behavior Barang untuk item retur (untuk stok behavior-aware).
 * @returns {Promise<object[]>} Daftar Barang ({ kode, behavior })
 */
async function fetchBehaviorBarangs(companyCode, items = []) {
    const kodes = items.map(i => i.kode).filter(Boolean);
    if (!kodes.length) return [];
    try {
        return await Barang.find({ companyCode, kode: { $in: kodes } }).select("kode behavior").lean();
    } catch (err) {
        console.warn(`[ReturPenjualan] fetchBehaviorBarangs failed (${kodes.length} kode):`, err.message);
        return [];
    }
}

/**
 * Validasi item retur terhadap transaksi penjualan asal (SO maupun transaksi
 * kasir KWT):
 *   - transaksi asal harus ada & bukan `void` (dan bukan `order` saat create);
 *   - qty retur per item tidak boleh melebihi **sisa qty** = qty transaksi asal
 *     dikurangi total qty retur lain yang sudah ada untuk transaksi yang sama
 *     (kumulatif — mencegah stok menggelembung akibat retur ganda);
 *   - company scoping.
 *
 * @param {string|null} companyCode Dari header x-company-code
 * @param {string} idSO Referensi transaksi asal (kosong = mode manual, tanpa validasi)
 * @param {object[]} items Item retur ({ kode, qty })
 * @param {object} [opts]
 * @param {boolean} [opts.checkStatus=true] — true saat create (POST); false saat edit
 *        (PUT) agar retur yang transaksi asalnya berubah status tetap bisa diedit.
 * @param {string|null} [opts.excludeReturId=null] — id retur yang sedang diedit,
 *        dikecualikan dari akumulasi qty (tidak menghitung dirinya sendiri).
 * @returns {Promise<{ error: string|null, so: object|null }>}
 */
async function validateItemsAgainstSo(companyCode, idSO, items, opts = {}) {
    const { checkStatus = true, excludeReturId = null } = opts;
    // Mode manual (tanpa referensi): idSO kosong → lewati validasi qty asal
    if (!idSO) return { error: null, so: null };
    let so = null;
    try { so = await Penjualan.findById(idSO); } catch { so = null; }
    if (!so) return { error: "Transaksi asal tidak ditemukan", so: null };
    if (so.status === "void") {
        return { error: "Transaksi asal sudah di-void — tidak bisa diretur", so };
    }
    if (checkStatus && so.status === "order") {
        return { error: "Transaksi asal masih berstatus Order — tidak bisa diretur", so };
    }
    if (companyCode && so.companyCode !== companyCode) {
        return { error: "Transaksi asal tidak valid untuk perusahaan ini", so };
    }

    // Akumulasi qty retur lain untuk transaksi asal yang sama (draft + returned)
    // — kunci anti retur ganda: total retur per item tidak boleh melebihi qty asal.
    let existingReturs = [];
    try {
        existingReturs = await ReturPenjualan.find({
            idSO,
            status: { $in: ["draft", "returned"] },
            ...(excludeReturId ? { _id: { $ne: excludeReturId } } : {})
        }).lean();
    } catch { existingReturs = []; }

    for (const item of items) {
        const soItem = (so.items || []).find(i => i.kode === item.kode);
        if (!soItem) return { error: `Item ${item.kode || item.nama} tidak ditemukan di transaksi asal`, so };
        const returnedQty = existingReturs.reduce((sum, r) => {
            const line = (r.items || []).find(i => i.kode === item.kode);
            return sum + (line ? Number(line.qty) || 0 : 0);
        }, 0);
        const sisa = Math.max(0, soItem.qty - returnedQty);
        if (item.qty > sisa) {
            return {
                error: `Qty retur ${item.kode || item.nama} (${item.qty}) melebihi sisa qty transaksi asal (${sisa} dari ${soItem.qty} — ${returnedQty} sudah diretur)`,
                so
            };
        }
    }
    return { error: null, so };
}

/**
 * GET / — List sales returns.
 */
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();
        const companyCode = req.headers["x-company-code"];

        const query = {};
        if (companyCode) query.companyCode = companyCode;
        // STRICT (SP-029 M6-FIX): server POS hanya menampilkan retur transaksi
        // kasir (sumber="pos"). Retur SO/admin tidak tampil di POS.
        query.sumber = "pos";
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { nomorSO: { $regex: search, $options: "i" } },
                { pelanggan: { $regex: search, $options: "i" } },
                { pelangganNama: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const total = await ReturPenjualan.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await ReturPenjualan.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single sales return.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await ReturPenjualan.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        // STRICT: detail hanya untuk retur domain POS (kasir).
        if (item.sumber !== "pos") return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create sales return.
 * Body: { tanggal, nomorSO, idSO, pelanggan, pelangganNama, items, catatan }
 */
router.post("/", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) {
            return res.status(400).json({ error: "Company code required" });
        }

        const { tanggal, nomorSO, idSO, pelanggan, pelangganNama, items, catatan } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
        }

        // Validate & calculate items
        const validatedItems = items.map(item => {
            const qty = Number(item.qty) || 0;
            const harga = Number(item.harga) || 0;
            return {
                kode: item.kode || "",
                nama: item.nama || "",
                satuan: item.satuan || "",
                qty,
                harga,
                subtotal: Math.max(0, qty * harga)
            };
        });
        if (validatedItems.some(i => i.qty <= 0)) {
            return res.status(400).json({ error: "Qty setiap item harus lebih dari 0" });
        }

        // Validasi qty retur terhadap transaksi asal (kumulatif + blokir void)
        const { error: soError, so: asal } = await validateItemsAgainstSo(companyCode, idSO, validatedItems);
        if (soError) {
            return res.status(400).json({ error: soError });
        }

        const total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const nomor = await ReturPenjualan.generateNomor(companyCode);

        // PRD V1 §7.8 — sumber transaksi asal ("so" / "pos") untuk pelaporan;
        // asal sudah diambil saat validasi (tanpa query tambahan)
        let sumber = "so";
        if (asal) sumber = asal.sumber === "pos" ? "pos" : "so";

        const retur = await ReturPenjualan.create({
            companyCode,
            nomor,
            tanggal: tanggal || new Date(),
            nomorSO: nomorSO || "",
            idSO: idSO || "",
            sumber,
            pelanggan: pelanggan || "",
            pelangganNama: pelangganNama || "",
            items: validatedItems,
            total,
            catatan: catatan || "",
            status: "draft",
            createdBy: req.headers["x-user-name"] || "System"
        });

        // Log activity
        try {
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "create",
                resource: "retur-penjualan",
                resourceId: retur._id.toString(),
                resourceName: `${pelangganNama || pelanggan} - ${nomor}`,
                resourceCode: nomor,
                details: `${validatedItems.length} item, total: ${retur.total}`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPenjualan] Failed to log activity:", logErr.message);
        }

        res.status(201).json(retur);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "ReturPenjualan") });
    }
});

/**
 * PUT /:id — Update sales return (only if status = draft).
 */
router.put("/:id", async (req, res) => {
    try {
        const existing = await ReturPenjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "draft") {
            return res.status(400).json({ error: "Hanya retur dengan status Draft yang bisa diedit" });
        }

        const { tanggal, nomorSO, idSO, pelanggan, pelangganNama, items, catatan } = req.body;

        const updateData = {};
        if (tanggal !== undefined) updateData.tanggal = tanggal;
        if (nomorSO !== undefined) updateData.nomorSO = nomorSO;
        if (idSO !== undefined) updateData.idSO = idSO;
        if (pelanggan !== undefined) updateData.pelanggan = pelanggan;
        if (pelangganNama !== undefined) updateData.pelangganNama = pelangganNama;
        if (catatan !== undefined) updateData.catatan = catatan;
        updateData.updatedBy = req.headers["x-user-name"] || "System";

        if (items !== undefined) {
            if (!items || items.length === 0) {
                return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
            }
            const validatedItems = items.map(item => {
                const qty = Number(item.qty) || 0;
                const harga = Number(item.harga) || 0;
                return {
                    kode: item.kode || "",
                    nama: item.nama || "",
                    satuan: item.satuan || "",
                    qty,
                    harga,
                    subtotal: Math.max(0, qty * harga)
                };
            });
            if (validatedItems.some(i => i.qty <= 0)) {
                return res.status(400).json({ error: "Qty setiap item harus lebih dari 0" });
            }
            const { error: soError } = await validateItemsAgainstSo(
                req.headers["x-company-code"],
                idSO !== undefined ? idSO : existing.idSO,
                validatedItems,
                {
                    checkStatus: false, // edit mode: jangan blokir jika status SO berubah setelah retur dibuat
                    excludeReturId: existing._id.toString()
                }
            );
            if (soError) {
                return res.status(400).json({ error: soError });
            }
            updateData.items = validatedItems;
            updateData.total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        }

        const updated = await ReturPenjualan.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "retur-penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${pelangganNama || existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Update retur ${existing.nomor}`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPenjualan] Failed to log activity:", logErr.message);
        }

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "ReturPenjualan") });
    }
});

/**
 * DELETE /:id — Delete sales return (all statuses).
 * Reverses stock if retur has status "returned" (stok dikurangi kembali).
 */
router.delete("/:id", async (req, res) => {
    try {
        const existing = await ReturPenjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        // Persist dulu, lalu reversal stok — jika delete gagal, tidak ada
        // perubahan stok (hindari stok berubah padahal retur masih ada).
        await ReturPenjualan.findByIdAndDelete(req.params.id);

        // If retur was returned (stock already increased), reverse it —
        // hanya item trading yang pernah menambah stok yang dikurangi kembali.
        if (existing.status === "returned") {
            const barangs = await fetchBehaviorBarangs(existing.companyCode, existing.items);
            const { trading } = splitPosItemsByBehavior(existing.items, barangs);
            for (const item of trading) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: -item.qty } }
                ).catch(err => {
                    console.warn(`[ReturPenjualan] Failed to reverse stock for ${item.kode}:`, err.message);
                });
            }
        }

        // Log activity after delete
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "delete",
                resource: "retur-penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Hapus retur ${existing.nomor} (${existing.status})`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPenjualan] Failed to log activity:", logErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /:id/status — Update retur status.
 * Body: { status: "returned" }
 *
 * When status = "returned", tambah stok barang otomatis (barang kembali dari pelanggan).
 */
router.patch("/:id/status", async (req, res) => {
    try {
        const existing = await ReturPenjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const newStatus = req.body.status;
        const validTransitions = {
            "draft": ["returned"],
            "returned": []
        };

        const allowed = validTransitions[existing.status] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                error: `Tidak bisa mengubah status dari "${existing.status}" ke "${newStatus}"`
            });
        }

        const oldStatus = existing.status;
        existing.status = newStatus;
        existing.updatedBy = req.headers["x-user-name"] || "System";
        // Persist status dulu, baru stok — jika save gagal, stok tidak berubah
        // (hindari stok bertambah padahal retur belum dikonfirmasi).
        await existing.save();

        // Barang kembali dari pelanggan → stok trading BERTAMBAH otomatis.
        // PRD V1 §8–9: item service/recipe/manufactured/digital tidak memakai
        // stok → tidak di-retur-kan ke stok (reuse splitPosItemsByBehavior).
        if (newStatus === "returned") {
            const barangs = await fetchBehaviorBarangs(existing.companyCode, existing.items);
            const { trading } = splitPosItemsByBehavior(existing.items, barangs);
            for (const item of trading) {
                await Barang.findOneAndUpdate(
                    { companyCode: existing.companyCode, kode: item.kode },
                    { $inc: { stok: item.qty } }
                ).catch(err => {
                    console.warn(`[ReturPenjualan] Failed to update stock for ${item.kode}:`, err.message);
                });
            }
        }

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "retur-penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Status: ${oldStatus} → ${newStatus}`,
                userName
            });
        } catch (logErr) {
            console.warn("[ReturPenjualan] Failed to log activity:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
