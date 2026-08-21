/**
 * Kitchen Page — Chef / Kitchen Display (F&B Customer Ordering V1).
 *
 * Chef melihat order F&B (meja, item, qty, catatan) dan mengubah status:
 *   NEW → [ TERIMA ] → PREPARING → [ PESANAN SIAP ] → READY
 *
 * Saat PESANAN SIAP ditekan, backend mengirim Web Push ke customer order
 * tsb (pesan: "Pesanan Anda sudah siap — silakan mengambil pesanan di kasir").
 *
 * Role CHEF: hanya permission pos.kitchen.view / pos.kitchen.update —
 * TIDAK bisa Settings/User/Payment/Void/Laporan (RBAC server-side).
 * Gate: capability "fnb".
 *
 * @module pos/pages/kitchen
 */

import { showToast, Modal } from "@smart/ui";
import { Auth, esc, formatDateTime } from "@smart/core";
import { listKitchenOrders, updateKitchenStatus, getKitchenOrder, cancelKitchenOrder, cancelKitchenOrderItems } from "../../data/table-order-data.js";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "../../data/notification-data.js";
import { getCompanyByCode } from "../../data/index.js";
import { speak, playAlertTone } from "../../utils/audio-notify.js";
import { posDashboardCSS } from "../pos-styles.js";

const state = {
    loading: true,
    error: "",
    orders: [],
    // view: "board" (HANYA order hari ini) | "history" (riwayat per tanggal)
    view: "board",
    historyDate: todayISO(),
    // Auto-refresh tiap 15 detik — kitchen display live sederhana (tanpa WS).
    timer: null
};

/** Tanggal hari ini lokal (server WIB) format "YYYY-MM-DD" — filter riwayat. */
function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

const KITCHEN_LABEL = {
    new: "Baru", preparing: "Dibuat", ready: "Siap",
    served: "Disajikan", collected: "Diambil", cancelled: "Dibatalkan"
};
const KITCHEN_CLS = {
    new: "kc-new", preparing: "kc-preparing", ready: "kc-ready",
    served: "kc-done", collected: "kc-done", cancelled: "kc-done"
};

/**
 * Mode chef STANDALONE: halaman Kitchen dirender TANPA AppShell/sidebar
 * (role chef di-boot langsung via renderKitchenApp di main.js) — chef hanya
 * melihat halaman ini, tidak ada menu navigasi ke halaman lain. Admin/owner
 * yang membuka halaman Kitchen tetap memakai AppShell normal (ada sidebar).
 * @returns {boolean}
 */
function isChefStandalone() {
    try {
        const user = Auth.user && Auth.user();
        return Boolean(user && String(user.role || "").toLowerCase() === "chef");
    } catch {
        return false;
    }
}

const LOGOUT_ICON = `<svg class="kc-logout-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

export function KitchenPage() {
    const standalone = isChefStandalone();
    return `
        <div class="page-container pos-dash-page ${standalone ? "kc-standalone" : ""}">
            <style>${posDashboardCSS()}
            .kc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
            .kc-card { border:1px solid var(--smart-border,#e2e8f0); border-radius:12px; background:var(--smart-card-bg,#fff); overflow:hidden; }
            .kc-card.kc-new { border-left:4px solid #3b82f6; }
            .kc-card.kc-preparing { border-left:4px solid #f59e0b; }
            .kc-card.kc-ready { border-left:4px solid #667eea; }
            .kc-head { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--smart-border,#e2e8f0); }
            .kc-meja { font-weight:700; font-size:1.1rem; }
            .kc-orderid { font-size:0.78rem; color:var(--smart-text-secondary,#64748b); }
            .kc-body { padding:10px 14px; }
            .kc-item { display:flex; justify-content:space-between; gap:8px; padding:3px 0; font-size:0.9rem; align-items:center; }
            .kc-item-qty { font-weight:700; min-width:34px; }
            .kc-item-cancel {
                flex:0 0 auto; width:22px; height:22px; line-height:1; border-radius:6px;
                border:1px solid #fca5a5; background:transparent; color:#dc2626;
                font-size:0.75rem; font-weight:800; cursor:pointer; padding:0;
            }
            .kc-item-cancel:hover { background:#fef2f2; }
            [data-theme="dark"] .kc-item-cancel { border-color:#7f1d1d; color:#fca5a5; }
            .kc-item-cancelled { opacity:0.55; text-decoration:line-through; }
            .kc-note { font-size:0.76rem; color:var(--smart-text-secondary,#64748b); }
            .kc-status { font-size:0.72rem; font-weight:700; padding:2px 10px; border-radius:999px; }
            .kc-status-new { background:#dbeafe; color:#1e40af; }
            .kc-status-preparing { background:#fef3c7; color:#92400e; }
            .kc-status-ready { background:#e0e7ff; color:#3730a3; }
            .kc-foot { padding:10px 14px; border-top:1px solid var(--smart-border,#e2e8f0); display:flex; gap:8px; }
            .kc-foot .smart-btn { flex:1; }
            /* F&B V1 — tombol BATALKAN kecil di samping TERIMA/PESANAN SIAP:
               flex:0 (tidak melebar), padding ringkas, gaya bahaya (merah). */
            .kc-foot .kc-cancel-btn { flex:0 0 auto !important; padding:6px 10px !important; font-size:0.8rem !important; font-weight:700; background:transparent; border:1px solid #fca5a5; color:#dc2626; }
            .kc-foot .kc-cancel-btn:hover { background:#fef2f2; }
            [data-theme="dark"] .kc-foot .kc-cancel-btn { border-color:#7f1d1d; color:#fca5a5; }
            [data-theme="dark"] .kc-foot .kc-cancel-btn:hover { background:#7f1d1d33; }
            .kc-ready-msg { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; padding:8px 12px; border-radius:8px; font-size:0.82rem; margin-top:8px; }
            [data-theme="dark"] .kc-card { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); }
            [data-theme="dark"] .kc-status-new { background:#1e40af33; color:#93c5fd; }
            [data-theme="dark"] .kc-status-preparing { background:#92400e33; color:#fcd34d; }
            [data-theme="dark"] .kc-status-ready { background:#3730a333; color:#a5b4fc; }
            .cn-alert-danger { padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem; margin-bottom:12px; }
            .kc-live-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#667eea; margin-right:6px; animation:kc-pulse 1.6s infinite; }
            @keyframes kc-pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
            /* Role-Based Notification Bell (F&B V1) — order baru masuk */
            .kc-bell-btn {
                position:relative; display:none; align-items:center; gap:6px;
                padding:7px 11px; border:1px solid var(--smart-border,#e2e8f0); border-radius:8px;
                background:var(--smart-card-bg,#fff); color:var(--smart-text,#1e293b); cursor:pointer;
                font-size:0.95rem; font-weight:600; white-space:nowrap; transition:background 0.15s;
            }
            .kc-bell-btn:hover { background:#f1f5f9; }
            .kc-bell-count {
                position:absolute; top:-5px; right:-5px; min-width:18px; height:18px; padding:0 4px;
                border-radius:999px; background:#ef4444; color:#fff; font-size:0.7rem; font-weight:700;
                display:none; align-items:center; justify-content:center;
            }
            .kc-bell-item { padding:10px 12px; border:1px solid var(--smart-border,#e2e8f0); border-radius:10px; margin-bottom:8px; }
            .kc-bell-item.read { opacity:0.72; }
            .kc-bell-item-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
            .kc-bell-item-title { font-weight:700; font-size:0.88rem; }
            .kc-bell-dot { width:8px; height:8px; border-radius:50%; background:#ef4444; flex-shrink:0; }
            .kc-bell-item-msg { font-size:0.82rem; color:var(--smart-text-secondary,#64748b); margin-top:2px; line-height:1.4; }
            .kc-bell-item-meta { font-size:0.72rem; color:var(--smart-text-secondary,#64748b); margin-top:4px; }
            .kc-order-detail-row { display:flex; justify-content:space-between; gap:10px; font-size:0.85rem; padding:3px 0; }
            .kc-order-detail-note { font-size:0.76rem; color:var(--smart-text-secondary,#64748b); }
            [data-theme="dark"] .kc-bell-btn { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); color:#e2e8f0; }
            [data-theme="dark"] .kc-bell-btn:hover { background:#334155; }
            /* F&B M6-FIX — tombol Riwayat (toggle) + bar filter tanggal */
            .kc-history-btn {
                display:inline-flex; align-items:center; gap:6px;
                padding:7px 11px; border:1px solid var(--smart-border,#e2e8f0); border-radius:8px;
                background:var(--smart-card-bg,#fff); color:var(--smart-text,#1e293b); cursor:pointer;
                font-size:0.88rem; font-weight:600; white-space:nowrap; transition:background 0.15s;
            }
            .kc-history-btn:hover { background:#f1f5f9; }
            .kc-history-btn.active { background:#dbeafe; border-color:#93c5fd; color:#1e40af; }
            [data-theme="dark"] .kc-history-btn { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); color:#e2e8f0; }
            [data-theme="dark"] .kc-history-btn:hover { background:#334155; }
            [data-theme="dark"] .kc-history-btn.active { background:#1e40af33; border-color:#1e40af; color:#93c5fd; }
            .kc-history-bar {
                display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                margin-bottom:12px; padding:10px 12px;
                border:1px solid var(--smart-border,#e2e8f0); border-radius:10px;
                background:var(--smart-card-bg,#fff);
            }
            .kc-history-bar label { font-size:0.8rem; font-weight:600; color:var(--smart-text-secondary,#64748b); }
            .kc-history-bar .smart-input { width:auto; }
            [data-theme="dark"] .kc-history-bar { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); }
            /* Order SELESAI (served/collected/cancelled) — kartu redup */
            .kc-card.kc-done { opacity:0.62; }
            .kc-status-served, .kc-status-collected { background:#e2e8f0; color:#334155; }
            .kc-status-cancelled { background:#fef2f2; color:#b91c1c; }
            [data-theme="dark"] .kc-status-served, [data-theme="dark"] .kc-status-collected { background:#334155; color:#cbd5e1; }
            [data-theme="dark"] .kc-status-cancelled { background:#7f1d1d33; color:#fca5a5; }
            /* Tombol CETAK ORDER (dengan checklist) */
            .kc-foot .kc-print-btn { flex:0 0 auto !important; padding:6px 10px !important; font-size:0.78rem !important; font-weight:700; }
            .kc-foot .kc-done-msg { flex:1; }
            /* ── Mode STANDALONE (role chef — tanpa AppShell/sidebar) ── */
            .kc-standalone { min-height:100vh; min-height:100dvh; box-sizing:border-box; margin:0; padding:14px 16px 24px; background:var(--smart-bg,#f1f5f9); }
            [data-theme="dark"] .kc-standalone { background:#0f172a; }
            .kc-logout-btn {
                display:inline-flex; align-items:center; gap:6px;
                padding:7px 14px; border:1px solid rgba(255,255,255,0.55); border-radius:999px;
                background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); color:#fff; cursor:pointer;
                font-size:0.8rem; font-weight:600; white-space:nowrap;
                box-shadow:0 6px 14px rgba(72, 106, 224, 0.35);
                transition:background 0.2s, transform 0.15s;
            }
            .kc-logout-btn:hover { background:linear-gradient(135deg, #a935f4 0%, #3f80ff 100%); transform:translateY(-1px); }
            .kc-logout-btn:active { transform:scale(0.97); }
            .kc-logout-icon { vertical-align:-2px; }
            </style>
            <div class="page-header">
                <div>
                    <h1>Kitchen <span class="kc-live-dot"></span><span style="font-size:0.85rem" class="cn-muted">Live</span></h1>
                    <p class="page-subtitle">Order F&B dari QR Menu Meja — TERIMA lalu PESANAN SIAP (notifikasi customer otomatis)</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button id="kc-bell-btn" class="kc-bell-btn" title="Notifikasi order baru" aria-label="Notifikasi order baru" style="display:none">🔔<span id="kc-bell-count" class="kc-bell-count">0</span></button>
                    <button id="kc-history-toggle" class="kc-history-btn ${state.view === "history" ? "active" : ""}" title="Tampilkan riwayat order dengan filter tanggal" aria-label="Riwayat order">${state.view === "history" ? "← Order Aktif" : "📅 Riwayat"}</button>
                    <button class="smart-btn smart-btn-secondary" id="kc-refresh">↻ Refresh</button>
                    ${standalone ? `<button id="kc-logout" class="kc-logout-btn" title="Keluar dari Kitchen" aria-label="Keluar">${LOGOUT_ICON} Logout</button>` : ""}
                </div>
            </div>
            <div id="kc-history-bar-wrap"></div>
            <div id="kc-status"></div>
            <div id="kc-grid" class="kc-grid">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat order kitchen...</div>` : ""}</div>
        </div>
    `;
}

/**
 * Bar filter tanggal (RIWAYAT) — dirender ulang saat toggle view berubah.
 * @param {HTMLElement} container
 */
function renderHistoryBar(container) {
    const wrap = container.querySelector("#kc-history-bar-wrap");
    if (!wrap) return;
    if (state.view !== "history") {
        wrap.innerHTML = "";
        return;
    }
    wrap.innerHTML = `
        <div class="kc-history-bar">
            <label for="kc-history-date">📅 Tanggal</label>
            <input type="date" id="kc-history-date" class="smart-input" value="${esc(state.historyDate)}" />
            <span class="cn-muted">Riwayat order ${esc(state.historyDate)} — semua status (termasuk selesai & batal)</span>
        </div>
    `;
    wrap.querySelector("#kc-history-date")?.addEventListener("change", (e) => {
        if (e.target && e.target.value) {
            state.historyDate = String(e.target.value);
            load(container);
        }
    });
}

function renderStatus(container) {
    const el = container.querySelector("#kc-status");
    if (!el) return;
    el.innerHTML = state.error ? `<div class="cn-alert-danger">${esc(state.error)}</div>` : "";
}

function renderGrid(container) {
    const grid = container.querySelector("#kc-grid");
    if (!grid) return;
    if (state.loading) {
        grid.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat order kitchen...</div>`;
        return;
    }
    if (!state.orders.length) {
        grid.innerHTML = `<div class="cn-empty">${state.view === "history"
            ? `Tidak ada order kitchen pada tanggal ${esc(state.historyDate)}.`
            : "Tidak ada order kitchen hari ini. Order baru dari QR Menu Meja akan muncul di sini."}</div>`;
        return;
    }
    grid.innerHTML = state.orders.map(o => {
        const status = o.kitchenStatus || "new";
        const id = esc(String(o._id));
        // F&B V1 — tombol [✕ BATALKAN SEMUA] kecil di samping TERIMA /
        // PESANAN SIAP (sebelum order siap). Membatalkan seluruh order.
        const cancelAllBtn = `<button class="smart-btn kc-cancel-btn" data-kc-cancel="${id}" title="Batalkan seluruh pesanan" aria-label="Batalkan seluruh pesanan">✕ BATALKAN SEMUA</button>`;
        // F&B M6-FIX — tombol CETAK ORDER (dengan checklist ☐ per item).
        const printBtn = `<button class="smart-btn kc-print-btn" data-kc-print="${id}" title="Cetak order dengan checklist item" aria-label="Cetak order">🖨️ Cetak</button>`;
        let foot = "";
        if (status === "new") {
            foot = `<button class="smart-btn smart-btn-primary" data-kc-action="${id}" data-kc-to="preparing">👨‍🍳 TERIMA</button>${cancelAllBtn}`;
        } else if (status === "preparing") {
            foot = `<button class="smart-btn smart-btn-success" data-kc-action="${id}" data-kc-to="ready">🔔 PESANAN SIAP</button>${cancelAllBtn}`;
        } else if (status === "ready") {
            foot = `<div class="kc-ready-msg kc-done-msg">✅ Order siap — customer sudah diberi notifikasi. Silakan serahkan ke kasir.</div>`;
        } else if (status === "cancelled") {
            foot = `<div class="kc-ready-msg kc-done-msg" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c">❌ Order dibatalkan${o.cancelledBy ? ` oleh ${esc(o.cancelledBy)}` : ""}</div>`;
        } else {
            foot = `<div class="kc-ready-msg kc-done-msg">✅ Selesai — ${o.servedAt ? `diserahkan ${formatDateTime(o.servedAt)}` : "order ditutup"}</div>`;
        }
        foot += printBtn;
        // F&B V1 — pembatalan hanya berlaku SEBELUM order siap (new/preparing):
        // tombol ✕ (per-item & Batalkan Semua) disembunyikan saat order sudah
        // ready/served/collected — barang sudah diserahkan, tidak bisa dibatalkan.
        const cancellable = status === "new" || status === "preparing";
        // F&B V1 — kitchen HANYA melihat item resep (kitchenItems); barang
        // dagangan/jasa diserahkan bersamaan saat resep selesai (oleh kasir).
        // Baris yang SUDAH dibatalkan (per-item) disembunyikan dari antrean
        // aktif (ditampilkan tercoret bila masih relevan).
        const items = ((Array.isArray(o.kitchenItems) && o.kitchenItems.length) ? o.kitchenItems : o.items)
            .filter(i => !i || !i.cancelled);
        const cancelledKitchen = ((Array.isArray(o.kitchenItems) && o.kitchenItems.length) ? o.kitchenItems : o.items)
            .filter(i => i && i.cancelled);
        return `
            <div class="kc-card ${KITCHEN_CLS[status] || "kc-new"}">
                <div class="kc-head">
                    <div>
                        <div class="kc-meja">${esc(o.nomorMeja)}</div>
                        <div class="kc-orderid">${esc(o.orderId)} · ${formatDateTime(o.createdAt)}</div>
                    </div>
                    <span class="kc-status kc-status-${status}">${KITCHEN_LABEL[status] || status}</span>
                </div>
                <div class="kc-body">
                    ${(items || []).map(i => `
                        <div class="kc-item">
                            <span><span class="kc-item-qty">${i.qty}×</span> ${esc(i.nama)}</span>
                            ${cancellable && String(i.itemId || "").trim()
                                ? `<button class="kc-item-cancel" data-kc-item-cancel="${id}" data-kc-item-id="${esc(String(i.itemId))}" title="Batalkan item ini" aria-label="Batalkan item ${esc(i.nama)}">✕</button>`
                                : ""}
                        </div>
                        ${i.catatan ? `<div class="kc-note">📝 ${esc(i.catatan)}</div>` : ""}
                    `).join("")}
                    ${cancelledKitchen.length ? `<div class="kc-note" style="margin-top:6px;color:#dc2626">🗑️ ${cancelledKitchen.length} item telah dibatalkan</div>` : ""}
                    ${o.catatanOrder ? `<div class="kc-note" style="margin-top:6px">📝 ${esc(o.catatanOrder)}</div>` : ""}
                </div>
                <div class="kc-foot">${foot}</div>
            </div>
        `;
    }).join("");
    grid.querySelectorAll("[data-kc-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            doUpdate(container, btn.dataset.kcAction, btn.dataset.kcTo);
        });
    });
    grid.querySelectorAll("[data-kc-cancel]").forEach(btn => {
        btn.addEventListener("click", () => {
            doCancel(container, btn.dataset.kcCancel);
        });
    });
    grid.querySelectorAll("[data-kc-item-cancel]").forEach(btn => {
        btn.addEventListener("click", () => {
            doCancelItem(container, btn.dataset.kcItemCancel, btn.dataset.kcItemId);
        });
    });
    grid.querySelectorAll("[data-kc-print]").forEach(btn => {
        btn.addEventListener("click", () => {
            printKitchenOrder(btn.dataset.kcPrint);
        });
    });
}

/**
 * CETAK ORDER KITCHEN — tiket thermal 80mm dengan KOTAK CHECKLIST ☐ per
 * item, agar kitchen bisa mencentang setiap item saat dikerjakan (tanpa
 * harus kembali ke layar). Memakai pola struk kasir (window.print).
 * @param {string} id TableOrder._id
 */
async function printKitchenOrder(id) {
    let order = state.orders.find(o => String(o._id) === String(id)) || null;
    if (!order) {
        try {
            order = await getKitchenOrder(id);
        } catch (err) {
            return showToast("danger", err?.message || "Gagal memuat order untuk dicetak");
        }
    }
    if (!order) return showToast("warning", "Order tidak ditemukan");

    const company = await resolveKitchenCompanyName();
    const items = ((Array.isArray(order.kitchenItems) && order.kitchenItems.length) ? order.kitchenItems : order.items) || [];
    const statusLabel = KITCHEN_LABEL[order.kitchenStatus] || order.kitchenStatus || "";
    const rows = items.map(i => `
        <tr>
            <td style="padding:2px 0;font-size:10px;white-space:nowrap">☐</td>
            <td style="padding:2px 0;font-size:10px;">${i.qty}× ${esc(i.nama)}${i.cancelled ? " <span style='color:#b91c1c'>(BATAL)</span>" : ""}</td>
        </tr>
        ${i.catatan ? `<tr><td></td><td style="padding:0 0 3px;font-size:8px;color:#444">📝 ${esc(i.catatan)}</td></tr>` : ""}
    `).join("");
    const noteLine = order.catatanOrder ? `<div class="info">📝 Order: ${esc(order.catatanOrder)}</div>` : "";
    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Order ${esc(order.orderId)}</title>
<style>
    @page { margin:0; size:80mm auto; }
    body { font-family:'Courier New',Courier,monospace; margin:0; padding:4mm; width:72mm; color:#000; font-size:9px; line-height:1.35; }
    .header { text-align:center; margin-bottom:4px; }
    .header .name { font-size:13px; font-weight:bold; }
    .header .sub { font-size:8px; }
    .divider { border-top:1px dashed #000; margin:4px 0; }
    .info { font-size:8px; margin-bottom:2px; }
    table { width:100%; border-collapse:collapse; }
    td { font-size:10px; padding:2px 0; }
    .footer { text-align:center; font-size:8px; margin-top:6px; }
    @media print { body { width:72mm; } }
</style></head>
<body>
    <div class="header">
        <div class="name">${esc(company || "KITCHEN ORDER")}</div>
        <div class="sub">TIKET ORDER DAPUR — checklist item</div>
    </div>
    <div class="divider"></div>
    <div class="info">Order : ${esc(order.orderId)}</div>
    <div class="info">Meja  : ${esc(order.nomorMeja)}</div>
    <div class="info">Tgl   : ${new Date(order.createdAt || Date.now()).toLocaleString("id-ID")}</div>
    <div class="info">Status: ${esc(statusLabel)}</div>
    ${noteLine}
    <div class="divider"></div>
    <table>
        ${rows}
    </table>
    <div class="divider"></div>
    <div class="footer">Centang ☐ pada setiap item saat selesai</div>
    <script>window.print();window.close();<\/script>
</body></html>`;
    printToWindow(html);
}

/** Nama perusahaan utk tiket cetak (cache sekali; fallback kode company). */
let kcCompanyName = "";
async function resolveKitchenCompanyName() {
    if (kcCompanyName) return kcCompanyName;
    try {
        const code = (Auth.user && Auth.user() && Auth.user().institution) || "";
        if (code) {
            const company = await getCompanyByCode(code);
            if (company && company.name) kcCompanyName = String(company.name);
        }
    } catch { /* fallback label generik */ }
    return kcCompanyName;
}

/** Buka window print utk HTML tiket (pola struk kasir). */
function printToWindow(html) {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) {
        showToast("danger", "Pop-up diblokir — izinkan pop-up untuk mencetak order");
        return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
}

/**
 * BATALKAN SATU ITEM (kitchen — per-item). Item lain tetap dibuat; kasir &
 * customer diberi notifikasi; bila order sudah lunas → refund PARSIAL.
 * @param {HTMLElement} container
 * @param {string} orderId TableOrder._id
 * @param {string} itemId itemId baris
 */
async function doCancelItem(container, orderId, itemId) {
    if (!itemId) return;
    const ok = window.confirm("Batalkan item ini saja? Item lain pada pesanan tetap dibuat.\n\nKasir dan pelanggan akan diberi notifikasi; bila pesanan sudah lunas, kasir memproses refund parsial.");
    if (!ok) return;
    try {
        await cancelKitchenOrderItems(orderId, [itemId]);
        showToast("success", "Item dibatalkan — kasir & pelanggan diberi notifikasi");
        load(container, true);
    } catch (err) {
        showToast("danger", err?.message || "Gagal membatalkan item");
        load(container, true);
    }
}

/**
 * BATALKAN SELURUH order (kitchen). Konfirmasi dulu — pembatalan
 * memberitahu kasir (bell) & customer (web push); bila order sudah lunas,
 * kasir wajib refund (penuh).
 * @param {HTMLElement} container
 * @param {string} id TableOrder._id
 */
async function doCancel(container, id) {
    const ok = window.confirm("Batalkan SELURUH pesanan ini? Semua item dibatalkan (termasuk barang dagangan).\n\nKasir dan pelanggan akan diberi notifikasi; bila pesanan sudah lunas, kasir akan memproses refund.");
    if (!ok) return;
    try {
        await cancelKitchenOrder(id);
        showToast("success", "Pesanan dibatalkan — kasir & pelanggan diberi notifikasi");
        load(container, true);
    } catch (err) {
        showToast("danger", err?.message || "Gagal membatalkan pesanan");
        load(container, true);
    }
}

async function load(container, silent = false) {
    if (!silent) {
        state.loading = true;
        renderStatus(container);
        renderGrid(container);
    }
    try {
        // BOARD (default): HANYA order HARI INI (semua status). Order dari
        // tanggal sebelumnya — termasuk yang belum selesai — hanya tampil
        // lewat tab RIWAYAT (filter tanggal).
        const params = state.view === "history"
            ? { from: state.historyDate, to: state.historyDate }
            : { today: 1 };
        const res = await listKitchenOrders(params);
        state.orders = Array.isArray(res?.data) ? res.data : [];
        state.loading = false;
        renderStatus(container);
        renderGrid(container);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat order kitchen";
        renderStatus(container);
        renderGrid(container);
    }
}

async function doUpdate(container, id, to) {
    if (to === "ready") {
        const ok = window.confirm("Tandai PESANAN SIAP? Customer akan menerima notifikasi \"Pesanan Anda sudah siap\".");
        if (!ok) return;
    }
    try {
        await updateKitchenStatus(id, to);
        showToast("success", to === "ready" ? "Order ditandai SIAP — notifikasi dikirim ke customer" : "Order diterima — sedang dibuat");
        load(container, true);
    } catch (err) {
        showToast("danger", err?.message || "Gagal mengubah status");
        load(container, true);
    }
}

// ── Role-Based Notification Bell (KITCHEN — order baru masuk) ──

// F&B V1 — audio: jumlah unread sebelumnya utk deteksi order BARU (tone + suara)
let kcLastCount = -1;

/** Inisialisasi bell kitchen: tampil (role chef), poll unread count. */
function initKitchenBell() {
    const bell = document.getElementById("kc-bell-btn");
    if (!bell) return;
    bell.style.display = "inline-flex";
    bell.addEventListener("click", openKitchenBellModal);
    kcLastCount = -1;
    refreshKitchenBellCount();
}

/** Ambil unread count notifikasi kitchen + perbarui badge bell. */
async function refreshKitchenBellCount() {
    try {
        const res = await listNotifications({ role: "kitchen", unread: true });
        const count = Array.isArray(res?.data) ? res.data.length : 0;
        const el = document.getElementById("kc-bell-count");
        if (el) {
            el.textContent = count > 99 ? "99+" : String(count);
            el.style.display = count > 0 ? "inline-flex" : "none";
        }
        // Order BARU masuk → alert suara: "Ada pesanan baru" (chef wajib TERIMA).
        if (count > kcLastCount && kcLastCount >= 0 && count > 0) {
            playAlertTone();
            speak("Ada pesanan baru yang harus diterima");
        }
        kcLastCount = count;
    } catch { /* server tidak tersedia — jangan ganggu display kitchen */ }
}

/** Modal bell kitchen — daftar "Order baru masuk" dengan [LIHAT ORDER]. */
async function openKitchenBellModal() {
    const content = `
        <div id="kc-bell-body">
            <div class="cn-loading"><span class="cn-spinner"></span> Memuat notifikasi...</div>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="kc-bell-close">Tutup</button>
    `;
    const overlay = Modal({ open: true, title: "🔔 Notifikasi Kitchen", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#kc-bell-close")?.addEventListener("click", () => overlay.remove());
    const body = overlay.querySelector("#kc-bell-body");
    try {
        const res = await listNotifications({ role: "kitchen" });
        const items = Array.isArray(res?.data) ? res.data : [];
        if (!items.length) {
            body.innerHTML = `<p class="cn-muted" style="text-align:center;padding:20px 0">Belum ada notifikasi order baru.</p>`;
            return;
        }
        body.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="cn-muted" style="font-size:0.78rem">${items.length} notifikasi</span>
                <button class="smart-btn smart-btn-secondary" id="kc-bell-read-all" style="font-size:0.75rem;padding:4px 10px">Tandai semua dibaca</button>
            </div>
            ${items.map(n => {
                const itemsSummary = (n.payload && n.payload.itemsSummary) || "";
                return `
                <div class="kc-bell-item ${n.read ? "read" : ""}" data-notif-id="${esc(String(n._id))}">
                    <div class="kc-bell-item-head">
                        <span class="kc-bell-item-title">${esc(n.title || "Order baru")}</span>
                        ${n.read ? "" : `<span class="kc-bell-dot"></span>`}
                    </div>
                    <div class="kc-bell-item-msg">${esc(n.message || "")}${itemsSummary ? `<br/><span>${esc(itemsSummary)}</span>` : ""}</div>
                    <div class="kc-bell-item-meta">${formatDateTime(n.createdAt)}</div>
                    ${n.read ? "" : `<button class="smart-btn smart-btn-primary" data-kc-bell-view="${esc(String(n._id))}" data-order-id="${esc(String(n.orderId || ""))}" style="margin-top:8px;font-size:0.8rem;padding:6px 14px">LIHAT ORDER</button>`}
                </div>
            `;
            }).join("")}
        `;
        body.querySelector("#kc-bell-read-all")?.addEventListener("click", async () => {
            try {
                await markAllNotificationsRead("kitchen");
                showToast("success", "Semua notifikasi ditandai dibaca");
                overlay.remove();
                refreshKitchenBellCount();
            } catch (err) {
                showToast("danger", err?.message || "Gagal menandai dibaca");
            }
        });
        body.querySelectorAll("[data-kc-bell-view]").forEach(btn => btn.addEventListener("click", async () => {
            try { await markNotificationRead(btn.dataset.kcBellView); } catch { /* best effort */ }
            overlay.remove();
            refreshKitchenBellCount();
            const orderId = btn.dataset.orderId;
            if (orderId) openKitchenOrderDetail(orderId);
        }));
    } catch (err) {
        body.innerHTML = `<p class="cn-muted" style="text-align:center;padding:20px 0">${esc(err?.message || "Gagal memuat notifikasi")}</p>`;
    }
}

/** Modal detail order kitchen (dibuka dari [LIHAT ORDER] bell). */
async function openKitchenOrderDetail(orderId) {
    let order = null;
    try {
        order = await getKitchenOrder(orderId);
    } catch (err) {
        return showToast("danger", err?.message || "Gagal memuat order");
    }
    if (!order) return showToast("warning", "Order tidak ditemukan");
    const status = order.kitchenStatus || "new";
    const content = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
            <div style="font-size:1.2rem;font-weight:800">${esc(order.nomorMeja)}</div>
            <div class="cn-muted" style="font-size:0.85rem">${esc(order.orderId)} · ${formatDateTime(order.createdAt)}</div>
            <span class="kc-status kc-status-${status}">${KITCHEN_LABEL[status] || status}</span>
        </div>
        ${(order.items || []).map(i => `
            <div class="kc-order-detail-row">
                <span><strong>${i.qty}×</strong> ${esc(i.nama)}</span>
            </div>
            ${i.catatan ? `<div class="kc-order-detail-note">📝 ${esc(i.catatan)}</div>` : ""}
        `).join("")}
        ${order.catatanOrder ? `<p class="kc-order-detail-note" style="margin-top:8px">📝 ${esc(order.catatanOrder)}</p>` : ""}
        ${status === "new"
            ? `<p class="kc-ready-msg" style="margin-top:10px">Order menunggu diterima — gunakan halaman Kitchen untuk TERIMA.</p>`
            : status === "preparing"
                ? `<p class="kc-ready-msg" style="margin-top:10px">Order sedang dibuat — gunakan halaman Kitchen untuk PESANAN SIAP.</p>`
                : `<p class="kc-ready-msg" style="margin-top:10px">✅ Order siap — customer sudah diberi notifikasi.</p>`}
    `;
    const footer = `<button class="smart-btn smart-btn-primary" id="kc-detail-close">Tutup</button>`;
    const overlay = Modal({ open: true, title: "Detail Order", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#kc-detail-close")?.addEventListener("click", () => overlay.remove());
}

export function initKitchenPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#kc-refresh")?.addEventListener("click", () => load(container));
    // F&B M6-FIX — toggle Riwayat / Order Aktif (dengan filter tanggal).
    const toggle = container.querySelector("#kc-history-toggle");
    if (toggle) {
        toggle.addEventListener("click", () => {
            state.view = state.view === "history" ? "board" : "history";
            toggle.textContent = state.view === "history" ? "← Order Aktif" : "📅 Riwayat";
            toggle.classList.toggle("active", state.view === "history");
            renderHistoryBar(container);
            load(container);
        });
    }
    renderHistoryBar(container);
    // Mode chef standalone (tanpa AppShell) — tombol Logout milik halaman ini.
    // handleLogout dipanggil via window hook yang di-set main.js
    // (window.__app.handleLogout tidak ada — pakai Auth.logout via event).
    container.querySelector("#kc-logout")?.addEventListener("click", () => {
        try {
            const fn = window.__handleLogout || window.__app?.handleLogout;
            if (typeof fn === "function") { fn(); return; }
        } catch { /* ignore */ }
        window.location.reload();
    });
    load(container);
    initKitchenBell();
    // Auto-refresh 15 detik (kitchen display live sederhana + unread bell).
    // Di-clear saat halaman ditutup (navigate berikutnya mengganti #content → node hilang).
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
        if (!document.body.contains(container)) {
            clearInterval(state.timer);
            state.timer = null;
            return;
        }
        load(container, true);
        refreshKitchenBellCount();
    }, 15000);
}
