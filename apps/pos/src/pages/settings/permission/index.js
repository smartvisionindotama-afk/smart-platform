/**
 * Settings — Permission Page.
 *
 * Thin wrapper around SMART Framework SettingsPermissionModule.
 * Inventory injects data services.
 *
 * @module inventory/pages/settings/permission
 */

import { SettingsPermissionModule } from "@smart/ui/modules/settings";
import {
    getRolesWithPermissions, getRolePermissions,
    grantPermissionToRole, revokePermissionFromRole,
    getPermissionGroups
} from "../../../data/index.js";

/**
 * Dipanggil setelah setiap perubahan izin berhasil:
 * 1. Resync dari server agar Permission.can() sesi aktif akurat
 * 2. Refresh menu sidebar agar menu yang tidak boleh diakses langsung hilang
 */
async function handlePermissionsChanged() {
    try {
        const { Permission } = await import("@smart/core");
        await Permission.syncFromServer();
    } catch (e) {
        console.warn("[PermissionPage] Resync permission failed:", e);
    }
    try {
        if (typeof window.__app?.refreshSidebarMenus === "function") {
            window.__app.refreshSidebarMenus();
        }
    } catch (e) {
        console.warn("[PermissionPage] Refresh menu failed:", e);
    }
}

const module = SettingsPermissionModule({
    getRolesWithPermissions,
    getRolePermissions,
    grantPermissionToRole,
    revokePermissionFromRole,
    getPermissionGroups,
    onPermissionsChanged: handlePermissionsChanged
});

export const PermissionPage = module.render;
export const initPermissionPage = module.init;
