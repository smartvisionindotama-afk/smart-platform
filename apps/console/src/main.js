/**
 * SMART Console — Entry point.
 *
 * Aplikasi mandiri untuk master.e-profit.id (Super Admin Platform).
 * SP-027 M1: Platform Console multi-halaman.
 *
 * HANYA bergantung pada framework:
 *   @smart/core, @smart/ui, @smart/api, @smart/data
 * TIDAK bergantung pada Inventory / @smart/inventory-ui (SP-027 Golden Rule).
 *
 * @module console/main
 */

import "./assets/console.css";

import { AppConfig, Auth, SMART } from "@smart/core";
import { loadUI } from "@smart/ui";
import { configureAuthTokens, setAuthTokens, clearAuthTokens } from "@smart/api";

import { SuperAdminLoginPage, initSuperAdminLoginPage } from "./pages/login";
import { ConsoleShell, attachConsoleShell } from "./layouts";
import { resolvePage } from "./router";
import { MENU_ITEMS, SESSION_KEY } from "./config/index.js";
import { getSuperAdminMe, superadminLogout } from "./services/superadmins.js";

const CONSOLE_TITLE = "SMART Console";

/**
 * Ambil logo platform dari server (prioritas), fallback ke localStorage.
 * @returns {Promise<string|null>}
 */
async function fetchPlatformLogo() {
    try {
        const resp = await fetch("/api/platform/logo");
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.logo) return data.logo;
        }
    } catch { /* silent */ }

    try {
        return localStorage.getItem("smart_superadmin_logo");
    } catch { /* ignore */ }
    return null;
}

/**
 * Set favicon dari logo.
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

// ── Session (console-only, localStorage) ──
// SP-027 M3: sesi divalidasi server (GET /api/superadmins/me) — tidak lagi
// hanya mempercayai role di localStorage.

function persistSession() {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(Auth.user()));
    } catch { /* ignore */ }
}

/**
 * Restore sesi dari token — verifikasi ke server via /me.
 * @returns {Promise<boolean>}
 */
async function restoreSession() {
    const me = await getSuperAdminMe();
    if (!me) {
        clearAuthTokens();
        return false;
    }
    Auth.currentUser = {
        id: String(me.id),
        name: me.name,
        email: me.email || "",
        institution: me.institution || "PLATFORM",
        role: "superadmin"
    };
    persistSession();
    return true;
}

function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
}

function isSuperAdminLoggedIn() {
    return Auth.isLoggedIn() && Auth.user()?.role === "superadmin";
}

// ── Navigation ──

// Token untuk mencegah race condition antar navigasi cepat
let _navToken = 0;

async function navigate(page) {
    const key = resolvePage(page);
    const mount = document.querySelector("#console-content");
    if (!mount) return;

    const token = ++_navToken;

    // Tutup modal sisa (modal di-append ke body, bukan mount)
    document.querySelectorAll(".smart-modal-overlay").forEach(overlay => overlay.remove());

    // Render halaman
    mount.innerHTML = "";
    try {
        switch (key) {
            case "monitoring": {
                // renderMonitoring menghentikan timer auto-refresh lama di awal
                const { renderMonitoring } = await import("./pages/monitoring/index.js");
                await renderMonitoring(mount);
                break;
            }
            case "applications": {
                const { renderApplications } = await import("./pages/applications/index.js");
                await renderApplications(mount);
                break;
            }
            case "companies": {
                const { renderCompanies } = await import("./pages/companies/index.js");
                await renderCompanies(mount);
                break;
            }
            case "superadmins": {
                const { renderSuperAdmins } = await import("./pages/superadmins/index.js");
                await renderSuperAdmins(mount);
                break;
            }
            case "settings": {
                const { renderSettingsPage } = await import("./pages/settings/index.js");
                await renderSettingsPage(mount);
                break;
            }
            case "system": {
                const { renderSystem } = await import("./pages/system/index.js");
                await renderSystem(mount);
                break;
            }
            case "activity": {
                const { renderActivity } = await import("./pages/activity/index.js");
                await renderActivity(mount);
                break;
            }
            case "documentation": {
                const { renderDocumentation } = await import("./pages/documentation/index.js");
                await renderDocumentation(mount);
                break;
            }
            case "deployment": {
                const { renderDeployment } = await import("./pages/deployment/index.js");
                await renderDeployment(mount);
                break;
            }
            case "security": {
                const { renderSecurity } = await import("./pages/security/index.js");
                await renderSecurity(mount);
                break;
            }
            case "database": {
                const { renderDatabasePage } = await import("./pages/database/index.js");
                await renderDatabasePage(mount);
                break;
            }
            case "billing": {
                const { renderBilling } = await import("./pages/billing/index.js");
                await renderBilling(mount);
                break;
            }
            default: {
                const { renderDashboard } = await import("./pages/dashboard/index.js");
                await renderDashboard(mount);
            }
        }
    } catch (err) {
        console.error("[Console] Navigate error:", err);
        if (token === _navToken) {
            mount.innerHTML = `<div class="cn-loading">Gagal memuat halaman: ${err.message}</div>`;
        }
        return;
    }

    // Abaikan render lama yang selesai setelah navigasi baru
    if (token !== _navToken) return;

    // Active menu
    document.querySelectorAll(".sidebar-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === key);
    });

    window.scrollTo({ top: 0 });
}

// ── Shell (Platform Console) ──

async function showConsole() {
    const logoUrl = await fetchPlatformLogo();
    if (logoUrl) setFavicon(logoUrl);

    document.querySelector("#app").innerHTML = ConsoleShell({
        menuItems: MENU_ITEMS,
        onNavigate: (page) => navigate(page),
        userName: Auth.user()?.name || "Super Admin",
        logo: logoUrl,
        contentId: "console-content"
    });

    attachConsoleShell({
        onLogout: handleLogout,
        activePage: "dashboard"
    });

    await navigate("dashboard");
}

function handleLogout() {
    // SP-027 M3: revoke refresh token di server (fire-and-forget)
    superadminLogout();
    clearSession();
    Auth.logout();
    showSuperAdminLogin();
}

// ── Login ──

async function showSuperAdminLogin() {
    const logoUrl = await fetchPlatformLogo();
    if (logoUrl) setFavicon(logoUrl);

    document.querySelector("#app").innerHTML = SuperAdminLoginPage({ logo: logoUrl });
    initSuperAdminLoginPage({
        onSuccess: async () => {
            persistSession();
            await showConsole();
        }
    });
}

/**
 * Entry point.
 */
async function start() {
    loadUI();
    document.title = CONSOLE_TITLE;
    console.log(`${AppConfig.name} v${AppConfig.version} — ${CONSOLE_TITLE}`);

    // SP-027 M3: token store & hook login
    configureAuthTokens({
        refreshPath: "/api/superadmins/refresh",
        onSessionExpired: () => {
            clearSession();
            Auth.logout();
            showSuperAdminLogin();
        }
    });
    window.__SMART_AUTH_TOKEN_HOOK__ = (userData) => setAuthTokens(userData);

    const hasSession = await restoreSession();
    if (hasSession || isSuperAdminLoggedIn()) {
        await showConsole();
    } else {
        await showSuperAdminLogin();
    }
}

start();

window.__app = { Auth, SMART };

// Navigasi ekspos untuk halaman yang butuh cross-navigation (mis. tombol
// "Buka Billing Center" dari modal Billing di halaman Companies).
window.__consoleNav = { navigate };
