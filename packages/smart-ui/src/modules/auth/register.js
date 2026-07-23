/**
 * Auth — Register Page (Framework Module).
 *
 * Reusable registration page untuk semua aplikasi SMART Platform.
 * Mendukung registrasi biasa + Google auto-fill, BUMDes/Pemdes wilayah selector.
 *
 * Aplikasi tinggal import dan panggil:
 *   import { RegisterPageComponent, initRegisterPageComponent } from "@smart/ui";
 *
 * @module @smart/ui/modules/auth/register
 */

import { UI } from "../../index.js";

/**
 * Render registration page HTML.
 *
 * @param {object} [prefill] - Data pre-filled (dari Google login)
 * @param {string} [prefill.email] - Email dari Google
 * @param {string} [prefill.name] - Nama dari Google
 * @param {object} [options]
 * @param {string[]} [options.companyTypes] - Daftar jenis perusahaan
 * @returns {string} HTML
 */
export function RegisterPageComponent(prefill = {}, { companyTypes } = {}) {
    const types = companyTypes || [
        "PT", "CV", "Yayasan", "Koperasi",
        "Firma", "Perorangan", "BUMDes", "Pemdes", "Lainnya"
    ];

    const typeLabels = {
        "PT": "PT (Perseroan Terbatas)",
        "CV": "CV (Commanditaire Vennootschap)",
        "Yayasan": "Yayasan",
        "Koperasi": "Koperasi",
        "Firma": "Firma",
        "Perorangan": "Perorangan",
        "BUMDes": "BUMDes (Badan Usaha Milik Desa)",
        "Pemdes": "Pemdes (Pemerintahan Desa)",
        "Lainnya": "Lainnya"
    };

    const isGoogle = !!(prefill.email || prefill.name);
    const safeEmail = isGoogle ? String(prefill.email || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') : '';
    const safeName = isGoogle ? String(prefill.name || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') : '';

    const typeOptions = types.map(t =>
        `<option value="${t}">${typeLabels[t] || t}</option>`
    ).join("");

    return `
        <div id="register-page" class="register-page">
            <style>${getRegisterStyles()}</style>
            <div class="register-card">
                <h1>${isGoogle ? '🔗 Lengkapi Data Perusahaan' : '📋 Daftar Perusahaan Baru'}</h1>
                <p class="subtitle">${isGoogle ? 'Data akun Google Anda sudah terisi. Lengkapi data perusahaan di bawah.' : 'Isi data berikut untuk mendaftarkan perusahaan Anda'}</p>

                <div id="register-error" class="register-error"></div>

                <div class="form-grid">
                    <div class="form-group">
                        <label for="reg-jenis">Jenis Perusahaan <span class="required">*</span></label>
                        <select id="reg-jenis">${typeOptions}</select>
                    </div>
                    <div class="form-group">
                        <label for="reg-kode">Kode Perusahaan</label>
                        <input type="text" id="reg-kode" readonly />
                        <div class="kode-info">Akan digenerate otomatis</div>
                    </div>

                    <!-- Wilayah Section (BUMDes/Pemdes) -->
                    <div class="wilayah-section" id="wilayah-section">
                        <div class="wilayah-title">📍 Pilih Wilayah Desa</div>
                        <div class="wilayah-grid">
                            <div class="form-group">
                                <label for="reg-provinsi">Provinsi <span class="required">*</span></label>
                                <select id="reg-provinsi"><option value="">-- Pilih Provinsi --</option></select>
                            </div>
                            <div class="form-group">
                                <label for="reg-kabupaten">Kabupaten <span class="required">*</span></label>
                                <select id="reg-kabupaten" disabled><option value="">-- Pilih Kabupaten --</option></select>
                            </div>
                            <div class="form-group">
                                <label for="reg-kecamatan">Kecamatan <span class="required">*</span></label>
                                <select id="reg-kecamatan" disabled><option value="">-- Pilih Kecamatan --</option></select>
                            </div>
                            <div class="form-group">
                                <label for="reg-desa">Desa <span class="required">*</span></label>
                                <select id="reg-desa" disabled><option value="">-- Pilih Desa --</option></select>
                            </div>
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label for="reg-name">Nama Perusahaan <span class="required">*</span></label>
                        <input type="text" id="reg-name" placeholder="Nama perusahaan / lembaga" required />
                    </div>
                    <div class="form-group">
                        <label for="reg-phone">No. Telepon</label>
                        <input type="text" id="reg-phone" placeholder="021-xxxxxxx" />
                    </div>
                    <div class="form-group">
                        <label for="reg-email">Email Admin <span class="required">*</span></label>
                        <input type="email" id="reg-email" placeholder="admin@perusahaan.com" ${isGoogle ? 'readonly value="' + safeEmail + '"' : 'required'} />
                        ${isGoogle ? '<div class="kode-info">Email dari akun Google Anda</div>' : ''}
                    </div>
                    <div class="form-group">
                        <label for="reg-admin">Nama Admin <span class="required">*</span></label>
                        <input type="text" id="reg-admin" placeholder="Nama lengkap admin" ${isGoogle ? 'readonly value="' + safeName + '"' : 'required'} />
                        ${isGoogle ? '<div class="kode-info">Nama dari akun Google Anda</div>' : ''}
                    </div>
                    ${!isGoogle ? `
                    <div class="form-group">
                        <label for="reg-password">Password <span class="required">*</span></label>
                        <input type="password" id="reg-password" placeholder="Minimal 6 karakter" required />
                    </div>
                    <div class="form-group">
                        <label for="reg-password-confirm">Konfirmasi Password <span class="required">*</span></label>
                        <input type="password" id="reg-password-confirm" placeholder="Ulangi password" required />
                    </div>
                    ` : ''}
                    <div class="form-group full-width">
                        <label for="reg-address">Alamat</label>
                        <textarea id="reg-address" placeholder="Alamat lengkap perusahaan" class="reg-textarea"></textarea>
                    </div>
                </div>

                <button id="register-btn" class="register-btn">${isGoogle ? 'Daftar dengan Google' : 'Daftar & Mulai'}</button>

                <div class="register-back">
                    Sudah punya akun? <a id="register-back-link">Masuk</a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize registration page after mount.
 *
 * @param {object} options
 * @param {Function} options.onSuccess - Callback setelah registrasi sukses, menerima (regData)
 * @param {Function} options.onBackToLogin - Callback kembali ke login
 * @param {object} [options.prefill] - Data pre-filled (dari Google)
 * @param {Function} [options.registerFn] - Async (formData) => result. Default: POST /api/auth/register
 * @param {Function} [options.generateCodeFn] - Async (jenis) => code. Default: GET /api/auth/register/code
 * @param {string} [options.wilayahBaseUrl] - Base URL untuk API wilayah. Default: "/api/wilayah"
 */
export function initRegisterPageComponent({
    onSuccess,
    onBackToLogin,
    prefill = {},
    registerFn,
    generateCodeFn,
    wilayahBaseUrl = "/api/wilayah"
} = {}) {
    const btn = document.getElementById("register-btn");
    const jenis = document.getElementById("reg-jenis");
    const kode = document.getElementById("reg-kode");
    const name = document.getElementById("reg-name");
    const phone = document.getElementById("reg-phone");
    const email = document.getElementById("reg-email");
    const admin = document.getElementById("reg-admin");
    const password = document.getElementById("reg-password");
    const passwordConfirm = document.getElementById("reg-password-confirm");
    const address = document.getElementById("reg-address");
    const errorEl = document.getElementById("register-error");
    const backLink = document.getElementById("register-back-link");
    const wilayahSection = document.getElementById("wilayah-section");
    const provinsi = document.getElementById("reg-provinsi");
    const kabupaten = document.getElementById("reg-kabupaten");
    const kecamatan = document.getElementById("reg-kecamatan");
    const desa = document.getElementById("reg-desa");

    // State for cascading wilayah
    const wilayahState = { selectedDesaCode: null, ssProvinsi: null, ssKabupaten: null, ssKecamatan: null, ssDesa: null };

    const isGoogle = !!(prefill.email || prefill.name);
    const registerAPI = registerFn || defaultRegisterFn;
    const generateAPI = generateCodeFn || defaultGenerateCodeFn;

    if (!isGoogle) {
        if (!btn || !jenis || !name || !email || !admin || !password) return;
    } else {
        if (!btn || !jenis || !name || !email || !admin) return;
    }

    // ── Helper functions ──
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

    function isWilayahType(type) {
        return type === "BUMDes" || type === "Pemdes";
    }

    function toggleWilayahSection() {
        if (!wilayahSection) return;
        wilayahSection.classList.toggle("visible", isWilayahType(jenis.value));
    }

    // ── Wilayah: SearchableSelect helpers ──
    function initSearchableSelect(selectEl, placeholder, onChange) {
        const key = `ss${selectEl.id.replace('reg-', '').charAt(0).toUpperCase() + selectEl.id.replace('reg-', '').slice(1)}`;
        const existing = wilayahState[key];
        if (existing) {
            existing.updateOptions();
            return existing;
        }

        try {
            const ss = UI.SearchableSelect(selectEl, { placeholder, onChange });
            wilayahState[key] = ss;
            return ss;
        } catch {
            selectEl.addEventListener("change", () => onChange(selectEl.value));
            return null;
        }
    }

    async function loadProvinces() {
        if (!provinsi) return;
        provinsi.innerHTML = '<option value="">-- Pilih Provinsi --</option>';
        try {
            const res = await fetch(`${wilayahBaseUrl}/provinces`);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    data.data.forEach(p => {
                        const opt = document.createElement("option");
                        opt.value = p.code;
                        opt.textContent = p.name;
                        provinsi.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.error("[Register] Failed to load provinces:", err);
        }
        initSearchableSelect(provinsi, "Ketik nama provinsi...", (value) => loadRegencies(value));
    }

    async function loadRegencies(provCode) {
        if (!kabupaten) return;
        kabupaten.innerHTML = '<option value="">-- Pilih Kabupaten --</option>';
        if (wilayahState.ssKabupaten) wilayahState.ssKabupaten.setDisabled(true);
        kecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
        if (wilayahState.ssKecamatan) wilayahState.ssKecamatan.setDisabled(true);
        desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
        if (wilayahState.ssDesa) wilayahState.ssDesa.setDisabled(true);
        wilayahState.selectedDesaCode = null;
        if (!provCode) return;
        try {
            const res = await fetch(`${wilayahBaseUrl}/${provCode}/regencies`);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    data.data.forEach(k => {
                        const opt = document.createElement("option");
                        opt.value = k.code;
                        opt.textContent = k.name;
                        kabupaten.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.error("[Register] Failed to load regencies:", err);
        }
        const ss = initSearchableSelect(kabupaten, "Ketik nama kabupaten...", (value) => loadDistricts(provCode, value));
        if (ss) ss.setDisabled(false);
        else kabupaten.disabled = false;
    }

    async function loadDistricts(provCode, kabCode) {
        if (!kecamatan) return;
        kecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
        if (wilayahState.ssKecamatan) wilayahState.ssKecamatan.setDisabled(true);
        desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
        if (wilayahState.ssDesa) wilayahState.ssDesa.setDisabled(true);
        wilayahState.selectedDesaCode = null;
        if (!provCode || !kabCode) return;
        try {
            const res = await fetch(`${wilayahBaseUrl}/${provCode}/${kabCode}/districts`);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    data.data.forEach(k => {
                        const opt = document.createElement("option");
                        opt.value = k.code;
                        opt.textContent = k.name;
                        kecamatan.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.error("[Register] Failed to load districts:", err);
        }
        const ss = initSearchableSelect(kecamatan, "Ketik nama kecamatan...", (value) => loadVillages(provCode, kabCode, value));
        if (ss) ss.setDisabled(false);
        else kecamatan.disabled = false;
    }

    async function loadVillages(provCode, kabCode, kecCode) {
        if (!desa) return;
        desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
        if (wilayahState.ssDesa) wilayahState.ssDesa.setDisabled(true);
        wilayahState.selectedDesaCode = null;
        if (!provCode || !kabCode || !kecCode) return;
        try {
            const res = await fetch(`${wilayahBaseUrl}/${provCode}/${kabCode}/${kecCode}/villages`);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    data.data.forEach(d => {
                        const opt = document.createElement("option");
                        opt.value = d.code;
                        opt.textContent = d.name;
                        desa.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.error("[Register] Failed to load villages:", err);
        }
        const ss = initSearchableSelect(desa, "Ketik nama desa...", (value) => {
            wilayahState.selectedDesaCode = value || null;
            updateKode();
        });
        if (ss) ss.setDisabled(false);
        else desa.disabled = false;
    }

    async function updateKode() {
        const selectedJenis = jenis.value;
        if (isWilayahType(selectedJenis) && wilayahState.selectedDesaCode) {
            kode.value = `${selectedJenis}-${wilayahState.selectedDesaCode}`;
            return;
        }
        try {
            const code = await generateAPI(selectedJenis);
            if (kode) kode.value = code;
        } catch {
            if (kode) kode.value = `${selectedJenis}-XXX`;
        }
    }

    // ── Event: Jenis berubah ──
    jenis.addEventListener("change", () => {
        toggleWilayahSection();
        if (isWilayahType(jenis.value)) {
            loadProvinces();
            kabupaten.innerHTML = '<option value="">-- Pilih Kabupaten --</option>';
            kabupaten.disabled = true;
            kecamatan.innerHTML = '<option value="">-- Pilih Kecamatan --</option>';
            kecamatan.disabled = true;
            desa.innerHTML = '<option value="">-- Pilih Desa --</option>';
            desa.disabled = true;
            wilayahState.selectedDesaCode = null;
            kode.value = jenis.value + "-...";
        } else {
            updateKode();
        }
    });

    // Initial setup
    toggleWilayahSection();
    updateKode();

    // ── Back to login ──
    if (backLink && typeof onBackToLogin === "function") {
        backLink.addEventListener("click", (e) => {
            e.preventDefault();
            onBackToLogin();
        });
    }

    // ── Submit registration ──
    async function handleRegister() {
        clearError();

        const jenisVal = jenis.value;
        const nameVal = name.value.trim();
        const emailVal = email.value.trim();
        const adminVal = admin.value.trim();
        const passVal = isGoogle ? "" : (password ? password.value : "");
        const passConfirmVal = isGoogle ? "" : (passwordConfirm ? passwordConfirm.value : "");
        const phoneVal = phone.value.trim();
        const addressVal = address.value.trim();

        // Validasi
        if (!nameVal) { showError("Nama perusahaan wajib diisi"); name.focus(); return; }
        if (!adminVal) { showError("Nama admin wajib diisi"); admin.focus(); return; }
        if (!emailVal) { showError("Email admin wajib diisi"); email.focus(); return; }

        if (isWilayahType(jenisVal) && !wilayahState.selectedDesaCode) {
            showError("Silakan pilih wilayah desa untuk perusahaan " + jenisVal);
            return;
        }

        if (!isGoogle) {
            if (!passVal || passVal.length < 6) {
                showError("Password minimal 6 karakter"); password.focus(); return;
            }
            if (passVal !== passConfirmVal) {
                showError("Konfirmasi password tidak cocok"); passwordConfirm.focus(); return;
            }
        }

        btn.disabled = true;
        btn.textContent = "Mendaftarkan...";

        try {
            const body = {
                jenis: jenisVal,
                name: nameVal,
                adminName: adminVal,
                adminEmail: emailVal,
                phone: phoneVal,
                address: addressVal
            };

            if (isWilayahType(jenisVal) && wilayahState.selectedDesaCode) {
                body.desaCode = wilayahState.selectedDesaCode;
                body.code = `${jenisVal}-${wilayahState.selectedDesaCode}`;
            }

            if (isGoogle) {
                body.isGoogle = true;
            } else {
                body.adminPassword = passVal;
            }

            const result = await registerAPI(body);

            if (typeof onSuccess === "function") {
                await onSuccess(result);
            }
        } catch (err) {
            console.error("Registration error:", err);
            // Jika error duplicate code, refresh kode agar user bisa coba lagi
            if (err.message && err.message.includes("Kode perusahaan sudah digunakan")) {
                await updateKode();
                showError("Kode perusahaan sudah digunakan. Kode baru telah digenerate. Silakan klik Daftar lagi.");
            } else {
                showError(err.message || "Terjadi kesalahan. Silakan coba lagi.");
            }
        } finally {
            btn.disabled = false;
            btn.textContent = isGoogle ? "Daftar dengan Google" : "Daftar & Mulai";
        }
    }

    btn.addEventListener("click", handleRegister);

    if (!isGoogle && passwordConfirm) {
        passwordConfirm.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); handleRegister(); }
        });
    }
}

/**
 * Default register function — POST to /api/auth/register.
 * @param {object} data
 * @returns {Promise<object>}
 */
async function defaultRegisterFn(data) {
    const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Gagal mendaftarkan perusahaan");
    return result;
}

/**
 * Default generate code function — GET /api/auth/register/code.
 * @param {string} jenis
 * @returns {Promise<string>}
 */
async function defaultGenerateCodeFn(jenis) {
    const res = await fetch(`/api/auth/register/code?jenis=${encodeURIComponent(jenis)}`);
    if (res.ok) {
        const data = await res.json();
        return data.code;
    }
    return `${jenis}-XXX`;
}

function getRegisterStyles() {
    return `
.register-page {
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh; background: linear-gradient(to bottom, #1e1b4b 0%, #982deb 100%);
    font-family: var(--font-sans, 'Inter', sans-serif); padding: 2rem 1rem; box-sizing: border-box;
}
.register-card {
    background: #fff; border-radius: 16px; padding: 36px 32px;
    width: 100%; max-width: 520px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.register-card h1 { text-align: center; font-size: 1.4rem; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
.register-card .subtitle { text-align: center; color: #64748b; font-size: 0.85rem; margin-bottom: 24px; }
.register-card .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.register-card .form-grid .full-width { grid-column: 1 / -1; }
.register-card .form-group { margin-bottom: 0; }
.register-card .form-group label { display: block; font-size: 0.82rem; font-weight: 600; color: #374151; margin-bottom: 5px; }
.register-card .form-group .required { color: #dc2626; }
.register-card .form-group input,
.register-card .form-group select { width: 100%; padding: 9px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 0.88rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; background: #f9fafb; color: #1e293b; }
.register-card .form-group input:focus,
.register-card .form-group select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); background: #fff; }
.register-card .form-group input:read-only { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
.register-card .kode-info { font-size: 0.78rem; color: #6b7280; margin-top: 4px; }
.register-card .register-btn { width: 100%; padding: 11px 0; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; margin-top: 8px; }
.register-card .register-btn:hover { background: #4338ca; }
.register-card .register-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.register-card .register-error { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 16px; display: none; border: 1px solid #fecaca; }
.register-card .register-error.visible { display: block; }
.register-card .register-back { text-align: center; margin-top: 16px; font-size: 0.85rem; color: #64748b; }
.register-card .register-back a { color: #4f46e5; text-decoration: none; font-weight: 600; cursor: pointer; }
.register-card .register-back a:hover { color: #4338ca; text-decoration: underline; }
.register-card .reg-textarea { width: 100%; padding: 9px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 0.88rem; outline: none; box-sizing: border-box; background: #f9fafb; resize: vertical; min-height: 60px; }
.register-card .reg-textarea:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); background: #fff; }
.wilayah-section { grid-column: 1 / -1; display: none; margin-top: 4px; padding: 16px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; }
.wilayah-section.visible { display: block; }
.wilayah-section .wilayah-title { font-size: 0.82rem; font-weight: 700; color: #166534; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.wilayah-section .wilayah-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 480px) { .register-card .form-grid { grid-template-columns: 1fr; } .register-card { padding: 24px 18px; } .wilayah-section .wilayah-grid { grid-template-columns: 1fr; } }
`;
}
