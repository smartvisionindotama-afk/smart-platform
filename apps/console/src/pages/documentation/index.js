/**
 * SMART Console — Documentation Page.
 *
 * SP-027 PRE-M5 round 3: konten NYATA (bukan placeholder) — ringkasan
 * arsitektur, security foundation (M3), monitoring (M4), panduan developer
 * & deployment, serta indeks dokumen SP/ADR yang ada di repository.
 *
 * @module console/pages/documentation
 */

import { pageHeader, esc } from "../_shared.js";

const OVERVIEW = [
    { icon: "🏛️", title: "Platform Architecture", desc: "Monorepo dengan package separation (SP-026) dan layer independence (ADR-006)." },
    { icon: "🔐", title: "Security Foundation", desc: "SP-027 M3: JWT + bcrypt + middleware otorisasi + RBAC server-side + audit log." },
    { icon: "📡", title: "Monitoring Center", desc: "SP-027 M4: health platform terpusat di Console (apps, API, DB, infra, proses)." },
    { icon: "🧩", title: "Package Domains", desc: "smart-core/api/data/ui/security/inventory-ui — tiap package satu tanggung jawab." }
];

const KEY_DOCS = [
    { file: "docs/SP-000-MASTER-INDEX.md", title: "SP-000 — Master Index", desc: "Indeks seluruh spesifikasi platform." },
    { file: "docs/SP-001-CONSTITUTION.md", title: "SP-001 — Constitution", desc: "Konstitusi & prinsip dasar pengembangan." },
    { file: "docs/SP-002-ARCHITECTURE.md", title: "SP-002 — Architecture", desc: "Arsitektur keseluruhan SMART Platform." },
    { file: "docs/SP-005-FRAMEWORK-SDK.md", title: "SP-005 — Framework & SDK", desc: "Spesifikasi framework & SDK monorepo." },
    { file: "docs/SP-006-DEVELOPMENT-GUIDE.md", title: "SP-006 — Development Guide", desc: "Panduan pengembangan & konvensi kode." },
    { file: "docs/SP-007-SECURITY-ARCHITECTURE.md", title: "SP-007 — Security", desc: "Arsitektur keamanan platform." },
    { file: "docs/SP-009-API-ARCHITECTURE.md", title: "SP-009 — API Architecture", desc: "Kontrak & arsitektur API." },
    { file: "docs/SP-010-UI-ARCHITECTURE.md", title: "SP-010 — UI Architecture", desc: "Arsitektur UI & komponen." },
    { file: "docs/SP-012-MULTI-TENANT-ARCHITECTURE.md", title: "SP-012 — Multi-Tenant", desc: "Isolasi & scoping antar perusahaan." },
    { file: "docs/SP-020-OBSERVABILITY-ARCHITECTURE.md", title: "SP-020 — Observability", desc: "Monitoring, logging & tracing." },
    { file: "docs/SP-026-PACKAGE-DOMAIN-SEPARATION.md", title: "SP-026 — Package & Domain", desc: "Pemisahan package & domain." },
    { file: "docs/SP-027-CONSOLE-MIGRATION-REPORT.md", title: "SP-027 — Console", desc: "Fondasi & migrasi SMART Console (M0–M4)." }
];

const ADR_DOCS = [
    { file: "docs/adr/ADR-003-vanilla-javascript.md", title: "ADR-003 — Vanilla JavaScript", desc: "Tanpa framework UI berat." },
    { file: "docs/adr/ADR-005-pure-function-components.md", title: "ADR-005 — Pure Function Components", desc: "Komponen = fungsi murni." },
    { file: "docs/adr/ADR-006-layer-independence.md", title: "ADR-006 — Layer Independence", desc: "UI tidak bergantung langsung ke API." },
    { file: "docs/adr/ADR-007-monorepo-strategy.md", title: "ADR-007 — Monorepo", desc: "Strategi repository tunggal." },
    { file: "docs/adr/ADR-009-smart-identity-security.md", title: "ADR-009 — Identity & Security", desc: "Arsitektur identitas & keamanan." },
    { file: "docs/adr/ADR-011-smart-data-architecture.md", title: "ADR-011 — Data Architecture", desc: "Arsitektur data & penyimpanan." }
];

const COMMANDS = [
    { cmd: "npm test", desc: "Jalankan seluruh unit test (vitest, jsdom)." },
    { cmd: "npm run lint", desc: "ESLint seluruh repository." },
    { cmd: "npm run build:console", desc: "Build SMART Console → apps/console/dist." },
    { cmd: "npm run build:inventory", desc: "Build SMART Inventory → apps/inventory/dist." },
    { cmd: "npm run verify", desc: "Lint + test + build kedua aplikasi." }
];

/**
 * Render & init halaman Documentation.
 * @param {HTMLElement} container
 */
export async function renderDocumentation(container) {
    container.innerHTML = `
        ${pageHeader("Documentation", "Dokumentasi platform SMART — arsitektur, keamanan, monitoring & panduan")}
        <div class="cn-doc-grid">
            ${OVERVIEW.map(doc => `
                <div class="cn-doc-card">
                    <span class="cn-doc-icon">${doc.icon}</span>
                    <span class="cn-doc-title">${esc(doc.title)}</span>
                    <span class="cn-doc-desc">${esc(doc.desc)}</span>
                </div>
            `).join("")}
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">📐 Platform Architecture</span></div>
                <div class="cn-card-body">
                    <p class="cn-note">SMART Platform adalah <strong>monorepo</strong> (ADR-007) dengan pemisahan package
                    per domain (SP-026): <code>smart-core</code> (domain & auth), <code>smart-api</code> (client API),
                    <code>smart-data</code> (repository & state), <code>smart-ui</code> (komponen & modul UI),
                    <code>smart-security</code> (JWT, bcrypt, middleware), dan <code>smart-inventory-ui</code> (domain bisnis inventory).</p>
                    <ul class="cn-doc-list">
                        <li><strong>Platform Domain</strong> — <code>apps/console</code> (master.e-profit.id): Super Admin, Companies, Applications, Monitoring Center, Audit.</li>
                        <li><strong>Business Domain</strong> — <code>apps/inventory</code> (inv.e-profit.id): seluruh modul bisnis inventory.</li>
                        <li><strong>Layer independence</strong> (ADR-006) — UI memanggil service layer, bukan fetch langsung; API-first dengan fallback lokal.</li>
                        <li><strong>Separation</strong> — Console TIDAK bergantung ke Inventory (0 dependency), begitu pula sebaliknya.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">🔐 Security Foundation (SP-027 M3)</span></div>
                <div class="cn-card-body">
                    <ul class="cn-doc-list">
                        <li><strong>Password</strong> — bcrypt hash (<code>bcrypt.hash/compare</code>); tidak ada plaintext; seed dari ENV.</li>
                        <li><strong>Autentikasi</strong> — JWT <em>access token</em> (short-lived) + <em>refresh token</em> httpOnly cookie, rotasi & revoke di server.</li>
                        <li><strong>Otorisasi server-side</strong> — middleware <code>authenticate</code>, <code>authorize</code>, <code>permission</code>, <code>companyScope</code>; RBAC dari MongoDB.</li>
                        <li><strong>Proteksi API</strong> — rate limiting, CORS dari ENV, helmet security headers, validasi input.</li>
                        <li><strong>Audit log</strong> — collection <code>security_auditlogs</code>: login, logout, failed login, password change, company switch, aktivitas super admin.</li>
                        <li><strong>Secret</strong> — seluruh secret di ENV (<code>JWT_SECRET</code>, <code>JWT_REFRESH_SECRET</code>, <code>BCRYPT_ROUND</code>, <code>COOKIE_SECRET</code>).</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">📡 Monitoring Center (SP-027 M4)</span></div>
                <div class="cn-card-body">
                    <ul class="cn-doc-list">
                        <li><strong>Monitoring API</strong> di <code>apps/console/server</code> (<code>/api/monitoring/*</code>, hanya Super Admin).</li>
                        <li><strong>Health contract</strong> — <code>{ status, timestamp, service, version, responseTime }</code>; state: HEALTHY / WARNING / DEGRADED / DOWN / UNKNOWN.</li>
                        <li><strong>Cakupan</strong> — aplikasi (registry), service (console/inventory/mongodb), infrastruktur (CPU/RAM/disk/load), proses (PM2), history (TTL 7 hari).</li>
                        <li><strong>Isolasi kegagalan</strong> — inventory DOWN tidak menjatuhkan Monitoring Center.</li>
                        <li><strong>Auto refresh</strong> — 15/30/60/120 detik (configurable), pause saat tab tersembunyi.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">🧑‍💻 Developer Guide</span></div>
                <div class="cn-card-body">
                    <p class="cn-note">Struktur: <code>packages/</code> (framework) · <code>apps/</code> (aplikasi) · <code>shared/</code> (data bersama) · <code>docs/</code> (spesifikasi).</p>
                    <table class="smart-table cn-doc-table">
                        <thead><tr><th>Perintah</th><th>Kegunaan</th></tr></thead>
                        <tbody>
                            ${COMMANDS.map(c => `<tr><td class="cn-mono">${esc(c.cmd)}</td><td>${esc(c.desc)}</td></tr>`).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">🚀 Deployment Guide</span></div>
                <div class="cn-card-body">
                    <ul class="cn-doc-list">
                        <li><strong>master.e-profit.id</strong> → <code>/srv/apps/console/dist</code> · API → <code>console-api</code> (PM2, port 3002).</li>
                        <li><strong>inv.e-profit.id</strong> → <code>/srv/apps/inventory/dist</code> · API → <code>inventory-api</code> (PM2, port 3001).</li>
                        <li><strong>Nginx</strong> — proxy <code>/api</code> ke server lokal, HTTP→HTTPS 301, health <code>/api/health</code>.</li>
                        <li><strong>Env</strong> — tiap server membaca <code>apps/*/server/.env</code> (secret tidak pernah di-commit).</li>
                        <li><strong>Verifikasi</strong> — <code>curl https://master.e-profit.id/api/health</code> → <code>{"status":"ok",...}</code>.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">📚 Indeks Dokumen</span></div>
                <div class="cn-card-body">
                    <p class="cn-note">File asli tersedia di <code>docs/</code> repository. Ringkasan:</p>
                    <div class="cn-doc-grid">
                        ${KEY_DOCS.map(d => `
                            <div class="cn-doc-card">
                                <span class="cn-doc-title">${esc(d.title)}</span>
                                <span class="cn-doc-desc">${esc(d.desc)}</span>
                                <span class="cn-doc-tag">${esc(d.file)}</span>
                            </div>
                        `).join("")}
                    </div>
                    <p class="cn-note cn-stack-gap">Architecture Decision Records (ADR):</p>
                    <div class="cn-doc-grid">
                        ${ADR_DOCS.map(d => `
                            <div class="cn-doc-card">
                                <span class="cn-doc-title">${esc(d.title)}</span>
                                <span class="cn-doc-desc">${esc(d.desc)}</span>
                                <span class="cn-doc-tag">${esc(d.file)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>
        </div>
    `;
}
