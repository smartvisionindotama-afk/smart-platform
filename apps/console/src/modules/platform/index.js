/**
 * SMART Console — Platform Modules.
 *
 * Platform Module hanya boleh berada di apps/console (Golden Rule #9).
 * SP-027 M1: monolith PlatformDashboardModule digantikan halaman-halaman
 * platform di apps/console/src/pages/* — di sini hanya login yang tersisa.
 */
export { SuperAdminLoginPage, initSuperAdminLoginPage } from "./login.js";
