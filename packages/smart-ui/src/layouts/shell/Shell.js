import { Topbar } from "../topbar/Topbar.js";
import { Sidebar } from "../sidebar/Sidebar.js";

export function AppShell({
    appTitle = "SMART",
    topbarTitle = "SMART Platform",
    userName = "User",
    menuItems = [],
    onNavigate = null,
    contentId = "content",
    logo = null
}) {

    const topbar = Topbar({
        title: topbarTitle,
        userName: userName
    });

    const sidebar = Sidebar({
        appTitle: appTitle,
        menuItems: menuItems,
        onNavigate: onNavigate,
        logo: logo
    });

    return `
        <div class="app">

            ${sidebar}
            <div class="sidebar-overlay" id="sidebar-overlay"></div>

            <div class="sidebar-popup" id="sidebar-popup">
                <div class="sidebar-popup-arrow"></div>
                <div class="sidebar-popup-header">
                    <span class="sidebar-popup-title"></span>
                </div>
                <ul class="sidebar-popup-items"></ul>
            </div>

            <div class="main">

                ${topbar}

                <div id="${contentId}" class="content"></div>

            </div>

        </div>
    `;
}
