/**
 * Error Formatter — translates Mongoose errors to human-readable Indonesian.
 *
 * @module server/utils/format-error
 */

/**
 * Field name mapping: Mongoose field → Indonesian label
 */
const FIELD_LABELS = {
    kode: "Kode",
    nama: "Nama",
    companyCode: "Perusahaan",
    kategori: "Kategori",
    satuan: "Satuan",
    kontak: "Kontak",
    telepon: "Telepon",
    email: "Email",
    alamat: "Alamat",
    deskripsi: "Deskripsi",
    harga_beli: "Harga Beli",
    harga_jual: "Harga Jual",
    stok: "Stok",
    stok_minimum: "Stok Minimum",
    active: "Status Aktif",
    username: "Username",
    password: "Password",
    name: "Nama Perusahaan",
    role: "Role",
    level: "Level",
    code: "Kode Perusahaan",
    tenantId: "Tenant ID",
    jenis: "Jenis Perusahaan",
    address: "Alamat",
    phone: "Telepon",
    taxId: "NPWP",
    workspace: "Workspace"
};

/**
 * Get Indonesian label for a field name.
 * @param {string} field
 * @returns {string}
 */
function label(field) {
    return FIELD_LABELS[field] || field;
}

/**
 * Format a Mongoose ValidationError into human-readable Indonesian.
 *
 * Input:  "Customer validation failed: kode: Path 'kode' is required."
 * Output: "Kode Customer harus diisi"
 *
 * @param {Error} err Mongoose error object
 * @param {string} [entityName] Optional entity name (e.g., "Customer", "Barang")
 * @returns {string|null} Formatted message, or null if not a validation error
 */
export function formatValidationError(err, entityName) {
    // Mongoose ValidationError
    if (err.name === "ValidationError" && err.errors) {
        const fields = Object.keys(err.errors);
        const parts = fields.map(field => {
            const errObj = err.errors[field];
            const fieldLabel = label(field);
            const entity = entityName || "";

            if (errObj.kind === "required") {
                return entity
                    ? `${fieldLabel} ${entity} harus diisi`
                    : `${fieldLabel} harus diisi`;
            }
            if (errObj.kind === "enum") {
                return `${fieldLabel} tidak valid`;
            }
            if (errObj.kind === "unique" || errObj.kind === "duplicate") {
                return `${fieldLabel} sudah digunakan`;
            }
            if (errObj.kind === "min") {
                return `${fieldLabel} terlalu kecil`;
            }
            if (errObj.kind === "max") {
                return `${fieldLabel} terlalu besar`;
            }
            if (errObj.kind === "regexp") {
                return `Format ${fieldLabel} tidak valid`;
            }
            // Default: use mongoose message but strip technical parts
            return errObj.message
                .replace(new RegExp(`Path \\\`${field}\\\` `), "")
                .replace(/\.$/, "");
        });
        return parts.join(". ");
    }
    return null;
}

/**
 * System/internal fields that should be excluded from duplicate key messages.
 * These are auto-generated or system-assigned, not user-input fields.
 */
const SYSTEM_FIELDS = ["companyCode", "tenantId", "tenantCode", "createdBy", "updatedBy", "_id"];

/**
 * Format a duplicate key error (MongoDB error code 11000).
 *
 * Hanya menampilkan field yang diisi user (kode, nama, username, dll),
 * bukan field sistem seperti companyCode, tenantId, dll.
 *
 * Input:  { code: 11000, keyValue: { companyCode: "PT-001", kode: "BRG-001" } }
 * Output: 'Kode "BRG-001" sudah digunakan. Silakan gunakan yang lain.'
 *
 * @param {Error} err
 * @returns {string|null}
 */
export function formatDuplicateError(err) {
    if (err.code === 11000 && err.keyValue) {
        // Hanya tampilkan field user-facing, skip field sistem
        const keys = Object.keys(err.keyValue).filter(k => !SYSTEM_FIELDS.includes(k));
        if (keys.length === 0) return null;

        const parts = keys.map(key => {
            const fieldLabel = label(key);
            const value = err.keyValue[key];
            return `${fieldLabel} "${value}" sudah digunakan`;
        });
        return parts.join(". ") + ". Silakan gunakan yang lain.";
    }
    return null;
}

/**
 * Format any error into human-readable Indonesian.
 * Falls back to original message if no formatter matches.
 *
 * @param {Error} err
 * @param {string} [entityName] Entity name for context
 * @returns {string}
 */
export function formatError(err, entityName) {
    // Try duplicate key first
    const dupMsg = formatDuplicateError(err);
    if (dupMsg) return dupMsg;

    // Try validation error
    const valMsg = formatValidationError(err, entityName);
    if (valMsg) return valMsg;

    // Fallback: return as-is but remove Mongoose technical prefix
    let msg = err.message || "Terjadi kesalahan";
    msg = msg.replace(/^.*validation failed: /, "");
    msg = msg.replace(/Path `\w+` /g, "");
    msg = msg.replace(/\s+/g, " ").trim();
    return msg;
}

export default formatError;
