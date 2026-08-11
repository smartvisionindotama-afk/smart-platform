/**
 * POS Route — kasir endpoints (SP-029 M3 + PRD V1).
 *
 * GET  /api/pos/kasir-data — data ringkas layar kasir (produk + kategori +
 *      barcode + harga_khusus + shift aktif)
 * GET  /api/pos/shifts — riwayat shift (company-scoped)
 * POST /api/pos/shift/open — buka shift (kas awal)
 * POST /api/pos/shift/close — tutup shift (actual cash → rekonsiliasi)
 * GET  /api/pos/dashboard — ringkasan dashboard POS (owner & kasir)
 *
 * @module server/routes/pos
 */

import { Router } from "express";
import { Barang } from "../models/Barang.js";
import { Penjualan } from "../models/Penjualan.js";
import { Shift } from "../models/Shift.js";
import { Setting } from "../models/Setting.js";
import { Warehouse } from "../models/Warehouse.js";
import { resolveKasirGudang } from "../services/pos-gudang.js";
import { security } from "../security.js";

const router = Router();

/**
 * GET /kasir-data
 * PRD V1 — menyertakan barcode (search/scanner) + harga_khusus (multi price
 * minimal) + shift aktif (untuk indikator & gate transaksi).
 */
router.get("/kasir-data", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const query = { active: true, status: { $ne: "archived" } };
        if (companyCode) query.companyCode = companyCode;

        // M3-FIX v21 — gudang terhubung kasir (PRD V1 §X): kasir hanya melihat
        // stok gudang yang dikonfigurasi Admin (gudangKasir per kasir, atau
        // gudangTerkoneksi bila kasir tunggal). Tanpa konfigurasi → seluruh
        // stok tampil (default kompatibel).
        const [setting, warehouses] = await Promise.all([
            Setting.findOne({ companyCode: companyCode || "" }).lean(),
            Warehouse.find({ companyCode: companyCode || "", active: true, status: { $ne: "archived" } })
                .select("kode nama")
                .sort({ nama: 1 })
                .lean()
        ]);
        const gudangInfo = resolveKasirGudang({
            setting,
            user: req.user,
            warehouses: (warehouses || []).map(w => ({ kode: w.kode, nama: w.nama || w.kode }))
        });
        if (gudangInfo) {
            // Barang.gudang bisa berisi kode ATAU nama (data legacy); stok
            // tanpa gudang ("") atau field gudang tidak ada (dokumen buatan
            // route transfer) tetap tampil di semua kasir.
            query.$or = [
                { gudang: { $in: gudangInfo.gudangValues } },
                { gudang: { $exists: false } }
            ];
        }

        const barangs = await Barang.find(query)
            .sort({ nama: 1 })
            .limit(1000)
            .lean();

        const produk = barangs
            .filter(b => (Number(b.harga_jual) || 0) > 0)
            .map(b => ({
                id: String(b._id),
                kode: b.kode,
                nama: b.nama,
                kategori: b.kategori || "",
                satuan: b.satuan || "",
                // Harga normal = harga_jual. Harga khusus (harga_khusus) HANYA
                // berlaku untuk member — dipilih di layar kasir (M3-FIX v19).
                harga: Number(b.harga_jual) || 0,
                harga_jual: Number(b.harga_jual) || 0,
                harga_khusus: Number(b.harga_khusus) || 0,
                barcode: b.barcode || "",
                stok: Number(b.stok) || 0,
                behavior: b.behavior || "trading",
                foto: b.foto || ""
            }));

        const kategori = [...new Set(
            barangs.map(b => (b.kategori || "").trim()).filter(Boolean)
        )];

        // Shift aktif untuk perusahaan ini (indikator kasir)
        let shiftAktif = null;
        try {
            shiftAktif = await Shift.findOne({
                companyCode: companyCode || "",
                status: "open"
            }).sort({ waktuMulai: -1 }).lean();
        } catch { /* ignore */ }

        // Pajak transaksi — diatur Admin (Settings), kasir hanya mengikuti.
        let taxEnabled = true;
        try {
            const setting = await Setting.findOne({ companyCode: companyCode || "" }).lean();
            if (setting) taxEnabled = setting.taxEnabled !== false;
        } catch { /* ignore — default aktif */ }

        res.json({
            produk,
            kategori,
            shiftAktif,
            taxEnabled,
            // M3-FIX v21 — gudang terhubung kasir (null = tanpa scoping)
            gudang: gudangInfo
                ? { kodeGudang: gudangInfo.kodeGudang, namaGudang: gudangInfo.namaGudang, kodeList: gudangInfo.kodeList }
                : null,
            warehouses: (warehouses || []).map(w => ({ kode: w.kode, nama: w.nama || w.kode }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /shifts — riwayat shift (company-scoped), terbaru dulu.
 */
router.get("/shifts", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const q = companyCode ? { companyCode } : {};
        if (req.query.status) q.status = req.query.status;
        const total = await Shift.countDocuments(q);
        const data = await Shift.find(q)
            .sort({ waktuMulai: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /shift/open — buka shift kasir (PRD V1 §12.1).
 * Body: { kasAwal, catatan } — hanya satu shift open per kasir per waktu.
 * Permission: pos.shift.open (additive).
 */
router.post("/shift/open", security.permission("pos.shift.open"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const kasAwal = Math.max(0, Number(req.body?.kasAwal) || 0);

        // Cegah shift ganda yang masih open (kasir yang sama / company)
        const existing = await Shift.findOne({ companyCode, status: "open" }).sort({ waktuMulai: -1 });
        if (existing) {
            return res.status(409).json({ error: "Masih ada shift yang belum ditutup" });
        }

        const userName = req.headers["x-user-name"] || "Kasir";
        const shift = await Shift.create({
            companyCode,
            kasir: userName,
            kasirUsername: req.user?.username || userName,
            kasAwal,
            status: "open",
            waktuMulai: new Date(),
            createdBy: userName
        });
        res.status(201).json(shift);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /shift/close — tutup shift (PRD V1 §12.3).
 * Body: { actualCash, catatan } — expected dihitung server dari transaksi POS
 * selama shift (kasAwal + totalPenjualan), difference = actual - expected.
 * Permission: pos.shift.close.
 */
router.post("/shift/close", security.permission("pos.shift.close"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const shift = await Shift.findOne({ companyCode, status: "open" }).sort({ waktuMulai: -1 });
        if (!shift) return res.status(404).json({ error: "Tidak ada shift aktif" });

        const actualCash = Math.max(0, Number(req.body?.actualCash) || 0);
        const now = new Date();

        // Hitung total transaksi POS selama shift (sumber=pos, bukan void)
        const agg = await Penjualan.aggregate([
            {
                $match: {
                    companyCode,
                    sumber: "pos",
                    status: "paid",
                    tanggal: { $gte: shift.waktuMulai, $lte: now }
                }
            },
            {
                $group: {
                    _id: null,
                    totalTransaksi: { $sum: 1 },
                    totalPenjualan: { $sum: "$grandTotal" },
                    totalPajak: { $sum: "$pajak" },
                    totalDiskon: { $sum: "$diskon" }
                }
            }
        ]);
        const a = agg[0] || {};
        const totalPenjualan = Math.round((a.totalPenjualan || 0) * 100) / 100;
        const expectedCash = Math.round((shift.kasAwal + totalPenjualan) * 100) / 100;
        const difference = Math.round((actualCash - expectedCash) * 100) / 100;

        shift.totalTransaksi = a.totalTransaksi || 0;
        shift.totalPenjualan = totalPenjualan;
        shift.totalPajak = Math.round((a.totalPajak || 0) * 100) / 100;
        shift.totalDiskon = Math.round((a.totalDiskon || 0) * 100) / 100;
        shift.expectedCash = expectedCash;
        shift.actualCash = actualCash;
        shift.difference = difference;
        shift.waktuTutup = now;
        shift.status = "closed";
        shift.catatan = req.body?.catatan ? String(req.body.catatan).slice(0, 300) : "";
        shift.updatedBy = req.headers["x-user-name"] || "System";
        await shift.save();

        res.json(shift);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /dashboard — ringkasan dashboard POS (PRD V1 §6).
 * Owner & kasir: omzet hari ini, jumlah transaksi, terlaris, stok menipis,
 * breakdown metode bayar, ringkasan shift, riwayat transaksi hari ini.
 */
router.get("/dashboard", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date();

        const base = { companyCode: companyCode || "" };
        const todayMatch = { ...base, sumber: "pos", status: "paid", tanggal: { $gte: startToday, $lte: endToday } };

        const [salesAgg, topItems, lowStock, paymentAgg, shifts, todayTx] = await Promise.all([
            // Ringkasan penjualan hari ini
            Penjualan.aggregate([
                { $match: todayMatch },
                { $group: { _id: null, omzet: { $sum: "$grandTotal" }, jumlah: { $sum: 1 }, pajak: { $sum: "$pajak" }, diskon: { $sum: "$diskon" } } }
            ]),
            // Produk terlaris (flatten items)
            Penjualan.aggregate([
                { $match: todayMatch },
                { $unwind: "$items" },
                { $group: { _id: "$items.kode", nama: { $first: "$items.nama" }, qty: { $sum: "$items.qty" }, omzet: { $sum: "$items.subtotal" } } },
                { $sort: { qty: -1 } },
                { $limit: 5 }
            ]),
            // Stok menipis (trading saja — jasa/resep tanpa stok tidak relevan)
            Barang.find({ ...base, active: true, status: { $ne: "archived" }, behavior: "trading" })
                .select("kode nama stok stok_minimum satuan")
                .lean(),
            // Breakdown metode bayar
            Penjualan.aggregate([
                { $match: todayMatch },
                { $group: { _id: "$metode_bayar", omzet: { $sum: "$grandTotal" }, jumlah: { $sum: 1 } } }
            ]),
            // Shift aktif + riwayat singkat
            Shift.find({ ...base, status: "open" }).sort({ waktuMulai: -1 }).limit(1).lean(),
            // Riwayat transaksi hari ini (terbaru dulu)
            Penjualan.find(todayMatch)
                .select("nomor tanggal kasir grandTotal metode_bayar pajak")
                .sort({ tanggal: -1 })
                .limit(20)
                .lean()
        ]);

        const sales = salesAgg[0] || { omzet: 0, jumlah: 0, pajak: 0, diskon: 0 };
        const lowStockList = lowStock
            .filter(b => (Number(b.stok) || 0) <= (Number(b.stok_minimum) || 0))
            .sort((a, b) => (Number(a.stok) || 0) - (Number(b.stok) || 0))
            .slice(0, 10);
        const paymentMap = {};
        for (const p of paymentAgg) paymentMap[p._id || "cash"] = p;

        res.json({
            omzetHariIni: Math.round((sales.omzet || 0) * 100) / 100,
            jumlahTransaksi: sales.jumlah || 0,
            totalPajak: Math.round((sales.pajak || 0) * 100) / 100,
            totalDiskon: Math.round((sales.diskon || 0) * 100) / 100,
            produkTerlaris: topItems,
            stokMenipis: lowStockList,
            metodeBayar: Object.values(paymentMap),
            shiftAktif: shifts[0] || null,
            riwayatHariIni: todayTx
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
