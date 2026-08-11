/**
 * Login Page — SMART Kasir wrapper.
 *
 * Thin wrapper around the framework module @smart/ui/modules/auth/login.
 * Golden Rule 3 & 10: framework TIDAK diubah — branding POS di-override
 * via option title/subtitle (default framework "SMART Inventory").
 */
import { LoginPageComponent, initLoginPageComponent } from "@smart/ui";

export function LoginPage(options = {}) {
    return LoginPageComponent({
        ...options,
        title: options.title || "SMART Kasir",
        subtitle: options.subtitle || "Masuk ke SMART Kasir"
    });
}

export const initLoginPage = initLoginPageComponent;
