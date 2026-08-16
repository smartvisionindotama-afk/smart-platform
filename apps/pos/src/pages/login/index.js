/**
 * Login Page — SMART Kasir wrapper.
 *
 * Thin wrapper around the framework module @smart/ui/modules/auth/login.
 * Golden Rule 3 & 10: framework TIDAK diubah — branding POS di-override
 * via option title/subtitle (default framework "SMART Inventory").
 */
import { LoginPageComponent, initLoginPageComponent } from "@smart/ui";

// Branding hijau SMART Kasir — selaras dengan sidebar admin & header kasir
// (gradient hijau tua → hijau #064e3b → #059669), menggantikan latar ungu-biru
// bawaan module. Diterapkan sebagai <style> tambahan di AKHIR HTML login:
// selector sama dengan style module → yang muncul belakangan di DOM menang
// (cascade), tanpa menyentuh framework (inventory tetap ungu-biru).
const LOGIN_GREEN_STYLES = `
.login-page { background: linear-gradient(to bottom, #064e3b 0%, #059669 100%); }
.login-card .form-group input:focus { border-color: #059669; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
.login-card .login-btn { background: #059669; }
.login-card .login-btn:hover { background: #047857; }
.login-card .login-forgot a { color: #059669; }
.login-card .login-forgot a:hover { color: #047857; }
.login-card .login-google-btn:hover { border-color: #059669; }
.login-card .login-register a { color: #059669; }
.login-card .login-register a:hover { color: #047857; }
`;

export function LoginPage(options = {}) {
    return LoginPageComponent({
        ...options,
        title: options.title || "SMART Kasir",
        subtitle: options.subtitle || "Masuk ke SMART Kasir"
    }) + `<style>${LOGIN_GREEN_STYLES}</style>`;
}

export const initLoginPage = initLoginPageComponent;
