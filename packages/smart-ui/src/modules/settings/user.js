/**
 * Settings — User Module (Framework Module).
 *
 * Reusable user management module for SMART Platform.
 * Accepts data service functions via dependency injection.
 *
 * @module @smart/ui/modules/settings/user
 */

import { Modal, Toast, Table, Pagination, EmptyState, Alert, Skeleton, UI } from "../../index.js";
import { initPasswordToggle } from "../auth/password-toggle.js";
import { esc } from "@smart/core";

/**
 * User Settings Page component.
 *
 * @param {object} options
 * @param {function} options.listUsers          Async (params) => { data, pagination }
 * @param {function} options.getUser            Async (id, bypassGuard) => object
 * @param {function} options.createUser         Async (data) => object
 * @param {function} options.updateUser         Async (id, data, bypassGuard) => object
 * @param {function} options.deleteUser         Async (id, bypassGuard) => boolean
 * @param {function} options.getRoleOptions     Sync () => string[]
 * @param {function} [options.listCompanies]    Async (params) => { data, pagination } — needed if currentCompanyCode not provided
 * @param {string|function} [options.currentCompanyCode]  Company code untuk auto-fill (disable dropdown);
 *        boleh string statis ATAU fungsi () => string (di-resolve saat render — M3-FIX v25)
 * @param {string|function} [options.currentCompanyName]  Company name untuk display (string atau fungsi)
 * @param {function} [options.createGuard]      Async (state) => { allowed:boolean, message?:string } —
 *        opsional; saat allowed=false tombol Tambah dinonaktifkan + banner info
 *        (dipakai enforcement kuota dari Master Platform). Additive.
 * @param {function} [options.roleGuard]        Async (role) => { allowed:boolean, message?:string } —
 *        opsional; diblokir saat submit user dengan role tertentu (mis. kuota
 *        role "kasir" penuh). Role-aware: role lain tetap bisa dibuat
 *        (M3-FIX v17). Additive.
 * @returns {{ render: function, init: function }}
 */
export function SettingsUserModule({ listUsers, getUser, createUser, updateUser, deleteUser, getRoleOptions, listCompanies, currentCompanyCode, currentCompanyName, createGuard, roleGuard }) {
    const state = { items: [], page: 1, limit: 10, total: 0, totalPages: 1, search: "", loading: false, formMode: null, editingId: null, guard: null };

    // M3-FIX v25 — konteks company di-resolve LAZY (string statis ATAU fungsi
    // () => string). Penting utk app yg me-import module ini secara eager di
    // router: saat boot, company context (SMART.Company) belum di-set sehingga
    // nilai awal null; fungsi memastikan nilai dibaca saat halaman benar-benar
    // dirender — dropdown "Pilih Company" tidak muncul utk owner/company tunggal.
    function resolveCompanyCode() {
        // Caller (wrapper) sudah meng-guard error di dalam fungsinya; di sini
        // cukup dukung dua bentuk: string statis atau fungsi () => string.
        const v = typeof currentCompanyCode === "function" ? currentCompanyCode() : currentCompanyCode;
        return v || "";
    }
    function resolveCompanyName() {
        const v = typeof currentCompanyName === "function" ? currentCompanyName() : currentCompanyName;
        return v || "";
    }
    function isSingleCompany() {
        return !!resolveCompanyCode();
    }
    let cachedCompanies = [];
    let addBtnRef = null;

    // ── Create Guard (opsional — enforcement kuota, SP-029 M2-FIX) ──
    async function refreshCreateGuard() {
        if (typeof createGuard !== "function") { state.guard = null; return; }
        try {
            state.guard = (await createGuard(state)) || { allowed: true };
        } catch (err) {
            console.warn("[SettingsUser] createGuard gagal — izinkan default:", err?.message);
            state.guard = { allowed: true };
        }
        updateGuardUI();
    }

    function updateGuardUI() {
        const blocked = state.guard && state.guard.allowed === false;
        if (addBtnRef) {
            addBtnRef.disabled = blocked;
            addBtnRef.title = blocked ? (state.guard.message || "") : "";
            addBtnRef.style.opacity = blocked ? "0.6" : "";
            addBtnRef.style.cursor = blocked ? "not-allowed" : "";
        }
        const guardEl = document.getElementById("user-guard-banner");
        if (guardEl) {
            // Banner tampil saat ada pesan info/peringatan (bisa disertai allowed:true
            // untuk kuota role kasir — role lain tetap bisa ditambahkan).
            const msg = state.guard && state.guard.message ? state.guard.message : "";
            if (msg) {
                guardEl.textContent = `⚠️ ${msg}`;
                guardEl.style.display = "block";
            } else {
                guardEl.textContent = "";
                guardEl.style.display = "none";
            }
        }
    }

    /**
     * Cek kuota per role saat submit (create & edit). Role-aware:
     * hanya role tertentu yang diblokir — role lain tetap diizinkan.
     * @param {string} role Role yang dipilih di form
     * @param {object} [ctx] Konteks edit: { isEdit:boolean, currentRole:string } —
     *        memungkinkan guard mengizinkan edit user kasir yang sudah ada
     *        (sudah terhitung kuota) saat kuota penuh, sejalan dengan server.
     * @returns {Promise<{ allowed: boolean, message?: string }>}
     */
    async function checkRoleGuard(role, ctx) {
        if (typeof roleGuard !== "function") return { allowed: true };
        try {
            const r = (await roleGuard(role, ctx)) || { allowed: true };
            return r;
        } catch (err) {
            console.warn("[SettingsUser] roleGuard gagal — izinkan default:", err?.message);
            return { allowed: true };
        }
    }

    async function loadCompanies() {
        if (isSingleCompany()) return; // No need to fetch all companies
        try {
            const result = await listCompanies({ page: 1, limit: 999 });
            cachedCompanies = result.data;
        } catch { cachedCompanies = []; }
    }

    function getCompanyName(code) {
        if (!code) return "-";
        // Single-company mode: use provided name
        if (isSingleCompany() && code === resolveCompanyCode()) {
            return resolveCompanyName() || code;
        }
        const c = cachedCompanies.find(c => c.code === code);
        return c ? c.name : code;
    }

    function render() {
        return `
        <div id="settings-user-page" class="crud-page">
            <style>${getStyles()}</style>
            <div class="page-header">
                <div>
                    <h1>User Management</h1>
                    <div class="header-subtitle">Kelola pengguna sistem</div>
                </div>
                <div class="page-actions">
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="user-search" placeholder="Cari user..." autocomplete="off" autocapitalize="off" spellcheck="false" data-form-type="other" data-lpignore="true" value="${esc(state.search)}" />
                        <button type="button" id="user-search-clear" class="search-clear" title="Hapus filter pencarian" style="display:none">×</button>
                    </div>
                </div>
            </div>
            <div id="user-guard-banner" class="create-guard-banner" style="display:none"></div>
            <div class="table-container">
                <div id="user-table-area"></div>
                <div id="user-pagination-area" class="pagination-container"></div>
                <div id="user-page-info" class="page-info"></div>
            </div>
        </div>`;
    }

    async function init() {
        await loadCompanies();
        const searchInput = document.getElementById("user-search");
        // M3-FIX v28d — tombol × (clear filter): Chrome autofill password manager
        // bisa mengisi kotak pencarian dengan kredensial login saat modal (yang
        // berisi field password) terbuka — id "user-search" dianggap field
        // username oleh heuristik browser. Filter harus terlihat & bisa dihapus.
        const clearBtn = document.getElementById("user-search-clear");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => { resetSearchFilter(); loadData(); });
            // "flex" (bukan "block") agar centering × tetap pakai stylesheet .search-clear
            clearBtn.style.display = state.search ? "flex" : "none";
        }
        if (searchInput) {
            searchInput.addEventListener("input", debounce((e) => {
                state.search = e.target.value.trim();
                state.page = 1;
                if (clearBtn) clearBtn.style.display = state.search ? "flex" : "none";
                loadData();
            }, 300));
        }
        const pageActions = document.querySelector("#settings-user-page .page-actions");
        if (pageActions) {
            addBtnRef = document.createElement("button");
            addBtnRef.className = "smart-btn smart-btn-primary";
            addBtnRef.innerHTML = "➕ Tambah User";
            addBtnRef.addEventListener("click", () => {
                if (state.guard && state.guard.allowed === false) {
                    showToast("warning", state.guard.message || "Kuota penuh — tambahan tidak diizinkan");
                    return;
                }
                openForm("create");
            });
            pageActions.appendChild(addBtnRef);
        }
        loadData();
    }

    async function loadData() {
        const tableArea = document.getElementById("user-table-area");
        const paginationArea = document.getElementById("user-pagination-area");
        const pageInfo = document.getElementById("user-page-info");
        if (!tableArea) return;
        state.loading = true;
        showSkeleton(tableArea);

        try {
            const result = await listUsers({ page: state.page, limit: state.limit, search: state.search, allCompanies: true });
            state.items = result.data;
            state.total = result.pagination.total;
            state.totalPages = result.pagination.totalPages;

            await refreshCreateGuard();
            tableArea.innerHTML = "";
            if (state.items.length === 0) {
                const blocked = state.guard && state.guard.allowed === false;
                tableArea.appendChild(EmptyState({
                    icon: "👥",
                    title: "Belum ada user",
                    description: state.search ? `Tidak ditemukan "${state.search}"` : (blocked ? (state.guard.message || "Klik Tambah User") : "Klik Tambah User"),
                    actionText: (state.search || blocked) ? "" : "Tambah User",
                    onAction: (state.search || blocked) ? null : () => openForm("create")
                }));
            } else if (window.innerWidth < 768) {
                renderUserCards(tableArea);
            } else {
                const table = Table({
                    columns: [
                        { key: "username", label: "Username", width: "110px" },
                        { key: "name", label: "Nama" },
                        { key: "email", label: "Email", width: "180px" },
                        { key: "companyCode", label: "Company", width: "160px", render: (val) => `<span class="badge-company">${esc(getCompanyName(val))}</span>` },
                        { key: "role", label: "Role", width: "120px", render: (val) => `<span class="badge-role">${val}</span>` },
                        { key: "active", label: "Status", width: "80px", align: "center", render: (val) => val ? '<span style="color:#16a34a">Aktif</span>' : '<span style="color:#dc2626">Nonaktif</span>' },
                        { key: "actions", label: "Aksi", width: "120px", align: "center", render: (_, row) => `<div class="action-buttons"><button class="action-btn action-btn-edit" data-edit="${row.id}">✏️ Edit</button><button class="action-btn action-btn-delete" data-delete="${row.id}">🗑️ Hapus</button></div>` }
                    ],
                    rows: state.items, striped: true, hoverable: true, bordered: false
                });
                tableArea.appendChild(table);
                tableArea.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openForm("edit", String(btn.dataset.edit))));
                tableArea.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => confirmDelete(String(btn.dataset.delete))));
            }
            if (paginationArea) {
                paginationArea.innerHTML = "";
                if (state.totalPages > 1) paginationArea.appendChild(Pagination({ current: state.page, total: state.total, pageSize: state.limit, onChange: (p) => { state.page = p; loadData(); } }));
            }
            if (pageInfo) {
                if (state.total === 0) { pageInfo.textContent = ""; return; }
                const start = (state.page - 1) * state.limit + 1;
                const end = Math.min(state.page * state.limit, state.total);
                pageInfo.textContent = `Menampilkan ${start}–${end} dari ${state.total} user`;
            }
        } catch (err) {
            console.error("[SettingsUser] Failed to load:", err);
            tableArea.innerHTML = "";
            tableArea.appendChild(Alert({ variant: "danger", message: "Gagal memuat data", dismissible: true }));
        } finally { state.loading = false; }
    }

    function renderUserCards(container) {
        const list = UI.CardList(state.items, (item) => {
            return `
                <div class="sm-card-header-row">
                    <div class="sm-card-name">${esc(item.name)}</div>
                </div>
                <div class="sm-card-details">
                    <div class="sm-card-detail-row"><span class="sm-card-label">Username</span><span class="sm-card-value">${esc(item.username)}</span></div>
                    <div class="sm-card-detail-row"><span class="sm-card-label">Email</span><span class="sm-card-value">${esc(item.email || "-")}</span></div>
                    <div class="sm-card-detail-row"><span class="sm-card-label">Role</span><span class="sm-card-value"><span class="badge-role">${esc(item.role)}</span></span></div>
                    <div class="sm-card-detail-row"><span class="sm-card-label">Status</span><span class="sm-card-value">${item.active ? '<span style="color:#16a34a">Aktif</span>' : '<span style="color:#dc2626">Nonaktif</span>'}</span></div>
                </div>
                <div class="sm-card-footer-row">
                    <div class="sm-card-footer-left"></div>
                    <div class="sm-card-footer-right">
                        <button class="sm-card-btn sm-card-btn-edit" data-edit="${item.id}">✏️ Edit</button>
                        <button class="sm-card-btn sm-card-btn-delete" data-delete="${item.id}">🗑️ Hapus</button>
                    </div>
                </div>
            `;
        });
        container.appendChild(list);
        UI.attachCardEvents(container, (id) => openForm("edit", id), (id) => confirmDelete(id));
    }

    function showSkeleton(container) {
        container.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.className = "skeleton-wrapper";
        wrapper.appendChild(Skeleton({ variant: "table-row", count: 5 }));
        container.appendChild(wrapper);
    }

    function buildCompanyOptions(selectedCode) {
        return cachedCompanies.map(c =>
            `<option value="${c.code}" ${c.code === selectedCode ? "selected" : ""}>${esc(c.name)} (${c.code})</option>`
        ).join("");
    }

    function getCompanyLabel() {
        const cc = resolveCompanyCode();
        const cn = resolveCompanyName();
        if (cn && cc) return `${esc(cn)} (${esc(cc)})`;
        return esc(cc || "");
    }

    async function openForm(mode, id = null) {
        state.formMode = mode;
        state.editingId = id;
        const isEdit = mode === "edit";
        const title = isEdit ? "Edit User" : "Tambah User Baru";
        const roles = await getRoleOptions();
        let formData = { username: "", name: "", email: "", role: "supervisor", companyCode: "", password: "" };

        if (isEdit && id) {
            try {
                const item = await getUser(id, true);
                if (item) formData = { username: item.username, name: item.name, email: item.email, role: item.role, companyCode: item.companyCode || "", password: "" };
            } catch { showToast("danger", "Gagal memuat data"); return; }
        }

        // Build company field: disabled input if single-company mode, else select dropdown
        const companyField = isSingleCompany()
            ? `<div class="form-group">
                <label for="f-company">Perusahaan</label>
                <input type="text" id="f-company" value="${getCompanyLabel()}" disabled style="background:#f3f4f6;cursor:not-allowed;" />
               </div>`
            : `<div class="form-group">
                <label for="f-company">Company <span class="required">*</span></label>
                <select id="f-company" required>
                    <option value="">— Pilih Company —</option>
                    ${buildCompanyOptions(formData.companyCode)}
                </select>
               </div>`;

        renderModal(title, `
            <div class="form-grid">
                ${companyField}
                <div class="form-group">
                    <label for="f-username">Username <span class="required">*</span></label>
                    <input type="text" id="f-username" value="${esc(formData.username)}" placeholder="Username" required autocomplete="off" data-form-type="other" data-lpignore="true" ${isEdit ? "readonly style='background:#f1f5f9'" : ""} />
                </div>
                <div class="form-group">
                    <label for="f-name">Nama Lengkap <span class="required">*</span></label>
                    <input type="text" id="f-name" value="${esc(formData.name)}" placeholder="Nama user" required />
                </div>
                <div class="form-group">
                    <label for="f-email">Email</label>
                    <input type="email" id="f-email" value="${esc(formData.email)}" placeholder="email@domain.com" autocomplete="off" data-lpignore="true" />
                </div>
                <div class="form-group">
                    <label for="f-role">Role</label>
                    <select id="f-role">${roles.map(r => `<option value="${r}" ${formData.role === r ? "selected" : ""}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("")}</select>
                </div>
                <div class="form-group full-width">
                    <label for="f-password">${isEdit ? "Password Baru" : "Password"} ${!isEdit ? '<span class="required">*</span>' : ""}</label>
                    <div class="password-wrapper">
                        <input type="password" id="f-password" placeholder="${isEdit ? "Kosongkan jika tidak diubah" : "Password user"}" autocomplete="new-password" data-lpignore="true" />
                        <button type="button" id="f-password-toggle" class="password-toggle" title="Tampilkan password" aria-label="Tampilkan password">👁</button>
                    </div>
                </div>
            </div>
        `, isEdit, id);
    }

    function renderModal(title, contentHTML, isEdit, editId) {
        const footer = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Tambah User"}</button>`;
        const overlay = Modal({ open: true, title, content: `<style>${modalStyles()}</style>${contentHTML}`, footer, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);
        setTimeout(() => document.getElementById(isSingleCompany() ? "f-username" : "f-company")?.focus(), 100);
        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => handleSubmit(isEdit, editId));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
        overlay.querySelectorAll("input, select").forEach(el => el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(isEdit, editId); } }));

        // M3-FIX v28g — eye toggle via shared helper (@smart/ui/modules/auth/password-toggle)
        initPasswordToggle("f-password", "f-password-toggle");
    }

    async function handleSubmit(isEdit, editId) {
        const name = document.getElementById("f-name")?.value?.trim();
        const username = document.getElementById("f-username")?.value?.trim();

        // In single-company mode, use the provided company code; otherwise from select
        const companyCode = isSingleCompany()
            ? resolveCompanyCode()
            : document.getElementById("f-company")?.value;

        if (!companyCode) { showToast("warning", "Sesi perusahaan tidak ditemukan. Silakan login ulang."); return; }
        if (!name) { showToast("warning", "Nama wajib diisi"); document.getElementById("f-name")?.focus(); return; }
        if (!username) { showToast("warning", "Username wajib diisi"); document.getElementById("f-username")?.focus(); return; }
        const pass = document.getElementById("f-password")?.value;
        if (!isEdit && !pass) { showToast("warning", "Password wajib diisi"); document.getElementById("f-password")?.focus(); return; }

        const selectedRole = document.getElementById("f-role")?.value || "supervisor";

        // SP-029 M2-FIX + M3-FIX v17 — defense in depth (role-aware):
        // kuota kasir hanya memblokir user ber-role "kasir"; admin/operator
        // tetap boleh dibuat. Cek ulang di sini (create & edit) karena server
        // juga menegakkan (routes/users.js).
        // Konteks edit: currentRole user yang sedang diedit (dari state.items)
        // agar guard bisa mengizinkan edit user kasir existing — sudah
        // terhitung kuota, sejalan dengan logika server (exclude _id).
        const editRow = isEdit ? (state.items.find(i => String(i.id) === String(editId))) : null;
        const roleCheck = await checkRoleGuard(selectedRole, { isEdit, currentRole: editRow ? (editRow.role || "") : "" });
        if (!roleCheck.allowed) {
            showToast("warning", roleCheck.message || "Kuota untuk role ini tercapai.");
            return;
        }
        if (!isEdit && typeof createGuard === "function") {
            const guard = (await createGuard(state)) || { allowed: true };
            if (!guard.allowed) {
                showToast("warning", guard.message || "Kuota penuh — tambahan tidak diizinkan");
                return;
            }
        }

        const data = {
            companyCode, username, name,
            email: document.getElementById("f-email")?.value?.trim() || "",
            role: selectedRole,
            password: pass || undefined
        };
        if (isEdit && !pass) delete data.password;
        try {
            if (isEdit && editId) { await updateUser(editId, data, true); showToast("success", "User berhasil diperbarui"); }
            else { await createUser(data); showToast("success", "User berhasil ditambahkan"); }
            // M3-FIX v28c — reset filter pencarian setelah aksi simpan/edit
            // (state + nilai DOM input) agar daftar penuh tampil & filter lama
            // yang tersembunyi tidak mengganjal (lihat resetSearchFilter).
            resetSearchFilter();
            removeModal(); loadData();
        } catch (err) { showToast("danger", `Gagal menyimpan: ${err.message || "Unknown"}`); }
    }

    function confirmDelete(id) {
        const item = state.items.find(i => i.id === id);
        const name = item ? item.name : `#${id}`;
        const footer = `<button class="smart-btn smart-btn-secondary" id="d-cancel">Batal</button>
            <button class="smart-btn smart-btn-danger" id="d-confirm">Ya, Hapus</button>`;
        const overlay = Modal({ open: true, title: "Konfirmasi Hapus",
            content: `<div class="delete-confirm"><p>Hapus user <span class="item-name">${esc(name)}</span>?</p><p style="font-size:0.85rem;color:#6b7280">Tindakan ini tidak dapat dibatalkan.</p></div>`,
            footer, closable: true, onClose: removeModal });
        overlay.querySelector("#d-confirm")?.setAttribute("style", "background:#dc2626;color:#fff;border-color:#dc2626;");
        document.body.appendChild(overlay);
        document.getElementById("d-cancel")?.addEventListener("click", removeModal);
        document.getElementById("d-confirm")?.addEventListener("click", async () => {
            try { await deleteUser(id, true); showToast("success", "User berhasil dihapus"); removeModal(); resetSearchFilter(); loadData(); }
            catch (err) { showToast("danger", `Gagal menghapus: ${err.message || "Unknown"}`); }
        });
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    function removeModal() {
        const overlay = document.querySelector(".smart-modal-overlay");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        state.formMode = null; state.editingId = null;
    }

    /**
     * M3-FIX v28c — reset filter pencarian setelah aksi simpan/edit/hapus.
     * state.search persisten di closure module (dibuat sekali) & input di-render
     * tanpa sinkronisasi ulang saat loadData — tanpa ini, filter lama tetap
     * aktif & tersembunyi sehingga tabel tampak "menghilang" setelah aksi.
     * Bersihkan JUGA nilai DOM input agar (a) tidak ada teks basi di kotak, dan
     * (b) debounce 300ms yang tertunda tidak mengembalikan filter lama (handler
     * membaca e.target.value saat fire — kosong = aman).
     */
    function resetSearchFilter() {
        state.search = ""; state.page = 1;
        const el = document.getElementById("user-search");
        if (el) el.value = "";
        const cb = document.getElementById("user-search-clear");
        if (cb) cb.style.display = "none";
    }

    function showToast(variant, message) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.style.cssText = "position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;max-width:400px;";
            document.body.appendChild(container);
        }
        const toast = Toast({ variant, message, onDismiss: () => toast.remove() });
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3500);
    }

    return { render, init };
}

// Framework First: esc dari @smart/core (util global, bukan duplikat lokal)
function debounce(fn, ms) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; }

/**
 * Style khusus KONTEN MODAL (M3-FIX v28f).
 * Modal di-append ke document.body (di luar #settings-user-page.crud-page),
 * sehingga style scoped halaman (.crud-page ...) TIDAK menjangkau isi modal
 * — tanpa ini eye toggle jatuh di bawah field password. Style ditanam di
 * dalam konten modal & di-scope .smart-modal-body (konvensi style form modal
 * di apps/{pos,inventory}/src/css/main.css).
 */
function modalStyles() {
    return `
.smart-modal-body .password-wrapper { position: relative; }
.smart-modal-body .form-group .password-wrapper input { padding-right: 42px; }
.smart-modal-body .password-toggle {
    position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
    background: transparent; border: 0; cursor: pointer; font-size: 1rem;
    padding: 4px; line-height: 1; opacity: 0.6; transition: opacity 0.15s, background 0.15s;
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
}
.smart-modal-body .password-toggle:hover { opacity: 1; background: #f1f5f9; }
`;
}

function getStyles() { return `
.crud-page { padding: 1.5rem; }
.crud-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.crud-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.crud-page .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.crud-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.crud-page .search-wrapper { position:relative; display:flex; align-items:center; }
.crud-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
.crud-page .search-wrapper input { padding:0.5rem 2.2rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.crud-page .search-wrapper .search-clear { position:absolute; right:0.4rem; top:50%; transform:translateY(-50%); width:20px; height:20px; border-radius:50%; border:0; background:#e5e7eb; color:#374151; font-size:0.85rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
.crud-page .search-wrapper .search-clear:hover { background:#d1d5db; color:#111827; }
.crud-page .search-wrapper input:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.crud-page .table-container { background:var(--smart-card-bg,#fff); border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); overflow:hidden; }
.crud-page .pagination-container { display:flex; justify-content:center; padding:1rem 0; }
.crud-page .action-buttons { display:flex; gap:0.5rem; justify-content:center; }
.crud-page .action-btn { padding:0.35rem 0.7rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; }
.crud-page .action-btn-edit { background:#eef2ff; color:#4f46e5; border-color:#c7d2fe; }
.crud-page .action-btn-edit:hover { background:#e0e7ff; }
.crud-page .action-btn-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.crud-page .action-btn-delete:hover { background:#fee2e2; }
.crud-page .skeleton-wrapper { padding:1rem; }
.crud-page .delete-confirm { text-align:center; padding:1rem 0; }
.crud-page .delete-confirm p { font-size:1rem; margin-bottom:1.5rem; color:var(--smart-text-secondary,#6b7280); }
.crud-page .delete-confirm .item-name { font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.crud-page .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.crud-page .form-grid .full-width { grid-column:1/-1; }
.crud-page .form-group { margin-bottom:0.25rem; }
.crud-page .form-group label { display:block; font-size:0.85rem; font-weight:500; margin-bottom:0.35rem; color:var(--smart-text-primary,#374151); }
.crud-page .form-group input, .crud-page .form-group textarea, .crud-page .form-group select { width:100%; padding:0.5rem 0.75rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; outline:none; box-sizing:border-box; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.crud-page .form-group input:focus, .crud-page .form-group select:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.crud-page .page-info { text-align:center; font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); padding:0.5rem 0 1rem; }
.crud-page .required { color:#dc2626; }
.crud-page .create-guard-banner { padding:0.6rem 1rem; margin:0 0 1rem; border-radius:6px; background:#fef3c7; border:1px solid #fcd34d; color:#92400e; font-size:0.85rem; }
.crud-page .badge-role { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.8rem; background:#eef2ff; color:#4f46e5; font-weight:500; }
.crud-page .badge-company { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.8rem; background:#f0fdf4; color:#16a34a; font-weight:500; }
@media (max-width:768px) { .crud-page .form-grid { grid-template-columns:1fr; } }
`;}
