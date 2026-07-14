/**
 * Sidebar Component.
 *
 * Renders a sidebar navigation menu with app title and menu items.
 * Supports nested menu groups via `children` array in menu items.
 * Uses document-level event delegation for navigation clicks.
 * Collapsible groups use native <details>/<summary> HTML elements.
 *
 * Menu item shape:
 *   { title, icon, page, permission }         — leaf item (clickable)
 *   { title, icon, children: [...] }           — group (collapsible)
 *
 * Changes:
 * - Added recursive menu rendering for nested children.
 * - Group headers use <details>/<summary> for native expand/collapse.
 * - Leaf items use data-page for navigation delegation.
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


/**
 * Recursively render menu items, supporting nested children groups.
 */
function renderMenuItems(items, depth = 0) {
    return items.map(item => {

        // ── Group item with children ──
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
                            ${renderMenuItems(item.children, depth + 1)}
                        </ul>
                    </details>
                </li>
            `;
        }

        // ── Leaf item (navigable) ──
        return `
            <li class="sidebar-item" data-page="${item.page}" data-title="${item.title}">
                <span class="sidebar-item-icon">${item.icon || ""}</span>
                <span class="sidebar-item-title">${item.title}</span>
            </li>
        `;

    }).join("");
}


export function Sidebar({
    appTitle = "SMART",
    menuItems = [],
    onNavigate = null,
    logo = null
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

    // Build logo HTML if provided
    const logoHtml = logo
        ? `<div class="sidebar-logo-wrapper">
               <img class="sidebar-logo-img" src="${logo}" alt="Company Logo" />
           </div>`
        : `<div class="sidebar-logo-wrapper sidebar-logo-placeholder">
               <span class="sidebar-logo-initial">${appTitle.charAt(0)}</span>
           </div>`;

    return `
        <aside class="sidebar">

            <div class="sidebar-header">
                ${logoHtml}
                <h2 class="sidebar-title">${appTitle}</h2>
            </div>

            <ul class="sidebar-menu">
                ${renderMenuItems(menuItems)}
            </ul>

            <div class="sidebar-footer">
                <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" aria-label="Collapse sidebar">
                    <span class="collapse-icon">◀</span>
                    <span class="collapse-label">Sembunyikan</span>
                </button>
            </div>

        </aside>
    `;

}
