/**
 * Laporan Routes — Reporting (Sprint 8).
 *
 * GET  /stock            — Laporan Stok (per barang: stok, nilai)
 * GET  /purchase         — Laporan Pembelian (per PO + summary)
 * GET  /sales            — Laporan Penjualan (per SO + summary)
 * GET  /inventory-value  — Laporan Nilai Inventori (total + by gudang/kategori)
 * GET  /mutation         — Laporan Mutasi Stok (pembelian, penjualan, transfer, retur, opname)
 * GET  /supplier         — Laporan Supplier (jumlah PO, total pembelian)
 * GET  /customer         — Laporan Pelanggan (jumlah SO, total penjualan)
 *
 * Semua endpoint company-scoped via header `x-company-code`.
 * Filter tanggal via query `startDate` & `endDate` (ISO).
 *
 * @module server/routes/laporan
 */

import { Router } from "express";
import { Barang } from "../models/Barang.js";
import { Pembelian } from "../models/Pembelian.js";
import { Penjualan } from "../models/Penjualan.js";
import { Transfer } from "../models/Transfer.js";
import { ReturPembelian } from "../models/ReturPembelian.js";
import { ReturPenjualan } from "../models/ReturPenjualan.js";
import { StockOpname } from "../models/StockOpname.js";
import { Supplier } from "../models/Supplier.js";
import { Customer } from "../models/Customer.js";

const router = Router();

/** Build company-scoped base query. */
function companyQuery(req) {
    const companyCode = req.headers["x-company-code"];
    return companyCode ? { companyCode } : {};
}

/** True bila nilai query tanggal tidak ada / placeholder ("undefined", "null"). */
function isBlankDateValue(v) {
    return v === undefined || v === null || v === "" || v === "undefined" || v === "null";
}

/**
 * Build date range query for a field (default "tanggal"). Returns null on
 * invalid date. Nilai placeholder ("undefined"/"null"/"") dianggap tanpa filter
 * — beberapa client lama mengirimnya saat input tanggal kosong.
 */
function dateRangeQuery(req, field = "tanggal") {
    const { startDate, endDate } = req.query;
    const q = {};
    if (!isBlankDateValue(startDate)) {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) return null;
        q[field] = { $gte: d };
    }
    if (!isBlankDateValue(endDate)) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) return null;
        end.setHours(23, 59, 59, 999);
        q[field] = { ...(q[field] || {}), $lte: end };
    }
    return q;
}

function paginateParams(req) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    return { page, limit, totalPages: 1 };
}

/**
 * GET /stock — Laporan Stok per barang.
 * Query: search (kode/nama), sort (nilai|stok|nama), page, limit
 */
router.get("/stock", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const sort = req.query.sort || "nama";

        const query = { status: { $ne: "archived" }, ...companyQuery(req) };
        if (search) {
            query.$or = [
                { kode: { $regex: search, $options: "i" } },
                { nama: { $regex: search, $options: "i" } },
                { gudang: { $regex: search, $options: "i" } },
                { kategori: { $regex: search, $options: "i" } }
            ];
        }

        const all = await Barang.find(query)
            .select("kode nama satuan gudang kategori rak stok stok_minimum harga_beli harga_jual")
            .sort({ nama: 1 })
            .lean();

        // Hitung nilai
        const enriched = all.map(b => ({
            ...b,
            nilaiBeli: Math.round(((b.harga_beli || 0) * (b.stok || 0)) * 100) / 100,
            nilaiJual: Math.round(((b.harga_jual || 0) * (b.stok || 0)) * 100) / 100,
            statusStok: (b.stok || 0) === 0 ? "habis" : ((b.stok || 0) <= (b.stok_minimum || 0) ? "menipis" : "aman")
        }));

        // Sort
        if (sort === "nilai") enriched.sort((a, b) => b.nilaiBeli - a.nilaiBeli);
        else if (sort === "stok") enriched.sort((a, b) => (a.stok || 0) - (b.stok || 0));
        else enriched.sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));

        const total = enriched.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = enriched.slice((page - 1) * limit, page * limit);

        const summary = {
            totalBarang: total,
            totalStok: enriched.reduce((s, b) => s + (b.stok || 0), 0),
            totalNilaiBeli: enriched.reduce((s, b) => s + b.nilaiBeli, 0),
            totalNilaiJual: enriched.reduce((s, b) => s + b.nilaiJual, 0),
            habis: enriched.filter(b => b.statusStok === "habis").length,
            menipis: enriched.filter(b => b.statusStok === "menipis").length
        };

        res.json({ data, summary, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /purchase — Laporan Pembelian.
 * Query: startDate, endDate, search (nomor/supplier), page, limit
 */
router.get("/purchase", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });

        const query = { ...companyQuery(req), ...dateQ };
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { supplierName: { $regex: search, $options: "i" } },
                { supplier: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const all = await Pembelian.find(query)
            .select("nomor tanggal supplier supplierName items total diskon grandTotal status createdBy")
            .sort({ tanggal: -1 })
            .lean();

        const total = all.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = all.slice((page - 1) * limit, page * limit);

        const summary = {
            totalTransaksi: total,
            totalItem: all.reduce((s, p) => s + (p.items || []).reduce((si, i) => si + (i.qty || 0), 0), 0),
            totalPembelian: all.reduce((s, p) => s + (p.grandTotal || 0), 0)
        };

        res.json({ data, summary, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /sales — Laporan Penjualan.
 * Query: startDate, endDate, search (nomor/pelanggan), page, limit
 */
router.get("/sales", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });

        const query = { ...companyQuery(req), ...dateQ };
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { pelangganNama: { $regex: search, $options: "i" } },
                { pelanggan: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const all = await Penjualan.find(query)
            .select("nomor tanggal pelanggan pelangganNama items total diskon grandTotal status createdBy")
            .sort({ tanggal: -1 })
            .lean();

        const total = all.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = all.slice((page - 1) * limit, page * limit);

        const summary = {
            totalTransaksi: total,
            totalItem: all.reduce((s, p) => s + (p.items || []).reduce((si, i) => si + (i.qty || 0), 0), 0),
            totalPenjualan: all.reduce((s, p) => s + (p.grandTotal || 0), 0)
        };

        res.json({ data, summary, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /inventory-value — Nilai Inventori.
 * Total nilai beli/jual + breakdown by gudang & kategori.
 */
router.get("/inventory-value", async (req, res) => {
    try {
        const query = { status: { $ne: "archived" }, ...companyQuery(req) };
        const all = await Barang.find(query)
            .select("kode nama gudang kategori stok harga_beli harga_jual")
            .lean();

        const enriched = all.map(b => ({
            ...b,
            nilaiBeli: Math.round(((b.harga_beli || 0) * (b.stok || 0)) * 100) / 100,
            nilaiJual: Math.round(((b.harga_jual || 0) * (b.stok || 0)) * 100) / 100
        }));

        const totalNilaiBeli = enriched.reduce((s, b) => s + b.nilaiBeli, 0);
        const totalNilaiJual = enriched.reduce((s, b) => s + b.nilaiJual, 0);

        // By gudang
        const byWarehouse = {};
        for (const b of enriched) {
            const g = b.gudang || "Tanpa Gudang";
            if (!byWarehouse[g]) byWarehouse[g] = { gudang: g, jumlahBarang: 0, totalStok: 0, nilaiBeli: 0, nilaiJual: 0 };
            byWarehouse[g].jumlahBarang++;
            byWarehouse[g].totalStok += b.stok || 0;
            byWarehouse[g].nilaiBeli += b.nilaiBeli;
            byWarehouse[g].nilaiJual += b.nilaiJual;
        }

        // By kategori
        const byKategori = {};
        for (const b of enriched) {
            const k = b.kategori || "Tanpa Kategori";
            if (!byKategori[k]) byKategori[k] = { kategori: k, jumlahBarang: 0, totalStok: 0, nilaiBeli: 0, nilaiJual: 0 };
            byKategori[k].jumlahBarang++;
            byKategori[k].totalStok += b.stok || 0;
            byKategori[k].nilaiBeli += b.nilaiBeli;
            byKategori[k].nilaiJual += b.nilaiJual;
        }

        res.json({
            totalNilaiBeli,
            totalNilaiJual,
            totalBarang: enriched.length,
            totalStok: enriched.reduce((s, b) => s + (b.stok || 0), 0),
            byWarehouse: Object.values(byWarehouse).sort((a, b) => b.nilaiBeli - a.nilaiBeli),
            byKategori: Object.values(byKategori).sort((a, b) => b.nilaiBeli - a.nilaiBeli)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /mutation — Mutasi Stok.
 * Menggabungkan: Pembelian (masuk), Penjualan (keluar), Transfer (pindah),
 * Retur Pembelian (keluar), Retur Penjualan (masuk), Opname (penyesuaian).
 * Query: startDate, endDate, page, limit
 */
router.get("/mutation", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });
        const base = { ...companyQuery(req), ...dateQ };

        // Status yang memengaruhi stok
        const [pembelian, penjualan, transfer, returPembelian, returPenjualan, opname] = await Promise.all([
            Pembelian.find({ ...base, status: "received" }).select("nomor tanggal supplierName items grandTotal").lean(),
            Penjualan.find({ ...base, status: { $in: ["delivered", "invoiced", "paid"] } }).select("nomor tanggal pelangganNama items grandTotal").lean(),
            Transfer.find({ ...base, status: "transferred" }).select("nomor tanggal gudangAsalNama gudangTujuanNama items").lean(),
            ReturPembelian.find({ ...base, status: "returned" }).select("nomor tanggal supplierName items total").lean(),
            ReturPenjualan.find({ ...base, status: "returned" }).select("nomor tanggal pelangganNama items total").lean(),
            StockOpname.find({ ...base, status: "completed" }).select("nomor tanggal gudangNama items totalSelisih completedAt").lean()
        ]);

        const movements = [];

        for (const p of pembelian) {
            const qty = (p.items || []).reduce((s, i) => s + (i.qty || 0), 0);
            movements.push({
                tanggal: p.tanggal, nomor: p.nomor, type: "masuk", label: "Pembelian",
                ref: p.supplierName || "-", qty, total: p.grandTotal || 0, icon: "🛒"
            });
        }
        for (const p of penjualan) {
            const qty = (p.items || []).reduce((s, i) => s + (i.qty || 0), 0);
            movements.push({
                tanggal: p.tanggal, nomor: p.nomor, type: "keluar", label: "Penjualan",
                ref: p.pelangganNama || "-", qty, total: p.grandTotal || 0, icon: "💰"
            });
        }
        for (const t of transfer) {
            const qty = (t.items || []).reduce((s, i) => s + (i.qty || 0), 0);
            movements.push({
                tanggal: t.tanggal, nomor: t.nomor, type: "pindah", label: "Transfer",
                ref: `${t.gudangAsalNama || t.gudangAsal || "-"} → ${t.gudangTujuanNama || t.gudangTujuan || "-"}`,
                qty, total: 0, icon: "🚚"
            });
        }
        for (const r of returPembelian) {
            const qty = (r.items || []).reduce((s, i) => s + (i.qty || 0), 0);
            movements.push({
                tanggal: r.tanggal, nomor: r.nomor, type: "keluar", label: "Retur Pembelian",
                ref: r.supplierName || "-", qty, total: r.total || 0, icon: "↩️"
            });
        }
        for (const r of returPenjualan) {
            const qty = (r.items || []).reduce((s, i) => s + (i.qty || 0), 0);
            movements.push({
                tanggal: r.tanggal, nomor: r.nomor, type: "masuk", label: "Retur Penjualan",
                ref: r.pelangganNama || "-", qty, total: r.total || 0, icon: "🔁"
            });
        }
        for (const o of opname) {
            const qty = Math.abs(o.totalSelisih || 0);
            movements.push({
                tanggal: o.tanggal, nomor: o.nomor, type: "penyesuaian", label: "Stock Opname",
                ref: o.gudangNama || o.gudang || "-", qty, total: 0,
                icon: o.totalSelisih >= 0 ? "📈" : "📉"
            });
        }

        movements.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        const total = movements.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = movements.slice((page - 1) * limit, page * limit);

        const summary = {
            totalMutasi: total,
            totalMasuk: movements.filter(m => m.type === "masuk").reduce((s, m) => s + m.qty, 0),
            totalKeluar: movements.filter(m => m.type === "keluar").reduce((s, m) => s + m.qty, 0),
            totalPindah: movements.filter(m => m.type === "pindah").reduce((s, m) => s + m.qty, 0)
        };

        res.json({ data, summary, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /supplier — Laporan Supplier.
 * Jumlah PO + total pembelian per supplier (dari dokumen Pembelian).
 * Query: startDate, endDate, search, page, limit
 */
router.get("/supplier", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });

        const base = { ...companyQuery(req), ...dateQ };
        const allPO = await Pembelian.find(base)
            .select("supplier supplierName grandTotal status")
            .lean();

        const map = {};
        for (const po of allPO) {
            const key = po.supplier || po.supplierName || "-";
            if (!map[key]) map[key] = { supplier: key, nama: po.supplierName || po.supplier || "-", jumlahPO: 0, totalPembelian: 0, statuses: {} };
            map[key].jumlahPO++;
            map[key].totalPembelian += po.grandTotal || 0;
            map[key].statuses[po.status || "draft"] = (map[key].statuses[po.status || "draft"] || 0) + 1;
        }

        // Ambil info master supplier (kontak)
        const masterSuppliers = await Supplier.find(companyQuery(req)).select("kode nama kontak telepon email alamat").lean();
        for (const s of masterSuppliers) {
            if (!map[s.kode] && !map[s.nama]) {
                map[s.kode] = { supplier: s.kode, nama: s.nama, jumlahPO: 0, totalPembelian: 0, kontak: s.kontak || "", telepon: s.telepon || "", email: s.email || "", alamat: s.alamat || "", statuses: {} };
            }
        }
        // Merge kontak ke supplier yang punya PO
        for (const s of masterSuppliers) {
            const entry = map[s.kode] || map[s.nama];
            if (entry) {
                entry.kontak = entry.kontak || s.kontak || "";
                entry.telepon = entry.telepon || s.telepon || "";
                entry.email = entry.email || s.email || "";
                entry.alamat = entry.alamat || s.alamat || "";
            }
        }

        let list = Object.values(map);
        if (search) {
            list = list.filter(x =>
                String(x.supplier).toLowerCase().includes(search) ||
                String(x.nama).toLowerCase().includes(search)
            );
        }
        list.sort((a, b) => b.totalPembelian - a.totalPembelian);

        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = list.slice((page - 1) * limit, page * limit);

        res.json({
            data,
            summary: {
                totalSupplier: list.filter(x => x.jumlahPO > 0).length,
                totalPO: list.reduce((s, x) => s + x.jumlahPO, 0),
                totalPembelian: list.reduce((s, x) => s + x.totalPembelian, 0)
            },
            pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /customer — Laporan Pelanggan.
 * Jumlah SO + total penjualan per pelanggan (dari dokumen Penjualan).
 * Query: startDate, endDate, search, page, limit
 */
router.get("/customer", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });

        const base = { ...companyQuery(req), ...dateQ };
        const allSO = await Penjualan.find(base)
            .select("pelanggan pelangganNama grandTotal status")
            .lean();

        const map = {};
        for (const so of allSO) {
            const key = so.pelanggan || so.pelangganNama || "-";
            if (!map[key]) map[key] = { pelanggan: key, nama: so.pelangganNama || so.pelanggan || "-", jumlahSO: 0, totalPenjualan: 0, statuses: {} };
            map[key].jumlahSO++;
            map[key].totalPenjualan += so.grandTotal || 0;
            map[key].statuses[so.status || "order"] = (map[key].statuses[so.status || "order"] || 0) + 1;
        }

        // Ambil info master customer
        const masterCustomers = await Customer.find(companyQuery(req)).select("kode nama kontak telepon email alamat").lean();
        for (const c of masterCustomers) {
            if (!map[c.kode] && !map[c.nama]) {
                map[c.kode] = { pelanggan: c.kode, nama: c.nama, jumlahSO: 0, totalPenjualan: 0, kontak: c.kontak || "", telepon: c.telepon || "", email: c.email || "", alamat: c.alamat || "", statuses: {} };
            }
        }
        for (const c of masterCustomers) {
            const entry = map[c.kode] || map[c.nama];
            if (entry) {
                entry.kontak = entry.kontak || c.kontak || "";
                entry.telepon = entry.telepon || c.telepon || "";
                entry.email = entry.email || c.email || "";
                entry.alamat = entry.alamat || c.alamat || "";
            }
        }

        let list = Object.values(map);
        if (search) {
            list = list.filter(x =>
                String(x.pelanggan).toLowerCase().includes(search) ||
                String(x.nama).toLowerCase().includes(search)
            );
        }
        list.sort((a, b) => b.totalPenjualan - a.totalPenjualan);

        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = list.slice((page - 1) * limit, page * limit);

        res.json({
            data,
            summary: {
                totalCustomer: list.filter(x => x.jumlahSO > 0).length,
                totalSO: list.reduce((s, x) => s + x.jumlahSO, 0),
                totalPenjualan: list.reduce((s, x) => s + x.totalPenjualan, 0)
            },
            pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /labarugi — Laporan Laba-Rugi (Profit & Loss).
 *
 * Nilai Penjualan (SO delivered/invoiced/paid), Harga Pokok (qty × harga_beli
 * dari master barang), Laba Kotor = Penjualan − HPP.
 *
 * Query: startDate, endDate, search, mode (detail|rekap), page, limit
 *  - mode=detail → data = per SO (paginated)
 *  - mode=rekap  → data = rekap per bulan
 * Response selalu menyertakan `rekapBulan` (array rekap per bulan).
 */
router.get("/labarugi", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const mode = req.query.mode === "rekap" ? "rekap" : "detail";
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });

        const query = { ...companyQuery(req), ...dateQ, status: { $in: ["delivered", "invoiced", "paid"] } };
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { pelangganNama: { $regex: search, $options: "i" } },
                { pelanggan: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const all = await Penjualan.find(query)
            .select("nomor tanggal pelanggan pelangganNama items grandTotal status")
            .sort({ tanggal: -1 })
            .lean();

        // Map kode barang → harga beli (untuk menghitung HPP)
        const allBarang = await Barang.find(companyQuery(req)).select("kode harga_beli").lean();
        const hargaBeliMap = {};
        for (const b of allBarang) hargaBeliMap[b.kode] = b.harga_beli || 0;

        const enriched = all.map(s => {
            let hpp = 0;
            for (const it of (s.items || [])) {
                hpp += (it.qty || 0) * (hargaBeliMap[it.kode] || 0);
            }
            hpp = Math.round(hpp * 100) / 100;
            const nilaiPenjualan = s.grandTotal || 0;
            const labaKotor = Math.round((nilaiPenjualan - hpp) * 100) / 100;
            return { ...s, hpp, nilaiPenjualan, labaKotor };
        });

        // Rekap per bulan
        const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const rekapMap = {};
        for (const r of enriched) {
            const d = new Date(r.tanggal);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!rekapMap[key]) rekapMap[key] = { bulan: key, label: `${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`, jumlahSO: 0, penjualan: 0, hpp: 0, laba: 0 };
            rekapMap[key].jumlahSO++;
            rekapMap[key].penjualan += r.nilaiPenjualan;
            rekapMap[key].hpp += r.hpp;
            rekapMap[key].laba += r.labaKotor;
        }
        const rekapBulan = Object.values(rekapMap)
            .map(b => ({ ...b, penjualan: Math.round(b.penjualan * 100) / 100, hpp: Math.round(b.hpp * 100) / 100, laba: Math.round(b.laba * 100) / 100 }))
            .sort((a, b) => String(b.bulan).localeCompare(String(a.bulan)));

        const summary = {
            totalTransaksi: enriched.length,
            totalPenjualan: Math.round(enriched.reduce((s, r) => s + r.nilaiPenjualan, 0) * 100) / 100,
            totalHPP: Math.round(enriched.reduce((s, r) => s + r.hpp, 0) * 100) / 100,
            totalLabaKotor: Math.round(enriched.reduce((s, r) => s + r.labaKotor, 0) * 100) / 100,
            margin: enriched.reduce((s, r) => s + r.nilaiPenjualan, 0) > 0
                ? Math.round((enriched.reduce((s, r) => s + r.labaKotor, 0) / enriched.reduce((s, r) => s + r.nilaiPenjualan, 0)) * 1000) / 10
                : 0
        };

        if (mode === "rekap") {
            const total = rekapBulan.length;
            res.json({
                data: rekapBulan,
                summary,
                rekapBulan,
                pagination: { page: 1, limit, total, totalPages: 1 }
            });
            return;
        }

        const total = enriched.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = enriched.slice((page - 1) * limit, page * limit);

        res.json({ data, summary, rekapBulan, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /piutang — Laporan Piutang (Accounts Receivable).
 *
 * Penjualan yang BELUM lunas (status delivered/invoiced) + status overduenya.
 * Jatuh tempo = tanggal invoice (atau tanggal SJ/SO) + termDays (default 30 hari).
 *
 * Query: startDate, endDate, search, termDays, page, limit
 */
router.get("/piutang", async (req, res) => {
    try {
        const { page, limit } = paginateParams(req);
        const search = (req.query.search || "").toLowerCase().trim();
        const termDays = parseInt(req.query.termDays, 10);
        const term = (!isNaN(termDays) && termDays >= 0) ? termDays : 30;
        const dateQ = dateRangeQuery(req);
        if (dateQ === null) return res.status(400).json({ error: "Format tanggal tidak valid" });

        const query = { ...companyQuery(req), ...dateQ, status: { $in: ["delivered", "invoiced"] } };
        if (search) {
            query.$or = [
                { nomor: { $regex: search, $options: "i" } },
                { pelangganNama: { $regex: search, $options: "i" } },
                { pelanggan: { $regex: search, $options: "i" } },
                { status: { $regex: search, $options: "i" } }
            ];
        }

        const all = await Penjualan.find(query)
            .select("nomor tanggal pelanggan pelangganNama grandTotal status tanggalSJ tanggalInvoice")
            .sort({ tanggal: -1 })
            .lean();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const enriched = all.map(s => {
            const dueBase = s.tanggalInvoice || s.tanggalSJ || s.tanggal || new Date();
            const due = new Date(dueBase);
            due.setDate(due.getDate() + term);
            due.setHours(23, 59, 59, 999);
            const overdue = due.getTime() < today.getTime();
            const sisaHari = Math.ceil((due.getTime() - today.getTime()) / 86400000);
            return {
                ...s,
                jatuhTempo: due,
                overdue,
                sisaHari,
                sisaHariLabel: overdue
                    ? `${Math.abs(sisaHari)} hari lewat`
                    : (sisaHari === 0 ? "Hari ini" : `${sisaHari} hari lagi`)
            };
        });

        const totalPiutang = enriched.reduce((s, x) => s + (x.grandTotal || 0), 0);
        const totalOverdue = enriched.filter(x => x.overdue).reduce((s, x) => s + (x.grandTotal || 0), 0);
        const summary = {
            totalTransaksi: enriched.length,
            totalPiutang: Math.round(totalPiutang * 100) / 100,
            totalBelumJatuhTempo: Math.round((totalPiutang - totalOverdue) * 100) / 100,
            totalOverdue: Math.round(totalOverdue * 100) / 100,
            jumlahOverdue: enriched.filter(x => x.overdue).length
        };

        const total = enriched.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const data = enriched.slice((page - 1) * limit, page * limit);

        res.json({ data, summary, pagination: { page: Math.min(page, totalPages), limit, total, totalPages }, termDays: term });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /sales-breakdown — Laporan Penjualan POS terperinci (PRD V1 §13).
 *
 * Menghasilkan breakdown transaksi sumber=pos (paid, non-void):
 *   - byItem     : per item barang (qty, omzet)
 *   - byCategory : per kategori item
 *   - byCashier  : per kasir
 *   - byPayment  : per metode bayar (cash/transfer/qris/card)
 *
 * Query: startDate, endDate (default: hari ini).
 */
router.get("/sales-breakdown", async (req, res) => {
    try {
        const companyCode = req.headers["x-company-code"];
        const startDate = isBlankDateValue(req.query.startDate)
            ? new Date(new Date().setHours(0, 0, 0, 0))
            : new Date(req.query.startDate);
        const endDate = isBlankDateValue(req.query.endDate)
            ? new Date()
            : new Date(req.query.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: "Format tanggal tidak valid" });
        }
        endDate.setHours(23, 59, 59, 999);

        const base = {
            ...(companyCode ? { companyCode } : {}),
            sumber: "pos",
            status: "paid",
            tanggal: { $gte: startDate, $lte: endDate }
        };

        const txns = await Penjualan.find(base)
            .select("kasir metode_bayar items grandTotal pajak diskon")
            .lean();

        // ── Per kasir ──
        const byCashier = {};
        // ── Per metode bayar ──
        const byPayment = {};
        // ── Per item ──
        const byItem = {};
        // ── Per kategori (item → Barang.kategori) ──
        const kodes = new Set();
        for (const t of txns) for (const it of (t.items || [])) if (it.kode) kodes.add(it.kode);
        const barangs = kodes.size
            ? await Barang.find({ ...(companyCode ? { companyCode } : {}), kode: { $in: [...kodes] } }).select("kode kategori behavior").lean()
            : [];
        const kategoriMap = {};
        for (const b of barangs) kategoriMap[b.kode] = b.kategori || "Tanpa Kategori";

        let totalPenjualan = 0;
        let totalTransaksi = 0;
        let totalPajak = 0;
        for (const t of txns) {
            totalPenjualan += t.grandTotal || 0;
            totalTransaksi += 1;
            totalPajak += t.pajak || 0;

            const kasir = t.kasir || "-";
            if (!byCashier[kasir]) byCashier[kasir] = { kasir, jumlah: 0, omzet: 0 };
            byCashier[kasir].jumlah += 1;
            byCashier[kasir].omzet += t.grandTotal || 0;

            const metode = t.metode_bayar || "cash";
            if (!byPayment[metode]) byPayment[metode] = { metode, label: PAYMENT_LABELS[metode] || metode, jumlah: 0, omzet: 0 };
            byPayment[metode].jumlah += 1;
            byPayment[metode].omzet += t.grandTotal || 0;

            for (const it of (t.items || [])) {
                const key = it.kode || it.nama;
                if (!byItem[key]) byItem[key] = { kode: it.kode || "", nama: it.nama || "", kategori: kategoriMap[it.kode] || "Tanpa Kategori", qty: 0, omzet: 0 };
                byItem[key].qty += it.qty || 0;
                byItem[key].omzet += it.subtotal || 0;
            }
        }

        // ── Per kategori ──
        const byCategory = {};
        for (const it of Object.values(byItem)) {
            const k = it.kategori;
            if (!byCategory[k]) byCategory[k] = { kategori: k, qty: 0, omzet: 0 };
            byCategory[k].qty += it.qty;
            byCategory[k].omzet += it.omzet;
        }

        const round2 = v => Math.round(v * 100) / 100;
        const sortOmzet = arr => arr.sort((a, b) => b.omzet - a.omzet);

        res.json({
            summary: {
                totalTransaksi,
                totalPenjualan: round2(totalPenjualan),
                totalPajak: round2(totalPajak)
            },
            byItem: sortOmzet(Object.values(byItem).map(x => ({ ...x, omzet: round2(x.omzet) }))),
            byCategory: sortOmzet(Object.values(byCategory).map(x => ({ ...x, omzet: round2(x.omzet) }))),
            byCashier: sortOmzet(Object.values(byCashier).map(x => ({ ...x, omzet: round2(x.omzet) }))),
            byPayment: sortOmzet(Object.values(byPayment).map(x => ({ ...x, omzet: round2(x.omzet) })))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Label metode pembayaran (PRD V1 §13.2).
const PAYMENT_LABELS = {
    cash: "Tunai",
    transfer: "Transfer",
    qris: "QRIS",
    card: "Kartu"
};

export default router;
