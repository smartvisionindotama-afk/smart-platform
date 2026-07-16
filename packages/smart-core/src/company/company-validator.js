/**
 * Company Validator — Validation helpers for company data.
 *
 * Provides reusable validation functions for company forms.
 * Used by Settings modules and Company SDK.
 *
 * @module @smart/core/company/company-validator
 */

/**
 * Validate a company code format.
 * @param {string} code
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCompanyCode(code) {
    if (!code || !code.trim()) {
        return { valid: false, message: "Kode perusahaan wajib diisi" };
    }
    const trimmed = code.trim();
    if (trimmed.length < 3) {
        return { valid: false, message: "Kode perusahaan minimal 3 karakter" };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
        return { valid: false, message: "Kode hanya boleh huruf, angka, garis bawah, dan strip" };
    }
    return { valid: true, message: "" };
}

/**
 * Validate company name.
 * @param {string} name
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCompanyName(name) {
    if (!name || !name.trim()) {
        return { valid: false, message: "Nama perusahaan wajib diisi" };
    }
    if (name.trim().length < 2) {
        return { valid: false, message: "Nama perusahaan minimal 2 karakter" };
    }
    return { valid: true, message: "" };
}

/**
 * Validate email format.
 * @param {string} email
 * @returns {{ valid: boolean, message: string }}
 */
export function validateEmail(email) {
    if (!email || !email.trim()) return { valid: true, message: "" }; // optional
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email.trim())) {
        return { valid: false, message: "Format email tidak valid" };
    }
    return { valid: true, message: "" };
}

/**
 * Validate phone number format.
 * @param {string} phone
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePhone(phone) {
    if (!phone || !phone.trim()) return { valid: true, message: "" }; // optional
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, "");
    if (!/^\+?\d{6,15}$/.test(cleaned)) {
        return { valid: false, message: "Nomor telepon tidak valid" };
    }
    return { valid: true, message: "" };
}

/**
 * Validate company type is in allowed list.
 * @param {string} type
 * @param {string[]} allowedTypes
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCompanyType(type, allowedTypes = []) {
    if (!type) {
        return { valid: false, message: "Jenis perusahaan wajib dipilih" };
    }
    if (allowedTypes.length > 0 && !allowedTypes.includes(type)) {
        return { valid: false, message: `Jenis perusahaan "${type}" tidak dikenal` };
    }
    return { valid: true, message: "" };
}

/**
 * Validate complete company data object.
 * @param {object} data
 * @param {object} [options]
 * @param {string[]} [options.allowedTypes]
 * @returns {{ valid: boolean, errors: object }}
 */
export function validateCompanyData(data, options = {}) {
    const errors = {};

    const codeResult = validateCompanyCode(data.code);
    if (!codeResult.valid) errors.code = codeResult.message;

    const nameResult = validateCompanyName(data.name);
    if (!nameResult.valid) errors.name = nameResult.message;

    const emailResult = validateEmail(data.email);
    if (!emailResult.valid) errors.email = emailResult.message;

    const phoneResult = validatePhone(data.phone);
    if (!phoneResult.valid) errors.phone = phoneResult.message;

    if (options.allowedTypes) {
        const typeResult = validateCompanyType(data.jenis, options.allowedTypes);
        if (!typeResult.valid) errors.jenis = typeResult.message;
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}
