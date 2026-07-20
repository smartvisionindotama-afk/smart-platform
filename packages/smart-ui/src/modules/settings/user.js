/**
 * Settings — User Module (Framework Module).
 *
 * Reusable user management module for SMART Platform.
 * Accepts data service functions via dependency injection.
 *
 * @module @smart/ui/modules/settings/user
 */

import { Modal, Toast, Table, Pagination, EmptyState, Alert, Skeleton } from "../../index.js";

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
 * @param {string}   [options.currentCompanyCode]  Company code untuk auto-fill (disable dropdown)
 * @param {string}   [options.currentCompanyName]  Company name untuk display
 * @returns {{ render: function, init: function }}
 */
export function SettingsUserModule({ listUsers, getUser, createUser, updateUser, deleteUser, getRoleOptions, listCompanies, currentCompanyCode, currentCompanyName }) {
    const state = { items: [], page: 1, limit: 10, total: 0, totalPages: 1, search: "", loading: false, formMode: null, editingId: null };
    const singleCompanyMode = !!currentCompanyCode;
    let cachedCompanies = [];

    async function loadCompanies() {
        if (singleCompanyMode) return; // No need to fetch all companies
        try {
            const result = await listCompanies({ page: 1, limit: 999 });
            cachedCompanies = result.data;
        } catch { cachedCompanies = []; }
    }

    function getCompanyName(code) {
        if (!code) return "-";
        // Single-company mode: use provided name
        if (singleCompanyMode && code === currentCompanyCode) {
            return currentCompanyName || code;
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
                        <input type="text" id="user-search" placeholder="Cari user..." autocomplete="off" />
                    </div>
                </div>
            </div>
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
        if (searchInput) {
            searchInput.addEventListener("input", debounce((e) => {
                state.search = e.target.value.trim();
                state.page = 1;
                loadData();
            }, 300));
        }
        const pageActions = document.querySelector("#settings-user-page .page-actions");
        if (pageActions) {
            const addBtn = document.createElement("button");
            addBtn.className = "smart-btn smart-btn-primary";
            addBtn.innerHTML = "➕ Tambah User";
            addBtn.addEventListener("click", () => openForm("create"));
            pageActions.appendChild(addBtn);
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

            tableArea.innerHTML = "";
            if (state.items.length === 0) {
                tableArea.appendChild(EmptyState({ icon: "👥", title: "Belum ada user", description: state.search ? `Tidak ditemukan "${state.search}"` : "Klik Tambah User", actionText: state.search ? "" : "Tambah User", onAction: state.search ? null : () => openForm("create") }));
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
        if (currentCompanyName && currentCompanyCode) {
            return `${esc(currentCompanyName)} (${esc(currentCompanyCode)})`;
        }
        return esc(currentCompanyCode || "");
    }

    async function openForm(mode, id = null) {
        state.formMode = mode;
        state.editingId = id;
        const isEdit = mode === "edit";
        const title = isEdit ? "Edit User" : "Tambah User Baru";
        const roles = getRoleOptions();
        let formData = { username: "", name: "", email: "", role: "supervisor", companyCode: "", password: "" };

        if (isEdit && id) {
            try {
                const item = await getUser(id, true);
                if (item) formData = { username: item.username, name: item.name, email: item.email, role: item.role, companyCode: item.companyCode || "", password: "" };
            } catch { showToast("danger", "Gagal memuat data"); return; }
        }

        // Build company field: disabled input if single-company mode, else select dropdown
        const companyField = singleCompanyMode
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
                    <input type="text" id="f-username" value="${esc(formData.username)}" placeholder="Username" required ${isEdit ? "readonly style='background:#f1f5f9'" : ""} />
                </div>
                <div class="form-group">
                    <label for="f-name">Nama Lengkap <span class="required">*</span></label>
                    <input type="text" id="f-name" value="${esc(formData.name)}" placeholder="Nama user" required />
                </div>
                <div class="form-group">
                    <label for="f-email">Email</label>
                    <input type="email" id="f-email" value="${esc(formData.email)}" placeholder="email@domain.com" />
                </div>
                <div class="form-group">
                    <label for="f-role">Role</label>
                    <select id="f-role">${roles.map(r => `<option value="${r}" ${formData.role === r ? "selected" : ""}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("")}</select>
                </div>
                <div class="form-group full-width">
                    <label for="f-password">${isEdit ? "Password Baru" : "Password"} ${!isEdit ? '<span class="required">*</span>' : ""}</label>
                    <input type="password" id="f-password" placeholder="${isEdit ? "Kosongkan jika tidak diubah" : "Password user"}" />
                </div>
            </div>
        `, isEdit, id);
    }

    function renderModal(title, contentHTML, isEdit, editId) {
        const footer = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Tambah User"}</button>`;
        const overlay = Modal({ open: true, title, content: contentHTML, footer, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);
        setTimeout(() => document.getElementById(singleCompanyMode ? "f-username" : "f-company")?.focus(), 100);
        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => handleSubmit(isEdit, editId));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
        overlay.querySelectorAll("input, select").forEach(el => el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(isEdit, editId); } }));
    }

    async function handleSubmit(isEdit, editId) {
        const name = document.getElementById("f-name")?.value?.trim();
        const username = document.getElementById("f-username")?.value?.trim();

        // In single-company mode, use the provided company code; otherwise from select
        const companyCode = singleCompanyMode
            ? currentCompanyCode
            : document.getElementById("f-company")?.value;

        if (!companyCode) { showToast("warning", "Sesi perusahaan tidak ditemukan. Silakan login ulang."); return; }
        if (!name) { showToast("warning", "Nama wajib diisi"); document.getElementById("f-name")?.focus(); return; }
        if (!username) { showToast("warning", "Username wajib diisi"); document.getElementById("f-username")?.focus(); return; }
        const pass = document.getElementById("f-password")?.value;
        if (!isEdit && !pass) { showToast("warning", "Password wajib diisi"); document.getElementById("f-password")?.focus(); return; }

        const data = {
            companyCode, username, name,
            email: document.getElementById("f-email")?.value?.trim() || "",
            role: document.getElementById("f-role")?.value || "supervisor",
            password: pass || undefined
        };
        if (isEdit && !pass) delete data.password;
        try {
            if (isEdit && editId) { await updateUser(editId, data, true); showToast("success", "User berhasil diperbarui"); }
            else { await createUser(data); showToast("success", "User berhasil ditambahkan"); }
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
            try { await deleteUser(id, true); showToast("success", "User berhasil dihapus"); removeModal(); loadData(); }
            catch (err) { showToast("danger", `Gagal menghapus: ${err.message || "Unknown"}`); }
        });
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    function removeModal() {
        const overlay = document.querySelector(".smart-modal-overlay");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        state.formMode = null; state.editingId = null;
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

function esc(str) { if (!str) return ""; return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function debounce(fn, ms) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; }

function getStyles() { return `
.crud-page { padding: 1.5rem; }
.crud-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.crud-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.crud-page .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.crud-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.crud-page .search-wrapper { position:relative; display:flex; align-items:center; }
.crud-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
.crud-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
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
.crud-page .badge-role { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.8rem; background:#eef2ff; color:#4f46e5; font-weight:500; }
.crud-page .badge-company { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.8rem; background:#f0fdf4; color:#16a34a; font-weight:500; }
@media (max-width:768px) { .crud-page .form-grid { grid-template-columns:1fr; } }
`;}
