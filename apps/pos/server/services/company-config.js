/**
 * Company Config — SMART Kasir (SP-029 M2 [USULAN], Rule 4 & 17).
 *
 * Konfigurasi produk berasal dari Master Platform (Company.apps + businessType
 * + lokasiMode + jumlahKasir + lisensi). POS HANYA membaca — tidak mengelola.
 *
 * Fungsi murni (testable) — dipakai route auth (gate + response login).
 *
 * @module pos/server/services/company-config
 */

/** Slug aplikasi POS di platform (Company.apps / Application.slug / Feature.slug). */
export const POS_APP_SLUG = "pos";

/**
 * Apakah company terhubung ke aplikasi (default: POS)? — gate login (M2).
 * @param {object|null} company Dokumen Company (boleh null)
 * @param {string} [appSlug] Slug aplikasi (default "pos")
 * @returns {boolean}
 */
export function companyHasAppAccess(company, appSlug = POS_APP_SLUG) {
    if (!company || !appSlug) return false;
    return Array.isArray(company.apps) && company.apps.includes(appSlug);
}

/**
 * Normalisasi konfigurasi perusahaan yang disertakan ke response login
 * (dibaca client untuk menentukan perilaku UI). Default aman.
 * @param {object} [raw] Dokumen Company (atau field mentah)
 * @returns {object} Konfigurasi ternormalisasi
 */
export function normalizeCompanyConfig(raw = {}) {
    // Guard null (mis. user tanpa companyCode saat login) — default param hanya
    // menangani undefined.
    const src = raw || {};
    const lokasiMode = ["single", "multi"].includes(src.lokasiMode) ? src.lokasiMode : "single";
    const lisensiStatus = ["active", "trial", "expired"].includes(src.lisensiStatus) ? src.lisensiStatus : "active";
    return {
        businessType: src.businessType || "",
        lokasiMode,
        // Minimal 1 — nilai < 1 / bukan angka di-clamp konsisten
        jumlahGudang: Math.max(1, parseInt(src.jumlahGudang, 10) || 1),
        jumlahKasir: Math.max(1, parseInt(src.jumlahKasir, 10) || 1),
        lisensiStatus,
        lisensiExpiresAt: src.lisensiExpiresAt || null
    };
}

/**
 * Filter menu berdasarkan mode lokasi (pure — dipakai client & test).
 * - single (default): sembunyikan Transfer Gudang (dan pemilihan gudang).
 * - multi: semua menu tampil.
 * Grup yang menjadi kosong ikut dihapus.
 * @param {Array} items Struktur menu (title/icon/page/children)
 * @param {string} lokasiMode "single" | "multi"
 * @returns {Array}
 */
export function filterMenusByLokasi(items, lokasiMode) {
    const single = lokasiMode !== "multi";
    const walk = (list) => list.reduce((acc, item) => {
        if (item.children && item.children.length > 0) {
            const children = walk(item.children);
            if (children.length > 0) acc.push({ ...item, children });
            return acc;
        }
        if (single && item.page === "transfer") return acc;
        acc.push(item);
        return acc;
    }, []);
    return walk(items);
}

export default { POS_APP_SLUG, companyHasAppAccess, normalizeCompanyConfig, filterMenusByLokasi };
