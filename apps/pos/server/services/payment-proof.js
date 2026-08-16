/**
 * Payment Proof Service — validasi & helper bukti pembayaran (F&B V1).
 *
 * Fungsi MURNI (testable) — tidak menyentuh DB:
 *   - parseProofDataUri  : validasi data URI gambar (tipe + ukuran)
 *   - sanitizeProof      : potong field sensitif/berat utk response customer
 *
 * Format minimal: JPEG / JPG / PNG / WEBP. Data URI hasil kompresi
 * client-side (canvas — pola foto produk). Batas ukuran ketat agar payload
 * API & storage tidak membengkak (data URI disimpan di DB).
 *
 * @module pos/server/services/payment-proof
 */

/** Tipe gambar yang diizinkan (normalisasi jpg → jpeg). */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Batas maks ukuran payload data URI (base64 string) — ~1.5MB.
 * Client sudah kompres (maks 900px, q0.7) — bukti tetap terbaca jelas.
 */
export const MAX_PROOF_DATA_URI_LENGTH = 1.5 * 1024 * 1024;

/**
 * Normalisasi tipe MIME dari data URI (jpg → jpeg) + validasi whitelist.
 * @param {string} dataUri
 * @returns {{ mimeType: string }|null} null bila tipe tidak dikenal
 */
export function normalizeImageMime(dataUri) {
    if (typeof dataUri !== "string") return null;
    const m = String(dataUri).match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,/i);
    if (!m) return null;
    let mime = String(m[1] || "").toLowerCase();
    if (mime === "image/jpg") mime = "image/jpeg";
    if (!ALLOWED_IMAGE_TYPES.includes(mime)) return null;
    return { mimeType: mime };
}

/**
 * Validasi data URI bukti pembayaran.
 * - wajib string data:image/{jpeg|png|webp};base64,...
 * - tipe harus dalam whitelist (JPG/JPEG/PNG/WEBP)
 * - ukuran base64 ≤ MAX_PROOF_DATA_URI_LENGTH
 * @param {string} dataUri
 * @returns {{ ok: true, mimeType: string, dataUri: string }|{ ok: false, error: string }}
 */
export function parseProofDataUri(dataUri) {
    if (!dataUri || typeof dataUri !== "string") {
        return { ok: false, error: "Bukti pembayaran wajib diisi (gambar JPG/PNG/WEBP)" };
    }
    const norm = normalizeImageMime(dataUri);
    if (!norm) {
        return { ok: false, error: "Format bukti tidak didukung — gunakan JPG, PNG, atau WEBP" };
    }
    if (dataUri.length > MAX_PROOF_DATA_URI_LENGTH) {
        return { ok: false, error: "Ukuran bukti terlalu besar — gunakan gambar di bawah 1,5 MB" };
    }
    return { ok: true, mimeType: norm.mimeType, dataUri };
}

/**
 * Versi ringan bukti untuk response CUSTOMER — TIDAK menyertakan dataUri
 * (payload berat + customer tidak perlu mengambil ulang gambarnya sendiri;
 * keamanan §16: file tidak diekspos via URL publik apa pun).
 * @param {object} p Dokumen PaymentProof
 * @returns {object}
 */
export function sanitizeProof(p) {
    if (!p) return null;
    return {
        id: String(p._id || p.id || ""),
        status: p.status || "pending",
        mimeType: p.mimeType || "",
        uploadedAt: p.createdAt || p.uploadedAt || null,
        verifiedAt: p.verifiedAt || null,
        verifiedBy: p.verifiedBy || "",
        rejectionReason: p.rejectionReason || ""
    };
}

export default { ALLOWED_IMAGE_TYPES, MAX_PROOF_DATA_URI_LENGTH, parseProofDataUri, normalizeImageMime, sanitizeProof };
