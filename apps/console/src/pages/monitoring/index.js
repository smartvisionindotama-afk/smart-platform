/**
 * SMART Console — Monitoring Center Page (SP-027 M4).
 *
 * Pusat monitoring platform: Platform Overview, System Health, Application
 * Health, API Health, Database, Process, dan Monitoring History.
 *
 * - Auto refresh configurable (default 30s), pause saat tab tidak terlihat.
 * - "Last Updated" selalu tampil.
 * - Data dari Monitoring API Console (bukan business API Inventory).
 *
 * @module console/pages/monitoring
 */

import {
    getMonitoringOverview,
    getMonitoringHistory,
    REFRESH_OPTIONS,
    getRefreshInterval,
    setRefreshInterval
} from "../../services/monitoring.js";
import { pageHeader, esc, formatDateTime } from "../_shared.js";

/** Timer auto-refresh (modul-level agar bisa dibersihkan saat navigasi). */
let _timer = null;

/** Handler visibilitychange bernama — agar bisa di-remove (cegah listener leak). */
function _onVisibility() {
    if (!document.hidden) {
        refreshDashboard(); // segarkan saat kembali ke tab
    }
}

/** Warna pill status. */
const PILL = {
    HEALTHY: "mn-pill mn-pill-healthy",
    WARNING: "mn-pill mn-pill-warning",
    DEGRADED: "mn-pill mn-pill-degraded",
    DOWN: "mn-pill mn-pill-down",
    UNKNOWN: "mn-pill mn-pill-unknown"
};

function statusPill(status) {
    const s = String(status || "UNKNOWN").toUpperCase();
    const icon = s === "HEALTHY" ? "🟢" : s === "WARNING" ? "🟡" : s === "DEGRADED" ? "🟠" : s === "DOWN" ? "🔴" : "⚪";
    return `<span class="${PILL[s] || PILL.UNKNOWN}">${icon} ${esc(s)}</span>`;
}

function statCard(label, value, sub = "") {
    return `
        <div class="mn-stat-card">
            <div class="mn-stat-label">${label}</div>
            <div class="mn-stat-value">${value}</div>
            ${sub ? `<div class="mn-stat-sub">${sub}</div>` : ""}
        </div>
    `;
}

function meterBar(label, value, pct, status, suffix = "%") {
    const s = String(status || "HEALTHY").toUpperCase();
    const cls = s === "DEGRADED" ? "mn-meter-degraded" : s === "WARNING" ? "mn-meter-warning" : "mn-meter-healthy";
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    return `
        <div class="mn-meter">
            <div class="mn-meter-head">
                <span class="mn-meter-label">${label}</span>
                <span class="mn-meter-value">${esc(value)}</span>
            </div>
            <div class="mn-meter-track"><div class="mn-meter-fill ${cls}" style="width:${clamped}%"></div></div>
        </div>
    `;
}

function fmtBytes(bytes) {
    if (bytes === null || bytes === undefined) return "—";
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
}

function fmtUptime(seconds) {
    if (!seconds) return "—";
    const s = Math.floor(seconds);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}h ${h}j ${m}m`;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m ${s % 60}s`;
}

/** Render statistik ringkasan platform. */
function renderOverview(summary) {
    return `
        <div class="mn-stat-grid">
            ${statCard("Applications", esc(summary.totalApps ?? "—"), `${summary.monitoredApps ?? 0} dipantau`)}
            ${statCard("Healthy", esc(summary.healthy ?? 0), "", "mn-stat-green")}
            ${statCard("Warning", esc(summary.warning ?? 0), "", "mn-stat-amber")}
            ${statCard("Degraded", esc(summary.degraded ?? 0), "", "mn-stat-orange")}
            ${statCard("Down", esc(summary.down ?? 0), "", "mn-stat-red")}
            ${statCard("Unknown", esc(summary.unknown ?? 0), "", "mn-stat-gray")}
        </div>
    `;
}

/** Render kartu System Health. */
function renderSystemHealth(infra) {
    if (!infra) return `<div class="mn-empty">Data infrastruktur tidak tersedia</div>`;
    const cpu = infra.cpu || {};
    const mem = infra.memory || {};
    const disk = (infra.disk && infra.disk.disks && infra.disk.disks[0]) || {};
    return `
        <div class="mn-meters">
            ${meterBar("CPU (load1/core)", `${cpu.load1?.toFixed(2) ?? "—"} / ${cpu.cores ?? "—"} core`, (cpu.load1 ?? 0) * 100, cpu.status)}
            ${meterBar("Memory", `${fmtBytes(mem.usedBytes)} / ${fmtBytes(mem.totalBytes)}`, mem.usagePct, mem.status)}
            ${meterBar(`Disk ${esc(disk.path || "/")}`, `${fmtBytes(disk.usedBytes)} / ${fmtBytes(disk.totalBytes)}`, disk.usagePct, disk.status)}
            <div class="mn-meter">
                <div class="mn-meter-head">
                    <span class="mn-meter-label">Load Average</span>
                    <span class="mn-meter-value">${esc([cpu.load1, cpu.load5, cpu.load15].map(v => (v ?? 0).toFixed(2)).join(" / "))}</span>
                </div>
                <div class="mn-meter-track"><div class="mn-meter-fill mn-meter-healthy" style="width:${Math.min(100, (cpu.load1 ?? 0) * 50)}%"></div></div>
            </div>
            <div class="mn-meter">
                <div class="mn-meter-head">
                    <span class="mn-meter-label">Uptime Server</span>
                    <span class="mn-meter-value">${esc(fmtUptime(infra.uptime?.seconds))}</span>
                </div>
            </div>
        </div>
    `;
}

/** Render tabel aplikasi. */
function renderApplications(apps) {
    if (!Array.isArray(apps) || apps.length === 0) {
        return `<div class="mn-empty">Belum ada aplikasi yang dipantau</div>`;
    }
    return `
        <div class="cn-table-wrap">
            <table class="smart-table">
                <thead><tr>
                    <th>Aplikasi</th><th>Environment</th><th>Status</th><th>Response</th><th>Domain</th><th>Pesan</th>
                </tr></thead>
                <tbody>
                    ${apps.map(a => `
                        <tr>
                            <td><strong>${esc(a.name)}</strong> <span class="cn-mono">(${esc(a.id)})</span></td>
                            <td>${esc(a.environment)}</td>
                            <td>${statusPill(a.monitoringEnabled ? a.status : "UNKNOWN")}</td>
                            <td>${a.responseTime != null ? `${a.responseTime}ms` : "—"}</td>
                            <td class="cn-mono">${esc(a.domain || "—")}</td>
                            <td class="mn-msg">${esc(a.message || "—")}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/** Render service + database. */
function renderServices(services, database) {
    const serviceRows = Object.entries(services || {}).map(([id, s]) => `
        <tr>
            <td><strong>${esc(s.name || id)}</strong> <span class="cn-mono">(${esc(id)})</span></td>
            <td>${statusPill(s.status)}</td>
            <td>${s.responseTime != null ? `${s.responseTime}ms` : "—"}</td>
            <td class="mn-msg">${esc(s.message || "—")}</td>
        </tr>
    `).join("");

    const dbRow = database ? `
        <tr>
            <td><strong>MongoDB</strong> <span class="cn-mono">(mongodb)</span></td>
            <td>${statusPill(database.status)}</td>
            <td>${database.responseTime != null ? `${database.responseTime}ms` : "—"}</td>
            <td class="mn-msg">${esc(database.message || "—")}</td>
        </tr>
    ` : "";

    return `
        <div class="cn-table-wrap">
            <table class="smart-table">
                <thead><tr><th>Service</th><th>Status</th><th>Response</th><th>Pesan</th></tr></thead>
                <tbody>${serviceRows}${dbRow}</tbody>
            </table>
        </div>
    `;
}

/** Render proses (PM2). */
function renderProcesses(procs) {
    if (!procs || !Array.isArray(procs.processes) || procs.processes.length === 0) {
        return `<div class="mn-empty">${esc(procs?.message || "Data proses tidak tersedia (PM2 tidak terpasang?)")}</div>`;
    }
    return `
        <div class="cn-table-wrap">
            <table class="smart-table">
                <thead><tr>
                    <th>Proses</th><th>Status</th><th>PID</th><th>CPU</th><th>Memory</th><th>Uptime</th><th>Restarts</th>
                </tr></thead>
                <tbody>
                    ${procs.processes.map(p => `
                        <tr>
                            <td><strong>${esc(p.name)}</strong></td>
                            <td>${statusPill(p.status)}</td>
                            <td class="cn-mono">${esc(p.pid ?? "—")}</td>
                            <td>${p.cpu != null ? `${p.cpu}%` : "—"}</td>
                            <td>${fmtBytes(p.memory)}</td>
                            <td>${fmtUptime(p.uptimeMs ? p.uptimeMs / 1000 : 0)}</td>
                            <td>${p.restarts != null ? esc(p.restarts) : "—"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/** Render history monitoring. */
function renderHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return `<div class="mn-empty">Belum ada event monitoring tercatat</div>`;
    }
    return `
        <div class="cn-table-wrap">
            <table class="smart-table">
                <thead><tr><th>Waktu</th><th>Service</th><th>Metric</th><th>Status</th><th>Severity</th><th>Pesan</th></tr></thead>
                <tbody>
                    ${history.slice(0, 30).map(h => `
                        <tr>
                            <td class="cn-mono">${esc(formatDateTime(h.timestamp))}</td>
                            <td>${esc(h.service)}</td>
                            <td class="cn-mono">${esc(h.metric)}</td>
                            <td>${statusPill(h.status)}</td>
                            <td>${esc(h.severity)}</td>
                            <td class="mn-msg">${esc(h.message || "—")}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/** Render seluruh dashboard dari data. */
function renderDashboard(data, history, lastUpdated) {
    const container = document.getElementById("mn-dashboard");
    if (!container) return;

    container.innerHTML = `
        <div class="mn-section">
            <div class="mn-section-title">Platform Overview</div>
            ${renderOverview(data.summary || {})}
        </div>

        <div class="mn-grid-2">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">System Health</span>${statusPill(data.infrastructure?.status)}</div>
                <div class="cn-card-body">${renderSystemHealth(data.infrastructure)}</div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Platform Status</span>${statusPill(data.status)}</div>
                <div class="cn-card-body">
                    <div class="mn-status-big">${esc(data.status)}</div>
                    <p class="cn-muted cn-note" style="margin-top:8px">
                        Diperbarui <strong>${formatDateTime(lastUpdated)}</strong>
                    </p>
                </div>
            </div>
        </div>

        <div class="mn-section">
            <div class="mn-section-title">Application Health</div>
            <div class="cn-card"><div class="cn-card-body">${renderApplications(data.applications)}</div></div>
        </div>

        <div class="mn-section">
            <div class="mn-section-title">API / Service & Database Health</div>
            <div class="cn-card"><div class="cn-card-body">${renderServices(data.services, data.database)}</div></div>
        </div>

        <div class="mn-section">
            <div class="mn-section-title">Process Health <span class="cn-muted">(PM2 — kondisi aktual server)</span></div>
            <div class="cn-card"><div class="cn-card-body">${renderProcesses(data.processes)}</div></div>
        </div>

        <div class="mn-section">
            <div class="mn-section-title">Monitoring History <span class="cn-muted">(retensi 7 hari)</span></div>
            <div class="cn-card"><div class="cn-card-body">${renderHistory(history)}</div></div>
        </div>
    `;
}

/** Load data + render. */
async function refreshDashboard() {
    const statusEl = document.getElementById("mn-last-updated");
    const refreshBtn = document.getElementById("mn-refresh-btn");
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = "⏳"; }
    try {
        const [data, historyRes] = await Promise.all([
            getMonitoringOverview(),
            getMonitoringHistory(30)
        ]);
        const now = Date.now();
        renderDashboard(data, historyRes?.events || [], now);
        if (statusEl) statusEl.textContent = formatDateTime(now);
    } catch (err) {
        const container = document.getElementById("mn-dashboard");
        if (container) {
            container.innerHTML = `<div class="mn-empty mn-error">Gagal memuat monitoring: ${esc(err.message)}</div>`;
        }
        if (statusEl) statusEl.textContent = "Gagal diperbarui";
    } finally {
        if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = "🔄 Refresh"; }
    }
}

/** Mulai auto-refresh (interval configurable, pause saat tab tersembunyi). */
function startAutoRefresh() {
    stopAutoRefresh();
    const interval = getRefreshInterval() * 1000;

    _timer = setInterval(() => {
        if (document.hidden) return; // jangan polling agresif saat tab tidak terlihat
        refreshDashboard();
    }, interval);

    document.addEventListener("visibilitychange", _onVisibility);
}

/** Hentikan auto-refresh + bersihkan listener (dipanggil tiap render baru). */
function stopAutoRefresh() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
    document.removeEventListener("visibilitychange", _onVisibility);
}

/** Render & init halaman Monitoring Center. */
export async function renderMonitoring(container) {
    stopAutoRefresh();

    const current = getRefreshInterval();

    container.innerHTML = `
        ${pageHeader("Monitoring Center", "Pusat monitoring aplikasi, API, database, infrastruktur, dan proses SMART Platform")}

        <div class="mn-toolbar">
            <span class="cn-muted">Last Updated: <strong id="mn-last-updated">—</strong></span>
            <div class="mn-toolbar-right">
                <label class="cn-muted mn-refresh-label" for="mn-refresh-select">Auto refresh</label>
                <select id="mn-refresh-select" class="smart-select">
                    ${REFRESH_OPTIONS.map(s => `<option value="${s}" ${s === current ? "selected" : ""}>${s}s</option>`).join("")}
                </select>
                <button id="mn-refresh-btn" class="smart-btn smart-btn-primary" type="button">🔄 Refresh</button>
            </div>
        </div>

        <div id="mn-dashboard" class="mn-dashboard">
            <div class="cn-loading"><span class="cn-spinner"></span> Memuat monitoring...</div>
        </div>

        <style>${getMonitoringStyles()}</style>
    `;

    // Auto refresh selector — konfigurable & persisted
    document.getElementById("mn-refresh-select").addEventListener("change", (e) => {
        setRefreshInterval(parseInt(e.target.value, 10));
        startAutoRefresh();
    });

    document.getElementById("mn-refresh-btn").addEventListener("click", refreshDashboard);

    await refreshDashboard();
    startAutoRefresh();
}

function getMonitoringStyles() {
    return `
.mn-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.mn-toolbar-right { display:flex; align-items:center; gap:8px; }
.mn-refresh-label { font-size:0.82rem; }
.mn-dashboard { display:flex; flex-direction:column; gap:16px; }

.mn-section-title { font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:var(--text-secondary,#64748b); margin-bottom:10px; }

.mn-stat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
.mn-stat-card { background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; padding:14px 16px; }
.mn-stat-label { font-size:0.72rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-secondary,#64748b); }
.mn-stat-value { font-size:1.6rem; font-weight:700; color:var(--text-primary,#1e293b); margin-top:2px; }

.mn-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:900px){ .mn-grid-2{ grid-template-columns:1fr; } }

.mn-status-big { font-size:2rem; font-weight:800; letter-spacing:1px; }
.mn-status-big { color:var(--text-primary,#1e293b); }

.mn-meters { display:flex; flex-direction:column; gap:14px; }
.mn-meter-head { display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:5px; }
.mn-meter-label { font-weight:600; color:var(--text-primary,#1e293b); }
.mn-meter-value { color:var(--text-secondary,#64748b); font-variant-numeric:tabular-nums; }
.mn-meter-track { height:8px; border-radius:999px; background:var(--surface-muted,#f1f5f9); overflow:hidden; }
.mn-meter-fill { height:100%; border-radius:999px; transition:width .4s ease; }
.mn-meter-healthy { background:#16a34a; }
.mn-meter-warning { background:#f59e0b; }
.mn-meter-degraded { background:#ea580c; }

.mn-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:0.72rem; font-weight:700; }
.mn-pill-healthy { background:#dcfce7; color:#166534; }
.mn-pill-warning { background:#fef3c7; color:#92400e; }
.mn-pill-degraded { background:#ffedd5; color:#9a3412; }
.mn-pill-down { background:#fee2e2; color:#991b1b; }
.mn-pill-unknown { background:#f1f5f9; color:#475569; }

.mn-msg { font-size:0.8rem; color:var(--text-secondary,#64748b); max-width:260px; }
.mn-empty { padding:20px; text-align:center; color:var(--text-secondary,#64748b); font-size:0.85rem; }
.mn-error { color:var(--danger,#dc2626); }
`;
}
