/**
 * SMART Console — Impersonation Service.
 *
 * Handoff "Login As" cross-origin (Console → Inventory).
 * Dipindahkan dari apps/console/src/modules/platform/dashboard.js (SP-027 M1)
 * agar logika platform tersentral di services/.
 *
 * @module console/services/impersonation
 */

import { Auth, impersonation, audit, setCompanyContext } from "@smart/core";
import { showToast } from "@smart/ui";
import { getAppEntryUrl } from "../config/index.js";

/**
 * Start impersonation ke aplikasi tujuan.
 * @param {string} appSlug App slug (mis. "inventory")
 * @param {string} companyCode Kode perusahaan
 * @param {string} companyName Nama perusahaan
 */
export function startImpersonation(appSlug, companyCode, companyName) {
    const superAdmin = Auth.user();
    if (!superAdmin) return;

    audit.logImpersonationStart({
        superAdminId: superAdmin.id, superAdminName: superAdmin.name,
        companyId: companyCode, application: appSlug
    });
    setCompanyContext(companyCode, companyName);
    impersonation.start({
        superAdminId: superAdmin.id, superAdminName: superAdmin.name,
        companyId: companyCode, companyName,
        userId: companyCode + "-admin", userName: `Admin ${companyName}`,
        application: appSlug, role: "owner"
    }, 3600000);

    console.log(`[Platform] Impersonation: ${superAdmin.name} → ${companyName} (${appSlug})`);

    if (appSlug === "inventory") {
        // SP-027 Phase 1: Console (master.e-profit.id) & Inventory (inv.e-profit.id)
        // kini origin berbeda → sessionStorage TIDAK dibagikan antar domain.
        // Kirim data impersonation via query param ke Inventory, lalu redirect.
        const payload = JSON.stringify({
            session: {
                superAdminId: superAdmin.id, superAdminName: superAdmin.name,
                companyId: companyCode, companyName, userId: companyCode + "-admin",
                userName: `Admin ${companyName}`, application: appSlug, role: "owner"
            },
            ttlMs: 3600000, companyCode, companyName,
            authUser: {
                id: superAdmin.id, name: superAdmin.name, email: superAdmin.email,
                institution: superAdmin.institution, role: superAdmin.role
            }
        });
        window.location.href = `${getAppEntryUrl(appSlug)}?smart_imp=${encodeURIComponent(payload)}`;
    } else {
        showToast("info", `Aplikasi "${appSlug}" akan tersedia segera`);
        impersonation.end();
        setCompanyContext(null, null);
    }
}
