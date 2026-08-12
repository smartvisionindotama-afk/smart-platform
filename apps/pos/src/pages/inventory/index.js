/**
 * Inventory Page — Stock Monitoring & Stock Opname.
 *
 * Tab 1: 📊 Stock Monitoring — Overview statistik, stok per gudang, barang kritis, pergerakan
 * Tab 2: 📋 Stock Opname — CRUD opname stok dan reconciliation
 *
 * @module inventory/pages/inventory
 */

import { Modal } from "@smart/ui";
import { showToast } from "@smart/ui";
import { esc, formatNumber as fmt, formatRupiahID as fmtRupiah, formatDate as fmtDate, formatDateTime as fmtDateTime, timeAgo } from "@smart/core";
import {
    getInventoryStats, getStockByWarehouse,
    getLowStockItems, getOutOfStockItems,
    getRecentMovements, getStockValue
} from "../../data/inventory-data.js";
import {
    listStockOpname, getStockOpname, createStockOpname,
    updateStockOpname, deleteStockOpname,
    updateStockOpnameStatus, reconcileStockOpname,
    getBarangForOpname
} from "../../data/stock-opname-data.js";
import { listWarehouse } from "../../data/index.js";

// ═══════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════

const state = {
    activeTab: "monitoring",
    stats: null,
    warehouseStock: [],
    lowStock: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    outOfStock: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    movements: [],
    stockValue: null,
    opnameList: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    opnameSearch: "",
    opnameLoading: false,
    lowStockPage: 1,
    outOfStockPage: 1,
    loading: true
};

// ═══════════════════════════════════════════════
//  Format helpers
// ═══════════════════════════════════════════════

// Framework First: fmt/fmtRupiah/fmtDate/fmtDateTime/timeAgo dari
// @smart/core (util global, bukan duplikat lokal)

// ═══════════════════════════════════════════════
//  HTML Builders
// ═══════════════════════════════════════════════

function getStyles() {
    return `
.inventory-page { padding: 1rem; max-width: 1280px; margin: 0 auto; }
.inv-tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; }
.inv-tab { padding: 0.75rem 1.5rem; cursor: pointer; border: none; background: none; font-size: 0.95rem; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.inv-tab:hover { color: #4f46e5; }
.inv-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }

/* Stats Grid */
.inv-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
.inv-stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.inv-stat-icon { font-size: 1.5rem; margin-bottom: 0.4rem; }
.inv-stat-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
.inv-stat-label { font-size: 0.78rem; color: #6b7280; margin-top: 0.2rem; }
.inv-stat-sub { font-size: 0.7rem; color: #9ca3af; margin-top: 0.15rem; }

/* Section */
.inv-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.inv-section-title { font-size: 0.9rem; font-weight: 600; color: #374151; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem; }

/* Warehouse Table */
.inv-wh-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.inv-wh-table th { text-align: left; padding: 0.5rem 0.75rem; background: #f9fafb; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
.inv-wh-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f3f4f6; }
.inv-wh-table tr:hover td { background: #f9fafb; }

/* Low stock items */
.inv-item-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; }
.inv-item-row:last-child { border-bottom: none; }
.inv-item-info { flex: 1; }
.inv-item-name { font-weight: 500; font-size: 0.85rem; color: #111827; }
.inv-item-meta { font-size: 0.75rem; color: #9ca3af; }
.inv-item-stock { text-align: right; font-weight: 600; font-size: 0.85rem; }
.inv-stock-danger { color: #dc2626; }
.inv-stock-warning { color: #d97706; }
.inv-stock-ok { color: #059669; }

/* Movement List */
.inv-mov-list { display: flex; flex-direction: column; gap: 0.4rem; }
.inv-mov-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.85rem; }
.inv-mov-item:last-child { border-bottom: none; }
.inv-mov-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; }
.inv-mov-in { background: #ecfdf5; }
.inv-mov-out { background: #fef2f2; }
.inv-mov-info { flex: 1; }
.inv-mov-ref { font-weight: 500; color: #374151; }
.inv-mov-meta { font-size: 0.75rem; color: #9ca3af; }
.inv-mov-time { font-size: 0.7rem; color: #d1d5db; white-space: nowrap; }

/* Buttons & Badges */
.inv-opname-actions { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.inv-btn { padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.15s; }
.inv-btn-primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.inv-btn-primary:hover { background: #4338ca; }
.inv-btn-success { background: #059669; color: #fff; border-color: #059669; }
.inv-btn-success:hover { background: #047857; }
.inv-btn-warning { background: #d97706; color: #fff; border-color: #d97706; }
.inv-btn-warning:hover { background: #b45309; }
.inv-btn-danger { background: #dc2626; color: #fff; border-color: #dc2626; }
.inv-btn-danger:hover { background: #b91c1c; }
.inv-btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
.status-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
.status-draft { background: #f3f4f6; color: #6b7280; }
.status-in_progress { background: #fef3c7; color: #92400e; }
.status-completed { background: #d1fae5; color: #065f46; }
.status-cancelled { background: #fee2e2; color: #991b1b; }

/* Opname Form */
.inv-form { display: grid; gap: 0.75rem; }
.inv-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.inv-form-group { display: flex; flex-direction: column; gap: 0.25rem; }
.inv-form-group label { font-size: 0.78rem; font-weight: 500; color: #374151; }
.inv-form-group input, .inv-form-group select, .inv-form-group textarea { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; outline: none; transition: border 0.15s; }
.inv-form-group input:focus, .inv-form-group select:focus, .inv-form-group textarea:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,0.1); }
.inv-form-group textarea { resize: vertical; min-height: 60px; }

/* Opname Items — Card View */
.inv-opname-cards { max-height: 400px; overflow-y: auto; display: grid; gap: 0.5rem; padding: 0.25rem 0; }
.inv-opname-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.65rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.inv-opname-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
.inv-opname-card-nomor { font-size: 0.7rem; color: #6b7280; font-weight: 600; }
.inv-opname-card-nama { font-size: 0.85rem; font-weight: 600; color: #4f46e5; }
.inv-opname-card-kode { font-size: 0.7rem; color: #2563eb; }
.inv-opname-card-body { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; }
.inv-opname-card-field { display: flex; flex-direction: column; gap: 0.15rem; }
.inv-opname-card-field label { font-size: 0.65rem; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
.inv-opname-card-field .inv-label-value { font-size: 0.85rem; font-weight: 600; color: #111827; }
.inv-opname-card-field input[type="number"] { width: 100%; padding: 0.3rem 0.4rem; border: 1px solid #d1d5db; border-radius: 5px; font-size: 0.85rem; text-align: right; box-sizing: border-box; }
.inv-opname-card-field input[type="number"]:focus { border-color: #4f46e5; outline: none; box-shadow: 0 0 0 2px rgba(79,70,229,0.1); }
.inv-opname-card-field input.inv-ket-input { width: 100%; padding: 0.3rem 0.4rem; border: 1px solid #d1d5db; border-radius: 5px; font-size: 0.75rem; box-sizing: border-box; }
.inv-opname-card-field input.inv-ket-input:focus { border-color: #4f46e5; outline: none; }
.inv-opname-card-selisih { font-size: 0.85rem; font-weight: 700; text-align: right; }
.inv-selisih-positif { color: #059669; }
.inv-selisih-negatif { color: #dc2626; }
.inv-selisih-nol { color: #9ca3af; }

/* Detail View */
.inv-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 1rem; }
.inv-detail-label { color: #6b7280; font-weight: 500; }
.inv-detail-value { color: #111827; }

/* Responsive */
@media (max-width: 768px) {
    .inv-stats-grid { grid-template-columns: repeat(2, 1fr); }
    .inv-form-row { grid-template-columns: 1fr; }
    .inv-detail-grid { grid-template-columns: 1fr; }
    .inventory-page { padding: 0.75rem; }
    .inv-stat-card .inv-stat-value { font-size: 1rem; word-break: break-all; }
    .inv-opname-cards { max-height: 300px; }
}
@media (max-width: 480px) {
    .inv-stats-grid { grid-template-columns: 1fr 1fr; }
    .inv-tab { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
    .inv-stat-card .inv-stat-value { font-size: 0.9rem; word-break: break-all; }
    .inv-opname-card-body { grid-template-columns: 1fr 1fr; }
}
`;
}

// ═══════════════════════════════════════════════
//  Tab: Stock Monitoring
// ═══════════════════════════════════════════════

function renderMonitoringTab() {
    const s = state.stats || {};
    const lowData = state.lowStock;
    const outData = state.outOfStock;
    const moves = state.movements || [];
    const whData = state.warehouseStock || [];

    return `
        <div class="inv-stats-grid">
            <div class="inv-stat-card">
                <div class="inv-stat-icon">📦</div>
                <div class="inv-stat-value">${fmt(s.totalBarang)}</div>
                <div class="inv-stat-label">Total Barang</div>
                <div class="inv-stat-sub">${fmt(s.totalGudang)} Gudang • ${fmt(s.totalKategori)} Kategori</div>
            </div>
            <div class="inv-stat-card">
                <div class="inv-stat-icon">📊</div>
                <div class="inv-stat-value">${fmt(s.totalStok)}</div>
                <div class="inv-stat-label">Total Stok</div>
                <div class="inv-stat-sub">Semua gudang</div>
            </div>
            <div class="inv-stat-card">
                <div class="inv-stat-icon">💰</div>
                <div class="inv-stat-value" style="color:#059669">${fmtRupiah(s.totalNilaiBeli)}</div>
                <div class="inv-stat-label">Nilai Inventaris (Beli)</div>
                <div class="inv-stat-sub">Harga beli × stok</div>
            </div>
            <div class="inv-stat-card">
                <div class="inv-stat-icon">💵</div>
                <div class="inv-stat-value" style="color:#4f46e5">${fmtRupiah(s.totalNilaiJual)}</div>
                <div class="inv-stat-label">Nilai Jual</div>
                <div class="inv-stat-sub">Harga jual × stok</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
            <div class="inv-section">
                <div class="inv-section-title">🟡 Barang Stok Menipis <span style="background:#fef3c7;color:#92400e;padding:0.1rem 0.4rem;border-radius:999px;font-size:0.7rem;margin-left:0.3rem">${fmt(s.lowStock)}</span></div>
                <div style="max-height:300px;overflow-y:auto">
                    ${lowData.data?.length > 0 ? lowData.data.map(item => `
                        <div class="inv-item-row">
                            <div class="inv-item-info">
                                <div class="inv-item-name">${esc(item.nama)}</div>
                                <div class="inv-item-meta">${esc(item.kode)} • ${esc(item.satuan || '-')} • ${esc(item.gudang || '-')}</div>
                            </div>
                            <div class="inv-item-stock inv-stock-warning">${fmt(item.stok)} / ${fmt(item.stok_minimum)}</div>
                        </div>
                    `).join("") : `<div style="color:#9ca3af;font-size:0.85rem;padding:1rem 0;text-align:center">${state.loading ? 'Memuat...' : 'Tidak ada barang dengan stok menipis ✅'}</div>`}
                </div>
            </div>
            <div class="inv-section">
                <div class="inv-section-title">🔴 Barang Stok Habis <span style="background:#fee2e2;color:#991b1b;padding:0.1rem 0.4rem;border-radius:999px;font-size:0.7rem;margin-left:0.3rem">${fmt(s.outOfStock)}</span></div>
                <div style="max-height:300px;overflow-y:auto">
                    ${outData.data?.length > 0 ? outData.data.map(item => `
                        <div class="inv-item-row">
                            <div class="inv-item-info">
                                <div class="inv-item-name">${esc(item.nama)}</div>
                                <div class="inv-item-meta">${esc(item.kode)} • ${esc(item.satuan || '-')} • ${esc(item.gudang || '-')}</div>
                            </div>
                            <div class="inv-item-stock inv-stock-danger">${fmt(item.stok)}</div>
                        </div>
                    `).join("") : `<div style="color:#9ca3af;font-size:0.85rem;padding:1rem 0;text-align:center">${state.loading ? 'Memuat...' : 'Tidak ada barang dengan stok habis ✅'}</div>`}
                </div>
            </div>
        </div>

        <div class="inv-section">
            <div class="inv-section-title">🏭 Stok per Gudang</div>
            ${whData.length > 0 ? `
            <table class="inv-wh-table">
                <thead><tr><th>Gudang</th><th style="text-align:right">Jumlah Item</th><th style="text-align:right">Total Stok</th></tr></thead>
                <tbody>
                    ${whData.map(w => `
                        <tr>
                            <td><strong>${esc(w.gudang)}</strong></td>
                            <td style="text-align:right">${fmt(w.totalItem)}</td>
                            <td style="text-align:right"><strong>${fmt(w.totalStok)}</strong></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            ` : `<div style="color:#9ca3af;font-size:0.85rem;padding:1rem 0;text-align:center">${state.loading ? 'Memuat...' : 'Belum ada data gudang'}</div>`}
        </div>

        <div class="inv-section">
            <div class="inv-section-title">🔄 Pergerakan Stok Terbaru</div>
            ${moves.length > 0 ? `
            <div class="inv-mov-list">
                ${moves.map(m => `
                    <div class="inv-mov-item">
                        <div class="inv-mov-icon ${m.type === 'in' ? 'inv-mov-in' : 'inv-mov-out'}">${m.icon}</div>
                        <div class="inv-mov-info">
                            <div class="inv-mov-ref">${esc(m.label)} — ${esc(m.nomor)}</div>
                            <div class="inv-mov-meta">${esc(m.ref)} • ${fmt(m.itemCount)} item • ${fmtRupiah(m.total)}</div>
                        </div>
                        <div class="inv-mov-time">${timeAgo(m.tanggal)}</div>
                    </div>
                `).join("")}
            </div>
            ` : `<div style="color:#9ca3af;font-size:0.85rem;padding:1rem 0;text-align:center">${state.loading ? 'Memuat...' : 'Belum ada pergerakan stok'}</div>`}
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Tab: Stock Opname
// ═══════════════════════════════════════════════

function renderOpnameList() {
    const list = state.opnameList;
    return `
        <div class="inv-opname-actions">
            <button class="inv-btn inv-btn-primary" id="btn-opname-baru">➕ Buat Opname Baru</button>
            <input type="text" id="opname-search" placeholder="Cari nomor/gudang/status..." value="${esc(state.opnameSearch)}" style="flex:1;max-width:300px;padding:0.5rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;outline:none">
        </div>

        ${list.data?.length > 0 ? list.data.map(item => {
            const statusClass = `status-${item.status}`;
            const statusLabels = { draft: "Draft", in_progress: "Proses", completed: "Selesai", cancelled: "Batal" };
            return `
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:0.75rem 1rem;margin-bottom:0.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
                    <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem">
                        <div style="flex:1">
                            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                                <strong style="color:#4f46e5;font-size:0.9rem">${esc(item.nomor)}</strong>
                                <span class="status-badge ${statusClass}">${statusLabels[item.status] || item.status}</span>
                            </div>
                            <div style="font-size:0.8rem;color:#6b7280;margin-top:0.25rem">
                                🏭 ${esc(item.gudangNama || item.gudang || '-')} • 📅 ${fmtDate(item.tanggal)} • 📦 ${fmt(item.totalItem)} item
                                ${item.totalSelisih > 0 ? ` • 🔄 Selisih: <strong>${fmt(item.totalSelisih)}</strong>` : ''}
                            </div>
                            <div style="font-size:0.75rem;color:#9ca3af;margin-top:0.15rem">
                                Dibuat oleh: ${esc(item.createdBy || '-')} • ${timeAgo(item.createdAt)}
                                ${item.completedAt ? ` • Selesai: ${fmtDateTime(item.completedAt)}` : ''}
                            </div>
                        </div>
                        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;flex-shrink:0">
                            <button class="inv-btn inv-btn-sm" data-opname-view="${item._id || item.id}">👁️</button>
                            ${item.status === "draft" || item.status === "in_progress" ? `
                                <button class="inv-btn inv-btn-sm" data-opname-edit="${item._id || item.id}">✏️</button>
                                <button class="inv-btn inv-btn-sm inv-btn-danger" data-opname-delete="${item._id || item.id}">🗑️</button>
                            ` : ''}
                            ${item.status === "draft" ? `
                                <button class="inv-btn inv-btn-sm inv-btn-warning" data-opname-start="${item._id || item.id}">▶️ Mulai</button>
                            ` : ''}
                            ${item.status === "in_progress" ? `
                                <button class="inv-btn inv-btn-sm inv-btn-success" data-opname-complete="${item._id || item.id}">✅ Selesai</button>
                            ` : ''}
                            ${item.status === "completed" ? `
                                <button class="inv-btn inv-btn-sm inv-btn-primary" data-opname-reconcile="${item._id || item.id}">🔄 Reconcile</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join("") : `
            <div style="text-align:center;padding:3rem 1rem;color:#9ca3af">
                <div style="font-size:3rem;margin-bottom:0.5rem">📋</div>
                <p style="font-size:0.95rem">Belum ada data stock opname</p>
                <p style="font-size:0.8rem">Klik "Buat Opname Baru" untuk memulai</p>
            </div>
        `}

        ${list.pagination && list.pagination.totalPages > 1 ? `
            <div style="display:flex;justify-content:center;margin-top:1rem">
                ${Array.from({ length: list.pagination.totalPages }, (_, i) => i + 1).map(p => `
                    <button class="inv-btn inv-btn-sm ${p === list.pagination.page ? 'inv-btn-primary' : ''}" data-opname-page="${p}" style="margin:0 0.15rem">${p}</button>
                `).join("")}
            </div>
        ` : ''}
    `;
}

function renderOpnamePage() {
    const monitoringHTML = state.activeTab === "monitoring" ? renderMonitoringTab() : "";
    const opnameHTML = state.activeTab === "opname" ? renderOpnameList() : "";

    return `
        <style>${getStyles()}</style>
        <div class="inventory-page">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
                <h2 style="margin:0;font-size:1.3rem;color:#111827">📦 Inventory</h2>
            </div>
            <div class="inv-tabs">
                <button class="inv-tab ${state.activeTab === 'monitoring' ? 'active' : ''}" data-tab="monitoring">📊 Stock Monitoring</button>
                <button class="inv-tab ${state.activeTab === 'opname' ? 'active' : ''}" data-tab="opname">📋 Stock Opname</button>
            </div>
            <div id="inv-monitoring-content">${state.activeTab === "monitoring" ? monitoringHTML : ''}</div>
            <div id="inv-opname-content">${state.activeTab === "opname" ? opnameHTML : ''}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Data Loading
// ═══════════════════════════════════════════════

async function loadMonitoringData() {
    if (state.activeTab !== "monitoring") return;
    state.loading = true;
    const contentEl = document.getElementById("inv-monitoring-content");
    if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:3rem"><div class="skeleton-pulse" style="width:200px;height:20px;margin:0 auto 1rem"></div><div class="skeleton-pulse" style="width:300px;height:14px;margin:0 auto"></div></div>';

    try {
        const [stats, whStock, low, out, moves] = await Promise.all([
            getInventoryStats(),
            getStockByWarehouse(),
            getLowStockItems({ page: 1, limit: 10 }),
            getOutOfStockItems({ page: 1, limit: 10 }),
            getRecentMovements(10)
        ]);
        state.stats = stats;
        state.warehouseStock = whStock?.data || [];
        state.lowStock = low || { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };
        state.outOfStock = out || { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };
        state.movements = moves?.data || [];
    } catch (err) {
        console.warn("[Inventory] Failed to load monitoring data:", err);
    }

    state.loading = false;
    if (state.activeTab === "monitoring") {
        const el = document.getElementById("inv-monitoring-content");
        if (el) el.innerHTML = renderMonitoringTab();
        attachMonitoringEvents();
    }
}

async function loadOpnameData(page = 1) {
    if (state.activeTab !== "opname") return;
    state.opnameLoading = true;
    const contentEl = document.getElementById("inv-opname-content");
    if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:3rem;color:#9ca3af">Memuat...</div>';

    try {
        const result = await listStockOpname({ page, limit: 10, search: state.opnameSearch });
        state.opnameList = result;
    } catch (err) {
        console.warn("[Inventory] Failed to load opname data:", err);
    }

    state.opnameLoading = false;
    if (state.activeTab === "opname") {
        const el = document.getElementById("inv-opname-content");
        if (el) el.innerHTML = renderOpnameList();
        attachOpnameEvents();
    }
}

// ═══════════════════════════════════════════════
//  Event Handlers
// ═══════════════════════════════════════════════

function attachTabEvents() {
    document.querySelectorAll(".inv-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.dataset.tab;
            if (tabName === state.activeTab) return;
            state.activeTab = tabName;
            document.querySelectorAll(".inv-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            if (tabName === "monitoring") {
                document.getElementById("inv-monitoring-content").innerHTML = renderMonitoringTab();
                document.getElementById("inv-opname-content").innerHTML = "";
                attachMonitoringEvents();
                loadMonitoringData();
            } else {
                document.getElementById("inv-opname-content").innerHTML = renderOpnameList();
                document.getElementById("inv-monitoring-content").innerHTML = "";
                attachOpnameEvents();
                loadOpnameData(1);
            }
        });
    });
}

function attachMonitoringEvents() {}

function attachOpnameEvents() {
    const searchInput = document.getElementById("opname-search");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            state.opnameSearch = e.target.value;
            clearTimeout(searchInput._debounce);
            searchInput._debounce = setTimeout(() => loadOpnameData(1), 400);
        });
    }
    document.getElementById("btn-opname-baru")?.addEventListener("click", showOpnameForm);
    document.querySelectorAll("[data-opname-view]").forEach(btn => {
        btn.addEventListener("click", () => showOpnameDetail(btn.dataset.opnameView));
    });
    document.querySelectorAll("[data-opname-edit]").forEach(btn => {
        btn.addEventListener("click", () => showOpnameForm(btn.dataset.opnameEdit));
    });
    document.querySelectorAll("[data-opname-delete]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.opnameDelete;
            if (!window.confirm("Hapus stock opname ini?")) return;
            try {
                await deleteStockOpname(id);
                showToast("success", "Stock opname berhasil dihapus");
                loadOpnameData(state.opnameList.pagination?.page || 1);
            } catch (err) { showToast("danger", `Gagal: ${err.message}`); }
        });
    });
    document.querySelectorAll("[data-opname-start]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.opnameStart;
            if (!window.confirm("Mulai proses stock opname?")) return;
            try {
                await updateStockOpnameStatus(id, "in_progress");
                showToast("success", "Stock opname dimulai");
                loadOpnameData(state.opnameList.pagination?.page || 1);
            } catch (err) { showToast("danger", `Gagal: ${err.message}`); }
        });
    });
    document.querySelectorAll("[data-opname-complete]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.opnameComplete;
            if (!window.confirm("Selesaikan stock opname? Selisih stok akan dihitung.")) return;
            try {
                await updateStockOpnameStatus(id, "completed");
                showToast("success", "Stock opname selesai");
                loadOpnameData(state.opnameList.pagination?.page || 1);
            } catch (err) { showToast("danger", `Gagal: ${err.message}`); }
        });
    });
    document.querySelectorAll("[data-opname-reconcile]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.opnameReconcile;
            if (!window.confirm("Yakin ingin reconcile? Stok sistem akan disesuaikan dengan stok fisik.")) return;
            btn.disabled = true;
            btn.textContent = "...";
            try {
                const result = await reconcileStockOpname(id);
                showToast("success", result.message || "Reconcile berhasil");
                loadOpnameData(state.opnameList.pagination?.page || 1);
                loadMonitoringData();
            } catch (err) {
                showToast("danger", `Gagal: ${err.message}`);
                btn.disabled = false;
                btn.textContent = "🔄 Reconcile";
            }
        });
    });
    document.querySelectorAll("[data-opname-page]").forEach(btn => {
        btn.addEventListener("click", () => loadOpnameData(parseInt(btn.dataset.opnamePage)));
    });
}

// ═══════════════════════════════════════════════
//  Opname Form (Create / Edit)
// ═══════════════════════════════════════════════

let _opnameItemsCache = [];
let _gudangOptions = [];

async function showOpnameForm(editId = null) {
    let existing = null;
    if (editId) {
        existing = await getStockOpname(editId);
    }

    try {
        const whResult = await listWarehouse({ page: 1, limit: 999 });
        _gudangOptions = (whResult.data || []).map(w => w.nama);
    } catch { _gudangOptions = []; }

    const title = editId ? `✏️ Edit Stock Opname — ${existing?.nomor || ''}` : "➕ Buat Stock Opname Baru";
    const gudangVal = existing?.gudang || "";
    const gudangNamaVal = existing?.gudangNama || existing?.gudang || "";
    const keteranganVal = existing?.keterangan || "";
    _opnameItemsCache = existing?.items ? JSON.parse(JSON.stringify(existing.items)) : [];

    const content = `
        <div class="inv-form">
            <div class="inv-form-row">
                <div class="inv-form-group">
                    <label>Gudang</label>
                    <select id="f-opname-gudang">
                        <option value="">-- Pilih Gudang --</option>
                        ${_gudangOptions.map(g => `<option value="${esc(g)}" ${g === gudangVal ? 'selected' : ''}>${esc(g)}</option>`).join("")}
                    </select>
                </div>
                <div class="inv-form-group">
                    <label>Nama Gudang (tampilan)</label>
                    <input type="text" id="f-opname-gudang-nama" value="${esc(gudangNamaVal)}" placeholder="Nama gudang">
                </div>
            </div>
            <div class="inv-form-group">
                <label>Keterangan</label>
                <textarea id="f-opname-ket" placeholder="Catatan opname...">${esc(keteranganVal)}</textarea>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                <button class="inv-btn" id="btn-opname-load-barang">📥 Muat Data Barang dari Gudang</button>
                <span style="font-size:0.78rem;color:#9ca3af;align-self:center">Atau tambah manual</span>
            </div>
            <div class="inv-form-group">
                <label>Item Barang <span style="font-weight:normal;color:#9ca3af;font-size:0.75rem" id="opname-item-count">(${_opnameItemsCache.length} item)</span></label>
                <div class="inv-opname-cards" id="opname-items-container">
                    ${_opnameItemsCache.length > 0 ? renderOpnameCards(_opnameItemsCache) : '<div style="color:#9ca3af;font-size:0.85rem;text-align:center;padding:1rem 0">Klik "Muat Data Barang dari Gudang" untuk memuat barang</div>'}
                </div>
            </div>
            <button class="inv-btn inv-btn-primary" id="btn-opname-save" style="width:100%;padding:0.75rem 1rem;font-size:1rem;margin-top:0.5rem">${editId ? '💾 Simpan Perubahan' : '💾 Buat Opname'}</button>
        </div>
    `;

    const overlay = Modal({ open: true, title, content, footer: "", closable: true, onClose: () => overlay?.parentNode?.removeChild(overlay) });
    document.body.appendChild(overlay);

    const gudangSelect = document.getElementById("f-opname-gudang");
    if (gudangSelect) {
        gudangSelect.addEventListener("change", () => {
            const selected = gudangSelect.value;
            const namaInput = document.getElementById("f-opname-gudang-nama");
            if (namaInput && !namaInput.value) namaInput.value = selected;
        });
    }

    document.getElementById("btn-opname-load-barang")?.addEventListener("click", async () => {
        const gudang = document.getElementById("f-opname-gudang")?.value || "";
        if (!gudang && _gudangOptions.length > 0) {
            showToast("warning", "Pilih gudang terlebih dahulu");
            return;
        }
        try {
            const result = await getBarangForOpname(gudang);
            if (result.data && result.data.length > 0) {
                _opnameItemsCache = result.data.map(b => ({
                    kode: b.kode, nama: b.nama, satuan: b.satuan || "",
                    gudang: b.gudang || gudang || "", rak: b.rak || "",
                    stokSistem: b.stok || 0, stokFisik: b.stok || 0, selisih: 0, keterangan: ""
                }));
                const container = document.getElementById("opname-items-container");
                if (container) {
                    container.innerHTML = renderOpnameCards(_opnameItemsCache);
                    attachOpnameCardEvents();
                }
                document.getElementById("opname-item-count").textContent = `(${_opnameItemsCache.length} item)`;
                showToast("success", `${result.data.length} barang dimuat`);
            } else {
                showToast("warning", "Tidak ada barang untuk gudang ini");
            }
        } catch (err) {
            showToast("danger", `Gagal memuat barang: ${err.message}`);
        }
    });

    document.getElementById("btn-opname-save")?.addEventListener("click", async function() {
        const btn = this;
        const gudang = document.getElementById("f-opname-gudang")?.value || "";
        const gudangNama = document.getElementById("f-opname-gudang-nama")?.value || gudang;
        const keterangan = document.getElementById("f-opname-ket")?.value || "";

        if (!gudang && _opnameItemsCache.length === 0) {
            showToast("warning", "Pilih gudang atau tambah item barang");
            return;
        }

        const items = collectOpnameItemsFromCards();
        if (items.length === 0 && !gudang) {
            showToast("warning", "Tidak ada item barang");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Menyimpan...";

        try {
            const data = { gudang, gudangNama, keterangan, items };
            if (editId) {
                await updateStockOpname(editId, data);
                showToast("success", "Stock opname berhasil diperbarui");
            } else {
                await createStockOpname(data);
                showToast("success", "Stock opname berhasil dibuat");
            }
            overlay?.parentNode?.removeChild(overlay);
            loadOpnameData(state.opnameList.pagination?.page || 1);
        } catch (err) {
            showToast("danger", `Gagal: ${err.message}`);
            btn.disabled = false;
            btn.textContent = editId ? "💾 Simpan Perubahan" : "💾 Buat Opname";
        }
    });

    attachOpnameCardEvents();
}

// ═══════════════════════════════════════════════
//  Opname Cards — Card View instead of Table
// ═══════════════════════════════════════════════

function renderOpnameCards(items) {
    if (!items || items.length === 0) return '<div style="color:#9ca3af;font-size:0.85rem;text-align:center;padding:1rem 0">Belum ada item</div>';

    return items.map((item, i) => `
        <div class="inv-opname-card">
            <div class="inv-opname-card-header">
                <div>
                    <span class="inv-opname-card-nama">${esc(item.nama)}</span>
                    <span class="inv-opname-card-kode" style="margin-left:0.3rem">${esc(item.kode)}</span>
                </div>
                <span class="inv-opname-card-nomor">#${i + 1}</span>
            </div>
            <div class="inv-opname-card-body">
                <div class="inv-opname-card-field">
                    <label>Stok Sistem</label>
                    <span class="inv-label-value">${fmt(item.stokSistem)} ${esc(item.satuan)}</span>
                </div>
                <div class="inv-opname-card-field">
                    <label>Stok Fisik</label>
                    <input type="number" class="opname-stok-fisik" value="${item.stokFisik}" data-index="${i}" min="0">
                </div>
                <div class="inv-opname-card-field">
                    <label>Selisih</label>
                    <span class="inv-opname-card-selisih opname-selisih" data-index="${i}">
                        <span class="${item.selisih > 0 ? 'inv-selisih-positif' : item.selisih < 0 ? 'inv-selisih-negatif' : 'inv-selisih-nol'}">${item.selisih > 0 ? '+' : ''}${fmt(item.selisih)}</span>
                    </span>
                </div>
                <div class="inv-opname-card-field" style="grid-column: 1 / -1">
                    <label>Keterangan</label>
                    <input type="text" class="inv-ket-input opname-ket" value="${esc(item.keterangan)}" data-index="${i}" placeholder="Catatan...">
                </div>
            </div>
        </div>
    `).join("");
}

function collectOpnameItemsFromCards() {
    const inputs = document.querySelectorAll(".opname-stok-fisik");
    const kets = document.querySelectorAll(".opname-ket");
    const items = [];

    inputs.forEach(input => {
        const index = parseInt(input.dataset.index);
        const item = _opnameItemsCache[index];
        if (!item) return;
        const stokFisik = parseInt(input.value) || 0;
        items.push({
            ...item,
            stokFisik,
            selisih: stokFisik - (item.stokSistem || 0),
            keterangan: document.querySelector(`.opname-ket[data-index="${index}"]`)?.value || ""
        });
    });
    return items;
}

function attachOpnameCardEvents() {
    document.querySelectorAll(".opname-stok-fisik").forEach(input => {
        input.addEventListener("input", () => {
            const index = parseInt(input.dataset.index);
            const stokSistem = _opnameItemsCache[index]?.stokSistem || 0;
            const stokFisik = parseInt(input.value) || 0;
            const selisih = stokFisik - stokSistem;
            const selisihEl = document.querySelector(`.opname-selisih[data-index="${index}"]`);
            if (selisihEl) {
                selisihEl.innerHTML = `<span class="${selisih > 0 ? 'inv-selisih-positif' : selisih < 0 ? 'inv-selisih-negatif' : 'inv-selisih-nol'}">${selisih > 0 ? '+' : ''}${fmt(selisih)}</span>`;
            }
        });
    });
}

// ═══════════════════════════════════════════════
//  Opname Detail View
// ═══════════════════════════════════════════════

async function showOpnameDetail(id) {
    const item = await getStockOpname(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }

    const statusLabels = { draft: "Draft", in_progress: "Proses", completed: "Selesai", cancelled: "Batal" };
    const statusClass = `status-${item.status}`;
    const title = `📋 Detail Stock Opname — ${item.nomor}`;
    const items = item.items || [];
    const totalSelisihPositif = items.filter(i => i.selisih > 0).reduce((sum, i) => sum + i.selisih, 0);
    const totalSelisihNegatif = items.filter(i => i.selisih < 0).reduce((sum, i) => sum + Math.abs(i.selisih), 0);
    const itemsWithSelisih = items.filter(i => i.selisih !== 0);

    const content = `
        <div class="inv-detail-grid">
            <div><span class="inv-detail-label">Nomor:</span> <span class="inv-detail-value"><strong>${esc(item.nomor)}</strong></span></div>
            <div><span class="inv-detail-label">Status:</span> <span class="status-badge ${statusClass}">${statusLabels[item.status] || item.status}</span></div>
            <div><span class="inv-detail-label">Tanggal:</span> <span class="inv-detail-value">${fmtDate(item.tanggal)}</span></div>
            <div><span class="inv-detail-label">Gudang:</span> <span class="inv-detail-value">${esc(item.gudangNama || item.gudang || '-')}</span></div>
            <div><span class="inv-detail-label">Total Item:</span> <span class="inv-detail-value">${fmt(item.totalItem)}</span></div>
            <div><span class="inv-detail-label">Total Selisih:</span> <span class="inv-detail-value">${fmt(item.totalSelisih)}</span></div>
            <div><span class="inv-detail-label">Selisih + (Lebih):</span> <span class="inv-detail-value" style="color:#059669">${fmt(totalSelisihPositif)}</span></div>
            <div><span class="inv-detail-label">Selisih − (Kurang):</span> <span class="inv-detail-value" style="color:#dc2626">${fmt(totalSelisihNegatif)}</span></div>
            <div><span class="inv-detail-label">Dibuat oleh:</span> <span class="inv-detail-value">${esc(item.createdBy || '-')}</span></div>
            <div><span class="inv-detail-label">Tanggal Buat:</span> <span class="inv-detail-value">${fmtDateTime(item.createdAt)}</span></div>
            ${item.completedAt ? `<div><span class="inv-detail-label">Selesai:</span> <span class="inv-detail-value">${fmtDateTime(item.completedAt)}</span></div>` : ''}
            ${item.completedBy ? `<div><span class="inv-detail-label">Selesai oleh:</span> <span class="inv-detail-value">${esc(item.completedBy)}</span></div>` : ''}
        </div>
        ${item.keterangan ? `<div style="font-size:0.85rem;margin-bottom:1rem"><span class="inv-detail-label">Keterangan:</span> ${esc(item.keterangan)}</div>` : ''}

        <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.5rem">Item Barang (${items.length})</div>
        <div class="inv-opname-cards" style="max-height:400px">
            ${items.map((i, idx) => `
                <div class="inv-opname-card">
                    <div class="inv-opname-card-header">
                        <div>
                            <span class="inv-opname-card-nama">${esc(i.nama)}</span>
                            <span class="inv-opname-card-kode" style="margin-left:0.3rem">${esc(i.kode)}</span>
                        </div>
                        <span class="inv-opname-card-nomor">#${idx + 1}</span>
                    </div>
                    <div class="inv-opname-card-body">
                        <div class="inv-opname-card-field">
                            <label>Stok Sistem</label>
                            <span class="inv-label-value">${fmt(i.stokSistem)}</span>
                        </div>
                        <div class="inv-opname-card-field">
                            <label>Stok Fisik</label>
                            <span class="inv-label-value">${fmt(i.stokFisik)}</span>
                        </div>
                        <div class="inv-opname-card-field">
                            <label>Selisih</label>
                            <span class="inv-opname-card-selisih ${i.selisih > 0 ? 'inv-selisih-positif' : i.selisih < 0 ? 'inv-selisih-negatif' : 'inv-selisih-nol'}">${i.selisih > 0 ? '+' : ''}${fmt(i.selisih)}</span>
                        </div>
                        ${i.keterangan ? `<div class="inv-opname-card-field" style="grid-column:1/-1"><label>Ket</label><span style="font-size:0.8rem;color:#6b7280">${esc(i.keterangan)}</span></div>` : ''}
                    </div>
                </div>
            `).join("")}
        </div>

        ${itemsWithSelisih.length > 0 ? `
            <div style="margin-top:1rem;padding:0.75rem;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:0.8rem">
                <strong>⚠️ Items dengan Selisih:</strong> ${itemsWithSelisih.length} barang
                (Lebih: ${fmt(totalSelisihPositif)}, Kurang: ${fmt(totalSelisihNegatif)})
                ${item.status === "completed" ? '<br><span style="color:#6b7280">Lakukan Reconcile untuk menyesuaikan stok sistem dengan stok fisik.</span>' : ''}
            </div>
        ` : `
            <div style="margin-top:1rem;padding:0.75rem;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;font-size:0.8rem;color:#065f46">
                ✅ Semua item cocok — tidak ada selisih
            </div>
        `}
    `;

    const overlay = Modal({ open: true, title, content, footer: "", closable: true, onClose: () => overlay?.parentNode?.removeChild(overlay) });
    document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════
//  Page Exports
// ═══════════════════════════════════════════════

export function InventoryPage() {
    return renderOpnamePage();
}

export function initInventoryPage() {
    loadMonitoringData();
    setTimeout(() => { attachTabEvents(); }, 50);
}
