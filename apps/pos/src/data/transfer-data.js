/**
 * Transfer Data Service — API-first with in-memory fallback.
 *
 * @module transfer-data
 */

import { apiListFallback, apiCreateFallback, apiUpdateFallback, apiDeleteFallback, apiGetFallback } from "./api.js";
import { currentCompanyCode, filterData, tagData, delay } from "./helpers.js";

function createSeedData() {
    const C = currentCompanyCode() || "";
    const now = Date.now();
    return [
        {
            id: "1", companyCode: C,
            nomor: "TRF-27072026-0001",
            tanggal: new Date().toISOString(),
            gudangAsal: "GDG-001", gudangAsalNama: "Gudang Utama",
            gudangTujuan: "GDG-002", gudangTujuanNama: "Gudang Cabang",
            items: [
                { kodeBarang: "89966632286", namaBarang: "Aquaviva", qty: 20, satuan: "Botol" },
                { kodeBarang: "0808080000", namaBarang: "Bumbu Instant", qty: 15, satuan: "Sachet" }
            ],
            catatan: "Transfer stok untuk outlet",
            status: "draft",
            createdBy: "System", createdAt: now, updatedAt: now
        }
    ];
}

let items = createSeedData();
let nextId = "2";

function nextStringId() { const id = nextId; nextId = String(Number(nextId) + 1); return id; }

function generateNomor() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const prefix = `TRF-${dd}${mm}${yyyy}-`;
    const yearPattern = new RegExp(`^TRF-\\d{8}-`);
    const yearItems = items.filter(i => yearPattern.test(i.nomor));
    let maxSeq = 0;
    for (const e of yearItems) {
        const parts = e.nomor.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

async function listTransferLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = filterData(items);
    if (search) {
        filtered = filtered.filter(item =>
            item.nomor.toLowerCase().includes(search) ||
            (item.gudangAsalNama || "").toLowerCase().includes(search) ||
            (item.gudangTujuanNama || "").toLowerCase().includes(search)
        );
    }
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);
    return { data: paged, pagination: { page: Math.min(page, totalPages), limit, total, totalPages } };
}

async function getTransferLocal(id) {
    await delay(100);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const code = currentCompanyCode();
    if (code && item.companyCode !== code) return null;
    return { ...item };
}

async function createTransferLocal(data) {
    await delay(200);
    const now = Date.now();
    const newItem = {
        id: nextStringId(),
        ...tagData({}),
        nomor: generateNomor(),
        tanggal: data.tanggal || new Date().toISOString(),
        gudangAsal: data.gudangAsal || "",
        gudangAsalNama: data.gudangAsalNama || "",
        gudangTujuan: data.gudangTujuan || "",
        gudangTujuanNama: data.gudangTujuanNama || "",
        items: (data.items || []).map(i => ({
            kodeBarang: i.kodeBarang || "",
            namaBarang: i.namaBarang || "",
            qty: Number(i.qty) || 0,
            satuan: i.satuan || ""
        })),
        catatan: data.catatan || "",
        status: "draft",
        createdBy: data.createdBy || "System",
        createdAt: now, updatedAt: now
    };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateTransferLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return null;

    const updated = { ...items[index] };
    if (data.tanggal !== undefined) updated.tanggal = data.tanggal;
    if (data.gudangAsal !== undefined) updated.gudangAsal = data.gudangAsal;
    if (data.gudangAsalNama !== undefined) updated.gudangAsalNama = data.gudangAsalNama;
    if (data.gudangTujuan !== undefined) updated.gudangTujuan = data.gudangTujuan;
    if (data.gudangTujuanNama !== undefined) updated.gudangTujuanNama = data.gudangTujuanNama;
    if (data.items !== undefined) {
        updated.items = data.items.map(i => ({
            kodeBarang: i.kodeBarang || "",
            namaBarang: i.namaBarang || "",
            qty: Number(i.qty) || 0,
            satuan: i.satuan || ""
        }));
    }
    if (data.catatan !== undefined) updated.catatan = data.catatan;
    updated.updatedAt = Date.now();
    items[index] = updated;
    return { ...updated };
}

async function updateTransferStatusLocal(id, newStatus) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return null;

    if (items[index].status !== "draft") {
        throw new Error("Transfer sudah dieksekusi");
    }

    const transfer = items[index];
    const gudangAsalNama = transfer.gudangAsalNama || transfer.gudangAsal;
    const gudangTujuanNama = transfer.gudangTujuanNama || transfer.gudangTujuan;

    // Validasi stok di gudang asal
    const { listBarang, updateBarang, createBarang } = await import("./barang-data.js");
    const allBarangs = (await listBarang({ page: 1, limit: 999 })).data || [];

    for (const item of transfer.items) {
        const barangAsal = allBarangs.find(b => b.kode === item.kodeBarang && b.gudang === gudangAsalNama);
        const stokTersedia = barangAsal ? barangAsal.stok : 0;
        if (stokTersedia < item.qty) {
            throw new Error(`Stok "${item.namaBarang || item.kodeBarang}" di ${gudangAsalNama} tidak mencukupi (tersedia: ${stokTersedia}, diminta: ${item.qty})`);
        }
    }

    // Eksekusi: kurangi stok di gudang asal, tambah di gudang tujuan
    for (const item of transfer.items) {
        // 1. Kurangi stok dari gudang asal
        const barangAsal = allBarangs.find(b => b.kode === item.kodeBarang && b.gudang === gudangAsalNama);
        if (barangAsal) {
            const newStokAsal = Math.max(0, (barangAsal.stok || 0) - item.qty);
            await updateBarang(barangAsal.id || barangAsal._id, { stok: newStokAsal });
        }

        // 2. Cari barang di gudang tujuan
        const barangTujuan = allBarangs.find(b => b.kode === item.kodeBarang && b.gudang === gudangTujuanNama);

        if (barangTujuan) {
            // Sudah ada — tambah stok
            const newStokTujuan = (barangTujuan.stok || 0) + item.qty;
            await updateBarang(barangTujuan.id || barangTujuan._id, { stok: newStokTujuan });
        } else if (barangAsal && typeof createBarang === "function") {
            // Belum ada — buat record baru
            await createBarang({
                kode: barangAsal.kode,
                nama: barangAsal.nama,
                kategori: barangAsal.kategori || "",
                satuan: barangAsal.satuan || item.satuan || "",
                gudang: gudangTujuanNama,
                stok: item.qty,
                stok_minimum: barangAsal.stok_minimum || 0,
                harga_beli: barangAsal.harga_beli || 0,
                harga_jual: barangAsal.harga_jual || 0,
                deskripsi: barangAsal.deskripsi || ""
            });
        }
    }

    transfer.status = newStatus || "transferred";
    transfer.updatedAt = Date.now();
    return { ...transfer };
}

async function deleteTransferLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const code = currentCompanyCode();
    if (code && items[index].companyCode !== code) return false;
    items.splice(index, 1);
    return true;
}

export async function listTransfer(params = {}) {
    return apiListFallback("/api/transfer", params, () => listTransferLocal(params));
}

export async function getTransfer(id) {
    return apiGetFallback("/api/transfer", id, () => getTransferLocal(id));
}

export async function createTransfer(data) {
    return apiCreateFallback("/api/transfer", data, () => createTransferLocal(data));
}

export async function updateTransfer(id, data) {
    return apiUpdateFallback("/api/transfer", id, data, () => updateTransferLocal(id, data));
}

export async function updateTransferStatus(id, status) {
    return apiUpdateFallback("/api/transfer", `${id}/status`, { status }, () => updateTransferStatusLocal(id, status));
}

export async function deleteTransfer(id) {
    return apiDeleteFallback("/api/transfer", id, () => deleteTransferLocal(id));
}

export function resetTransferData() {
    items = createSeedData();
    nextId = "2";
}
