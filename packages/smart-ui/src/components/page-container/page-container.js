/**
 * Page Container & Breadcrumb helpers.
 *
 * Framework-level component for consistent page layout.
 * Wraps page content with standard layout and breadcrumb navigation.
 *
 * @module @smart/ui/components/page-container
 */

/**
 * Page Container — wraps page content with a standard layout.
 *
 * @param {object} options
 * @param {string} options.title Page title
 * @param {string} [options.subtitle] Optional subtitle
 * @param {string} [options.breadcrumb] Optional breadcrumb items separated by " > "
 * @param {string} options.children Inner HTML content
 * @param {string} [options.className] Additional CSS class on wrapper
 * @returns {string} HTML string
 */
export function PageContainer({ title, subtitle, breadcrumb, children, className = "" }) {
    return `
        <div class="page-container ${className}">
            ${breadcrumb ? `
                <nav class="page-breadcrumb">
                    ${breadcrumb.split(" > ").map((crumb, i, arr) => `
                        <span class="breadcrumb-item ${i === arr.length - 1 ? "breadcrumb-active" : ""}">${crumb.trim()}</span>
                        ${i < arr.length - 1 ? '<span class="breadcrumb-sep">›</span>' : ""}
                    `).join("")}
                </nav>
            ` : ""}
            <div class="page-header">
                <div>
                    <h1 class="page-title">${title}</h1>
                    ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
                </div>
            </div>
            <div class="page-body">
                ${children}
            </div>
        </div>
    `;
}

/**
 * Render page breadcrumb HTML.
 *
 * @param {Array<{label: string, href?: string}>} items
 * @returns {string} HTML string for breadcrumb nav
 */
export function renderBreadcrumb(items) {
    if (!items || items.length === 0) return "";

    return `
        <nav class="breadcrumb-nav" aria-label="Breadcrumb">
            ${items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                const arrow = idx > 0 ? `<span class="breadcrumb-arrow">›</span>` : "";
                if (isLast) {
                    return `${arrow}<span class="breadcrumb-current">${item.label}</span>`;
                }
                return `${arrow}<a class="breadcrumb-link" href="#" data-nav="${item.href || "#"}">${item.label}</a>`;
            }).join("")}
        </nav>
    `;
}
