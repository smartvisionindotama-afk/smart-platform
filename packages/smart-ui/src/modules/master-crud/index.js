/**
 * Generic CRUD Module — Framework Module.
 *
 * Factory function untuk halaman CRUD standar. Semua state, loadData,
 * renderModal, confirmDelete, pagination, search, card view, dan styling
 * ada di sini. Cukup pass config dengan data services, kolom tabel,
 * form fields, dan card renderer.
 *
 * @module @smart/ui/modules/master-crud
 */

import { Modal, Table, Pagination, EmptyState, Alert, Skeleton, showToast, UI } from "../../index.js";
import { esc } from "@smart/core";

/**
 * Create a CRUD page module.
 *
 * @param {Object} config
 * @param {string} config.entityId         — ID prefix for DOM elements (e.g. "kategori")
 * @param {string} config.title            — Page title (e.g. "Master Kategori")
 * @param {string} config.subtitle         — Subtitle (e.g. "Kelola kategori barang")
 * @param {string} config.icon             — Empty state icon (e.g. "🏷️")
 * @param {string} config.singularName     — For toasts (e.g. "Kategori")
 * @param {string} config.pluralName       — For page info (e.g. "kategori")
 * @param {string} config.tambahLabel      — Add button (e.g. "Tambah Kategori")
 * @param {string} config.formTitleEdit    — Modal edit title
 * @param {string} config.formTitleCreate  — Modal create title
 * @param {Object} config.services         — { list, get, create, update, delete }
 * @param {Function} [config.services.checkKodeExists] — Optional: (kode) => {exists, nama, id}
 * @param {Array}  config.columns          — Table column definitions
 * @param {Function} config.renderCard     — (item) => HTML for card content
 * @param {Function} config.renderFormFields — (formData) => HTML for form fields
 * @param {Object} config.formDataDefaults — Default empty form data
 * @param {Function} config.mapFormData    — (item) => formData for editing
 * @param {Function} config.getPayload     — () => data object from DOM
 * @param {Function} [config.loadFormDependencies] — Async () => extra data passed to renderFormFields as 3rd param
 * @param {Function} [config.validateForm] — (getPayload) => string|null error message; return null if valid
 * @param {Function} [config.createGuard] — Async (state) => { allowed:boolean, message?:string } —
 *        opsional; saat allowed=false tombol Tambah dinonaktifkan & banner info ditampilkan
 *        (dipakai enforcement kuota, mis. jumlahGudang dari Master Platform). Additive.
 * @returns {{ CrudPage: Function, initCrudPage: Function }}
 */
export function CrudModule(config) {
    const {
        entityId,
        title,
        subtitle,
        icon,
        singularName,
        pluralName,
        tambahLabel,
        formTitleEdit,
        formTitleCreate,
        services,
        columns,
        renderCard,
        renderFormFields,
        formDataDefaults,
        mapFormData,
        getPayload,
        loadFormDependencies,
        validateForm,
        createGuard
    } = config;

    const checkKodeExists = services.checkKodeExists;

    const state = {
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        search: "",
        loading: false,
        formMode: null,
        editingId: null,
        guard: null
    };

    const searchId = `${entityId}-search`;
    const pageId = `${entityId}-page`;
    const tableAreaId = `${entityId}-table-area`;
    const paginationAreaId = `${entityId}-pagination-area`;
    const pageInfoId = `${entityId}-page-info`;
    const guardId = `${entityId}-guard-banner`;

    // ── Create Guard (opsional — enforcement kuota, SP-029 M2-FIX) ──
    // createGuard: async (state) => ({ allowed, message }). Saat allowed=false:
    //   - tombol Tambah dinonaktifkan + title berisi pesan
    //   - banner info tampil di atas tabel
    //   - EmptyState action tidak memunculkan form
    let addBtnRef = null;

    async function refreshCreateGuard() {
        if (typeof createGuard !== "function") { state.guard = null; return; }
        try {
            state.guard = (await createGuard(state)) || { allowed: true };
        } catch (err) {
            console.warn(`[${singularName}] createGuard gagal — izinkan default:`, err?.message);
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
        const guardEl = document.getElementById(guardId);
        if (guardEl) {
            if (blocked && state.guard.message) {
                guardEl.textContent = `⚠️ ${state.guard.message}`;
                guardEl.style.display = "block";
            } else {
                guardEl.textContent = "";
                guardEl.style.display = "none";
            }
        }
    }

    // ── Page Render ──

    function CrudPage() {
        return `
            <div id="${pageId}" class="crud-page">
                <style>${getStyles()}</style>
                <div class="page-header">
                    <div>
                        <h1>${title}</h1>
                        <div class="header-subtitle">${subtitle}</div>
                    </div>
                    <div class="page-actions">
                        <div class="search-wrapper">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="${searchId}" placeholder="Cari ${pluralName}..." autocomplete="off" />
                        </div>
                    </div>
                </div>
                <div id="${guardId}" class="create-guard-banner" style="display:none"></div>
                <div class="table-container">
                    <div id="${tableAreaId}"></div>
                </div>
                <div id="${paginationAreaId}" class="pagination-container"></div>
                <div id="${pageInfoId}" class="page-info"></div>
            </div>
        `;
    }

    // ── Init ──

    function initCrudPage() {
        const searchInput = document.getElementById(searchId);
        if (searchInput) {
            searchInput.addEventListener("input", debounce((e) => {
                state.search = e.target.value.trim();
                state.page = 1;
                loadData();
            }, 300));
        }
        const pageActions = document.querySelector(`#${pageId} .page-actions`);
        if (pageActions) {
            addBtnRef = document.createElement("button");
            addBtnRef.className = "smart-btn smart-btn-primary";
            addBtnRef.innerHTML = `➕ ${tambahLabel}`;
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

    // ── Load Data ──

    async function loadData() {
        const tableArea = document.getElementById(tableAreaId);
        const paginationArea = document.getElementById(paginationAreaId);
        const pageInfo = document.getElementById(pageInfoId);
        if (!tableArea) return;

        state.loading = true;
        const wrapper = document.createElement("div");
        wrapper.className = "skeleton-wrapper";
        wrapper.appendChild(Skeleton({ variant: "table-row", count: 5 }));
        tableArea.innerHTML = "";
        tableArea.appendChild(wrapper);

        try {
            const result = await services.list({ page: state.page, limit: state.limit, search: state.search });
            state.items = result.data;
            state.items.sort((a, b) => (a.nama || "").localeCompare(b.nama || "", undefined, { sensitivity: "base" }));
            state.total = result.pagination.total;
            state.totalPages = result.pagination.totalPages;

            await refreshCreateGuard();
            tableArea.innerHTML = "";
            if (state.items.length === 0) {
                const blocked = state.guard && state.guard.allowed === false;
                tableArea.appendChild(EmptyState({
                    icon,
                    title: `Belum ada ${pluralName}`,
                    description: state.search ? `Tidak ditemukan "${state.search}"` : (blocked ? (state.guard.message || `Klik ${tambahLabel}`) : `Klik ${tambahLabel}`),
                    actionText: (state.search || blocked) ? "" : tambahLabel,
                    onAction: (state.search || blocked) ? null : () => openForm("create")
                }));
            } else if (window.innerWidth < 768) {
                renderCrudCards(tableArea);
            } else {
                const table = Table({
                    columns: [
                        ...columns,
                        {
                            key: "actions",
                            label: "Aksi",
                            width: "120px",
                            align: "center",
                            render: (_, row) =>
                                `<div class="action-buttons"><button class="action-btn action-btn-edit" data-edit="${row.id}">✏️ Edit</button><button class="action-btn action-btn-delete" data-delete="${row.id}">🗑️ Hapus</button></div>`
                        }
                    ],
                    rows: state.items,
                    striped: true,
                    hoverable: true,
                    bordered: false
                });
                tableArea.appendChild(table);
                tableArea.querySelectorAll("[data-edit]").forEach(btn =>
                    btn.addEventListener("click", () => openForm("edit", String(btn.dataset.edit)))
                );
                tableArea.querySelectorAll("[data-delete]").forEach(btn =>
                    btn.addEventListener("click", () => confirmDelete(String(btn.dataset.delete)))
                );
            }

            if (paginationArea) {
                paginationArea.innerHTML = "";
                if (state.totalPages > 1) {
                    paginationArea.appendChild(Pagination({
                        current: state.page,
                        total: state.total,
                        pageSize: state.limit,
                        onChange: (p) => { state.page = p; loadData(); }
                    }));
                }
            }

            if (pageInfo) {
                if (state.total === 0) { pageInfo.textContent = ""; return; }
                const start = (state.page - 1) * state.limit + 1;
                const end = Math.min(state.page * state.limit, state.total);
                pageInfo.textContent = `Menampilkan ${start}–${end} dari ${state.total} ${pluralName}`;
            }
        } catch (err) {
            console.error(`[${singularName}] Failed to load:`, err);
            tableArea.innerHTML = "";
            tableArea.appendChild(Alert({ variant: "danger", message: "Gagal memuat data", dismissible: true }));
        } finally {
            state.loading = false;
        }
    }

    // ── Cards (Mobile) ──

    function renderCrudCards(container) {
        const list = UI.CardList(state.items, (item) => renderCard(esc, item));
        container.appendChild(list);
        UI.attachCardEvents(
            container,
            (id) => openForm("edit", id),
            (id) => confirmDelete(id)
        );
    }

    // ── Form Modal ──

    async function openForm(mode, id = null) {
        state.formMode = mode;
        state.editingId = id;
        const isEdit = mode === "edit";
        const title = isEdit ? formTitleEdit : formTitleCreate;
        let formData = { ...formDataDefaults };

        if (isEdit && id) {
            try {
                const item = await services.get(id);
                if (item) formData = mapFormData(item);
            } catch {
                showToast("danger", "Gagal memuat data");
                return;
            }
        }

        // Load form dependencies (e.g., warehouse list for dropdown)
        let extra = {};
        if (typeof loadFormDependencies === "function") {
            try {
                extra = await loadFormDependencies();
            } catch (err) {
                console.warn(`[${singularName}] Failed to load form dependencies:`, err);
            }
        }

        renderModal(title, renderFormFields(esc, formData, extra), isEdit, id);

        // Post-render hook for async population (e.g., dropdowns)
        if (typeof extra._postRender === "function") {
            setTimeout(() => extra._postRender(), 50);
        }
    }

    function renderModal(title, contentHTML, isEdit, editId) {
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : tambahLabel}</button>`;

        const overlay = Modal({ open: true, title, content: contentHTML, footer: footerHTML, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);

        // Inject kode-error container DI DALAM form-group (sama seperti pendekatan Barang).
        // Dengan ini error muncul persis di bawah input kode, di dalam grid cell yg sama.
        // Tidak perlu grid-column:1/-1 — jadi nggak ada masalah posisi.
        const kodeGroup = document.getElementById("f-kode")?.closest(".form-group");
        if (kodeGroup) {
            const errDiv = document.createElement("div");
            errDiv.id = "f-kode-error";
            errDiv.className = "kode-error-container";
            errDiv.style.display = "none";
            kodeGroup.appendChild(errDiv);
        }

        setTimeout(() => document.getElementById("f-kode")?.focus(), 100);
        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => handleSubmit(isEdit, editId));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);

        // Real-time kode validation: cek ke DB saat user meninggalkan field kode
        const kodeInput = document.getElementById("f-kode");
        if (kodeInput && typeof checkKodeExists === "function") {
            kodeInput.addEventListener("blur", async () => {
                await validateKode(isEdit, editId);
            });
            kodeInput.addEventListener("input", () => {
                // Hanya cleanup visual — JANGAN enable/disable submit atau nama!
                const errorEl = document.getElementById("f-kode-error");
                if (errorEl) { errorEl.innerHTML = ""; errorEl.style.display = "none"; }
                kodeInput.classList.remove("is-duplicate");
            });
        }

        overlay.querySelectorAll("input, textarea").forEach(el =>
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(isEdit, editId); }
            })
        );
    }

    function clearKodeError() {
        const errorEl = document.getElementById("f-kode-error");
        if (errorEl) { errorEl.innerHTML = ""; errorEl.style.display = "none"; }
        const kodeInput = document.getElementById("f-kode");
        if (kodeInput) kodeInput.classList.remove("is-duplicate");
        const submitBtn = document.getElementById("f-submit");
        if (submitBtn) submitBtn.disabled = false;
        const namaInput = document.getElementById("f-nama");
        if (namaInput) namaInput.disabled = false;
    }

    async function validateKode(isEdit, editId) {
        const kodeVal = document.getElementById("f-kode")?.value?.trim();
        const errorEl = document.getElementById("f-kode-error");
        const submitBtn = document.getElementById("f-submit");
        const kodeInput = document.getElementById("f-kode");

        if (!kodeVal) { clearKodeError(); return; }
        if (typeof checkKodeExists !== "function") { clearKodeError(); return; }

        try {
            const result = await checkKodeExists(kodeVal);
            if (result && result.exists) {
                if (isEdit && editId && String(result.id) === String(editId)) {
                    clearKodeError();
                    return;
                }
                const msg = `Kode "${kodeVal}" sudah digunakan untuk ${singularName.toLowerCase()} "${result.nama}", gunakan kode lain`;
                if (errorEl) {
                    errorEl.innerHTML = "";
                    errorEl.appendChild(Alert({ variant: "danger", message: msg }));
                    errorEl.style.display = "block";
                }
                if (kodeInput) kodeInput.classList.add("is-duplicate");
                if (submitBtn) submitBtn.disabled = true;
                const namaInput = document.getElementById("f-nama");
                if (namaInput) namaInput.disabled = true;
            } else {
                clearKodeError();
                if (submitBtn) submitBtn.disabled = false;
                const namaInput = document.getElementById("f-nama");
                if (namaInput) namaInput.disabled = false;
            }
        } catch (err) {
            console.warn(`[validateKode] checkKodeExists failed:`, err?.message);
            clearKodeError();
        }
    }

    async function handleSubmit(isEdit, editId) {
        // Pastikan validasi real-time jalan (antisipasi Enter tanpa blur)
        if (typeof checkKodeExists === "function") {
            await validateKode(isEdit, editId);
        }

        const submitBtn = document.getElementById("f-submit");
        if (submitBtn?.disabled) {
            showToast("danger", `Kode ${singularName.toLowerCase()} sudah digunakan, gunakan kode lain`);
            return;
        }

        const nama = document.getElementById("f-nama")?.value?.trim();
        if (!nama) {
            showToast("warning", `Nama ${singularName.toLowerCase()} wajib diisi`);
            return;
        }
        const kode = document.getElementById("f-kode")?.value?.trim();
        if (!kode) {
            showToast("warning", `Kode ${singularName.toLowerCase()} wajib diisi`);
            document.getElementById("f-kode")?.focus();
            return;
        }

        // Custom form validation
        if (typeof validateForm === "function") {
            const errMsg = validateForm(getPayload);
            if (errMsg) {
                showToast("warning", errMsg);
                return;
            }
        }

        const data = getPayload();

        try {
            if (isEdit && editId) {
                await services.update(editId, data);
                showToast("success", `${singularName} berhasil diperbarui`);
            } else {
                await services.create(data);
                showToast("success", `${singularName} berhasil ditambahkan`);
            }
            removeModal();
            loadData();
        } catch (err) {
            showToast("danger", `Gagal menyimpan: ${err.message || "Unknown"}`);
        }
    }

    // ── Delete Confirmation ──

    function confirmDelete(id) {
        const item = state.items.find(i => i.id === id);
        const name = item ? (item.nama || item.kode || `#${id}`) : `#${id}`;
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="d-cancel">Batal</button>
            <button class="smart-btn smart-btn-danger" id="d-confirm">Ya, Hapus</button>`;
        const overlay = Modal({
            open: true,
            title: "Konfirmasi Hapus",
            content: `<div class="delete-confirm">
                <p>Hapus ${singularName.toLowerCase()} <span class="item-name">${esc(name)}</span>?</p>
                <p style="font-size:0.85rem;color:#6b7280">Tindakan ini tidak dapat dibatalkan.</p>
            </div>`,
            footer: footerHTML,
            closable: true,
            onClose: removeModal
        });
        overlay.querySelector("#d-confirm")?.setAttribute("style", "background:#dc2626;color:#fff;border-color:#dc2626;");
        document.body.appendChild(overlay);

        document.getElementById("d-cancel")?.addEventListener("click", removeModal);
        document.getElementById("d-confirm")?.addEventListener("click", async () => {
            try {
                await services.delete(id);
                showToast("success", `${singularName} berhasil dihapus`);
                removeModal();
                loadData();
            } catch (err) {
                showToast("danger", `Gagal menghapus: ${err.message || "Unknown"}`);
            }
        });
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    function removeModal() {
        const overlay = document.querySelector(".smart-modal-overlay");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        state.formMode = null;
        state.editingId = null;
    }

    // ── Utilities ──

    // Framework First: esc dari @smart/core (util global, bukan duplikat lokal)

    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    function getStyles() {
        return `
.crud-page { padding: 0; }
.crud-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.crud-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.crud-page .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.crud-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.crud-page .search-wrapper { position:relative; display:flex; align-items:center; }
.crud-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
.crud-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.crud-page .search-wrapper input:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.crud-page .table-container { background:rgba(255,255,255,0.58); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); border:2px solid rgb(255,255,255); border-radius:28px; box-shadow:0 8px 16px rgba(0,0,0,0.08); overflow:hidden; padding:14px; }
.crud-page .table-container .smart-table-wrapper { background:transparent !important; }
.crud-page .table-container .smart-table-wrapper .smart-table,
.crud-page .table-container .smart-table-wrapper .smart-table thead,
.crud-page .table-container .smart-table-wrapper .smart-table tbody,
.crud-page .table-container .smart-table-wrapper .smart-table tr,
.crud-page .table-container .smart-table-wrapper .smart-table th,
.crud-page .table-container .smart-table-wrapper .smart-table td { background:transparent !important; }
.crud-page .table-container .smart-table-wrapper .smart-table th,
.crud-page .table-container .smart-table-wrapper .smart-table td { border-color:rgba(148,163,184,0.28); }
.crud-page .pagination-container { display:flex; justify-content:center; padding:1rem 0; }
.crud-page .action-buttons { display:flex; gap:0.5rem; justify-content:center; }
.crud-page .action-btn { padding:0.35rem 0.7rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; }
.crud-page .action-btn-edit { background:rgba(255,255,255,0.58); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); color:#4f46e5; border:1px solid rgba(255,255,255,0.92); border-radius:10px; }
.crud-page .action-btn-edit:hover { background:rgba(255,255,255,0.78); }
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
.crud-page .page-info { text-align:center; font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); padding:0.5rem 0 1rem; }
.crud-page .required { color:#dc2626; }
.crud-page .create-guard-banner { padding:0.6rem 1rem; margin:0 0 1rem; border-radius:6px; background:#fef3c7; border:1px solid #fcd34d; color:#92400e; font-size:0.85rem; }
.crud-page .kode-error-container { grid-column:1/-1; margin-top:0.5rem; }
.crud-page .kode-error-container .smart-alert { margin:0; padding:0.5rem 0.75rem; font-size:0.8rem; }
.crud-page #f-kode.is-duplicate { border-color:#dc2626 !important; background:#fef2f2 !important; box-shadow:0 0 0 3px rgba(220,38,38,0.1) !important; }
.crud-page #f-nama:disabled { background:#f3f4f6 !important; color:#9ca3af !important; cursor:not-allowed !important; border-color:#e5e7eb !important; opacity:0.7; }
@media (max-width:768px) {
.crud-page { padding:0; }
.crud-page .page-header { flex-direction:column; align-items:stretch; }
.crud-page .page-actions { flex-direction:row; }
.crud-page .search-wrapper { flex:1; min-width:0; }
.crud-page .search-wrapper input { width:100%; box-sizing:border-box; }
.crud-page .page-actions .smart-btn { white-space:nowrap; flex-shrink:0; font-size:0.82rem; padding:0.45rem 0.7rem; }
.crud-page .table-container { background:transparent; border:none; box-shadow:none; padding:0; border-radius:0; }
.crud-page .table-container .sm-card { box-shadow:none; border:1px solid rgba(0,0,0,0.25); }
.crud-page .page-header { padding-top:20px; }
.crud-page .table-container .smart-table-wrapper { background:transparent !important; }
.crud-page .table-container .smart-table-wrapper .smart-table,
.crud-page .table-container .smart-table-wrapper .smart-table thead,
.crud-page .table-container .smart-table-wrapper .smart-table tbody,
.crud-page .table-container .smart-table-wrapper .smart-table tr,
.crud-page .table-container .smart-table-wrapper .smart-table th,
.crud-page .table-container .smart-table-wrapper .smart-table td { background:transparent !important; }
.crud-page .pagination-container { padding:0.75rem 0 0.25rem; }
.crud-page .form-grid { grid-template-columns:1fr; }
}
`;
    }

    return { CrudPage, initCrudPage };
}
