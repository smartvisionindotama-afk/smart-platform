/**
 * Auth — Forgot Password Modal (Framework Module).
 *
 * Reusable forgot password modal untuk semua aplikasi SMART Platform.
 * Cukup panggil showForgotPasswordModal().
 *
 * @module @smart/ui/modules/auth/forgot-password
 */

/**
 * Tampilkan modal lupa password.
 * Meminta email user, mengirim request ke /api/auth/forgot-password.
 */
export function showForgotPasswordModal() {
    const overlay = document.createElement("div");
    overlay.className = "fp-overlay";
    overlay.innerHTML = `
        <style>
            .fp-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif; }
            .fp-card { background:#fff; border-radius:16px; padding:32px 28px; width:100%; max-width:380px; box-shadow:0 20px 60px rgba(0,0,0,0.3); position:relative; }
            .fp-card h2 { margin:0 0 4px; font-size:1.25rem; font-weight:700; color:#1e293b; text-align:center; }
            .fp-card p { margin:0 0 20px; font-size:0.85rem; color:#64748b; text-align:center; }
            .fp-card .form-group { margin-bottom:16px; }
            .fp-card .form-group label { display:block; font-size:0.82rem; font-weight:600; color:#374151; margin-bottom:6px; }
            .fp-card .form-group input { width:100%; padding:10px 14px; border:1.5px solid #d1d5db; border-radius:8px; font-size:0.9rem; outline:none; box-sizing:border-box; transition:border-color 0.2s; }
            .fp-card .form-group input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.12); }
            .fp-card .fp-btn { width:100%; padding:11px 0; background:#4f46e5; color:#fff; border:none; border-radius:8px; font-size:0.9rem; font-weight:600; cursor:pointer; transition:all 0.2s; }
            .fp-card .fp-btn:hover { background:#4338ca; }
            .fp-card .fp-btn:disabled { opacity:0.6; cursor:not-allowed; }
            .fp-card .fp-cancel { display:block; text-align:center; margin-top:12px; font-size:0.82rem; color:#64748b; cursor:pointer; background:none; border:none; width:100%; }
            .fp-card .fp-cancel:hover { color:#1e293b; }
            .fp-card .fp-msg { padding:10px 14px; border-radius:8px; font-size:0.82rem; margin-bottom:16px; display:none; }
            .fp-card .fp-msg.success { display:block; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
            .fp-card .fp-msg.error { display:block; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
            .fp-card .fp-logo { text-align:center; font-size:2rem; margin-bottom:8px; }
        </style>
        <div class="fp-card">
            <div class="fp-logo">🔐</div>
            <h2>Lupa Password</h2>
            <p>Masukkan email terdaftar untuk menerima link reset password</p>
            <div id="fp-msg" class="fp-msg"></div>
            <div class="form-group">
                <label for="fp-email">Email</label>
                <input type="email" id="fp-email" placeholder="email@company.com" autocomplete="email" autofocus />
            </div>
            <button id="fp-submit" class="fp-btn">Kirim Link Reset</button>
            <button id="fp-cancel" class="fp-cancel">Batal</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const emailInput = overlay.querySelector("#fp-email");
    const submitBtn = overlay.querySelector("#fp-submit");
    const msgEl = overlay.querySelector("#fp-msg");

    function close() { overlay.remove(); }

    overlay.querySelector("#fp-cancel")?.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    submitBtn?.addEventListener("click", async () => {
        const email = emailInput?.value?.trim();
        if (!email) {
            msgEl.className = "fp-msg error";
            msgEl.textContent = "Email wajib diisi";
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = "Mengirim...";
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                msgEl.className = "fp-msg success";
                msgEl.textContent = data.message || "Link reset password telah dikirim ke email Anda.";
                submitBtn.style.display = "none";
            } else {
                msgEl.className = "fp-msg error";
                msgEl.textContent = data.error || "Gagal mengirim email reset";
                submitBtn.disabled = false;
                submitBtn.textContent = "Kirim Link Reset";
            }
        } catch (err) {
            msgEl.className = "fp-msg error";
            msgEl.textContent = "Terjadi kesalahan. Silakan coba lagi.";
            submitBtn.disabled = false;
            submitBtn.textContent = "Kirim Link Reset";
        }
    });

    emailInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitBtn?.click();
    });
    setTimeout(() => emailInput?.focus(), 100);
}
