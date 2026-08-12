/**
 * System Password API Routes — ganti password sudo (OS user) dari Console.
 *
 * Endpoint:
 *   POST /api/system-password/change — ganti password OS user (default smartvision)
 *
 * Keamanan:
 *   - Superadmin only (authenticate + requireSuperAdmin)
 *   - Password TIDAK pernah masuk argv proses (dikirim via stdin ke sudo -S),
 *     sehingga tidak terlihat di `ps`, history, atau log.
 *   - Validasi kekuatan password (min 10 karakter, huruf+angka, tanpa spasi/kolon).
 *   - Audit log dicatat (tanpa nilai password).
 *
 * @module console/server/routes/system-password
 */

import { Router } from "express";
import { spawn } from "node:child_process";
import { security, audit } from "../security.js";

const router = Router();

router.use(security.authenticate, security.requireSuperAdmin);

/** OS user target (default user yang menjalankan console-api). */
const SUDO_TARGET_USER = process.env.SUDO_TARGET_USER || "smartvision";

/** Batas panjang password — mencegah payload stdin raksasa. */
const MAX_PASSWORD_LENGTH = 128;

/** Waktu tunggu sudo/chpasswd (detik) — hindari request menggantung. */
const SUDO_TIMEOUT_MS = 15000;

/** Cek format aman untuk protokol stdin (2 baris) — tanpa spasi/kolon/newline. */
function unsafeForStdin(pw) {
    return typeof pw !== "string" || pw.length === 0 || pw.length > MAX_PASSWORD_LENGTH || /\s/.test(pw) || pw.includes(":");
}

/**
 * Validasi kekuatan password baru (app-side; tidak bergantung PAM).
 * @param {unknown} pw
 * @returns {string|null} Pesan error atau null bila valid
 */
function validateNewPassword(pw) {
    if (typeof pw !== "string" || pw.length < 10) {
        return "Password baru minimal 10 karakter";
    }
    if (pw.length > MAX_PASSWORD_LENGTH) {
        return `Password baru maksimal ${MAX_PASSWORD_LENGTH} karakter`;
    }
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
        return "Password baru harus kombinasi huruf dan angka";
    }
    if (/\s/.test(pw) || pw.includes(":")) {
        return "Password baru tidak boleh mengandung spasi atau karakter ':'";
    }
    return null;
}

/**
 * Validasi password lama — harus aman untuk protokol stdin (baris 1 sudo).
 * @param {unknown} pw
 * @returns {string|null} Pesan error atau null bila valid
 */
function validateCurrentPassword(pw) {
    if (typeof pw !== "string" || pw.length === 0) {
        return "Password sudo saat ini wajib diisi";
    }
    if (unsafeForStdin(pw)) {
        return "Password sudo saat ini tidak valid";
    }
    return null;
}

/**
 * Ganti password via `sudo -S chpasswd`.
 * stdin baris 1 = password sudo SAAT INI (otentikasi sudo),
 * stdin baris 2 = `<user>:<password-baru>`.
 *
 * `-k` memaksa sudo selalu meminta password (membatalkan timestamp cache),
 * sehingga baris 1 SELALU dikonsumsi sudo sebagai password lama dan chpasswd
 * hanya menerima baris 2 — hasil/exit code deterministik.
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{ok: boolean, message?: string}>}
 */
function runSudoChpasswd(currentPassword, newPassword) {
    return new Promise((resolve) => {
        const child = spawn("sudo", ["-k", "-S", "chpasswd"], {
            stdio: ["pipe", "ignore", "pipe"]
        });
        let stderr = "";
        let settled = false;
        const done = (result) => { if (!settled) { settled = true; resolve(result); } };
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            done({ ok: false, message: "Timeout: sudo tidak merespons dalam 15 detik" });
        }, SUDO_TIMEOUT_MS);
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => { clearTimeout(timer); done({ ok: false, message: `Gagal menjalankan sudo: ${err.message}` }); });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) return done({ ok: true });
            const out = stderr.toLowerCase();
            if (out.includes("a password is required") || out.includes("sorry, try again") || out.includes("incorrect password") || out.includes("authentication failure")) {
                return done({ ok: false, message: "Password sudo saat ini salah" });
            }
            return done({ ok: false, message: `Gagal mengubah password (exit ${code}): ${stderr.trim() || "tidak diketahui"}` });
        });
        try {
            child.stdin.write(`${currentPassword}\n${SUDO_TARGET_USER}:${newPassword}\n`);
            child.stdin.end();
        } catch { /* spawn gagal — event 'error' sudah menangani */ }
    });
}

/**
 * POST /api/system-password/change
 * Body: { currentPassword, newPassword }
 */
router.post("/change", async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};

        const currentError = validateCurrentPassword(currentPassword);
        if (currentError) {
            return res.status(400).json({ error: currentError });
        }
        const strengthError = validateNewPassword(newPassword);
        if (strengthError) {
            return res.status(400).json({ error: strengthError });
        }
        if (newPassword === currentPassword) {
            return res.status(400).json({ error: "Password baru tidak boleh sama dengan password saat ini" });
        }

        const result = await runSudoChpasswd(currentPassword, newPassword);
        if (!result.ok) {
            return res.status(400).json({ error: result.message });
        }

        audit.superadminActivity({
            actorId: req.user.id,
            actorName: req.user.name,
            action: "system.sudo-password.change",
            targetType: "system",
            targetId: "sudo",
            targetName: SUDO_TARGET_USER,
            metadata: { user: SUDO_TARGET_USER },
            ip: req.ip || "",
            userAgent: req.headers["user-agent"] || ""
        });

        res.json({ ok: true, message: `Password sudo user ${SUDO_TARGET_USER} berhasil diubah` });
    } catch (err) {
        console.error("[SystemPassword] Error:", err.message);
        res.status(500).json({ error: err.message || "Gagal mengubah password sudo" });
    }
});

export default router;
