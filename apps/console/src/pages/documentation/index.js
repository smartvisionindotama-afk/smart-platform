/**
 * SMART Console — Documentation Page.
 *
 * SP-027 M1: halaman baru (placeholder). Berisi kartu:
 * Platform Architecture, SP Documents, Developer Guide, Deployment Guide.
 *
 * @module console/pages/documentation
 */

import { pageHeader } from "../_shared.js";

const DOCS = [
    {
        icon: "🏛️",
        title: "Platform Architecture",
        desc: "Arsitektur SMART Platform — monorepo, package separation (SP-026), dan layer independence.",
        tag: "Placeholder"
    },
    {
        icon: "📄",
        title: "SP Documents",
        desc: "Kumpulan dokumen spesifikasi platform (SP-000 s.d. SP-027) dan ADR.",
        tag: "Placeholder"
    },
    {
        icon: "🧑‍💻",
        title: "Developer Guide",
        desc: "Panduan pengembangan: struktur project, konvensi kode, dan alur kontribusi.",
        tag: "Placeholder"
    },
    {
        icon: "🚀",
        title: "Deployment Guide",
        desc: "Panduan deployment: nginx, PM2, env config, dan strategi rilis.",
        tag: "Placeholder"
    }
];

/**
 * Render & init halaman Documentation.
 * @param {HTMLElement} container
 */
export async function renderDocumentation(container) {
    container.innerHTML = `
        ${pageHeader("Documentation", "Dokumentasi platform SMART (placeholder)")}
        <div class="cn-doc-grid">
            ${DOCS.map(doc => `
                <div class="cn-doc-card">
                    <span class="cn-doc-icon">${doc.icon}</span>
                    <span class="cn-doc-title">${doc.title}</span>
                    <span class="cn-doc-desc">${doc.desc}</span>
                    <span class="cn-doc-tag">${doc.tag}</span>
                </div>
            `).join("")}
        </div>
    `;
}
