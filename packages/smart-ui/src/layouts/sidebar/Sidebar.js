let sidebarClickAttached = false;

export function Sidebar({
    appTitle = "SMART",
    menuItems = [],
    onNavigate = null
}) {

    // Event delegation (instead of setTimeout anti-pattern)
    // Attach once to document, filter by [data-page]
    if (onNavigate && !sidebarClickAttached) {
        sidebarClickAttached = true;
        document.addEventListener("click", function(e) {
            const item = e.target.closest("[data-page]");
            if (item) {
                onNavigate(item.dataset.page);
            }
        });
    }

    return `
        <aside class="sidebar">

            <h2>
                ${appTitle}
            </h2>

            <ul>
                ${menuItems.map(menu => `
                    <li data-page="${menu.page}">
                        ${menu.icon || ""}
                        ${menu.title}
                    </li>
                `).join("")}
            </ul>

        </aside>
    `;
}
