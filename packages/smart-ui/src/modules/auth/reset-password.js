/**
 * Auth — Reset Password Page (Framework Module).
 *
 * Reusable reset password page untuk semua aplikasi SMART Platform.
 * Diterima via email link: /reset-password?token=xxx&email=yyy
 *
 * @module @smart/ui/modules/auth/reset-password
 */

import { initPasswordToggle } from "./password-toggle.js";
import { escHtml } from "@smart/core";

/**
 * Render Reset Password page.
 * @param {string} token - Reset token from URL
 * @param {string} email - Email from URL
 * @returns {string} HTML
 */
export function ResetPasswordPage(token, email) {
    return `
        <div id="reset-page" class="reset-page">
            <style>
                .reset-page {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: linear-gradient(to bottom, #1e1b4b 0%, #982deb 100%);
                    font-family: var(--font-sans, 'Inter', sans-serif);
                }
                .reset-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 40px 36px;
                    width: 100%;
                    max-width: 400px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .reset-card .rp-logo { text-align: center; font-size: 2.5rem; margin-bottom: 8px; }
                .reset-card h1 { text-align: center; font-size: 1.4rem; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
                .reset-card .rp-subtitle { text-align: center; color: #64748b; font-size: 0.85rem; margin-bottom: 24px; }
                .reset-card .form-group { margin-bottom: 18px; }
                .reset-card .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
                .reset-card .form-group input {
                    width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db; border-radius: 8px;
                    font-size: 0.9rem; outline: none; box-sizing: border-box; transition: border-color 0.2s;
                    background: #f9fafb;
                }
                .reset-card .form-group input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); background: #fff; }
                .reset-card .rp-btn {
                    width: 100%; padding: 11px 0; background: #4f46e5; color: #fff; border: none;
                    border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
                    margin-top: 6px;
                }
                .reset-card .rp-btn:hover { background: #4338ca; }
                .reset-card .rp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .reset-card .rp-msg { padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 16px; display: none; }
                .reset-card .rp-msg.success { display: block; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
                .reset-card .rp-msg.error { display: block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                .reset-card .rp-email-display { text-align: center; font-size: 0.82rem; color: #64748b; margin-bottom: 20px; padding: 8px; background: #f1f5f9; border-radius: 6px; }
                .reset-card .password-wrapper { position: relative; }
                .reset-card .form-group .password-wrapper input { padding-right: 44px; }
                .reset-card .password-toggle {
                    position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
                    background: transparent; border: 0; cursor: pointer; font-size: 1.1rem;
                    padding: 5px; line-height: 1; opacity: 0.6; transition: opacity 0.15s, background 0.15s;
                    border-radius: 6px; display: flex; align-items: center; justify-content: center;
                }
                .reset-card .password-toggle:hover { opacity: 1; background: #f1f5f9; }
            </style>
            <div class="reset-card">
                <div class="rp-logo">🔐</div>
                <h1>Reset Password</h1>
                <p class="rp-subtitle">Buat password baru untuk akun Anda</p>
                <div id="rp-msg" class="rp-msg"></div>
                <div class="rp-email-display">📧 ${email ? escHtml(email) : 'Email tidak diketahui'}</div>
                <div class="form-group">
                    <label for="rp-password">Password Baru</label>
                    <div class="password-wrapper">
                        <input type="password" id="rp-password" placeholder="Minimal 6 karakter" autocomplete="new-password" autofocus />
                        <button type="button" id="rp-password-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="rp-confirm">Konfirmasi Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="rp-confirm" placeholder="Ulangi password baru" autocomplete="new-password" />
                        <button type="button" id="rp-confirm-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                    </div>
                </div>
                <button id="rp-btn" class="rp-btn">Simpan Password Baru</button>
                <p style="text-align:center;margin-top:16px"><a href="/" style="color:#4f46e5;font-size:0.82rem;text-decoration:none">← Kembali ke Login</a></p>
            </div>
        </div>
    `;
}

/**
 * Initialize Reset Password page after mount.
 * @param {string} token - Reset token
 * @param {string} email - User email
 */
export function initResetPasswordPage(token, email) {
    const btn = document.getElementById("rp-btn");
    const password = document.getElementById("rp-password");
    const confirm = document.getElementById("rp-confirm");
    const msgEl = document.getElementById("rp-msg");

    if (!btn || !password || !confirm) return;

    // M3-FIX v28g — eye toggle via shared helper
    initPasswordToggle("rp-password", "rp-password-toggle");
    initPasswordToggle("rp-confirm", "rp-confirm-toggle");

    async function handleReset() {
        const pass = password.value;
        const conf = confirm.value;

        if (!pass) {
            msgEl.className = "rp-msg error";
            msgEl.textContent = "Password baru harus diisi";
            return;
        }
        if (pass.length < 6) {
            msgEl.className = "rp-msg error";
            msgEl.textContent = "Password minimal 6 karakter";
            return;
        }
        if (pass !== conf) {
            msgEl.className = "rp-msg error";
            msgEl.textContent = "Password dan konfirmasi tidak sama";
            return;
        }

        btn.disabled = true;
        btn.textContent = "Menyimpan...";

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, email, password: pass })
            });
            const data = await res.json();
            if (res.ok) {
                msgEl.className = "rp-msg success";
                msgEl.textContent = data.message || "Password berhasil direset!";
                btn.style.display = "none";
                document.querySelector(".rp-email-display")?.remove();
                setTimeout(() => { window.location.href = "/"; }, 3000);
            } else {
                msgEl.className = "rp-msg error";
                msgEl.textContent = data.error || "Gagal mereset password";
                btn.disabled = false;
                btn.textContent = "Simpan Password Baru";
            }
        } catch (err) {
            msgEl.className = "rp-msg error";
            msgEl.textContent = "Terjadi kesalahan. Silakan coba lagi.";
            btn.disabled = false;
            btn.textContent = "Simpan Password Baru";
        }
    }

    btn.addEventListener("click", handleReset);
    confirm.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); handleReset(); }
    });
    password.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); confirm.focus(); }
    });
}

// Framework First: escHtml dari @smart/core (util global, bukan duplikat lokal)
