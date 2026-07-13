/**
 * Sidebar Component.
 *
 * Renders a sidebar navigation menu with app title and menu items.
 * Uses document-level event delegation for navigation clicks.
 *
 * Changes:
 * - Removed module-level `sidebarClickAttached` flag that prevented
 *   re-rendering with dynamic menu items. Now uses dataset attribute
 *   for one-time init tracking.
 * - Navigation handler is stored in a module variable so it can be
 *   updated on each render without re-registering the event listener.
 */

// Module-level handler storage — updated on every render call.
// Unlike the old `sidebarClickAttached` (which was a blocking flag),
// this variable is purely a dynamic reference that gets overwritten.
// It exists so the one-time event delegation listener can always
// invoke the latest navigation callback without re-registration.
let _activeNavigateHandler = null;


export function Sidebar({
    appTitle = "SMART",
    menuItems = [],
    onNavigate = null
}) {

    // Update the active navigation handler with the latest callback
    if (typeof onNavigate === "function") {
        _activeNavigateHandler = onNavigate;
    }


    // One-time event delegation setup
    // Using a dataset attribute on body instead of a module-level flag
    // ensures the delegation works across re-renders without blocking.
    if (
        typeof onNavigate === "function"
        && !document.body?.dataset?.smartSidebarReady
    ) {

        document.body.dataset.smartSidebarReady = "true";

        document.addEventListener("click", (e) => {
            const item = e.target.closest("[data-page]");
            if (item && _activeNavigateHandler) {
                _activeNavigateHandler(item.dataset.page);
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
