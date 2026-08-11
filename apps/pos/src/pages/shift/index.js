/**
 * Shift Page — Shift Kasir (PRD V1, Part XI).
 *
 * - Status shift aktif (kasir, kas awal, waktu mulai) + riwayat
 * - Buka shift: kas awal (fisik) + catatan → POST /api/pos/shift/open
 * - Tutup shift: actual cash (hitung fisik) → server menghitung expected,
 *   difference = actual − expected (rekonsiliasi)
 * - Hak akses: pos.shift.open / pos.shift.close (kasir & admin sesuai PRD)
 *
 * Data: listShifts / openShift / closeShift (data/index.js), fallback lokal.
 *
 * @module pos/pages/shift
 */

import { showToast, Modal } from "@smart/ui";
import { listShifts, openShift, closeShift, formatRupiah } from "../../data/index.js";
import { posDashboardCSS } from "../pos-styles.js";

function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const state = { page: 1, limit: 10, total: 0, totalPages: 1, shifts: [], activeShift: null };

export function ShiftPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}</style>
            <div class="page-header">
                <div>
                    <h1>Shift Kasir</h1>
                    <p class="page-subtitle">Buka, pantau, dan tutup shift kasir (PRD V1)</p>
                </div>
                <button class="smart-btn smart-btn-primary" id="pos-shift-refresh">↻ Refresh</button>
            </div>
            <div id="pos-shift-active"></div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Riwayat Shift</span></div>
                <div class="cn-card-body">
                    <div id="pos-shift-table"><div class="cn-loading">Memuat riwayat shift...</div></div>
                </div>
            </div>
        </div>
    `;
}

function activeShiftCard(shift) {
    if (!shift) {
        return `
            <div class="pos-shift-banner pos-shift-empty">
                <div>
                    <strong>Tidak ada shift aktif</strong>
                    <br/><small class="cn-muted">Buka shift sebelum mulai melayani transaksi kasir</small>
                </div>
                <button class="smart-btn smart-btn-primary" id="pos-shift-open-btn">🕐 Buka Shift</button>
            </div>
        `;
    }
    return `
        <div class="pos-shift-banner">
            <div>
                <strong>Shift aktif — ${esc(shift.kasir || "Kasir")}</strong>
                <br/><small class="cn-muted">Buka ${new Date(shift.waktuMulai).toLocaleString("id-ID")}</small>
            </div>
            <div class="pos-shift-kas">Kas awal: <strong>Rp ${formatRupiah(shift.kasAwal)}</strong></div>
            <button class="smart-btn smart-btn-danger" id="pos-shift-close-btn">🧾 Tutup Shift</button>
        </div>
    `;
}

function renderTable(container) {
    const wrap = container.querySelector("#pos-shift-table");
    if (!wrap) return;
    if (!state.shifts.length) {
        wrap.innerHTML = `<div class="cn-empty">Belum ada riwayat shift.</div>`;
        return;
    }
    const rows = state.shifts.map(s => `
        <tr>
            <td><strong>${esc(s.kasir || "-")}</strong></td>
            <td>${new Date(s.waktuMulai).toLocaleString("id-ID")}</td>
            <td>${s.waktuTutup ? new Date(s.waktuTutup).toLocaleString("id-ID") : "-"}</td>
            <td class="cn-text-right">Rp ${formatRupiah(s.kasAwal)}</td>
            <td class="cn-text-right">Rp ${formatRupiah(s.totalPenjualan)}</td>
            <td class="cn-text-right">Rp ${formatRupiah(s.expectedCash)}</td>
            <td class="cn-text-right">Rp ${formatRupiah(s.actualCash)}</td>
            <td class="${Number(s.difference) > 0 ? "cn-ok" : (Number(s.difference) < 0 ? "cn-danger" : "cn-muted")} cn-text-right"><strong>${Number(s.difference) > 0 ? "+" : ""}${formatRupiah(s.difference)}</strong></td>
            <td>
                <span class="ps-status-badge ${s.status === "open" ? "ps-status-order" : "ps-status-void"}">${s.status === "open" ? "Aktif" : "Tutup"}</span>
            </td>
        </tr>
    `).join("");
    wrap.innerHTML = `
        <div class="dp-table-wrap">
            <table class="dp-table">
                <thead><tr>
                    <th>Kasir</th><th>Buka</th><th>Tutup</th><th>Kas Awal</th>
                    <th>Penjualan</th><th>Expected</th><th>Actual</th><th>Selisih</th><th>Status</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${state.totalPages > 1 ? `
            <div style="display:flex;justify-content:center;gap:6px;margin-top:10px">
                <button class="smart-btn smart-btn-secondary" id="pos-shift-prev" ${state.page <= 1 ? "disabled" : ""}>‹ Prev</button>
                <span class="cn-muted">${state.page} / ${state.totalPages}</span>
                <button class="smart-btn smart-btn-secondary" id="pos-shift-next" ${state.page >= state.totalPages ? "disabled" : ""}>Next ›</button>
            </div>` : ""}
    `;
    wrap.querySelector("#pos-shift-prev")?.addEventListener("click", () => { state.page--; load(container); });
    wrap.querySelector("#pos-shift-next")?.addEventListener("click", () => { state.page++; load(container); });
}

async function load(container) {
    const activeEl = container.querySelector("#pos-shift-active");
    if (activeEl) {
        try {
            const res = await listShifts({ page: 1, limit: 5, status: "open" });
            state.activeShift = res?.data?.[0] || null;
            activeEl.innerHTML = activeShiftCard(state.activeShift);
            const openBtn = activeEl.querySelector("#pos-shift-open-btn");
            if (openBtn) openBtn.addEventListener("click", () => openShiftModal(container));
            const closeBtn = activeEl.querySelector("#pos-shift-close-btn");
            if (closeBtn) closeBtn.addEventListener("click", () => closeShiftModal(container));
        } catch {
            activeEl.innerHTML = activeShiftCard(null);
        }
    }
    try {
        const res = await listShifts({ page: state.page, limit: state.limit });
        state.shifts = res?.data || [];
        state.total = res?.pagination?.total || 0;
        state.totalPages = res?.pagination?.totalPages || 1;
    } catch {
        state.shifts = [];
    }
    renderTable(container);
}

function openShiftModal(container) {
    const content = `
        <p class="cn-muted">Masukkan kas awal (uang fisik di laci kas) saat membuka shift.</p>
        <div class="bl-form" style="margin-top:10px">
            <label for="f-kas-awal">Kas Awal (Rp)</label>
            <input class="smart-input" id="f-kas-awal" type="text" inputmode="numeric" value="0" autocomplete="off" />
            <label for="f-shift-catatan">Catatan (opsional)</label>
            <input class="smart-input" id="f-shift-catatan" type="text" placeholder="Contoh: shift pagi" autocomplete="off" />
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="f-shift-cancel">Batal</button>
        <button class="smart-btn smart-btn-primary" id="f-shift-confirm">Buka Shift</button>
    `;
    const overlay = Modal({ open: true, title: "🕐 Buka Shift", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    const formatNum = (el) => {
        const digits = String(el.value || "").replace(/\D/g, "");
        el.value = digits ? Number(digits).toLocaleString("id-ID") : "0";
    };
    const kasAwalEl = overlay.querySelector("#f-kas-awal");
    kasAwalEl?.addEventListener("input", () => formatNum(kasAwalEl));
    overlay.querySelector("#f-shift-cancel")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#f-shift-confirm")?.addEventListener("click", async () => {
        const kasAwal = Number(String(kasAwalEl?.value || "0").replace(/\D/g, "")) || 0;
        const catatan = overlay.querySelector("#f-shift-catatan")?.value?.trim() || "";
        try {
            await openShift(kasAwal, catatan);
            showToast("success", `Shift dibuka dengan kas awal Rp ${formatRupiah(kasAwal)}`);
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal membuka shift");
        }
    });
}

function closeShiftModal(container) {
    const content = `
        <p class="cn-muted">Masukkan hasil hitung fisik kas saat menutup shift. Server menghitung expected = kas awal + penjualan, selisih = actual − expected.</p>
        <div class="bl-form" style="margin-top:10px">
            <label for="f-actual-cash">Actual Cash (Rp)</label>
            <input class="smart-input" id="f-actual-cash" type="text" inputmode="numeric" value="0" autocomplete="off" />
            <label for="f-shift-catatan">Catatan (opsional)</label>
            <input class="smart-input" id="f-shift-catatan" type="text" placeholder="Contoh: shift pagi selesai" autocomplete="off" />
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="f-shift-cancel">Batal</button>
        <button class="smart-btn smart-btn-danger" id="f-shift-confirm">Tutup Shift</button>
    `;
    const overlay = Modal({ open: true, title: "🧾 Tutup Shift", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    const actualEl = overlay.querySelector("#f-actual-cash");
    actualEl?.addEventListener("input", () => {
        const digits = String(actualEl.value || "").replace(/\D/g, "");
        actualEl.value = digits ? Number(digits).toLocaleString("id-ID") : "0";
    });
    overlay.querySelector("#f-shift-cancel")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#f-shift-confirm")?.addEventListener("click", async () => {
        const actualCash = Number(String(actualEl?.value || "0").replace(/\D/g, "")) || 0;
        const catatan = overlay.querySelector("#f-shift-catatan")?.value?.trim() || "";
        try {
            const closed = await closeShift(actualCash, catatan);
            const diff = Number(closed.difference) || 0;
            const diffTxt = `${diff > 0 ? "+" : ""}${formatRupiah(diff)}`;
            showToast("success", `Shift ditutup — expected Rp ${formatRupiah(closed.expectedCash)}, selisih ${diffTxt}`);
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal menutup shift");
        }
    });
}

export function initShiftPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#pos-shift-refresh")?.addEventListener("click", () => load(container));
    load(container);
}

// Re-export formatRupiah untuk konsistensi bila dipakai modul lain
export { formatRupiah };
