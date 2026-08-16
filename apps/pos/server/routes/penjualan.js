/**
 * Penjualan Route — Sales Order CRUD.
 *
 * GET    /             — List with search, pagination, company scoping
 * GET    /:id          — Get single sales order
 * POST   /             — Create SO with auto-generated nomor
 * PUT    /:id          — Update SO (only if status = order)
 * DELETE /:id          — Delete SO (only if status = order)
 * PATCH  /:id/status   — Update status (order → delivered → invoiced → paid)
 * POST   /:id/hold     — Hold transaksi POS (PRD V1 §7.5): keranjang disimpan
 *                        sementara, status → "held" (stok TIDAK berubah).
 * POST   /:id/resume   — Resume transaksi yang ditahan: "held" → "order".
 *
 * Stock: decrement on delivered, reverse on revert back to order.
 *
 * @module server/routes/penjualan
 */

import { Router } from "express";
import mongoose from "mongoose";
import { Penjualan } from "../models/Penjualan.js";
import { Barang } from "../models/Barang.js";
import { Customer } from "../models/Customer.js";
import { Warehouse } from "../models/Warehouse.js";
import { ActivityLog } from "../models/ActivityLog.js";
import { formatError } from "../utils/format-error.js";
import { splitPosItemsByBehavior, normalizePosPayload, checkHoldResumeTransition, resolvePosCreateFlags, normalizeTipePelanggan } from "../services/pos-transaction.js";
import { requireTransactionType } from "../services/transaction-capability.js";
import { applyRecipeConsumption, revertRecipeConsumption } from "../services/recipe.js";
import { adjustBarangStok } from "../services/barang-stok.js";
import { security } from "../security.js";

// PRD V1 — metode pembayaran POS yang didukung (extensible).
const PAYMENT_METHODS = ["cash", "transfer", "qris", "card"];

const router = Router();

/** Helper: check company ownership */
function checkCompany(item, req) {
    if (!item) return false;
    const companyCode = req.headers["x-company-code"];
    if (!companyCode) return true;
    return item.companyCode === companyCode;
}

/**
 * GET / — List sales orders.
 */
router.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").toLowerCase().trim();
        const companyCode = req.headers["x-company-code"];

        const query = {};
        if (companyCode) query.companyCode = companyCode;
        // STRICT (SP-029 M6-FIX): server POS HANYA melayani transaksi kasir
        // (sumber="pos"). Data SO/admin TIDAK tampil di POS walaupun satu
        // collection MongoDB — dua aplikasi, dua domain data.
        query.sumber = "pos";
        // PRD V1 §7.5 — filter status (mis. status=held untuk daftar transaksi ditahan)
        if (req.query.status && req.query.status !== "all") {
            query.status = String(req.query.status);
        }
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { pelanggan: { $regex: search, $options: "i" } },
                { pelangganNama: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } },
                { noPoPelanggan: { $regex: search, $options: "i" } }
            ];
        }

        const total = await Penjualan.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = await Penjualan.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({ data, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single sales order.
 */
router.get("/:id", async (req, res) => {
    try {
        const item = await Penjualan.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(item, req)) return res.status(404).json({ error: "Not found" });
        // STRICT: detail hanya boleh diakses untuk transaksi domain POS (kasir).
        if (item.sumber !== "pos") return res.status(404).json({ error: "Not found" });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create sales order.
 *
 * SP-029 POS V1 — Transaction Capability: pembuatan transaksi penjualan
 * adalah workflow capability "retail". Bila perusahaan tidak mengaktifkan
 * "retail", request ditolak 403 (enforcement backend, bukan hanya UI).
 * Default V1 (["retail"]) membuat perilaku existing tidak berubah.
 */
router.post("/", requireTransactionType("retail"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) {
            return res.status(400).json({ error: "Company code required" });
        }

        const { tanggal, pelanggan, pelangganNama, pelangganAlamat, noPoPelanggan, kirimDari, kirimDariNama, items, diskon, catatan, sales, sumber, kasir, pajak, bayar, kembalian, metode_bayar, hold, holdNote, tipePelanggan, gudang: kodeGudangReq } = req.body;

        // ── SP-029 M3 — transaksi kasir (POS) ──
        // sumber="pos" → langsung lunas (status paid, noKwitansi terbit saat
        // create), stok barang trading berkurang saat itu juga. Jasa (behavior
        // "service") TIDAK mengurangi stok.
        // hold:true (PRD V1 §7.5) → keranjang sementara: status "held", tanpa
        // pembayaran, tanpa pengurangan stok, tanpa kwitansi.
        const flags = resolvePosCreateFlags({ sumber, hold });
        const isPos = flags.isPos;
        const isHold = flags.isHold;
        const tipePelangganVal = isPos ? normalizeTipePelanggan(tipePelanggan) : "umum";

        // M3-FIX v20 — member wajib TERDAFTAR di Master Member (defense in depth).
        // Kasir mengirim kode member via field `pelanggan`; server validasi &
        // simpan nama member dari Master Member (bukan dari client).
        let memberNama = "";
        if (isPos && tipePelangganVal === "member") {
            const memberKode = String(pelanggan || "").trim();
            if (!memberKode) {
                return res.status(400).json({ error: "Kode member wajib diisi — scan kartu member atau input kode member" });
            }
            const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rx = new RegExp(`^${esc(memberKode)}$`, "i");
            // M6-FIX — kode NFC ikut dicocokkan: kasir men-tap kartu NFC (kodeNfc)
            // atau scan/ketik kode member (kode) → member yang sama ditemukan.
            const member = await Customer.findOne({
                companyCode,
                $or: [{ kode: rx }, { kodeNfc: rx }],
                active: true,
                status: { $ne: "archived" }
            }).lean();
            if (!member) {
                return res.status(400).json({ error: `Kode member "${memberKode}" tidak ditemukan di Master Member` });
            }
            memberNama = member.nama || memberKode;
        }
        // PRD V1 — metode bayar hanya untuk transaksi POS; SO normal dianggap cash (default).
        const metodeBayar = PAYMENT_METHODS.includes(metode_bayar) ? metode_bayar : "cash";
        const pos = isPos ? normalizePosPayload({ pelanggan, pelangganNama, kasir, pajak, bayar, kembalian, diskon }) : null;

        if (!isPos && (!pelanggan || !pelanggan.trim())) {
            return res.status(400).json({ error: "Pelanggan wajib diisi" });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
        }

        // Validate & calculate items
        // itemRefs (index-aligned) membawa id Barang asli dari katalog kasir
        // agar pengurangan stok deterministik (decrement dokumen yang diklik),
        // bukan dokumen arbitrer saat kode sama ada di beberapa gudang.
        const itemRefs = items.map(item => ({ kode: item.kode || "", id: item.id || null }));
        const validatedItems = items.map((item, idx) => {
            const qty = Number(item.qty) || 0;
            const harga = Number(item.harga) || 0;
            const diskonItem = Number(item.diskon) || 0;
            const ref = itemRefs[idx];
            // M6.2 — simpan referensi produk (Barang._id) utk lookup recipe F&B.
            const productId = (ref && ref.id && mongoose.Types.ObjectId.isValid(String(ref.id)))
                ? String(ref.id)
                : "";
            // M6.2-FIX v0.42 — simpan referensi VARIAN recipe F&B (Recipe._id)
            // yang dipilih kasir (produk bisa punya beberapa varian aktif).
            const recipeId = (item.recipeId && mongoose.Types.ObjectId.isValid(String(item.recipeId)))
                ? String(item.recipeId)
                : "";
            // M6.2-FIX v0.43 — SKU varian yang dipilih kasir (kode + label),
            // dipakai decrement/reversal stok kombinasi spesifik.
            const skuKode = String(item.skuKode || "").trim();
            const skuLabel = String(item.skuLabel || "").trim();
            return {
                kode: item.kode || "",
                nama: item.nama || "",
                satuan: item.satuan || "",
                qty,
                harga,
                diskon: diskonItem,
                subtotal: Math.max(0, (qty * harga) - diskonItem),
                productId,
                recipeId,
                // M6.2-FIX v0.43 — SKU varian yang dipilih kasir (kode + label),
                // dipakai decrement/reversal stok kombinasi spesifik.
                skuKode,
                skuLabel
            };
        });

        const total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
        const diskonVal = isPos ? pos.diskon : (Number(diskon) || 0);
        const pajakVal = isPos ? pos.pajak : 0;
        // grandTotal = yang benar-benar dibayar pelanggan (untuk POS termasuk pajak)
        const grandTotal = Math.max(0, total - diskonVal + pajakVal);
        const bayarVal = isPos ? pos.bayar : 0;
        const kembalianVal = isPos ? (bayarVal > 0 ? Math.max(0, bayarVal - grandTotal) : pos.kembalian) : 0;

        // SP-029 M3 (review): defense in depth — transaksi kasir wajib lunas
        // (kecuali hold draft — keranjang sementara belum dibayar).
        if (flags.enforcePayment && bayarVal < grandTotal) {
            return res.status(400).json({ error: "Jumlah bayar kurang dari total transaksi" });
        }

        // POS → nomor dokumen = NOTA (format DDMMYYYY-XXXX, tanpa prefix —
        // M3-FIX v19; alur kasir hanya nota, bukan SO/SJ/Invoice/Kwitansi).
        // SO biasa tetap SO; hold draft juga memakai nomor nota (belum bayar).
        // M3-FIX v21 — gudang terhubung kasir: simpan kode + nama gudang pada
        // transaksi (dipakai scoping stok & struk). Nama diambil server.
        let kodeGudang = "";
        let gudangNama = "";
        if (isPos && kodeGudangReq) {
            const wh = await Warehouse.findOne({ companyCode, kode: String(kodeGudangReq).trim() })
                .select("kode nama").lean();
            if (wh) {
                kodeGudang = wh.kode;
                gudangNama = wh.nama || wh.kode;
            }
        }

        const nomor = await Penjualan.generateNomor(companyCode, isPos ? "" : "SO");

        const so = await Penjualan.create({
            companyCode,
            nomor,
            tanggal: tanggal || new Date(),
            pelanggan: isPos ? pos.pelanggan : pelanggan.trim(),
            pelangganNama: isPos
                ? (tipePelangganVal === "member" ? memberNama : "Pelanggan Umum")
                : (pelangganNama || ""),
            pelangganAlamat: pelangganAlamat || "",
            noPoPelanggan: noPoPelanggan || "",
            kirimDari: kirimDari || "",
            kirimDariNama: kirimDariNama || "",
            items: validatedItems,
            total,
            diskon: diskonVal,
            grandTotal,
            catatan: catatan || (isPos ? "Penjualan kasir" : ""),
            sales: sales || "",
            status: isPos ? (isHold ? "held" : "paid") : "order",
            sumber: isPos ? "pos" : "so",
            kasir: isPos ? (pos.kasir || req.headers["x-user-name"] || "Kasir") : "",
            pajak: pajakVal,
            bayar: isHold ? 0 : bayarVal,
            kembalian: isHold ? 0 : kembalianVal,
            metode_bayar: isPos ? metodeBayar : "cash",
            noKwitansi: isPos && !isHold ? nomor : "",
            tanggalKwitansi: isPos && !isHold ? new Date() : null,
            tipePelanggan: isPos ? tipePelangganVal : "umum",
            kodeGudang,
            gudang: gudangNama,
            heldAt: isHold ? new Date() : null,
            heldBy: isHold ? (pos.kasir || req.headers["x-user-name"] || "Kasir") : null,
            heldNote: isHold ? String(holdNote || "").trim().slice(0, 200) : "",
            createdBy: isPos ? (pos.kasir || req.headers["x-user-name"] || "Kasir") : (req.headers["x-user-name"] || "System")
        });

        // POS: kurangi stok barang trading saat transaksi terjadi (jasa tidak).
        // Hold draft TIDAK mengubah stok — belum ada penjualan.
        if (flags.decrementStock) {
            const kodes = validatedItems.map(item => item.kode).filter(Boolean);
            const barangs = kodes.length
                ? await Barang.find({ companyCode, kode: { $in: kodes } }).select("kode behavior").lean()
                : [];
            const { trading } = splitPosItemsByBehavior(validatedItems, barangs);
            for (const item of trading) {
                const idx = validatedItems.indexOf(item);
                const ref = idx >= 0 ? itemRefs[idx] : null;
                // M6.2-FIX v0.43 — SKU-aware: item ber-skuKode meng-update stok
                // kombinasi spesifik + sinkron agregat; tanpa SKU → $inc biasa.
                await adjustBarangStok({
                    companyCode,
                    item,
                    delta: -item.qty,
                    gudang: gudangNama,
                    id: (ref && ref.id) ? ref.id : null
                });
            }
        }

        // M6.2 — F&B Recipe/BOM consumption: produk ber-recipe aktif → stok
        // ingredient dikurangi sesuai qty terjual (engine calculateRecipeConsumption,
        // idempotent per saleId+productId). Produk tanpa recipe → Retail existing
        // TIDAK berubah. Hold draft tidak mengonsumsi (belum ada penjualan).
        if (flags.isPos && !isHold && validatedItems.length) {
            try {
                const userName = req.headers["x-user-name"] || "System";
                await applyRecipeConsumption({ companyCode, sale: so, items: validatedItems, user: userName });
            } catch (consumeErr) {
                // Best effort (pola stock mutation existing): kegagalan konsumsi
                // tidak menggagalkan transaksi — dicatat utk audit/penyelidikan.
                console.warn("[Penjualan] Recipe consumption error (sale " + nomor + "):", consumeErr?.message);
            }
        }

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "create",
                resource: "penjualan",
                resourceId: so._id.toString(),
                resourceName: `${pelangganNama || pelanggan} - ${nomor}`,
                resourceCode: nomor,
                details: `${validatedItems.length} item, total: ${so.grandTotal}${isHold ? " (hold)" : (isPos ? ` (kasir: ${so.kasir})` : "")}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log activity:", logErr.message);
        }

        res.status(201).json(so);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Penjualan") });
    }
});

/**
 * POST /:id/void — Void transaksi POS (PRD V1 §7.5).
 *
 * Hanya transaksi POS (sumber=pos) dengan status paid yang bisa di-void.
 * Reversal stok (trading) + status → "void" + audit trail (voidedAt/By/Reason).
 * Permission: `pos.transaction.void` (role Admin/Owner saja — keputusan PO).
 */
router.post("/:id/void", security.permission("pos.transaction.void"), async (req, res) => {
    try {
        const existing = await Penjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        if (existing.sumber !== "pos") {
            return res.status(400).json({ error: "Hanya transaksi kasir (sumber=pos) yang bisa di-void. Untuk SO gunakan hapus/reversal manual." });
        }
        if (existing.status !== "paid") {
            return res.status(400).json({ error: `Transaksi berstatus "${existing.status}" tidak bisa di-void` });
        }

        const rawReason = (req.body && (req.body.alasan || req.body.reason)) ? (req.body.alasan || req.body.reason) : "";
        const reason = String(rawReason).trim().slice(0, 200);
        const userName = req.headers["x-user-name"] || "System";

        // Reversal stok: trading dikembalikan; no-stock (service/recipe/dll) tidak.
        const kodes = existing.items.map(item => item.kode).filter(Boolean);
        const barangs = kodes.length
            ? await Barang.find({ companyCode: existing.companyCode, kode: { $in: kodes } }).select("kode behavior").lean()
            : [];
        const { trading } = splitPosItemsByBehavior(existing.items, barangs);
        for (const item of trading) {
            // M6.2-FIX v0.43 — SKU-aware reversal (kombinasi spesifik + agregat)
            await adjustBarangStok({
                companyCode: existing.companyCode,
                item,
                delta: item.qty,
                gudang: existing.gudang || ""
            });
        }

        // M6.2 — F&B: kembalikan stok ingredient yang sudah dikonsumsi (reversal
        // via service boundary). Aman karena void hanya dari status "paid" (gate
        // existing) — transaksi tidak bisa di-void dua kali.
        try {
            await revertRecipeConsumption({ companyCode: existing.companyCode, sale: existing, user: userName });
        } catch (revErr) {
            // Best effort — void tetap selesai; konsumsi yang gagal di-reverse
            // tercatat di RecipeConsumption (status applied) utk rekonsiliasi.
            console.warn(`[Penjualan] Recipe consumption reversal error (${existing.nomor}):`, revErr?.message);
        }

        existing.status = "void";
        existing.voidedAt = new Date();
        existing.voidedBy = userName;
        existing.voidReason = reason;
        existing.updatedBy = userName;
        await existing.save();

        // Log activity
        try {
            await ActivityLog.create({
                companyCode: existing.companyCode,
                action: "void",
                resource: "penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Void transaksi kasir ${existing.nomor}${reason ? ` (${reason})` : ""} oleh ${userName}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log void:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/hold — Hold transaksi POS (PRD V1 §7.5).
 *
 * Keranjang kasir yang belum jadi disimpan sementara (status → "held").
 * Stok TIDAK berkurang saat hold (belum ada penjualan) — reversal tidak
 * diperlukan. Transaksi bisa dilanjutkan (POST /:id/resume) atau dihapus.
 * Permission: pos.transaction.hold (kasir & admin).
 */
router.post("/:id/hold", security.permission("pos.transaction.hold"), async (req, res) => {
    try {
        // Defense in depth: id non-ObjectId (mis. id lokal fallback) → 400, bukan 500 CastError
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID transaksi tidak valid" });
        }
        const existing = await Penjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const t = checkHoldResumeTransition(existing.status, "hold");
        if (!t.ok) return res.status(400).json({ error: t.message });

        const note = (req.body && req.body.catatan) ? String(req.body.catatan).trim().slice(0, 200) : "";
        const userName = req.headers["x-user-name"] || "System";

        existing.status = "held";
        existing.heldAt = new Date();
        existing.heldBy = userName;
        existing.heldNote = note;
        existing.updatedBy = userName;
        await existing.save();

        // Log activity
        try {
            await ActivityLog.create({
                companyCode: existing.companyCode,
                action: "hold",
                resource: "penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Transaksi ditahan ${existing.nomor} (${existing.items.length} item)${note ? ` — ${note}` : ""} oleh ${userName}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log hold:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /:id/resume — Resume transaksi yang ditahan (PRD V1 §7.5).
 *
 * Status "held" → "order": keranjang kembali aktif di layar kasir untuk
 * dilanjutkan checkout. Stok tidak berubah di kedua arah.
 */
router.post("/:id/resume", security.permission("pos.transaction.hold"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
            return res.status(400).json({ error: "ID transaksi tidak valid" });
        }
        const existing = await Penjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const t = checkHoldResumeTransition(existing.status, "resume");
        if (!t.ok) return res.status(400).json({ error: t.message });

        const userName = req.headers["x-user-name"] || "System";
        existing.status = "order";
        existing.heldAt = null;
        existing.updatedBy = userName;
        await existing.save();

        // Log activity
        try {
            await ActivityLog.create({
                companyCode: existing.companyCode,
                action: "resume",
                resource: "penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Transaksi dilanjutkan ${existing.nomor} oleh ${userName}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log resume:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /:id — Update sales order (only if status = order).
 */
router.put("/:id", async (req, res) => {
    try {
        const existing = await Penjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });
        if (existing.status !== "order") {
            return res.status(400).json({ error: "Hanya SO dengan status Order yang bisa diedit" });
        }

        const { tanggal, pelanggan, pelangganNama, pelangganAlamat, noPoPelanggan, kirimDari, kirimDariNama, items, diskon, catatan, sales } = req.body;

        const updateData = {};
        if (tanggal !== undefined) updateData.tanggal = tanggal;
        if (pelanggan !== undefined) updateData.pelanggan = pelanggan.trim();
        if (pelangganNama !== undefined) updateData.pelangganNama = pelangganNama;
        if (pelangganAlamat !== undefined) updateData.pelangganAlamat = pelangganAlamat;
        if (noPoPelanggan !== undefined) updateData.noPoPelanggan = noPoPelanggan;
        if (kirimDari !== undefined) updateData.kirimDari = kirimDari;
        if (kirimDariNama !== undefined) updateData.kirimDariNama = kirimDariNama;
        if (catatan !== undefined) updateData.catatan = catatan;
        if (diskon !== undefined) updateData.diskon = Number(diskon);
        if (sales !== undefined) updateData.sales = sales;
        updateData.updatedBy = req.headers["x-user-name"] || "System";

        if (items !== undefined) {
            if (!items || items.length === 0) {
                return res.status(400).json({ error: "Minimal 1 item barang harus ditambahkan" });
            }
            const validatedItems = items.map(item => {
                const qty = Number(item.qty) || 0;
                const harga = Number(item.harga) || 0;
                const diskonItem = Number(item.diskon) || 0;
                return {
                    kode: item.kode || "",
                    nama: item.nama || "",
                    satuan: item.satuan || "",
                    qty,
                    harga,
                    diskon: diskonItem,
                    subtotal: Math.max(0, (qty * harga) - diskonItem)
                };
            });
            updateData.items = validatedItems;
            updateData.total = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);
            updateData.grandTotal = Math.max(0, updateData.total - (updateData.diskon || existing.diskon || 0));
        }

        const updated = await Penjualan.findByIdAndUpdate(
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
                resource: "penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${pelangganNama || existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Update SO ${existing.nomor}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log activity:", logErr.message);
        }

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: formatError(err, "Penjualan") });
    }
});

/**
 * DELETE /:id — Delete sales order (any status).
 * Jika sudah delivered/beyond, reversal stok (kembalikan ke gudang).
 */
router.delete("/:id", async (req, res) => {
    try {
        const existing = await Penjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        // Jika sudah delivered atau beyond, reversal stok (kembalikan ke gudang).
        // SP-029 M3 (review): item jasa (behavior service, stok 0) TIDAK di-reverse
        // agar tidak menciptakan stok fiktif (transaksi kasir menyimpan item jasa).
        if (existing.status !== "order") {
            const kodes = existing.items.map(item => item.kode).filter(Boolean);
            const barangs = kodes.length
                ? await Barang.find({ companyCode: existing.companyCode, kode: { $in: kodes } }).select("kode behavior").lean()
                : [];
            const { trading } = splitPosItemsByBehavior(existing.items, barangs);
            for (const item of trading) {
                // Reversal scoped ke gudang transaksi (M3-FIX v21)
                const q = { companyCode: existing.companyCode, kode: item.kode };
                if (existing.gudang) {
                    const doc = await Barang.findOne({ ...q, gudang: existing.gudang }).select("_id").lean()
                        || await Barang.findOne({ ...q, gudang: "" }).select("_id").lean();
                    if (doc) q._id = doc._id;
                    else delete q.gudang;
                }
                await Barang.findOneAndUpdate(
                    q,
                    { $inc: { stok: item.qty } }
                ).catch(err => {
                    console.warn(`[Penjualan] Failed to reverse stock for ${item.kode}:`, err.message);
                });
            }
        }

        // Log activity before delete
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            await ActivityLog.create({
                companyCode,
                action: "delete",
                resource: "penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Hapus SO ${existing.nomor} (${existing.status})`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log activity:", logErr.message);
        }

        await Penjualan.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /:id/status — Update SO status.
 * Body: { status: "delivered" | "invoiced" | "paid" }
 *
 * Status flow:
 *   order → delivered (surat jalan, stock berkurang)
 *   delivered → invoiced (invoice terbit)
 *   invoiced → paid (kwitansi terbit, lunas)
 *
 * When status = "delivered", generate noSuratJalan + kurangi stock.
 * When status = "invoiced", generate noInvoice.
 * When status = "paid", generate noKwitansi.
 */
router.patch("/:id/status", async (req, res) => {
    try {
        const existing = await Penjualan.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!checkCompany(existing, req)) return res.status(404).json({ error: "Not found" });

        const newStatus = req.body.status;
        const validTransitions = {
            "order": ["delivered"],
            "delivered": ["invoiced"],
            "invoiced": ["paid"],
        };

        const allowed = validTransitions[existing.status] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                error: `Tidak bisa mengubah status dari "${existing.status}" ke "${newStatus}"`
            });
        }

        // PRD V1 §7.5 — integritas pembayaran: transaksi kasir (sumber "pos")
        // langsung lunas saat checkout. Alur status SO (order→delivered→paid)
        // TIDAK berlaku — mencegah hold→resume→PATCH mengubah draft bayar 0
        // menjadi paid tanpa pembayaran nyata. Jalur yang benar: void.
        if (existing.sumber === "pos") {
            return res.status(400).json({ error: "Transaksi kasir (POS) dikelola via checkout/void — status tidak bisa diubah di sini" });
        }

        const companyCode = existing.companyCode;

        const now = new Date();

        // Delivered → generate Surat Jalan nomor + kurangi stock
        if (newStatus === "delivered") {
            const sjNomor = await Penjualan.generateNomor(companyCode, "SJ");
            existing.noSuratJalan = sjNomor;
            existing.tanggalSJ = now;
            for (const item of existing.items) {
                await Barang.findOneAndUpdate(
                    { companyCode, kode: item.kode },
                    { $inc: { stok: -item.qty } }
                ).catch(err => {
                    console.warn(`[Penjualan] Failed to reduce stock for ${item.kode}:`, err.message);
                });
            }
        }

        // Invoiced → generate Invoice nomor
        if (newStatus === "invoiced") {
            const invNomor = await Penjualan.generateNomor(companyCode, "INV");
            existing.noInvoice = invNomor;
            existing.tanggalInvoice = now;
        }

        // Paid → generate Kwitansi nomor
        if (newStatus === "paid") {
            const kwtNomor = await Penjualan.generateNomor(companyCode, "KWT");
            existing.noKwitansi = kwtNomor;
            existing.tanggalKwitansi = now;
        }

        const oldStatus = existing.status;
        existing.status = newStatus;
        existing.updatedBy = req.headers["x-user-name"] || "System";
        await existing.save();

        // Log activity
        try {
            const companyCode = req.headers["x-company-code"];
            const userName = req.headers["x-user-name"] || "System";
            const statusLabels = { delivered: "Dikirim", invoiced: "Invoice", paid: "Lunas" };
            await ActivityLog.create({
                companyCode,
                action: "update",
                resource: "penjualan",
                resourceId: existing._id.toString(),
                resourceName: `${existing.pelangganNama || existing.pelanggan} - ${existing.nomor}`,
                resourceCode: existing.nomor,
                details: `Status: ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`,
                userName
            });
        } catch (logErr) {
            console.warn("[Penjualan] Failed to log activity:", logErr.message);
        }

        res.json(existing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
