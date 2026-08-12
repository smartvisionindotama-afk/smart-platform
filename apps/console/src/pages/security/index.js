/**
 * SMART Console — Ganti Password Server (Sudo) Page.
 *
 * SP-029 M6-FIX — rotasi password sudo/OS user langsung dari Console.
 * Menggunakan endpoint /api/system-password/change (superadmin only).
 *
 * @module console/pages/security
 */

import { showToast } from "@smart/ui";
import { initPasswordToggle } from "@smart/ui/modules/auth/password-toggle";
import { changeSudoPassword } from "../../services/system.js";
import { pageHeader, esc } from "../_shared.js";

const SEC_STYLES = `
.sec-card { max-width: 580px; }
.sec-form { display: flex; flex-direction: column; gap: 16px; }
.sec-field label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--muted, #6b7280); margin-bottom: 5px; }
.sec-field .smart-input { width: 100%; }
.sec-field .password-wrapper { position: relative; }
.sec-field .password-wrapper input { padding-right: 44px; }
.sec-field .password-toggle {
    position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
    background: transparent; border: 0; cursor: pointer; font-size: 1.05rem;
    padding: 5px; line-height: 1; opacity: 0.6; transition: opacity 0.15s, background 0.15s;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.sec-field .password-toggle:hover { opacity: 1; background: #f1f5f9; }
.sec-strength { display: flex; gap: 4px; margin-top: 8px; }
.sec-strength i { flex: 1; height: 5px; border-radius: 3px; background: #e5e7eb; transition: background 0.2s; }
.sec-strength i.ok { background: #10b981; }
.sec-strength i.mid { background: #f59e0b; }
.sec-strength i.bad { background: #ef4444; }
.sec-hint { font-size: 0.8rem; color: var(--muted, #6b7280); margin: 0; line-height: 1.5; }
.sec-hint code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 0.78rem; }
.sec-actions { display: flex; align-items: center; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
.sec-error { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; border: 1px solid #fecaca; display: none; }
.sec-error.visible { display: block; }
.sec-ok { background: #ecfdf5; color: #065f46; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; border: 1px solid #a7f3d0; display: none; }
.sec-ok.visible { display: block; }
`;

/** Skor kekuatan 0-4. */
function strengthScore(pw) {
    let s = 0;
    if (pw.length >= 10) s++;
    if (pw.length >= 14) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
}

/**
 * Render & init halaman Ganti Password Server.
 * @param {HTMLElement} container
 */
export async function renderSecurity(container) {
    container.innerHTML = `
        ${pageHeader("Ganti Password Server", "Rotasi password sudo (OS user) langsung dari Console")}
        <style>${SEC_STYLES}</style>
        <div class="cn-stack-gap">
            <div class="cn-card sec-card">
                <div class="cn-card-header"><span class="cn-card-title">🔑 Password Sudo</span></div>
                <div class="cn-card-body">
                    <p class="cn-muted sec-hint">
                        Mengubah password OS user <code>smartvision</code> (akses sudo/SSH server).
                        Berlaku untuk sesi login berikutnya. Password dikirim terenkripsi via HTTPS
                        dan tidak pernah dicatat di log server.
                    </p>
                    <form id="sec-form" class="sec-form" autocomplete="off">
                        <div class="sec-error" id="sec-error"></div>
                        <div class="sec-ok" id="sec-ok"></div>

                        <div class="sec-field">
                            <label for="sec-current">Password sudo saat ini</label>
                            <div class="password-wrapper">
                                <input class="smart-input" type="password" id="sec-current" placeholder="Password sudo yang sedang berlaku" autocomplete="current-password" />
                                <button type="button" id="sec-current-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                            </div>
                        </div>

                        <div class="sec-field">
                            <label for="sec-new">Password baru</label>
                            <div class="password-wrapper">
                                <input class="smart-input" type="password" id="sec-new" placeholder="Minimal 10 karakter, kombinasi huruf & angka" autocomplete="new-password" />
                                <button type="button" id="sec-new-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                            </div>
                            <div class="sec-strength" id="sec-strength"><i></i><i></i><i></i><i></i></div>
                        </div>

                        <div class="sec-field">
                            <label for="sec-confirm">Konfirmasi password baru</label>
                            <div class="password-wrapper">
                                <input class="smart-input" type="password" id="sec-confirm" placeholder="Ulangi password baru" autocomplete="new-password" />
                                <button type="button" id="sec-confirm-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                            </div>
                        </div>

                        <div class="sec-actions">
                            <button class="smart-btn smart-btn-primary" type="submit" id="sec-submit">🔄 Ganti Password</button>
                            <span class="cn-muted sec-hint">Perubahan berlaku untuk sesi sudo berikutnya — simpan password baru di tempat aman.</span>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const form = container.querySelector("#sec-form");
    const currentInput = container.querySelector("#sec-current");
    const newInput = container.querySelector("#sec-new");
    const confirmInput = container.querySelector("#sec-confirm");
    const submitBtn = container.querySelector("#sec-submit");
    const errorEl = container.querySelector("#sec-error");
    const okEl = container.querySelector("#sec-ok");
    const strengthBars = container.querySelectorAll("#sec-strength i");

    // Indikator kekuatan real-time
    newInput.addEventListener("input", () => {
        const score = strengthScore(newInput.value);
        strengthBars.forEach((bar, i) => {
            bar.className = i < score ? (score <= 2 ? "bad" : score === 3 ? "mid" : "ok") : "";
        });
    });

    initPasswordToggle("sec-current", "sec-current-toggle");
    initPasswordToggle("sec-new", "sec-new-toggle");
    initPasswordToggle("sec-confirm", "sec-confirm-toggle");

    function showError(msg) {
        errorEl.textContent = msg || "";
        errorEl.classList.toggle("visible", Boolean(msg));
        okEl.classList.remove("visible");
    }
    function showOk(msg) {
        okEl.textContent = msg || "";
        okEl.classList.toggle("visible", Boolean(msg));
        errorEl.classList.remove("visible");
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        showError("");
        showOk("");

        const current = currentInput.value;
        const next = newInput.value;
        const confirm = confirmInput.value;

        if (!current) { showError("Password sudo saat ini wajib diisi"); currentInput.focus(); return; }
        if (next.length < 10) { showError("Password baru minimal 10 karakter"); newInput.focus(); return; }
        if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) { showError("Password baru harus kombinasi huruf dan angka"); newInput.focus(); return; }
        if (next !== confirm) { showError("Konfirmasi password baru tidak cocok"); confirmInput.focus(); return; }
        if (next === current) { showError("Password baru tidak boleh sama dengan password saat ini"); newInput.focus(); return; }

        submitBtn.disabled = true;
        submitBtn.textContent = "Memproses...";
        try {
            const result = await changeSudoPassword(current, next);
            showOk(esc(result?.message || "Password sudo berhasil diubah"));
            currentInput.value = "";
            newInput.value = "";
            confirmInput.value = "";
            strengthBars.forEach((bar) => { bar.className = ""; });
        } catch (err) {
            showError(err.message || "Gagal mengubah password sudo");
            strengthBars.forEach((bar) => { bar.className = ""; });
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "🔄 Ganti Password";
        }
    });
}
