/**
 * Company Types — Standard company jenis options.
 *
 * Simplified list for all SMART Platform applications.
 * PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya
 *
 * Semua aplikasi menggunakan daftar yang sama.
 *
 * @module @smart/core/company/company-types
 */

/**
 * Standard list of company types.
 * @type {string[]}
 */
export const COMPANY_TYPES = [
    "PT",
    "CV",
    "Perorangan",
    "BUMDes",
    "Koperasi",
    "Pesantren",
    "Pemerintah",
    "Lainnya"
];

/**
 * Get company types as select options.
 * @returns {Array<{value: string, label: string}>}
 */
export function getCompanyTypeOptions() {
    return COMPANY_TYPES.map(type => ({
        value: type,
        label: type
    }));
}
