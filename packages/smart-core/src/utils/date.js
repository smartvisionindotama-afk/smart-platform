/**
 * Date Utils — @smart/core public utils (Framework First).
 *
 * Util format tanggal/waktu yang bersifat GLOBAL dan dipakai lintas aplikasi
 * (POS, Inventory, Console) — bukan milik satu aplikasi tertentu.
 *
 * @module @smart/core/utils/date
 */

/**
 * Format tanggal ke format id-ID singkat: 2026-08-13 → "13 Agu 2026".
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatDate(value) {
    if (value === null || value === undefined || value === "") return "-";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("id-ID", {
            year: "numeric", month: "short", day: "numeric"
        });
    } catch { return "-"; }
}

/**
 * Format tanggal ke format id-ID lengkap: "Senin, 11 Agustus 2026".
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatDateID(value) {
    if (value === null || value === undefined || value === "") return "-";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return "-"; }
}

/**
 * Format timestamp ke string lokal id-ID: "13 Agu 2026, 14.30".
 * @param {number|string|Date|null|undefined} ts
 * @returns {string}
 */
export function formatDateTime(ts) {
    if (ts === null || ts === undefined || ts === "") return "-";
    try {
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch { return "-"; }
}

/**
 * Waktu relatif dari sekarang (id-ID): "baru saja", "5m lalu", "2j lalu", "3h lalu".
 * Lebih dari 30 hari → kembali ke formatDate.
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function timeAgo(value) {
    if (value === null || value === undefined || value === "") return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins}m lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j lalu`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}h lalu`;
    return formatDate(d);
}
