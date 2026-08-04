/**
 * SMART Console — Activity Log Service (mock).
 *
 * SP-027 M1: halaman Activity Log masih mock (placeholder data).
 * Struktur data mengikuti shape audit log framework:
 * { time, user, activity, target, result }
 *
 * @module console/services/activity
 */

const MOCK_ACTIVITIES = [
    { time: "2026-08-05T09:42:00", user: "superadmin", activity: "Login", target: "SMART Console", result: "success" },
    { time: "2026-08-05T09:40:12", user: "superadmin", activity: "Create Company", target: "PT Nusantara Sejahtera", result: "success" },
    { time: "2026-08-05T09:35:47", user: "superadmin", activity: "Update Application", target: "inventory", result: "success" },
    { time: "2026-08-05T09:12:03", user: "superadmin", activity: "Login As", target: "PT Smart Vision Indotama", result: "success" },
    { time: "2026-08-05T08:58:29", user: "superadmin", activity: "Disable Company", target: "CV Karya Mandiri", result: "success" },
    { time: "2026-08-05T08:44:11", user: "superadmin", activity: "Reset Password", target: "superadmin@smart.id", result: "success" },
    { time: "2026-08-04T17:20:55", user: "superadmin", activity: "Update Settings", target: "Platform Logo", result: "success" },
    { time: "2026-08-04T16:05:38", user: "superadmin", activity: "Create Super Admin", target: "admin-ops", result: "success" },
    { time: "2026-08-04T15:48:02", user: "admin-ops", activity: "Login", target: "SMART Console", result: "success" },
    { time: "2026-08-04T14:33:19", user: "admin-ops", activity: "Update Company", target: "PT Smart Vision Indotama", result: "success" },
    { time: "2026-08-04T13:21:44", user: "superadmin", activity: "Enable Application", target: "accounting", result: "success" },
    { time: "2026-08-04T12:09:07", user: "superadmin", activity: "Delete Company", target: "CMP-OLD-99", result: "success" },
    { time: "2026-08-04T11:52:31", user: "superadmin", activity: "Login Failed", target: "superadmin", result: "failed" },
    { time: "2026-08-04T10:14:26", user: "admin-ops", activity: "Upload App Logo", target: "inventory", result: "success" },
    { time: "2026-08-03T16:47:58", user: "superadmin", activity: "Login", target: "SMART Console", result: "success" },
    { time: "2026-08-03T15:30:12", user: "superadmin", activity: "Update Company", target: "CV Karya Mandiri", result: "success" },
    { time: "2026-08-03T14:22:49", user: "superadmin", activity: "Create Company", target: "PT Bumi Perkasa", result: "success" },
    { time: "2026-08-03T10:05:33", user: "admin-ops", activity: "Login", target: "SMART Console", result: "success" },
    { time: "2026-08-02T16:18:20", user: "superadmin", activity: "Impersonation End", target: "PT Smart Vision Indotama", result: "success" },
    { time: "2026-08-02T09:40:15", user: "superadmin", activity: "Update Settings", target: "Theme", result: "success" },
    { time: "2026-08-01T17:05:40", user: "superadmin", activity: "Login", target: "SMART Console", result: "success" }
];

const _activities = [...MOCK_ACTIVITIES];

/**
 * List activity dengan search + pagination (mock).
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.search]
 * @returns {Promise<{data: object[], pagination: object}>}
 */
export async function listActivities(params = {}) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = (params.search || "").toLowerCase().trim();

    let filtered = [..._activities];
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
