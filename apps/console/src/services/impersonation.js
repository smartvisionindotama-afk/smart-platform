/**
 * SMART Console — Impersonation Service.
 *
 * Handoff "Login As" cross-origin (Console → aplikasi tujuan).
 * Dipindahkan dari apps/console/src/modules/platform/dashboard.js (SP-027 M1)
 * agar logika platform tersentral di services/.
 *
 * @module console/services/impersonation
 */

import { Auth, impersonation, audit, setCompanyContext } from "@smart/core";
import { showToast } from "@smart/ui";
import { getAppEntryUrl } from "../config/index.js";
import { requestImpersonationToken } from "./superadmins.js";

/**
 * Start impersonation ke aplikasi tujuan.
 *
 * SP-027 PRE-M5 round 6: generik untuk SEMUA aplikasi terdaftar (inventory,
 * pos, ...) — token impersonasi (JWT) diterbitkan server Console lalu ditukar
 * di aplikasi tujuan (POST /api/auth/impersonate). Tidak lagi hardcode inventory.
 *
 * @param {string} appSlug App slug (mis. "inventory", "pos")
 * @param {string} companyCode Kode perusahaan
 * @param {string} companyName Nama perusahaan
 */
export async function startImpersonation(appSlug, companyCode, companyName) {
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

    // SP-027 M3: handoff memakai IMPERSONATION TOKEN bertanda tangan (JWT)
    // yang diterbitkan server Console (POST /api/superadmins/impersonation-token).
    // Aplikasi tujuan menukarnya di server (POST /api/auth/impersonate) —
    // payload tidak lagi berupa JSON mentah yang bisa dipalsukan client.
    const entryUrl = getAppEntryUrl(appSlug);
    if (!entryUrl || entryUrl === "/") {
        showToast("info", `Aplikasi "${appSlug}" belum memiliki URL entry. Daftarkan domain di menu Applications.`);
        impersonation.end();
        setCompanyContext(null, null);
        return;
    }

    try {
        const impToken = await requestImpersonationToken({ appSlug, companyCode, companyName });
        if (!impToken) {
            showToast("danger", "Gagal membuat token impersonasi. Silakan coba lagi.");
            impersonation.end();
            setCompanyContext(null, null);
            return;
        }
        window.location.href = `${entryUrl}?smart_imp=${encodeURIComponent(impToken)}`;
    } catch (err) {
        // requestImpersonationToken meneruskan pesan error server (mis. 403
        // company belum terhubung ke aplikasi) — tampilkan alasan sebenarnya.
        console.error("[Platform] Impersonation token error:", err);
        showToast("danger", err.message || "Gagal membuat token impersonasi. Silakan coba lagi.");
        impersonation.end();
        setCompanyContext(null, null);
    }
}
