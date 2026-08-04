/**
 * SMART Console — Activity Log Page.
 *
 * SP-027 M1: halaman baru (masih mock). Menampilkan Time, User, Activity,
 * Target, Result + Search + Pagination.
 *
 * @module console/pages/activity
 */

import { Table } from "@smart/ui";
import { listActivities, formatActivityTime } from "../../services/activity.js";
import { pageHeader, loadingHTML, esc, mountPagination } from "../_shared.js";

let currentFilter = { page: 1, limit: 10, search: "" };

/**
 * Render & init halaman Activity Log.
 * @param {HTMLElement} container
 */
export async function renderActivity(container) {
    currentFilter = { page: 1, limit: 10, search: "" };
    container.innerHTML = `
        ${pageHeader("Activity Log", "Catatan aktivitas super admin di platform (mock)")}
        <div class="cn-card">
            <div class="cn-card-header">
                <span class="cn-card-title">Riwayat Aktivitas</span>
            </div>
            <div class="cn-card-body">
                <div class="cn-toolbar">
                    <input class="smart-input" id="cn-act-search" placeholder="Cari user / aktivitas / target..." />
                </div>
                <div id="cn-act-table"></div>
            </div>
            <div class="cn-pagination-row" id="cn-act-pagination"></div>
        </div>
    `;

    const search = container.querySelector("#cn-act-search");
    let searchTimer = null;
    search.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            currentFilter.search = search.value.trim();
            currentFilter.page = 1;
            await renderTable(container);
        }, 250);
    });

    await renderTable(container);
}

async function renderTable(container) {
    const wrap = container.querySelector("#cn-act-table");
    if (!wrap) return;

    wrap.innerHTML = loadingHTML();
    const { data, pagination } = await listActivities(currentFilter);

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

    const pageRow = container.querySelector("#cn-act-pagination");
    mountPagination(pageRow, pagination, (p) => {
        currentFilter.page = p;
        renderTable(container);
    }, "aktivitas");
}
