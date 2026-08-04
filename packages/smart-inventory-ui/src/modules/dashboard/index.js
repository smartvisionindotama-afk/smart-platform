/**
 * Dashboard — Inventory Dashboard Module (Framework).
 *
 * Reusable dashboard dengan stat cards dan activity log.
 * Menerima semua data services via Dependency Injection.
 *
 * @module @smart/inventory-ui/modules/dashboard
 */

import { Auth } from "@smart/core";

/**
 * Dashboard Module.
 *
 * @param {object} options
 * @param {Function} options.listBarang     Async (params) => { data, pagination }
 * @param {Function} options.listSupplier   Async (params) => { data, pagination }
 * @param {Function} options.listPembelian  Async (params) => { data, pagination }
 * @param {Function} options.listPenjualan  Async (params) => { data, pagination }
 * @param {Function} options.listActivity   Async (params) => { data, pagination }
 * @param {string} [options.appName]        Nama aplikasi (default: "SMART Inventory")
 * @param {string} [options.appVersion]     Versi aplikasi (default: "v1.0")
 * @param {string} [options.userName]       Nama user (default: dari Auth.user())
 * @param {number} [options.stokMenipisThreshold] Batas stok menipis (default: 5)
 * @returns {{ render: function, init: function }}
 */
export function DashboardModule({
    listBarang,
    listSupplier,
    listPembelian,
    listPenjualan,
    listActivity,
    appName = "SMART Inventory",
    appVersion = "v1.0",
    userName,
    stokMenipisThreshold = 5
} = {}) {
    /** @returns {string} HTML */
    function render() {
        const displayName = userName || (Auth.user() ? Auth.user().name : "User");
        return `
        <div id="dashboard-page" class="dashboard-page">
            <style>${getStyles()}</style>

            <div class="page-header">
                <h1>Dashboard</h1>
                <p>Overview inventory dan aktivitas terbaru</p>
            </div>

            <div class="welcome-card">
                <div>
                    <h2 id="dash-welcome">Selamat datang, ${esc(displayName)}</h2>
                    <p>${esc(appName)} ${esc(appVersion)} — Sistem inventory terintegrasi</p>
                </div>
                <div class="welcome-emoji">📦</div>
            </div>

            <div class="stats-grid" id="dash-stats">
                <div class="stat-card">
                    <div class="stat-icon">📦</div>
                    <div class="stat-info">
                        <h3 id="stat-barang">-</h3>
                        <p>Total Barang</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🚚</div>
                    <div class="stat-info">
                        <h3 id="stat-supplier">-</h3>
                        <p>Supplier</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🛒</div>
                    <div class="stat-info">
                        <h3 id="stat-pembelian">-</h3>
                        <p>Pembelian</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:#fefce8">💰</div>
                    <div class="stat-info">
                        <h3 id="stat-penjualan">-</h3>
                        <p>Penjualan</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:#fef2f2">⚠️</div>
                    <div class="stat-info">
                        <h3 id="stat-stok-min">-</h3>
                        <p>Stok Menipis</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:#fee2e2">🚫</div>
                    <div class="stat-info">
                        <h3 id="stat-stok-habis">-</h3>
                        <p>Stok Habis</p>
                    </div>
                </div>
            </div>

            <div class="recent-section">
                <h3>📋 Aktivitas Terbaru</h3>
                <div class="empty-activity">
                    Belum ada aktivitas tercatat. Mulai dengan menambahkan barang atau transaksi baru.
                </div>
            </div>
        </div>`;
    }

    /** Initialize after mount */
    async function init() {
        // Set welcome message
        try {
            const user = Auth.user();
            const welcomeEl = document.getElementById("dash-welcome");
            if (welcomeEl && user) {
                welcomeEl.textContent = `Selamat datang, ${user.name}`;
            }
        } catch { /* ignore */ }

        // Load barang stats
        if (typeof listBarang === "function") {
            try {
                const result = await listBarang({ page: 1, limit: 999 });
                const totalBarang = result.pagination.total;
                const elBarang = document.getElementById("stat-barang");
                if (elBarang) elBarang.textContent = totalBarang;

                const stokMenipis = result.data.filter(item => {
                    const s = Number(item.stok);
                    return s > 0 && s < stokMenipisThreshold;
                }).length;
                const stokHabis = result.data.filter(item => Number(item.stok) === 0).length;

                const elStokMin = document.getElementById("stat-stok-min");
                if (elStokMin) elStokMin.textContent = stokMenipis;
                const elStokHabis = document.getElementById("stat-stok-habis");
                if (elStokHabis) elStokHabis.textContent = stokHabis;
            } catch (err) {
                console.warn("[Dashboard] Failed to load barang stats:", err);
            }
        }

        // Load supplier count
        if (typeof listSupplier === "function") {
            try {
                const supResult = await listSupplier({ page: 1, limit: 1 });
                const elSupplier = document.getElementById("stat-supplier");
                if (elSupplier) elSupplier.textContent = supResult.pagination.total;
            } catch { /* ignore */ }
        }

        // Load pembelian count
        if (typeof listPembelian === "function") {
            try {
                const beliResult = await listPembelian({ page: 1, limit: 1 });
                const elBeli = document.getElementById("stat-pembelian");
                if (elBeli) elBeli.textContent = beliResult.pagination.total;
            } catch { /* ignore */ }
        }

        // Load penjualan count
        if (typeof listPenjualan === "function") {
            try {
                const jualResult = await listPenjualan({ page: 1, limit: 1 });
                const elJual = document.getElementById("stat-penjualan");
                if (elJual) elJual.textContent = jualResult.pagination.total;
            } catch { /* ignore */ }
        }

        // Load activity logs
        if (typeof listActivity === "function") {
            await loadActivityLogs();
        }
    }

    /**
     * Load and render activity logs.
     */
    async function loadActivityLogs() {
        const container = document.querySelector(".recent-section");
        if (!container) return;

        try {
            const result = await listActivity({ page: 1, limit: 5 });

            if (!result.data || result.data.length === 0) {
                return; // Keep empty state
            }

            const emptyEl = container.querySelector(".empty-activity");
            if (emptyEl) emptyEl.remove();

            let activityList = container.querySelector(".activity-list");
            if (!activityList) {
                activityList = document.createElement("div");
                activityList.className = "activity-list";
                container.appendChild(activityList);
            }

            activityList.innerHTML = result.data.map(item => {
                const icon = item.action === "create" ? "➕" : item.action === "update" ? "✏️" : "🗑️";
                const actionLabel = item.action === "create" ? "Tambah" : item.action === "update" ? "Edit" : "Hapus";
                const timeAgo = formatTimeAgo(item.createdAt);

                return `
                    <div class="activity-item">
                        <div class="activity-icon ${item.action}">${icon}</div>
                        <div class="activity-content">
                            <div class="activity-text">
                                <span class="activity-action ${item.action}">${actionLabel}</span>
                                <strong>${esc(item.resourceName || "")}</strong>
                                ${item.resourceCode ? `<span style="color:#6b7280;font-size:0.82rem">(${esc(item.resourceCode)})</span>` : ""}
                            </div>
                            <div class="activity-meta">
                                oleh <strong>${esc(item.userName || "System")}</strong> · ${timeAgo}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        } catch (err) {
            console.warn("[Dashboard] Failed to load activity:", err);
        }
    }

    return { render, init };
}

/**
 * Format a timestamp as a relative time string (Indonesian).
 * @param {string} dateString
 * @returns {string}
 */
function formatTimeAgo(dateString) {
    if (!dateString) return "";
    const now = Date.now();
    const date = new Date(dateString).getTime();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return dateString ? new Date(dateString).toLocaleDateString("id-ID") : "";
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getStyles() {
    return `
.dashboard-page {
    padding: 1.5rem;
}
.dashboard-page .page-header {
    margin-bottom: 1.5rem;
}
.dashboard-page .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--smart-text-primary, #1e293b);
}
.dashboard-page .page-header p {
    margin: 4px 0 0;
    color: var(--smart-text-secondary, #64748b);
    font-size: 0.9rem;
}
.dashboard-page .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}
.dashboard-page .stat-card {
    background: var(--smart-card-bg, #fff);
    border-radius: 10px;
    padding: 0.85rem 0.75rem;
    box-shadow: 2px 4px 12px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: transform 0.15s, box-shadow 0.15s;
}
.dashboard-page .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.dashboard-page .stat-icon {
    font-size: 2rem;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eef2ff;
    border-radius: 12px;
    flex-shrink: 0;
}
.dashboard-page .stat-info h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--smart-text-primary, #1e293b);
}
.dashboard-page .stat-info p {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: var(--smart-text-secondary, #64748b);
}
.dashboard-page .welcome-card {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    border-radius: 12px;
    padding: 1.5rem 0.75rem;
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}
.dashboard-page .welcome-card h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
}
.dashboard-page .welcome-card p {
    margin: 4px 0 0;
    opacity: 0.9;
    font-size: 0.9rem;
}
.dashboard-page .welcome-card .welcome-emoji {
    font-size: 3rem;
    opacity: 0.3;
}
.dashboard-page .recent-section {
    background: var(--smart-card-bg, #fff);
    border-radius: 12px;
    padding: 0.85rem 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.dashboard-page .recent-section h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--smart-text-primary, #1e293b);
}
.dashboard-page .recent-section .empty-activity {
    color: var(--smart-text-secondary, #94a3b8);
    font-size: 0.85rem;
    text-align: center;
    padding: 2rem 0;
}
.dashboard-page .activity-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.dashboard-page .activity-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
}
.dashboard-page .activity-item:last-child {
    border-bottom: none;
}
.dashboard-page .activity-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
}
.dashboard-page .activity-icon.create { background: #ecfdf5; }
.dashboard-page .activity-icon.update { background: #eff6ff; }
.dashboard-page .activity-icon.delete { background: #fef2f2; }
.dashboard-page .activity-content {
    flex: 1;
    min-width: 0;
}
.dashboard-page .activity-text {
    font-size: 0.88rem;
    color: var(--smart-text-primary, #1e293b);
    line-height: 1.4;
}
.dashboard-page .activity-text strong {
    font-weight: 600;
}
.dashboard-page .activity-meta {
    font-size: 0.75rem;
    color: var(--smart-text-secondary, #94a3b8);
    margin-top: 2px;
}
.dashboard-page .activity-meta .activity-action {
    display: inline-block;
    padding: 0 0.35rem;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;
    margin-right: 0.35rem;
}
.dashboard-page .activity-action.create { background: #d1fae5; color: #065f46; }
.dashboard-page .activity-action.update { background: #dbeafe; color: #1e40af; }
.dashboard-page .activity-action.delete { background: #fee2e2; color: #991b1b; }
@media (max-width: 768px) {
    .dashboard-page { padding: 0.75rem 0.25rem; }
    .dashboard-page .stats-grid { grid-template-columns: 1fr 1fr; }
    .dashboard-page .stat-icon { width: 40px; height: 40px; font-size: 1.5rem; }
    .dashboard-page .stat-info h3 { font-size: 1.2rem; }
    .dashboard-page .welcome-card { padding: 1rem 0.75rem; flex-direction: column; text-align: center; }
    .dashboard-page .welcome-card .welcome-emoji { display: none; }
}
@media (max-width: 480px) {
    .dashboard-page .stats-grid { grid-template-columns: 1fr 1fr; }
    .dashboard-page .stat-icon { width: 36px; height: 36px; font-size: 1.3rem; }
    .dashboard-page .stat-info h3 { font-size: 1.1rem; }
    .dashboard-page .stat-card { padding: 0.6rem 0.5rem; gap: 0.5rem; }
}
`;
}
