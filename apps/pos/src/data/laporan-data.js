/**
 * Laporan Data Service — Reporting (Sprint 8).
 *
 * Strategy: API-first via apiCall, fallback ke komputasi lokal dari
 * data service yang SAMA dengan halaman transaksi (Barang, Pembelian, dsb).
 *
 * @module inventory/data/laporan-data
 */

import { apiCall } from "./api.js";

// ═══════════════════════════════════════════════
//  Local fallback helpers
// ═══════════════════════════════════════════════

/**
 * Build query string, membuang nilai null/undefined/empty — tanpa ini
 * URLSearchParams mengubah `undefined` jadi string "undefined" di URL dan
 * server menolaknya (400 "Format tanggal tidak valid").
 * @param {object} [params={}]
 * @returns {string}
 */
function buildQueryString(params = {}) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        qs.set(key, value);
    }
    return qs.toString();
}

async function fetchAll(service, params = {}) {
    try {
        const result = await service({ page: 1, limit: 9999, ...params });
        return result?.data || [];
    } catch {
        return [];
    }
}

function fmt2(n) {
    return Math.round((n || 0) * 100) / 100;
}

function slicePage(list, page, limit) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = list.slice((page - 1) * limit, page * limit);
    return {
        data,
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

function inDateRange(dateStr, startDate, endDate) {
    if (!startDate && !endDate) return true;
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return true;
    if (startDate && d < new Date(startDate).getTime()) return false;
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (d > end.getTime()) return false;
    }
    return true;
}

// ═══════════════════════════════════════════════
//  Laporan Stok
// ═══════════════════════════════════════════════

function computeStockLocal(allBarang, params = {}) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const search = (params.search || "").toLowerCase().trim();
    const sort = params.sort || "nama";

    let enriched = allBarang.map(b => ({
        ...b,
        nilaiBeli: fmt2((b.harga_beli || 0) * (b.stok || 0)),
        nilaiJual: fmt2((b.harga_jual || 0) * (b.stok || 0)),
        statusStok: (b.stok || 0) === 0 ? "habis" : ((b.stok || 0) <= (b.stok_minimum || 0) ? "menipis" : "aman")
    }));

    if (search) {
        enriched = enriched.filter(b =>
            String(b.kode || "").toLowerCase().includes(search) ||
            String(b.nama || "").toLowerCase().includes(search) ||
            String(b.gudang || "").toLowerCase().includes(search) ||
            String(b.kategori || "").toLowerCase().includes(search)
        );
    }

    if (sort === "nilai") enriched.sort((a, b) => b.nilaiBeli - a.nilaiBeli);
    else if (sort === "stok") enriched.sort((a, b) => (a.stok || 0) - (b.stok || 0));
    else enriched.sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));

    const summary = {
        totalBarang: enriched.length,
        totalStok: enriched.reduce((s, b) => s + (b.stok || 0), 0),
        totalNilaiBeli: enriched.reduce((s, b) => s + b.nilaiBeli, 0),
        totalNilaiJual: enriched.reduce((s, b) => s + b.nilaiJual, 0),
        habis: enriched.filter(b => b.statusStok === "habis").length,
        menipis: enriched.filter(b => b.statusStok === "menipis").length
    };

    return { ...slicePage(enriched, page, limit), summary };
}

export async function getLaporanStock(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/stock?${query}`);
        if (result !== null) return result;
    } catch {}
    const { listBarang } = await import("./barang-data.js");
    const allBarang = await fetchAll(listBarang);
    return computeStockLocal(allBarang, params);
}

// ═══════════════════════════════════════════════
//  Laporan Pembelian & Penjualan
// ═══════════════════════════════════════════════

export async function getLaporanPurchase(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/purchase?${query}`);
        if (result !== null) return result;
    } catch {}
    const { listPembelian } = await import("./pembelian-data.js");
    const all = await fetchAll(listPembelian);
    const { startDate, endDate } = params;
    let filtered = all.filter(p => inDateRange(p.tanggal, startDate, endDate));

    const search = (params.search || "").toLowerCase().trim();
    if (search) {
        filtered = filtered.filter(p =>
            String(p.nomor || "").toLowerCase().includes(search) ||
            String(p.supplierName || "").toLowerCase().includes(search) ||
            String(p.supplier || "").toLowerCase().includes(search) ||
            String(p.status || "").toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const summary = {
        totalTransaksi: filtered.length,
        totalItem: filtered.reduce((s, p) => s + (p.items || []).reduce((si, i) => si + (i.qty || 0), 0), 0),
        totalPembelian: filtered.reduce((s, p) => s + (p.grandTotal || 0), 0)
    };

    return { ...slicePage(filtered, params.page || 1, params.limit || 20), summary };
}

export async function getLaporanSales(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/sales?${query}`);
        if (result !== null) return result;
    } catch {}
    const { listPenjualan } = await import("./penjualan-data.js");
    const all = await fetchAll(listPenjualan);
    const { startDate, endDate } = params;
    let filtered = all.filter(p => inDateRange(p.tanggal, startDate, endDate));

    const search = (params.search || "").toLowerCase().trim();
    if (search) {
        filtered = filtered.filter(p =>
            String(p.nomor || "").toLowerCase().includes(search) ||
            String(p.pelangganNama || "").toLowerCase().includes(search) ||
            String(p.pelanggan || "").toLowerCase().includes(search) ||
            String(p.status || "").toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const summary = {
        totalTransaksi: filtered.length,
        totalItem: filtered.reduce((s, p) => s + (p.items || []).reduce((si, i) => si + (i.qty || 0), 0), 0),
        totalPenjualan: filtered.reduce((s, p) => s + (p.grandTotal || 0), 0)
    };

    return { ...slicePage(filtered, params.page || 1, params.limit || 20), summary };
}

// ═══════════════════════════════════════════════
//  Laporan Nilai Inventori
// ═══════════════════════════════════════════════

function computeInventoryValueLocal(allBarang) {
    const enriched = allBarang.map(b => ({
        ...b,
        nilaiBeli: fmt2((b.harga_beli || 0) * (b.stok || 0)),
        nilaiJual: fmt2((b.harga_jual || 0) * (b.stok || 0))
    }));

    const totalNilaiBeli = enriched.reduce((s, b) => s + b.nilaiBeli, 0);
    const totalNilaiJual = enriched.reduce((s, b) => s + b.nilaiJual, 0);

    const byWarehouse = {};
    for (const b of enriched) {
        const g = b.gudang || "Tanpa Gudang";
        if (!byWarehouse[g]) byWarehouse[g] = { gudang: g, jumlahBarang: 0, totalStok: 0, nilaiBeli: 0, nilaiJual: 0 };
        byWarehouse[g].jumlahBarang++;
        byWarehouse[g].totalStok += b.stok || 0;
        byWarehouse[g].nilaiBeli += b.nilaiBeli;
        byWarehouse[g].nilaiJual += b.nilaiJual;
    }

    const byKategori = {};
    for (const b of enriched) {
        const k = b.kategori || "Tanpa Kategori";
        if (!byKategori[k]) byKategori[k] = { kategori: k, jumlahBarang: 0, totalStok: 0, nilaiBeli: 0, nilaiJual: 0 };
        byKategori[k].jumlahBarang++;
        byKategori[k].totalStok += b.stok || 0;
        byKategori[k].nilaiBeli += b.nilaiBeli;
        byKategori[k].nilaiJual += b.nilaiJual;
    }

    return {
        totalNilaiBeli,
        totalNilaiJual,
        totalBarang: enriched.length,
        totalStok: enriched.reduce((s, b) => s + (b.stok || 0), 0),
        byWarehouse: Object.values(byWarehouse).sort((a, b) => b.nilaiBeli - a.nilaiBeli),
        byKategori: Object.values(byKategori).sort((a, b) => b.nilaiBeli - a.nilaiBeli)
    };
}

export async function getInventoryValueReport() {
    try {
        const result = await apiCall("GET", "/laporan/inventory-value");
        if (result !== null) return result;
    } catch {}
    const { listBarang } = await import("./barang-data.js");
    const allBarang = await fetchAll(listBarang);
    return computeInventoryValueLocal(allBarang);
}

// ═══════════════════════════════════════════════
//  Laporan Mutasi Stok
// ═══════════════════════════════════════════════

export async function getStockMutationReport(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/mutation?${query}`);
        if (result !== null) return result;
    } catch {}

    const { startDate, endDate } = params;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const movements = [];

    try {
        const { listPembelian } = await import("./pembelian-data.js");
        const { listPenjualan } = await import("./penjualan-data.js");
        const { listTransfer } = await import("./transfer-data.js");
        const { listReturPembelian } = await import("./retur-pembelian-data.js");
        const { listReturPenjualan } = await import("./retur-penjualan-data.js");
        const { listStockOpname } = await import("./stock-opname-data.js");

        const [beli, jual, transfer, returBeli, returJual, opname] = await Promise.all([
            fetchAll(listPembelian), fetchAll(listPenjualan), fetchAll(listTransfer),
            fetchAll(listReturPembelian), fetchAll(listReturPenjualan), fetchAll(listStockOpname)
        ]);

        for (const p of beli) {
            if (p.status !== "received" || !inDateRange(p.tanggal, startDate, endDate)) continue;
            movements.push({
                tanggal: p.tanggal, nomor: p.nomor, type: "masuk", label: "Pembelian",
                ref: p.supplierName || "-", qty: (p.items || []).reduce((s, i) => s + (i.qty || 0), 0),
                total: p.grandTotal || 0, icon: "🛒"
            });
        }
        for (const p of jual) {
            if (!["delivered", "invoiced", "paid"].includes(p.status) || !inDateRange(p.tanggal, startDate, endDate)) continue;
            movements.push({
                tanggal: p.tanggal, nomor: p.nomor, type: "keluar", label: "Penjualan",
                ref: p.pelangganNama || "-", qty: (p.items || []).reduce((s, i) => s + (i.qty || 0), 0),
                total: p.grandTotal || 0, icon: "💰"
            });
        }
        for (const t of transfer) {
            if (t.status !== "transferred" || !inDateRange(t.tanggal, startDate, endDate)) continue;
            movements.push({
                tanggal: t.tanggal, nomor: t.nomor, type: "pindah", label: "Transfer",
                ref: `${t.gudangAsalNama || t.gudangAsal || "-"} → ${t.gudangTujuanNama || t.gudangTujuan || "-"}`,
                qty: (t.items || []).reduce((s, i) => s + (i.qty || 0), 0), total: 0, icon: "🚚"
            });
        }
        for (const r of returBeli) {
            if (r.status !== "returned" || !inDateRange(r.tanggal, startDate, endDate)) continue;
            movements.push({
                tanggal: r.tanggal, nomor: r.nomor, type: "keluar", label: "Retur Pembelian",
                ref: r.supplierName || "-", qty: (r.items || []).reduce((s, i) => s + (i.qty || 0), 0),
                total: r.total || 0, icon: "↩️"
            });
        }
        for (const r of returJual) {
            if (r.status !== "returned" || !inDateRange(r.tanggal, startDate, endDate)) continue;
            movements.push({
                tanggal: r.tanggal, nomor: r.nomor, type: "masuk", label: "Retur Penjualan",
                ref: r.pelangganNama || "-", qty: (r.items || []).reduce((s, i) => s + (i.qty || 0), 0),
                total: r.total || 0, icon: "🔁"
            });
        }
        for (const o of opname) {
            if (o.status !== "completed" || !inDateRange(o.tanggal, startDate, endDate)) continue;
            movements.push({
                tanggal: o.tanggal, nomor: o.nomor, type: "penyesuaian", label: "Stock Opname",
                ref: o.gudangNama || o.gudang || "-", qty: Math.abs(o.totalSelisih || 0), total: 0,
                icon: (o.totalSelisih || 0) >= 0 ? "📈" : "📉"
            });
        }
    } catch {}

    movements.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const summary = {
        totalMutasi: movements.length,
        totalMasuk: movements.filter(m => m.type === "masuk").reduce((s, m) => s + m.qty, 0),
        totalKeluar: movements.filter(m => m.type === "keluar").reduce((s, m) => s + m.qty, 0),
        totalPindah: movements.filter(m => m.type === "pindah").reduce((s, m) => s + m.qty, 0)
    };

    return { ...slicePage(movements, page, limit), summary };
}

// ═══════════════════════════════════════════════
//  Laporan Supplier & Customer
// ═══════════════════════════════════════════════

export async function getSupplierReport(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/supplier?${query}`);
        if (result !== null) return result;
    } catch {}

    const { listPembelian } = await import("./pembelian-data.js");
    const { listSupplier } = await import("./supplier-data.js");
    const { startDate, endDate } = params;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const search = (params.search || "").toLowerCase().trim();

    const [allPO, masters] = await Promise.all([fetchAll(listPembelian), fetchAll(listSupplier)]);

    const map = {};
    for (const po of allPO) {
        if (!inDateRange(po.tanggal, startDate, endDate)) continue;
        const key = po.supplier || po.supplierName || "-";
        if (!map[key]) map[key] = { supplier: key, nama: po.supplierName || po.supplier || "-", jumlahPO: 0, totalPembelian: 0, statuses: {} };
        map[key].jumlahPO++;
        map[key].totalPembelian += po.grandTotal || 0;
        map[key].statuses[po.status || "draft"] = (map[key].statuses[po.status || "draft"] || 0) + 1;
    }

    for (const s of masters) {
        if (!map[s.kode] && !map[s.nama]) {
            map[s.kode] = { supplier: s.kode, nama: s.nama, jumlahPO: 0, totalPembelian: 0, kontak: s.kontak || "", telepon: s.telepon || "", email: s.email || "", alamat: s.alamat || "", statuses: {} };
        }
    }
    for (const s of masters) {
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

    const summary = {
        totalSupplier: list.filter(x => x.jumlahPO > 0).length,
        totalPO: list.reduce((s, x) => s + x.jumlahPO, 0),
        totalPembelian: list.reduce((s, x) => s + x.totalPembelian, 0)
    };

    return { ...slicePage(list, page, limit), summary };
}

export async function getCustomerReport(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/customer?${query}`);
        if (result !== null) return result;
    } catch {}

    const { listPenjualan } = await import("./penjualan-data.js");
    const { listCustomer } = await import("./customer-data.js");
    const { startDate, endDate } = params;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const search = (params.search || "").toLowerCase().trim();

    const [allSO, masters] = await Promise.all([fetchAll(listPenjualan), fetchAll(listCustomer)]);

    const map = {};
    for (const so of allSO) {
        if (!inDateRange(so.tanggal, startDate, endDate)) continue;
        const key = so.pelanggan || so.pelangganNama || "-";
        if (!map[key]) map[key] = { pelanggan: key, nama: so.pelangganNama || so.pelanggan || "-", jumlahSO: 0, totalPenjualan: 0, statuses: {} };
        map[key].jumlahSO++;
        map[key].totalPenjualan += so.grandTotal || 0;
        map[key].statuses[so.status || "order"] = (map[key].statuses[so.status || "order"] || 0) + 1;
    }

    for (const c of masters) {
        if (!map[c.kode] && !map[c.nama]) {
            map[c.kode] = { pelanggan: c.kode, nama: c.nama, jumlahSO: 0, totalPenjualan: 0, kontak: c.kontak || "", telepon: c.telepon || "", email: c.email || "", alamat: c.alamat || "", statuses: {} };
        }
    }
    for (const c of masters) {
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

    const summary = {
        totalCustomer: list.filter(x => x.jumlahSO > 0).length,
        totalSO: list.reduce((s, x) => s + x.jumlahSO, 0),
        totalPenjualan: list.reduce((s, x) => s + x.totalPenjualan, 0)
    };

    return { ...slicePage(list, page, limit), summary };
}

// ═══════════════════════════════════════════════
//  Laporan Laba-Rugi (Profit & Loss)
// ═══════════════════════════════════════════════

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function computeLabarugiLocal(allSO, allBarang, params = {}) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const mode = params.mode === "rekap" ? "rekap" : "detail";
    const search = (params.search || "").toLowerCase().trim();
    const { startDate, endDate } = params;

    const hargaBeliMap = {};
    for (const b of allBarang) hargaBeliMap[b.kode] = b.harga_beli || 0;

    let enriched = allSO
        .filter(s => ["delivered", "invoiced", "paid"].includes(s.status) && inDateRange(s.tanggal, startDate, endDate))
        .map(s => {
            let hpp = 0;
            for (const it of (s.items || [])) hpp += (it.qty || 0) * (hargaBeliMap[it.kode] || 0);
            hpp = fmt2(hpp);
            const nilaiPenjualan = s.grandTotal || 0;
            return { ...s, hpp, nilaiPenjualan, labaKotor: fmt2(nilaiPenjualan - hpp) };
        });

    if (search) {
        enriched = enriched.filter(r =>
            String(r.nomor || "").toLowerCase().includes(search) ||
            String(r.pelangganNama || "").toLowerCase().includes(search) ||
            String(r.pelanggan || "").toLowerCase().includes(search) ||
            String(r.status || "").toLowerCase().includes(search)
        );
    }
    enriched.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    // Rekap per bulan
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
        .map(b => ({ ...b, penjualan: fmt2(b.penjualan), hpp: fmt2(b.hpp), laba: fmt2(b.laba) }))
        .sort((a, b) => String(b.bulan).localeCompare(String(a.bulan)));

    const totalPenjualan = fmt2(enriched.reduce((s, r) => s + r.nilaiPenjualan, 0));
    const totalHPP = fmt2(enriched.reduce((s, r) => s + r.hpp, 0));
    const totalLabaKotor = fmt2(enriched.reduce((s, r) => s + r.labaKotor, 0));
    const summary = {
        totalTransaksi: enriched.length,
        totalPenjualan,
        totalHPP,
        totalLabaKotor,
        margin: totalPenjualan > 0 ? Math.round((totalLabaKotor / totalPenjualan) * 1000) / 10 : 0
    };

    if (mode === "rekap") {
        const total = rekapBulan.length;
        return {
            data: rekapBulan,
            summary,
            rekapBulan,
            pagination: { page: 1, limit, total, totalPages: 1 }
        };
    }
    return { ...slicePage(enriched, page, limit), summary, rekapBulan };
}

export async function getLaporanLabarugi(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/labarugi?${query}`);
        if (result !== null) return result;
    } catch {}
    const { listPenjualan } = await import("./penjualan-data.js");
    const { listBarang } = await import("./barang-data.js");
    const [allSO, allBarang] = await Promise.all([fetchAll(listPenjualan), fetchAll(listBarang)]);
    return computeLabarugiLocal(allSO, allBarang, params);
}

// ═══════════════════════════════════════════════
//  Laporan Piutang (Accounts Receivable)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
//  Laporan Kasir — POS Breakdown (PRD V1 §13)
//  GET /api/laporan/sales-breakdown → byItem/byCategory/byCashier/byPayment
// ═══════════════════════════════════════════════

export async function getSalesBreakdown(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/sales-breakdown?${query}`);
        if (result !== null && result.byItem) return result;
    } catch {}

    // Fallback lokal: komputasi dari listPenjualan (sumber=pos, paid)
    const { listPenjualan } = await import("./penjualan-data.js");
    const { listBarang } = await import("./barang-data.js");
    const { startDate, endDate } = params;
    const [allSO, allBarang] = await Promise.all([fetchAll(listPenjualan), fetchAll(listBarang)]);

    const kategoriMap = {};
    for (const b of allBarang) kategoriMap[b.kode] = b.kategori || "Tanpa Kategori";

    const byItem = {};
    const byCashier = {};
    const byPayment = {};
    let totalPenjualan = 0;
    let totalTransaksi = 0;
    let totalPajak = 0;

    for (const t of allSO) {
        if (t.sumber !== "pos" || t.status !== "paid" || !inDateRange(t.tanggal, startDate, endDate)) continue;
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

    const byCategory = {};
    for (const it of Object.values(byItem)) {
        const k = it.kategori;
        if (!byCategory[k]) byCategory[k] = { kategori: k, qty: 0, omzet: 0 };
        byCategory[k].qty += it.qty;
        byCategory[k].omzet += it.omzet;
    }

    const sortOmzet = arr => arr.sort((a, b) => b.omzet - a.omzet);
    return {
        summary: { totalTransaksi, totalPenjualan: fmt2(totalPenjualan), totalPajak: fmt2(totalPajak) },
        byItem: sortOmzet(Object.values(byItem).map(x => ({ ...x, omzet: fmt2(x.omzet) }))),
        byCategory: sortOmzet(Object.values(byCategory).map(x => ({ ...x, omzet: fmt2(x.omzet) }))),
        byCashier: sortOmzet(Object.values(byCashier).map(x => ({ ...x, omzet: fmt2(x.omzet) }))),
        byPayment: sortOmzet(Object.values(byPayment).map(x => ({ ...x, omzet: fmt2(x.omzet) })))
    };
}

// Label metode pembayaran (fallback lokal).
const PAYMENT_LABELS = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", card: "Kartu" };

export async function getLaporanPiutang(params = {}) {
    try {
        const query = buildQueryString(params);
        const result = await apiCall("GET", `/laporan/piutang?${query}`);
        if (result !== null) return result;
    } catch {}

    const { listPenjualan } = await import("./penjualan-data.js");
    const all = await fetchAll(listPenjualan);
    const { startDate, endDate } = params;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const search = (params.search || "").toLowerCase().trim();
    const termDays = parseInt(params.termDays, 10);
    const term = (!isNaN(termDays) && termDays >= 0) ? termDays : 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let enriched = all
        .filter(s => ["delivered", "invoiced"].includes(s.status) && inDateRange(s.tanggal, startDate, endDate))
        .map(s => {
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

    if (search) {
        enriched = enriched.filter(r =>
            String(r.nomor || "").toLowerCase().includes(search) ||
            String(r.pelangganNama || "").toLowerCase().includes(search) ||
            String(r.pelanggan || "").toLowerCase().includes(search) ||
            String(r.status || "").toLowerCase().includes(search)
        );
    }
    enriched.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    const totalPiutang = enriched.reduce((s, x) => s + (x.grandTotal || 0), 0);
    const totalOverdue = enriched.filter(x => x.overdue).reduce((s, x) => s + (x.grandTotal || 0), 0);
    const summary = {
        totalTransaksi: enriched.length,
        totalPiutang: fmt2(totalPiutang),
        totalBelumJatuhTempo: fmt2(totalPiutang - totalOverdue),
        totalOverdue: fmt2(totalOverdue),
        jumlahOverdue: enriched.filter(x => x.overdue).length
    };

    return { ...slicePage(enriched, page, limit), summary, termDays: term };
}
