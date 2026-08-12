/**
 * Settings — Role Module (Framework Module).
 *
 * Reusable role management module for SMART Platform.
 * Accepts data service functions via dependency injection.
 *
 * @module @smart/ui/modules/settings/role
 */

import { Modal, Toast, Table, Pagination, EmptyState, Alert, Skeleton } from "../../index.js";
import { esc } from "@smart/core";

/**
 * Role Settings Page component.
 *
 * @param {object} options
 * @param {function} options.listRoles    Async (params) => { data, pagination }
 * @param {function} options.getRole      Async (id) => object
 * @param {function} options.createRole   Async (data) => object
 * @param {function} options.updateRole   Async (id, data) => object
 * @param {function} options.deleteRole   Async (id) => boolean
 * @returns {{ render: function, init: function }}
 */
export function SettingsRoleModule({ listRoles, getRole, createRole, updateRole, deleteRole }) {
    const state = { items: [], page: 1, limit: 10, total: 0, totalPages: 1, search: "", loading: false, formMode: null, editingId: null };

    function render() {
        return `
        <div id="settings-role-page" class="crud-page">
            <style>${getStyles()}</style>
            <div class="page-header">
                <div>
                    <h1>Role Management</h1>
                    <div class="header-subtitle">Kelola role/hak akses pengguna</div>
                </div>
                <div class="page-actions">
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="role-search" placeholder="Cari role..." autocomplete="off" />
                    </div>
                </div>
            </div>
            <div class="table-container">
                <div id="role-table-area"></div>
                <div id="role-pagination-area" class="pagination-container"></div>
                <div id="role-page-info" class="page-info"></div>
            </div>
        </div>`;
    }

    function init() {
        const searchInput = document.getElementById("role-search");
        if (searchInput) {
            searchInput.addEventListener("input", debounce((e) => {
                state.search = e.target.value.trim();
                state.page = 1;
                loadData();
            }, 300));
        }
        const pageActions = document.querySelector("#settings-role-page .page-actions");
        if (pageActions) {
            const addBtn = document.createElement("button");
            addBtn.className = "smart-btn smart-btn-primary";
            addBtn.innerHTML = "➕ Tambah Role";
            addBtn.addEventListener("click", () => openForm("create"));
            pageActions.appendChild(addBtn);
        }
        loadData();
    }

    async function loadData() {
        const tableArea = document.getElementById("role-table-area");
        const paginationArea = document.getElementById("role-pagination-area");
        const pageInfo = document.getElementById("role-page-info");
        if (!tableArea) return;
        state.loading = true;
        showSkeleton(tableArea);

        try {
            const result = await listRoles({ page: state.page, limit: state.limit, search: state.search });
            state.items = result.data;
            state.total = result.pagination.total;
            state.totalPages = result.pagination.totalPages;

            tableArea.innerHTML = "";
            if (state.items.length === 0) {
                tableArea.appendChild(EmptyState({ icon: "🔑", title: "Belum ada role", description: state.search ? `Tidak ditemukan "${state.search}"` : "Klik Tambah Role", actionText: state.search ? "" : "Tambah Role", onAction: state.search ? null : () => openForm("create") }));
            } else {
                const table = Table({
                    columns: [
                        { key: "name", label: "ID Role", width: "110px" },
                        { key: "label", label: "Nama Role" },
                        { key: "level", label: "Level", width: "80px", align: "center", render: (val) => `<span class="badge-level">${val}</span>` },
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
                pageInfo.textContent = `Menampilkan ${start}–${end} dari ${state.total} role`;
            }
        } catch (err) {
            console.error("[SettingsRole] Failed to load:", err);
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

    async function openForm(mode, id = null) {
        state.formMode = mode;
        state.editingId = id;
        const isEdit = mode === "edit";
        const title = isEdit ? "Edit Role" : "Tambah Role Baru";
        let formData = { name: "", label: "", level: "10", description: "" };
        if (isEdit && id) {
            try {
                const item = await getRole(id);
                if (item) formData = { name: item.name, label: item.label, level: item.level, description: item.description || "" };
            } catch { showToast("danger", "Gagal memuat data"); return; }
        }
        renderModal(title, `
            <div class="form-grid">
                <div class="form-group">
                    <label for="f-name">ID Role <span class="required">*</span></label>
                    <input type="text" id="f-name" value="${esc(formData.name)}" placeholder="e.g. supervisor" required ${isEdit ? "readonly style='background:#f1f5f9'" : ""} />
                </div>
                <div class="form-group">
                    <label for="f-label">Nama Role <span class="required">*</span></label>
                    <input type="text" id="f-label" value="${esc(formData.label)}" placeholder="Nama display role" required />
                </div>
                <div class="form-group">
                    <label for="f-level">Level Hierarki</label>
                    <input type="number" id="f-level" value="${formData.level}" placeholder="10" min="1" max="100" />
                    <small style="color:#94a3b8;font-size:0.75rem">Semakin tinggi angka, semakin tinggi otoritas</small>
                </div>
                <div class="form-group full-width">
                    <label for="f-desc">Deskripsi</label>
                    <textarea id="f-desc" placeholder="Deskripsi role">${esc(formData.description)}</textarea>
                </div>
            </div>
        `, isEdit, id);
    }

    function renderModal(title, contentHTML, isEdit, editId) {
        const footer = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Tambah Role"}</button>`;
        const overlay = Modal({ open: true, title, content: contentHTML, footer, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);
        setTimeout(() => document.getElementById("f-label")?.focus(), 100);
        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => handleSubmit(isEdit, editId));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
        overlay.querySelectorAll("input, textarea").forEach(el => el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(isEdit, editId); } }));
    }

    async function handleSubmit(isEdit, editId) {
        const label = document.getElementById("f-label")?.value?.trim();
        const name = document.getElementById("f-name")?.value?.trim();
        if (!label) { showToast("warning", "Nama role wajib diisi"); return; }
        if (!name) { showToast("warning", "ID Role wajib diisi"); return; }
        const data = { name, label, level: Number(document.getElementById("f-level")?.value) || 10, description: document.getElementById("f-desc")?.value?.trim() || "" };
        try {
            if (isEdit && editId) { await updateRole(editId, data); showToast("success", "Role berhasil diperbarui"); }
            else { await createRole(data); showToast("success", "Role berhasil ditambahkan"); }
            removeModal(); loadData();
        } catch (err) { showToast("danger", `Gagal menyimpan: ${err.message || "Unknown"}`); }
    }

    function confirmDelete(id) {
        const item = state.items.find(i => i.id === id);
        const name = item ? item.label : `#${id}`;
        const footer = `<button class="smart-btn smart-btn-secondary" id="d-cancel">Batal</button>
            <button class="smart-btn smart-btn-danger" id="d-confirm">Ya, Hapus</button>`;
        const overlay = Modal({ open: true, title: "Konfirmasi Hapus",
            content: `<div class="delete-confirm"><p>Hapus role <span class="item-name">${esc(name)}</span>?</p><p style="font-size:0.85rem;color:#6b7280">Tindakan ini tidak dapat dibatalkan.</p></div>`,
            footer, closable: true, onClose: removeModal });
        overlay.querySelector("#d-confirm")?.setAttribute("style", "background:#dc2626;color:#fff;border-color:#dc2626;");
        document.body.appendChild(overlay);
        document.getElementById("d-cancel")?.addEventListener("click", removeModal);
        document.getElementById("d-confirm")?.addEventListener("click", async () => {
            try { await deleteRole(id); showToast("success", "Role berhasil dihapus"); removeModal(); loadData(); }
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

// Framework First: esc dari @smart/core (util global, bukan duplikat lokal)
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
.crud-page .form-group input, .crud-page .form-group textarea { width:100%; padding:0.5rem 0.75rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; outline:none; box-sizing:border-box; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.crud-page .form-group input:focus, .crud-page .form-group textarea:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.crud-page .form-group textarea { resize:vertical; min-height:60px; }
.crud-page .form-group small { display:block; margin-top:2px; }
.crud-page .page-info { text-align:center; font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); padding:0.5rem 0 1rem; }
.crud-page .required { color:#dc2626; }
.crud-page .badge-level { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.8rem; background:#f0fdf4; color:#16a34a; font-weight:600; }
@media (max-width:768px) { .crud-page .form-grid { grid-template-columns:1fr; } }
`;}
