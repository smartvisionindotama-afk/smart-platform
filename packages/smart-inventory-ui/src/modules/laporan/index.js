/**
 * Laporan Module — Reporting (Sprint 8).
 *
 * 7 tab laporan:
 *   1. 📦 Stok              — per barang (stok, nilai beli/jual, status)
 *   2. 🛒 Pembelian         — per PO (filter tanggal, search, summary)
 *   3. 💰 Penjualan         — per SO (filter tanggal, search, summary)
 *   4. 💎 Nilai Inventori   — total + breakdown by gudang & kategori
 *   5. 🔄 Mutasi Stok       — pembelian/penjualan/transfer/retur/opname
 *   6. 🚚 Supplier          — jumlah PO & total pembelian per supplier
 *   7. 👤 Customer          — jumlah SO & total penjualan per customer
 *   8. 💹 Laba-Rugi         — nilai penjualan, harga pokok, laba kotor (detail & rekap/bulan)
 *   9. 📋 Piutang           — penjualan belum lunas + status overdue
 *
 * DI yang dibutuhkan:
 *   getLaporanStock(params)         => { data, summary, pagination }
 *   getLaporanPurchase(params)      => { data, summary, pagination }
 *   getLaporanSales(params)         => { data, summary, pagination }
 *   getInventoryValueReport()       => { totalNilaiBeli, totalNilaiJual, byWarehouse[], byKategori[] }
 *   getStockMutationReport(params)  => { data, summary, pagination }
 *   getSupplierReport(params)       => { data, summary, pagination }
 *   getCustomerReport(params)       => { data, summary, pagination }
 *   getLaporanLabarugi(params)      => { data, summary, rekapBulan[], pagination }
 *   getLaporanPiutang(params)       => { data, summary, pagination, termDays }
 *   getCompanyInfo — async () => { name, address, phone, email, logo } (untuk cetak)
 *
 * @module @smart/inventory-ui/modules/laporan
 */

import { Modal, Pagination, EmptyState, showToast, UI, printToWindow } from "@smart/ui";
import { esc, formatNumber as fmtNum, formatRupiahID as fmtRupiah, formatDate } from "@smart/core";

let services = {};
let _hideTabs = false;

export function LaporanModule(deps = {}) {
    services = deps;
    _hideTabs = deps.hideTabs === true;

// ═══════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════

let state = {
    activeTab: "stock",
    loading: false,
    // Stok
    stock: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    stockSearch: "", stockSort: "nama",
    // Pembelian
    purchase: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    purchaseSearch: "", purchaseStart: "", purchaseEnd: "",
    // Penjualan
    sales: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    salesSearch: "", salesStart: "", salesEnd: "",
    // Nilai inventori
    invValue: null,
    // Mutasi
    mutation: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    mutationStart: "", mutationEnd: "",
    // Supplier
    supplier: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    supplierSearch: "",
    // Customer
    customer: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    customerSearch: "",
    // Laba-Rugi
    labarugi: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    labarugiSearch: "", labarugiStart: "", labarugiEnd: "", labarugiView: "detail", labarugiRekap: [],
    // Piutang
    piutang: { data: [], summary: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    piutangSearch: "", piutangStart: "", piutangEnd: "", piutangTermDays: 30
};

const pageId = "laporan-page";

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

// Framework First: fmtNum/fmtRupiah/formatDate dari @smart/core
// (util global, bukan duplikat lokal)

const TAB_LABELS = {
    stock: "📦 Stok",
    purchase: "🛒 Pembelian",
    sales: "💰 Penjualan",
    value: "💎 Nilai Inventori",
    mutation: "🔄 Mutasi Stok",
    supplier: "🚚 Supplier",
    customer: "👤 Customer",
    labarugi: "💹 Laba-Rugi",
    piutang: "📋 Piutang"
};

const TAB_TITLES = {
    stock: "📦 Laporan Stok",
    purchase: "🛒 Laporan Pembelian",
    sales: "💰 Laporan Penjualan",
    value: "💎 Laporan Nilai Inventori",
    mutation: "🔄 Laporan Mutasi Stok",
    supplier: "🚚 Laporan Supplier",
    customer: "👤 Laporan Customer",
    labarugi: "💹 Laporan Laba-Rugi",
    piutang: "📋 Laporan Piutang"
};

const TAB_SUBTITLES = {
    stock: "Daftar seluruh barang beserta stok, nilai beli & jual",
    purchase: "Rekapitulasi pembelian per supplier",
    sales: "Rekapitulasi penjualan per pelanggan",
    value: "Total nilai inventori per gudang & kategori",
    mutation: "Riwayat masuk, keluar, dan mutasi stok",
    supplier: "Ringkasan aktivitas per supplier",
    customer: "Ringkasan aktivitas per pelanggan",
    labarugi: "Laporan laba/rugi (HPP vs penjualan)",
    piutang: "Tagihan yang belum lunas"
};

function statusBadge(status) {
    const map = {
        draft: { label: "Draft", cls: "lpr-status-draft" },
        confirmed: { label: "Dikonfirmasi", cls: "lpr-status-confirmed" },
        received: { label: "Diterima", cls: "lpr-status-received" },
        order: { label: "Order", cls: "lpr-status-draft" },
        delivered: { label: "Dikirim", cls: "lpr-status-confirmed" },
        invoiced: { label: "Invoice", cls: "lpr-status-received" },
        paid: { label: "Lunas", cls: "lpr-status-paid" },
        cancelled: { label: "Batal", cls: "lpr-status-cancelled" },
        transferred: { label: "Ditransfer", cls: "lpr-status-received" },
        returned: { label: "Retur", cls: "lpr-status-confirmed" },
        completed: { label: "Selesai", cls: "lpr-status-paid" }
    };
    const s = map[status] || { label: status || "-", cls: "lpr-status-draft" };
    return `<span class="lpr-status-badge ${s.cls}">${s.label}</span>`;
}

function mutationBadge(type) {
    const map = {
        masuk: { label: "Masuk", cls: "lpr-mut-in" },
        keluar: { label: "Keluar", cls: "lpr-mut-out" },
        pindah: { label: "Pindah", cls: "lpr-mut-move" },
        penyesuaian: { label: "Penyesuaian", cls: "lpr-mut-adj" }
    };
    const s = map[type] || { label: type || "-", cls: "lpr-mut-in" };
    return `<span class="lpr-mut-badge ${s.cls}">${s.label}</span>`;
}

function stokBadge(status) {
    const map = {
        aman: { label: "Aman", cls: "lpr-stok-aman" },
        menipis: { label: "Menipis", cls: "lpr-stok-menipis" },
        habis: { label: "Habis", cls: "lpr-stok-habis" }
    };
    const s = map[status] || { label: "-", cls: "lpr-stok-aman" };
    return `<span class="lpr-stok-badge ${s.cls}">${s.label}</span>`;
}

function getCurrentUserName() {
    try {
        if (typeof globalThis !== "undefined" && globalThis.SMART?.Session) {
            const name = globalThis.SMART.Session.get("user.name");
            if (name) return name;
            const state = globalThis.SMART.Session.getState?.();
            if (state?.user?.name) return state.user.name;
        }
    } catch {}
    return null;
}

async function getCompanyInfo() {
    if (typeof services.getCompanyInfo === "function") {
        try {
            const result = await services.getCompanyInfo();
            if (result && (result.name || result.companyName)) return result;
        } catch (e) { console.warn("[Laporan] getCompanyInfo failed:", e); }
    }
    return {};
}

function removeModal(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

// ═══════════════════════════════════════════════
//  Page HTML
// ═══════════════════════════════════════════════

function LaporanPage() {
    const title = TAB_TITLES[state.activeTab] || "📈 Laporan";
    const subtitle = TAB_SUBTITLES[state.activeTab] || "Rekap stok, transaksi, dan partner bisnis";
    return `
        <div id="${pageId}" class="laporan-page">
            <style>${getStyles()}</style>
            <div class="lpr-header">
                <div>
                    <h1>${title}</h1>
                    <div class="lpr-header-sub">${subtitle}</div>
                </div>
            </div>
            ${_hideTabs ? "" : `
            <div class="lpr-tabs" id="lpr-tabs">
                ${Object.entries(TAB_LABELS).map(([key, label]) => `
                    <button class="lpr-tab ${state.activeTab === key ? "active" : ""}" data-tab="${key}">${label}</button>
                `).join("")}
            </div>
            `}
            <div id="lpr-content" class="lpr-content">${renderActiveTab()}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════

function initLaporanPage() {
    attachTabEvents();
    loadActiveTab();
}

/**
 * Set active tab tanpa依赖 DOM (untuk mode hideTabs).
 * Panggil SEBELUM initLaporanPage() supaya state sudah benar saat render.
 */
function setActiveTab(tabName) {
    if (TAB_LABELS[tabName]) {
        state.activeTab = tabName;
    }
}

function attachTabEvents() {
    document.querySelectorAll(".lpr-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.dataset.tab;
            if (tabName === state.activeTab) return;
            state.activeTab = tabName;
            document.querySelectorAll(".lpr-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            renderContent();
            loadActiveTab();
        });
    });
}

function renderContent() {
    const contentEl = document.getElementById("lpr-content");
    if (contentEl) contentEl.innerHTML = renderActiveTab();
    // Update header title + subtitle berdasarkan activeTab
    const headerEl = document.getElementById(pageId);
    if (headerEl) {
        const h1 = headerEl.querySelector(".lpr-header h1");
        const sub = headerEl.querySelector(".lpr-header .lpr-header-sub");
        if (h1) h1.textContent = TAB_TITLES[state.activeTab] || "📈 Laporan";
        if (sub) sub.textContent = TAB_SUBTITLES[state.activeTab] || "Rekap stok, transaksi, dan partner bisnis";
    }
    attachTabContentEvents();
}

function renderActiveTab() {
    switch (state.activeTab) {
        case "stock": return renderStockTab();
        case "purchase": return renderPurchaseTab();
        case "sales": return renderSalesTab();
        case "value": return renderValueTab();
        case "mutation": return renderMutationTab();
        case "supplier": return renderSupplierTab();
        case "customer": return renderCustomerTab();
        case "labarugi": return renderLabarugiTab();
        case "piutang": return renderPiutangTab();
        default: return "";
    }
}

// ═══════════════════════════════════════════════
//  Common: Toolbar & Summary & Table wrappers
// ═══════════════════════════════════════════════

function renderToolbar(opts = {}) {
    const { searchId, searchValue, placeholder = "Cari...", startId, endId, startVal, endVal } = opts;
    return `
        <div class="lpr-toolbar">
            <div class="lpr-toolbar-left">
                ${searchId !== undefined ? `
                    <div class="lpr-search">
                        <span class="lpr-search-icon">🔍</span>
                        <input type="text" id="${searchId}" placeholder="${esc(placeholder)}" value="${esc(searchValue || "")}" autocomplete="off" />
                    </div>
                ` : ""}
                ${startId !== undefined ? `
                    <div class="lpr-date-range">
                        <input type="date" id="${startId}" value="${esc(startVal || "")}" title="Dari tanggal" />
                        <span>s/d</span>
                        <input type="date" id="${endId}" value="${esc(endVal || "")}" title="Sampai tanggal" />
                    </div>
                ` : ""}
            </div>
            <div class="lpr-toolbar-right">
                <button class="lpr-btn lpr-btn-print" id="lpr-btn-print" title="Cetak laporan">🖨️ Cetak</button>
            </div>
        </div>
    `;
}

function renderSummaryCards(summary, config) {
    if (!summary) return "";
    return `
        <div class="lpr-summary-grid">
            ${config.map(c => `
                <div class="lpr-summary-card">
                    <div class="lpr-summary-icon">${c.icon}</div>
                    <div class="lpr-summary-value ${c.color ? `lpr-value-${c.color}` : ""}">${c.value(summary)}</div>
                    <div class="lpr-summary-label">${c.label}</div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderPaginationHTML(pagination, dataAttr) {
    if (!pagination || pagination.totalPages <= 1) return "";
    return `
        <div class="lpr-pagination">
            ${Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => `
                <button class="lpr-page-btn ${p === pagination.page ? "active" : ""}" data-${dataAttr}="${p}">${p}</button>
            `).join("")}
            <span class="lpr-page-info">Total ${fmtNum(pagination.total)}</span>
        </div>
    `;
}

function renderTableWrap(headers, rowsHTML, emptyMsg = "Tidak ada data") {
    return `
        <div class="lpr-table-wrap">
            <table class="lpr-table">
                <thead><tr>${headers.map(h => `<th ${h.align ? `style="text-align:${h.align}"` : ""}>${h.label}</th>`).join("")}</tr></thead>
                <tbody>${rowsHTML || `<tr><td colspan="${headers.length}" class="lpr-empty">${emptyMsg}</td></tr>`}</tbody>
            </table>
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Tab 1: Stok
// ═══════════════════════════════════════════════

function renderStockTab() {
    const s = state.stock;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "📦", label: "Total Barang", value: sum => fmtNum(sum.totalBarang) },
        { icon: "📊", label: "Total Stok", value: sum => fmtNum(sum.totalStok) },
        { icon: "🟡", label: "Stok Menipis", value: sum => fmtNum(sum.menipis), color: "warning" },
        { icon: "🔴", label: "Stok Habis", value: sum => fmtNum(sum.habis), color: "danger" },
        { icon: "💰", label: "Nilai (Beli)", value: sum => fmtRupiah(sum.totalNilaiBeli), color: "success" },
        { icon: "💵", label: "Nilai (Jual)", value: sum => fmtRupiah(sum.totalNilaiJual), color: "primary" }
    ]);

    const rowsHTML = (s.data || []).map(b => `
        <tr>
            <td><strong>${esc(b.kode)}</strong></td>
            <td>${esc(b.nama)}</td>
            <td>${esc(b.satuan || "-")}</td>
            <td>${esc(b.gudang || "-")}</td>
            <td style="text-align:right"><strong>${fmtNum(b.stok)}</strong></td>
            <td style="text-align:right">${fmtNum(b.stok_minimum)}</td>
            <td style="text-align:right">${fmtRupiah(b.harga_beli)}</td>
            <td style="text-align:right">${fmtRupiah(b.nilaiBeli)}</td>
            <td style="text-align:right">${fmtRupiah(b.nilaiJual)}</td>
            <td>${stokBadge(b.statusStok)}</td>
        </tr>
    `).join("");

    const tableHTML = renderTableWrap(
        [
            { label: "Kode" }, { label: "Nama Barang" }, { label: "Satuan" }, { label: "Gudang" },
            { label: "Stok", align: "right" }, { label: "Min", align: "right" },
            { label: "Harga Beli", align: "right" }, { label: "Nilai Beli", align: "right" },
            { label: "Nilai Jual", align: "right" }, { label: "Status" }
        ],
        rowsHTML,
        state.loading ? "Memuat..." : "Belum ada data barang"
    );

    return `
        ${renderToolbar({ searchId: "lpr-stock-search", searchValue: state.stockSearch, placeholder: "Cari kode/nama/gudang..." })}
        ${summaryHTML}
        <div class="lpr-sort-row">
            <span class="lpr-sort-label">Urutkan:</span>
            <select id="lpr-stock-sort" class="lpr-sort-select">
                <option value="nama" ${state.stockSort === "nama" ? "selected" : ""}>Nama A-Z</option>
                <option value="stok" ${state.stockSort === "stok" ? "selected" : ""}>Stok Terendah</option>
                <option value="nilai" ${state.stockSort === "nilai" ? "selected" : ""}>Nilai Terbesar</option>
            </select>
        </div>
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-stock-page")}
    `;
}

// ═══════════════════════════════════════════════
//  Tab 2 & 3: Pembelian / Penjualan
// ═══════════════════════════════════════════════

function renderPurchaseTab() {
    const s = state.purchase;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "🧾", label: "Total PO", value: sum => fmtNum(sum.totalTransaksi) },
        { icon: "📦", label: "Total Item", value: sum => fmtNum(sum.totalItem) },
        { icon: "↩️", label: "Total Retur", value: sum => fmtRupiah(sum.totalRetur), color: "warning" },
        { icon: "🛒", label: "Total Pembelian (Neto)", value: sum => fmtRupiah(sum.totalPembelian), color: "success" }
    ]);

    const rowsHTML = (s.data || []).map(p => {
        const retur = Number(p.retur) || 0;
        const totalNet = (Number(p.grandTotal) || 0) - retur;
        return `
        <tr>
            <td><strong>${esc(p.nomor)}</strong></td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${esc(p.supplierName || p.supplier || "-")}</td>
            <td style="text-align:center">${(p.items || []).length}</td>
            <td style="text-align:right">${retur > 0 ? fmtRupiah(retur) : "-"}</td>
            <td style="text-align:right"><strong>${fmtRupiah(totalNet)}</strong></td>
            <td>${statusBadge(p.status)}</td>
        </tr>
    `;
    }).join("");

    const tableHTML = renderTableWrap(
        [
            { label: "No. PO" }, { label: "Tanggal" }, { label: "Supplier" },
            { label: "Item", align: "center" }, { label: "Retur", align: "right" },
            { label: "Total", align: "right" }, { label: "Status" }
        ],
        rowsHTML,
        state.loading ? "Memuat..." : "Belum ada data pembelian"
    );

    return `
        ${renderToolbar({
            searchId: "lpr-purchase-search", searchValue: state.purchaseSearch, placeholder: "Cari no. PO/supplier...",
            startId: "lpr-purchase-start", startVal: state.purchaseStart,
            endId: "lpr-purchase-end", endVal: state.purchaseEnd
        })}
        ${summaryHTML}
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-purchase-page")}
    `;
}

function renderSalesTab() {
    const isPos = services.isPos === true;
    const s = state.sales;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "🧾", label: isPos ? "Total Nota" : "Total SO", value: sum => fmtNum(sum.totalTransaksi) },
        { icon: "📦", label: "Total Item", value: sum => fmtNum(sum.totalItem) },
        { icon: "💰", label: "Total Penjualan (Bruto)", value: sum => fmtRupiah(sum.totalBruto), color: "primary" },
        { icon: "🧾", label: "Total Pajak", value: sum => fmtRupiah(sum.totalPajak), color: "success" },
        { icon: "↩️", label: "Total Retur", value: sum => fmtRupiah(sum.totalRetur), color: "warning" },
        { icon: "📈", label: isPos ? "Net Sales" : "Total Penjualan (Neto)", value: sum => fmtRupiah(sum.totalPenjualan) }
    ]);

    const rowsHTML = (s.data || []).map(p => {
        const retur = Number(p.retur) || 0;
        // Net Sales = grandTotal − retur − pajak (POS; grandTotal include pajak)
        const totalNet = (Number(p.grandTotal) || 0) - retur - (isPos ? (Number(p.pajak) || 0) : 0);
        if (isPos) {
            // M6-FIX: urutan kolom POS — tanggal, no. nota, pelanggan, item,
            // penjualan (gross), retur, pajak, net sales (status selalu paid).
            return `
            <tr>
                <td>${formatDate(p.tanggal)}</td>
                <td><strong>${esc(p.nomor)}</strong></td>
                <td>${esc(p.pelangganNama || p.pelanggan || "-")}</td>
                <td style="text-align:center">${(p.items || []).length}</td>
                <td style="text-align:right">${fmtRupiah(Number(p.grandTotal) || 0)}</td>
                <td style="text-align:right">${retur > 0 ? fmtRupiah(retur) : "-"}</td>
                <td style="text-align:right">${fmtRupiah(p.pajak || 0)}</td>
                <td style="text-align:right"><strong>${fmtRupiah(totalNet)}</strong></td>
            </tr>
        `;
        }
        return `
        <tr>
            <td><strong>${esc(p.nomor)}</strong></td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${esc(p.pelangganNama || p.pelanggan || "-")}</td>
            <td style="text-align:center">${(p.items || []).length}</td>
            <td style="text-align:right">${fmtRupiah(p.pajak || 0)}</td>
            <td style="text-align:right">${retur > 0 ? fmtRupiah(retur) : "-"}</td>
            <td style="text-align:right"><strong>${fmtRupiah(totalNet)}</strong></td>
            <td>${statusBadge(p.status)}</td>
        </tr>
    `;
    }).join("");

    const tableHTML = renderTableWrap(
        isPos
            ? [
                { label: "Tanggal" }, { label: "No. Nota" }, { label: "Pelanggan" },
                { label: "Item", align: "center" }, { label: "Penjualan", align: "right" },
                { label: "Retur", align: "right" }, { label: "Pajak", align: "right" },
                { label: "Net Sales", align: "right" }
            ]
            : [
                { label: "No. SO" }, { label: "Tanggal" }, { label: "Pelanggan" },
                { label: "Item", align: "center" }, { label: "Pajak", align: "right" },
                { label: "Retur", align: "right" }, { label: "Total", align: "right" }, { label: "Status" }
            ],
        rowsHTML,
        state.loading ? "Memuat..." : "Belum ada data penjualan"
    );

    return `
        ${renderToolbar({
            searchId: "lpr-sales-search", searchValue: state.salesSearch, placeholder: isPos ? "Cari no. nota/pelanggan..." : "Cari no. SO/pelanggan...",
            startId: "lpr-sales-start", startVal: state.salesStart,
            endId: "lpr-sales-end", endVal: state.salesEnd
        })}
        ${summaryHTML}
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-sales-page")}
    `;
}

// ═══════════════════════════════════════════════
//  Tab 4: Nilai Inventori
// ═══════════════════════════════════════════════

function renderValueTab() {
    const v = state.invValue;
    if (!v) return `<div class="lpr-loading">Memuat...</div>`;

    const summaryHTML = renderSummaryCards({
        totalNilaiBeli: v.totalNilaiBeli, totalNilaiJual: v.totalNilaiJual,
        totalBarang: v.totalBarang, totalStok: v.totalStok
    }, [
        { icon: "💰", label: "Total Nilai (Beli)", value: s => fmtRupiah(s.totalNilaiBeli), color: "success" },
        { icon: "💵", label: "Total Nilai (Jual)", value: s => fmtRupiah(s.totalNilaiJual), color: "primary" },
        { icon: "📦", label: "Total Barang", value: s => fmtNum(s.totalBarang) },
        { icon: "📊", label: "Total Stok", value: s => fmtNum(s.totalStok) }
    ]);

    const whRows = (v.byWarehouse || []).map(w => `
        <tr>
            <td><strong>${esc(w.gudang)}</strong></td>
            <td style="text-align:center">${fmtNum(w.jumlahBarang)}</td>
            <td style="text-align:right">${fmtNum(w.totalStok)}</td>
            <td style="text-align:right">${fmtRupiah(w.nilaiBeli)}</td>
            <td style="text-align:right">${fmtRupiah(w.nilaiJual)}</td>
        </tr>
    `).join("");

    const katRows = (v.byKategori || []).map(k => `
        <tr>
            <td><strong>${esc(k.kategori)}</strong></td>
            <td style="text-align:center">${fmtNum(k.jumlahBarang)}</td>
            <td style="text-align:right">${fmtNum(k.totalStok)}</td>
            <td style="text-align:right">${fmtRupiah(k.nilaiBeli)}</td>
            <td style="text-align:right">${fmtRupiah(k.nilaiJual)}</td>
        </tr>
    `).join("");

    return `
        <div class="lpr-toolbar">
            <div class="lpr-toolbar-left"></div>
            <div class="lpr-toolbar-right">
                <button class="lpr-btn lpr-btn-print" id="lpr-btn-print" title="Cetak laporan">🖨️ Cetak</button>
            </div>
        </div>
        ${summaryHTML}
        <div class="lpr-value-grid">
            <div class="lpr-section">
                <div class="lpr-section-title">🏭 Nilai per Gudang</div>
                ${renderTableWrap(
                    [{ label: "Gudang" }, { label: "Barang", align: "center" }, { label: "Stok", align: "right" }, { label: "Nilai Beli", align: "right" }, { label: "Nilai Jual", align: "right" }],
                    whRows, "Belum ada data"
                )}
            </div>
            <div class="lpr-section">
                <div class="lpr-section-title">🏷️ Nilai per Kategori</div>
                ${renderTableWrap(
                    [{ label: "Kategori" }, { label: "Barang", align: "center" }, { label: "Stok", align: "right" }, { label: "Nilai Beli", align: "right" }, { label: "Nilai Jual", align: "right" }],
                    katRows, "Belum ada data"
                )}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Tab 5: Mutasi Stok
// ═══════════════════════════════════════════════

function renderMutationTab() {
    const s = state.mutation;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "🔄", label: "Total Mutasi", value: sum => fmtNum(sum.totalMutasi) },
        { icon: "📥", label: "Qty Masuk", value: sum => fmtNum(sum.totalMasuk), color: "success" },
        { icon: "📤", label: "Qty Keluar", value: sum => fmtNum(sum.totalKeluar), color: "danger" },
        { icon: "🚚", label: "Qty Pindah", value: sum => fmtNum(sum.totalPindah), color: "primary" }
    ]);

    const rowsHTML = (s.data || []).map(m => `
        <tr>
            <td><strong>${esc(m.nomor)}</strong></td>
            <td>${formatDate(m.tanggal)}</td>
            <td>${mutationBadge(m.type)}</td>
            <td>${esc(m.icon)} ${esc(m.label)}</td>
            <td>${esc(m.ref)}</td>
            <td style="text-align:right"><strong>${fmtNum(m.qty)}</strong></td>
            <td style="text-align:right">${m.total ? fmtRupiah(m.total) : "-"}</td>
        </tr>
    `).join("");

    const tableHTML = renderTableWrap(
        [
            { label: "No. Dokumen" }, { label: "Tanggal" }, { label: "Tipe" },
            { label: "Jenis" }, { label: "Referensi" }, { label: "Qty", align: "right" }, { label: "Total", align: "right" }
        ],
        rowsHTML,
        state.loading ? "Memuat..." : "Belum ada mutasi stok"
    );

    return `
        ${renderToolbar({
            startId: "lpr-mutation-start", startVal: state.mutationStart,
            endId: "lpr-mutation-end", endVal: state.mutationEnd
        })}
        ${summaryHTML}
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-mutation-page")}
    `;
}

// ═══════════════════════════════════════════════
//  Tab 6 & 7: Supplier / Customer
// ═══════════════════════════════════════════════

function renderSupplierTab() {
    const s = state.supplier;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "🚚", label: "Supplier Aktif", value: sum => fmtNum(sum.totalSupplier) },
        { icon: "🧾", label: "Total PO", value: sum => fmtNum(sum.totalPO) },
        { icon: "🛒", label: "Total Pembelian", value: sum => fmtRupiah(sum.totalPembelian), color: "success" }
    ]);

    const rowsHTML = (s.data || []).map(x => `
        <tr>
            <td><strong>${esc(x.supplier)}</strong></td>
            <td>${esc(x.nama)}</td>
            <td style="text-align:center">${fmtNum(x.jumlahPO)}</td>
            <td style="text-align:right">${fmtRupiah(x.totalPembelian)}</td>
            <td>${esc(x.telepon || x.kontak || "-")}</td>
        </tr>
    `).join("");

    const tableHTML = renderTableWrap(
        [
            { label: "Kode" }, { label: "Nama Supplier" }, { label: "Jumlah PO", align: "center" },
            { label: "Total Pembelian", align: "right" }, { label: "Kontak" }
        ],
        rowsHTML,
        state.loading ? "Memuat..." : "Belum ada data supplier"
    );

    return `
        ${renderToolbar({ searchId: "lpr-supplier-search", searchValue: state.supplierSearch, placeholder: "Cari kode/nama supplier..." })}
        ${summaryHTML}
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-supplier-page")}
    `;
}

function renderCustomerTab() {
    const isPos = services.isPos === true;
    const s = state.customer;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "👤", label: "Customer Aktif", value: sum => fmtNum(sum.totalCustomer) },
        { icon: "🧾", label: isPos ? "Total Nota" : "Total SO", value: sum => fmtNum(sum.totalSO) },
        { icon: "💰", label: "Total Penjualan", value: sum => fmtRupiah(sum.totalPenjualan), color: "primary" }
    ]);

    const rowsHTML = (s.data || []).map(x => `
        <tr>
            <td><strong>${esc(x.pelanggan)}</strong></td>
            <td>${esc(x.nama)}</td>
            <td style="text-align:center">${fmtNum(x.jumlahSO)}</td>
            <td style="text-align:right">${fmtRupiah(x.totalPenjualan)}</td>
            <td>${esc(x.telepon || x.kontak || "-")}</td>
        </tr>
    `).join("");

    const tableHTML = renderTableWrap(
        [
            { label: "Kode" }, { label: "Nama Pelanggan" }, { label: isPos ? "Jumlah Nota" : "Jumlah SO", align: "center" },
            { label: "Total Penjualan", align: "right" }, { label: "Kontak" }
        ],
        rowsHTML,
        state.loading ? "Memuat..." : "Belum ada data customer"
    );

    return `
        ${renderToolbar({ searchId: "lpr-customer-search", searchValue: state.customerSearch, placeholder: "Cari kode/nama pelanggan..." })}
        ${summaryHTML}
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-customer-page")}
    `;
}

// ═══════════════════════════════════════════════
//  Tab 8: Laba-Rugi (Profit & Loss)
// ═══════════════════════════════════════════════

function piutangBadge(item) {
    if (item.overdue) {
        return `<span class="lpr-piutang-badge lpr-piutang-overdue">⚠️ Overdue</span>`;
    }
    if (item.sisaHari === 0) {
        return `<span class="lpr-piutang-badge lpr-piutang-today">🗓️ Hari ini</span>`;
    }
    return `<span class="lpr-piutang-badge lpr-piutang-ok">🟢 Belum tempo</span>`;
}

function renderLabarugiTab() {
    const isPos = services.isPos === true;
    const s = state.labarugi;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "🧾", label: "Total Transaksi", value: sum => fmtNum(sum.totalTransaksi) },
        { icon: "💰", label: "Nilai Penjualan", value: sum => fmtRupiah(sum.totalPenjualan), color: "primary" },
        { icon: "📦", label: "Harga Pokok", value: sum => fmtRupiah(sum.totalHPP), color: "warning" },
        { icon: "💹", label: "Laba Kotor", value: sum => fmtRupiah(sum.totalLabaKotor), color: "success" },
        { icon: "📊", label: "Margin", value: sum => `${sum.margin ?? 0}%`, color: "primary" }
    ]);

    const viewToggle = `
        <div class="lpr-view-toggle" id="lpr-labarugi-view-toggle">
            <button class="lpr-view-btn ${state.labarugiView === "detail" ? "active" : ""}" data-lpr-labarugi-view="detail">📋 Detail</button>
            <button class="lpr-view-btn ${state.labarugiView === "rekap" ? "active" : ""}" data-lpr-labarugi-view="rekap">📊 Rekap</button>
        </div>
    `;

    let tableHTML = "";
    if (state.labarugiView === "rekap") {
        const rekapRows = (state.labarugiRekap || []).map(r => `
            <tr>
                <td><strong>${esc(r.label)}</strong></td>
                <td style="text-align:center">${fmtNum(r.jumlahSO)}</td>
                <td style="text-align:right">${fmtRupiah(r.penjualan)}</td>
                <td style="text-align:right">${fmtRupiah(r.hpp)}</td>
                <td style="text-align:right" class="lpr-laba-cell ${r.laba < 0 ? "neg" : ""}">${fmtRupiah(r.laba)}</td>
                <td style="text-align:right">${r.penjualan > 0 ? Math.round((r.laba / r.penjualan) * 1000) / 10 + "%" : "-"}</td>
            </tr>
        `).join("");
        tableHTML = renderTableWrap(
            [
                { label: "Bulan" }, { label: isPos ? "Jumlah Nota" : "Jumlah SO", align: "center" },
                { label: "Nilai Penjualan", align: "right" }, { label: "Harga Pokok", align: "right" },
                { label: "Laba Kotor", align: "right" }, { label: "Margin", align: "right" }
            ],
            rekapRows,
            state.loading ? "Memuat..." : "Belum ada data penjualan pada periode ini"
        );
    } else {
        const rowsHTML = (s.data || []).map(r => `
            <tr>
                <td><strong>${esc(r.nomor)}</strong></td>
                <td>${formatDate(r.tanggal)}</td>
                <td>${esc(r.pelangganNama || r.pelanggan || "-")}</td>
                <td style="text-align:center">${(r.items || []).length}</td>
                <td style="text-align:right">${fmtRupiah(r.nilaiPenjualan)}</td>
                <td style="text-align:right">${fmtRupiah(r.hpp)}</td>
                <td style="text-align:right" class="lpr-laba-cell ${r.labaKotor < 0 ? "neg" : ""}">${fmtRupiah(r.labaKotor)}</td>
                <td>${statusBadge(r.status)}</td>
            </tr>
        `).join("");
        tableHTML = renderTableWrap(
            [
                { label: isPos ? "No. Nota" : "No. SO" }, { label: "Tanggal" }, { label: "Pelanggan" }, { label: "Item", align: "center" },
                { label: "Nilai Penjualan", align: "right" }, { label: "Harga Pokok", align: "right" },
                { label: "Laba Kotor", align: "right" }, { label: "Status" }
            ],
            rowsHTML,
            state.loading ? "Memuat..." : "Belum ada data penjualan"
        );
    }

    return `
        <div class="lpr-toolbar">
            <div class="lpr-toolbar-left">
                ${viewToggle}
                <div class="lpr-search">
                    <span class="lpr-search-icon">🔍</span>
                    <input type="text" id="lpr-labarugi-search" placeholder="${isPos ? "Cari no. nota/pelanggan..." : "Cari no. SO/pelanggan..."}" value="${esc(state.labarugiSearch)}" autocomplete="off" />
                </div>
                <div class="lpr-date-range">
                    <input type="date" id="lpr-labarugi-start" value="${esc(state.labarugiStart)}" title="Dari tanggal" />
                    <span>s/d</span>
                    <input type="date" id="lpr-labarugi-end" value="${esc(state.labarugiEnd)}" title="Sampai tanggal" />
                </div>
            </div>
            <div class="lpr-toolbar-right">
                <button class="lpr-btn lpr-btn-print" id="lpr-btn-print" title="Cetak laporan">🖨️ Cetak</button>
            </div>
        </div>
        ${summaryHTML}
        ${tableHTML}
        ${state.labarugiView === "detail" ? renderPaginationHTML(s.pagination, "lpr-labarugi-page") : ""}
    `;
}

// ═══════════════════════════════════════════════
//  Tab 9: Piutang (Accounts Receivable)
// ═══════════════════════════════════════════════

function renderPiutangTab() {
    const isPos = services.isPos === true;
    const s = state.piutang;
    const summaryHTML = renderSummaryCards(s.summary, [
        { icon: "🧾", label: "Jumlah Tagihan", value: sum => fmtNum(sum.totalTransaksi) },
        { icon: "💰", label: "Total Piutang", value: sum => fmtRupiah(sum.totalPiutang), color: "primary" },
        { icon: "🟢", label: "Belum Jatuh Tempo", value: sum => fmtRupiah(sum.totalBelumJatuhTempo), color: "success" },
        { icon: "⚠️", label: "Overdue", value: sum => `${fmtNum(sum.jumlahOverdue)} tagihan`, color: "danger" },
        { icon: "🔴", label: "Total Overdue", value: sum => fmtRupiah(sum.totalOverdue), color: "danger" }
    ]);

    const rowsHTML = (s.data || []).map(p => `
        <tr>
            <td><strong>${esc(p.nomor)}</strong></td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${esc(p.pelangganNama || p.pelanggan || "-")}</td>
            <td style="text-align:right"><strong>${fmtRupiah(p.grandTotal)}</strong></td>
            <td>${statusBadge(p.status)}</td>
            <td>${formatDate(p.jatuhTempo)}</td>
            <td style="text-align:center">${esc(p.sisaHariLabel)}</td>
            <td style="text-align:center">${piutangBadge(p)}</td>
        </tr>
    `).join("");

    const tableHTML = renderTableWrap(
        [
            { label: isPos ? "No. Nota" : "No. SO" }, { label: "Tanggal" }, { label: "Pelanggan" },
            { label: "Sisa Tagihan", align: "right" }, { label: "Status" },
            { label: "Jatuh Tempo" }, { label: "Sisa Hari", align: "center" }, { label: "Status Piutang", align: "center" }
        ],
        rowsHTML,
        state.loading ? "Memuat..." : "Tidak ada piutang (semua penjualan sudah lunas)"
    );

    return `
        <div class="lpr-toolbar">
            <div class="lpr-toolbar-left">
                <div class="lpr-search">
                    <span class="lpr-search-icon">🔍</span>
                    <input type="text" id="lpr-piutang-search" placeholder="${isPos ? "Cari no. nota/pelanggan..." : "Cari no. SO/pelanggan..."}" value="${esc(state.piutangSearch)}" autocomplete="off" />
                </div>
                <div class="lpr-date-range">
                    <input type="date" id="lpr-piutang-start" value="${esc(state.piutangStart)}" title="Dari tanggal" />
                    <span>s/d</span>
                    <input type="date" id="lpr-piutang-end" value="${esc(state.piutangEnd)}" title="Sampai tanggal" />
                </div>
                <div class="lpr-term">
                    <span class="lpr-term-label">Tempo</span>
                    <input type="number" id="lpr-piutang-term" min="0" value="${esc(state.piutangTermDays)}" title="Jangka waktu jatuh tempo (hari)" />
                    <span class="lpr-term-unit">hari</span>
                </div>
            </div>
            <div class="lpr-toolbar-right">
                <button class="lpr-btn lpr-btn-print" id="lpr-btn-print" title="Cetak laporan">🖨️ Cetak</button>
            </div>
        </div>
        ${summaryHTML}
        ${tableHTML}
        ${renderPaginationHTML(s.pagination, "lpr-piutang-page")}
    `;
}

// ═══════════════════════════════════════════════
//  Data Loading
// ═══════════════════════════════════════════════

async function loadActiveTab() {
    state.loading = true;
    const tab = state.activeTab;
    switch (tab) {
        case "stock": await loadStock(); break;
        case "purchase": await loadPurchase(); break;
        case "sales": await loadSales(); break;
        case "value": await loadValue(); break;
        case "mutation": await loadMutation(); break;
        case "supplier": await loadSupplier(); break;
        case "customer": await loadCustomer(); break;
        case "labarugi": await loadLabarugi(); break;
        case "piutang": await loadPiutang(); break;
    }
    state.loading = false;
    // Guard: jika tab sudah berpindah saat request berjalan, jangan render data basi
    if (state.activeTab !== tab) return;
    renderContent();
    attachTabContentEvents();
}

function loadStock(page = 1) {
    state.stock.pagination.page = page;
    return services.getLaporanStock({
        page, limit: state.stock.pagination.limit,
        search: state.stockSearch, sort: state.stockSort
    }).then(result => {
        state.stock = result || state.stock;
        if (state.activeTab !== "stock") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadStock failed:", err);
        showToast("danger", "Gagal memuat laporan stok: " + err.message);
    });
}

function loadPurchase(page = 1) {
    state.purchase.pagination.page = page;
    return services.getLaporanPurchase({
        page, limit: state.purchase.pagination.limit,
        search: state.purchaseSearch,
        startDate: state.purchaseStart || undefined,
        endDate: state.purchaseEnd || undefined
    }).then(result => {
        state.purchase = result || state.purchase;
        if (state.activeTab !== "purchase") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadPurchase failed:", err);
        showToast("danger", "Gagal memuat laporan pembelian: " + err.message);
    });
}

function loadSales(page = 1) {
    state.sales.pagination.page = page;
    return services.getLaporanSales({
        page, limit: state.sales.pagination.limit,
        search: state.salesSearch,
        startDate: state.salesStart || undefined,
        endDate: state.salesEnd || undefined
    }).then(result => {
        state.sales = result || state.sales;
        if (state.activeTab !== "sales") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadSales failed:", err);
        showToast("danger", "Gagal memuat laporan penjualan: " + err.message);
    });
}

function loadValue() {
    return services.getInventoryValueReport().then(result => {
        state.invValue = result || null;
        if (state.activeTab !== "value") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadValue failed:", err);
        showToast("danger", "Gagal memuat nilai inventori: " + err.message);
    });
}

function loadMutation(page = 1) {
    state.mutation.pagination.page = page;
    return services.getStockMutationReport({
        page, limit: state.mutation.pagination.limit,
        startDate: state.mutationStart || undefined,
        endDate: state.mutationEnd || undefined
    }).then(result => {
        state.mutation = result || state.mutation;
        if (state.activeTab !== "mutation") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadMutation failed:", err);
        showToast("danger", "Gagal memuat mutasi stok: " + err.message);
    });
}

function loadSupplier(page = 1) {
    state.supplier.pagination.page = page;
    return services.getSupplierReport({
        page, limit: state.supplier.pagination.limit,
        search: state.supplierSearch
    }).then(result => {
        state.supplier = result || state.supplier;
        if (state.activeTab !== "supplier") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadSupplier failed:", err);
        showToast("danger", "Gagal memuat laporan supplier: " + err.message);
    });
}

function loadCustomer(page = 1) {
    state.customer.pagination.page = page;
    return services.getCustomerReport({
        page, limit: state.customer.pagination.limit,
        search: state.customerSearch
    }).then(result => {
        state.customer = result || state.customer;
        if (state.activeTab !== "customer") return;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadCustomer failed:", err);
        showToast("danger", "Gagal memuat laporan customer: " + err.message);
    });
}

function loadLabarugi(page = 1) {
    const view = state.labarugiView;
    state.labarugi.pagination.page = page;
    return services.getLaporanLabarugi({
        page, limit: state.labarugi.pagination.limit,
        search: state.labarugiSearch,
        startDate: state.labarugiStart || undefined,
        endDate: state.labarugiEnd || undefined,
        mode: view
    }).then(result => {
        // Guard: jangan terapkan response basi bila tab/view sudah berpindah
        if (state.activeTab !== "labarugi" || state.labarugiView !== view) return;
        state.labarugi = result || state.labarugi;
        state.labarugiRekap = result?.rekapBulan || [];
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadLabarugi failed:", err);
        showToast("danger", "Gagal memuat laporan laba-rugi: " + err.message);
    });
}

function loadPiutang(page = 1) {
    state.piutang.pagination.page = page;
    return services.getLaporanPiutang({
        page, limit: state.piutang.pagination.limit,
        search: state.piutangSearch,
        startDate: state.piutangStart || undefined,
        endDate: state.piutangEnd || undefined,
        termDays: state.piutangTermDays
    }).then(result => {
        if (state.activeTab !== "piutang") return;
        state.piutang = result || state.piutang;
        if (result?.termDays !== undefined) state.piutangTermDays = result.termDays;
        renderContent();
    }).catch(err => {
        console.warn("[Laporan] loadPiutang failed:", err);
        showToast("danger", "Gagal memuat laporan piutang: " + err.message);
    });
}

// ═══════════════════════════════════════════════
//  Event Handlers
// ═══════════════════════════════════════════════

function attachTabContentEvents() {
    // Print
    document.getElementById("lpr-btn-print")?.addEventListener("click", () => {
        switch (state.activeTab) {
            case "stock": printStock(); break;
            case "purchase": printPurchase(); break;
            case "sales": printSales(); break;
            case "value": printValue(); break;
            case "mutation": printMutation(); break;
            case "supplier": printSupplier(); break;
            case "customer": printCustomer(); break;
            case "labarugi": printLabarugi(); break;
            case "piutang": printPiutang(); break;
        }
    });

    // Stock search + sort
    const stockSearch = document.getElementById("lpr-stock-search");
    if (stockSearch) {
        stockSearch.addEventListener("input", debounce((e) => {
            state.stockSearch = e.target.value.trim();
            loadStock(1);
        }, 350));
    }
    const stockSort = document.getElementById("lpr-stock-sort");
    if (stockSort) {
        stockSort.addEventListener("change", (e) => {
            state.stockSort = e.target.value;
            loadStock(1);
        });
    }
    document.querySelectorAll("[data-lpr-stock-page]").forEach(btn => {
        btn.addEventListener("click", () => loadStock(parseInt(btn.dataset.lprStockPage)));
    });

    // Purchase search + dates
    bindSearch("lpr-purchase-search", v => { state.purchaseSearch = v; loadPurchase(1); });
    bindDateRange("lpr-purchase-start", "lpr-purchase-end",
        v => { state.purchaseStart = v; loadPurchase(1); },
        v => { state.purchaseEnd = v; loadPurchase(1); });
    document.querySelectorAll("[data-lpr-purchase-page]").forEach(btn => {
        btn.addEventListener("click", () => loadPurchase(parseInt(btn.dataset.lprPurchasePage)));
    });

    // Sales search + dates
    bindSearch("lpr-sales-search", v => { state.salesSearch = v; loadSales(1); });
    bindDateRange("lpr-sales-start", "lpr-sales-end",
        v => { state.salesStart = v; loadSales(1); },
        v => { state.salesEnd = v; loadSales(1); });
    document.querySelectorAll("[data-lpr-sales-page]").forEach(btn => {
        btn.addEventListener("click", () => loadSales(parseInt(btn.dataset.lprSalesPage)));
    });

    // Mutation dates
    bindDateRange("lpr-mutation-start", "lpr-mutation-end",
        v => { state.mutationStart = v; loadMutation(1); },
        v => { state.mutationEnd = v; loadMutation(1); });
    document.querySelectorAll("[data-lpr-mutation-page]").forEach(btn => {
        btn.addEventListener("click", () => loadMutation(parseInt(btn.dataset.lprMutationPage)));
    });

    // Supplier search
    bindSearch("lpr-supplier-search", v => { state.supplierSearch = v; loadSupplier(1); });
    document.querySelectorAll("[data-lpr-supplier-page]").forEach(btn => {
        btn.addEventListener("click", () => loadSupplier(parseInt(btn.dataset.lprSupplierPage)));
    });

    // Customer search
    bindSearch("lpr-customer-search", v => { state.customerSearch = v; loadCustomer(1); });
    document.querySelectorAll("[data-lpr-customer-page]").forEach(btn => {
        btn.addEventListener("click", () => loadCustomer(parseInt(btn.dataset.lprCustomerPage)));
    });

    // Laba-Rugi: view toggle + search + dates
    document.querySelectorAll("[data-lpr-labarugi-view]").forEach(btn => {
        btn.addEventListener("click", () => {
            const view = btn.dataset.lprLabarugiView;
            if (view === state.labarugiView) return;
            state.labarugiView = view;
            // Render instan agar pergantian view langsung terasa, lalu muat ulang data
            renderContent();
            loadLabarugi(1);
        });
    });
    bindSearch("lpr-labarugi-search", v => { state.labarugiSearch = v; loadLabarugi(1); });
    bindDateRange("lpr-labarugi-start", "lpr-labarugi-end",
        v => { state.labarugiStart = v; loadLabarugi(1); },
        v => { state.labarugiEnd = v; loadLabarugi(1); });
    document.querySelectorAll("[data-lpr-labarugi-page]").forEach(btn => {
        btn.addEventListener("click", () => loadLabarugi(parseInt(btn.dataset.lprLabarugiPage)));
    });

    // Piutang: search + dates + term days
    bindSearch("lpr-piutang-search", v => { state.piutangSearch = v; loadPiutang(1); });
    bindDateRange("lpr-piutang-start", "lpr-piutang-end",
        v => { state.piutangStart = v; loadPiutang(1); },
        v => { state.piutangEnd = v; loadPiutang(1); });
    const termEl = document.getElementById("lpr-piutang-term");
    if (termEl) {
        termEl.addEventListener("change", (e) => {
            const val = parseInt(e.target.value, 10);
            state.piutangTermDays = (!isNaN(val) && val >= 0) ? val : 30;
            loadPiutang(1);
        });
    }
    document.querySelectorAll("[data-lpr-piutang-page]").forEach(btn => {
        btn.addEventListener("click", () => loadPiutang(parseInt(btn.dataset.lprPiutangPage)));
    });
}

function bindSearch(id, onChange) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", debounce((e) => onChange(e.target.value.trim()), 350));
}

function bindDateRange(startId, endId, onStartChange, onEndChange) {
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    if (startEl) startEl.addEventListener("change", (e) => onStartChange(e.target.value));
    if (endEl) endEl.addEventListener("change", (e) => onEndChange(e.target.value));
}

// ═══════════════════════════════════════════════
//  Print
// ═══════════════════════════════════════════════

// Baris data per halaman cetak — setiap halaman diakhiri baris SUBTOTAL,
// dan tabel ditutup baris TOTAL di halaman terakhir (permintaan user).
const PRINT_ROWS_PER_PAGE = 25;

/** Bagi array jadi potongan berukuran `size` (utk subtotal per halaman). */
function chunkArr(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Hitung subtotal per kolom numerik untuk sekumpulan baris.
 * `rowItems` = [{ html, values: number[] }] — values sejajar indeks kolom.
 * Mengembalikan MAP ber-`index` kolom tabel (bukan array posisional) supaya
 * pemanggil bisa membaca `result[c.index]` — indeks kolom TIDAK selalu
 * berurutan 0..n (kolom non-numerik disisipi di antaranya).
 * @param {Array<{html: string, values?: number[]}>} rowItems
 * @param {Array<{index: number, type?: "rupiah"|"number"}>} numericColumns
 * @returns {Object<number, number>}
 */
function sumColumns(rowItems, numericColumns) {
    const out = {};
    for (const c of numericColumns) {
        out[c.index] = rowItems.reduce((s, r) => s + (Number(r.values?.[c.index]) || 0), 0);
    }
    return out;
}

/** Format nilai subtotal/total sesuai tipe kolom. */
function fmtColumnValue(value, col) {
    if (col.type === "rupiah") return fmtRupiah(value);
    return fmtNum(value);
}

/**
 * Render tabel cetak DI-CHUNK (per halaman) — tiap chunk jadi satu tabel
 * dengan baris SUBTOTAL di akhir (tfoot), dipisah page-break; chunk terakhir
 * diberi baris TOTAL. thead otomatis berulang per tabel/halaman.
 * @param {Array<{label: string, align?: string}>} headers
 * @param {Array<{html: string, values?: number[]}>} rowItems
 * @param {Array<{index: number, label?: string, type?: "rupiah"|"number"}>} numericColumns
 * @param {number} rowsPerPage
 * @returns {string}
 */
function renderChunkedTables(headers, rowItems, numericColumns = [], rowsPerPage = PRINT_ROWS_PER_PAGE) {
    const chunks = chunkArr(rowItems || [], rowsPerPage);
    if (!chunks.length) {
        return `<table class="rpt-table">
            <thead><tr>${headers.map(h => `<th ${h.align ? `style="text-align:${h.align}"` : ""}>${esc(h.label)}</th>`).join("")}</tr></thead>
            <tbody><tr><td colspan="${headers.length}" style="text-align:center;color:#94a3b8;padding:14px">Tidak ada data</td></tr></tbody>
        </table>`;
    }
    const grandVals = sumColumns(rowItems, numericColumns);
    const colspanLabel = Math.max(1, headers.length - numericColumns.length);
    return chunks.map((chunk, ci) => {
        const isLast = ci === chunks.length - 1;
        const subtotalVals = sumColumns(chunk, numericColumns);
        const subRow = numericColumns.length ? `
            <tr class="rpt-subtotal">
                <td colspan="${colspanLabel}">Subtotal Halaman ${ci + 1}</td>
                ${numericColumns.map(c => `<td style="text-align:right">${fmtColumnValue(subtotalVals[c.index], c)}</td>`).join("")}
            </tr>` : "";
        const grandRow = (isLast && numericColumns.length) ? `
            <tr class="rpt-grand">
                <td colspan="${colspanLabel}">TOTAL</td>
                ${numericColumns.map(c => `<td style="text-align:right">${fmtColumnValue(grandVals[c.index], c)}</td>`).join("")}
            </tr>` : "";
        const foot = (subRow || grandRow) ? `<tfoot>${subRow}${grandRow}</tfoot>` : "";
        return `
            <table class="rpt-table">
                <thead><tr>${headers.map(h => `<th ${h.align ? `style="text-align:${h.align}"` : ""}>${esc(h.label)}</th>`).join("")}</tr></thead>
                <tbody>${chunk.map(r => r.html).join("")}</tbody>
                ${foot}
            </table>
            ${isLast ? "" : `<div class="rpt-page-break"></div>`}
        `;
    }).join("");
}

async function buildPrintHTML(title, subtitle, headers, rows, summaryRows = [], numericColumns = [], rowsPerPage = PRINT_ROWS_PER_PAGE) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "";
    const companyPhone = company.phone || "";
    const companyEmail = company.email || "";
    const logoUrl = company.logo || "";
    const printedBy = getCurrentUserName() || "_______________";

    const summaryHTML = summaryRows.length > 0 ? `
        <div class="rpt-summary">
            ${summaryRows.map(s => `
                <div class="rpt-summary-item">
                    <span class="rpt-summary-label">${s.label}</span>
                    <span class="rpt-summary-value">${s.value}</span>
                </div>
            `).join("")}
        </div>
    ` : "";

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>${esc(title)}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; padding:32px; }
        .rpt-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #4f46e5; padding-bottom:14px; margin-bottom:18px; }
        .rpt-company { display:flex; align-items:center; gap:12px; }
        .rpt-logo { height:52px; max-width:90px; object-fit:contain; }
        .rpt-logo-ph { width:44px; height:52px; background:#eef2ff; display:flex; align-items:center; justify-content:center; font-weight:700; color:#4f46e5; font-size:1.1rem; }
        .rpt-company-name { font-size:1.1rem; font-weight:700; }
        .rpt-company-detail { font-size:0.75rem; color:#64748b; line-height:1.4; }
        .rpt-title-block { text-align:right; }
        .rpt-title { font-size:1.4rem; font-weight:800; color:#4f46e5; }
        .rpt-subtitle { font-size:0.8rem; color:#64748b; }
        .rpt-summary { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
        .rpt-summary-item { border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; background:#f8fafc; }
        .rpt-summary-label { display:block; font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.4px; }
        .rpt-summary-value { font-size:1rem; font-weight:700; color:#1e293b; }
        table { width:100%; border-collapse:collapse; }
        th { background:#f1f5f9; padding:7px 8px; font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; border:1px solid #e2e8f0; letter-spacing:0.3px; }
        td { padding:6px 8px; font-size:0.8rem; border:1px solid #e2e8f0; }
        tr:nth-child(even) td { background:#fafbfc; }
        .rpt-footer { margin-top:20px; display:flex; justify-content:flex-end; }
        .rpt-sign { text-align:center; }
        .rpt-sign-label { font-size:0.75rem; color:#64748b; }
        .rpt-sign-space { height:52px; }
        .rpt-sign-name { font-size:0.85rem; font-weight:600; border-top:1px solid #94a3b8; padding-top:4px; min-width:150px; }
        .rpt-meta { font-size:0.7rem; color:#94a3b8; margin-top:4px; }
        /* Subtotal per halaman + TOTAL akhir (permintaan user) */
        .rpt-table { page-break-inside: avoid; }
        .rpt-page-break { page-break-after: always; }
        .rpt-subtotal td { background:#f8fafc; font-weight:700; border-top:2px solid #cbd5e1; color:#334155; }
        .rpt-grand td { background:#eef2ff; font-weight:800; border-top:2px solid #4f46e5; color:#3730a3; }
        @media print { body { padding:0; } }
        @page { margin:14mm; }
    </style>
</head>
<body>
    <div class="rpt-header">
        <div class="rpt-company">
            ${logoUrl ? `<img src="${esc(logoUrl)}" class="rpt-logo" />` : `<div class="rpt-logo-ph">${(companyName || "P").charAt(0)}</div>`}
            <div>
                <div class="rpt-company-name">${esc(companyName)}</div>
                <div class="rpt-company-detail">${esc(companyAddress)}<br/>${companyPhone ? `Telp: ${esc(companyPhone)}` : ""} ${companyEmail ? `| Email: ${esc(companyEmail)}` : ""}</div>
            </div>
        </div>
        <div class="rpt-title-block">
            <div class="rpt-title">${esc(title)}</div>
            <div class="rpt-subtitle">${esc(subtitle)}</div>
            <div class="rpt-meta">Dicetak: ${new Date().toLocaleString("id-ID")}</div>
        </div>
    </div>
    ${summaryHTML}
    ${renderChunkedTables(headers, (rows || []).map(r => (r && typeof r === "object" && r.html !== undefined) ? r : { html: r, values: [] }), numericColumns, rowsPerPage)}
    <div class="rpt-footer">
        <div class="rpt-sign">
            <div class="rpt-sign-label">Dicetak oleh</div>
            <div class="rpt-sign-space"></div>
            <div class="rpt-sign-name">${esc(printedBy)}</div>
        </div>
    </div>
</body>
</html>`;
}

async function printStock() {
    const s = state.stock;
    const rows = (s.data || []).map(b => ({
        html: `
        <tr>
            <td>${esc(b.kode)}</td>
            <td>${esc(b.nama)}</td>
            <td>${esc(b.satuan || "-")}</td>
            <td>${esc(b.gudang || "-")}</td>
            <td style="text-align:right">${fmtNum(b.stok)}</td>
            <td style="text-align:right">${fmtNum(b.stok_minimum)}</td>
            <td style="text-align:right">${fmtRupiah(b.harga_beli)}</td>
            <td style="text-align:right">${fmtRupiah(b.nilaiBeli)}</td>
            <td style="text-align:right">${fmtRupiah(b.nilaiJual)}</td>
        </tr>
    `,
        values: [0, 0, 0, 0, Number(b.stok) || 0, Number(b.stok_minimum) || 0, Number(b.harga_beli) || 0, Number(b.nilaiBeli) || 0, Number(b.nilaiJual) || 0]
    }));

    const html = await buildPrintHTML(
        "Laporan Stok",
        `Per ${formatDate(new Date().toISOString())}${state.stockSearch ? ` • Pencarian: ${state.stockSearch}` : ""}`,
        [
            { label: "Kode" }, { label: "Nama Barang" }, { label: "Satuan" }, { label: "Gudang" },
            { label: "Stok", align: "right" }, { label: "Min", align: "right" },
            { label: "Harga Beli", align: "right" }, { label: "Nilai Beli", align: "right" }, { label: "Nilai Jual", align: "right" }
        ],
        rows,
        [
            { label: "Total Barang", value: fmtNum(s.summary?.totalBarang) },
            { label: "Total Stok", value: fmtNum(s.summary?.totalStok) },
            { label: "Nilai (Beli)", value: fmtRupiah(s.summary?.totalNilaiBeli) },
            { label: "Nilai (Jual)", value: fmtRupiah(s.summary?.totalNilaiJual) }
        ],
        [
            { index: 4, type: "number" }, { index: 5, type: "number" },
            { index: 6, type: "rupiah" }, { index: 7, type: "rupiah" }, { index: 8, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Laporan Stok", false);
}

async function printPurchase() {
    const s = state.purchase;
    const rows = (s.data || []).map(p => {
        const retur = Number(p.retur) || 0;
        const totalNet = (Number(p.grandTotal) || 0) - retur;
        return {
            html: `
        <tr>
            <td>${esc(p.nomor)}</td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${esc(p.supplierName || p.supplier || "-")}</td>
            <td style="text-align:right">${fmtRupiah(retur)}</td>
            <td style="text-align:right">${fmtRupiah(totalNet)}</td>
            <td>${esc(p.status)}</td>
        </tr>
    `,
            values: [0, 0, 0, retur, totalNet, 0]
        };
    });

    const range = (state.purchaseStart || state.purchaseEnd)
        ? `${state.purchaseStart || "awal"} s/d ${state.purchaseEnd || "sekarang"}`
        : "Semua periode";
    const html = await buildPrintHTML(
        "Laporan Pembelian",
        range,
        [
            { label: "No. PO" }, { label: "Tanggal" }, { label: "Supplier" },
            { label: "Retur", align: "right" }, { label: "Total", align: "right" }, { label: "Status" }
        ],
        rows,
        [
            { label: "Total PO", value: fmtNum(s.summary?.totalTransaksi) },
            { label: "Total Item", value: fmtNum(s.summary?.totalItem) },
            { label: "Total Retur", value: fmtRupiah(s.summary?.totalRetur) },
            { label: "Total Pembelian (Neto)", value: fmtRupiah(s.summary?.totalPembelian) }
        ],
        [
            { index: 3, type: "rupiah" }, { index: 4, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Laporan Pembelian", false);
}

async function printSales() {
    const isPos = services.isPos === true;
    const s = state.sales;
    const rows = (s.data || []).map(p => {
        const retur = Number(p.retur) || 0;
        // Net Sales = grandTotal − retur − pajak (POS; grandTotal include pajak)
        const totalNet = (Number(p.grandTotal) || 0) - retur - (isPos ? (Number(p.pajak) || 0) : 0);
        if (isPos) {
            return {
                html: `
            <tr>
                <td>${formatDate(p.tanggal)}</td>
                <td>${esc(p.nomor)}</td>
                <td>${esc(p.pelangganNama || p.pelanggan || "-")}</td>
                <td style="text-align:center">${(p.items || []).length}</td>
                <td style="text-align:right">${fmtRupiah(Number(p.grandTotal) || 0)}</td>
                <td style="text-align:right">${fmtRupiah(retur)}</td>
                <td style="text-align:right">${fmtRupiah(p.pajak || 0)}</td>
                <td style="text-align:right"><strong>${fmtRupiah(totalNet)}</strong></td>
            </tr>
        `,
                values: [0, 0, 0, (p.items || []).length, Number(p.grandTotal) || 0, retur, Number(p.pajak) || 0, totalNet]
            };
        }
        return {
            html: `
        <tr>
            <td>${esc(p.nomor)}</td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${esc(p.pelangganNama || p.pelanggan || "-")}</td>
            <td style="text-align:right">${fmtRupiah(p.pajak || 0)}</td>
            <td style="text-align:right">${fmtRupiah(retur)}</td>
            <td style="text-align:right">${fmtRupiah(totalNet)}</td>
            <td>${esc(p.status)}</td>
        </tr>
    `,
            values: [0, 0, 0, Number(p.pajak) || 0, retur, totalNet, 0]
        };
    });

    const range = (state.salesStart || state.salesEnd)
        ? `${state.salesStart || "awal"} s/d ${state.salesEnd || "sekarang"}`
        : "Semua periode";
    const html = await buildPrintHTML(
        "Laporan Penjualan",
        range,
        isPos
            ? [
                { label: "Tanggal" }, { label: "No. Nota" }, { label: "Pelanggan" },
                { label: "Item", align: "center" }, { label: "Penjualan", align: "right" },
                { label: "Retur", align: "right" }, { label: "Pajak", align: "right" },
                { label: "Net Sales", align: "right" }
            ]
            : [
                { label: "No. SO" }, { label: "Tanggal" }, { label: "Pelanggan" },
                { label: "Pajak", align: "right" }, { label: "Retur", align: "right" },
                { label: "Total", align: "right" }, { label: "Status" }
            ],
        rows,
        [
            { label: isPos ? "Total Nota" : "Total SO", value: fmtNum(s.summary?.totalTransaksi) },
            { label: "Total Item", value: fmtNum(s.summary?.totalItem) },
            { label: "Total Penjualan (Bruto)", value: fmtRupiah(s.summary?.totalBruto) },
            { label: "Total Pajak", value: fmtRupiah(s.summary?.totalPajak) },
            { label: "Total Retur", value: fmtRupiah(s.summary?.totalRetur) },
            { label: isPos ? "Net Sales" : "Total Penjualan (Neto)", value: fmtRupiah(s.summary?.totalPenjualan) }
        ],
        isPos
            ? [
                { index: 3, type: "number" },
                { index: 4, type: "rupiah" }, { index: 5, type: "rupiah" },
                { index: 6, type: "rupiah" }, { index: 7, type: "rupiah" }
            ]
            : [
                { index: 3, type: "rupiah" }, { index: 4, type: "rupiah" }, { index: 5, type: "rupiah" }
            ]
    );
    printToWindow(html, "mencetak Laporan Penjualan", false);
}

const VALUE_TABLE_HEADERS = [
    { label: "Gudang" },
    { label: "Stok", align: "right" },
    { label: "Nilai Beli", align: "right" },
    { label: "Nilai Jual", align: "right" }
];
const VALUE_TABLE_NUMERIC = [
    { index: 1, type: "number" }, { index: 2, type: "rupiah" }, { index: 3, type: "rupiah" }
];

async function printValue() {
    const v = state.invValue;
    if (!v) return;
    const whRows = (v.byWarehouse || []).map(w => ({
        html: `
        <tr>
            <td>${esc(w.gudang)}</td>
            <td style="text-align:right">${fmtNum(w.totalStok)}</td>
            <td style="text-align:right">${fmtRupiah(w.nilaiBeli)}</td>
            <td style="text-align:right">${fmtRupiah(w.nilaiJual)}</td>
        </tr>
    `,
        values: [0, Number(w.totalStok) || 0, Number(w.nilaiBeli) || 0, Number(w.nilaiJual) || 0]
    }));
    const katRows = (v.byKategori || []).map(k => ({
        html: `
        <tr>
            <td>${esc(k.kategori)}</td>
            <td style="text-align:right">${fmtNum(k.totalStok)}</td>
            <td style="text-align:right">${fmtRupiah(k.nilaiBeli)}</td>
            <td style="text-align:right">${fmtRupiah(k.nilaiJual)}</td>
        </tr>
    `,
        values: [0, Number(k.totalStok) || 0, Number(k.nilaiBeli) || 0, Number(k.nilaiJual) || 0]
    }));

    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "";
    const companyPhone = company.phone || "";
    const companyEmail = company.email || "";
    const logoUrl = company.logo || "";
    const printedBy = getCurrentUserName() || "_______________";

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Nilai Inventori</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; padding:32px; }
        .rpt-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #4f46e5; padding-bottom:14px; margin-bottom:18px; }
        .rpt-company { display:flex; align-items:center; gap:12px; }
        .rpt-logo { height:52px; max-width:90px; object-fit:contain; }
        .rpt-logo-ph { width:44px; height:52px; background:#eef2ff; display:flex; align-items:center; justify-content:center; font-weight:700; color:#4f46e5; font-size:1.1rem; }
        .rpt-company-name { font-size:1.1rem; font-weight:700; }
        .rpt-company-detail { font-size:0.75rem; color:#64748b; line-height:1.4; }
        .rpt-title-block { text-align:right; }
        .rpt-title { font-size:1.4rem; font-weight:800; color:#4f46e5; }
        .rpt-subtitle { font-size:0.8rem; color:#64748b; }
        .rpt-meta { font-size:0.7rem; color:#94a3b8; margin-top:4px; }
        .rpt-summary { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
        .rpt-summary-item { border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; background:#f8fafc; }
        .rpt-summary-label { display:block; font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.4px; }
        .rpt-summary-value { font-size:1rem; font-weight:700; color:#1e293b; }
        table { width:100%; border-collapse:collapse; margin-bottom:10px; }
        th { background:#f1f5f9; padding:7px 8px; font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; border:1px solid #e2e8f0; letter-spacing:0.3px; }
        td { padding:6px 8px; font-size:0.8rem; border:1px solid #e2e8f0; }
        tr:nth-child(even) td { background:#fafbfc; }
        .rpt-section-title { font-size:0.95rem; font-weight:700; color:#374151; margin:16px 0 8px; }
        .rpt-page-break { page-break-before: always; }
        .rpt-table { page-break-inside: avoid; }
        .rpt-subtotal td { background:#f8fafc; font-weight:700; border-top:2px solid #cbd5e1; color:#334155; }
        .rpt-grand td { background:#eef2ff; font-weight:800; border-top:2px solid #4f46e5; color:#3730a3; }
        .rpt-footer { margin-top:20px; display:flex; justify-content:flex-end; }
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
        <div class="rpt-company">
            ${logoUrl ? `<img src="${esc(logoUrl)}" class="rpt-logo" />` : `<div class="rpt-logo-ph">${(companyName || "P").charAt(0)}</div>`}
            <div>
                <div class="rpt-company-name">${esc(companyName)}</div>
                <div class="rpt-company-detail">${esc(companyAddress)}<br/>${companyPhone ? `Telp: ${esc(companyPhone)}` : ""} ${companyEmail ? `| Email: ${esc(companyEmail)}` : ""}</div>
            </div>
        </div>
        <div class="rpt-title-block">
            <div class="rpt-title">Laporan Nilai Inventori</div>
            <div class="rpt-subtitle">Per ${formatDate(new Date().toISOString())}</div>
            <div class="rpt-meta">Dicetak: ${new Date().toLocaleString("id-ID")}</div>
        </div>
    </div>
    <div class="rpt-summary">
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Barang</span><span class="rpt-summary-value">${fmtNum(v.totalBarang)}</span></div>
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Stok</span><span class="rpt-summary-value">${fmtNum(v.totalStok)}</span></div>
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Nilai (Beli)</span><span class="rpt-summary-value">${fmtRupiah(v.totalNilaiBeli)}</span></div>
        <div class="rpt-summary-item"><span class="rpt-summary-label">Total Nilai (Jual)</span><span class="rpt-summary-value">${fmtRupiah(v.totalNilaiJual)}</span></div>
    </div>
    <div class="rpt-section-title">🏭 Nilai per Gudang</div>
    ${renderChunkedTables(VALUE_TABLE_HEADERS, whRows, VALUE_TABLE_NUMERIC)}
    <div class="rpt-page-break"></div>
    <div class="rpt-section-title">🏷️ Nilai per Kategori</div>
    ${renderChunkedTables(VALUE_TABLE_HEADERS.map(h => ({ ...h, label: h.label === "Gudang" ? "Kategori" : h.label })), katRows, VALUE_TABLE_NUMERIC)}
    <div class="rpt-footer">
        <div class="rpt-sign">
            <div class="rpt-sign-label">Dicetak oleh</div>
            <div class="rpt-sign-space"></div>
            <div class="rpt-sign-name">${esc(printedBy)}</div>
        </div>
    </div>
</body>
</html>`;
    printToWindow(html, "mencetak Nilai Inventori", false);
}

async function printMutation() {
    const s = state.mutation;
    const rows = (s.data || []).map(m => ({
        html: `
        <tr>
            <td>${esc(m.nomor)}</td>
            <td>${formatDate(m.tanggal)}</td>
            <td>${esc(m.label)}</td>
            <td>${esc(m.ref)}</td>
            <td style="text-align:right">${fmtNum(m.qty)}</td>
            <td style="text-align:right">${m.total ? fmtRupiah(m.total) : "-"}</td>
        </tr>
    `,
        values: [0, 0, 0, 0, Number(m.qty) || 0, Number(m.total) || 0]
    }));

    const range = (state.mutationStart || state.mutationEnd)
        ? `${state.mutationStart || "awal"} s/d ${state.mutationEnd || "sekarang"}`
        : "Semua periode";
    const html = await buildPrintHTML(
        "Laporan Mutasi Stok",
        range,
        [
            { label: "No. Dokumen" }, { label: "Tanggal" }, { label: "Jenis" },
            { label: "Referensi" }, { label: "Qty", align: "right" }, { label: "Total", align: "right" }
        ],
        rows,
        [
            { label: "Total Mutasi", value: fmtNum(s.summary?.totalMutasi) },
            { label: "Qty Masuk", value: fmtNum(s.summary?.totalMasuk) },
            { label: "Qty Keluar", value: fmtNum(s.summary?.totalKeluar) }
        ],
        [
            { index: 4, type: "number" }, { index: 5, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Mutasi Stok", false);
}

async function printSupplier() {
    const s = state.supplier;
    const rows = (s.data || []).map(x => ({
        html: `
        <tr>
            <td>${esc(x.supplier)}</td>
            <td>${esc(x.nama)}</td>
            <td style="text-align:center">${fmtNum(x.jumlahPO)}</td>
            <td style="text-align:right">${fmtRupiah(x.totalPembelian)}</td>
        </tr>
    `,
        values: [0, 0, Number(x.jumlahPO) || 0, Number(x.totalPembelian) || 0]
    }));

    const html = await buildPrintHTML(
        "Laporan Supplier",
        `${state.supplierSearch ? `Pencarian: ${state.supplierSearch}` : "Semua supplier"}`,
        [
            { label: "Kode" }, { label: "Nama Supplier" }, { label: "Jumlah PO", align: "center" }, { label: "Total Pembelian", align: "right" }
        ],
        rows,
        [
            { label: "Total PO", value: fmtNum(s.summary?.totalPO) },
            { label: "Total Pembelian", value: fmtRupiah(s.summary?.totalPembelian) }
        ],
        [
            { index: 2, type: "number" }, { index: 3, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Laporan Supplier", false);
}

async function printCustomer() {
    const isPos = services.isPos === true;
    const s = state.customer;
    const rows = (s.data || []).map(x => ({
        html: `
        <tr>
            <td>${esc(x.pelanggan)}</td>
            <td>${esc(x.nama)}</td>
            <td style="text-align:center">${fmtNum(x.jumlahSO)}</td>
            <td style="text-align:right">${fmtRupiah(x.totalPenjualan)}</td>
        </tr>
    `,
        values: [0, 0, Number(x.jumlahSO) || 0, Number(x.totalPenjualan) || 0]
    }));

    const html = await buildPrintHTML(
        "Laporan Pelanggan",
        `${state.customerSearch ? `Pencarian: ${state.customerSearch}` : "Semua pelanggan"}`,
        [
            { label: "Kode" }, { label: "Nama Pelanggan" }, { label: isPos ? "Jumlah Nota" : "Jumlah SO", align: "center" }, { label: "Total Penjualan", align: "right" }
        ],
        rows,
        [
            { label: isPos ? "Total Nota" : "Total SO", value: fmtNum(s.summary?.totalSO) },
            { label: "Total Penjualan", value: fmtRupiah(s.summary?.totalPenjualan) }
        ],
        [
            { index: 2, type: "number" }, { index: 3, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Laporan Pelanggan", false);
}

async function printLabarugi() {
    const isPos = services.isPos === true;
    const s = state.labarugi;
    const range = (state.labarugiStart || state.labarugiEnd)
        ? `${state.labarugiStart || "awal"} s/d ${state.labarugiEnd || "sekarang"}`
        : "Semua periode";

    if (state.labarugiView === "rekap") {
        const rows = (state.labarugiRekap || []).map(r => ({
            html: `
            <tr>
                <td>${esc(r.label)}</td>
                <td style="text-align:center">${fmtNum(r.jumlahSO)}</td>
                <td style="text-align:right">${fmtRupiah(r.penjualan)}</td>
                <td style="text-align:right">${fmtRupiah(r.hpp)}</td>
                <td style="text-align:right">${fmtRupiah(r.laba)}</td>
                <td style="text-align:right">${r.penjualan > 0 ? Math.round((r.laba / r.penjualan) * 1000) / 10 + "%" : "-"}</td>
            </tr>
        `,
            values: [0, Number(r.jumlahSO) || 0, Number(r.penjualan) || 0, Number(r.hpp) || 0, Number(r.laba) || 0, 0]
        }));
        const html = await buildPrintHTML(
            "Laporan Laba-Rugi (Rekap)",
            range,
            [
                { label: "Bulan" }, { label: isPos ? "Jumlah Nota" : "Jumlah SO", align: "center" },
                { label: "Nilai Penjualan", align: "right" }, { label: "Harga Pokok", align: "right" },
                { label: "Laba Kotor", align: "right" }, { label: "Margin", align: "right" }
            ],
            rows,
            [
                { label: "Nilai Penjualan", value: fmtRupiah(s.summary?.totalPenjualan) },
                { label: "Harga Pokok", value: fmtRupiah(s.summary?.totalHPP) },
                { label: "Laba Kotor", value: fmtRupiah(s.summary?.totalLabaKotor) },
                { label: "Margin", value: `${s.summary?.margin ?? 0}%` }
            ],
            [
                { index: 1, type: "number" },
                { index: 2, type: "rupiah" }, { index: 3, type: "rupiah" }, { index: 4, type: "rupiah" }
            ]
        );
        printToWindow(html, "mencetak Laporan Laba-Rugi", false);
        return;
    }

    const rows = (s.data || []).map(r => ({
        html: `
        <tr>
            <td>${esc(r.nomor)}</td>
            <td>${formatDate(r.tanggal)}</td>
            <td>${esc(r.pelangganNama || r.pelanggan || "-")}</td>
            <td style="text-align:right">${fmtRupiah(r.nilaiPenjualan)}</td>
            <td style="text-align:right">${fmtRupiah(r.hpp)}</td>
            <td style="text-align:right">${fmtRupiah(r.labaKotor)}</td>
        </tr>
    `,
        values: [0, 0, 0, Number(r.nilaiPenjualan) || 0, Number(r.hpp) || 0, Number(r.labaKotor) || 0]
    }));
    const html = await buildPrintHTML(
        "Laporan Laba-Rugi (Detail)",
        range,
        [
            { label: isPos ? "No. Nota" : "No. SO" }, { label: "Tanggal" }, { label: "Pelanggan" },
            { label: "Nilai Penjualan", align: "right" }, { label: "Harga Pokok", align: "right" }, { label: "Laba Kotor", align: "right" }
        ],
        rows,
        [
            { label: "Total Transaksi", value: fmtNum(s.summary?.totalTransaksi) },
            { label: "Nilai Penjualan", value: fmtRupiah(s.summary?.totalPenjualan) },
            { label: "Harga Pokok", value: fmtRupiah(s.summary?.totalHPP) },
            { label: "Laba Kotor", value: fmtRupiah(s.summary?.totalLabaKotor) }
        ],
        [
            { index: 3, type: "rupiah" }, { index: 4, type: "rupiah" }, { index: 5, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Laporan Laba-Rugi", false);
}

async function printPiutang() {
    const isPos = services.isPos === true;
    const s = state.piutang;
    const rows = (s.data || []).map(p => ({
        html: `
        <tr>
            <td>${esc(p.nomor)}</td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${esc(p.pelangganNama || p.pelanggan || "-")}</td>
            <td style="text-align:right">${fmtRupiah(p.grandTotal)}</td>
            <td>${esc(p.status)}</td>
            <td>${formatDate(p.jatuhTempo)}</td>
            <td style="text-align:center">${esc(p.sisaHariLabel)}</td>
            <td style="text-align:center">${p.overdue ? "OVERDUE" : "Belum tempo"}</td>
        </tr>
    `,
        values: [0, 0, 0, Number(p.grandTotal) || 0, 0, 0, 0, 0]
    }));

    const range = (state.piutangStart || state.piutangEnd)
        ? `${state.piutangStart || "awal"} s/d ${state.piutangEnd || "sekarang"}`
        : "Semua periode";
    const html = await buildPrintHTML(
        "Laporan Piutang",
        `${range} • Jatuh tempo: ${state.piutangTermDays} hari`,
        [
            { label: isPos ? "No. Nota" : "No. SO" }, { label: "Tanggal" }, { label: "Pelanggan" },
            { label: "Sisa Tagihan", align: "right" }, { label: "Status" },
            { label: "Jatuh Tempo" }, { label: "Sisa Hari", align: "center" }, { label: "Status Piutang", align: "center" }
        ],
        rows,
        [
            { label: "Jumlah Tagihan", value: fmtNum(s.summary?.totalTransaksi) },
            { label: "Total Piutang", value: fmtRupiah(s.summary?.totalPiutang) },
            { label: "Belum Jatuh Tempo", value: fmtRupiah(s.summary?.totalBelumJatuhTempo) },
            { label: "Total Overdue", value: fmtRupiah(s.summary?.totalOverdue) }
        ],
        [
            { index: 3, type: "rupiah" }
        ]
    );
    printToWindow(html, "mencetak Laporan Piutang", false);
}

// ═══════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════

function getStyles() {
    return `
.laporan-page { padding: 1.5rem; max-width: 1280px; margin: 0 auto; }
.lpr-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem; }
.lpr-header h1 { margin:0; font-size:1.5rem; font-weight:700; color:var(--smart-text-primary,#1a1a2e); }
.lpr-header-sub { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }

.lpr-tabs { display:flex; gap:0; margin-bottom:1.25rem; border-bottom:2px solid #e5e7eb; overflow-x:auto; }
.lpr-tab { padding:0.65rem 1.15rem; cursor:pointer; border:none; background:none; font-size:0.88rem; font-weight:600; color:#6b7280; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.2s; white-space:nowrap; }
.lpr-tab:hover { color:var(--primary,#667eea); }
.lpr-tab.active { color:var(--primary,#667eea); border-bottom-color:var(--primary,#667eea); }

.lpr-content { min-height: 200px; }
.lpr-loading { text-align:center; padding:3rem; color:#9ca3af; }

.lpr-toolbar { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap; }
.lpr-toolbar-left { display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap; }
.lpr-toolbar-right { display:flex; gap:0.5rem; }
.lpr-search { position:relative; display:flex; align-items:center; }
.lpr-search-icon { position:absolute; left:0.7rem; font-size:0.85rem; opacity:0.5; pointer-events:none; }
.lpr-search input { padding:0.5rem 0.75rem 0.5rem 2.1rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.85rem; width:240px; max-width:60vw; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); transition:border 0.15s, box-shadow 0.15s; }
.lpr-search input:focus { border-color:var(--primary,#667eea); box-shadow:0 0 0 3px rgba(102,126,234,0.15); }
.lpr-date-range { display:flex; align-items:center; gap:0.4rem; }
.lpr-date-range input { padding:0.45rem 0.6rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.82rem; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.lpr-date-range input:focus { border-color:var(--primary,#667eea); }
.lpr-date-range span { font-size:0.8rem; color:#9ca3af; }
.lpr-btn { padding:0.5rem 1rem; border-radius:6px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; font-size:0.85rem; font-weight:600; transition:all 0.15s; }
.lpr-btn-print { background:linear-gradient(135deg, var(--primary,#667eea), var(--accent,#764ba2)); color:#fff; border:none; }
.lpr-btn-print:hover { opacity:0.9; }

.lpr-summary-grid { display:grid; grid-template-columns:repeat(6, 1fr); gap:0.7rem; margin-bottom:1.25rem; }
.lpr-summary-card { background:rgba(255,255,255,0.58); border:2px solid rgb(255,255,255); border-radius:28px; padding:0.85rem 1rem; box-shadow:0 8px 16px rgba(0,0,0,0.08); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.lpr-summary-icon { font-size:1.2rem; margin-bottom:0.3rem; }
.lpr-summary-value { font-size:1.25rem; font-weight:700; color:#111827; word-break:break-all; }
.lpr-summary-label { font-size:0.72rem; color:#6b7280; margin-top:0.15rem; }
.lpr-value-success { color:var(--primary,#667eea); }
.lpr-value-danger { color:#dc2626; }
.lpr-value-warning { color:#d97706; }
.lpr-value-primary { color:#4f46e5; }

.lpr-sort-row { display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem; }
.lpr-sort-label { font-size:0.8rem; color:#6b7280; }
.lpr-sort-select { padding:0.4rem 0.6rem; border:1px solid #d1d5db; border-radius:6px; font-size:0.82rem; outline:none; background:#fff; }

.lpr-table-wrap { background:rgba(255,255,255,0.58); border:2px solid rgb(255,255,255); border-radius:28px; overflow-x:auto; box-shadow:0 8px 16px rgba(0,0,0,0.08); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); padding:14px; }
.lpr-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
.lpr-table th { padding:0.6rem 0.75rem; background:transparent !important; font-size:0.74rem; font-weight:700; color:#64748b; text-transform:uppercase; text-align:left; border-bottom:2px solid rgba(148,163,184,0.28); white-space:nowrap; letter-spacing:0.3px; }
.lpr-table td { padding:0.55rem 0.75rem; border-bottom:1px solid rgba(148,163,184,0.28); background:transparent !important; }
.lpr-table tbody tr:nth-child(even) td { background:rgba(255,255,255,0.2) !important; }
.lpr-table tbody tr:hover td { background:rgba(255,255,255,0.4) !important; }
.lpr-table .lpr-empty { text-align:center; color:#9ca3af; padding:2rem; font-size:0.88rem; }

.lpr-value-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.lpr-section { background:rgba(255,255,255,0.58); border:2px solid rgb(255,255,255); border-radius:28px; padding:1rem; box-shadow:0 8px 16px rgba(0,0,0,0.08); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.lpr-section-title { font-size:0.88rem; font-weight:700; color:#374151; margin-bottom:0.7rem; }

.lpr-status-badge, .lpr-mut-badge, .lpr-stok-badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600; white-space:nowrap; }
.lpr-status-draft { background:#f3f4f6; color:#6b7280; }
.lpr-status-confirmed { background:#fef3c7; color:#92400e; }
.lpr-status-received { background:#d1fae5; color:#065f46; }
.lpr-status-paid { background:#c7d2fe; color:#3730a3; }
.lpr-status-cancelled { background:#fee2e2; color:#991b1b; }
.lpr-mut-in { background:#d1fae5; color:#065f46; }
.lpr-mut-out { background:#fee2e2; color:#991b1b; }
.lpr-mut-move { background:#e0e7ff; color:#3730a3; }
.lpr-mut-adj { background:#fef3c7; color:#92400e; }
.lpr-stok-aman { background:#d1fae5; color:#065f46; }
.lpr-stok-menipis { background:#fef3c7; color:#92400e; }
.lpr-stok-habis { background:#fee2e2; color:#991b1b; }

.lpr-pagination { display:flex; gap:0.3rem; justify-content:center; margin-top:1rem; flex-wrap:wrap; align-items:center; }
.lpr-page-btn { min-width:32px; height:32px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; cursor:pointer; font-size:0.82rem; transition:all 0.15s; }
.lpr-page-btn:hover { border-color:var(--primary,#667eea); color:var(--primary,#667eea); }
.lpr-page-btn.active { background:var(--primary,#667eea); color:#fff; border-color:var(--primary,#667eea); }
.lpr-page-info { font-size:0.78rem; color:#9ca3af; margin-left:0.5rem; }

/* ── View Toggle (Laba-Rugi Detail/Rekap) ── */
.lpr-view-toggle { display:flex; gap:0.25rem; background:#f1f5f9; border-radius:8px; padding:0.2rem; }
.lpr-view-btn { padding:0.38rem 0.85rem; border:none; border-radius:6px; background:transparent; cursor:pointer; font-size:0.82rem; font-weight:600; color:#64748b; transition:all 0.15s; }
.lpr-view-btn:hover { color:var(--primary,#667eea); }
.lpr-view-btn.active { background:rgba(255,255,255,0.58); color:var(--primary,#667eea); box-shadow:0 8px 16px rgba(0,0,0,0.08); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }

/* ── Term (Piutang) ── */
.lpr-term { display:flex; align-items:center; gap:0.35rem; }
.lpr-term-label { font-size:0.8rem; color:#6b7280; font-weight:600; }
.lpr-term input { width:64px; padding:0.45rem 0.55rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.82rem; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.lpr-term input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.lpr-term-unit { font-size:0.78rem; color:#9ca3af; }

/* ── Laba-Rugi cell ── */
.lpr-laba-cell { font-weight:700; color:var(--primary,#667eea); }
.lpr-laba-cell.neg { color:#dc2626; }

/* ── Piutang badge ── */
.lpr-piutang-badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:9999px; font-size:0.7rem; font-weight:600; white-space:nowrap; }
.lpr-piutang-ok { background:#d1fae5; color:#065f46; }
.lpr-piutang-today { background:#fef3c7; color:#92400e; }
.lpr-piutang-overdue { background:#fee2e2; color:#991b1b; }

@media (max-width: 1024px) {
    .lpr-summary-grid { grid-template-columns:repeat(3, 1fr); }
    .lpr-value-grid { grid-template-columns:1fr; }
}
@media (max-width: 768px) {
    .laporan-page { padding:0.75rem; }
    .lpr-summary-grid { grid-template-columns:repeat(2, 1fr); }
    .lpr-summary-value { font-size:1rem; }
    .lpr-toolbar { flex-direction:column; align-items:stretch; }
    .lpr-toolbar-left, .lpr-toolbar-right { justify-content:flex-start; }
    .lpr-date-range { width:100%; }
    .lpr-date-range input { flex:1; }
    .lpr-tab { padding:0.5rem 0.8rem; font-size:0.8rem; }
}
@media (max-width: 480px) {
    .lpr-summary-grid { grid-template-columns:1fr 1fr; gap:0.5rem; }
    .lpr-summary-card { padding:0.65rem; }
    .lpr-summary-value { font-size:0.9rem; }
}
`;
}

return { LaporanPage, initLaporanPage, setActiveTab };
}
