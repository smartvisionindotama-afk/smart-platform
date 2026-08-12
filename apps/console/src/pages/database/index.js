/**
 * SMART Console — Database Explorer Page (SP-027 M5-FIX).
 *
 * Halaman standalone Database Explorer dengan menu sidebar sendiri.
 * Reuse modul observer `deployment/database.js` (READ-ONLY) — tidak ada
 * database access path baru; seluruh aksi memakai /api/database/* yang
 * sudah diamankan Security M3.
 *
 * @module console/pages/database
 */

import { pageHeader } from "../_shared.js";

/**
 * Render & init halaman Database Explorer.
 * @param {HTMLElement} container
 */
export async function renderDatabasePage(container) {
    container.innerHTML = `
        ${pageHeader("Database Explorer", "Observasi struktur dan isi MongoDB — read-only, server-side only")}
        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Database</span></div>
            <div class="cn-card-body" id="dbx-root"></div>
        </div>
    `;

    const { renderDatabaseExplorer } = await import("../deployment/database.js");
    await renderDatabaseExplorer(container.querySelector("#dbx-root"));
}

export default { renderDatabasePage };
