/**
 * SMART Console — Activity Log Service.
 *
 * SP-027 PRE-M5 round 3: data berasal dari SERVER (GET /api/audit →
 * collection security_auditlogs, M3). Fallback lokal hanya saat API tidak
 * tersedia. Setiap entri audit dipetakan ke shape tampilan:
 * { time, user, activity, target, result }.
 *
 * @module console/services/activity
 */

import { apiListFallback } from "@smart/api";

const ACTION_LABELS = {
    "login": "Login",
    "logout": "Logout",
    "login.failed": "Login Gagal",
    "password.change": "Ubah Password",
    "role.change": "Ubah Role",
    "company.switch": "Pindah Perusahaan",
    "company.create": "Create Company",
    "company.update": "Update Company",
    "company.delete": "Delete Company",
    "superadmin.create": "Create Super Admin",
    "superadmin.update": "Update Super Admin",
    "superadmin.delete": "Delete Super Admin",
    "impersonation.start": "Login As",
    "impersonation.end": "Akhiri Impersonasi",
    "platform.logo.upload": "Upload Platform Logo",
    "platform.logo.remove": "Hapus Platform Logo",
    "app.logo.upload": "Upload App Logo",
    "app.logo.remove": "Hapus App Logo",
    "app.create": "Create Application",
    "app.update": "Update Application",
    "app.toggle": "Ubah Status Aplikasi",
    "app.delete": "Delete Application",
    "register": "Registrasi Perusahaan"
};

/**
 * Terjemahkan action audit (mis. "company.create") ke label tampilan.
 * @param {string} action
 * @returns {string}
 */
export function humanizeAction(action) {
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    if (!action) return "Aktivitas";
    return String(action)
        .split(".")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

/**
 * Petakan dokumen SecurityAuditLog (server) ke shape tampilan activity.
 * @param {object} a
 * @returns {{time: string, user: string, activity: string, target: string, result: string}}
 */
function mapAudit(a) {
    return {
        time: a.createdAt || a.time || "",
        user: a.actorName || "System",
        activity: humanizeAction(a.action),
        target: a.targetName || a.targetId || "—",
        result: a.result === "failed" ? "failed" : "success"
    };
}

// ── Local fallback (hanya jika server tidak tersedia) ──
const MOCK_ACTIVITIES = [
    { time: "2026-08-05T09:42:00", user: "superadmin", activity: "Login", target: "SMART Console", result: "success" },
    { time: "2026-08-05T09:40:12", user: "superadmin", activity: "Create Company", target: "PT Nusantara Sejahtera", result: "success" },
    { time: "2026-08-04T17:20:55", user: "superadmin", activity: "Update Settings", target: "Platform Logo", result: "success" }
];

async function listActivitiesLocal(params = {}) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();
    let filtered = [...MOCK_ACTIVITIES];
    if (search) {
        filtered = filtered.filter(a =>
            a.user.toLowerCase().includes(search) ||
            a.activity.toLowerCase().includes(search) ||
            a.target.toLowerCase().includes(search)
        );
    }
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return {
        data: filtered.slice(start, start + limit),
        pagination: { page: Math.min(page, totalPages), limit, total, totalPages }
    };
}

/**
 * List aktivitas (server-first) dengan search + pagination.
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.search]
 * @returns {Promise<{data: object[], pagination: object}>}
 */
export async function listActivities(params = {}) {
    const result = await apiListFallback("/api/audit", params, () => listActivitiesLocal(params));
    // Data dari server adalah dokumen SecurityAuditLog → petakan ke shape tampilan.
    // Deteksi: dokumen audit punya field `action`.
    if (result && Array.isArray(result.data) && result.data.length > 0 && result.data[0].action !== undefined) {
        result.data = result.data.map(mapAudit);
    }
    return result;
}

/**
 * Format waktu ke tampilan lokal (dd MMM yyyy, HH:mm).
 * @param {string} iso
 * @returns {string}
 */
export function formatActivityTime(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch {
        return iso;
    }
}
