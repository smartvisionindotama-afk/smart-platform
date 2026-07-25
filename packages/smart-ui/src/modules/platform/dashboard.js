/**
 * Platform — Super Admin Dashboard (Framework Module).
 *
 * Reusable platform dashboard module for SMART Platform.
 * Menerima data services via Dependency Injection (sama seperti Settings modules).
 *
 * @module @smart/ui/modules/platform/dashboard
 */

import { Auth, platform, impersonation, audit, setCompanyContext, COMPANY_TYPES } from "@smart/core";
import { Modal, Toast, UI } from "../../index.js";

/**
 * Platform Dashboard module.
 *
 * @param {object} options
 * @param {Function} options.listCompanies      Async (params) => { data, pagination }
 * @param {Function} options.getCompany         Async (id) => object
 * @param {Function} options.getCompanyByCode   Async (code) => object
 * @param {Function} options.updateCompany      Async (id, data) => object
 * @param {Function} options.deleteCompany      Async (id) => boolean
 * @param {Function} options.createCompany      Async (data) => object
 * @param {Function} options.listSuperadmins    Async () => array
 * @param {Function} options.createSuperadmin   Async (data) => object
 * @param {Function} options.updateSuperadmin   Async (id, data) => object
 * @param {Function} options.deleteSuperadmin   Async (id) => boolean
 * @param {string} [options.logo] Optional logo URL to replace emoji in header
 * @param {Function} options.onLogout           Optional custom logout handler
 * @param {Function} [options.onAppLogoUpload]  Async (slug, dataUrl) => {} — called when app logo is uploaded
 * @param {Function} [options.onAppLogoRemove]  Async (slug) => {} — called when app logo is removed
 * @returns {{ platformDashboard: Function, initPlatformDashboard: Function }}
 */
export function PlatformDashboardModule({
    listCompanies, getCompany, getCompanyByCode, updateCompany, deleteCompany, createCompany,
    listSuperadmins, createSuperadmin, updateSuperadmin, deleteSuperadmin,
    logo,
    onLogout,
    onLogoUpload,
    onLogoRemove,
    onAppLogoUpload,
    onAppLogoRemove
} = {}) {
    const state = {
        view: "menu",
        selectedApp: null,
        selectedCompany: null,
        companies: [],
        loading: false
    };

    const saState = { users: [] };

    /**
     * Render the Platform Dashboard.
     * @returns {string} HTML
     */
    function platformDashboard() {
        return `
            <div id="platform-dashboard" class="platform-dashboard">
                <style>${getStyles()}</style>
                <div class="pd-header">
                    <div class="pd-brand">
                        <div class="pd-logo">${logo ? `<img src="${encodeURI(logo)}" alt="Logo" class="pd-logo-img" />` : '🚀'}</div>
                        <div>
                            <h1>SMART Platform</h1>
                            <p class="pd-subtitle">Super Admin Dashboard</p>
                        </div>
                    </div>
                    <div class="pd-user-info">
                        <div class="pd-user-detail" id="pd-user-detail">
                            <span class="pd-user-name" id="pd-user-name"></span>
                        </div>
                        <div class="pd-user-actions">
                            <span class="pd-user-badge">Super Admin</span>
                            <button class="pd-logout-btn" id="pd-logout-btn">Logout</button>
                        </div>
                    </div>
                </div>

                <div id="pd-nav" class="pd-nav">
                    <button class="pd-nav-btn active" data-view="apps">📱 Aplikasi</button>
                    <button class="pd-nav-btn" data-view="companies">🏢 Kelola Perusahaan</button>
                    <button class="pd-nav-btn" data-view="superadmins">👤 User</button>
                    <button class="pd-nav-btn" data-view="settings">⚙️ Pengaturan</button>
                </div>

                <div id="pd-content" class="pd-content">
                    <div class="pd-loading">Memuat...</div>
                </div>

                <nav class="pd-bottom-nav" id="pd-bottom-nav">
                    <button class="pd-bottom-nav-btn active" data-view="apps">
                        <span class="pdb-icon">📱</span>
                        <span class="pdb-label">Aplikasi</span>
                    </button>
                    <button class="pd-bottom-nav-btn" data-view="companies">
                        <span class="pdb-icon">🏢</span>
                        <span class="pdb-label">Perusahaan</span>
                    </button>
                    <button class="pd-bottom-nav-btn" data-view="superadmins">
                        <span class="pdb-icon">👤</span>
                        <span class="pdb-label">User</span>
                    </button>
                    <button class="pd-bottom-nav-btn" data-view="settings">
                        <span class="pdb-icon">⚙️</span>
                        <span class="pdb-label">Pengaturan</span>
                    </button>
                </nav>
            </div>
        `;
    }

    /**
     * Initialize the Platform Dashboard after mount.
     */
    function initPlatformDashboard() {
        // Logout button
        const logoutBtn = document.getElementById("pd-logout-btn");
        if (logoutBtn) {
            const logoutHandler = typeof onLogout === "function" ? onLogout : defaultLogout;
            logoutBtn.addEventListener("click", logoutHandler);
        }

        // Apply stored logo to header and favicon on init
        applyStoredLogo();

        // Set user info dynamically from Auth
        const user = Auth.user();
        const userNameEl = document.getElementById("pd-user-name");
        if (userNameEl && user) {
            userNameEl.textContent = user.name || user.username || 'Super Admin';
        }

        // Navigation — shared handler for both top nav (desktop) and bottom nav (mobile)
        document.querySelectorAll(".pd-nav-btn, .pd-bottom-nav-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const view = btn.dataset.view;
                // Update active state on BOTH navs
                document.querySelectorAll(".pd-nav-btn, .pd-bottom-nav-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                switchToView(view);
            });
        });

        // Show apps view by default
        showAppsView();
    }

    function switchToView(view) {
        if (view === "apps") showAppsView();
        else if (view === "companies") showCompanyManagement();
        else if (view === "superadmins") showSuperAdminManagement();
        else if (view === "settings") showSettingsView();
    }

    function defaultLogout() {
        Auth.logout();
        window.location.reload();
    }

    // ══════════════════════════════════════════════
    //  View: Apps Grid
    // ══════════════════════════════════════════════

    function showAppsView() {
        state.view = "apps";
        const content = document.getElementById("pd-content");
        if (!content) return;

        const apps = platform.getApps({ onlyActive: true });

        content.innerHTML = `
            <div class="pd-view">
                <h2 class="pd-view-title">Pilih Aplikasi</h2>
                <p class="pd-view-desc">Pilih aplikasi untuk melihat perusahaan yang memiliki akses, atau upload logo aplikasi.</p>
                <div class="pd-apps-grid">
                    ${apps.map(app => {
            const appLogo = getAppLogo(app.slug);
            return `
                            <div class="pd-app-card" data-app="${app.slug}">
                                <div class="pd-app-logo-section">
                                    <div class="pd-app-icon">${appLogo ? `<img src="${encodeURI(appLogo)}" alt="${app.name}" class="pd-app-icon-img" />` : (app.icon || "📱")}</div>
                                    <div class="pd-app-logo-overlay" data-slug="${app.slug}">
                                        <input type="file" class="pd-app-logo-input" accept="image/*" data-slug="${app.slug}" />
                                        <span class="pd-app-logo-overlay-icon">📷</span>
                                        <span class="pd-app-logo-overlay-text">${appLogo ? 'Ganti Logo' : 'Upload Logo'}</span>
                                    </div>
                                </div>
                                <div class="pd-app-name">${app.name}</div>
                                <div class="pd-app-desc">${app.description || ""}</div>
                                <div class="pd-app-action"><span class="pd-app-badge">Pilih →</span></div>
                            </div>
                        `;
        }).join("")}
                    ${apps.length === 0 ? '<div class="pd-empty">Belum ada aplikasi tersedia</div>' : ""}
                </div>
            </div>
        `;

        // Click on app card → show companies (except when clicking overlay/remove button)
        content.querySelectorAll(".pd-app-card").forEach(card => {
            card.addEventListener("click", (e) => {
                // Don't navigate if clicking on overlay controls or remove button
                if (e.target.closest(".pd-app-logo-overlay") || e.target.closest(".pd-app-logo-input")) return;
                showCompaniesView(card.dataset.app);
            });
        });

        // Upload overlay click
        content.querySelectorAll(".pd-app-logo-overlay").forEach(overlay => {
            const slug = overlay.dataset.slug;
            const fileInput = overlay.querySelector(".pd-app-logo-input");

            overlay.addEventListener("click", (e) => {
                e.stopPropagation();
                fileInput.click();
            });

            fileInput.addEventListener("change", (e) => {
                e.stopPropagation();
                const file = e.target.files?.[0];
                if (!file) return;

                // Validate file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showToast("danger", "Ukuran file maksimal 2MB");
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target.result;

                    // Save to localStorage
                    setAppLogo(slug, dataUrl);

                    // Sync to server via API
                    showToast("info", `Menyimpan logo ${slug}...`);
                    try {
                        const res = await fetch(`/api/platform/app-logo/${slug}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ logo: dataUrl })
                        });
                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || "Server error");
                        }
                    } catch (e) {
                        console.error(`[PlatformDashboard] App logo server sync failed for ${slug}:`, e);
                    }

                    // Call DI callback if provided
                    if (typeof onAppLogoUpload === "function") {
                        onAppLogoUpload(slug, dataUrl).catch(e => console.warn("[PlatformDashboard] App logo callback error:", e));
                    }

                    // Refresh view
                    showAppsView();
                    showToast("success", `Logo ${slug} berhasil disimpan`);
                };
                reader.readAsDataURL(file);
            });
        });

    }

    // ══════════════════════════════════════════════
    //  View: Companies by App
    // ══════════════════════════════════════════════

    async function showCompaniesView(appSlug) {
        const app = platform.getApp(appSlug);
        if (!app) return;

        state.view = "companies";
        state.selectedApp = appSlug;
        state.loading = true;

        const content = document.getElementById("pd-content");
        if (!content) return;
        content.innerHTML = `<div class="pd-loading">Memuat daftar perusahaan...</div>`;

        const appLogo = getAppLogo(appSlug);

        try {
            const result = await listCompanies({ page: 1, limit: 999 });
            const allCompanies = result.data || [];

            allCompanies.forEach(c => {
                if (!platform.hasAccess(c.code, appSlug)) {
                    platform.enableAppForCompany(c.code, appSlug);
                }
            });

            content.innerHTML = `
                <div class="pd-view">
                    <div class="pd-view-back">
                        <button class="pd-back-btn" id="pd-back-btn">← Kembali ke Aplikasi</button>
                        <h2 class="pd-view-title">${appLogo ? `<img src="${encodeURI(appLogo)}" class="pd-view-app-logo" />` : (app.icon || "")} ${app.name}</h2>
                        <p class="pd-view-desc">Pilih perusahaan untuk masuk sebagai Admin Perusahaan</p>
                    </div>
                    <div class="pd-companies-list">
                        ${allCompanies.map(c => renderCompanyCard(c, appSlug)).join("")}
                        ${allCompanies.length === 0 ? '<div class="pd-empty">Belum ada perusahaan terdaftar.</div>' : ""}
                    </div>
                </div>
            `;

            document.getElementById("pd-back-btn")?.addEventListener("click", showAppsView);
            attachCompanyCardEvents(content, appSlug);

        } catch (err) {
            console.error("[PlatformDashboard] Failed to load companies:", err);
            content.innerHTML = `
                <div class="pd-view">
                    <button class="pd-back-btn" id="pd-back-btn">← Kembali ke Aplikasi</button>
                    <div class="pd-empty">Gagal memuat: ${err.message}</div>
                </div>
            `;
            document.getElementById("pd-back-btn")?.addEventListener("click", showAppsView);
        } finally { state.loading = false; }
    }

    // ══════════════════════════════════════════════
    //  View: Company Management (Full List)
    // ══════════════════════════════════════════════

    async function showCompanyManagement() {
        state.view = "company-management";
        state.loading = true;
        const content = document.getElementById("pd-content");
        if (!content) return;
        content.innerHTML = `<div class="pd-loading">Memuat daftar perusahaan...</div>`;

        try {
            const result = await listCompanies({ page: 1, limit: 999 });
            state.companies = result.data || [];

            content.innerHTML = `
                <div class="pd-view">
                    <div class="pd-view-header">
                        <div>
                            <h2 class="pd-view-title">🏢 Kelola Perusahaan</h2>
                            <p class="pd-view-desc">Total ${state.companies.length} perusahaan terdaftar di platform</p>
                        </div>
                        <button class="pd-add-company-btn" id="pd-add-company">➕ Tambah Perusahaan</button>
                    </div>
                    <div class="pd-mgmt-table-wrapper" id="pd-company-table-area">
                        <table class="pd-mgmt-table">
                            <thead>
                                <tr>
                                    <th>Perusahaan</th>
                                    <th>Kode</th>
                                    <th>Jenis</th>
                                    <th>Status</th>
                                    <th>Aplikasi</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${state.companies.map(c => `
                                    <tr>
                                        <td>
                                            <div class="pd-mgmt-company">
                                                <div class="pd-mgmt-logo">${c.logo ? `<img src="${c.logo}" />` : `<span class="pd-mgmt-initial">${(c.name || "?").charAt(0)}</span>`}</div>
                                                <div class="pd-mgmt-name">${esc(c.name || c.code)}</div>
                                            </div>
                                        </td>
                                        <td><code>${esc(c.code || "")}</code></td>
                                        <td><span class="pd-badge-type">${esc(c.jenis || "-")}</span></td>
                                        <td>${c.active !== false ? '<span class="pd-status-active">Aktif</span>' : '<span class="pd-status-inactive">Nonaktif</span>'}</td>
                                        <td><div class="pd-mgmt-apps">${getCompanyAppBadges(c.code)}</div></td>
                                        <td>
                                            <div class="pd-mgmt-actions">
                                                <button class="pd-action-btn pd-action-edit" data-action="edit" data-code="${c.code}" data-id="${c.id}" title="Edit Perusahaan">✏️ Edit</button>
                                                <button class="pd-action-btn pd-action-loginas" data-action="loginas" data-code="${c.code}" data-name="${esc(c.name || c.code)}" title="Login As Admin">🔑 Login As</button>
                                                <button class="pd-action-btn pd-action-profile" data-action="profile" data-code="${c.code}" title="Lihat Profil">👁️ Profile</button>
                                                <button class="pd-action-btn pd-action-subs" data-action="subscription" data-code="${c.code}" data-name="${esc(c.name || c.code)}" title="Atur Langganan Aplikasi">📋 Subs</button>
                                                <button class="pd-action-btn pd-action-disable" data-action="disable" data-code="${c.code}" data-id="${c.id}" data-active="${c.active !== false}" title="${c.active !== false ? 'Nonaktifkan' : 'Aktifkan'} Perusahaan">${c.active !== false ? '⛔ Disable' : '✅ Enable'}</button>
                                                <button class="pd-action-btn pd-action-delete" data-action="delete" data-id="${c.id}" data-name="${esc(c.name || c.code)}" title="Hapus Perusahaan">🗑️ Hapus</button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join("")}
                                ${state.companies.length === 0 ? '<tr><td colspan="6" class="pd-empty">Belum ada perusahaan</td></tr>' : ""}
                            </tbody>
                        </table>
                    </div>
                    <div id="pd-company-cards-area" class="pd-card-view" style="display:none"></div>
                    <div id="pd-user-cards-area" class="pd-card-view" style="display:none"></div>
                </div>
            `;

            // Attach action handlers
            content.querySelectorAll("[data-action]").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const action = btn.dataset.action;
                    const code = btn.dataset.code;
                    const id = btn.dataset.id;
                    const name = btn.dataset.name;
                    const active = btn.dataset.active;
                    switch (action) {
                        case "edit": openEditCompany(id, code); break;
                        case "loginas": promptLoginAs(code, name); break;
                        case "profile": viewCompanyProfile(id, code); break;
                        case "subscription": manageSubscription(code, name); break;
                        case "disable": toggleCompanyStatus(id, code, active === "true"); break;
                        case "delete": deleteCompanyAction(id, name); break;
                    }
                });
            });

            document.getElementById("pd-add-company")?.addEventListener("click", openAddCompany);
            renderCompanyCards();

        } catch (err) {
            console.error("[PlatformDashboard] Failed:", err);
            content.innerHTML = `<div class="pd-empty">Gagal memuat: ${err.message}</div>`;
        } finally { state.loading = false; }
    }

    // ══════════════════════════════════════════════
    //  Render Helpers
    // ══════════════════════════════════════════════

    function renderCompanyCard(c, appSlug) {
        return `
            <div class="pd-company-card" data-company-code="${c.code}">
                <div class="pd-company-logo">
                    ${c.logo ? `<img src="${c.logo}" />` : `<div class="pd-company-initial">${(c.name || "?").charAt(0)}</div>`}
                </div>
                <div class="pd-company-info">
                    <div class="pd-company-name">${c.name || c.code}</div>
                    <div class="pd-company-meta">
                        <span>${c.code || ""}</span>
                        <span>${c.jenis || ""}</span>
                    </div>
                </div>
                <div class="pd-company-actions">
                    <button class="pd-action-sm pd-action-loginas" data-code="${c.code}" data-name="${esc(c.name || c.code)}">🔑 Login As Admin</button>
                    <button class="pd-action-sm pd-action-edit" data-id="${c.id}" data-code="${c.code}">✏️ Edit</button>
                    <button class="pd-action-sm pd-action-profile" data-code="${c.code}">👁️ Profile</button>
                </div>
            </div>
        `;
    }

    function attachCompanyCardEvents(content, appSlug) {
        content.querySelectorAll(".pd-action-loginas").forEach(btn => {
            btn.addEventListener("click", () => startImpersonation(appSlug, btn.dataset.code, btn.dataset.name));
        });
        content.querySelectorAll(".pd-action-edit").forEach(btn => {
            btn.addEventListener("click", () => openEditCompany(btn.dataset.id, btn.dataset.code));
        });
        content.querySelectorAll(".pd-action-profile").forEach(btn => {
            btn.addEventListener("click", () => viewCompanyProfile(null, btn.dataset.code));
        });
    }

    
    // ── Mobile Card Views ──

    function renderCompanyCards() {
        const cardsArea = document.getElementById("pd-company-cards-area");
        const tableArea = document.getElementById("pd-company-table-area");
        if (!cardsArea || !tableArea) return;
        if (window.innerWidth < 768) {
            tableArea.style.display = "none";
            cardsArea.style.display = "block";
            cardsArea.innerHTML = "";
            if (state.companies.length === 0) {
                cardsArea.innerHTML = '<div class="pd-empty">Belum ada perusahaan</div>';
                return;
            }
            const list = UI.CardList(state.companies, (c) => {
                const apps = platform.getCompanyApps(c.code);
                const appBadges = apps.slice(0, 3).map(a => a.icon).join(" ");
                return `<div class="sm-card-header-row">
                        <div class="sm-card-name">${esc(c.name || c.code)}</div>
                        <div class="sm-card-desc">${esc(c.code || "")}</div>
                    </div>
                    <div class="sm-card-details">
                        <div class="sm-card-detail-row">
                            <span class="sm-card-label">Jenis</span>
                            <span class="sm-card-value">${esc(c.jenis || "-")}</span>
                        </div>
                        <div class="sm-card-detail-row">
                            <span class="sm-card-label">Status</span>
                            <span class="sm-card-value">${c.active !== false ? '<span style="color:#16a34a;font-weight:600">Aktif</span>' : '<span style="color:#dc2626;font-weight:600">Nonaktif</span>'}</span>
                        </div>
                        ${appBadges ? '<div class="sm-card-detail-row"><span class="sm-card-label">Aplikasi</span><span class="sm-card-value">' + appBadges + '</span></div>' : ""}
                    </div>
                    <div class="sm-card-footer-row">
                        <div class="sm-card-actions">
                            <button class="sm-card-btn sm-card-btn-edit" data-comp-edit="${c.id}" data-code="${c.code}">✏️ Edit</button>
                            <button class="sm-card-btn sm-card-btn-edit" data-comp-loginas="${c.code}" data-name="${esc(c.name || c.code)}">🔑 Login</button>
                            <button class="sm-card-btn sm-card-btn-delete" data-comp-delete="${c.id}" data-name="${esc(c.name || c.code)}">🗑️ Hapus</button>
                        </div>
                    </div>`;
            });
            cardsArea.appendChild(list);
            cardsArea.querySelectorAll("[data-comp-edit]").forEach(btn => {
                btn.addEventListener("click", () => openEditCompany(btn.dataset.compEdit, btn.dataset.code));
            });
            cardsArea.querySelectorAll("[data-comp-loginas]").forEach(btn => {
                btn.addEventListener("click", () => promptLoginAs(btn.dataset.compLoginas, btn.dataset.name));
            });
            cardsArea.querySelectorAll("[data-comp-delete]").forEach(btn => {
                btn.addEventListener("click", () => deleteCompanyAction(btn.dataset.compDelete, btn.dataset.name));
            });
        } else {
            tableArea.style.display = "";
            cardsArea.style.display = "none";
        }
    }

    function renderUserCards() {
        const cardsArea = document.getElementById("pd-user-cards-area");
        if (!cardsArea) return;
        cardsArea.innerHTML = "";
        if (saState.users.length === 0) {
            cardsArea.innerHTML = '<div class="pd-empty">Belum ada User</div>';
            return;
        }
        const list = UI.CardList(saState.users, (u) => {
            return `<div class="sm-card-header-row">
                    <div class="sm-card-name">${esc(u.username)}</div>
                    <div class="sm-card-desc">${u.active !== false ? '<span style="color:#16a34a">Aktif</span>' : '<span style="color:#dc2626">Nonaktif</span>'}</div>
                </div>
                <div class="sm-card-details">
                    <div class="sm-card-detail-row">
                        <span class="sm-card-label">Nama</span>
                        <span class="sm-card-value">${esc(u.name)}</span>
                    </div>
                    <div class="sm-card-detail-row">
                        <span class="sm-card-label">Email</span>
                        <span class="sm-card-value">${esc(u.email || "—")}</span>
                    </div>
                </div>
                <div class="sm-card-footer-row">
                    <div class="sm-card-actions">
                        <button class="sm-card-btn sm-card-btn-edit" data-user-edit="${u._id}">✏️ Edit</button>
                        <button class="sm-card-btn sm-card-btn-delete" data-user-delete="${u._id}" data-username="${esc(u.username)}">🗑️ Hapus</button>
                    </div>
                </div>`;
        });
        cardsArea.appendChild(list);
        cardsArea.querySelectorAll("[data-user-edit]").forEach(btn => {
            btn.addEventListener("click", () => openEditSuperAdmin(btn.dataset.userEdit));
        });
        cardsArea.querySelectorAll("[data-user-delete]").forEach(btn => {
            btn.addEventListener("click", () => deleteSuperAdminAction(btn.dataset.userDelete, btn.dataset.username));
        });
    }

function getCompanyAppBadges(companyCode) {
        const apps = platform.getApps({ onlyActive: true });
        const enabled = platform.getCompanyApps(companyCode);
        return apps.slice(0, 3).map(a => {
            const isEnabled = enabled.some(e => e.slug === a.slug);
            return `<span class="pd-app-badge-sm ${isEnabled ? 'enabled' : 'disabled'}" title="${a.name}">${isEnabled ? a.icon : '○'}</span>`;
        }).join("") + (apps.length > 3 ? `<span class="pd-app-badge-sm more">+${apps.length - 3}</span>` : "");
    }

    // ══════════════════════════════════════════════
    //  Actions: Edit Company
    // ══════════════════════════════════════════════

    async function openEditCompany(id, code) {
        try {
            const item = id ? await getCompany(id) : await getCompanyByCode(code);
            if (!item) { showToast("danger", "Perusahaan tidak ditemukan"); return; }
            showCompanyForm("Edit Perusahaan", item, async (data) => {
                try {
                    await updateCompany(item.id, data);
                    // Sync application selections
                    const selectedApps = data.selectedApps || [];
                    const allApps = platform.getApps({ onlyActive: true });
                    for (const app of allApps) {
                        const isSelected = selectedApps.includes(app.slug);
                        const hasAccess = platform.hasAccess(item.code, app.slug);
                        if (isSelected && !hasAccess) {
                            platform.enableAppForCompany(item.code, app.slug);
                        } else if (!isSelected && hasAccess) {
                            platform.disableAppForCompany(item.code, app.slug);
                        }
                    }
                    showToast("success", "Perusahaan berhasil diperbarui");
                    removeModal();
                    showCompanyManagement();
                } catch (err) {
                    showToast("danger", err.message || "Gagal memperbarui perusahaan");
                }
            });
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
        }
    }

    async function openAddCompany() {
        showCompanyForm("Tambah Perusahaan Baru", {}, async (data) => {
            try {
                const created = await createCompany(data);
                // Enable selected applications for the new company
                const selectedApps = data.selectedApps || [];
                const companyCode = created?.code || data.code;
                if (companyCode) {
                    for (const appSlug of selectedApps) {
                        platform.enableAppForCompany(companyCode, appSlug);
                    }
                }
                showToast("success", "Perusahaan berhasil ditambahkan");
                removeModal();
                showCompanyManagement();
            } catch (err) {
                showToast("danger", err.message || "Gagal menambahkan perusahaan");
            }
        });
    }

    function showCompanyForm(title, item, onSubmit) {
        const isEdit = item && item.id;
        const formData = {
            code: item.code || "", name: item.name || "", jenis: item.jenis || "PT",
            address: item.address || "", phone: item.phone || "", email: item.email || "",
            logo: item.logo || null
        };
        const adminData = {
            username: item.adminUsername || "",
            password: ""
        };

        const typeOptions = (COMPANY_TYPES || ["PT", "CV", "Yayasan", "Koperasi", "Firma", "Perorangan", "BUMDes", "Pemdes", "Lainnya"])
            .map(t => `<option value="${t}" ${formData.jenis === t ? "selected" : ""}>${t}</option>`).join("");

        // Get apps and pre-selected apps
        const allApps = platform.getApps({ onlyActive: true });
        const enabledApps = isEdit && item.code ? platform.getCompanyApps(item.code) : [];
        const enabledSlugs = enabledApps.map(a => a.slug);

        const footerHTML = `
            <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan" : "Tambah"}</button>
        `;

        const modal = Modal({
            open: true, title,
            content: `
                <div class="pd-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Kode Perusahaan <span class="required">*</span></label>
                            <input type="text" id="f-code" value="${esc(formData.code)}" placeholder="Contoh: PT-001" required />
                        </div>
                        <div class="form-group">
                            <label>Jenis</label>
                            <select id="f-jenis">${typeOptions}</select>
                        </div>

                        <!-- ── Wilayah Section (BUMDes/Pemdes) ── -->
                        <div class="pd-wilayah-section" id="pd-wilayah-section" style="display:none">
                            <div class="pd-wilayah-title">📍 Pilih Wilayah Desa</div>
                            <div class="pd-wilayah-grid">
                                <div class="form-group">
                                    <label>Provinsi <span class="required">*</span></label>
                                    <select id="f-provinsi">
                                        <option value="">-- Pilih Provinsi --</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Kabupaten <span class="required">*</span></label>
                                    <select id="f-kabupaten" disabled>
                                        <option value="">-- Pilih Kabupaten --</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Kecamatan <span class="required">*</span></label>
                                    <select id="f-kecamatan" disabled>
                                        <option value="">-- Pilih Kecamatan --</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Desa <span class="required">*</span></label>
                                    <select id="f-desa" disabled>
                                        <option value="">-- Pilih Desa --</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <label>Nama Perusahaan <span class="required">*</span></label>
                            <input type="text" id="f-name" value="${esc(formData.name)}" placeholder="Nama perusahaan" required />
                        </div>
                        <div class="form-group full-width">
                            <label>Alamat</label>
                            <textarea id="f-address" placeholder="Alamat lengkap">${esc(formData.address)}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="f-email" value="${esc(formData.email)}" placeholder="email@company.com" />
                        </div>
                        <div class="form-group">
                            <label>Telepon</label>
                            <input type="text" id="f-phone" value="${esc(formData.phone)}" placeholder="021-xxxx" />
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="f-status">
                                <option value="true" ${formData.active !== false ? "selected" : ""}>Aktif</option>
                                <option value="false" ${formData.active === false ? "selected" : ""}>Nonaktif</option>
                            </select>
                        </div>

                        <div class="form-section-title pd-admin-section-title">Akun Admin Perusahaan</div>
                        <div class="form-group full-width">
                            <label>Username Admin <span class="required">*</span></label>
                            <input type="text" id="f-admin-username" value="${esc(adminData.username)}" placeholder="admin_perusahaan" required />
                        </div>
                        <div class="form-group full-width">
                            <label>Password Admin ${isEdit ? '' : '<span class="required">*</span>'}</label>
                            <input type="password" id="f-admin-password" value="" placeholder="${isEdit ? 'Kosongkan jika tidak diubah' : 'Buat password untuk admin perusahaan'}" ${isEdit ? '' : 'required'} />
                        </div>

                        <div class="form-group full-width">
                            <label>Aplikasi <span class="hint">Pilih aplikasi yang terhubung</span></label>
                            <div class="pd-app-checkbox-group">
                                ${allApps.map(a => `
                                    <label class="pd-app-checkbox-item ${enabledSlugs.includes(a.slug) ? 'checked' : ''}">
                                        <input type="checkbox" class="pd-app-checkbox" value="${a.slug}" ${enabledSlugs.includes(a.slug) ? "checked" : ""} />
                                        <span class="pd-app-checkbox-icon">${a.icon}</span>
                                        <span class="pd-app-checkbox-name">${a.name}</span>
                                        <span class="pd-app-checkbox-desc">${a.description}</span>
                                    </label>
                                `).join("")}
                            </div>
                        </div>
                    </div>
                </div>
            `, footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => {
            const name = document.getElementById("f-name")?.value?.trim();
            const code = document.getElementById("f-code")?.value?.trim();
            if (!name) { showToast("warning", "Nama wajib diisi"); return; }
            if (!code) { showToast("warning", "Kode wajib diisi"); return; }

            // Validate admin fields
            const adminUsername = document.getElementById("f-admin-username")?.value?.trim();
            const adminPassword = document.getElementById("f-admin-password")?.value;
            if (!adminUsername) { showToast("warning", "Username Admin wajib diisi"); return; }
            if (!isEdit && !adminPassword) { showToast("warning", "Password Admin wajib diisi"); return; }

            // Collect selected app slugs
            const selectedApps = [];
            document.querySelectorAll(".pd-app-checkbox:checked").forEach(cb => {
                selectedApps.push(cb.value);
            });

            const submitData = {
                code, name,
                jenis: document.getElementById("f-jenis")?.value || "PT",
                address: document.getElementById("f-address")?.value?.trim() || "",
                phone: document.getElementById("f-phone")?.value?.trim() || "",
                email: document.getElementById("f-email")?.value?.trim() || "",
                active: document.getElementById("f-status")?.value === "true",
                adminUsername,
                selectedApps
            };

            // Only include password if provided (for edit, empty = no change)
            if (adminPassword) {
                submitData.adminPassword = adminPassword;
            }

            onSubmit(submitData);
        });

        // Toggle visual checked state on app checkbox click
        modal.querySelectorAll(".pd-app-checkbox").forEach(cb => {
            cb.addEventListener("change", () => {
                cb.closest(".pd-app-checkbox-item")?.classList.toggle("checked", cb.checked);
            });
        });

        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);

        // ── Wilayah cascading + Auto-generate kode ──
        const jenisSelect = document.getElementById("f-jenis");
        const codeInput = document.getElementById("f-code");
        const adminUserInput = document.getElementById("f-admin-username");
        const wilayahSection = document.getElementById("pd-wilayah-section");
        const provinsi = document.getElementById("f-provinsi");
        const kabupaten = document.getElementById("f-kabupaten");
        const kecamatan = document.getElementById("f-kecamatan");
        const desa = document.getElementById("f-desa");

        // State
        let selectedDesaCode = null;
        const ssInstances = {};

        function isWilayahType(type) {
            return type === "BUMDes" || type === "Pemdes";
        }

        // ── Wilayah: Toggle visibility ──
        function toggleWilayahSection() {
            if (!wilayahSection) return;
            const show = isWilayahType(jenisSelect?.value);
            wilayahSection.style.display = show ? "block" : "none";
        }

        // ── Wilayah: Helper to init or update SearchableSelect ──
        function initSS(el, placeholder, onChange) {
            if (!el) return null;
            const key = el.id;
            if (ssInstances[key]) {
                ssInstances[key].updateOptions();
                return ssInstances[key];
            }
            const ss = UI.SearchableSelect(el, { placeholder, onChange });
            ssInstances[key] = ss;
            return ss;
        }

        // ── Wilayah: Load Provinsi ──
        async function loadProvinces() {
            if (!provinsi) return;
            provinsi.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
            try {
                const res = await fetch("/api/wilayah/provinces");
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        data.data.forEach(p => {
                            const opt = document.createElement("option");
                            opt.value = p.code;
                            opt.textContent = p.name;
                            provinsi.appendChild(opt);
                        });
                    }
                }
            } catch (err) {
                console.error("[PlatformDashboard] Failed to load provinces:", err);
            }

            initSS(provinsi, "Ketik nama provinsi...", (value) => {
                loadRegencies(value);
            });
        }

        // ── Wilayah: Load Kabupaten ──
        async function loadRegencies(provCode) {
            if (!kabupaten) return;
            kabupaten.innerHTML = '<option value="">-- Pilih Kabupaten --</option>';
            if (ssInstances["f-kabupaten"]) ssInstances["f-kabupaten"].setDisabled(true);
            kecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
            if (ssInstances["f-kecamatan"]) ssInstances["f-kecamatan"].setDisabled(true);
            desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
            if (ssInstances["f-desa"]) ssInstances["f-desa"].setDisabled(true);
            selectedDesaCode = null;

            if (!provCode) return;

            try {
                const res = await fetch(`/api/wilayah/${provCode}/regencies`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        data.data.forEach(k => {
                            const opt = document.createElement("option");
                            opt.value = k.code;
                            opt.textContent = k.name;
                            kabupaten.appendChild(opt);
                        });
                    }
                }
            } catch (err) {
                console.error("[PlatformDashboard] Failed to load regencies:", err);
            }

            const ss = initSS(kabupaten, "Ketik nama kabupaten...", (value) => {
                loadDistricts(provCode, value);
            });
            if (ss) ss.setDisabled(false);
        }

        // ── Wilayah: Load Kecamatan ──
        async function loadDistricts(provCode, kabCode) {
            if (!kecamatan) return;
            kecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
            if (ssInstances["f-kecamatan"]) ssInstances["f-kecamatan"].setDisabled(true);
            desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
            if (ssInstances["f-desa"]) ssInstances["f-desa"].setDisabled(true);
            selectedDesaCode = null;

            if (!provCode || !kabCode) return;

            try {
                const res = await fetch(`/api/wilayah/${provCode}/${kabCode}/districts`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        data.data.forEach(k => {
                            const opt = document.createElement("option");
                            opt.value = k.code;
                            opt.textContent = k.name;
                            kecamatan.appendChild(opt);
                        });
                    }
                }
            } catch (err) {
                console.error("[PlatformDashboard] Failed to load districts:", err);
            }

            const ss = initSS(kecamatan, "Ketik nama kecamatan...", (value) => {
                loadVillages(provCode, kabCode, value);
            });
            if (ss) ss.setDisabled(false);
        }

        // ── Wilayah: Load Desa ──
        async function loadVillages(provCode, kabCode, kecCode) {
            if (!desa) return;
            desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
            if (ssInstances["f-desa"]) ssInstances["f-desa"].setDisabled(true);
            selectedDesaCode = null;

            if (!provCode || !kabCode || !kecCode) return;

            try {
                const res = await fetch(`/api/wilayah/${provCode}/${kabCode}/${kecCode}/villages`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        data.data.forEach(d => {
                            const opt = document.createElement("option");
                            opt.value = d.code;
                            opt.textContent = d.name;
                            desa.appendChild(opt);
                        });
                    }
                }
            } catch (err) {
                console.error("[PlatformDashboard] Failed to load villages:", err);
            }

            const ss = initSS(desa, "Ketik nama desa...", (value) => {
                if (value) {
                    selectedDesaCode = value;
                    updateCompanyCode();
                } else {
                    selectedDesaCode = null;
                }
            });
            if (ss) ss.setDisabled(false);
        }

        // ── Auto-generate kode ──
        async function updateCompanyCode() {
            const jenis = jenisSelect?.value;
            if (!jenis) return;

            // BUMDes/Pemdes: use desa code
            if (isWilayahType(jenis) && selectedDesaCode) {
                codeInput.value = `${jenis}-${selectedDesaCode}`;
                return;
            }

            // Regular types: fetch from server
            try {
                const res = await fetch(`/api/auth/register/code?jenis=${encodeURIComponent(jenis)}`);
                if (res.ok) {
                    const data = await res.json();
                    codeInput.value = data.code;
                    // Auto-fill admin username dari kode
                    if (adminUserInput && !adminUserInput.dataset.userEdited) {
                        const val = data.code.toLowerCase().replace(/[^a-z0-9]/g, '_');
                        adminUserInput.value = `admin_${val}`;
                    }
                }
            } catch { /* silent */ }
        }

        // ── Event: Jenis berubah ──
        if (jenisSelect) {
            jenisSelect.addEventListener("change", () => {
                toggleWilayahSection();
                if (isWilayahType(jenisSelect.value)) {
                    loadProvinces();
                    // Reset kab, kec, desa
                    kabupaten.innerHTML = '<option value="">-- Pilih Kabupaten --</option>';
                    kabupaten.disabled = true;
                    kecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
                    kecamatan.disabled = true;
                    desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
                    desa.disabled = true;
                    selectedDesaCode = null;
                    codeInput.value = jenisSelect.value + "-...";
                } else {
                    selectedDesaCode = null;
                    updateCompanyCode();
                }
            });
        }

        // ── Hapus event listener wilayah lama (digantikan SearchableSelect onChange) ──
        // (cascading handled inside initSS callbacks above)

        // Initial setup for NEW company
        if (!isEdit) {
            // Auto-generate sequenctial code + wilayah setup
            if (codeInput) {
                codeInput.readOnly = true;
                codeInput.style.background = "#f1f5f9";
                codeInput.style.cursor = "not-allowed";
            }

            // Show/hide wilayah based on current jenis
            toggleWilayahSection();
            if (isWilayahType(jenisSelect?.value)) {
                loadProvinces();
            } else {
                updateCompanyCode();
            }

            if (adminUserInput) {
                adminUserInput.addEventListener("input", () => {
                    adminUserInput.dataset.userEdited = "true";
                });
            }
        }
    }

    // ══════════════════════════════════════════════
    //  Actions: Login As
    // ══════════════════════════════════════════════

    function promptLoginAs(companyCode, companyName) {
        const apps = platform.getApps({ onlyActive: true });
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>`;

        const modal = Modal({
            open: true, title: `🔑 Login As — ${companyName}`,
            content: `
                <p style="margin-bottom:1rem;color:#64748b">Pilih aplikasi untuk masuk sebagai Admin Perusahaan:</p>
                <div class="pd-apps-selector">
                    ${apps.map(a => `
                        <div class="pd-app-select-item" data-app="${a.slug}" data-code="${companyCode}" data-name="${esc(companyName)}">
                            <span class="pd-app-select-icon">${a.icon}</span>
                            <div>
                                <div class="pd-app-select-name">${a.name}</div>
                                <div class="pd-app-select-desc">${a.description}</div>
                            </div>
                            <span class="pd-app-select-action">Login As →</span>
                        </div>
                    `).join("")}
                </div>
            `, footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        modal.querySelectorAll(".pd-app-select-item").forEach(item => {
            item.addEventListener("click", () => {
                const appSlug = item.dataset.app;
                const code = item.dataset.code;
                const name = item.dataset.name;
                removeModal();
                startImpersonation(appSlug, code, name);
            });
        });
        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    function startImpersonation(appSlug, companyCode, companyName) {
        const superAdmin = Auth.user();
        if (!superAdmin) return;

        audit.logImpersonationStart({
            superAdminId: superAdmin.id, superAdminName: superAdmin.name,
            companyId: companyCode, application: appSlug
        });
        setCompanyContext(companyCode, companyName);
        impersonation.start({
            superAdminId: superAdmin.id, superAdminName: superAdmin.name,
            companyId: companyCode, companyName,
            userId: companyCode + "-admin", userName: `Admin ${companyName}`,
            application: appSlug, role: "owner"
        }, 3600000);

        console.log(`[Platform] Impersonation: ${superAdmin.name} → ${companyName} (${appSlug})`);

        if (appSlug === "inventory") {
            sessionStorage.setItem("smart_impersonation", JSON.stringify({
                session: {
                    superAdminId: superAdmin.id, superAdminName: superAdmin.name,
                    companyId: companyCode, companyName, userId: companyCode + "-admin",
                    userName: `Admin ${companyName}`, application: appSlug, role: "owner"
                },
                ttlMs: 3600000, companyCode, companyName,
                authUser: {
                    id: superAdmin.id, name: superAdmin.name, email: superAdmin.email,
                    institution: superAdmin.institution, role: superAdmin.role
                }
            }));
            window.location.reload();
        } else {
            showToast("info", `Aplikasi "${appSlug}" akan tersedia segera`);
            impersonation.end();
            setCompanyContext(null, null);
        }
    }

    // ══════════════════════════════════════════════
    //  Actions: View Profile
    // ══════════════════════════════════════════════

    async function viewCompanyProfile(id, code) {
        try {
            const result = await listCompanies({ page: 1, limit: 999 });
            const company = id ? result.data.find(c => String(c.id) === String(id)) : result.data.find(c => c.code === code);
            if (!company) { showToast("danger", "Perusahaan tidak ditemukan"); return; }

            const enabledApps = platform.getCompanyApps(company.code);

            const footerHTML = `<button class="smart-btn smart-btn-primary" id="f-close">Tutup</button>`;
            const modal = Modal({
                open: true, title: `👁️ ${company.name || company.code}`,
                content: `
                    <div class="pd-profile">
                        <div class="pd-profile-logo">
                            ${company.logo ? `<img src="${company.logo}" />` : `<span class="pd-profile-initial">${(company.name || "?").charAt(0)}</span>`}
                        </div>
                        <div class="pd-profile-details">
                            <div class="pd-profile-row"><strong>Kode:</strong> ${esc(company.code || "-")}</div>
                            <div class="pd-profile-row"><strong>Nama:</strong> ${esc(company.name || "-")}</div>
                            <div class="pd-profile-row"><strong>Jenis:</strong> ${esc(company.jenis || "-")}</div>
                            <div class="pd-profile-row"><strong>Alamat:</strong> ${esc(company.address || "-")}</div>
                            <div class="pd-profile-row"><strong>Email:</strong> ${esc(company.email || "-")}</div>
                            <div class="pd-profile-row"><strong>Telepon:</strong> ${esc(company.phone || "-")}</div>
                            <div class="pd-profile-row"><strong>Status:</strong> ${company.active !== false ? '<span style="color:#16a34a">Aktif</span>' : '<span style="color:#dc2626">Nonaktif</span>'}</div>
                            <div class="pd-profile-row"><strong>Aplikasi Aktif:</strong> ${enabledApps.length > 0 ? enabledApps.map(a => `${a.icon} ${a.name}`).join(", ") : "Tidak ada"}</div>
                        </div>
                    </div>
                `, footer: footerHTML, closable: true, onClose: removeModal
            });
            document.body.appendChild(modal);
            document.getElementById("f-close")?.addEventListener("click", removeModal);
            modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
        } catch (err) {
            showToast("danger", "Gagal memuat profil: " + err.message);
        }
    }

    // ══════════════════════════════════════════════
    //  Actions: Subscription Management
    // ══════════════════════════════════════════════

    function manageSubscription(companyCode, companyName) {
        const apps = platform.getApps({ onlyActive: true });
        const enabled = platform.getCompanyApps(companyCode);
        const enabledSlugs = enabled.map(a => a.slug);

        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Tutup</button>`;

        const modal = Modal({
            open: true, title: `📋 Atur Langganan — ${companyName}`,
            content: `
                <p style="margin-bottom:1rem;color:#64748b">Aktifkan atau nonaktifkan akses aplikasi untuk perusahaan ini:</p>
                <div class="pd-subs-list">
                    ${apps.map(a => {
                const isEnabled = enabledSlugs.includes(a.slug);
                return `
                            <div class="pd-subs-item ${isEnabled ? 'enabled' : ''}" data-app="${a.slug}">
                                <span class="pd-subs-icon">${a.icon}</span>
                                <div class="pd-subs-info">
                                    <div class="pd-subs-name">${a.name}</div>
                                    <div class="pd-subs-desc">${a.description}</div>
                                </div>
                                <label class="pd-subs-toggle">
                                    <input type="checkbox" ${isEnabled ? "checked" : ""} data-app="${a.slug}" />
                                    <span class="pd-subs-slider"></span>
                                </label>
                            </div>
                        `;
            }).join("")}
                </div>
            `, footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        modal.querySelectorAll("[data-app] input[type='checkbox']").forEach(cb => {
            cb.addEventListener("change", (e) => {
                const appSlug = e.target.dataset.app;
                const item = e.target.closest(".pd-subs-item");
                if (e.target.checked) {
                    platform.enableAppForCompany(companyCode, appSlug);
                    item?.classList.add("enabled");
                    showToast("success", `${platform.getApp(appSlug)?.name} diaktifkan`);
                } else {
                    platform.disableAppForCompany(companyCode, appSlug);
                    item?.classList.remove("enabled");
                    showToast("info", `${platform.getApp(appSlug)?.name} dinonaktifkan`);
                }
            });
        });

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    // ══════════════════════════════════════════════
    //  Actions: Disable/Enable Company
    // ══════════════════════════════════════════════

    async function toggleCompanyStatus(id, code, isActive) {
        const newStatus = !isActive;
        const action = newStatus ? "Aktifkan" : "Nonaktifkan";
        const footerHTML = `
            <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-${newStatus ? 'success' : 'danger'}" id="f-confirm">Ya, ${action}</button>
        `;

        const modal = Modal({
            open: true, title: `Konfirmasi ${action}`,
            content: `<p>${action} perusahaan <strong>${code}</strong>?</p>
                <p style="font-size:0.85rem;color:#64748b">${newStatus ? "Perusahaan akan kembali aktif" : "Perusahaan tidak dapat mengakses aplikasi"}.</p>`,
            footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-confirm")?.addEventListener("click", async () => {
            try {
                await updateCompany(id, { active: newStatus });
                showToast("success", `Perusahaan ${newStatus ? "diaktifkan" : "dinonaktifkan"}`);
                removeModal();
                showCompanyManagement();
            } catch (err) {
                showToast("danger", "Gagal: " + err.message);
            }
        });
        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    // ══════════════════════════════════════════════
    //  Actions: Delete Company
    // ══════════════════════════════════════════════

    async function deleteCompanyAction(id, companyName) {
        const footerHTML = `
            <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-danger" id="f-confirm">Ya, Hapus</button>
        `;

        const modal = Modal({
            open: true, title: "🗑️ Konfirmasi Hapus Perusahaan",
            content: `<p>Hapus perusahaan <strong>${esc(companyName)}</strong>?</p>
                <p style="font-size:0.85rem;color:#64748b">Semua data perusahaan ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</p>`,
            footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-confirm")?.addEventListener("click", async () => {
            try {
                const deleted = await deleteCompany(id);
                if (deleted) {
                    showToast("success", `Perusahaan "${companyName}" berhasil dihapus`);
                } else {
                    showToast("danger", "Gagal menghapus perusahaan");
                }
                removeModal();
                showCompanyManagement();
            } catch (err) {
                showToast("danger", "Gagal: " + err.message);
            }
        });
        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    // ══════════════════════════════════════════════
    //  View: Super Admin Management
    // ══════════════════════════════════════════════

    async function showSuperAdminManagement() {
        state.view = "superadmins";
        state.loading = true;
        const content = document.getElementById("pd-content");
        if (!content) return;
        content.innerHTML = `<div class="pd-loading">Memuat daftar User...</div>`;

        try {
            const users = await listSuperadmins();
            saState.users = users;

            content.innerHTML = `
                <div class="pd-view">
                    <div class="pd-view-header">
                        <div>
                            <h2 class="pd-view-title">👤 Kelola User</h2>
                            <p class="pd-view-desc">Total ${saState.users.length} akun User platform</p>
                        </div>
                        <button class="pd-add-company-btn" id="pd-add-superadmin">➕ Tambah User</button>
                    </div>
                    <div class="pd-mgmt-table-wrapper" id="pd-user-table-area" style="display:none">
                        <table class="pd-mgmt-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${saState.users.map(u => `
                                    <tr>
                                        <td><strong>${esc(u.username)}</strong></td>
                                        <td>${esc(u.name)}</td>
                                        <td>${esc(u.email || "-")}</td>
                                        <td>${u.active !== false ? '<span class="pd-status-active">Aktif</span>' : '<span class="pd-status-inactive">Nonaktif</span>'}</td>
                                        <td>
                                            <div class="pd-mgmt-actions">
                                                <button class="pd-action-btn pd-action-edit" data-action="sa-edit" data-id="${u._id}" data-username="${esc(u.username)}" title="Edit User">✏️ Edit</button>
                                                <button class="pd-action-btn pd-action-disable" data-action="sa-delete" data-id="${u._id}" data-username="${esc(u.username)}" title="Hapus User">🗑️ Hapus</button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join("")}
                                ${saState.users.length === 0 ? '<tr><td colspan="5" class="pd-empty">Belum ada User</td></tr>' : ""}
                            </tbody>
                        </table>
                    </div>
                    <div id="pd-user-cards-area" class="pd-card-view"></div>
                </div>
            `;

            content.querySelectorAll("[data-action='sa-edit']").forEach(btn => {
                btn.addEventListener("click", () => openEditSuperAdmin(btn.dataset.id));
            });
            content.querySelectorAll("[data-action='sa-delete']").forEach(btn => {
                btn.addEventListener("click", () => deleteSuperAdminAction(btn.dataset.id, btn.dataset.username));
            });
            document.getElementById("pd-add-superadmin")?.addEventListener("click", openAddSuperAdmin);
            renderUserCards();

        } catch (err) {
            console.error("[PlatformDashboard] Failed:", err);
            content.innerHTML = `<div class="pd-empty">Gagal memuat: ${err.message}</div>`;
        } finally { state.loading = false; }
    }

    // ══════════════════════════════════════════════
    //  Actions: Super Admin CRUD
    // ══════════════════════════════════════════════

    function openAddSuperAdmin() {
        const footerHTML = `
            <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">Tambah</button>
        `;

        const modal = Modal({
            open: true, title: "➕ Tambah User",
            content: `
                <div class="pd-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Username <span class="required">*</span></label>
                            <input type="text" id="f-username" placeholder="superadmin2" required />
                        </div>
                        <div class="form-group">
                            <label>Password <span class="required">*</span></label>
                            <input type="password" id="f-password" placeholder="password" required />
                        </div>
                        <div class="form-group full-width">
                            <label>Nama Lengkap <span class="required">*</span></label>
                            <input type="text" id="f-name" placeholder="Nama User" required />
                        </div>
                        <div class="form-group full-width">
                            <label>Email</label>
                            <input type="email" id="f-email" placeholder="superadmin@smart.id" />
                        </div>
                    </div>
                </div>
            `, footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", async () => {
            const username = document.getElementById("f-username")?.value?.trim();
            const password = document.getElementById("f-password")?.value;
            const name = document.getElementById("f-name")?.value?.trim();
            const email = document.getElementById("f-email")?.value?.trim();

            if (!username) { showToast("warning", "Username wajib diisi"); return; }
            if (!password) { showToast("warning", "Password wajib diisi"); return; }
            if (!name) { showToast("warning", "Nama wajib diisi"); return; }

            try {
                await createSuperadmin({ username, password, name, email: email || "", active: true });
                showToast("success", `User "${name}" berhasil ditambahkan`);
                removeModal();
                showSuperAdminManagement();
            } catch (err) {
                showToast("danger", "Gagal: " + err.message);
            }
        });
        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    async function openEditSuperAdmin(id) {
        try {
            const users = await listSuperadmins();
            const user = users.find(u => u._id === id);
            if (!user) { showToast("danger", "User tidak ditemukan"); return; }

            const footerHTML = `
                <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
                <button class="smart-btn smart-btn-primary" id="f-submit">Simpan</button>
            `;

            const modal = Modal({
                open: true, title: `✏️ Edit User — ${user.username}`,
                content: `
                    <div class="pd-form">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Username</label>
                                <input type="text" id="f-username" value="${esc(user.username)}" readonly style="background:#f1f5f9" />
                            </div>
                            <div class="form-group">
                                <label>Password Baru</label>
                                <input type="password" id="f-password" placeholder="Kosongkan jika tidak diubah" />
                            </div>
                            <div class="form-group full-width">
                                <label>Nama Lengkap <span class="required">*</span></label>
                                <input type="text" id="f-name" value="${esc(user.name)}" required />
                            </div>
                            <div class="form-group full-width">
                                <label>Email</label>
                                <input type="email" id="f-email" value="${esc(user.email || "")}" />
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="f-active">
                                    <option value="true" ${user.active !== false ? "selected" : ""}>Aktif</option>
                                    <option value="false" ${user.active === false ? "selected" : ""}>Nonaktif</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `, footer: footerHTML, closable: true, onClose: removeModal
            });
            document.body.appendChild(modal);

            document.getElementById("f-cancel")?.addEventListener("click", removeModal);
            document.getElementById("f-submit")?.addEventListener("click", async () => {
                const name = document.getElementById("f-name")?.value?.trim();
                if (!name) { showToast("warning", "Nama wajib diisi"); return; }

                const data = {
                    name,
                    email: document.getElementById("f-email")?.value?.trim() || "",
                    active: document.getElementById("f-active")?.value === "true"
                };
                const password = document.getElementById("f-password")?.value;
                if (password) data.password = password;
                try {
                    await updateSuperadmin(id, data);
                    showToast("success", `User "${user.username}" berhasil diperbarui`);
                    removeModal();
                    showSuperAdminManagement();
                } catch (err) {
                    showToast("danger", "Gagal: " + err.message);
                }
            });
            modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
        }
    }

    async function deleteSuperAdminAction(id, username) {
        const footerHTML = `
            <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-danger" id="f-confirm">Ya, Hapus</button>
        `;

        const modal = Modal({
            open: true, title: "🗑️ Konfirmasi Hapus",
            content: `<p>Hapus User <strong>${esc(username)}</strong>?</p>
                <p style="font-size:0.85rem;color:#64748b">Akun ini tidak dapat lagi login ke platform. Tindakan ini tidak dapat dibatalkan.</p>`,
            footer: footerHTML, closable: true, onClose: removeModal
        });
        document.body.appendChild(modal);

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-confirm")?.addEventListener("click", async () => {
            const deleted = await deleteSuperadmin(id);
            if (deleted) {
                showToast("success", `User "${username}" berhasil dihapus`);
            } else {
                showToast("danger", "Gagal menghapus User");
            }
            removeModal();
            showSuperAdminManagement();
        });
        modal.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    // ══════════════════════════════════════════════
    //  View: Settings (Logo Upload)
    // ══════════════════════════════════════════════

    // ── Platform Logo Storage ──

    function getStoredLogo() {
        try { return localStorage.getItem("smart_superadmin_logo"); } catch { return null; }
    }

    function setStoredLogo(dataUrl) {
        try {
            if (dataUrl) {
                localStorage.setItem("smart_superadmin_logo", dataUrl);
            } else {
                localStorage.removeItem("smart_superadmin_logo");
            }
        } catch { /* quota exceeded or unavailable */ }
    }

    // ── App Logo Storage ──

    function getAppLogosCache() {
        try {
            const raw = localStorage.getItem("smart_app_logos");
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function saveAppLogosCache(logos) {
        try {
            localStorage.setItem("smart_app_logos", JSON.stringify(logos));
        } catch { /* quota exceeded */ }
    }

    function getAppLogo(slug) {
        const cache = getAppLogosCache();
        return cache[slug] || null;
    }

    function setAppLogo(slug, dataUrl) {
        const cache = getAppLogosCache();
        cache[slug] = dataUrl;
        saveAppLogosCache(cache);
    }

    function removeAppLogo(slug) {
        const cache = getAppLogosCache();
        delete cache[slug];
        saveAppLogosCache(cache);
    }

    function setFavicon(url) {
        if (!url) return;
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = url;
    }

    function applyStoredLogo() {
        const stored = getStoredLogo();
        if (stored) {
            // Update header logo
            const logoContainer = document.querySelector(".pd-logo");
            if (logoContainer) {
                logoContainer.innerHTML = `<img src="${stored}" alt="Logo" class="pd-logo-img" />`;
            }
            // Set favicon
            setFavicon(stored);
        }
    }

    function showSettingsView() {
        state.view = "settings";
        const content = document.getElementById("pd-content");
        if (!content) return;

        const currentLogo = getStoredLogo();
        const previewHtml = currentLogo
            ? `<img src="${encodeURI(currentLogo)}" class="pd-settings-logo-preview-img" />`
            : `<div class="pd-settings-logo-placeholder">🚀</div>`;

        content.innerHTML = `
            <div class="pd-view">
                <h2 class="pd-view-title">⚙️ Pengaturan Platform</h2>
                <p class="pd-view-desc">Atur logo dan tampilan Super Admin Dashboard</p>

                <div class="pd-settings-card">
                    <div class="pd-settings-card-title">Logo Platform</div>
                    <p class="pd-settings-card-desc">Logo ini akan ditampilkan di header dashboard, halaman login Super Admin, dan favicon tab browser.</p>

                    <div class="pd-settings-logo-area">
                        <div class="pd-settings-logo-preview" id="pd-settings-logo-preview">
                            ${previewHtml}
                        </div>
                        <div class="pd-settings-logo-controls">
                            <button class="pd-btn-upload" id="pd-btn-logo-upload">📁 Pilih Logo</button>
                            <input type="file" id="pd-logo-file-input" accept="image/*" style="display:none" />
                            <span class="pd-settings-file-name" id="pd-settings-file-name">${currentLogo ? 'Logo tersimpan' : 'Belum ada logo'}</span>
                            ${currentLogo ? '<button class="pd-btn-remove" id="pd-btn-logo-remove">🗑️ Hapus Logo</button>' : ''}
                        </div>
                    </div>

                    <div class="pd-settings-info">
                        <strong>Catatan:</strong> Logo ini bersifat permanen untuk Super Admin dan tidak terpengaruh oleh perubahan logo perusahaan.
                    </div>
                </div>
            </div>
        `;

        // Upload handler
        const uploadBtn = document.getElementById("pd-btn-logo-upload");
        const fileInput = document.getElementById("pd-logo-file-input");
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                // Validate file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showToast("danger", "Ukuran file maksimal 2MB");
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target.result;
                    // Save to localStorage (same-domain)
                    setStoredLogo(dataUrl);

                    // Sync to server via API (cross-domain access)
                    showToast("info", "Menyimpan logo ke server...");
                    try {
                        const res = await fetch("/api/platform/logo", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ logo: dataUrl })
                        });
                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || "Server error");
                        }
                        console.log("[PlatformDashboard] Logo saved to server");
                    } catch (e) {
                        console.error("[PlatformDashboard] Server sync failed:", e);
                    }

                    // Also call DI callback if provided
                    if (typeof onLogoUpload === "function") {
                        onLogoUpload(dataUrl).catch(e => console.warn("[PlatformDashboard] Callback error:", e));
                    }

                    // Update preview
                    const preview = document.getElementById("pd-settings-logo-preview");
                    if (preview) {
                        preview.innerHTML = `<img src="${encodeURI(dataUrl)}" class="pd-settings-logo-preview-img" />`;
                    }

                    // Update file name
                    const fileName = document.getElementById("pd-settings-file-name");
                    if (fileName) fileName.textContent = file.name;

                    // Apply to header and favicon
                    applyStoredLogo();

                    showToast("success", "Logo berhasil disimpan dan disinkronkan ke server");

                    // Reload settings view to show remove button
                    setTimeout(showSettingsView, 1500);
                };
                reader.readAsDataURL(file);
            });
        }

        // Remove handler
        const removeBtn = document.getElementById("pd-btn-logo-remove");
        if (removeBtn) {
            removeBtn.addEventListener("click", () => {
                setStoredLogo(null);
                // Sync removal to server
                if (typeof onLogoRemove === "function") {
                    onLogoRemove().catch(e => console.warn("[PlatformDashboard] Server sync failed:", e));
                }
                showSettingsView();
                // Reset header to default
                const logoContainer = document.querySelector(".pd-logo");
                if (logoContainer) logoContainer.innerHTML = '🚀';
                // Reset favicon (remove the link element)
                const link = document.querySelector("link[rel*='icon']");
                if (link) link.remove();
                showToast("info", "Logo dihapus, menggunakan default");
            });
        }
    }

    // ══════════════════════════════════════════════
    //  Utilities
    // ══════════════════════════════════════════════

    function showToast(variant, message) {
        let container = document.getElementById("pd-toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "pd-toast-container";
            container.style.cssText = "position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;max-width:400px;";
            document.body.appendChild(container);
        }
        const toast = Toast({ variant, message, onDismiss: () => toast.remove() });
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3500);
    }

    function removeModal() {
        const overlay = document.querySelector(".smart-modal-overlay");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    return { platformDashboard, initPlatformDashboard };
}

function esc(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getStyles() {
    return `
.platform-dashboard {
    min-height: 100vh;
    background: #f1f5f9;
    font-family: var(--font-sans, 'Inter', sans-serif);
    color: #1e293b;
}
.pd-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.pd-user-info { display: flex; align-items: center; gap: 1rem; }
.pd-user-actions { display: flex; align-items: center; gap: 0.5rem; }
.pd-brand { display: flex; align-items: center; gap: 1rem; }
.pd-logo { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.25); }
.pd-logo-img { width: 100%; height: 100%; object-fit: cover; }
.pd-brand h1 { margin: 0; font-size: 1.4rem; font-weight: 700; }
.pd-subtitle { margin: 0; font-size: 0.8rem; color: #94a3b8; }
.pd-user-info { display: flex; align-items: center; gap: 1rem; font-size: 0.9rem; }
.pd-user-badge {
    padding: 2px 10px; border-radius: 12px;
    background: #dc2626; color: #fff;
    font-size: 0.7rem; font-weight: 600; letter-spacing: 0.5px;
}
.pd-logout-btn {
    padding: 6px 14px; border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px; background: transparent; color: #fff;
    cursor: pointer; font-size: 0.8rem; transition: background 0.15s;
}
.pd-logout-btn:hover { background: rgba(255,255,255,0.1); }
.pd-nav {
    display: flex; gap: 0; padding: 0 2rem;
    background: #fff; border-bottom: 1px solid #e2e8f0;
}
.pd-nav-btn {
    padding: 0.75rem 1.5rem; border: none; background: transparent;
    cursor: pointer; font-size: 0.9rem; font-weight: 500;
    color: #64748b; border-bottom: 2px solid transparent; transition: all 0.15s;
}
.pd-nav-btn:hover { color: #1e293b; }
.pd-nav-btn.active { color: #4f46e5; border-bottom-color: #4f46e5; }
.pd-content { padding: 2rem; max-width: 1200px; margin: 0 auto; }
.pd-view-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.25rem; }
.pd-view-app-logo { width: 28px; height: 28px; border-radius: 4px; vertical-align: middle; margin-right: 0.4rem; object-fit: contain; }
.pd-view-desc { font-size: 0.9rem; color: #64748b; margin: 0 0 1.5rem; }
.pd-view-back { margin-bottom: 1rem; }
.pd-back-btn {
    padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 6px;
    background: #fff; cursor: pointer; font-size: 0.85rem; margin-bottom: 1rem; transition: background 0.15s;
}
.pd-back-btn:hover { background: #f8fafc; }
.pd-loading { text-align: center; padding: 4rem; color: #94a3b8; }
.pd-empty { text-align: center; padding: 3rem; color: #94a3b8; }
.pd-view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.pd-apps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
.pd-app-card {
    background: #fff; border-radius: 12px; padding: 1.5rem;
    border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.2s; text-align: center; position: relative;
}
.pd-app-card:hover { border-color: #4f46e5; box-shadow: 0 4px 16px rgba(79,70,229,0.1); transform: translateY(-2px); }.pd-app-logo-section {
    position: relative; margin: 0 auto 0.75rem;
    display: flex; align-items: center; justify-content: center;
}
.pd-app-icon { font-size: 2rem; line-height: 1; }
.pd-app-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.pd-app-logo-overlay {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px;
    background: rgba(0,0,0,0.55); opacity: 0; transition: opacity 0.2s;
    cursor: pointer; border-radius: 50%;
}
.pd-app-logo-overlay:hover { opacity: 1; }
@media (hover: none) { .pd-app-logo-overlay { opacity: 0.4; background: rgba(0,0,0,0.45); } }
.pd-app-logo-overlay .pd-app-logo-input { display: none; }
.pd-app-logo-overlay-icon { font-size: 1.3rem; }
.pd-app-logo-overlay-text { font-size: 0.6rem; color: #fff; font-weight: 500; white-space: nowrap; }

.pd-app-name { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.4rem; }
.pd-app-desc { font-size: 0.8rem; color: #64748b; line-height: 1.4; margin-bottom: 1rem; }
.pd-app-badge { display: inline-block; padding: 3px 12px; border-radius: 12px; background: #eef2ff; color: #4f46e5; font-weight: 500; font-size: 0.75rem; }
.pd-companies-list { display: flex; flex-direction: column; gap: 0.75rem; }
.pd-company-card {
    display: flex; align-items: center; gap: 1rem;
    background: #fff; border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid #e2e8f0; transition: border-color 0.15s;
}
.pd-company-card:hover { border-color: #c7d2fe; }
.pd-company-logo { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
.pd-company-logo img { width: 100%; height: 100%; object-fit: cover; }
.pd-company-initial { font-size: 1.1rem; font-weight: 700; color: #4f46e5; }
.pd-company-info { flex: 1; min-width: 0; }
.pd-company-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.2rem; }
.pd-company-meta { display: flex; gap: 0.75rem; font-size: 0.78rem; color: #94a3b8; }
.pd-company-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.pd-action-sm {
    padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px;
    background: #fff; cursor: pointer; font-size: 0.75rem; white-space: nowrap; transition: all 0.15s;
}
.pd-action-sm:hover { background: #f8fafc; border-color: #4f46e5; color: #4f46e5; }
.pd-mgmt-table-wrapper { background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow-x: auto; }
.pd-mgmt-table { width: 100%; border-collapse: collapse; }
.pd-mgmt-table th {
    text-align: left; padding: 0.75rem 1rem; font-size: 0.78rem; font-weight: 600;
    color: #64748b; border-bottom: 2px solid #e2e8f0; background: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;
}
.pd-mgmt-table td { padding: 0.75rem 1rem; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.pd-mgmt-table tr:hover td { background: #f8fafc; }
.pd-mgmt-company { display: flex; align-items: center; gap: 0.75rem; }
.pd-mgmt-logo { width: 36px; height: 36px; border-radius: 6px; overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pd-mgmt-logo img { width: 100%; height: 100%; object-fit: cover; }
.pd-mgmt-initial { font-size: 1rem; font-weight: 700; color: #4f46e5; }
.pd-mgmt-name { font-weight: 500; }
.pd-mgmt-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.pd-action-btn {
    padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 4px;
    background: #fff; cursor: pointer; font-size: 0.72rem; white-space: nowrap; transition: all 0.15s;
}
.pd-action-btn:hover { border-color: #4f46e5; color: #4f46e5; }
.pd-action-btn.pd-action-loginas:hover { border-color: #dc2626; color: #dc2626; }
.pd-action-btn.pd-action-disable:hover { border-color: #dc2626; color: #dc2626; }
.pd-add-company-btn { padding: 8px 16px; border: none; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: background 0.15s; }
.pd-add-company-btn:hover { background: #4338ca; }
.pd-badge-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: #eef2ff; color: #4f46e5; }
.pd-status-active { color: #16a34a; font-weight: 500; font-size: 0.8rem; }
.pd-status-inactive { color: #dc2626; font-weight: 500; font-size: 0.8rem; }
.pd-mgmt-apps { display: flex; gap: 2px; align-items: center; }
.pd-app-badge-sm { font-size: 0.85rem; line-height: 1; }
.pd-app-badge-sm.disabled { opacity: 0.3; font-size: 0.7rem; }
.pd-app-badge-sm.more { font-size: 0.65rem; color: #94a3b8; margin-left: 2px; }
.pd-apps-selector { display: flex; flex-direction: column; gap: 0.5rem; }
.pd-app-select-item {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
    border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.15s;
}
.pd-app-select-item:hover { border-color: #4f46e5; background: #f8fafc; }
.pd-app-select-icon { font-size: 1.5rem; }
.pd-app-select-name { font-weight: 600; font-size: 0.9rem; }
.pd-app-select-desc { font-size: 0.78rem; color: #94a3b8; }
.pd-app-select-action { margin-left: auto; font-size: 0.78rem; color: #4f46e5; font-weight: 500; }
.pd-profile { display: flex; gap: 1.5rem; align-items: flex-start; }
.pd-profile-logo { width: 80px; height: 80px; border-radius: 12px; overflow: hidden; background: #f1f5f9; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.pd-profile-logo img { width: 100%; height: 100%; object-fit: cover; }
.pd-profile-initial { font-size: 2rem; font-weight: 700; color: #4f46e5; }
.pd-profile-details { flex: 1; }
.pd-profile-row { padding: 0.4rem 0; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; }
.pd-profile-row:last-child { border-bottom: none; }
.pd-subs-list { display: flex; flex-direction: column; gap: 0.5rem; }
.pd-subs-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; transition: all 0.15s; }
.pd-subs-item.enabled { border-color: #bbf7d0; background: #f0fdf4; }
.pd-subs-icon { font-size: 1.5rem; }
.pd-subs-info { flex: 1; }
.pd-subs-name { font-weight: 600; font-size: 0.9rem; }
.pd-subs-desc { font-size: 0.78rem; color: #94a3b8; }
.pd-subs-toggle { position: relative; display: inline-block; width: 40px; height: 22px; }
.pd-subs-toggle input { opacity: 0; width: 0; height: 0; }
.pd-subs-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; transition: 0.3s; border-radius: 22px; }
.pd-subs-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #fff; transition: 0.3s; border-radius: 50%; }
.pd-subs-toggle input:checked + .pd-subs-slider { background-color: #16a34a; }
.pd-subs-toggle input:checked + .pd-subs-slider:before { transform: translateX(18px); }
.pd-form .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.pd-form .form-grid .full-width { grid-column: 1 / -1; }
.pd-form .form-group { margin-bottom: 0.25rem; }
.pd-form .form-group label { display: block; font-size: 0.82rem; font-weight: 500; margin-bottom: 0.3rem; color: #374151; }
.pd-form .form-group input, .pd-form .form-group textarea, .pd-form .form-group select {
    width: 100%; padding: 0.45rem 0.7rem; border: 1px solid #d1d5db; border-radius: 6px;
    font-size: 0.85rem; outline: none; box-sizing: border-box; transition: border-color 0.2s;
}
.pd-form .form-group input:focus, .pd-form .form-group textarea:focus, .pd-form .form-group select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
.pd-form .form-group textarea { resize: vertical; min-height: 54px; }
.pd-form .required { color: #dc2626; }
.pd-form .hint { font-weight:400; font-size:0.75rem; color:#94a3b8; margin-left:4px; }
.pd-admin-section-title { grid-column:1/-1; font-size:0.9rem; font-weight:600; color:#1e293b; margin:0.5rem 0 0.25rem; padding:0.5rem 0 0.3rem; border-top:1px solid #e2e8f0; }

/* ── Wilayah Section (BUMDes/Pemdes) ── */
.pd-wilayah-section { grid-column:1/-1; padding:14px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; margin-top:4px; }
.pd-wilayah-title { font-size:0.82rem; font-weight:700; color:#166534; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.pd-wilayah-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
@media (max-width:600px) { .pd-wilayah-grid { grid-template-columns:1fr; } }
.pd-wilayah-section .form-group label { font-size:0.78rem; color:#166534; }
.pd-wilayah-section .form-group select { background:#fff; border-color:#86efac; }
.pd-wilayah-section .form-group select:focus { border-color:#22c55e; box-shadow:0 0 0 3px rgba(34,197,94,0.12); }
.pd-wilayah-section .form-group select:disabled { opacity:0.5; cursor:not-allowed; }
.pd-app-checkbox-group { display:flex; flex-wrap:wrap; gap:6px; max-height:200px; overflow-y:auto; padding:4px 0; }
.pd-app-checkbox-item {
    display:flex; align-items:center; gap:6px; padding:6px 10px;
    border:1px solid #e2e8f0; border-radius:8px; cursor:pointer;
    transition:all 0.15s; user-select:none; flex:0 0 calc(50% - 3px); min-width:0;
    background:#fff; box-sizing:border-box;
}
.pd-app-checkbox-item:hover { border-color:#4f46e5; background:#f8fafc; }
.pd-app-checkbox-item.checked { border-color:#4f46e5; background:#eef2ff; }
.pd-app-checkbox-item input { display:none; }
.pd-app-checkbox-icon { font-size:1.1rem; flex-shrink:0; }
.pd-app-checkbox-name { font-size:0.82rem; font-weight:500; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pd-app-checkbox-desc { display:none; }

/* ── Settings View ── */
.pd-settings-card {
    background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;
    padding: 1.5rem; margin-bottom: 1rem; max-width: 600px;
}
.pd-settings-card-title { font-size: 1rem; font-weight: 600; color: #1e293b; margin-bottom: 0.35rem; }
.pd-settings-card-desc { font-size: 0.82rem; color: #64748b; margin: 0 0 1.25rem; }
.pd-settings-logo-area { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
.pd-settings-logo-preview {
    width: 100px; height: 100px; border-radius: 50%;
    border: 2px dashed #d1d5db; display: flex; align-items: center;
    justify-content: center; overflow: hidden; background: #f8fafc; flex-shrink: 0;
}
.pd-settings-logo-preview-img { width: 100%; height: 100%; object-fit: cover; }
.pd-settings-logo-placeholder { font-size: 2.5rem; opacity: 0.5; }
.pd-settings-logo-controls { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.pd-btn-upload {
    padding: 8px 16px; border: none; border-radius: 8px;
    background: #4f46e5; color: #fff; cursor: pointer; font-size: 0.85rem; font-weight: 500;
    transition: background 0.15s;
}
.pd-btn-upload:hover { background: #4338ca; }
.pd-btn-remove {
    padding: 6px 12px; border: 1px solid #fecaca; border-radius: 6px;
    background: #fef2f2; color: #dc2626; cursor: pointer; font-size: 0.8rem;
    transition: background 0.15s;
}
.pd-btn-remove:hover { background: #fee2e2; }
.pd-settings-file-name { font-size: 0.8rem; color: #94a3b8; }
.pd-settings-info {
    margin-top: 1rem; padding: 0.75rem 1rem;
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
    font-size: 0.8rem; color: #92400e;
}
@media (max-width: 640px) {
    .pd-app-checkbox-item { flex:0 0 100%; }
}
@media (max-width: 768px) {
    .pd-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
    .pd-user-info { width: 100%; display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; }
    .pd-user-detail { display: flex; align-items: center; gap: 0.5rem; }
    .pd-apps-grid { grid-template-columns: 1fr; }
    .pd-company-card { flex-wrap: wrap; }
    .pd-mgmt-actions { flex-direction: column; }
    .pd-view-header { flex-direction: column; gap: 0.75rem; }
    .pd-form .form-grid { grid-template-columns: 1fr; }
    .pd-profile { flex-direction: column; align-items: center; }
}

/* ═══════════════════════════════════
   MOBILE BOTTOM NAV — Android Native
   ═══════════════════════════════════ */

@media (min-width: 769px) {
    .pd-bottom-nav { display: none; }
}

@media (max-width: 768px) {
    .pd-nav { display: none; }
    .pd-bottom-nav {
        display: flex; position: fixed; bottom: 0; left: 0; right: 0;
        background: #fff; border-top: 1px solid #e2e8f0;
        box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
        justify-content: space-around; align-items: center;
        padding: 0.25rem 0; z-index: 100;
        padding-bottom: env(safe-area-inset-bottom, 0.25rem);
    }
    .pd-bottom-nav-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 0.35rem 0; border: none; background: transparent;
        cursor: pointer; font-size: 0.65rem; color: #94a3b8;
        transition: color 0.15s;
    }
    .pd-bottom-nav-btn .pdb-icon { font-size: 1.3rem; line-height: 1; }
    .pd-bottom-nav-btn .pdb-label { font-size: 0.6rem; font-weight: 500; }
    .pd-bottom-nav-btn.active { color: #4f46e5; }
    .pd-header { padding: 0.6rem 1rem; }
    .pd-header h1 { font-size: 1.1rem; }
    .pd-header .pd-subtitle { display: none; }
    .pd-user-badge { display: none; }
    .pd-content { padding: 1rem 0.75rem 5rem; }
    .pd-view-title { font-size: 1.15rem; }
    .pd-view-desc { font-size: 0.8rem; margin-bottom: 1rem; }
    .pd-apps-grid { grid-template-columns: 1fr; }
    .pd-app-card { padding: 1rem; }
    .pd-app-logo-section { width: 64px; height: 64px; }
}


`;
}
