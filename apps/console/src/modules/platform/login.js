/**
 * Platform — Super Admin Login Page (Framework Module).
 *
 * Reusable superadmin login module for SMART Platform.
 * Self-contained — just import and use.
 * Aplikasi lain (inventory, e-profit, dll) tinggal import dan panggil.
 *
 * @module @smart/ui/modules/platform/login
 */

import { showForgotPasswordModal } from "@smart/ui/modules/auth/forgot-password";
import { initPasswordToggle } from "@smart/ui/modules/auth/password-toggle";

// Resolve logo: prefer stored superadmin logo, fallback to company API
async function resolveLogo() {
    let logo = null;
    try { logo = localStorage.getItem("smart_superadmin_logo"); } catch { /* ignore */ }
    if (logo) return logo;

    try {
        const resp = await fetch("/api/companies");
        if (resp.ok) {
            const data = await resp.json();
            const list = data?.data || data || [];
            const companies = Array.isArray(list) ? list : Object.values(list);
            const company = companies.find(c => c?.logo) || companies[0];
            return company?.logo || null;
        }
    } catch { /* silent */ }

    return null;
}

function setFavicon(url) {
    if (!url) return;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.href = url;
}

/**
 * Super Admin Login Page component.
 *
 * @param {object} [options]
 * @param {string} [options.logo] Optional company logo URL to replace emoji
 * @returns {string} HTML
 */
export function SuperAdminLoginPage({ logo } = {}) {
    const logoHtml = logo
        ? `<img src="${encodeURI(logo)}" alt="Logo" class="sa-logo-img" />`
        : `🚀`;

    const html = `
        <div id="sa-login-page" class="sa-login-page">
            <style>${getStyles()}</style>
            <div class="sa-login-card">
                <div class="sa-logo">${logoHtml}</div>
                <h1>SMART Platform</h1>
                <p class="sa-subtitle">Panel Administrasi Super Admin</p>
                <div class="sa-badge-wrap"><span class="sa-badge">🔒 Super Admin Only</span></div>

                <div id="sa-login-error" class="sa-login-error"></div>

                <div class="form-group">
                    <label for="sa-login-username">Username Super Admin</label>
                    <input type="text" id="sa-login-username" placeholder="Username Super Admin" autocomplete="email" autofocus />
                </div>

                <div class="form-group">
                    <label for="sa-login-password">Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="sa-login-password" placeholder="Masukkan password" autocomplete="current-password" />
                        <button type="button" id="sa-login-password-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                    </div>
                    <div class="login-forgot"><a id="sa-login-forgot-link">Lupa Password?</a></div>
                </div>

                <button id="sa-login-btn" class="sa-login-btn">Masuk sebagai Super Admin</button>
            </div>
        </div>
    `;

    return html;
}

/**
 * Initialize Super Admin login page after mount.
 *
 * @param {object} options
 * @param {Function} options.onSuccess Callback after successful login
 * @param {Function} options.onBackToUser Callback to return to user login
 * @param {Function} [options.loginFn] Optional custom login function, defaults to /api/superadmins/login
 */
export function initSuperAdminLoginPage({ onSuccess, onBackToUser: _onBackToUser, loginFn } = {}) {
    const btn = document.getElementById("sa-login-btn");
    const username = document.getElementById("sa-login-username");
    const password = document.getElementById("sa-login-password");
    const errorEl = document.getElementById("sa-login-error");
    if (!btn || !username || !password) return;

    const loginAPI = loginFn || defaultSuperAdminLogin;

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
            showError("Username Super Admin harus diisi");
            username.focus();
            return;
        }

        if (!pass) {
            showError("Password harus diisi");
            password.focus();
            return;
        }

        btn.disabled = true;
        btn.textContent = "Memverifikasi...";

        try {
            const userData = await loginAPI(user, pass);

            if (!userData) {
                showError("Username atau password salah");
                password.value = "";
                password.focus();
                btn.disabled = false;
                btn.textContent = "Masuk sebagai Super Admin";
                return;
            }

            const { Auth } = await import("@smart/core");

            // Set Auth's currentUser with superadmin data
            Auth.currentUser = {
                id: String(userData.id),
                name: userData.name,
                email: userData.email,
                institution: userData.institution || "PLATFORM",
                role: "superadmin"
            };

            // SP-027 M3: simpan JWT pair (access + refresh) via hook aplikasi
            try {
                if (typeof window !== "undefined" && typeof window.__SMART_AUTH_TOKEN_HOOK__ === "function") {
                    window.__SMART_AUTH_TOKEN_HOOK__(userData);
                }
            } catch (err) {
                console.warn("[SuperAdminLogin] Token hook error:", err);
            }

            if (typeof onSuccess === "function") {
                onSuccess();
            }
        } catch (err) {
            console.error("[SuperAdminLogin] Error:", err);
            showError("Terjadi kesalahan. Silakan coba lagi.");
            btn.disabled = false;
            btn.textContent = "Masuk sebagai Super Admin";
        }
    }

    btn.addEventListener("click", handleLogin);

    // M3-FIX v28g — eye toggle via shared helper (@smart/ui/modules/auth/password-toggle)
    initPasswordToggle("sa-login-password", "sa-login-password-toggle");

    // Forgot password
    document.getElementById("sa-login-forgot-link")?.addEventListener("click", showForgotPasswordModal);

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
 * Mount Super Admin login into a container element.
 * Resolves logo from stored superadmin settings or company API,
 * sets favicon and initializes the login page.
 */
export async function mountSuperAdminLogin(container = document.getElementById('app'), options = {}) {
    if (!container) return;
    const logo = await resolveLogo();
    if (logo) setFavicon(logo);
    container.innerHTML = SuperAdminLoginPage({ logo });
    initSuperAdminLoginPage(options);
}

/**
 * Default login function — POST to /api/superadmins/login
 */
async function defaultSuperAdminLogin(username, password) {
    try {
        const res = await fetch("/api/superadmins/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function getStyles() {
    return `
.sa-login-page {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(to bottom, #1e1b4b 0%, #982deb 100%);
    font-family: var(--font-sans, 'Inter', sans-serif);
}
.sa-login-card {
    background: #fff;
    border-radius: 16px;
    padding: 40px 36px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    position: relative;
    overflow: hidden;
    /* Ukuran form login superadmin diperkecil ~90% (skala seragam). */
    zoom: 0.9;
}
.sa-login-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #4f46e5, #dc2626, #4f46e5);
    background-size: 200% 100%;
    animation: sa-shimmer 3s ease-in-out infinite;
}
@keyframes sa-shimmer {
    0%, 100% { background-position: 0% 0%; }
    50% { background-position: 100% 0%; }
}
.sa-login-card .sa-logo { text-align: center; margin-bottom: 8px; font-size: 2.5rem; display:flex; justify-content:center; }
.sa-login-card .sa-logo-img { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #f1f5f9; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.sa-login-card h1 { text-align: center; font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
.sa-login-card .sa-subtitle { text-align: center; color: #64748b; font-size: 0.875rem; margin-bottom: 28px; }
.sa-login-card .sa-badge {
    display: inline-block; padding: 3px 12px; border-radius: 12px;
    background: #fef2f2; color: #dc2626; font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px;
}
.sa-login-card .sa-badge-wrap { text-align: center; }
.sa-login-card .form-group { margin-bottom: 18px; }
.sa-login-card .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
.sa-login-card .form-group input {
    width: 100%; padding: 10px 14px; border: 1.5px solid #d1d5db; border-radius: 8px;
    font-size: 0.9rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box; background: #f9fafb;
}
.sa-login-card .form-group input:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12); background: #fff; }
.sa-login-card .sa-login-btn {
    width: 100%; padding: 11px 0; background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: #fff; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s; margin-top: 6px;
}
.sa-login-card .sa-login-btn:hover { background: linear-gradient(135deg, #ef4444, #dc2626); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3); }
.sa-login-card .sa-login-btn:active { transform: scale(0.98); }
.sa-login-card .sa-login-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
.sa-login-card .sa-login-error {
    background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px;
    font-size: 0.85rem; margin-bottom: 16px; display: none; border: 1px solid #fecaca;
}
.sa-login-card .sa-login-error.visible { display: block; }
.sa-login-card .login-forgot {
    display: block; text-align: right; font-size: 0.8rem; margin-top: 6px;
}
.sa-login-card .login-forgot a {
    color: #dc2626; text-decoration: none; cursor: pointer; transition: color 0.15s;
}
.sa-login-card .login-forgot a:hover { color: #b91c1c; text-decoration: underline; }
.sa-login-card .password-wrapper { position: relative; }
.sa-login-card .password-wrapper input { padding-right: 44px; }
.sa-login-card .password-toggle {
    position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
    background: transparent; border: 0; cursor: pointer; font-size: 1.1rem;
    padding: 5px; line-height: 1; opacity: 0.6; transition: opacity 0.15s, background 0.15s;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.sa-login-card .password-toggle:hover { opacity: 1; background: #f1f5f9; }
`;
}
