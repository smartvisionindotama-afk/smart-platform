/**
 * Google Credential Verification — verifikasi access token Google di SERVER.
 *
 * SP-027 M3 hardening: endpoint yang menerbitkan JWT (Google login) tidak
 * boleh mempercayai klaim email dari client. Verifikasi dilakukan dengan
 * memanggil Google userinfo endpoint memakai credential (access token) yang
 * dikirim client — jika token tidak valid, Google menolak (401).
 *
 * Dipisah ke modul tersendiri agar unit-testable (fetchImpl di-inject) dan
 * bisa dipakai ulang oleh server lain.
 *
 * @module @smart/security/google-verify
 */

/**
 * Verifikasi credential Google.
 * @param {string} credential Access token Google dari client
 * @param {object} [opts]
 * @param {string} [opts.expectedEmail] Jika di-set, email dari Google (verified)
 *   wajib cocok (case-insensitive) dengan nilai ini.
 * @param {number} [opts.timeoutMs] Timeout HTTP (default 5000ms)
 * @param {Function} [opts.fetchImpl] Injectable fetch (untuk test)
 * @returns {Promise<{ok: true, user: object}|{ok: false, status: number, error: string}>}
 */
export async function verifyGoogleCredential(credential, { expectedEmail = null, timeoutMs = 5000, fetchImpl } = {}) {
    const doFetch = fetchImpl || globalThis.fetch;

    if (!credential || typeof credential !== "string") {
        return { ok: false, status: 401, error: "Kredensial Google tidak ditemukan" };
    }

    let res;
    try {
        const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
            ? AbortSignal.timeout(timeoutMs)
            : undefined;
        res = await doFetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${credential}` },
            signal
        });
    } catch (err) {
        // Network error / timeout — jangan bocorkan detail, cukup 503
        return { ok: false, status: 503, error: "Gagal memverifikasi kredensial Google" };
    }

    if (!res.ok) {
        return { ok: false, status: 401, error: "Kredensial Google tidak valid atau kedaluwarsa" };
    }

    let user;
    try {
        user = await res.json();
    } catch {
        return { ok: false, status: 503, error: "Respons Google tidak valid" };
    }

    if (!user || !user.email) {
        return { ok: false, status: 401, error: "Email tidak ditemukan dari akun Google" };
    }

    // Defense-in-depth: jika Google menyertakan flag email_verified dan nilainya
    // false, tolak (akun belum diverifikasi). Field ini tidak selalu ada —
    // hanya di-enforce saat eksplisit false.
    if (user.email_verified === false) {
        return { ok: false, status: 401, error: "Email Google belum terverifikasi" };
    }

    if (expectedEmail && user.email.toLowerCase() !== String(expectedEmail).toLowerCase()) {
        return { ok: false, status: 401, error: "Email tidak cocok dengan akun Google terverifikasi" };
    }

    return { ok: true, user };
}

export default { verifyGoogleCredential };
