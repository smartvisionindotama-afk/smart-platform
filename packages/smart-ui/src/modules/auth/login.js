/**
 * Auth — Login Page (Framework Module).
 *
 * Reusable login page untuk semua aplikasi SMART Platform.
 * Mendukung login username/password + Google Sign-In.
 *
 * Aplikasi tinggal import dan panggil:
 *   import { LoginPageComponent, initLoginPageComponent } from "@smart/ui";
 *
 * @module @smart/ui/modules/auth/login
 */

import { initPasswordToggle } from "./password-toggle.js";
import { escHtml } from "@smart/core";

/**
 * Render login page HTML.
 *
 * @param {object} [options]
 * @param {string} [options.logo] - URL logo perusahaan
 * @param {string} [options.title] - Judul aplikasi (default: "SMART Inventory")
 * @param {string} [options.subtitle] - Subtitle (default: "Masuk ke dashboard inventory")
 * @param {string} [options.googleClientId] - Google OAuth Client ID (jika ada)
 * @returns {string} HTML
 */
export function LoginPageComponent({ logo, title = "SMART Inventory", subtitle = "Masuk ke dashboard inventory" } = {}) {
    const logoHtml = logo
        ? `<img src="${encodeURI(logo)}" alt="Logo" class="login-logo-img" />`
        : `🚀`;

    return `
        <div id="login-page" class="login-page">
            <style>${getLoginStyles()}</style>
            <div class="login-card">
                <div class="logo">${logoHtml}</div>
                <h1>${escHtml(title)}</h1>
                <p class="subtitle">${escHtml(subtitle)}</p>

                <div id="login-error" class="login-error"></div>

                <div class="form-group">
                    <label for="login-username">Username/Email</label>
                    <input type="text" id="login-username" placeholder="Username atau Email" autocomplete="email" autofocus />
                </div>

                <div class="form-group">
                    <label for="login-password">Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="login-password" placeholder="Masukkan password" autocomplete="current-password" />
                        <button type="button" id="login-password-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                    </div>
                    <div class="login-forgot"><a id="login-forgot-link">Lupa Password?</a></div>
                </div>

                <button id="login-btn" class="login-btn">Masuk</button>

                <div class="login-divider">Atau</div>

                <button id="login-google-btn" class="login-google-btn">
                    <svg class="login-google-icon" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 2.64.43 5.19 1.22 7.6l7.94-6.17c-.44-1.28-.7-2.64-.63-4.04z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Masuk dengan Google
                </button>

                <div class="login-register">
                    Belum punya akun? <a id="login-register-link">Daftar</a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize login page after mount.
 *
 * @param {object} options
 * @param {Function} options.onSuccess - Callback setelah login sukses
 * @param {Function} options.loginFn - Async (username, password) => userData. Default: POST /api/auth/login
 * @param {object} [options.googleConfig] - Konfigurasi Google Sign-In
 * @param {string} [options.googleConfig.clientId] - Google OAuth Client ID (default: VITE_GOOGLE_CLIENT_ID)
 * @param {Function} [options.googleConfig.onRegisterClick] - Callback ketika user dari Google harus daftar
 * @param {Function} [options.onRegisterClick] - Callback ketika link "Daftar" diklik
 * @param {Function} [options.onForgotPassword] - Callback untuk forgot password (default: showForgotPasswordModal)
 *
 * SP-027 M3: setelah login sukses, jika tersedia hook `window.__SMART_AUTH_TOKEN_HOOK__`
 * (di-set oleh aplikasi), userData (berisi accessToken/refreshToken) diteruskan
 * ke hook tersebut untuk disimpan. Hook dipakai agar framework tidak perlu
 * dependensi ke @smart/api (layer independence).
 */

/** Teruskan data login (termasuk JWT) ke hook aplikasi jika tersedia. */
function notifyTokenHook(userData) {
    try {
        if (typeof window !== "undefined" && typeof window.__SMART_AUTH_TOKEN_HOOK__ === "function") {
            window.__SMART_AUTH_TOKEN_HOOK__(userData || {});
        }
    } catch (err) {
        console.warn("[Login] Token hook error:", err);
    }
}
export function initLoginPageComponent({
    onSuccess,
    loginFn,
    googleConfig = {},
    onRegisterClick,
    onForgotPassword
} = {}) {
    const btn = document.getElementById("login-btn");
    const username = document.getElementById("login-username");
    const password = document.getElementById("login-password");
    const errorEl = document.getElementById("login-error");

    if (!btn || !username || !password) return;

    const loginAPI = loginFn || defaultLoginFn;

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg;
        errorEl.classList.add("visible");
    }

    function clearError() {
        if (!errorEl) return;
        errorEl.textContent = "";
        errorEl.classList.remove("visible");
    }

    async function handleLogin() {
        clearError();
        const user = username.value.trim();
        const pass = password.value;

        if (!user) {
            showError("Username/Email harus diisi");
            username.focus();
            return;
        }

        if (!pass) {
            showError("Password harus diisi");
            password.focus();
            return;
        }

        btn.disabled = true;
        btn.textContent = "Memproses...";

        try {
            const userData = await loginAPI(user, pass);

            if (!userData) {
                showError("Username atau password salah");
                password.value = "";
                password.focus();
                btn.disabled = false;
                btn.textContent = "Masuk";
                return;
            }

            const { Auth } = await import("@smart/core");

            Auth.currentUser = {
                id: String(userData.id),
                name: userData.name,
                email: userData.email,
                institution: userData.institution,
                role: userData.role
            };

            // SP-027 M3: simpan JWT pair (access + refresh) via hook aplikasi
            notifyTokenHook(userData);

            if (typeof onSuccess === "function") {
                onSuccess();
            }
        } catch (err) {
            console.error("Login error:", err);
            showError(err.message || "Terjadi kesalahan. Silakan coba lagi.");
            btn.disabled = false;
            btn.textContent = "Masuk";
        }
    }

    btn.addEventListener("click", handleLogin);

    // Forgot password
    if (onForgotPassword) {
        document.getElementById("login-forgot-link")?.addEventListener("click", onForgotPassword);
    } else {
        // Default: import and show forgot password modal
        document.getElementById("login-forgot-link")?.addEventListener("click", async () => {
            const { showForgotPasswordModal } = await import("./forgot-password.js");
            showForgotPasswordModal();
        });
    }

    // Google login
    setupGoogleLogin({ showError, googleConfig, onSuccess, onRegisterClick });

    // Register link
    document.getElementById("login-register-link")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof onRegisterClick === "function") {
            onRegisterClick();
        }
    });

    // M3-FIX v28g — eye toggle via shared helper (@smart/ui/modules/auth/password-toggle)
    initPasswordToggle("login-password", "login-password-toggle");

    // Enter key support
    password.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleLogin();
        }
    });
    username.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            password.focus();
        }
    });
}

/**
 * Setup Google Sign-In button handler.
 * @param {object} opts
 */
function setupGoogleLogin({ showError, googleConfig, onSuccess, onRegisterClick }) {
    const googleBtn = document.getElementById("login-google-btn");
    if (!googleBtn) return;

    googleBtn.addEventListener("click", async () => {
        let viteGoogleClientId = "";
        try { viteGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""; } catch { /* non-Vite env */ }
        const GOOGLE_CLIENT_ID = googleConfig.clientId || window.VITE_GOOGLE_CLIENT_ID || viteGoogleClientId || "";

        if (!GOOGLE_CLIENT_ID) {
            showError("Login Google belum dikonfigurasi. Hubungi admin.");
            return;
        }

        try {
            if (typeof google === "undefined" || !google.accounts) {
                showError("Google Sign-In tidak tersedia. Muat ulang halaman atau coba browser lain.");
                return;
            }

            const client = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: "openid email profile",
                callback: async (response) => {
                    if (!response.access_token) {
                        showError("Gagal mendapatkan token akses Google");
                        return;
                    }

                    try {
                        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                            headers: { Authorization: `Bearer ${response.access_token}` }
                        });
                        if (!userRes.ok) throw new Error("Failed to get user info");
                        const userInfo = await userRes.json();

                        // Kirim ke backend
                        const backendRes = await fetch("/api/auth/google", {
                            method: "POST",
                            credentials: "include", // terima httpOnly cookie refresh token
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                credential: response.access_token,
                                email: userInfo.email,
                                name: userInfo.name
                            })
                        });

                        if (backendRes.ok) {
                            const data = await backendRes.json();
                            if (data.exists && data.user) {
                                // Auto-login
                                const { Auth } = await import("@smart/core");
                                Auth.currentUser = {
                                    id: String(data.user.id),
                                    name: data.user.name,
                                    email: data.user.email,
                                    institution: data.user.institution,
                                    role: data.user.role
                                };
                                // SP-027 M3: simpan JWT pair dari response Google login
                                notifyTokenHook(data);
                                if (typeof onSuccess === "function") onSuccess();
                            }
                        } else if (backendRes.status === 404) {
                            // First time Google login → redirect to registration
                            const errData = await backendRes.json().catch(() => ({}));
                            const googleUser = errData.googleUser || {};
                            // Prioritaskan googleConfig.onRegisterClick, fallback ke top-level onRegisterClick
                            const registerFn = googleConfig.onRegisterClick || onRegisterClick;
                            if (typeof registerFn === "function") {
                                registerFn({
                                    email: googleUser.email || userInfo.email,
                                    name: googleUser.name || userInfo.name
                                });
                            } else {
                                showError("Silakan daftar terlebih dahulu melalui link 'Daftar'.");
                            }
                        } else {
                            const errData = await backendRes.json().catch(() => ({}));
                            showError(errData.error || "Gagal login dengan Google");
                        }
                    } catch (fetchErr) {
                        console.error("Google user info error:", fetchErr);
                        showError("Gagal mendapatkan informasi pengguna");
                    }
                }
            });
            client.requestAccessToken();
        } catch (googleErr) {
            console.error("Google Sign-In error:", googleErr);
            showError("Gagal memulai Google Sign-In");
        }
    });
}

/**
 * Default login function — POST to /api/auth/login.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object|null>}
 */
async function defaultLoginFn(username, password) {
    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "include", // terima httpOnly cookie refresh token
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Username atau password salah");
        }

        return await res.json();
    } catch (err) {
        if (err.message) throw err;
        return null;
    }
}

function getLoginStyles() {
    return `
.login-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(to bottom, #1e1b4b 0%, #982deb 100%);
    font-family: var(--font-sans, 'Inter', sans-serif);
}
.login-card {
    background: #fff;
    border-radius: 16px;
    padding: 40px 36px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.login-card .logo { text-align: center; margin-bottom: 8px; font-size: 2.5rem; display:flex; justify-content:center; }
.login-card .login-logo-img { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #f1f5f9; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.login-card h1 { text-align: center; font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
.login-card .subtitle { text-align: center; color: #64748b; font-size: 0.875rem; margin-bottom: 28px; }
.login-card .form-group { margin-bottom: 18px; }
.login-card .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
.login-card .form-group input {
    width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db; border-radius: 8px;
    font-size: 0.9rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box; background: #f9fafb;
}
.login-card .form-group input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); background: #fff; }
.login-card .login-btn {
    width: 100%; padding: 11px 0; background: #4f46e5; color: #fff; border: none;
    border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer;
    transition: background 0.2s, transform 0.1s; margin-top: 6px;
}
.login-card .login-btn:hover { background: #4338ca; }
.login-card .login-btn:active { transform: scale(0.98); }
.login-card .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-card .login-error {
    background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px;
    font-size: 0.85rem; margin-bottom: 16px; display: none; border: 1px solid #fecaca;
}
.login-card .login-error.visible { display: block; }
.login-card .login-forgot { display: block; text-align: right; font-size: 0.8rem; margin-top: 6px; }
.login-card .login-forgot a { color: #4f46e5; text-decoration: none; cursor: pointer; transition: color 0.15s; }
.login-card .login-forgot a:hover { color: #4338ca; text-decoration: underline; }
.login-card .login-divider {
    display: flex; align-items: center; gap: 12px; margin: 20px 0;
    color: #94a3b8; font-size: 0.8rem;
}
.login-card .login-divider::before,
.login-card .login-divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
.login-card .login-google-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; padding: 10px 0; border: 1.5px solid #d1d5db; border-radius: 8px;
    background: #fff; font-size: 0.9rem; font-weight: 500; color: #374151;
    cursor: pointer; transition: all 0.2s;
}
.login-card .login-google-btn:hover { background: #f8fafc; border-color: #4f46e5; }
.login-card .login-google-btn:active { transform: scale(0.98); }
.login-card .login-google-icon { width: 18px; height: 18px; }
.login-card .login-register { text-align: center; margin-top: 18px; font-size: 0.85rem; color: #64748b; }
.login-card .login-register a { color: #4f46e5; text-decoration: none; font-weight: 600; cursor: pointer; }
.login-card .login-register a:hover { color: #4338ca; text-decoration: underline; }
.login-card .password-wrapper { position: relative; }
.login-card .password-wrapper input { padding-right: 44px; }
.login-card .password-toggle {
    position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
    background: transparent; border: 0; cursor: pointer; font-size: 1.1rem;
    padding: 5px; line-height: 1; opacity: 0.6; transition: opacity 0.15s, background 0.15s;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.login-card .password-toggle:hover { opacity: 1; background: #f1f5f9; }
`;
}

// Framework First: escHtml dari @smart/core (util global, bukan duplikat lokal)
