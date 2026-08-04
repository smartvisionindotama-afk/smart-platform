/**
 * SMART Console — Router.
 *
 * Console adalah Platform Console multi-halaman (SP-027 M1).
 * Router menangani:
 *  - resolveScreen(isLoggedIn): gate login ↔ shell
 *  - navigate(page): render halaman ke #console-content
 *
 * @module console/router
 */

import { routes } from "./routes.js";

/**
 * Resolve layar yang harus aktif berdasarkan status login.
 * @param {boolean} isLoggedIn
 * @returns {object} Route object
 */
export function resolveScreen(isLoggedIn) {
    return isLoggedIn ? routes.dashboard : routes.login;
}

/**
 * Resolve page key yang valid.
 * @param {string} page
 * @returns {string} Page key valid (fallback "dashboard")
 */
export function resolvePage(page) {
    return routes[page] ? page : "dashboard";
}

export { routes };
