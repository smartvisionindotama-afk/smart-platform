/**
 * ReturPenjualan Data Service — API-first with in-memory fallback.
 *
 * @module retur-penjualan-data
 */

import {
    apiListFallback,
    apiCreateFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback
} from "./api.js";

import { currentCompanyCode, filterData, tagData, delay } from "./helpers.js";

// ═══════════════════════════════════════════════
//  Seed Data (fallback)
// ═══════════════════════════════════════════════

function createSeedData() {
    const C = currentCompanyCode() || "";
    const today = new Date();
    const now = Date.now();
    return [
        {
            id: "1", companyCode: C,
            nomor: `RPJ-${String(today.getDate()).padStart(2,"0")}${String(today.getMonth()+1).padStart(2,"0")}${today.getFullYear()}-0001`,
            tanggal: today.toISOString(),
            nomorSO: `SO-${String(today.getDate()).padStart(2,"0")}${String(today.getMonth()+1).padStart(2,"0")}${today.getFullYear()}-0001`,
            idSO: "",
            pelanggan: "CST-001", pelangganNama: "Toko Maju Jaya",
            items: [
                { kode: "BRG-001", nama: "Air Mineral 600ml", satuan: "Karton", qty: 1, harga: 32000, subtotal: 32000 }
            ],
            total: 32000,
            catatan: "Pelanggan mengembalikan barang",
            status: "draft", createdBy: "System", createdAt: now, updatedAt: now
        }
    ];
}

/** @type {object[]} In-memory fallback */
let items = createSeedData();
let nextId = "2";

function nextStringId() {
    const id = nextId;
    nextId = String(Number(nextId) + 1);
    return id;
}

function generateNomor() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const displayPrefix = `RPJ-${dd}${mm}${yyyy}-`;
    const yearPattern = new RegExp(`^RPJ-\\d{4}${yyyy}-`);
    const yearItems = items.filter(i => yearPattern.test(i.nomor));
    let maxSeq = 0;
    for (const e of yearItems) {
        const parts = e.nomor.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${displayPrefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

// ── Local fallback implementations ──

async function listReturPenjualanLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();

    let filtered = filterData(items);
    if (search) {
        filtered = filtered.filter(item =>
            item.nomor.toLowerCase().includes(search) ||
            (item.nomorSO || "").toLowerCase().includes(search) ||
            (item.pelangganNama || "").toLowerCase().includes(search) ||
            item.status.toLowerCase().includes(search)
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

async function getReturPenjualanLocal(id) {
    await delay(150);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const companyCode = currentCompanyCode();
    if (companyCode && item.companyCode !== companyCode) return null;
    return { ...item };
}

async function createReturPenjualanLocal(data) {
    await delay(200);
    const now = Date.now();
    const validatedItems = (data.items || []).map(item => ({
        kode: item.kode || "",
        nama: item.nama || "",
        satuan: item.satuan || "",
        qty: Number(item.qty) || 0,
        harga: Number(item.harga) || 0,
        subtotal: Math.max(0, (Number(item.qty) || 0) * (Number(item.harga) || 0))
    }));
    const total = validatedItems.reduce((s, i) => s + i.subtotal, 0);
    const newItem = {
        id: nextStringId(),
        ...tagData({}),
        nomor: generateNomor(),
        tanggal: data.tanggal || new Date().toISOString(),
        nomorSO: data.nomorSO || "",
        idSO: data.idSO || "",
        pelanggan: data.pelanggan || "",
        pelangganNama: data.pelangganNama || "",
        items: validatedItems,
        total,
        catatan: data.catatan || "",
        status: "draft",
        createdBy: data.createdBy || "System",
        createdAt: now,
        updatedAt: now
    };
    items.unshift(newItem);
    return { ...newItem };
}

async function updateReturPenjualanLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const existing = items[index];
    if (existing.status !== "draft") return null;

    const updated = { ...existing };
    if (data.tanggal !== undefined) updated.tanggal = data.tanggal;
    if (data.nomorSO !== undefined) updated.nomorSO = data.nomorSO;
    if (data.idSO !== undefined) updated.idSO = data.idSO;
    if (data.pelanggan !== undefined) updated.pelanggan = data.pelanggan;
    if (data.pelangganNama !== undefined) updated.pelangganNama = data.pelangganNama;
    if (data.catatan !== undefined) updated.catatan = data.catatan;
    if (data.createdBy !== undefined) updated.createdBy = data.createdBy;

    if (data.items !== undefined) {
        updated.items = data.items.map(item => ({
            kode: item.kode || "",
            nama: item.nama || "",
            satuan: item.satuan || "",
            qty: Number(item.qty) || 0,
            harga: Number(item.harga) || 0,
            subtotal: Math.max(0, (Number(item.qty) || 0) * (Number(item.harga) || 0))
        }));
        updated.total = updated.items.reduce((s, i) => s + i.subtotal, 0);
    }

    updated.updatedAt = Date.now();
    items[index] = updated;
    return { ...updated };
}

async function deleteReturPenjualanLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    items.splice(index, 1);
    return true;
}

async function updateStatusLocal(id, status) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    items[index].status = status;
    items[index].updatedAt = Date.now();
    return { ...items[index] };
}

// ═══════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════

export async function listReturPenjualan(params = {}) {
    return apiListFallback("/api/retur-penjualan", params, () => listReturPenjualanLocal(params));
}

export async function getReturPenjualan(id) {
    return apiGetFallback("/api/retur-penjualan", id, () => getReturPenjualanLocal(id));
}

export async function createReturPenjualan(data) {
    return apiCreateFallback("/api/retur-penjualan", data, () => createReturPenjualanLocal(data));
}

export async function updateReturPenjualan(id, data) {
    return apiUpdateFallback("/api/retur-penjualan", id, data, () => updateReturPenjualanLocal(id, data));
}

export async function deleteReturPenjualan(id) {
    return apiDeleteFallback("/api/retur-penjualan", id, () => deleteReturPenjualanLocal(id));
}

/**
 * Update retur status (draft → returned).
 * PATCH /api/retur-penjualan/:id/status  body: { status }
 */
export async function updateReturPenjualanStatus(id, status) {
    try {
        const companyCode = currentCompanyCode();
        const headers = { "Content-Type": "application/json" };
        if (companyCode) headers["x-company-code"] = companyCode;
        try {
            let userName = null;
            if (typeof globalThis !== 'undefined' && globalThis.SMART?.Session) {
                const sessionUser = globalThis.SMART.Session.get("user");
                if (sessionUser?.name) userName = sessionUser.name;
            }
            if (!userName) {
                const authUser = (await import("@smart/core")).Auth.user();
                if (authUser?.name) userName = authUser.name;
            }
            if (userName) headers["x-user-name"] = userName;
        } catch {}
        const res = await fetch(`/api/retur-penjualan/${id}/status`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status })
        });
        if (res.ok) return res.json();
        const err = await res.json().catch(() => ({ error: "Gagal update status" }));
        throw new Error(err.error || "Gagal update status");
    } catch (e) {
        if (e.message && !e.message.includes("Failed to fetch")) throw e;
        return updateStatusLocal(id, status);
    }
}

/** Reset seed data */
export function resetReturPenjualanData() {
    items = createSeedData();
    nextId = "2";
}
