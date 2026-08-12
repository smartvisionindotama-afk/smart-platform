/**
 * Laporan Kasir Page — POS Sales Breakdown (PRD V1 §13).
 *
 * Menampilkan breakdown transaksi POS (sumber=pos, paid, non-void):
 *   - Penjualan per item barang (qty + omzet)
 *   - Penjualan per kategori
 *   - Penjualan per kasir
 *   - Pembayaran per metode (cash/transfer/qris/card)
 * Dengan filter rentang tanggal (default hari ini).
 *
 * Data: getSalesBreakdown (data/index.js) → GET /api/laporan/sales-breakdown.
 *
 * @module pos/pages/report-pos
 */

import { getSalesBreakdown, formatRupiah } from "../../data/index.js";
import { posDashboardCSS } from "../pos-styles.js";
import { esc } from "@smart/core";

const PAYMENT_LABELS = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", card: "Kartu" };

function today() {
    return new Date().toISOString().split("T")[0];
}

export function ReportPosPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}</style>
            <div class="page-header">
                <div>
                    <h1>Laporan Kasir</h1>
                    <p class="page-subtitle">Breakdown penjualan POS per item, kategori, kasir & metode bayar</p>
                </div>
            </div>
            <div class="cn-card">
                <div class="cn-card-body">
                    <div class="dp-db-filter-bar">
                        <label class="cn-muted" for="rp-start">Dari</label>
                        <input type="date" class="smart-input" id="rp-start" value="${today()}" />
                        <label class="cn-muted" for="rp-end">Sampai</label>
                        <input type="date" class="smart-input" id="rp-end" value="${today()}" />
                        <button class="smart-btn smart-btn-primary" id="rp-apply">Tampilkan</button>
                    </div>
                    <div id="rp-summary"></div>
                    <div id="rp-content"><div class="cn-loading">Memuat laporan...</div></div>
                </div>
            </div>
        </div>
    `;
}

function stat(label, value, sub = "") {
    return `<div class="pos-stat-card"><div class="pos-stat-label">${esc(label)}</div><div class="pos-stat-value">${value}</div>${sub ? `<div class="pos-stat-sub">${esc(sub)}</div>` : ""}</div>`;
}

function table(headers, rows) {
    return `
        <div class="dp-table-wrap">
            <table class="dp-table">
                <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function render(container, data) {
    const summaryEl = container.querySelector("#rp-summary");
    const contentEl = container.querySelector("#rp-content");
    if (!summaryEl || !contentEl) return;

    const s = data.summary || {};
    summaryEl.innerHTML = `
        <div class="pos-stat-grid">
            ${stat("Total Transaksi", String(s.totalTransaksi || 0), "sumber POS")}
            ${stat("Total Penjualan", `Rp ${formatRupiah(s.totalPenjualan || 0)}`, "termasuk pajak")}
            ${stat("Total Pajak", `Rp ${formatRupiah(s.totalPajak || 0)}`, "11%")}
        </div>
    `;

    const byPayment = (data.byPayment || []).map(p => `
        <tr>
            <td>${PAYMENT_LABELS[p.metode] || esc(p.metode)}</td>
            <td class="cn-text-right">${p.jumlah} tx</td>
            <td class="cn-text-right">Rp ${formatRupiah(p.omzet)}</td>
        </tr>`).join("");
    const byItem = (data.byItem || []).map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${esc(p.nama)} <small class="cn-muted">${esc(p.kode)}</small></td>
            <td>${esc(p.kategori)}</td>
            <td class="cn-text-right">${p.qty}</td>
            <td class="cn-text-right">Rp ${formatRupiah(p.omzet)}</td>
        </tr>`).join("");
    const byCategory = (data.byCategory || []).map(c => `
        <tr>
            <td>${esc(c.kategori)}</td>
            <td class="cn-text-right">${c.qty}</td>
            <td class="cn-text-right">Rp ${formatRupiah(c.omzet)}</td>
        </tr>`).join("");
    const byCashier = (data.byCashier || []).map(c => `
        <tr>
            <td>${esc(c.kasir)}</td>
            <td class="cn-text-right">${c.jumlah} tx</td>
            <td class="cn-text-right">Rp ${formatRupiah(c.omzet)}</td>
        </tr>`).join("");

    const empty = (label) => `<p class="cn-muted">Belum ada data ${label} pada periode ini.</p>`;

    contentEl.innerHTML = `
        <div class="pos-dash-grid">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">💳 Metode Pembayaran</span></div>
                <div class="cn-card-body">${byPayment ? table(["Metode", "Transaksi", "Omzet"], byPayment) : empty("pembayaran")}</div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">👤 Per Kasir</span></div>
                <div class="cn-card-body">${byCashier ? table(["Kasir", "Transaksi", "Omzet"], byCashier) : empty("kasir")}</div>
            </div>
        </div>
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">📦 Per Item</span></div>
            <div class="cn-card-body">${byItem ? table(["#", "Item", "Kategori", "Qty", "Omzet"], byItem) : empty("item")}</div>
        </div>
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">🏷️ Per Kategori</span></div>
            <div class="cn-card-body">${byCategory ? table(["Kategori", "Qty", "Omzet"], byCategory) : empty("kategori")}</div>
        </div>
    `;
}

export async function initReportPosPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    const apply = container.querySelector("#rp-apply");
    if (apply) {
        apply.addEventListener("click", () => load(container));
    }
    await load(container);
}

async function load(container) {
    const contentEl = container.querySelector("#rp-content");
    if (!contentEl) return;
    contentEl.innerHTML = `<div class="cn-loading">Memuat laporan...</div>`;
    const start = container.querySelector("#rp-start")?.value || today();
    const end = container.querySelector("#rp-end")?.value || today();
    try {
        const data = await getSalesBreakdown({ startDate: start, endDate: end });
        render(container, data);
    } catch (err) {
        contentEl.innerHTML = `<div class="cn-empty">Gagal memuat laporan: ${esc(err.message || "server tidak tersedia")}</div>`;
    }
}
