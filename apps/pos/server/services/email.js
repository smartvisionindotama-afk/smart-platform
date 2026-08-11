/**
 * Email Service — Resend API (primary) + nodemailer SMTP (fallback).
 *
 * Mengirim email transaksional via Resend API (cepat, reliable).
 * Fallback ke SMTP jika Resend gagal atau tidak dikonfigurasi.
 *
 * Fitur:
 * - Resend API sebagai primary (response cepat, deliverability tinggi)
 * - Auto-fallback ke SMTP jika Resend error
 * - Connection pooling SMTP
 * - Auto-retry dengan exponential backoff (3x percobaan)
 * - Fire-and-forget: kirim email di background tanpa blok response
 *
 * Environment variables:
 *   RESEND_API_KEY — Resend API key (wajib untuk Resend mode)
 *   SMTP_HOST      — SMTP server hostname
 *   SMTP_PORT      — SMTP port (default: 465)
 *   SMTP_USER      — SMTP username
 *   SMTP_PASS      — SMTP password
 *   SMTP_FROM      — From email address (default: noreply@e-profit.id)
 *   APP_BASE_URL   — Base URL for reset links (default: http://localhost:5173)
 *   APP_NAME       — Application name for email templates (default: SMART Platform)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { Resend } from "resend";

// ── Load .env ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key && !process.env[key]) {
            process.env[key] = val;
        }
    }
}

// ── Config ──
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@e-profit.id";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";
const APP_NAME = process.env.APP_NAME || "SMART Platform";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const SMTP_TIMEOUT_MS = 10000;

let resendClient = null;
let smtpTransporter = null;

// ── Resend Client ──

function getResendClient() {
    if (resendClient) return resendClient;
    if (RESEND_API_KEY) {
        resendClient = new Resend(RESEND_API_KEY);
        console.log("[Email] ✅ Resend API configured");
    }
    return resendClient;
}

// ── SMTP Transporter (fallback) ──

function getSmtpTransporter() {
    if (smtpTransporter) return smtpTransporter;

    if (SMTP_HOST) {
        smtpTransporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
            pool: true,
            maxConnections: 2,
            maxMessages: 20,
            rateLimit: 5,
            connectionTimeout: SMTP_TIMEOUT_MS,
            greetingTimeout: SMTP_TIMEOUT_MS,
            socketTimeout: SMTP_TIMEOUT_MS
        });
        console.log(`[Email] SMTP fallback configured: ${SMTP_HOST}:${SMTP_PORT}`);
    }

    return smtpTransporter;
}

// ── Kirim via Resend API ──

/**
 * Kirim email via Resend API.
 * @returns {Promise<object>} Result dengan messageId
 */
async function sendViaResend({ to, subject, html }) {
    const client = getResendClient();
    if (!client) throw new Error("Resend not configured");

    const result = await client.emails.send({
        from: `SMART Platform <${SMTP_FROM}>`,
        to,
        subject,
        html
    });

    return result;
}

// ── Kirim via SMTP (fallback) ──

/**
 * Kirim email via SMTP dengan auto-retry.
 */
async function sendViaSmtp({ from, to, subject, html }) {
    const transport = getSmtpTransporter();
    if (!transport) throw new Error("SMTP not configured");

    const mailOptions = { from, to, subject, html };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await transport.sendMail(mailOptions);
            console.log(`[Email] SMTP ✅ Sent to ${to} (attempt ${attempt})`);
            return result;
        } catch (err) {
            console.error(`[Email] SMTP ❌ Attempt ${attempt}/${MAX_RETRIES}: ${err.message}`);
            if (attempt < MAX_RETRIES) {
                const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

// ── Public API ──

/**
 * Kirim email reset password — Resend primary, SMTP fallback.
 *
 * @param {string} to
 * @param {string} token
 * @param {string} name
 * @param {string} [accountType]
 * @returns {Promise<object>}
 */
export async function sendResetPasswordEmail(to, token, name, accountType = "user") {
    const displayName = accountType === "superadmin" ? "SMART Platform" : APP_NAME;
    const resetLink = `${APP_BASE_URL}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;
    const html = buildEmailHtml(name, resetLink, displayName);
    const subject = `Reset Password — ${displayName}`;

    // Priority 1: Resend API
    if (RESEND_API_KEY) {
        try {
            const result = await sendViaResend({ to, subject, html });
            console.log(`[Email] ✅ Resend: Reset password sent to ${to}`);
            return result;
        } catch (err) {
            console.error(`[Email] ⚠️ Resend failed: ${err.message}. Falling back to SMTP...`);
            // Fallback ke SMTP
        }
    }

    // Priority 2: SMTP fallback
    if (SMTP_HOST) {
        const result = await sendViaSmtp({
            from: SMTP_FROM,
            to,
            subject,
            html
        });
        console.log(`[Email] ✅ SMTP: Reset password sent to ${to}`);
        return result;
    }

    // Priority 3: Development mode (log only)
    console.log("[Email] ═══════════════════════════════════════");
    console.log("[Email] 📧 DEV MODE — Email logged, not sent");
    console.log("[Email] To:", to);
    console.log("[Email] Subject:", subject);
    console.log("[Email] ═══════════════════════════════════════");
    return { messageId: `dev-${Date.now()}@e-profit.id` };
}

/**
 * Kirim email secara fire-and-forget (background, tidak blocking).
 */
export function sendResetPasswordEmailAsync(to, token, name, accountType = "user") {
    sendResetPasswordEmail(to, token, name, accountType)
        .then(() => console.log(`[Email] Async complete for ${to}`))
        .catch((err) => console.error(`[Email] Async failed for ${to}:`, err.message));
}

/**
 * Build HTML email template.
 */
function buildEmailHtml(name, resetLink, displayName) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f1f5f9;margin:0;padding:0">
<table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh">
<tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<tr><td style="padding:32px 36px 12px;text-align:center">
<div style="font-size:2.5rem;margin-bottom:8px">🔐</div>
<h1 style="margin:0 0 4px;font-size:1.4rem;font-weight:700;color:#1e293b">Reset Password</h1>
<p style="margin:0 0 24px;font-size:0.9rem;color:#64748b">Klik tombol di bawah untuk mereset password Anda</p>
</td></tr>
<tr><td style="padding:0 36px 8px">
<p style="font-size:0.9rem;color:#374151;line-height:1.6">Halo <strong>${escHtml(name)}</strong>,</p>
<p style="font-size:0.88rem;color:#475569;line-height:1.6">Kami menerima permintaan reset password untuk akun ${escHtml(displayName)} Anda. Klik tombol di bawah untuk membuat password baru:</p>
</td></tr>
<tr><td style="padding:16px 36px;text-align:center">
<a href="${resetLink}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;text-decoration:none;border-radius:8px;font-size:0.95rem;font-weight:600;letter-spacing:0.3px">Reset Password</a>
</td></tr>
<tr><td style="padding:16px 36px 24px">
<p style="font-size:0.78rem;color:#94a3b8;line-height:1.5">Link ini berlaku selama <strong>1 jam</strong>. Jika Anda tidak meminta reset password, abaikan email ini.</p>
<p style="font-size:0.78rem;color:#94a3b8;line-height:1.5">PT SMART VISION INDOTAMA</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Generate cryptographically strong random token.
 * @param {number} length - Token length (default: 32)
 * @returns {string}
 */
export function generateToken(length = 32) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    if (typeof crypto !== "undefined" && crypto.randomBytes) {
        // Node.js crypto
        const bytes = crypto.randomBytes(length);
        for (let i = 0; i < length; i++) {
            result += chars.charAt(bytes[i] % chars.length);
        }
    } else {
        // Fallback
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return result + Date.now().toString(36);
}

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
