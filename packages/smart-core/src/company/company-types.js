/**
 * Company Types — Standard company jenis options.
 *
 * As defined in the master prompt:
 * PT, CV, Perorangan, Firma, Yayasan, BUMDes, BUMDes Bersama,
 * Koperasi, Pesantren, Sekolah, Pemerintah Desa, Kecamatan,
 * OPD, Puskesmas, Rumah Sakit, Lainnya
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
    "Firma",
    "Yayasan",
    "BUMDes",
    "BUMDes Bersama",
    "Koperasi",
    "Pesantren",
    "Sekolah",
    "Pemerintah Desa",
    "Kecamatan",
    "OPD",
    "Puskesmas",
    "Rumah Sakit",
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
