/**
 * SMART Console — Activity Log Page.
 *
 * SP-027 M1: halaman baru. SP-027 PRE-M5 round 3: data NYATA dari server
 * (GET /api/audit → security_auditlogs, M3) + auto-refresh 30s.
 * Menampilkan Time, User, Activity, Target, Result + Search + Pagination.
 *
 * @module console/pages/activity
 */

import { Table, showToast } from "@smart/ui";
import { listActivities, formatActivityTime } from "../../services/activity.js";
import { pageHeader, loadingHTML, esc, mountPagination } from "../_shared.js";

let currentFilter = { page: 1, limit: 10, search: "" };
let autoRefreshTimer = null;

/**
 * Render & init halaman Activity Log.
 * @param {HTMLElement} container
 */
export async function renderActivity(container) {
    currentFilter = { page: 1, limit: 10, search: "" };

    // Auto-refresh 30s (jangan menumpuk timer saat halaman di-render ulang)
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        // Halaman sudah di-unmount (navigasi) → renderTable jadi no-op aman
        if (container.querySelector("#cn-act-table")) {
            renderTable(container);
        }
    }, 30000);

    container.innerHTML = `
        ${pageHeader("Activity Log", "Catatan aktivitas super admin di platform (audit log server)")}
        <div class="cn-card">
            <div class="cn-card-header">
                <span class="cn-card-title">Riwayat Aktivitas</span>
                <button class="smart-btn smart-btn-secondary" id="cn-act-refresh">↻ Refresh</button>
            </div>
            <div class="cn-card-body">
                <div class="cn-toolbar">
                    <input class="smart-input" id="cn-act-search" placeholder="Cari user / aktivitas / target..." />
                    <span class="cn-muted cn-act-updated" id="cn-act-updated"></span>
                </div>
                <div id="cn-act-table"></div>
            </div>
            <div class="cn-pagination-row" id="cn-act-pagination"></div>
        </div>
    `;

    const search = container.querySelector("#cn-act-search");
    const refresh = container.querySelector("#cn-act-refresh");
    let searchTimer = null;
    search.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            currentFilter.search = search.value.trim();
            currentFilter.page = 1;
            await renderTable(container);
        }, 250);
    });
    refresh.addEventListener("click", async () => {
        try {
            await renderTable(container);
            showToast("success", "Activity log diperbarui");
        } catch (err) {
            showToast("danger", err.message || "Gagal memuat activity log");
        }
    });

    await renderTable(container);
}

async function renderTable(container) {
    const wrap = container.querySelector("#cn-act-table");
    if (!wrap) return;

    wrap.innerHTML = loadingHTML();
    let data;
    let pagination;
    try {
        ({ data, pagination } = await listActivities(currentFilter));
    } catch (err) {
        // API down → tampilkan state error, jangan biarkan spinner hang
        wrap.innerHTML = `<div class="cn-empty">Gagal memuat activity log: ${esc(err.message || "server tidak tersedia")}</div>`;
        return;
    }

    const columns = [
        {
            key: "time",
            label: "Waktu",
            render: (v) => `<span class="cn-mono">${esc(formatActivityTime(v))}</span>`
        },
        {
            key: "user",
            label: "User",
            render: (v) => `<span class="smart-badge smart-badge-secondary">${esc(v)}</span>`
        },
        { key: "activity", label: "Activity" },
        { key: "target", label: "Target" },
        {
            key: "result",
            label: "Result",
            render: (v) => v === "success"
                ? `<span class="smart-badge smart-badge-success">Success</span>`
                : `<span class="smart-badge smart-badge-danger">Failed</span>`
        }
    ];

    const tableEl = Table({ columns, rows: data, emptyMessage: "Tidak ada aktivitas ditemukan" });
    wrap.innerHTML = "";
    wrap.appendChild(tableEl);

    // Indikator terakhir diperbarui
    const updatedEl = container.querySelector("#cn-act-updated");
    if (updatedEl) {
        updatedEl.textContent = `Terakhir diperbarui: ${new Date().toLocaleTimeString("id-ID")}`;
    }

    const pageRow = container.querySelector("#cn-act-pagination");
    mountPagination(pageRow, pagination, (p) => {
        currentFilter.page = p;
        renderTable(container);
    }, "aktivitas");
}
