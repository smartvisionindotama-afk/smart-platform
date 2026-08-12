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
import { Kategori } from "../models/Kategori.js";
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

        // Kategori sidebar kasir = MASTER KATEGORI (SSOT) — BUKAN diturunkan
        // dari Barang.kategori (M6-FIX: kasir mengikuti master tanpa
        // terkecuali; barang dengan kategori yang tidak terdaftar di master
        // sudah dihapus dari data). Icon sekaligus diambil dari master.
        let kategori = [];
        let kategoriIcons = {};
        try {
            const kats = await Kategori.find({
                companyCode: companyCode || "",
                active: true,
                status: { $ne: "archived" }
            })
                .select("nama icon")
                .sort({ nama: 1 })
                .lean();
            for (const k of kats) {
                const nama = String(k.nama || "").trim();
                if (!nama) continue;
                kategori.push(nama);
                if (k.icon) kategoriIcons[nama] = k.icon;
            }
        } catch { /* ignore — sidebar kosong, client pakai fallback */ }

        // Shift aktif STRICT per-kasir (M6-FIX — multi-kasir: tiap kasir punya
        // shift sendiri; indikator widget HANYA shift milik kasir yang login).
        // Fallback legacy (openCount===1) DIHAPUS: tanpanya kasir lain yang
        // login akan "mewarisi" shift kasir lain & tidak dipaksa buka shift
        // sendiri — setiap kasir WAJIB buka shift secara otonom.
        let shiftAktif = null;
        try {
            const userName = req.headers["x-user-name"] || "";
            const username = (req.user && req.user.username) || "";
            const orClauses = [];
            if (username) orClauses.push({ kasirUsername: username });
            if (userName) orClauses.push({ kasir: userName });
            // Hanya query bila ada identitas kasir (orClauses non-kosong);
            // tanpa identitas jangan fallback ke query tanpa filter yang bisa
            // mengembalikan shift kasir lain — shiftAktif tetap null.
            if (orClauses.length) {
                shiftAktif = await Shift.findOne({ companyCode: companyCode || "", status: "open", $or: orClauses }).sort({ waktuMulai: -1 }).lean();
            }
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
            kategoriIcons,
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
 * GET /shift/summary — ringkasan shift open utk modal Tutup Shift.
 * Kasir: shift miliknya sendiri (strict per-kasir). Admin/owner: target
 * opsional ?kasir=&kasirUsername= (dari dropdown halaman Shift).
 * Menampilkan kas awal + breakdown tunai/non-tunai + kas diharapkan
 * (= kas awal + penjualan tunai) agar kasir bisa mencocokkan kas fisik.
 */
router.get("/shift/summary", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const userName = req.headers["x-user-name"] || "";
        const username = (req.user && req.user.username) || "";
        const userRole = String((req.user && req.user.role) || "").toLowerCase();
        const isKasir = userRole === "kasir";
        const targetKasir = String(req.query.kasir || "").trim();
        const targetKasirUsername = String(req.query.kasirUsername || "").trim();

        const orClauses = [];
        if (!isKasir && targetKasirUsername) orClauses.push({ kasirUsername: targetKasirUsername });
        if (!isKasir && targetKasir) orClauses.push({ kasir: targetKasir });
        if (isKasir || (!targetKasir && !targetKasirUsername)) {
            if (username) orClauses.push({ kasirUsername: username });
            if (userName) orClauses.push({ kasir: userName });
        }
        let shift = null;
        if (orClauses.length) {
            shift = await Shift.findOne({ companyCode, status: "open", $or: orClauses }).sort({ waktuMulai: -1 }).lean();
        }
        if (!shift) return res.status(404).json({ error: "Tidak ada shift aktif untuk kasir ini" });

        const now = new Date();
        const saleMatch = {
            companyCode,
            sumber: "pos",
            status: "paid",
            tanggal: { $gte: shift.waktuMulai, $lte: now }
        };
        const kasirClauses = [];
        if (shift.kasirUsername) kasirClauses.push({ kasirUsername: shift.kasirUsername });
        if (shift.kasir) kasirClauses.push({ kasir: shift.kasir });
        if (kasirClauses.length) saleMatch.$or = kasirClauses;
        const agg = await Penjualan.aggregate([
            { $match: saleMatch },
            {
                $group: {
                    _id: null,
                    totalTransaksi: { $sum: 1 },
                    totalPenjualan: { $sum: "$grandTotal" },
                    // $in ["cash", null, ""] = data legacy tanpa metode dihitung tunai.
                    // Catatan: $nin TIDAK valid di ekspresi agregasi (hanya query
                    // filter) — gunakan $not: { $in: [...] } (M6-FIX v3 hotfix).
                    penjualanTunai: { $sum: { $cond: [{ $in: ["$metode_bayar", ["cash", null, ""]] }, "$grandTotal", 0] } },
                    penjualanNonTunai: { $sum: { $cond: [{ $not: { $in: ["$metode_bayar", ["cash", null, ""]] } }, "$grandTotal", 0] } }
                }
            }
        ]);
        const a = agg[0] || {};
        const round2 = (v) => Math.round((v || 0) * 100) / 100;
        const penjualanTunai = round2(a.penjualanTunai);
        const penjualanNonTunai = round2(a.penjualanNonTunai);
        res.json({
            kasir: shift.kasir || "",
            kasirUsername: shift.kasirUsername || "",
            kasAwal: round2(shift.kasAwal),
            waktuMulai: shift.waktuMulai,
            totalTransaksi: a.totalTransaksi || 0,
            totalPenjualan: round2(a.totalPenjualan),
            penjualanTunai,
            penjualanNonTunai,
            expectedCash: round2((shift.kasAwal || 0) + penjualanTunai)
        });
    } catch (err) {
        console.error("[ShiftSummary] error:", err?.message);
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
 * Body: { kasAwal, catatan, kasir?, kasirUsername? } — M6-FIX: bila ada >1
 * kasir, client mengirim kasir terpilih (nama + username); tanpa pilihan,
 * dipakai identitas user yang login. Satu shift open per KASIR (multi-kasir
 * boleh buka shift bersamaan).
 * Permission: pos.shift.open (additive).
 */
router.post("/shift/open", security.permission("pos.shift.open"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const kasAwal = Math.max(0, Number(req.body?.kasAwal) || 0);
        const picked = String(req.body?.kasir || "").trim();
        // M6-FIX v3: nama kasir diambil dari JWT (req.user.name) bila client
        // tidak mengirim (mode kasir tanpa dropdown) — mencegah shift tersimpan
        // dengan nama generik "Kasir" yang membuat widget tidak sinkron.
        const kasir = picked
            || req.headers["x-user-name"]
            || (req.user && (req.user.name || req.user.username))
            || "Kasir";
        const kasirUsername = String(req.body?.kasirUsername || "").trim()
            || (picked ? "" : ((req.user && req.user.username) || ""));

        // Cegah shift ganda: SATU shift open per kasir (kasir lain boleh buka)
        const orClauses = [];
        if (kasirUsername) orClauses.push({ kasirUsername });
        orClauses.push({ kasir });
        const existing = await Shift.findOne({ companyCode, status: "open", $or: orClauses }).sort({ waktuMulai: -1 });
        if (existing) {
            return res.status(409).json({ error: `Kasir "${kasir}" masih memiliki shift yang belum ditutup` });
        }

        const userName = req.headers["x-user-name"] || kasir;
        const shift = await Shift.create({
            companyCode,
            kasir,
            kasirUsername,
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
 * M6-FIX: shift yang ditutup = shift milik kasir yang LOGIN (bukan asal ambil
 * shift open terbaru), dan total transaksi dihitung per-kasir agar datanya
 * actual bila beberapa kasir buka shift bersamaan.
 * Permission: pos.shift.close.
 */
router.post("/shift/close", security.permission("pos.shift.close"), async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        if (!companyCode) return res.status(400).json({ error: "Company code required" });
        const userName = req.headers["x-user-name"] || "";
        const username = (req.user && req.user.username) || "";
        const userRole = String((req.user && req.user.role) || "").toLowerCase();
        const isKasir = userRole === "kasir";

        // M6-FIX — admin/owner boleh menutup shift kasir lain: body opsional
        // { kasir, kasirUsername } menunjuk shift target. Kasir biasa tetap
        // hanya bisa menutup shift miliknya sendiri (identitas login).
        const targetKasir = String(req.body?.kasir || "").trim();
        const targetKasirUsername = String(req.body?.kasirUsername || "").trim();

        const orClauses = [];
        if (!isKasir && targetKasirUsername) orClauses.push({ kasirUsername: targetKasirUsername });
        if (!isKasir && targetKasir) orClauses.push({ kasir: targetKasir });
        if (isKasir || (!targetKasir && !targetKasirUsername)) {
            if (username) orClauses.push({ kasirUsername: username });
            if (userName) orClauses.push({ kasir: userName });
        }
        // Hardening: hanya query bila ada klausa identitas/target (orClauses
        // non-kosong); tanpa identitas jangan tutup shift siapa pun.
        let shift = null;
        if (orClauses.length) {
            shift = await Shift.findOne({ companyCode, status: "open", $or: orClauses }).sort({ waktuMulai: -1 });
        }
        // M6-FIX v3 lanjutan — fallback legacy DIHAPUS: kasir hanya bisa
        // menutup shift miliknya sendiri (identitas JWT/header). Tanpa ini,
        // kasir lain bisa menutup shift kasir lain saat hanya ada satu shift
        // open — melanggar prinsip tiap kasir buka shift secara otonom.
        if (!shift) return res.status(404).json({ error: "Tidak ada shift aktif untuk kasir ini — buka shift terlebih dahulu" });

        const actualCash = Math.max(0, Number(req.body?.actualCash) || 0);
        const now = new Date();

        // Hitung total transaksi POS milik KASIR pemilik shift (sumber=pos,
        // bukan void) — selalu difilter per-kasir agar bila beberapa kasir buka
        // shift bersamaan, angka tiap shift tidak tercampur.
        const saleMatch = {
            companyCode,
            sumber: "pos",
            status: "paid",
            tanggal: { $gte: shift.waktuMulai, $lte: now }
        };
        const kasirClauses = [];
        if (shift.kasirUsername) kasirClauses.push({ kasirUsername: shift.kasirUsername });
        if (shift.kasir) kasirClauses.push({ kasir: shift.kasir });
        if (kasirClauses.length) saleMatch.$or = kasirClauses;
        const agg = await Penjualan.aggregate([
            { $match: saleMatch },
            {
                $group: {
                    _id: null,
                    totalTransaksi: { $sum: 1 },
                    totalPenjualan: { $sum: "$grandTotal" },
                    totalPajak: { $sum: "$pajak" },
                    totalDiskon: { $sum: "$diskon" },
                    // M6-FIX v3 — breakdown tunai (cash) vs non-tunai
                    // (transfer/qris/card): kas fisik hanya bertambah dari tunai.
                    // $in ["cash", null, ""] = data legacy tanpa metode dihitung tunai
                    // (default model "cash"). Catatan: $nin TIDAK valid di ekspresi
                    // agregasi — pakai $not: { $in: [...] } (M6-FIX v3 hotfix).
                    penjualanTunai: { $sum: { $cond: [{ $in: ["$metode_bayar", ["cash", null, ""]] }, "$grandTotal", 0] } },
                    penjualanNonTunai: { $sum: { $cond: [{ $not: { $in: ["$metode_bayar", ["cash", null, ""]] } }, "$grandTotal", 0] } }
                }
            }
        ]);
        const a = agg[0] || {};
        const round2 = (v) => Math.round((v || 0) * 100) / 100;
        const totalPenjualan = round2(a.totalPenjualan);
        const penjualanTunai = round2(a.penjualanTunai);
        const penjualanNonTunai = round2(a.penjualanNonTunai);
        // M6-FIX v3 — kas diharapkan = kas awal + PENJUALAN TUNAI saja
        // (non-tunai tidak menambah uang fisik di laci kas).
        const expectedCash = round2(shift.kasAwal + penjualanTunai);
        const difference = Math.round((actualCash - expectedCash) * 100) / 100;

        shift.totalTransaksi = a.totalTransaksi || 0;
        shift.totalPenjualan = totalPenjualan;
        shift.totalPajak = round2(a.totalPajak);
        shift.totalDiskon = round2(a.totalDiskon);
        shift.penjualanTunai = penjualanTunai;
        shift.penjualanNonTunai = penjualanNonTunai;
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
