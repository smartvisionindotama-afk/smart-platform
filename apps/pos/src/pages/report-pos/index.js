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
import { apiCall } from "../../data/api.js";
import { showToast } from "@smart/ui";
import { posDashboardCSS } from "../pos-styles.js";
import { Auth, esc } from "@smart/core";

const PAYMENT_LABELS = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", card: "Kartu" };

// Data breakdown terakhir yang dimuat — dipakai cetak (tanpa fetch ulang).
let lastData = null;

// Baris data per halaman cetak — tiap halaman diakhiri SUBTOTAL, tabel
// ditutup TOTAL di halaman terakhir (pola laporan menu Laporan).
const PRINT_ROWS_PER_PAGE = 25;

function today() {
    return new Date().toISOString().split("T")[0];
}

/** Default: tanggal 1 bulan ini → hari ini. */
function defaultStartDate() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
}

export function ReportPosPage() {
    return `
        <div class="laporan-page">
            <style>${posDashboardCSS()}
            /* Match shared LaporanModule layout */
            .laporan-page { padding:1.5rem; max-width:1280px; margin:0 auto; }
            .lpr-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem; }
            .lpr-header h1 { margin:0; font-size:1.5rem; font-weight:700; color:var(--smart-text-primary,#1a1a2e); }
            .lpr-header-sub { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
            @media (max-width:768px) { .laporan-page { padding:0.75rem; } }
            </style>
            <div class="lpr-header">
                <div>
                    <h1>🧾 Laporan Kasir</h1>
                    <div class="lpr-header-sub">Breakdown penjualan POS per item, kategori, kasir & metode bayar</div>
                </div>
            </div>
            <div class="dp-db-filter-bar">
                <label class="cn-muted" for="rp-start">Dari</label>
                <input type="date" class="smart-input" id="rp-start" value="${defaultStartDate()}" />
                <label class="cn-muted" for="rp-end">Sampai</label>
                <input type="date" class="smart-input" id="rp-end" value="${today()}" />
                <button class="smart-btn smart-btn-primary" id="rp-apply">Tampilkan</button>
                <button class="smart-btn smart-btn-secondary" id="rp-print" title="Cetak laporan kasir (subtotal per halaman)">🖨️ Cetak</button>
            </div>
            <div id="rp-summary"></div>
            <div id="rp-content"><div class="cn-loading">Memuat laporan...</div></div>
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
    lastData = data;
    const s = data.summary || {};
    summaryEl.innerHTML = `
        <div class="pos-stat-grid">
            ${stat("Total Transaksi", String(s.totalTransaksi || 0), "sumber POS")}
            ${stat("Total Penjualan (Bruto)", `Rp ${formatRupiah(s.totalPenjualan || 0)}`, "sama dengan Laporan Penjualan & Laba-Rugi")}
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
    const container = document.querySelector(".laporan-page");
    if (!container) return;
    const apply = container.querySelector("#rp-apply");
    if (apply) {
        apply.addEventListener("click", () => load(container));
    }
    const printBtn = container.querySelector("#rp-print");
    if (printBtn) {
        printBtn.addEventListener("click", () => printKasirReport(container));
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

// ── Cetak Laporan Kasir (subtotal per halaman + total akhir) ──

function chunkArr(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function sumColumns(rowItems, numericColumns) {
    // Map ber-`index` kolom tabel (bukan array posisional) — pemanggil membaca
    // `result[c.index]`; indeks kolom numerik TIDAK selalu berurutan 0..n.
    const out = {};
    for (const c of numericColumns) {
        out[c.index] = rowItems.reduce((s, r) => s + (Number(r.values?.[c.index]) || 0), 0);
    }
    return out;
}

function fmtCol(value, type) {
    return type === "rupiah" ? `Rp ${formatRupiah(value)}` : formatRupiah(value);
}

/** Render tabel cetak DI-CHUNK (subtotal per halaman + TOTAL di akhir). */
function rptChunkedTables(headers, rowItems, numericColumns) {
    const chunks = chunkArr(rowItems || [], PRINT_ROWS_PER_PAGE);
    if (!chunks.length) {
        return `<p class="rpt-empty">Tidak ada data pada periode ini.</p>`;
    }
    const grand = sumColumns(rowItems, numericColumns);
    const colspanLabel = Math.max(1, headers.length - numericColumns.length);
    return chunks.map((chunk, ci) => {
        const isLast = ci === chunks.length - 1;
        const sub = sumColumns(chunk, numericColumns);
        const subRow = numericColumns.length
            ? `<tr class="rpt-subtotal"><td colspan="${colspanLabel}">Subtotal Halaman ${ci + 1}</td>${numericColumns.map(c => `<td style="text-align:right">${fmtCol(sub[c.index], c.type)}</td>`).join("")}</tr>`
            : "";
        const grandRow = (isLast && numericColumns.length)
            ? `<tr class="rpt-grand"><td colspan="${colspanLabel}">TOTAL</td>${numericColumns.map(c => `<td style="text-align:right">${fmtCol(grand[c.index], c.type)}</td>`).join("")}</tr>`
            : "";
        return `
            <table class="rpt-table">
                <thead><tr>${headers.map(h => `<th ${h.align ? `style="text-align:${h.align}"` : ""}>${esc(h.label)}</th>`).join("")}</tr></thead>
                <tbody>${chunk.map(r => r.html).join("")}</tbody>
                ${(subRow || grandRow) ? `<tfoot>${subRow}${grandRow}</tfoot>` : ""}
            </table>
            ${isLast ? "" : `<div class="rpt-page-break"></div>`}
        `;
    }).join("");
}

function rptSection(title, headers, rowItems, numericColumns) {
    return `<div class="rpt-section-title">${esc(title)}</div>${rptChunkedTables(headers, rowItems, numericColumns)}`;
}

async function resolveCompanyInfo() {
    try {
        // Gunakan /api/company-profile (server POS sendiri) — return FULL
        // data (name, address, phone, email, logo). getCompanyByCode() hanya
        // mengembalikan payload ringan dari Console (code/name/logo saja).
        const result = await apiCall("GET", "/company-profile");
        if (result?.data) {
            const c = result.data;
            return {
                name: String(c.name || ""),
                address: String(c.address || ""),
                phone: String(c.phone || ""),
                email: String(c.email || ""),
                logo: String(c.logo || "")
            };
        }
    } catch { /* fallback */ }
    return {};
}

async function printKasirReport(container) {
    const data = lastData;
    if (!data) return showToast("danger", "Belum ada data laporan untuk dicetak");
    const start = container.querySelector("#rp-start")?.value || today();
    const end = container.querySelector("#rp-end")?.value || today();
    const company = await resolveCompanyInfo();
    const companyName = company.name || "Perusahaan";

    const byPayment = (data.byPayment || []).map(p => ({
        html: `<tr><td>${esc(PAYMENT_LABELS[p.metode] || p.metode)}</td><td style="text-align:right">${p.jumlah} tx</td><td style="text-align:right">Rp ${formatRupiah(p.omzet)}</td></tr>`,
        values: [0, Number(p.jumlah) || 0, Number(p.omzet) || 0]
    }));
    const byCashier = (data.byCashier || []).map(c => ({
        html: `<tr><td>${esc(c.kasir)}</td><td style="text-align:right">${c.jumlah} tx</td><td style="text-align:right">Rp ${formatRupiah(c.omzet)}</td></tr>`,
        values: [0, Number(c.jumlah) || 0, Number(c.omzet) || 0]
    }));
    const byItem = (data.byItem || []).map((p, i) => ({
        html: `<tr><td>${i + 1}</td><td>${esc(p.nama)} <small>${esc(p.kode)}</small></td><td>${esc(p.kategori)}</td><td style="text-align:right">${p.qty}</td><td style="text-align:right">Rp ${formatRupiah(p.omzet)}</td></tr>`,
        values: [0, 0, 0, Number(p.qty) || 0, Number(p.omzet) || 0]
    }));
    const byCategory = (data.byCategory || []).map(c => ({
        html: `<tr><td>${esc(c.kategori)}</td><td style="text-align:right">${c.qty}</td><td style="text-align:right">Rp ${formatRupiah(c.omzet)}</td></tr>`,
        values: [0, Number(c.qty) || 0, Number(c.omzet) || 0]
    }));

    const s = data.summary || {};
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Kasir</title>
<style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; padding:32px; }
    .rpt-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #4f46e5; padding-bottom:14px; margin-bottom:18px; }
    .rpt-company-name { font-size:1.1rem; font-weight:700; }
    .rpt-company-detail { font-size:0.75rem; color:#64748b; line-height:1.4; }
    .rpt-title { font-size:1.4rem; font-weight:800; color:#4f46e5; text-align:right; }
    .rpt-subtitle { font-size:0.8rem; color:#64748b; text-align:right; }
    .rpt-meta { font-size:0.7rem; color:#94a3b8; margin-top:4px; text-align:right; }
    .rpt-summary { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
    .rpt-summary-item { border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; background:#f8fafc; }
    .rpt-summary-label { display:block; font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.4px; }
    .rpt-summary-value { font-size:1rem; font-weight:700; color:#1e293b; }
    .rpt-section-title { font-size:0.95rem; font-weight:700; color:#374151; margin:18px 0 8px; }
    table { width:100%; border-collapse:collapse; }
    th { background:#f1f5f9; padding:7px 8px; font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; border:1px solid #e2e8f0; letter-spacing:0.3px; }
    td { padding:6px 8px; font-size:0.8rem; border:1px solid #e2e8f0; }
    tr:nth-child(even) td { background:#fafbfc; }
    .rpt-table { page-break-inside: avoid; }
    .rpt-page-break { page-break-after: always; }
    .rpt-subtotal td { background:#f8fafc; font-weight:700; border-top:2px solid #cbd5e1; color:#334155; }
    .rpt-grand td { background:#eef2ff; font-weight:800; border-top:2px solid #4f46e5; color:#3730a3; }
    .rpt-empty { color:#94a3b8; font-size:0.85rem; padding:8px 0; }
    .rpt-footer { margin-top:24px; display:flex; justify-content:flex-end; }
    .rpt-sign { text-align:center; }
    .rpt-sign-label { font-size:0.75rem; color:#64748b; }
    .rpt-sign-space { height:52px; }
    .rpt-sign-name { font-size:0.85rem; font-weight:600; border-top:1px solid #94a3b8; padding-top:4px; min-width:150px; }
    @media print { body { padding:0; } }
    @page { margin:14mm; }
</style>
</head>
<body>
    <div class="rpt-header">
        <div style="display:flex;align-items:flex-start;gap:14px;">
            ${company.logo ? `<img src="${esc(company.logo)}" style="width:64px;height:auto;object-fit:contain;" onerror="this.style.display='none'" />` : ""}
            <div>
                <div class="rpt-company-name">${esc(companyName)}</div>
                <div class="rpt-company-detail">${esc(company.address || "")}</div>
                <div class="rpt-company-detail">${company.phone ? `Telp: ${esc(company.phone)}` : ""}${company.phone && company.email ? ` | ` : ""}${company.email ? `Email: ${esc(company.email)}` : ""}</div>
            </div>
        </div>
        <div>
            <div class="rpt-title">Laporan Kasir</div>
            <div class="rpt-subtitle">${esc(start)} s/d ${esc(end)}</div>
            <div class="rpt-meta">Dicetak: ${new Date().toLocaleString("id-ID")}</div>
        </div>
    </div>
    <div class="rpt-summary">
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Transaksi</span><span class="rpt-summary-value">${s.totalTransaksi || 0}</span></div>
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Penjualan (Bruto)</span><span class="rpt-summary-value">Rp ${formatRupiah(s.totalPenjualan || 0)}</span></div>
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Pajak</span><span class="rpt-summary-value">Rp ${formatRupiah(s.totalPajak || 0)}</span></div>
    </div>
    ${rptSection("💳 Metode Pembayaran", [{ label: "Metode" }, { label: "Transaksi", align: "right" }, { label: "Omzet", align: "right" }], byPayment, [{ index: 1, type: "number" }, { index: 2, type: "rupiah" }])}
    ${rptSection("👤 Per Kasir", [{ label: "Kasir" }, { label: "Transaksi", align: "right" }, { label: "Omzet", align: "right" }], byCashier, [{ index: 1, type: "number" }, { index: 2, type: "rupiah" }])}
    <div class="rpt-page-break"></div>
    ${rptSection("📦 Per Item", [{ label: "#" }, { label: "Item" }, { label: "Kategori" }, { label: "Qty", align: "right" }, { label: "Omzet", align: "right" }], byItem, [{ index: 3, type: "number" }, { index: 4, type: "rupiah" }])}
    ${rptSection("🏷️ Per Kategori", [{ label: "Kategori" }, { label: "Qty", align: "right" }, { label: "Omzet", align: "right" }], byCategory, [{ index: 1, type: "number" }, { index: 2, type: "rupiah" }])}
    <div class="rpt-footer">
        <div class="rpt-sign">
            <div class="rpt-sign-label">Dicetak oleh</div>
            <div class="rpt-sign-space"></div>
            <div class="rpt-sign-name">${esc((Auth.user && Auth.user() && Auth.user().name) || "_______________")}</div>
        </div>
    </div>
</body>
</html>`;
    printToWindowKasir(html);
}

function printToWindowKasir(html) {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
        showToast("danger", "Pop-up diblokir — izinkan pop-up untuk mencetak laporan");
        return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
}
