/**
 * Topbar Component.
 *
 * Renders the top navigation bar with app title, user info, theme toggle,
 * and optional impersonation badge for Super Admin sessions.
 *
 * @param {object} options
 * @param {string} options.title        App title (default: "SMART Platform")
 * @param {string} options.userName     Current user display name
 * @param {object} [options.impersonation] Impersonation session info (null if not impersonating)
 * @param {string} options.impersonation.companyName Company being impersonated
 * @param {string} options.impersonation.userName    Admin user being impersonated
 * @param {function} [options.onExitImpersonation]   Callback when "Kembali" is clicked
 */
export function Topbar({
    title = "SMART Platform",
    userName = "User",
    impersonation = null,
    onExitImpersonation = null
}) {
    const isImpersonating = impersonation && impersonation.companyName;

    const impersonationBadge = isImpersonating ? `
        <div class="topbar-impersonation-badge">
            <span class="imp-badge-dot">🔴</span>
            <span class="imp-badge-text">
                <strong>LOGIN AS</strong>
                <span class="imp-company">${impersonation.companyName}</span>
                <span class="imp-role">(Admin Perusahaan)</span>
                <span class="imp-support">Support Mode Active</span>
            </span>
            ${onExitImpersonation ? `<button class="imp-exit-btn" id="btn-exit-impersonation" title="Kembali ke Super Admin">✕</button>` : ""}
        </div>
    ` : "";

    return `
        <header class="topbar">
            <style>
                .topbar-impersonation-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    background: #dc2626;
                    color: #fff;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    margin-left: 0.75rem;
                    white-space: nowrap;
                }
                .topbar-impersonation-badge .imp-badge-dot {
                    font-size: 0.6rem;
                }
                .topbar-impersonation-badge .imp-badge-text {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                }
                .topbar-impersonation-badge .imp-badge-text strong {
                    font-size: 0.7rem;
                    letter-spacing: 0.5px;
                }
                .topbar-impersonation-badge .imp-company {
                    font-weight: 600;
                }
                .topbar-impersonation-badge .imp-role {
                    opacity: 0.8;
                    font-size: 0.7rem;
                }
                .topbar-impersonation-badge .imp-exit-btn {
                    padding: 2px 8px;
                    border: 1px solid rgba(255,255,255,0.4);
                    border-radius: 4px;
                    background: rgba(255,255,255,0.15);
                    color: #fff;
                    cursor: pointer;
                    font-size: 0.7rem;
                    transition: background 0.15s;
                }
                .topbar-impersonation-badge .imp-exit-btn:hover {
                    background: rgba(255,255,255,0.3);
                }
                .topbar-left {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex: 1;
                    min-width: 0;
                }
                .topbar-right {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
            </style>

            <div class="topbar-left">
                <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle menu">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
                <span class="app-title">${title}</span>
                ${impersonationBadge}
            </div>

            <div class="topbar-right">
                <button class="theme-toggle-btn" id="theme-toggle-btn" aria-label="Toggle dark mode">
                    <span class="theme-toggle-icon">🌙</span>
                </button>
                <span class="user-name">${userName}</span>
            </div>

        </header>
    `;
}
