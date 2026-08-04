/**
 * SMART Console — Shared Page Helpers.
 *
 * Helper kecil yang dipakai lintas halaman untuk menghindari duplikasi
 * markup/format (SP-027 M1: "Tidak boleh ada duplicate component").
 *
 * @module console/pages/_shared
 */

import { Pagination } from "@smart/ui";

/**
 * Render header halaman.
 * @param {string} title
 * @param {string} [subtitle]
 * @returns {string} HTML
 */
export function pageHeader(title, subtitle = "") {
    return `
        <div class="cn-page-header">
            <h1 class="cn-page-title">${title}</h1>
            ${subtitle ? `<p class="cn-page-subtitle">${subtitle}</p>` : ""}
        </div>
    `;
}

/**
 * Render indikator loading.
 * @returns {string} HTML
 */
export function loadingHTML() {
    return `<div class="cn-loading"><span class="cn-spinner"></span> Memuat...</div>`;
}

/**
 * Render badge status aktif/nonaktif.
 * @param {boolean} active
 * @param {string} [activeText]
 * @param {string} [inactiveText]
 * @returns {string} HTML span (dipakai di dalam sel tabel)
 */
export function statusBadge(active, activeText = "Aktif", inactiveText = "Nonaktif") {
    const cls = active ? "smart-badge smart-badge-success" : "smart-badge smart-badge-danger";
    return `<span class="${cls}">${active ? activeText : inactiveText}</span>`;
}

/**
 * Format timestamp ke string lokal.
 * @param {number|string|Date} ts
 * @returns {string}
 */
export function formatDateTime(ts) {
    if (!ts) return "—";
    try {
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch {
        return "—";
    }
}

/**
 * Escape string untuk aman dimasukkan ke innerHTML.
 * @param {*} value
 * @returns {string}
 */
export function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Render baris pagination + info ke dalam elemen container.
 * (Dipakai bersama lintas halaman — hindari duplikasi markup.)
 * @param {HTMLElement} row Elemen container pagination
 * @param {object} pagination { page, total, limit }
 * @param {Function} onChange Callback saat halaman berubah
 * @param {string} [infoSuffix] Sufiks info (mis. "perusahaan", "aktivitas")
 */
export function mountPagination(row, pagination, onChange, infoSuffix = "item") {
    if (!row) return;
    row.innerHTML = "";

    const { page, total, limit } = pagination;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
    const current = Math.min(page, totalPages);
    const start = total === 0 ? 0 : (current - 1) * limit + 1;
    const end = Math.min(current * limit, total);

    row.appendChild(Pagination({ current, total, pageSize: limit, onChange }));

    const info = document.createElement("span");
    info.className = "cn-pagination-info";
    info.textContent = total === 0
        ? `0 ${infoSuffix}`
        : `${start}–${end} dari ${total} ${infoSuffix}`;
    row.prepend(info);
}
