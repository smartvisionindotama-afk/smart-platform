export function Topbar({
    title = "SMART Platform",
    userName = "User"
}) {
    return `
        <header class="topbar">

            <span class="app-title">${title}</span>

            <span class="user-name">${userName}</span>

        </header>
    `;
}
