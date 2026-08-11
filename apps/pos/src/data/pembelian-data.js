/**
 * Pembelian Data Service — API-first with in-memory fallback.
 *
 * @module pembelian-data
 */

import { Auth } from "@smart/core";

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
            nomor: `PO-${String(today.getDate()).padStart(2,"0")}${String(today.getMonth()+1).padStart(2,"0")}${today.getFullYear()}-0001`,
            tanggal: today.toISOString(),
            kirimKe: "", kirimKeNama: "",
            supplier: "SUP-001", supplierName: "PT Sumber Jaya Abadi",
            items: [
                { kode: "BRG-001", nama: "Semen Tiga Roda 50kg", satuan: "Sak", qty: 50, harga: 52000, subtotal: 2600000 },
                { kode: "BRG-002", nama: "Besi Beton 10mm", satuan: "Batang", qty: 100, harga: 35000, subtotal: 3500000 }
            ],
            total: 6100000, diskon: 0, grandTotal: 6100000,
            catatan: "PO awal bulan",
            status: "draft", createdBy: "System", createdAt: now, updatedAt: now
        },
        {
            id: "2", companyCode: C,
            nomor: `PO-${String(today.getDate()).padStart(2,"0")}${String(today.getMonth()+1).padStart(2,"0")}${today.getFullYear()}-0002`,
            tanggal: today.toISOString(),
            kirimKe: "", kirimKeNama: "",
            supplier: "SUP-002", supplierName: "CV Maju Bersama",
            items: [
                { kode: "BRG-003", nama: "Cat Tembok Dulux 5kg", satuan: "Galon", qty: 10, harga: 85000, subtotal: 850000 },
                { kode: "BRG-004", nama: "Pipa PVC 3/4 Inch", satuan: "Meter", qty: 200, harga: 8000, subtotal: 1600000 }
            ],
            total: 2450000, diskon: 50000, grandTotal: 2400000,
            catatan: "",
            status: "confirmed", createdBy: "System", createdAt: now - 86400000, updatedAt: now - 3600000
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

function generateNomor() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yyyy = d.getFullYear();
    const displayPrefix = `PO-${dd}${mm}${yyyy}-`;
    // Cari max seq untuk tahun ini (cocokkan pola PO-\d{4}YYYY-)
    const yearPattern = new RegExp(`^PO-\\d{4}${yyyy}-`);
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

async function listPembelianLocal(params = {}) {
    await delay(250);
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();

    let filtered = filterData(items);
    if (search) {
        filtered = filtered.filter(item =>
            item.nomor.toLowerCase().includes(search) ||
            item.supplierName.toLowerCase().includes(search) ||
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

async function getPembelianLocal(id) {
    await delay(150);
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return null;
    const companyCode = currentCompanyCode();
    if (companyCode && item.companyCode !== companyCode) return null;
    return { ...item };
}

async function createPembelianLocal(data) {
    await delay(200);
    const now = Date.now();
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
    const newItem = {
        id: nextStringId(),
        ...tagData({}),
        nomor: generateNomor(),
        tanggal: data.tanggal || new Date().toISOString(),
        kirimKe: data.kirimKe || "",
        kirimKeNama: data.kirimKeNama || "",
        supplier: data.supplier || "",
        supplierName: data.supplierName || "",
        items: validatedItems,
        total,
        diskon: diskonVal,
        grandTotal: Math.max(0, total - diskonVal),
        catatan: data.catatan || "",
        status: "draft",
        createdBy: data.createdBy || "System",
        createdAt: now,
        updatedAt: now
    };
    items.unshift(newItem);
    return { ...newItem };
}

async function updatePembelianLocal(id, data) {
    await delay(200);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return null;
    const existing = items[index];
    if (existing.status !== "draft") return null;

    const updated = { ...existing };
    if (data.tanggal !== undefined) updated.tanggal = data.tanggal;
    if (data.kirimKe !== undefined) updated.kirimKe = data.kirimKe;
    if (data.kirimKeNama !== undefined) updated.kirimKeNama = data.kirimKeNama;
    if (data.supplier !== undefined) updated.supplier = data.supplier;
    if (data.supplierName !== undefined) updated.supplierName = data.supplierName;
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

async function deletePembelianLocal(id) {
    await delay(150);
    const index = items.findIndex(i => String(i.id) === String(id));
    if (index === -1) return false;
    const existing = items[index];
    if (existing.status !== "draft") return false;
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

export async function listPembelian(params = {}) {
    return apiListFallback("/api/pembelian", params, () => listPembelianLocal(params));
}

export async function getPembelian(id) {
    return apiGetFallback("/api/pembelian", id, () => getPembelianLocal(id));
}

export async function createPembelian(data) {
    return apiCreateFallback("/api/pembelian", data, () => createPembelianLocal(data));
}

export async function updatePembelian(id, data) {
    return apiUpdateFallback("/api/pembelian", id, data, () => updatePembelianLocal(id, data));
}

export async function deletePembelian(id) {
    return apiDeleteFallback("/api/pembelian", id, () => deletePembelianLocal(id));
}

/**
 * Update PO status.
 * POST /api/pembelian/:id/status  body: { status }
 */
export async function updatePembelianStatus(id, status) {
    try {
        const companyCode = currentCompanyCode();
        const headers = { "Content-Type": "application/json" };
        if (companyCode) headers["x-company-code"] = companyCode;
        // Send user name for activity logging
        try {
            let userName = null;
            if (typeof globalThis !== 'undefined' && globalThis.SMART?.Session) {
                const sessionUser = globalThis.SMART.Session.get("user");
                if (sessionUser?.name) userName = sessionUser.name;
            }
            if (!userName) {
                const authUser = Auth.user();
                if (authUser?.name) userName = authUser.name;
            }
            if (userName) headers["x-user-name"] = userName;
        } catch {}
        const res = await fetch(`/api/pembelian/${id}/status`, {
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
export function resetPembelianData() {
    items = createSeedData();
    nextId = "3";
}
