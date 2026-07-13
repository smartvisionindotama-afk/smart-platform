import { Topbar } from "../topbar/Topbar.js";
import { Sidebar } from "../sidebar/Sidebar.js";

export function AppShell({
    appTitle = "SMART",
    topbarTitle = "SMART Platform",
    userName = "User",
    menuItems = [],
    onNavigate = null,
    contentId = "content"
}) {

    const topbar = Topbar({
        title: topbarTitle,
        userName: userName
    });

    const sidebar = Sidebar({
        appTitle: appTitle,
        menuItems: menuItems,
        onNavigate: onNavigate
    });

    return `
        <div class="app">

            ${sidebar}

            <div class="main">

                ${topbar}

                <div id="${contentId}" class="content"></div>

            </div>

        </div>
    `;
}
