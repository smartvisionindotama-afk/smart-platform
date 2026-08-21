/**
 * Login Page — SMART Kasir wrapper.
 *
 * Thin wrapper around the framework module @smart/ui/modules/auth/login.
 * Golden Rule 3 & 10: framework TIDAK diubah — branding POS di-override
 * via option title/subtitle (default framework "SMART Inventory").
 */
import { LoginPageComponent, initLoginPageComponent } from "@smart/ui";

// SITAMPAN-inspired purple-blue branding — gradient multi-layer pada background
// login, tombol utama, link, focus ring. Diterapkan sebagai <style> tambahan
// di AKHIR HTML login: selector sama dengan style module → cascade menang.
const LOGIN_PURPLE_STYLES = `
.login-page {
    background:
        radial-gradient(130% 95% at 18% 8%, rgba(194, 213, 255, 0.9) 0%, rgba(194, 213, 255, 0.05) 42%),
        radial-gradient(130% 90% at 92% 92%, rgba(255, 156, 208, 0.78) 0%, rgba(255, 156, 208, 0.05) 52%),
        radial-gradient(120% 110% at 10% 88%, rgba(76, 197, 255, 0.75) 0%, rgba(76, 197, 255, 0.05) 52%),
        linear-gradient(180deg, #edf3ff 0%, #bcd1ff 36%, #9ad9ff 100%);
}
.login-card {
    background: rgba(255,255,255,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.6);
    box-shadow: 0 14px 40px rgba(59, 78, 159, 0.22);
}
.login-card .form-group input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.18);
}
.login-card .login-btn {
    background: linear-gradient(90deg, #b036ff 0%, #3f83ff 100%);
    box-shadow: 0 10px 20px rgba(72, 106, 224, 0.35);
}
.login-card .login-btn:hover {
    background: linear-gradient(90deg, #a935f4 0%, #3f80ff 100%);
}
.login-card .login-forgot a { color: #667eea; }
.login-card .login-forgot a:hover { color: #764ba2; }
.login-card .login-google-btn:hover { border-color: #667eea; }
.login-card .login-register a { color: #667eea; }
.login-card .login-register a:hover { color: #764ba2; }
`;

export function LoginPage(options = {}) {
    return LoginPageComponent({
        ...options,
        title: options.title || "SMART Kasir",
        subtitle: options.subtitle || "Masuk ke SMART Kasir"
    }) + `<style>${LOGIN_PURPLE_STYLES}</style>`;
}

export const initLoginPage = initLoginPageComponent;
