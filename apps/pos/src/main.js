import "./css/main.css";

import {
    AppConfig,
    Permission,
    Auth,
    framework,
    impersonation,
    audit,
    SMART,
    filterMenusByTransactionTypes
} from "@smart/core";

import { loadUI } from "@smart/ui";
import { loadWorkspace } from "@smart/ui/workspaces/engine";

import { AppShell } from "@smart/ui/layouts";

import menus from "./config/menu";
import { navigate } from "./router";
import { configureKasirShell, requestKasirLogout } from "./pages/pos";
import { LoginPage, initLoginPage } from "./pages/login";
import { ResetPasswordPage, initResetPasswordPage } from "./pages/reset-password";
import { RegisterPage, initRegisterPage } from "./pages/register";
// F&B Customer Ordering V1 — halaman customer /m/:identifier (TANPA login)
import { CustomerMenuPage, initCustomerMenuPage } from "./pages/customer-menu";
import { getCompanyByCode } from "./data";
import {
    configureAuthTokens,
    setAuthTokens,
    clearAuthTokens,
    getAccessToken,
    getRefreshToken,
    refreshAccessToken,
    apiCall
} from "./data/api.js";
import { getCompanyConfig, saveCompanyConfig, refreshCompanyConfig, filterMenusByLokasi, lisensiLabel } from "./config/company-config.js";


/**
 * SMART Kasir — Branding override (Golden Rules 3 & 10).
 *
 * Identitas aplikasi di-override LOKAL di apps/pos tanpa mengubah framework
 * bersama (@smart/core Institution tetap milik SMART Inventory). Workspace
 * "pos" terdaftar additive di @smart/ui (packages/smart-ui/src/workspaces).
 * URL tetap pos.e-profit.id (rebranding saja).
 */
const POS_INSTITUTION = {
    id: "PT-001",
    name: "SMART Kasir",
    type: "pos",
    workspace: "pos"
};

function currentInstitution() {
    return { ...POS_INSTITUTION };
}

/**
 * SP-029 M3-FIX — Role kasir = halaman kasir standalone (mockup kasir.html),
 * TANPA AppShell admin (sidebar + topbar). Deteksi via role user.
 * @returns {boolean}
 */
function isKasirRole() {
    try {
        const user = Auth.user();
        if (!user) return false;
        return String(user.role || "").toLowerCase() === "kasir";
    } catch {
        return false;
    }
}

/**
 * Sync permission dari server (dipakai renderApp & boot kasir).
 * SP-027 PRE-M5 round 2: authorizedFetch via apiCall (bukan plain fetch).
 */
async function syncPermissions() {
    try {
        const rolesData = await apiCall("GET", "/permissions/roles?page=1&limit=999");
        const roles = rolesData?.data || rolesData;
        if (Array.isArray(roles) && roles.length > 0) {
            Permission.loadPermissions(roles);
        } else {
            await Permission.syncFromServer();
        }
    } catch (err) {
        console.warn("[App] Permission sync gagal, fallback hardcoded:", err?.message);
        await Permission.syncFromServer();
    }
}

/**
 * Set konteks company (dipakai renderApp & renderKasirApp).
 * Impersonasi tidak menimpa — konteks sudah di-set oleh alur smart_imp.
 */
function ensureCompanyContext() {
    if (impersonation.isImpersonating()) return;
    const userCompanyCode = Auth.user()?.institution || currentInstitution().id;
    SMART.Company.set(userCompanyCode, currentInstitution().name);
}

/**
 * Render halaman kasir FULLSCREEN (role kasir) — menggantikan AppShell.
 * Halaman kasir punya header + sidebar-nya sendiri (mockup kasir.html).
 */
function renderKasirApp() {
    ensureCompanyContext();
    // Fallback offline: bila sync permission gagal dan role kasir belum punya
    // pos.kasir.use, berikan minimal supaya layar kasir tetap terbuka.
    if (!Permission.can("pos.kasir.use")) {
        try {
            Permission.loadPermissions([{
                name: "kasir",
                permissions: ["inventory.dashboard.view", "pos.kasir.use", "inventory.barang.read"]
            }]);
        } catch { /* ignore */ }
    }
    configureKasirShell({ fullscreen: true, onLogout: handleLogout });
    const app = document.querySelector("#app");
    if (!app) return;
    app.innerHTML = `<div id="content" class="pos-shell-host"></div>`;
    navigate("pos");
}

/**
 * Boot aplikasi setelah login/restore/impersonate/register:
 *   - role kasir → langsung halaman kasir standalone
 *   - selainnya   → AppShell normal (renderApp)
 */
async function bootApp() {
    await loadWorkspace(currentInstitution().workspace);
    // SP-029 M2-FIX — refresh konfigurasi company dari server (Company doc
    // ditulis Master Platform). Memastikan kuota gudang/kasir & banner selalu
    // fresh walau Company diubah dari Console saat aplikasi masih terbuka.
    // Admin/owner: await (kuota & banner dipakai renderApp). Kasir: non-blocking
    // (UI kasir tidak butuh menu/banner — fungsinya aman dipanggil tanpa await).
    const kasir = isKasirRole();
    if (kasir) refreshCompanyConfig();
    else await refreshCompanyConfig();
    if (kasir) {
        await syncPermissions();
        renderKasirApp();
        return;
    }
    configureKasirShell({ fullscreen: false, onLogout: null });
    await renderApp();
}


/**
 * SP-029 M2 — getCompanyConfig / saveCompanyConfig / filterMenusByLokasi
 * dipindah ke config/company-config.js (shared — dipakai halaman Gudang &
 * User untuk enforcement kuota). main.js meng-import dari sana.
 */


/**
 * Filter menus recursively:
 * - Items with children (groups) are kept if at least one child is allowed
 * - Items with permission are filtered by Permission.can()
 * - Empty groups (all children denied) are removed
 */
function filterMenus(items) {
    return items.reduce((acc, item) => {
        if (item.children && item.children.length > 0) {
            const filteredChildren = filterMenus(item.children);
            if (filteredChildren.length > 0) {
                acc.push({ ...item, children: filteredChildren });
            }
            return acc;
        }
        if (!item.permission || Permission.can(item.permission)) {
            acc.push(item);
        }
        return acc;
    }, []);
}

/**
 * Render menu sidebar (mirror dari Sidebar component) untuk refresh ringan
 * tanpa me-render ulang seluruh AppShell — dipakai saat permission berubah.
 */
function renderSidebarMenuItems(items) {
    return items.map(item => {
        if (item.children && item.children.length > 0) {
            const childrenJson = JSON.stringify(item.children.map(c => ({
                title: c.title,
                page: c.page || "",
                icon: c.icon || ""
            }))).replace(/"/g, "&quot;");
            return `
                <li class="sidebar-group" data-title="${item.title}" data-group="${item.title}" data-children='${childrenJson}'>
                    <details class="sidebar-group-details">
                        <summary class="sidebar-group-header">
                            <span class="sidebar-group-icon">${item.icon || ""}</span>
                            <span class="sidebar-group-title">${item.title}</span>
                            <span class="sidebar-toggle"></span>
                        </summary>
                        <ul class="sidebar-children">
                            ${renderSidebarMenuItems(item.children)}
                        </ul>
                    </details>
                </li>
            `;
        }
        return `
            <li class="sidebar-item" data-page="${item.page}" data-title="${item.title}">
                <span class="sidebar-item-icon">${item.icon || ""}</span>
                <span class="sidebar-item-title">${item.title}</span>
            </li>
        `;
    }).join("");
}

/**
 * Re-render hanya menu sidebar berdasarkan permission terbaru
 * (tanpa kehilangan halaman yang sedang dibuka).
 */
function refreshSidebarMenus() {
    const sidebarMenu = document.querySelector(".sidebar-menu");
    if (!sidebarMenu) return;
    // SP-029 M2 — filter lokasi juga diterapkan saat permission berubah
    // SP-029 POS V1 — filter capability (transactionTypes) juga diterapkan
    const cfg = getCompanyConfig();
    const allowedMenus = filterMenus(filterMenusByTransactionTypes(
        filterMenusByLokasi(menus, cfg.lokasiMode),
        cfg.transactionTypes
    ));
    sidebarMenu.innerHTML = renderSidebarMenuItems(allowedMenus);
}


/**
 * Render the application shell (for normal company users).
 */
async function renderApp() {
    // Sync dynamic permissions dari server SEBELUM render.
    // SP-027 PRE-M5 round 2: Permission.syncFromServer() (framework) memakai
    // plain fetch TANPA token → 401 sejak M3 mewajibkan otentikasi pada
    // /api/permissions/roles. Ganti dengan apiCall (authorizedFetch) lalu
    // loadPermissions; fallback hardcoded bila server tidak menjawab.
    await syncPermissions();

    const institution = currentInstitution();
    const isImpersonating = impersonation.isImpersonating();
    const impSession = impersonation.getSession();

    console.log("Institution :", institution.name);
    console.log("Role :", Permission.currentRole()?.name);
    if (isImpersonating) console.log("Impersonating:", impSession.companyName);

    // When impersonating, don't overwrite company context (already set by start())
    ensureCompanyContext();

    // Fetch company logo (untuk sidebar & favicon)
    let companyLogo = null;
    try {
        const companyCode = SMART.Session.get("company.code") || SMART.Company.getCode();
        if (companyCode) {
            const company = await getCompanyByCode(companyCode);
            if (company) {
                if (company.logo) {
                    companyLogo = company.logo;
                }
                // M3-FIX v27 — nama company dari Master Platform (Console
                // Administration → Companies), bukan branding aplikasi
                // (POS_INSTITUTION.name). Impersonasi tidak ditimpa — nama
                // sudah di-set dari payload smart_imp.
                if (!isImpersonating && (company.name || company.companyName)) {
                    SMART.Company.set(companyCode, company.name || company.companyName);
                }
            }
        }
    } catch (err) {
        console.warn("[App] Could not fetch company logo:", err);
    }

    // Fallback: gunakan logo superadmin (dari Pengaturan) jika company tidak punya logo
    if (!companyLogo) {
        try {
            const saLogo = localStorage.getItem("smart_superadmin_logo");
            if (saLogo) companyLogo = saLogo;
        } catch { /* localStorage unavailable */ }
    }

    // Favicon: ketika impersonating, pakai logo superadmin, BUKAN company logo
    let faviconLogo = companyLogo;
    if (isImpersonating) {
        try {
            const saLogo = localStorage.getItem("smart_superadmin_logo");
            if (saLogo) faviconLogo = saLogo;
        } catch { /* localStorage unavailable */ }
    }

    // Set favicon
    if (faviconLogo) setFavicon(faviconLogo);

    // SP-029 M2 — konfigurasi lokasi dari Master Platform:
    // single → sembunyikan Transfer Gudang & pemilihan gudang.
    // SP-029 POS V1 — capability (transactionTypes): menu dengan field
    // `capability` hanya tampil bila capability tsb diaktifkan perusahaan.
    const companyConfig = getCompanyConfig();
    const allowedMenus = filterMenus(filterMenusByTransactionTypes(
        filterMenusByLokasi(menus, companyConfig.lokasiMode),
        companyConfig.transactionTypes
    ));

    // Use impersonated company name for topbar title when impersonating
    const topbarTitle = isImpersonating && impSession
        ? impSession.companyName
        : (institution.name || "SMART");

    document.querySelector("#app").innerHTML =
        AppShell({
            appTitle: "Menu Utama",
            topbarTitle: topbarTitle,
            userName: Auth.user().name,
            menuItems: allowedMenus,
            onNavigate: handleNavigate,
            contentId: "content",
            logo: companyLogo,
            branding: null,
            impersonation: isImpersonating ? {
                companyName: impSession.companyName,
                userName: impSession.userName
            } : null,
            onExitImpersonation: isImpersonating ? exitImpersonation : null
        });

    // Add logout button to topbar
    const topbar = document.querySelector(".topbar");
    if (topbar) {
        const existingLogout = document.getElementById("logout-btn");
        if (!existingLogout) {
            const logoutBtn = document.createElement("button");
            logoutBtn.id = "logout-btn";
            // Icon logout = SVG panah keluar dari pintu (pola Feather "log-out" /
            // Flaticon 12635060). SVG dipakai karena simbol Unicode (⏻) tidak
            // dirender di sebagian perangkat; warna ikut currentColor (putih).
            logoutBtn.innerHTML = `<svg class="pos-logout-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Logout`;
            logoutBtn.style.cssText = `
                padding: 6px 14px;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                background: linear-gradient(to bottom, #064e3b, #059669);
                color: #fff;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 500;
                transition: all 0.15s;
            `;
            logoutBtn.addEventListener("mouseenter", () => {
                logoutBtn.style.background = "linear-gradient(to bottom, #047857, #10b981)";
            });
            logoutBtn.addEventListener("mouseleave", () => {
                logoutBtn.style.background = "linear-gradient(to bottom, #064e3b, #059669)";
            });
            logoutBtn.addEventListener("click", handleLogout);
            const topbarRight = document.querySelector(".topbar-right");
            if (topbarRight) {
                topbarRight.appendChild(logoutBtn);
            } else {
                topbar.appendChild(logoutBtn);
            }
        }
    }

    initSidebarToggle();
    initSidebarCollapse();
    initTheme();
    initGroupPopup();

    showEntitlementBanner();
    showCompanyConfigBanner();

    // F&B V1 — Role CHEF hanya punya permission kitchen: arahkan langsung ke
    // halaman Kitchen (dashboard butuh inventory.dashboard.view yang tidak
    // dimiliki chef — RBAC server-side juga menolak route lain).
    const userRole = String((Auth.user && Auth.user() && Auth.user().role) || "").toLowerCase();
    navigate(userRole === "chef" ? "kitchen" : "dashboard");
}


/**
 * Entitlement banner (SP-029 M6-FIX Task 1).
 *
 * Menampilkan peringatan di atas konten bila enforcement mode != off dan
 * entitlement aplikasi Inventory tidak dalam keadaan normal (grandfathered /
 * disabled). Status diambil dari response login/impersonate yang disimpan
 * sessionStorage oleh login module (field `entitlement`).
 */
function showEntitlementBanner() {
    let entitlement = null;
    try {
        entitlement = sessionStorage.getItem("smart_entitlement") ? JSON.parse(sessionStorage.getItem("smart_entitlement")) : null;
    } catch { /* ignore */ }
    if (!entitlement) return;

    const mode = entitlement.mode || "off";
    if (mode === "off") return;

    // Hanya tampilkan banner bila ada kondisi yang perlu diketahui.
    const showWarning = entitlement.grandfathered
        || entitlement.enabled === false
        || (entitlement.subscriptionStatus && ["SUSPENDED", "EXPIRED", "CANCELLED"].includes(entitlement.subscriptionStatus));
    if (!showWarning) return;

    const messages = [];
    if (entitlement.enabled === false && !entitlement.grandfathered) {
        messages.push("Akses aplikasi POS dinonaktifkan untuk perusahaan ini (subscription tidak aktif).");
    } else if (entitlement.grandfathered) {
        messages.push("Perusahaan ini memakai akses legacy (grandfathering) — belum ada subscription aktif di Billing Center.");
    }
    if (entitlement.subscriptionStatus && ["SUSPENDED", "EXPIRED", "CANCELLED"].includes(entitlement.subscriptionStatus)) {
        messages.push(`Status subscription: ${entitlement.subscriptionStatus}.`);
    }
    if (!messages.length) return;

    const contentEl = document.querySelector("#content");
    if (!contentEl) return;
    const banner = document.createElement("div");
    banner.className = "entitlement-banner";
    banner.innerHTML = `
        <span class="entitlement-banner-icon">⚠️</span>
        <span class="entitlement-banner-text">${messages.join(" ")}</span>
        <button class="entitlement-banner-close" title="Tutup">×</button>
    `;
    banner.style.cssText = `
        margin: 10px 16px 0;
        padding: 10px 14px;
        border-radius: 8px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #92400e;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
    `;
    const closeBtn = banner.querySelector(".entitlement-banner-close");
    closeBtn.style.cssText = `
        margin-left: auto;
        background: transparent;
        border: 0;
        font-size: 1rem;
        cursor: pointer;
        color: inherit;
        padding: 0 4px;
    `;
    closeBtn.addEventListener("click", () => banner.remove());
    contentEl.prepend(banner);
}


/**
 * SP-029 M2-FIX — Banner info konfigurasi perusahaan (dari Master Platform).
 *
 * Menampilkan Business Type, Mode Lokasi, Kuota Gudang/Kasir & Status Lisensi
 * di atas konten admin — bukti bahwa konfigurasi dari master.e-profit.id
 * terbaca & diterapkan di POS. Lisensi trial/expired diberi warna peringatan.
 */
function showCompanyConfigBanner() {
    const cfg = getCompanyConfig();
    if (!cfg || typeof cfg !== "object") return;

    const lokasiLabel = cfg.lokasiMode === "multi" ? "Multi Lokasi" : "Single Lokasi";
    const parts = [];
    if (cfg.businessType) parts.push(`🏢 ${cfg.businessType}`);
    parts.push(`📍 ${lokasiLabel}`);
    parts.push(`🏭 ${cfg.jumlahGudang} gudang`);
    parts.push(`👤 ${cfg.jumlahKasir} kasir`);
    parts.push(`💳 Lisensi: ${lisensiLabel(cfg.lisensiStatus)}`);

    const isWarning = cfg.lisensiStatus === "expired" || cfg.lisensiStatus === "trial";
    const contentEl = document.querySelector("#content");
    if (!contentEl) return;
    const banner = document.createElement("div");
    banner.className = "company-config-banner";
    banner.setAttribute("data-lisensi", cfg.lisensiStatus || "active");
    banner.innerHTML = `
        <span class="company-config-icon">⚙️</span>
        <span class="company-config-text">Konfigurasi dari Master Platform: ${parts.join(" · ")}</span>
        ${isWarning ? `<span class="company-config-warn">${cfg.lisensiStatus === "expired" ? "Lisensi telah berakhir!" : "Masa trial"}</span>` : ""}
        <button class="company-config-close" title="Tutup">×</button>
    `;
    banner.style.cssText = `
        margin: 10px 16px 0;
        padding: 9px 14px;
        border-radius: 8px;
        background: ${isWarning ? "#fef3c7" : "#ecfdf5"};
        border: 1px solid ${isWarning ? "#f59e0b" : "#a7f3d0"};
        color: ${isWarning ? "#92400e" : "#065f46"};
        font-size: 0.82rem;
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
        flex-wrap: wrap;
    `;
    const warnEl = banner.querySelector(".company-config-warn");
    if (warnEl) {
        warnEl.style.cssText = `font-weight:700; margin-left:auto;`;
    }
    const closeBtn = banner.querySelector(".company-config-close");
    closeBtn.style.cssText = `
        margin-left: auto;
        background: transparent;
        border: 0;
        font-size: 1rem;
        cursor: pointer;
        color: inherit;
        padding: 0 4px;
    `;
    closeBtn.addEventListener("click", () => banner.remove());
    contentEl.prepend(banner);
}


/**
 * Exit impersonation and return to SMART Console.
 *
 * Sejak SP-027 Phase 1, Platform Dashboard dipindah ke apps/console
 * (master.e-profit.id). Keluar dari impersonasi → kembali ke Console.
 * SP-027 M3: sesi impersonasi kini berbasis token nyata — revoke di server.
 */
function exitImpersonation() {
    const session = impersonation.getSession();
    if (session) {
        audit.logImpersonationEnd({
            superAdminId: session.superAdminId,
            superAdminName: session.superAdminName,
            companyId: session.companyId,
            application: session.application
        });
    }
    impersonation.end();
    SMART.Company.clear();
    clearAuthTokens();
    revokeSession();

    const consoleUrl = window.location.hostname === "master.e-profit.id" ? "/" : "https://master.e-profit.id/";
    window.location.href = consoleUrl;
}

/**
 * Revoke refresh token di server (fire-and-forget) — SP-027 M3.
 * Refresh token dikirim otomatis via httpOnly cookie (credentials: include);
 * body dipakai hanya sebagai fallback sesi lama.
 */
async function revokeSession() {
    try {
        const refreshToken = getRefreshToken();
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: refreshToken ? JSON.stringify({ refreshToken }) : "{}"
        });
    } catch (err) {
        console.warn("[App] Logout revoke gagal:", err);
    }
}


/**
 * Initialize responsive sidebar toggle.
 */
function initSidebarToggle() {
    const hamburger = document.getElementById("hamburger-btn");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (!hamburger || !sidebar) return;

    function openSidebar() {
        sidebar.classList.add("open");
        hamburger.classList.add("active");
        if (overlay) overlay.classList.add("visible");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        hamburger.classList.remove("active");
        if (overlay) overlay.classList.remove("visible");
        document.body.style.overflow = "";
    }

    hamburger.addEventListener("click", () => {
        if (sidebar.classList.contains("open")) closeSidebar();
        else openSidebar();
    });

    if (overlay) overlay.addEventListener("click", closeSidebar);

    document.addEventListener("click", (e) => {
        const pageItem = e.target.closest("[data-page]");
        if (pageItem && window.innerWidth <= 1024) {
            setTimeout(closeSidebar, 150);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 1024 && sidebar.classList.contains("open")) {
            closeSidebar();
        }
    });
}


/**
 * Initialize dark mode toggle.
 */
function initTheme() {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    const icon = btn.querySelector(".theme-toggle-icon");
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (icon) icon.textContent = "☀️";
    }
    btn.addEventListener("click", () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        if (isDark) {
            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("theme", "light");
            if (icon) icon.textContent = "🌙";
        } else {
            document.documentElement.setAttribute("data-theme", "dark");
            localStorage.setItem("theme", "dark");
            if (icon) icon.textContent = "☀️";
        }
    });
}


/**
 * Initialize collapsed sidebar group popup.
 */
function initGroupPopup() {
    const popup = document.getElementById("sidebar-popup");
    const popupTitle = popup?.querySelector(".sidebar-popup-title");
    const popupItems = popup?.querySelector(".sidebar-popup-items");
    if (!popup) return;

    let activeGroup = null;

    function hidePopup() {
        popup.classList.remove("visible");
        activeGroup = null;
    }

    function showPopup(groupEl, items, title) {
        const rect = groupEl.getBoundingClientRect();
        popup.style.left = "-9999px";
        popup.style.top = "-9999px";
        popup.classList.add("visible");
        const popupHeight = popup.offsetHeight;
        popup.classList.remove("visible");
        const iconCenterY = rect.top + rect.height / 2;
        let popupTop = iconCenterY - popupHeight / 2;
        popupTop = Math.max(10, Math.min(popupTop, window.innerHeight - popupHeight - 10));
        popup.style.left = (rect.right + 8) + "px";
        popup.style.top = popupTop + "px";
        const arrow = popup.querySelector(".sidebar-popup-arrow");
        if (arrow) {
            const arrowTop = iconCenterY - popupTop - 6;
            arrow.style.top = Math.max(8, Math.min(arrowTop, popupHeight - 14)) + "px";
        }
        if (popupTitle) popupTitle.textContent = title;
        if (popupItems) {
            popupItems.innerHTML = items.map(item => `
                <li class="sidebar-popup-item" data-page="${item.page}">
                    <span class="sidebar-popup-item-icon">${item.icon}</span>
                    <span>${item.title}</span>
                </li>
            `).join("");
        }
        popup.classList.add("visible");
        activeGroup = groupEl;
    }

    document.addEventListener("click", (e) => {
        const sidebar = document.querySelector(".sidebar");
        if (!sidebar || !sidebar.classList.contains("collapsed")) { hidePopup(); return; }
        if (window.innerWidth <= 1024) { hidePopup(); return; }
        const group = e.target.closest(".sidebar-group[data-children]");
        if (group) {
            e.preventDefault();
            e.stopPropagation();
            if (activeGroup === group) { hidePopup(); return; }
            try {
                const children = JSON.parse(group.dataset.children);
                const title = group.dataset.title || "";
                showPopup(group, children, title);
            } catch (err) { console.warn("[Popup] Invalid children data:", err); }
            return;
        }
        if (!e.target.closest("#sidebar-popup") && !e.target.closest(".sidebar-group[data-children]")) {
            hidePopup();
        }
    });

    document.addEventListener("click", (e) => {
        const pageItem = e.target.closest("[data-page]");
        if (pageItem) setTimeout(hidePopup, 50);
    });

    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
        /* global MutationObserver */
        const observer = new MutationObserver(() => {
            if (!sidebar.classList.contains("collapsed")) hidePopup();
        });
        observer.observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    }
}


/**
 * Initialize desktop sidebar collapse/expand toggle.
 */
function initSidebarCollapse() {
    const btn = document.getElementById("sidebar-collapse-btn");
    const sidebar = document.querySelector(".sidebar");
    if (!btn || !sidebar) return;
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
        sidebar.classList.add("collapsed");
        btn.querySelector(".collapse-icon").textContent = "▶";
        btn.querySelector(".collapse-label").textContent = "Lebarkan";
    }
    btn.addEventListener("click", () => {
        const isCollapsed = sidebar.classList.toggle("collapsed");
        localStorage.setItem("sidebar-collapsed", isCollapsed);
        const icon = btn.querySelector(".collapse-icon");
        const label = btn.querySelector(".collapse-label");
        if (isCollapsed) {
            icon.textContent = "▶";
            label.textContent = "Lebarkan";
        } else {
            icon.textContent = "◀";
            label.textContent = "Sembunyikan";
        }
    });
}


/**
 * Handle navigation - verify auth before routing.
 */
function handleNavigate(page) {
    if (!Auth.isLoggedIn()) {
        showLogin();
        return;
    }
    navigate(page);
}


/**
 * Show login page.
 */
/**
 * URL aset platform (logo, dll). Sejak SP-027 M2, aset platform dilayani
 * apps/console (master.e-profit.id) — endpoint /api/platform/* TIDAK ada di
 * server inventory. GET publik + CORS mengizinkan origin e-profit.id, jadi
 * fetch lintas-origin aman (tanpa kredensial).
 * @param {string} path Path API (mis. "/api/platform/logo")
 * @returns {string} URL absolut
 */
function platformUrl(path) {
    // Override dev/staging (pola sama dengan apps/console via window.__APP_URLS__)
    try {
        const override = window.__APP_URLS__?.console;
        if (override) {
            return `${String(override).replace(/\/?$/, "")}${path}`;
        }
    } catch { /* ignore */ }
    const isConsoleOrigin = window.location.hostname === "master.e-profit.id";
    return isConsoleOrigin ? path : `https://master.e-profit.id${path}`;
}

/**
 * Fetch dengan timeout (AbortController) — mencegah halaman login menggantung
 * saat salah satu endpoint logo/config lambat (SP-029 M6-FIX perf).
 * @param {string} url
 * @param {object} [options]
 * @param {number} [timeoutMs] Batas waktu default 5000ms
 * @returns {Promise<Response|null>} null saat gagal/timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Resolve logo halaman login dengan prioritas:
 * 1. stored superadmin logo (localStorage)
 * 2. app-specific logo (POS) dari Master Platform
 * 3. platform logo / company logo (fallback)
 * Semua fetch dibatasi timeout — aman dipanggil paralel.
 * @returns {Promise<string|null>}
 */
async function resolveLoginLogo() {
    try {
        const stored = localStorage.getItem("smart_superadmin_logo");
        if (stored) return stored;
    } catch { /* ignore */ }

    const resp = await fetchWithTimeout(platformUrl("/api/platform/app-logo/pos"));
    if (resp && resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data && data.logo) return data.logo;
    }

    return fetchCompanyLogo();
}

/**
 * Ambil Google OAuth Client ID dari server (public config, bukan secret).
 * Server adalah sumber kebenaran konfigurasi Google — sebelum hardening ini
 * client mengandalkan VITE_GOOGLE_CLIENT_ID yang tidak pernah ter-set saat
 * build, sehingga tombol "Masuk dengan Google" selalu error.
 * @returns {Promise<string>} Client ID atau string kosong
 */
async function fetchGoogleClientId() {
    const resp = await fetchWithTimeout("/api/auth/google/config");
    if (resp && resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data && data.clientId) return data.clientId;
    }
    return "";
}

/**
 * Show login page untuk regular user.
 * Logo menggunakan stored superadmin logo jika ada (permanen),
 * fallback ke company logo. Sidebar tetap pakai logo masing-masing company.
 */
async function showLogin() {
    // SP-029 M6-FIX — render form login SEGERA tanpa menunggu fetch lambat.
    // googleConfig dibaca login module saat tombol Google DIKLIK (bukan saat
    // init), jadi clientId aman diisi belakangan setelah fetch selesai.
    const googleConfig = {};
    document.querySelector("#app").innerHTML = LoginPage({});
    initLoginPage({
        onSuccess: async () => {
            // Normal user → boot app (role kasir = kasir standalone)
            await bootApp();
        },
        // onRegisterClick dipakai link "Daftar" & fallback Google (login module
        // membaca googleConfig.onRegisterClick || onRegisterClick).
        onRegisterClick: (prefill) => { (window.__showRegister || showRegister)(prefill); },
        googleConfig
    });

    // Resolve logo + Google client ID secara PARALEL (masing-masing dengan
    // timeout) — sebelumnya berurutan & tanpa timeout, sehingga halaman login
    // bisa menggantung beberapa menit saat salah satu endpoint lambat.
    const [logoUrl, clientId] = await Promise.all([
        resolveLoginLogo(),
        fetchGoogleClientId()
    ]);
    if (clientId) googleConfig.clientId = clientId;
    if (logoUrl) {
        setFavicon(logoUrl);
        const img = document.querySelector(".login-logo-img");
        if (img) {
            img.src = encodeURI(logoUrl);
        } else {
            const logoBox = document.querySelector(".login-card .logo");
            if (logoBox && logoBox.textContent.trim() === "🚀") {
                logoBox.innerHTML = `<img src="${encodeURI(logoUrl)}" alt="Logo" class="login-logo-img" />`;
            }
        }
    }
}


/**
 * Set favicon dari company logo.
 */
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

/**
 * Fetch company logo dari API.
 *
 * Prioritas:
 * 1. /api/platform/logo — logo yang diupload dari Pengaturan Super Admin (lintas domain)
 * 2. /api/companies — logo dari data perusahaan (fallback)
 */
async function fetchCompanyLogo() {
    // Priority 1: Platform logo (uploaded from Pengaturan Super Admin) —
    // disimpan di server Console (master.e-profit.id)
    const resp1 = await fetchWithTimeout(platformUrl("/api/platform/logo"));
    if (resp1 && resp1.ok) {
        const data = await resp1.json().catch(() => null);
        if (data && data.logo) return data.logo;
    }

    // Priority 2: Company logo fallback — data company juga di server Console
    const resp2 = await fetchWithTimeout(platformUrl("/api/companies"));
    if (resp2 && resp2.ok) {
        const data = await resp2.json().catch(() => null);
        const list = data?.data || data || [];
        const companies = Array.isArray(list) ? list : Object.values(list);
        const company = companies.find(c => c?.logo) || companies[0];
        return company?.logo || null;
    }
    return null;
}


/**
 * Show registration page.
 */
function showRegister(prefill = {}) {
    let logoUrl = null;
    try { logoUrl = localStorage.getItem("smart_superadmin_logo"); } catch {}
    if (logoUrl) setFavicon(logoUrl);

    document.querySelector("#app").innerHTML = RegisterPage(prefill);
    initRegisterPage({
        onSuccess: async (regData) => {
            // Auto-login setelah registrasi sukses (SP-027 M3: simpan JWT pair)
            setAuthTokens(regData);
            Auth.currentUser = {
                id: String(regData.user.id),
                name: regData.user.name,
                email: regData.user.email,
                institution: regData.user.institution || regData.user.companyCode,
                role: regData.user.role || "owner"
            };
            SMART.Company.set(regData.company.code, regData.company.name);
            await bootApp();
        },
        onBackToLogin: () => showLogin(),
        prefill
    });
}

/**
 * Handle logout — SP-027 M3: revoke refresh token di server + bersihkan token.
 */
function handleLogout() {
    // If impersonating, exit impersonation first (kembali ke SMART Console)
    if (impersonation.isImpersonating()) {
        exitImpersonation();
        return;
    }
    // M6-FIX v3 — kasir TIDAK boleh logout selama shift masih terbuka:
    // wajib tutup shift dulu (modal Tutup Shift), baru logout. Guard ganda
    // (tombol kasir + jalur AppShell/manapun yang memanggil handleLogout).
    const doLogout = () => {
        revokeSession();
        SMART.Company.clear();
        Auth.logout();
        clearAuthTokens();
        showLogin();
    };
    if (isKasirRole()) {
        requestKasirLogout(doLogout);
        return;
    }
    doLogout();
}


/**
 * Cek apakah access token (JWT) sudah kedaluwarsa berdasarkan klaim `exp`
 * (di-decode lokal, tanpa network). Dipakai refresh preventif sebelum /me
 * agar tidak ada request 401 yang menampilkan error di console browser.
 * @param {string} token
 * @returns {boolean} true bila token pasti kedaluwarsa / tidak ter-decode
 */
function isJwtExpired(token) {
    try {
        const parts = String(token || "").split(".");
        if (parts.length !== 3) return true;
        // JWT payload = base64url → pad & ganti karakter utk globalThis.atob
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(globalThis.atob(padded));
        if (!payload || !payload.exp) return true;
        return Number(payload.exp) * 1000 <= Date.now();
    } catch {
        // Gagal decode → anggap kedaluwarsa (aman: refresh via cookie)
        return true;
    }
}


/**
 * Application entry point.
 *
 * Sejak SP-027 Phase 1, aplikasi ini HANYA melayani POS (clone apps/inventory).
 * Platform Dashboard / Super Admin dipindah ke apps/console (master.e-profit.id).
 */
async function start() {
    loadUI();
    document.title = 'SMART Kasir';
    console.log(`${AppConfig.name} v${AppConfig.version} — SMART Kasir`);

    // ── SP-027 M3: konfigurasi token store ──
    configureAuthTokens({
        refreshPath: "/api/auth/refresh",
        onSessionExpired: () => {
            SMART.Company.clear();
            Auth.logout();
            showLogin();
        }
    });
    // Hook untuk modul login framework: simpan JWT pair setelah login/Google login.
    // SP-029 M6-FIX Task 1: simpan juga status entitlement (bila server
    // mengirimnya) agar banner peringatan bisa ditampilkan setelah renderApp.
    window.__SMART_AUTH_TOKEN_HOOK__ = (userData) => {
        setAuthTokens(userData);
        try {
            if (userData && userData.entitlement) {
                sessionStorage.setItem("smart_entitlement", JSON.stringify(userData.entitlement));
            } else {
                sessionStorage.removeItem("smart_entitlement");
            }
        } catch { /* ignore */ }
        // SP-029 M2 — simpan konfigurasi perusahaan (business type, lokasi, dll)
        saveCompanyConfig(userData?.companyConfig);
    };

    // ── SP-027 M3: impersonation handoff (signed JWT dari Console) ──
    // Console mengarahkan ke ?smart_imp=<JWT bertanda tangan>. Token ditukar
    // di server (POST /api/auth/impersonate) menjadi pasangan token asli,
    // bukan dipercaya langsung dari URL.
    const bootParams = new URLSearchParams(window.location.search);
    const impToken = bootParams.get("smart_imp");
    if (impToken) {
        // Bersihkan URL agar token tidak tertinggal di address bar
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        try {
            const res = await fetch("/api/auth/impersonate", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: impToken })
            });
            if (res.ok) {
                const data = await res.json();
                setAuthTokens(data);
                try {
                    if (data.entitlement) {
                        sessionStorage.setItem("smart_entitlement", JSON.stringify(data.entitlement));
                    } else {
                        sessionStorage.removeItem("smart_entitlement");
                    }
                } catch { /* ignore */ }
                saveCompanyConfig(data.companyConfig);
                Auth.currentUser = {
                    id: String(data.id),
                    name: data.name,
                    email: data.email,
                    institution: data.institution || data.companyCode,
                    role: data.role
                };
                SMART.Company.set(data.companyCode, data.companyName || data.name);
                impersonation.start({
                    superAdminId: data.superAdmin?.id || null,
                    superAdminName: data.superAdmin?.name || "Super Admin",
                    companyId: data.companyCode,
                    companyName: data.companyName,
                    userId: data.id,
                    userName: data.name,
                    application: data.application || "inventory",
                    role: data.role
                }, 3600000);
                console.log(`[App] Impersonation dari SMART Console: ${data.superAdmin?.name} → ${data.companyName}`);
                await bootApp();
                return;
            }
            console.warn("[App] Impersonation exchange gagal:", res.status);
            clearAuthTokens();
        } catch (e) {
            console.warn("[App] Gagal memproses smart_imp:", e);
            clearAuthTokens();
        }
        // Gagal → fall through ke login
    }

    // ── F&B Customer Ordering V1 — QR Menu Meja customer (PUBLIK, tanpa login) ──
    // Customer scan QR → https://pos.e-profit.id/m/{qrIdentifier} → halaman
    // mobile QR Menu. Semua data di-resolve server dari identifier (company →
    // lokasi → table). JANGAN tampilkan login/dashboard/desktop cashier.
    const cmMatch = window.location.pathname.match(/^\/m\/([A-Za-z0-9_-]+)\/?$/);
    // PWA diinstal dari home screen membuka start_url /m/ TANPA identifier
    // (manifest.json) — tampilkan prompt pindai QR meja, JANGAN jatuh ke
    // login POS (customer tidak punya akun).
    const cmNoId = /^\/m\/?$/.test(window.location.pathname);
    if (cmNoId) {
        document.title = "QR Menu — Pesan dari Meja";
        document.querySelector("#app").innerHTML = `
            <div style="min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:#f8fafc;color:#1e293b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
                <div style="font-size:3.5rem">🍽️</div>
                <h1 style="font-size:1.3rem;margin:0">QR Menu Meja</h1>
                <p style="color:#64748b;font-size:0.95rem;max-width:380px;margin:0;line-height:1.6">Pindai kode QR di meja Anda untuk melihat menu dan membuat pesanan.</p>
            </div>
        `;
        return;
    }
    if (cmMatch) {
        try {
            const logoUrl = await resolveLoginLogo();
            if (logoUrl) setFavicon(logoUrl);
        } catch { /* favicon opsional */ }
        const cmIdentifier = cmMatch[1];
        document.title = "QR Menu — Pesan dari Meja";
        document.querySelector("#app").innerHTML = CustomerMenuPage(cmIdentifier);
        await initCustomerMenuPage();
        return;
    }

    // Check for reset-password route
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get("token");
    const resetEmail = urlParams.get("email");

    if (window.location.pathname === "/reset-password" && resetToken && resetEmail) {
        // Set favicon sama seperti halaman login / superadmin
        // (reuse resolveLoginLogo — fetch dibatasi timeout, tidak menggantung)
        const logoUrl = await resolveLoginLogo();
        if (logoUrl) setFavicon(logoUrl);

        document.querySelector("#app").innerHTML = ResetPasswordPage(resetToken, resetEmail);
        initResetPasswordPage(resetToken, resetEmail);
        return;
    }

    // ── SP-027 M3: restore sesi dari access token (verifikasi server via /me) ──
    // M6-FIX v4: refresh PREVENTIF bila access token sudah kedaluwarsa (decode
    // klaim exp JWT lokal) SEBELUM memanggil /me. Tanpa ini, /me dipanggil
    // dengan token mati → server balas 401 → error merah di console browser
    // tiap kali halaman dimuat ulang (tidak mengganggu aplikasi, tapi
    // mengganggu pandangan). Refresh memakai httpOnly cookie — tanpa 401.
    const accessToken = getAccessToken();
    if (accessToken) {
        try {
            let meToken = accessToken;
            if (isJwtExpired(accessToken)) {
                meToken = await refreshAccessToken();
            }
            if (meToken) {
                const res = await fetch("/api/auth/me", {
                    credentials: "include",
                    headers: { Authorization: `Bearer ${meToken}` }
                });
                if (res.ok) {
                    const me = await res.json();
                    Auth.currentUser = {
                        id: String(me.id),
                        name: me.name,
                        email: me.email,
                        institution: me.institution,
                        role: me.role
                    };
                    SMART.Session.restore();
                    console.log("User (restored):", Auth.user().name);
                    await bootApp();
                    return;
                }
                console.warn("[App] Sesi tidak valid (" + res.status + "), kembali ke login");
                clearAuthTokens();
            }
        } catch (e) {
            console.warn("[App] Gagal memverifikasi sesi:", e);
            clearAuthTokens();
        }
    }

    if (Auth.isLoggedIn()) {
        console.log("User :", Auth.user().name);

        await bootApp();
    } else {
        showLogin();
    }
}


start();

window.__app = { Auth, framework, impersonation, navigate, renderApp, refreshSidebarMenus };
window.__showRegister = showRegister;
