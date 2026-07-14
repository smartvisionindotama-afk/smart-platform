export function Topbar({
    title = "SMART Platform",
    userName = "User"
}) {
    return `
        <header class="topbar">

            <div class="topbar-left">
                <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle menu">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
                <span class="app-title">${title}</span>
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
