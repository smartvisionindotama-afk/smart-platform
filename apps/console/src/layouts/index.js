/**
 * SMART Console — Layouts.
 *
 * ConsoleShell membungkus AppShell dari @smart/ui/layouts
 * (Sidebar + Topbar + Content). CSS shell disediakan oleh
 * apps/console/src/assets/console.css (framework tidak menyertakan CSS shell).
 *
 * @module console/layouts
 */

import { AppShell } from "@smart/ui/layouts";

/**
 * Render Console Shell.
 * @param {object} options
 * @param {Array} options.menuItems Sidebar menu items
 * @param {Function} [options.onNavigate] Callback navigasi (page)
 * @param {string} [options.userName] Nama super admin
 * @param {string} [options.logo] URL logo platform
 * @param {string} [options.contentId] ID elemen konten
 * @returns {string} HTML shell
 */
export function ConsoleShell({
    menuItems = [],
    onNavigate = null,
    userName = "Super Admin",
    logo = null,
    contentId = "console-content"
} = {}) {
    return AppShell({
        appTitle: "SMART Console",
        topbarTitle: "SMART Console",
        userName,
        menuItems,
        onNavigate,
        contentId,
        logo
    });
}

/**
 * Attach event handlers shell: hamburger, overlay, collapse, logout, theme.
 * @param {object} options
 * @param {Function} [options.onLogout]
 * @param {string} [options.activePage] Page key yang sedang aktif
 */
export function attachConsoleShell({ onLogout = null, activePage = "" } = {}) {
    const sidebar = document.querySelector(".sidebar");
    const hamburger = document.getElementById("hamburger-btn");
    const overlay = document.getElementById("sidebar-overlay");
    const collapseBtn = document.getElementById("sidebar-collapse-btn");

    // Hamburger (mobile)
    if (hamburger && sidebar) {
        hamburger.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            if (overlay) overlay.classList.toggle("visible");
        });
    }
    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar?.classList.remove("open");
            overlay.classList.remove("visible");
        });
    }

    // Collapse (desktop) — persist di localStorage
    if (collapseBtn && sidebar) {
        const saved = localStorage.getItem("smart_console_sidebar_collapsed");
        if (saved === "1") sidebar.classList.add("collapsed");
        collapseBtn.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            const collapsed = sidebar.classList.contains("collapsed");
            localStorage.setItem("smart_console_sidebar_collapsed", collapsed ? "1" : "0");
            if (collapsed) sidebar.classList.remove("open");
        });
    }

    // Logout button di topbar
    const topbarRight = document.querySelector(".topbar-right");
    if (topbarRight && onLogout) {
        const existing = document.getElementById("cn-logout-btn");
        if (!existing) {
            const logoutBtn = document.createElement("button");
            logoutBtn.id = "cn-logout-btn";
            logoutBtn.className = "cn-logout-btn";
            logoutBtn.type = "button";
            logoutBtn.innerHTML = "🚪 Logout";
            logoutBtn.addEventListener("click", onLogout);
            topbarRight.appendChild(logoutBtn);
        }
    }

    // Active menu highlight
    if (activePage) {
        document.querySelectorAll(".sidebar-item").forEach(item => {
            item.classList.toggle("active", item.dataset.page === activePage);
        });
    }
}
