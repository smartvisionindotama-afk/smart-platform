/**
 * Auth — Password Visibility Toggle (Shared Util).
 *
 * M3-FIX v28g — helper bersama untuk eye toggle (👁/🙈) show/hide password.
 * Satu sumber kebenaran (sebelumnya pola yang sama di-dup di 5 tempat:
 * login.js, register.js, reset-password.js, settings/user.js & console
 * platform/login.js). Murni DOM — tanpa dependensi, aman dipanggil berulang.
 *
 * @module @smart/ui/modules/auth/password-toggle
 * @param {string} inputId  ID input[type=password]
 * @param {string} toggleId ID tombol toggle (button type="button")
 */
export function initPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;
    toggle.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        toggle.textContent = showing ? "👁" : "🙈";
        toggle.title = showing ? "Tampilkan password" : "Sembunyikan password";
        toggle.setAttribute("aria-label", toggle.title);
        input.focus();
    });
}
