/**
 * Penjualan Data Service — API-first with in-memory fallback.
 *
 * @module penjualan-data
 */

import {
    apiListFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback,
    apiCall,
    normalizeItem
} from "./api.js";

import { currentCompanyCode, filterData, tagData, delay } from "./helpers.js";

// ═══════════════════════════════════════════════
//  Seed Data (fallback)
// ═══════════════════════════════════════════════

function createSeedData() {
    const C = currentCompanyCode() || "";
    const today = new Date();
    const now = Date.now();
    const dd = String(today.getDate()).padStart(2,"0");
    const mm = String(today.getMonth()+1).padStart(2,"0");
    const yyyy = today.getFullYear();
    return [
        {
            id: "1", companyCode: C,
            nomor: `SO-${dd}${mm}${yyyy}-0001`,
            tanggal: today.toISOString(),
            pelanggan: "CST-001", pelangganNama: "Toko Maju Jaya", pelangganAlamat: "Jl. Merdeka No. 123, Jakarta",
            noPoPelanggan: "PO/CUST/2026/001",
            kirimDari: "GDG-001", kirimDariNama: "Gudang Utama",
            items: [
                { kode: "BRG-001", nama: "Air Mineral 600ml", satuan: "Karton", qty: 10, harga: 32000, diskon: 0, subtotal: 320000 },
                { kode: "BRG-002", nama: "Kopi Bubuk 200gr", satuan: "Pack", qty: 5, harga: 25000, diskon: 0, subtotal: 125000 }
            ],
            total: 445000, diskon: 0, grandTotal: 445000,
            catatan: "PO dari pelanggan via telepon",
            status: "order",
            noSuratJalan: "", noInvoice: "", noKwitansi: "",
            tanggalSJ: null, tanggalInvoice: null, tanggalKwitansi: null,
            sales: "",
            createdBy: "System", createdAt: now, updatedAt: now
        },
        {
            id: "2", companyCode: C,
            nomor: `SO-${dd}${mm}${yyyy}-0002`,
            tanggal: today.toISOString(),
            pelanggan: "CST-002", pelangganNama: "RM Sederhana", pelangganAlamat: "Jl. Sudirman No. 45, Bandung",
            noPoPelanggan: "",
            kirimDari: "GDG-001", kirimDariNama: "Gudang Utama",
            items: [
                { kode: "BRG-003", nama: "Minyak Goreng 1L", satuan: "Botol", qty: 20, harga: 18000, diskon: 0, subtotal: 360000 },
                { kode: "BRG-004", nama: "Gula Pasir 1kg", satuan: "Pack", qty: 15, harga: 15000, diskon: 0, subtotal: 225000 }
            ],
            total: 585000, diskon: 10000, grandTotal: 575000,
            catatan: "",
            status: "delivered",
            noSuratJalan: `SJ-${dd}${mm}${yyyy}-0001`,
            noInvoice: "", noKwitansi: "",
            tanggalSJ: new Date(now - 3600000).toISOString(),
            tanggalInvoice: null, tanggalKwitansi: null,
            sales: "",
            createdBy: "System", createdAt: now - 86400000, updatedAt: now - 3600000
        }
    ];
}

/** @type {object[]} In-memory fallback */
let items = createSeedData();
let nextId = "3";

function nextStringId() {
    const id = nextId;
    nextId = String(Number(nextId) + 1);
    return id;
}

function generateNomor(prefix = "SO") {
    // prefix kosong = format Nota kasir DDMMYYYY-XXXX (M3-FIX v19)
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const displayPrefix = prefix ? `${prefix}-${dd}${mm}${yyyy}-` : `${dd}${mm}${yyyy}-`;
    const yearPattern = new RegExp(`^${prefix ? `${prefix}-` : ""}\\d{4}${yyyy}-`);
    const yearItems = items.filter(i => yearPattern.test(i.nomor));
    let maxSeq = 0;
    for (const e of yearItems) {
        const parts = e.nomor.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${displayPrefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

function generateDocNomor(prefix) {
    // Generate unique SJ/INV/KWT numbers among existing items
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const displayPrefix = `${prefix}-${dd}${mm}${yyyy}-`;
    const yearPattern = new RegExp(`^${prefix}-\\\\d{4}${yyyy}-`);
    const allItems = items;
    let maxSeq = 0;
    for (const e of allItems) {
        const toCheck = e.noSuratJalan || e.noInvoice || e.noKwitansi || "";
        if (yearPattern.test(toCheck)) {
            const parts = toCheck.split("-");
            const seq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
    }
    return `${displayPrefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

// ── Local fallback implementations ──

async function listPenjualanLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();

    let filtered = filterData(items);
    if (search) {
        filtered = filtered.filter(item =>
            item.nomor.toLowerCase().includes(search) ||
            (item.pelangganNama || "").toLowerCase().includes(search) ||
            item.status.toLowerCase().includes(search) ||
            (item.noPoPelanggan || "").toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);
    return {
        data: paged,
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

async function getPenjualanLocal(id) {
    await delay(150);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const companyCode = currentCompanyCode();
    if (companyCode && item.companyCode !== companyCode) return null;
    return { ...item };
}

async function createPenjualanLocal(data) {
    await delay(200);
    const now = Date.now();
    // SP-029 M3 — transaksi kasir (sumber "pos") langsung lunas;
    // hold:true (PRD V1 §7.5) → keranjang sementara (status "held"),
    // tanpa pembayaran/kwitansi (parity offline dengan server).
    const isPos = data.sumber === "pos";
    const isHold = isPos && data.hold === true;
    const tipePelanggan = isPos && String(data.tipePelanggan || "umum").toLowerCase() === "member" ? "member" : "umum";
    const validatedItems = (data.items || []).map(item => ({
        kode: item.kode || "",
        nama: item.nama || "",
        satuan: item.satuan || "",
        qty: Number(item.qty) || 0,
        harga: Number(item.harga) || 0,
        diskon: Number(item.diskon) || 0,
        subtotal: Math.max(0, (Number(item.qty) || 0) * (Number(item.harga) || 0) - (Number(item.diskon) || 0))
    }));
    const total = validatedItems.reduce((s, i) => s + i.subtotal, 0);
    const diskonVal = Number(data.diskon) || 0;
    const pajakVal = isPos ? (Number(data.pajak) || 0) : 0;
    const grandTotal = Math.max(0, total - diskonVal + pajakVal);
    const bayarVal = isPos ? (Number(data.bayar) || 0) : 0;
    const nomor = generateNomor(isPos ? "" : "SO");
    const newItem = {
        id: nextStringId(),
        ...tagData({}),
        nomor,
        tanggal: data.tanggal || new Date().toISOString(),
        pelanggan: isPos ? (data.pelanggan || "UMUM") : (data.pelanggan || ""),
        pelangganNama: isPos ? (data.pelangganNama || (tipePelanggan === "member" ? "Member" : "Pelanggan Umum")) : (data.pelangganNama || ""),
        tipePelanggan,
        pelangganAlamat: data.pelangganAlamat || "",
        noPoPelanggan: data.noPoPelanggan || "",
        kirimDari: data.kirimDari || "",
        kirimDariNama: data.kirimDariNama || "",
        items: validatedItems,
        total,
        diskon: diskonVal,
        grandTotal,
        catatan: data.catatan || (isPos ? "Penjualan kasir" : ""),
        status: isHold ? "held" : (isPos ? "paid" : "order"),
        sumber: isPos ? "pos" : "so",
        kasir: isPos ? (data.kasir || "Kasir") : "",
        pajak: pajakVal,
        bayar: isHold ? 0 : bayarVal,
        kembalian: isHold ? 0 : (bayarVal > 0 ? Math.max(0, bayarVal - grandTotal) : (Number(data.kembalian) || 0)),
        noSuratJalan: "", noInvoice: "", noKwitansi: (isPos && !isHold) ? nomor : "",
        tanggalSJ: null, tanggalInvoice: null, tanggalKwitansi: (isPos && !isHold) ? new Date().toISOString() : null,
        heldAt: isHold ? new Date().toISOString() : null,
        heldBy: isHold ? (data.kasir || "Kasir") : null,
        heldNote: isHold ? (data.holdNote || "") : "",
        sales: data.sales || "",
        createdBy: data.createdBy || (isPos ? (data.kasir || "Kasir") : "System"),
        createdAt: now,
        updatedAt: now
    };
    items.unshift(newItem);
    return { ...newItem };
}

async function updatePenjualanLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const existing = items[index];
    if (existing.status !== "order") return null;

    const updated = { ...existing };
    if (data.tanggal !== undefined) updated.tanggal = data.tanggal;
    if (data.pelanggan !== undefined) updated.pelanggan = data.pelanggan;
    if (data.pelangganNama !== undefined) updated.pelangganNama = data.pelangganNama;
    if (data.pelangganAlamat !== undefined) updated.pelangganAlamat = data.pelangganAlamat;
    if (data.noPoPelanggan !== undefined) updated.noPoPelanggan = data.noPoPelanggan;
    if (data.kirimDari !== undefined) updated.kirimDari = data.kirimDari;
    if (data.kirimDariNama !== undefined) updated.kirimDariNama = data.kirimDariNama;
    if (data.catatan !== undefined) updated.catatan = data.catatan;
    if (data.diskon !== undefined) updated.diskon = Number(data.diskon);
    if (data.createdBy !== undefined) updated.createdBy = data.createdBy;

    if (data.items !== undefined) {
        updated.items = data.items.map(item => ({
            kode: item.kode || "",
            nama: item.nama || "",
            satuan: item.satuan || "",
            qty: Number(item.qty) || 0,
            harga: Number(item.harga) || 0,
            diskon: Number(item.diskon) || 0,
            subtotal: Math.max(0, (Number(item.qty) || 0) * (Number(item.harga) || 0) - (Number(item.diskon) || 0))
        }));
        updated.total = updated.items.reduce((s, i) => s + i.subtotal, 0);
        updated.grandTotal = Math.max(0, updated.total - updated.diskon);
    } else {
        updated.grandTotal = Math.max(0, updated.total - updated.diskon);
    }

    updated.updatedAt = Date.now();
    items[index] = updated;
    return { ...updated };
}

async function deletePenjualanLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) throw new Error("Data tidak ditemukan");
    items.splice(index, 1);
    return true;
}

async function updateStatusLocal(id, status) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const existing = items[index];
    const validTransitions = {
        "order": ["delivered"],
        "delivered": ["invoiced"],
        "invoiced": ["paid"]
    };
    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(status)) return null;

    const now = new Date().toISOString();
    const updated = { ...existing };
    if (status === "delivered") {
        updated.noSuratJalan = generateDocNomor("SJ");
        updated.tanggalSJ = now;
    }
    if (status === "invoiced") {
        updated.noInvoice = generateDocNomor("INV");
        updated.tanggalInvoice = now;
    }
    if (status === "paid") {
        updated.noKwitansi = generateDocNomor("KWT");
        updated.tanggalKwitansi = now;
    }
    updated.status = status;
    updated.updatedAt = Date.now();
    items[index] = updated;
    return { ...updated };
}

// ═══════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════

export async function listPenjualan(params = {}) {
    return apiListFallback("/api/penjualan", params, () => listPenjualanLocal(params));
}

export async function getPenjualan(id) {
    return apiGetFallback("/api/penjualan", id, () => getPenjualanLocal(id));
}

export async function createPenjualan(data) {
    try {
        const res = await apiCall("POST", "/penjualan", data);
        // Normalisasi _id → id (parity dengan apiCreateFallback) agar pemanggil
        // lain yang membaca res.id tetap kompatibel.
        if (res !== null) return normalizeItem(res);
    } catch (e) {
        // Error dari server (4xx/5xx — mis. "Jumlah bayar kurang dari total")
        // TIDAK di-fallback ke data lokal: fallback hanya untuk jaringan down /
        // API tidak tersedia. Menyimpan data lokal saat server menolak akan
        // menciptakan transaksi palsu dengan id non-ObjectId (bug hold 500).
        if (!isNetworkError(e)) throw e;
    }
    return createPenjualanLocal(data);
}

export async function updatePenjualan(id, data) {
    return apiUpdateFallback("/api/penjualan", id, data, () => updatePenjualanLocal(id, data));
}

export async function deletePenjualan(id) {
    return apiDeleteFallback("/api/penjualan", id, () => deletePenjualanLocal(id));
}

/** True bila error murni jaringan (fetch gagal) — bukan error dari server. */
function isNetworkError(e) {
    return e && typeof e.message === "string" && e.message.includes("Failed to fetch");
}

/**
 * PRD V1 — Void transaksi POS (permission pos.transaction.void).
 * POST /api/penjualan/:id/void  body: { reason }
 * Server: status → "void", reversal stok item trading, voidedAt/By/Reason dicatat.
 * apiCall → authorizedFetch (Authorization: Bearer + refresh + header company).
 */
export async function voidPenjualan(id, reason = "") {
    try {
        const res = await apiCall("POST", `/penjualan/${id}/void`, { reason: reason || "" });
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    // Fallback lokal: tandai void (tanpa server)
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) throw new Error("Data tidak ditemukan");
    const existing = items[index];
    if (existing.status !== "paid" || existing.sumber !== "pos") {
        throw new Error("Hanya transaksi POS lunas yang bisa di-void");
    }
    existing.status = "void";
    existing.voidedAt = new Date().toISOString();
    existing.voidedBy = "Kasir (offline)";
    existing.voidReason = reason;
    existing.updatedAt = Date.now();
    items[index] = existing;
    return { ...existing };
}

/**
 * Update SO status.
 * PATCH /api/penjualan/:id/status  body: { status }
 * apiCall → authorizedFetch (Authorization: Bearer + refresh + header company).
 */
export async function updatePenjualanStatus(id, status) {
    try {
        const res = await apiCall("PATCH", `/penjualan/${id}/status`, { status });
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    return updateStatusLocal(id, status);
}

// ═══════════════════════════════════════════════
//  PRD V1 §7.5 — Hold / Resume transaksi POS
// ═══════════════════════════════════════════════

async function holdPenjualanLocal(id, note) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const existing = items[index];
    if (existing.status !== "order") {
        throw new Error(`Transaksi berstatus "${existing.status}" tidak bisa di-hold`);
    }
    existing.status = "held";
    existing.heldAt = new Date().toISOString();
    existing.heldBy = "Kasir (offline)";
    existing.heldNote = note || "";
    existing.updatedAt = Date.now();
    items[index] = existing;
    return { ...existing };
}

async function resumePenjualanLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const existing = items[index];
    if (existing.status !== "held") {
        throw new Error(`Transaksi berstatus "${existing.status}" tidak bisa di-resume`);
    }
    existing.status = "order";
    existing.heldAt = null;
    existing.updatedAt = Date.now();
    items[index] = existing;
    return { ...existing };
}

/**
 * PRD V1 §7.5 — Hold transaksi POS (simpan keranjang sementara).
 * POST /api/penjualan/:id/hold  body: { catatan }
 * Server: status → "held" + heldAt/By/Note. Stok tidak berubah.
 */
export async function holdPenjualan(id, note = "") {
    try {
        const res = await apiCall("POST", `/penjualan/${id}/hold`, { catatan: note || "" });
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    return holdPenjualanLocal(id, note);
}

/**
 * PRD V1 §7.5 — Resume transaksi yang ditahan (lanjutkan keranjang).
 * POST /api/penjualan/:id/resume
 * Server: status "held" → "order". Stok tidak berubah.
 */
export async function resumePenjualan(id) {
    try {
        const res = await apiCall("POST", `/penjualan/${id}/resume`);
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    return resumePenjualanLocal(id);
}

/** Reset seed data */
export function resetPenjualanData() {
    items = createSeedData();
    nextId = "3";
}
