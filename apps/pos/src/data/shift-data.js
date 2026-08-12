/**
 * Shift Data Service — Shift Kasir (PRD V1, Part XI).
 *
 * API-first via apiCall (authorizedFetch → Authorization: Bearer + refresh,
 * header x-company-code / x-user-name otomatis) dengan fallback in-memory
 * ringan saat server tidak tersedia:
 *   listShifts({ page, limit, status }) → GET  /api/pos/shifts
 *   openShift(kasAwal, catatan, kasir)  → POST /api/pos/shift/open
 *   closeShift(actualCash, catatan, target) → POST /api/pos/shift/close
 *     target = { name, username } opsional — admin/owner menutup shift kasir
 *     lain; tanpa target = shift milik kasir yang login.
 *
 * @module pos/data/shift-data
 */

import { apiCall } from "./api.js";
import { currentCompanyCode, delay } from "./helpers.js";

// ── Fallback state ──
const _localShifts = [];
let _localOpenShift = null;

/** True bila error murni jaringan (fetch gagal) — bukan error dari server. */
function isNetworkError(e) {
    return e && typeof e.message === "string" && e.message.includes("Failed to fetch");
}

/**
 * List riwayat shift (company-scoped, terbaru dulu).
 */
export async function listShifts(params = {}) {
    try {
        const qs = new URLSearchParams();
        if (params.page) qs.set("page", params.page);
        if (params.limit) qs.set("limit", params.limit);
        if (params.status) qs.set("status", params.status);
        const res = await apiCall("GET", `/pos/shifts?${qs.toString()}`);
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    await delay(150);
    const list = _localOpenShift ? [_localOpenShift, ..._localShifts] : _localShifts;
    const filtered = params.status ? list.filter(s => s.status === params.status) : list;
    return { data: filtered, pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1 } };
}

/**
 * Buka shift kasir.
 * @param {number} kasAwal Kas awal (fisik)
 * @param {string} [catatan]
 * @param {{ name?: string, username?: string }} [kasir] Kasir terpilih
 *        (bila ada >1 kasir). Tanpa ini dipakai identitas user yang login.
 */
export async function openShift(kasAwal = 0, catatan = "", kasir = {}) {
    try {
        const res = await apiCall("POST", "/pos/shift/open", {
            kasAwal: Math.max(0, Number(kasAwal) || 0),
            catatan: catatan || "",
            kasir: (kasir && String(kasir.name || "").trim()) || undefined,
            kasirUsername: (kasir && String(kasir.username || "").trim()) || undefined
        });
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    await delay(150);
    _localOpenShift = {
        id: "shift-local-" + Date.now(),
        companyCode: currentCompanyCode() || "",
        kasir: (kasir && String(kasir.name || "").trim()) || "Kasir",
        kasAwal: Math.max(0, Number(kasAwal) || 0),
        waktuMulai: new Date().toISOString(),
        status: "open",
        totalTransaksi: 0,
        totalPenjualan: 0
    };
    return { ..._localOpenShift };
}

/**
 * Tutup shift — server menghitung expected = kasAwal + totalPenjualan,
 * difference = actualCash - expected.
 * @param {number} actualCash Hitung fisik
 * @param {string} [catatan]
 * @param {{ name?: string, username?: string }} [target] Kasir target
 *        (admin/owner menutup shift kasir lain). Tanpa ini = shift kasir login.
 */
export async function closeShift(actualCash = 0, catatan = "", target = {}) {
    try {
        const res = await apiCall("POST", "/pos/shift/close", {
            actualCash: Math.max(0, Number(actualCash) || 0),
            catatan: catatan || "",
            kasir: (target && String(target.name || "").trim()) || undefined,
            kasirUsername: (target && String(target.username || "").trim()) || undefined
        });
        if (res !== null) return res;
    } catch (e) {
        if (!isNetworkError(e)) throw e;
    }
    await delay(150);
    if (!_localOpenShift) throw new Error("Tidak ada shift aktif");
    const closed = {
        ..._localOpenShift,
        status: "closed",
        actualCash: Math.max(0, Number(actualCash) || 0),
        expectedCash: _localOpenShift.kasAwal + (_localOpenShift.totalPenjualan || 0),
        difference: Math.max(0, Number(actualCash) || 0) - (_localOpenShift.kasAwal + (_localOpenShift.totalPenjualan || 0)),
        waktuTutup: new Date().toISOString()
    };
    _localShifts.unshift(closed);
    _localOpenShift = null;
    return { ...closed };
}
