/**
 * Settings — Role Page.
 *
 * Thin wrapper around SMART Framework SettingsRoleModule.
 * Inventory injects data services.
 *
 * @module inventory/pages/settings/role
 */

import { SettingsRoleModule } from "@smart/ui/modules/settings";
import {
    listRoles, getRole, createRole, updateRole, deleteRole
} from "../../../data/index.js";

const module = SettingsRoleModule({
    listRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole
});

export const RolePage = module.render;
export const initRolePage = module.init;
