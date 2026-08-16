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
import { esc, formatDateTime } from "@smart/core";
import { listKitchenOrders, updateKitchenStatus, getKitchenOrder, cancelKitchenOrder, cancelKitchenOrderItems } from "../../data/table-order-data.js";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "../../data/notification-data.js";
import { speak, playAlertTone } from "../../utils/audio-notify.js";
import { posDashboardCSS } from "../pos-styles.js";

const state = {
    loading: true,
    error: "",
    orders: [],
    // Auto-refresh tiap 15 detik — kitchen display live sederhana (tanpa WS).
    timer: null
};

const KITCHEN_LABEL = { new: "Baru", preparing: "Dibuat", ready: "Siap" };
const KITCHEN_CLS = { new: "kc-new", preparing: "kc-preparing", ready: "kc-ready" };

export function KitchenPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}
            .kc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
            .kc-card { border:1px solid var(--smart-border,#e2e8f0); border-radius:12px; background:var(--smart-card-bg,#fff); overflow:hidden; }
            .kc-card.kc-new { border-left:4px solid #3b82f6; }
            .kc-card.kc-preparing { border-left:4px solid #f59e0b; }
            .kc-card.kc-ready { border-left:4px solid #10b981; }
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
            .kc-status-ready { background:#dcfce7; color:#166534; }
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
            [data-theme="dark"] .kc-status-ready { background:#065f4633; color:#6ee7b7; }
            .cn-alert-danger { padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem; margin-bottom:12px; }
            .kc-live-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-right:6px; animation:kc-pulse 1.6s infinite; }
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
            </style>
            <div class="page-header">
                <div>
                    <h1>Kitchen <span class="kc-live-dot"></span><span style="font-size:0.85rem" class="cn-muted">Live</span></h1>
                    <p class="page-subtitle">Order F&B dari QR Menu Meja — TERIMA lalu PESANAN SIAP (notifikasi customer otomatis)</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button id="kc-bell-btn" class="kc-bell-btn" title="Notifikasi order baru" aria-label="Notifikasi order baru" style="display:none">🔔<span id="kc-bell-count" class="kc-bell-count">0</span></button>
                    <button class="smart-btn smart-btn-secondary" id="kc-refresh">↻ Refresh</button>
                </div>
            </div>
            <div id="kc-status"></div>
            <div id="kc-grid" class="kc-grid">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat order kitchen...</div>` : ""}</div>
        </div>
    `;
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
        grid.innerHTML = `<div class="cn-empty">Tidak ada order kitchen saat ini. Order baru dari QR Menu Meja akan muncul di sini.</div>`;
        return;
    }
    grid.innerHTML = state.orders.map(o => {
        const status = o.kitchenStatus || "new";
        const id = esc(String(o._id));
        // F&B V1 — tombol [✕ BATALKAN SEMUA] kecil di samping TERIMA /
        // PESANAN SIAP (sebelum order siap). Membatalkan seluruh order.
        const cancelAllBtn = `<button class="smart-btn kc-cancel-btn" data-kc-cancel="${id}" title="Batalkan seluruh pesanan" aria-label="Batalkan seluruh pesanan">✕ BATALKAN SEMUA</button>`;
        const foot = status === "new"
            ? `<button class="smart-btn smart-btn-primary" data-kc-action="${id}" data-kc-to="preparing">👨‍🍳 TERIMA</button>${cancelAllBtn}`
            : status === "preparing"
                ? `<button class="smart-btn smart-btn-success" data-kc-action="${id}" data-kc-to="ready">🔔 PESANAN SIAP</button>${cancelAllBtn}`
                : `<div class="kc-ready-msg">✅ Order siap — customer sudah diberi notifikasi. Silakan serahkan ke kasir.</div>`;
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
        const res = await listKitchenOrders();
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
