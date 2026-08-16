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
import { Auth, esc } from "@smart/core";
import { listShifts, openShift, closeShift, formatRupiah, getPosSettings } from "../../data/index.js";
import { apiCall } from "../../data/api.js";
import { posDashboardCSS } from "../pos-styles.js";

/** Nama user yang sedang login (dipakai untuk memfilter shift miliknya). */
function currentUserName() {
    try {
        const user = Auth.user && Auth.user();
        if (user && user.name) return String(user.name);
    } catch { /* ignore */ }
    return "";
}

/**
 * Role user yang login ("kasir" / "owner" / dll). Admin & owner boleh
 * menutup shift kasir lain — kasir hanya shift miliknya sendiri.
 */
function currentUserRole() {
    try {
        const user = Auth.user && Auth.user();
        if (user && user.role) return String(user.role).toLowerCase();
    } catch { /* ignore */ }
    return "";
}

// Framework First: esc dari @smart/core (util global, bukan duplikat lokal)

const state = { page: 1, limit: 10, total: 0, totalPages: 1, shifts: [], activeShift: null, openShifts: [] };

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

function activeShiftCard(shift, mine = true, isAdmin = false) {
    if (!shift) {
        return `
            <div class="pos-shift-banner pos-shift-empty">
                <div>
                    <strong>Tidak ada shift aktif untuk Anda</strong>
                    <br/><small class="cn-muted">Buka shift sebelum mulai melayani transaksi kasir — beberapa kasir bisa membuka shift secara bersamaan</small>
                </div>
                <button class="smart-btn smart-btn-primary" id="pos-shift-open-btn">🕐 Buka Shift</button>
            </div>
        `;
    }
    if (!mine) {
        // Shift milik kasir lain. Admin/owner boleh menutupnya; kasir biasa
        // hanya bisa membuka shift sendiri (shift lain = info read-only).
        const actions = isAdmin
            ? `
                <button class="smart-btn smart-btn-primary" id="pos-shift-open-btn">🕐 Buka Shift Saya</button>
                <button class="smart-btn smart-btn-danger" id="pos-shift-close-btn">🧾 Tutup Shift</button>
            `
            : `<button class="smart-btn smart-btn-primary" id="pos-shift-open-btn">🕐 Buka Shift Saya</button>`;
        return `
            <div class="pos-shift-banner ${isAdmin ? "" : "pos-shift-empty"}">
                <div>
                    <strong>Shift aktif oleh ${esc(shift.kasir || "Kasir lain")}</strong>
                    <br/><small class="cn-muted">Buka ${new Date(shift.waktuMulai).toLocaleString("id-ID")} — ${isAdmin ? "Anda (admin) dapat menutup shift kasir ini." : "kasir lain sedang bertugas. Tutup shift hanya untuk shift milik Anda."}</small>
                </div>
                <div class="pos-shift-kas">Kas awal: <strong>Rp ${formatRupiah(shift.kasAwal)}</strong></div>
                ${actions}
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
            <td class="cn-text-right ${Number(s.totalRefund) ? "cn-danger" : "cn-muted"}">${Number(s.totalRefund) ? `− ${formatRupiah(s.totalRefund)}` : "−"}</td>
            <td class="cn-text-right">Rp ${formatRupiah(s.penjualanTunai)}</td>
            <td class="cn-text-right">Rp ${formatRupiah(s.penjualanNonTunai)}</td>
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
                    <th>Penjualan</th><th>Refund</th><th>Tunai</th><th>Non-Tunai</th><th>Expected</th><th>Actual</th><th>Selisih</th><th>Status</th>
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
            // M6-FIX — multi-kasir: shift milik kasir LOGIN ditampilkan sebagai
            // shift aktif (bisa ditutup); shift kasir lain (termasuk fallback
            // legacy single-shift) tampil sebagai INFO read-only, dan tombol
            // Buka Shift tetap tersedia untuk kasir ini.
            const myName = currentUserName().toLowerCase();
            const isAdmin = currentUserRole() !== "kasir";
            const openShifts = res?.data || [];
            state.openShifts = openShifts;
            const mine = myName
                ? openShifts.find(s => String(s.kasir || "").toLowerCase() === myName)
                : openShifts[0];
            // Admin melihat shift aktif kasir lain sebagai shift yang BISA
            // ditutup; kasir biasa hanya shift miliknya (fallback legacy tetap).
            const singleOther = (!mine && openShifts.length === 1) ? openShifts[0] : null;
            state.activeShift = mine || (isAdmin ? (openShifts[0] || null) : singleOther) || null;
            const isMine = Boolean(mine);
            activeEl.innerHTML = activeShiftCard(state.activeShift, isMine, isAdmin);
            const openBtn = activeEl.querySelector("#pos-shift-open-btn");
            if (openBtn) openBtn.addEventListener("click", () => openShiftModal(container));
            const closeBtn = activeEl.querySelector("#pos-shift-close-btn");
            if (closeBtn) closeBtn.addEventListener("click", () => {
                // Admin menutup shift kasir lain → kirim target kasir.
                const target = (!isMine && state.activeShift)
                    ? { name: state.activeShift.kasir, username: state.activeShift.kasirUsername }
                    : {};
                closeShiftModal(container, target);
            });
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

async function openShiftModal(container) {
    // M6-FIX — pilihan nama kasir bila ada >1 kasir (daftar dari Settings API).
    // Kasir yang sedang login dipilih otomatis (fallback: kasir pertama).
    let kasirList = [];
    let selected = null;
    try {
        const s = await getPosSettings();
        kasirList = Array.isArray(s?.kasirUsers) ? s.kasirUsers : [];
    } catch (err) {
        console.warn("[Shift] Gagal memuat daftar kasir:", err?.message);
    }
    const me = currentUserName().toLowerCase();
    if (kasirList.length) {
        selected = kasirList.find(k => String(k.nama || "").trim().toLowerCase() === me)
            || (kasirList.length === 1 ? kasirList[0] : null);
    }

    const kasirSelectHTML = kasirList.length > 1
        ? `
            <label for="f-shift-kasir">Kasir</label>
            <select class="smart-input" id="f-shift-kasir">
                ${kasirList.map(k => `<option value="${esc(k.username || k.nama)}" ${selected && k.username === selected.username ? "selected" : ""}>${esc(k.nama || k.username)}${String(k.nama || "").trim().toLowerCase() === me ? " (Anda)" : ""}</option>`).join("")}
            </select>
        `
        : "";

    const content = `
        <p class="cn-muted">Masukkan kas awal (uang fisik di laci kas) saat membuka shift.</p>
        <div class="bl-form" style="margin-top:10px">
            ${kasirSelectHTML}
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
        const kasirSel = overlay.querySelector("#f-shift-kasir");
        const picked = kasirSel
            ? kasirList.find(k => String(k.username || k.nama) === kasirSel.value) || null
            : selected;
        try {
            await openShift(kasAwal, catatan, picked ? { name: picked.nama, username: picked.username } : {});
            showToast("success", `Shift dibuka untuk ${esc(picked ? (picked.nama || picked.username) : (currentUserName() || "Kasir"))} — kas awal Rp ${formatRupiah(kasAwal)}`);
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal membuka shift");
        }
    });
}

function closeShiftModal(container, target = {}) {
    // Normalisasi target: terima { name, username } (call site) ATAU objek
    // shift mentah { kasir, kasirUsername } (defensif) — sama-sama valid.
    const t = {
        name: (target && (target.name || target.kasir)) || "",
        username: (target && (target.username || target.kasirUsername)) || ""
    };
    const targetName = String(t.name || "").trim();
    // M6-FIX v2 — pilihan kasir mana yang shift-nya ditutup (seperti buka shift).
    // Hanya tampil bila ada >1 shift open; admin/owner bisa memilih kasir mana
    // pun, kasir biasa tetap hanya shift miliknya (opsi-nya disaring).
    const openShifts = state.openShifts || [];
    const myName = currentUserName().toLowerCase();
    const isAdmin = currentUserRole() !== "kasir";
    const kasirOptions = openShifts
        .filter(s => isAdmin || String(s.kasir || "").toLowerCase() === myName)
        .map(s => {
            const sel = targetName && String(s.kasir || "").trim() === targetName;
            return `<option value="${esc(s.kasir || "")}" ${sel ? "selected" : ""}>${esc(s.kasir || "Kasir")}${s.kasAwal ? ` — kas awal Rp ${formatRupiah(s.kasAwal)}` : ""}</option>`;
        });
    // Tampilkan dropdown hanya bila ada ≥2 opsi kasir (seperti buka shift) —
    // kasir biasa yang menutup shift sendiri tidak perlu memilih.
    const kasirSelectHTML = kasirOptions.length >= 2
        ? `
            <label for="f-close-kasir">Kasir</label>
            <select class="smart-input" id="f-close-kasir">${kasirOptions.join("")}</select>
        `
        : "";
    // M6-FIX v3 — ringkasan shift (saldo awal, tunai, non-tunai, kas
    // diharapkan = saldo awal + penjualan tunai) + selisih live vs actual.
    let summary = null;
    const content = `
        <p class="cn-muted">Cocokkan uang fisik di laci. Kas diharapkan = saldo awal + penjualan tunai.</p>
        <div class="bl-form" style="margin-top:10px">
            ${kasirSelectHTML}
            <div class="shift-summary" id="f-shift-summary"><div class="cn-muted">Memuat ringkasan…</div></div>
            <label for="f-actual-cash">Actual Cash (Rp)</label>
            <input class="smart-input" id="f-actual-cash" type="text" inputmode="numeric" value="0" autocomplete="off" />
            <div class="shift-selisih" id="f-shift-selisih"></div>
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

    const renderSelisih = () => {
        const el = overlay.querySelector("#f-shift-selisih");
        if (!el) return;
        if (!summary) { el.innerHTML = ""; return; }
        const actual = Number(String(actualEl?.value || "0").replace(/\D/g, "")) || 0;
        const diff = actual - summary.expectedCash;
        if (diff === 0) {
            el.innerHTML = `<div class="shift-selisih-ok">✓ Kas pas — actual sesuai kas diharapkan (Rp ${formatRupiah(summary.expectedCash)})</div>`;
        } else if (diff > 0) {
            el.innerHTML = `<div class="shift-selisih-warn">➕ Kas lebih <strong>Rp ${formatRupiah(diff)}</strong> dari kas diharapkan</div>`;
        } else {
            el.innerHTML = `<div class="shift-selisih-warn shift-selisih-minus">➖ Kas kurang <strong>Rp ${formatRupiah(Math.abs(diff))}</strong> — cek kembali hitungan fisik</div>`;
        }
    };

    const loadSummary = async (name = "", username = "") => {
        const q = new URLSearchParams();
        if (name) q.set("kasir", name);
        if (username) q.set("kasirUsername", username);
        const qs = q.toString();
        try {
            const res = await apiCall("GET", `/pos/shift/summary${qs ? `?${qs}` : ""}`);
            if (res && typeof res.expectedCash === "number") {
                summary = res;
                const rowsEl = overlay.querySelector("#f-shift-summary");
                if (rowsEl) {
                    rowsEl.innerHTML = `
                        <div class="shift-summary-row"><span>Saldo Awal</span><strong>Rp ${formatRupiah(res.kasAwal)}</strong></div>
                        <div class="shift-summary-row"><span>Penjualan Tunai</span><strong>Rp ${formatRupiah(res.penjualanTunai)}</strong></div>
                        <div class="shift-summary-row"><span>Penjualan Non-Tunai</span><strong>Rp ${formatRupiah(res.penjualanNonTunai)}</strong></div>
                        ${Number(res.totalRefund) ? `<div class="shift-summary-row shift-summary-refund"><span>Refund (order dibatalkan)</span><strong>− Rp ${formatRupiah(res.totalRefund)}</strong></div>` : ""}
                        <div class="shift-summary-row shift-summary-sub"><span>Total Penjualan (${res.totalTransaksi} transaksi)${Number(res.totalRefund) ? " — sudah dipotong refund" : ""}</span><strong>Rp ${formatRupiah(res.totalPenjualan)}</strong></div>
                        <div class="shift-summary-row shift-summary-expected"><span>Kas Diharapkan (saldo awal + tunai)</span><strong>Rp ${formatRupiah(res.expectedCash)}</strong></div>
                    `;
                }
                renderSelisih();
            }
        } catch (err) {
            const rowsEl = overlay.querySelector("#f-shift-summary");
            if (rowsEl) rowsEl.innerHTML = `<div class="cn-muted">Ringkasan tidak tersedia — server akan menghitung saat tutup.</div>`;
        }
    };

    loadSummary(t.name, t.username);
    const kasirSel = overlay.querySelector("#f-close-kasir");
    if (kasirSel) {
        kasirSel.addEventListener("change", () => {
            const picked = openShifts.find(s => String(s.kasir || "") === kasirSel.value);
            summary = null;
            const rowsEl = overlay.querySelector("#f-shift-summary");
            if (rowsEl) rowsEl.innerHTML = `<div class="cn-muted">Memuat ringkasan…</div>`;
            if (picked) loadSummary(picked.kasir, picked.kasirUsername);
        });
    }

    actualEl?.addEventListener("input", () => {
        const digits = String(actualEl.value || "").replace(/\D/g, "");
        actualEl.value = digits ? Number(digits).toLocaleString("id-ID") : "0";
        renderSelisih();
    });
    overlay.querySelector("#f-shift-cancel")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#f-shift-confirm")?.addEventListener("click", async () => {
        const actualCash = Number(String(actualEl?.value || "0").replace(/\D/g, "")) || 0;
        const catatan = overlay.querySelector("#f-shift-catatan")?.value?.trim() || "";
        // Kasir terpilih dari dropdown → target closeShift (admin/owner).
        let closeTarget = t;
        const kasirSel = overlay.querySelector("#f-close-kasir");
        if (kasirSel && kasirSel.value) {
            const picked = openShifts.find(s => String(s.kasir || "") === kasirSel.value);
            if (picked) closeTarget = { name: picked.kasir, username: picked.kasirUsername };
        }
        try {
            const closed = await closeShift(actualCash, catatan, closeTarget);
            const diff = Number(closed.difference) || 0;
            const diffTxt = `${diff > 0 ? "+" : ""}${formatRupiah(diff)}`;
            const who = (closeTarget && String(closeTarget.name || "").trim())
                ? ` (${esc(String(closeTarget.name).trim())})`
                : "";
            showToast("success", `Shift ditutup${who} — expected Rp ${formatRupiah(closed.expectedCash)}, selisih ${diffTxt}`);
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
