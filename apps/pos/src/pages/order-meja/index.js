/**
 * Order Meja Page — F&B Customer Ordering V1 (Kasir / Admin).
 *
 * Kasir melihat semua order meja (QR table):
 *   - Meja · Order ID · Item · Total · Metode Bayar · Status
 *   - Filter: Semua / Pending / Paid / Ready / Completed
 *   - Detail order → [ KONFIRMASI BAYAR ] (PENDING → PAID, manual)
 *
 * Order masuk kitchen TANPA menunggu payment (kitchenStatus berjalan sendiri).
 * Payment dan kitchen adalah workflow terpisah.
 *
 * Gate: capability "fnb" + permission pos.order.view (detail/confirm:
 * pos.order.confirm). Kasir mengakses halaman ini via tombol Order Meja di
 * SIDEBAR KIRI layar kasir (yang mengonfirmasi pembayaran adalah kasir,
 * bukan admin — menu admin tidak menampilkan Order Meja lagi).
 *
 * @module pos/pages/order-meja
 */

import { showToast, Modal } from "@smart/ui";
import { Auth, esc, formatDateTime } from "@smart/core";
import {
    listTableOrders,
    getTableOrder,
    confirmTableOrderPayment,
    updateTableOrderKitchen,
    refundTableOrder,
    deleteTableOrder
} from "../../data/table-order-data.js";
import { navigate } from "../../router";
import { posDashboardCSS } from "../pos-styles.js";

/** Mode kasir: dibuka dari layar kasir fullscreen (tombol Order Meja). */
function isKasirMode() {
    try {
        const user = Auth.user && Auth.user();
        return Boolean(user && String(user.role || "").toLowerCase() === "kasir");
    } catch {
        return false;
    }
}

const state = {
    loading: true,
    error: "",
    status: "pending",
    orders: []
};

const FILTERS = [
    { value: "pending", label: "🕐 Pending" },
    { value: "paid", label: "✅ Paid" },
    { value: "ready", label: "🍽️ Ready" },
    { value: "completed", label: "✔️ Completed" },
    { value: "batal", label: "🗑️ Batal" },
    { value: "all", label: "Semua" }
];

const PAYMENT_LABEL = { cash: "💵 Tunai", qris: "📱 QRIS", transfer: "🏦 Transfer" };
const KITCHEN_LABEL = { new: "Baru", preparing: "Dibuat", ready: "Siap", served: "Disajikan", collected: "Diambil", cancelled: "Dibatalkan" };

/** Style panel Order Meja — dipakai halaman standalone & panel embedded kasir. */
const OM_STYLES = `
.om-embedded-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px; }
.om-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px; }
.om-badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:0.72rem; font-weight:600; white-space:nowrap; }
.om-badge-pending { background:#fef3c7; color:#92400e; }
.om-badge-paid { background:#dcfce7; color:#166534; }
.om-badge-new { background:#dbeafe; color:#1e40af; }
.om-badge-preparing { background:#fef3c7; color:#92400e; }
.om-badge-ready { background:#dcfce7; color:#166534; }
.om-badge-served, .om-badge-collected { background:#f1f5f9; color:#475569; }
.om-badge-cancelled { background:#fef2f2; color:#b91c1c; }
.om-badge-refund { background:#ffedd5; color:#9a3412; }
.om-badge-refunded { background:#ecfdf5; color:#065f46; }
[data-theme="dark"] .om-badge-cancelled { background:#7f1d1d33; color:#fca5a5; }
[data-theme="dark"] .om-badge-refund { background:#9a341233; color:#fdba74; }
[data-theme="dark"] .om-badge-refunded { background:#065f4633; color:#6ee7b7; }
[data-theme="dark"] .om-badge-pending { background:#92400e33; color:#fcd34d; }
[data-theme="dark"] .om-badge-paid { background:#065f4633; color:#6ee7b7; }
[data-theme="dark"] .om-badge-new { background:#1e40af33; color:#93c5fd; }
[data-theme="dark"] .om-badge-preparing { background:#92400e33; color:#fcd34d; }
[data-theme="dark"] .om-badge-ready { background:#065f4633; color:#6ee7b7; }
[data-theme="dark"] .om-badge-served, [data-theme="dark"] .om-badge-collected { background:#334155; color:#cbd5e1; }
.om-meja { font-weight:700; font-size:1.02rem; }
.cn-alert-danger { padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem; margin-bottom:12px; }
.om-item-row { display:flex; justify-content:space-between; gap:10px; font-size:0.85rem; padding:3px 0; }
.om-item-note { font-size:0.74rem; color:var(--smart-text-secondary,#64748b); }
.om-item-cancelled { opacity:0.6; text-decoration:line-through; }
.om-summary-row { display:flex; justify-content:space-between; gap:10px; font-size:0.85rem; padding:2px 0; }
.om-summary-total { font-size:1.05rem; font-weight:700; border-top:1px dashed var(--smart-border,#e2e8f0); padding-top:6px; margin-top:4px; }
`;

export function OrderMejaPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}${OM_STYLES}</style>
            <div class="page-header">
                <div>
                    ${isKasirMode() ? `<button class="smart-btn smart-btn-secondary" id="om-back-kasir" style="margin-bottom:8px">← Kembali ke Kasir</button>` : ""}
                    <h1>Order Meja</h1>
                    <p class="page-subtitle">Order dari QR Menu Meja — konfirmasi pembayaran secara manual (F&B V1)</p>
                </div>
                <button class="smart-btn smart-btn-secondary" id="om-refresh">↻ Refresh</button>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Daftar Order Meja</span></div>
                <div class="cn-card-body"><div id="om-mount"></div></div>
            </div>
        </div>
    `;
}

/**
 * Mount panel Order Meja ke dalam container — dipakai halaman standalone
 * (route order-meja) DAN panel EMBEDDED di layar kasir (F&B V1 — bukan
 * fullscreen, konten tetap di dalam halaman kasir).
 *
 * Render toolbar filter + daftar order + binding event (filter/refresh/
 * detail/konfirmasi bayar/tandai disajikan).
 * @param {HTMLElement} container Elemen panel (dibersihkan & diisi ulang)
 * @param {{ showBack?: boolean, onBack?: Function, showRefresh?: boolean }} [opts]
 */
export function mountOrderMeja(container, opts = {}) {
    if (!container) return;
    const { showBack = false, onBack = null, showRefresh = true } = opts;
    const head = (showBack || showRefresh)
        ? `
        <div class="om-embedded-head">
            ${showBack ? `<button class="smart-btn smart-btn-secondary" id="om-embedded-back">← Kembali ke Produk</button>` : ""}
            ${showRefresh ? `<button class="smart-btn smart-btn-secondary" id="om-embedded-refresh">↻ Refresh</button>` : ""}
        </div>`
        : "";
    container.innerHTML = `
        <style>${posDashboardCSS()}${OM_STYLES}</style>
        ${head}
        <div class="om-toolbar">
            ${FILTERS.map(f => `<button class="smart-btn ${state.status === f.value ? "smart-btn-primary" : "smart-btn-secondary"}" data-om-filter="${f.value}">${f.label}</button>`).join("")}
        </div>
        <div id="om-status"></div>
        <div id="om-table">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat order...</div>` : ""}</div>
    `;
    container.querySelector("#om-embedded-back")?.addEventListener("click", () => typeof onBack === "function" && onBack());
    container.querySelector("#om-embedded-refresh")?.addEventListener("click", () => load(container));
    container.querySelectorAll("[data-om-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
            state.status = btn.dataset.omFilter;
            container.querySelectorAll("[data-om-filter]").forEach(b => {
                b.classList.toggle("smart-btn-primary", b.dataset.omFilter === state.status);
                b.classList.toggle("smart-btn-secondary", b.dataset.omFilter !== state.status);
            });
            load(container);
        });
    });
    load(container);
}

function kitchenBadge(status) {
    return `<span class="om-badge om-badge-${status || "new"}">🍳 ${KITCHEN_LABEL[status] || status}</span>`;
}

function paymentBadge(status) {
    return `<span class="om-badge om-badge-${status || "pending"}">${status === "paid" ? "✅ PAID" : "🕐 PENDING"}</span>`;
}

/**
 * Badge pembatalan (per-item) + status refund — muncul di LIST order meja
 * supaya kasir LANGSUNG tahu ada item dibatalkan & wajib refund (tanpa
 * membuka detail). Order yang dibatalkan seluruhnya ditandai kitchenBadge
 * "Dibatalkan" (kiched di bawah) — badge di sini utk kasus SEBAGIAN.
 * @param {object} o Order
 * @returns {string}
 */
function cancelBadges(o) {
    const cancelled = (Array.isArray(o.items) ? o.items : []).filter(i => i && i.cancelled);
    if (!cancelled.length) return "";
    const isPaid = o.paymentStatus === "paid";
    const isRefunded = o.refundStatus === "refunded";
    const refundAmount = Number(o.refundAmount || 0);
    return `
        <span class="om-badge om-badge-cancelled">🗑️ ${cancelled.length} item dibatalkan</span>
        ${isPaid ? (isRefunded
            ? `<span class="om-badge om-badge-refunded">💰 Refund ${refundAmount.toLocaleString("id-ID")}</span>`
            : `<span class="om-badge om-badge-refund">💰 REFUND Rp ${(refundAmount || o.total || 0).toLocaleString("id-ID")}</span>`)
            : ""}
    `;
}

function renderStatus(container) {
    const el = container.querySelector("#om-status");
    if (!el) return;
    el.innerHTML = state.error ? `<div class="cn-alert-danger">${esc(state.error)}</div>` : "";
}

function renderTable(container) {
    const wrap = container.querySelector("#om-table");
    if (!wrap) return;
    if (state.loading) {
        wrap.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat order...</div>`;
        return;
    }
    if (!state.orders.length) {
        wrap.innerHTML = `<div class="cn-empty">Tidak ada order meja dengan filter ini.</div>`;
        return;
    }
    const rows = state.orders.map(o => {
        const extraBadges = cancelBadges(o);
        // Icon hapus HANYA di tab "Semua" + order belum lunas (order lunas =
        // catatan keuangan, ditolak server 409).
        const canDelete = state.status === "all" && o.paymentStatus !== "paid";
        return `
        <tr>
            <td><span class="om-meja">${esc(o.nomorMeja)}</span></td>
            <td>${esc(o.orderId)}<br/><small class="cn-muted">${formatDateTime(o.createdAt)}</small></td>
            <td>${(o.items || []).map(i => `${i.qty}× ${esc(i.nama)}`).join("<br/>")}</td>
            <td><strong>Rp ${Number(o.total).toLocaleString("id-ID")}</strong></td>
            <td>${PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod}</td>
            <td>${paymentBadge(o.paymentStatus)}<br/>${kitchenBadge(o.kitchenStatus)}${extraBadges ? `<br/>${extraBadges}` : ""}</td>
            <td>
                <button class="smart-btn smart-btn-secondary" data-om-detail="${esc(String(o._id))}">Detail</button>
                ${canDelete ? `<button class="smart-btn smart-btn-danger" data-om-delete="${esc(String(o._id))}" title="Hapus order" style="margin-left:4px;padding:4px 9px">🗑️</button>` : ""}
            </td>
        </tr>
    `;
    }).join("");
    wrap.innerHTML = `
        <div class="dp-table-wrap">
            <table class="dp-table">
                <thead><tr><th>Meja</th><th>Order</th><th>Items</th><th>Total</th><th>Metode</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    wrap.querySelectorAll("[data-om-detail]").forEach(btn => btn.addEventListener("click", () => openDetailModal(container, btn.dataset.omDetail)));
    wrap.querySelectorAll("[data-om-delete]").forEach(btn => btn.addEventListener("click", () => deleteOrder(container, btn.dataset.omDelete)));
}

/**
 * HAPUS order meja (icon 🗑️ di tab "Semua") — konfirmasi dulu; order yang
 * sudah lunas tidak bisa dihapus (server 409 → toast peringatan).
 */
async function deleteOrder(container, id) {
    if (!window.confirm("Hapus order ini?\n\nTindakan tidak dapat dibatalkan. Order yang sudah lunas tidak bisa dihapus.")) return;
    try {
        await deleteTableOrder(id);
        showToast("success", "Order dihapus");
        load(container);
    } catch (err) {
        showToast("danger", err?.message || "Gagal menghapus order");
    }
}

async function load(container) {
    state.loading = true;
    state.error = "";
    renderStatus(container);
    renderTable(container);
    try {
        const res = await listTableOrders({ status: state.status });
        state.orders = Array.isArray(res?.data) ? res.data : [];
        state.loading = false;
        renderStatus(container);
        renderTable(container);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat order meja";
        renderStatus(container);
        renderTable(container);
    }
}

function itemLines(o) {
    return (o.items || []).map(i => `
        <div class="om-item-row ${i.cancelled ? "om-item-cancelled" : ""}">
            <span>${i.qty}× ${esc(i.nama)}${i.cancelled ? ` <small style="color:#dc2626">(dibatalkan)</small>` : ""}${i.catatan ? `<div class="om-item-note">📝 ${esc(i.catatan)}</div>` : ""}</span>
            <span>Rp ${Number(i.subtotal).toLocaleString("id-ID")}</span>
        </div>
    `).join("");
}

async function openDetailModal(container, id) {
    let order = null;
    try {
        order = await getTableOrder(id);
    } catch (err) {
        return showToast("danger", err?.message || "Gagal memuat detail order");
    }
    if (!order) return showToast("warning", "Order tidak ditemukan");

    const isPaid = order.paymentStatus === "paid";
    const isReady = order.kitchenStatus === "ready";
    const isDone = ["served", "collected"].includes(order.kitchenStatus);
    // "Dibatalkan" berlaku utk pembatalan SELURUH (kitchenStatus=cancelled)
    // ATAU SEBAGIAN (beberapa item ditandai cancelled) — keduanya berhak
    // atas REFUND bila sudah lunas.
    const hasCancelledItems = (Array.isArray(order.items) ? order.items : []).some(i => i && i.cancelled);
    const isCancelled = order.kitchenStatus === "cancelled" || hasCancelledItems;
    const isRefunded = order.refundStatus === "refunded";
    const canRefund = isCancelled && isPaid && !isRefunded;

    const content = `
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
            <div style="font-size:1.25rem;font-weight:700">${esc(order.orderId)}</div>
            <div class="om-meja">${esc(order.nomorMeja)}</div>
            ${paymentBadge(order.paymentStatus)}
            ${kitchenBadge(order.kitchenStatus)}
        </div>
        <p class="cn-muted" style="font-size:0.8rem">Dibuat ${formatDateTime(order.createdAt)} · Metode: ${PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod}</p>
        <div style="margin:10px 0;border-top:1px dashed var(--smart-border,#e2e8f0);padding-top:8px">${itemLines(order)}</div>
        <div class="om-summary-row"><span>Sub Total</span><span>Rp ${Number(order.subtotal).toLocaleString("id-ID")}</span></div>
        <div class="om-summary-row"><span>Pajak</span><span>Rp ${Number(order.pajak).toLocaleString("id-ID")}</span></div>
        <div class="om-summary-row om-summary-total"><span>Total</span><span>Rp ${Number(order.total).toLocaleString("id-ID")}</span></div>
        ${order.catatanOrder ? `<p class="om-item-note" style="margin-top:8px">📝 Order: ${esc(order.catatanOrder)}</p>` : ""}
        ${order.confirmedAt ? `<p class="om-item-note" style="margin-top:8px">✅ Dikonfirmasi oleh <strong>${esc(order.confirmedBy || "-")}</strong> pada ${formatDateTime(order.confirmedAt)} (manual)</p>` : ""}
        ${order.readyAt ? `<p class="om-item-note">🍽️ Siap pada ${formatDateTime(order.readyAt)} oleh ${esc(order.readyBy || "-")}</p>` : ""}
        ${isCancelled ? `<p class="om-item-note" style="margin-top:8px">❌ Dibatalkan oleh <strong>${esc(order.cancelledBy || "-")}</strong> pada ${formatDateTime(order.cancelledAt)}${order.cancelReason ? ` — ${esc(order.cancelReason)}` : ""}</p>` : ""}
        ${isCancelled && isPaid ? (isRefunded
            ? `<p class="om-item-note" style="margin-top:8px">💰 Refund <strong>Rp ${Number(order.refundAmount || 0).toLocaleString("id-ID")}</strong> diproses oleh <strong>${esc(order.refundedBy || "-")}</strong> pada ${formatDateTime(order.refundedAt)}</p>`
            : `<p class="om-item-note" style="margin-top:8px">⚠️ Order sudah LUNAS — <strong>wajib di-refund</strong> ke pelanggan (Rp ${Number(order.refundAmount || order.total || 0).toLocaleString("id-ID")}).</p>`)
            : ""}
    `;

    let footer = `
        <button class="smart-btn smart-btn-secondary" id="om-detail-close">Tutup</button>
    `;
    if (!isPaid && !isCancelled) {
        footer += `<button class="smart-btn smart-btn-primary" id="om-detail-confirm">✅ KONFIRMASI BAYAR</button>`;
    }
    if (isReady && !isDone) {
        footer += `<button class="smart-btn smart-btn-secondary" id="om-detail-served">✔️ Tandai Disajikan</button>`;
    }
    // F&B V1 — order dibatalkan & SUDAH LUNAS → kasir wajib proses REFUND.
    // Belum lunas: TIDAK ada tombol refund (tidak ada yang perlu dikembalikan).
    if (canRefund) {
        footer += `<button class="smart-btn smart-btn-danger" id="om-detail-refund">💰 REFUND Rp ${Number(order.refundAmount || order.total || 0).toLocaleString("id-ID")}</button>`;
    }

    const overlay = Modal({ open: true, title: "Detail Order Meja", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#om-detail-close")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#om-detail-confirm")?.addEventListener("click", async () => {
        if (!window.confirm(`Konfirmasi pembayaran ${order.orderId} (${order.nomorMeja})? Status berubah PENDING → PAID.`)) return;
        try {
            await confirmTableOrderPayment(id);
            showToast("success", `Pembayaran ${order.orderId} dikonfirmasi (manual)`);
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal mengonfirmasi pembayaran");
        }
    });
    overlay.querySelector("#om-detail-served")?.addEventListener("click", async () => {
        try {
            await updateTableOrderKitchen(id, "served");
            showToast("success", `${order.orderId} ditandai disajikan`);
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal menandai disajikan");
        }
    });
    overlay.querySelector("#om-detail-refund")?.addEventListener("click", async () => {
        const amount = Number(order.refundAmount || order.total || 0).toLocaleString("id-ID");
        if (!window.confirm(`Proses REFUND ${order.orderId} (${order.nomorMeja}) sebesar Rp ${amount}?\n\nRefund tercatat sebagai pengurang nilai penjualan shift dan pelanggan diberi notifikasi.`)) return;
        try {
            await refundTableOrder(id);
            showToast("success", `Refund Rp ${amount} diproses — pelanggan diberi notifikasi`);
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal memproses refund");
        }
    });
}

/**
 * Refresh panel Order Meja yang sedang tampil (bila panel embedded kasir
 * sedang terbuka) — dipanggil setelah verifikasi pembayaran dari bell.
 * Tidak melakukan apa-apa bila panel tidak ada/tersembunyi.
 */
export function refreshOrderMejaPanel() {
    const panel = document.getElementById("pos-order-meja-panel");
    if (panel && !panel.hidden && panel.querySelector("#om-table")) {
        load(panel);
    }
}

export function initOrderMejaPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#om-back-kasir")?.addEventListener("click", () => navigate("pos"));
    const mount = container.querySelector("#om-mount");
    container.querySelector("#om-refresh")?.addEventListener("click", () => mount && load(mount));
    // Halaman standalone: header punya Refresh sendiri — panel tanpa head tambahan.
    mountOrderMeja(mount, { showBack: false, showRefresh: false });
}
