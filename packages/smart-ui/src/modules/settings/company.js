/**
 * Settings — Company Page (Framework Module).
 *
 * Reusable company settings module for SMART Platform.
 * Accepts data service functions via parameters (dependency injection).
 * Inventory atau aplikasi lain tinggal import dan inject data services.
 *
 * @module @smart/ui/modules/settings/company
 */

import { Skeleton, Table, EmptyState, Pagination, Alert, Modal, Toast } from "../../index.js";

/**
 * Company Settings Page component.
 *
 * @param {object} options
 * @param {function} options.listCompanies   Async (params) => { data, pagination }
 * @param {function} options.getCompany      Async (id) => object
 * @param {function} options.createCompany   Async (data) => object
 * @param {function} options.updateCompany   Async (id, data) => object
 * @param {function} options.deleteCompany   Async (id) => boolean
 * @param {string[]} [options.companyTypes]  List of company type options
 * @returns {{ render: function, init: function }}
 */
export function SettingsCompanyModule({ listCompanies, getCompany, createCompany, updateCompany, deleteCompany, companyTypes = [] }) {
    const state = { items: [], page: 1, limit: 10, total: 0, totalPages: 1, search: "", loading: false, formMode: null, editingId: null, deletingId: null, viewModalShown: false, singleViewMode: false };

    /** @returns {string} HTML */
    function render() {
        return `
        <div id="settings-company-page" class="crud-page">
            <style>${getStyles()}</style>
            <div class="page-header">
                <div>
                    <h1>Company Settings</h1>
                    <div class="header-subtitle">Konfigurasi data perusahaan / lembaga</div>
                </div>
                <div class="page-actions">
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="company-search" placeholder="Cari perusahaan..." autocomplete="off" />
                    </div>
                </div>
            </div>
            <div class="table-container">
                <div id="company-table-area"></div>
                <div id="company-pagination-area" class="pagination-container"></div>
                <div id="company-page-info" class="page-info"></div>
            </div>
        </div>`;
    }

    /** Initialize after mount */
    function init() {
        const searchInput = document.getElementById("company-search");
        if (searchInput) {
            searchInput.addEventListener("input", debounce((e) => {
                state.search = e.target.value.trim();
                state.page = 1;
                loadData();
            }, 300));
        }
        loadData();
    }

    async function loadData() {
        const tableArea = document.getElementById("company-table-area");
        const paginationArea = document.getElementById("company-pagination-area");
        const pageInfo = document.getElementById("company-page-info");
        if (!tableArea) return;
        state.loading = true;

        try {
            // Show skeleton
            tableArea.innerHTML = "";
            const wrapper = document.createElement("div");
            wrapper.className = "skeleton-wrapper";
            wrapper.appendChild(Skeleton({ variant: "table-row", count: 5 }));
            tableArea.appendChild(wrapper);

            const result = await listCompanies({ page: state.page, limit: state.limit, search: state.search });
            state.items = result.data;
            state.total = result.pagination.total;
            state.totalPages = result.pagination.totalPages;

            tableArea.innerHTML = "";
            // Show/hide "Tambah Perusahaan" button based on data
            const pageActions = document.querySelector("#settings-company-page .page-actions");
            const existingBtn = document.getElementById("btn-add-company");
            if (existingBtn) existingBtn.remove();

            if (state.items.length === 0) {
                tableArea.appendChild(EmptyState({
                    icon: "🏢", title: "Belum ada perusahaan",
                    description: state.search ? `Tidak ditemukan "${state.search}"` : "Klik Tambah Perusahaan untuk menambahkan",
                    actionText: state.search ? "" : "Tambah Perusahaan",
                    onAction: state.search ? null : () => openForm("create")
                }));
                // Show add button when empty
                if (pageActions && !state.search) {
                    const addBtn = document.createElement("button");
                    addBtn.id = "btn-add-company";
                    addBtn.className = "smart-btn smart-btn-primary";
                    addBtn.innerHTML = "➕ Tambah Perusahaan";
                    addBtn.addEventListener("click", () => openForm("create"));
                    pageActions.appendChild(addBtn);
                }
            } else {
                const isSingleView = state.items.length === 1 && state.total === 1;
                state.singleViewMode = isSingleView;

                if (isSingleView) {
                    // ── Single-company: render inline detail view ──
                    const item = state.items[0];
                    const html = renderInlineDetail(item);
                    const wrapper = document.createElement("div");
                    wrapper.innerHTML = html;
                    tableArea.appendChild(wrapper.firstElementChild || wrapper);

                    // Attach Edit button listener
                    const editBtn = document.getElementById("btn-edit-company-inline");
                    if (editBtn) {
                        editBtn.addEventListener("click", () => openForm("edit", item.id));
                    }

                    // Hide pagination & page-info for single view
                    if (paginationArea) paginationArea.innerHTML = "";
                    if (pageInfo) pageInfo.textContent = "";
                } else {
                    // ── Multi-company: show table with Add button ──
                    if (pageActions) {
                        const addBtn = document.createElement("button");
                        addBtn.id = "btn-add-company";
                        addBtn.className = "smart-btn smart-btn-primary";
                        addBtn.innerHTML = "➕ Tambah Perusahaan";
                        addBtn.addEventListener("click", () => openForm("create"));
                        pageActions.appendChild(addBtn);
                    }

                    const table = Table({
                        columns: [
                            { key: "jenis", label: "Jenis", width: "110px" },
                            { key: "name", label: "Nama Perusahaan" },
                            { key: "email", label: "Email", width: "200px" },
                            { key: "phone", label: "Telepon", width: "130px" },
                            { key: "active", label: "Status", width: "85px", align: "center",
                                render: (val) => val ? '<span style="color:#16a34a">Aktif</span>' : '<span style="color:#dc2626">Nonaktif</span>' },
                            { key: "actions", label: "Aksi", width: "140px", align: "center",
                                render: (_, row) => `
                                    <div class="action-buttons">
                                        <button class="action-btn action-btn-edit" data-edit="${row.id}">✏️ Edit</button>
                                        <button class="action-btn action-btn-delete" data-delete="${row.id}">🗑️ Hapus</button>
                                    </div>` }
                        ], rows: state.items, striped: true, hoverable: true, bordered: false
                    });
                    tableArea.appendChild(table);
                    setTimeout(() => {
                        tableArea.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openForm("edit", String(btn.dataset.edit))));
                        tableArea.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => confirmDelete(String(btn.dataset.delete))));
                    }, 0);

                    // Pagination
                    if (paginationArea) {
                        paginationArea.innerHTML = "";
                        if (state.totalPages > 1) {
                            paginationArea.appendChild(Pagination({
                                current: state.page, total: state.total, pageSize: state.limit,
                                onChange: (p) => { state.page = p; loadData(); }
                            }));
                        }
                    }
                    if (pageInfo) {
                        if (state.total === 0) { pageInfo.textContent = ""; return; }
                        const start = (state.page - 1) * state.limit + 1;
                        const end = Math.min(state.page * state.limit, state.total);
                        pageInfo.textContent = `Menampilkan ${start}–${end} dari ${state.total} perusahaan`;
                    }
                }
                return; // Skip regular pagination for both branches
            }

            if (paginationArea) {
                paginationArea.innerHTML = "";
                if (state.totalPages > 1) {
                    paginationArea.appendChild(Pagination({
                        current: state.page, total: state.total, pageSize: state.limit,
                        onChange: (p) => { state.page = p; loadData(); }
                    }));
                }
            }
            if (pageInfo) {
                if (state.total === 0) { pageInfo.textContent = ""; return; }
                const start = (state.page - 1) * state.limit + 1;
                const end = Math.min(state.page * state.limit, state.total);
                pageInfo.textContent = `Menampilkan ${start}–${end} dari ${state.total} perusahaan`;
            }
        } catch (err) {
            console.error("[SettingsCompany] Failed to load:", err);
        } finally { state.loading = false; }
    }

    /**
     * Open a read-only view modal showing company details at 75% width.
     * @param {object} item Company data object
     */
    function openViewModal(item) {
        if (!item) return;
        const footer = `<button class="smart-btn smart-btn-primary" id="v-close">Tutup</button>`;

        const content = `
        <div class="company-view">
            <div class="cv-header">
                <div class="cv-logo">
                    ${item.logo
                        ? `<img src="${esc(item.logo)}" class="cv-logo-img" />`
                        : `<div class="cv-logo-placeholder">${(item.name || "?").charAt(0)}</div>`
                    }
                </div>
                <div class="cv-header-info">
                    <div class="cv-name">${esc(item.name || "-")}</div>
                    <div class="cv-meta">
                        <span class="cv-badge-type">${esc(item.jenis || "-")}</span>
                        <span class="cv-status ${item.active !== false ? 'active' : 'inactive'}">${item.active !== false ? "Aktif" : "Nonaktif"}</span>
                    </div>
                </div>
            </div>

            <div class="cv-section">
                <div class="cv-section-title">Identitas Lembaga</div>
                <div class="cv-grid">
                    <div class="cv-field"><span class="cv-label">Kode Perusahaan</span><span class="cv-value">${esc(item.code || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Jenis</span><span class="cv-value">${esc(item.jenis || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">Nama Lembaga</span><span class="cv-value">${esc(item.name || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">Alamat</span><span class="cv-value">${esc(item.address || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Email</span><span class="cv-value">${esc(item.email || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Telepon</span><span class="cv-value">${esc(item.phone || "-")}</span></div>
                </div>
            </div>

            <div class="cv-section">
                <div class="cv-section-title">Data Legalitas</div>
                <div class="cv-grid">
                    <div class="cv-field"><span class="cv-label">ID Legalitas</span><span class="cv-value">${esc(item.legalId || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. Perdes</span><span class="cv-value">${esc(item.legalPerdes || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Tanggal Perdes</span><span class="cv-value">${esc(item.legalPerdesDate || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">No. AHU</span><span class="cv-value">${esc(item.legalAhu || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. NIB</span><span class="cv-value">${esc(item.legalNib || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. NPWP</span><span class="cv-value">${esc(item.legalNpwp || item.taxId || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. Induk</span><span class="cv-value">${esc(item.legalInduk || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">Ijin Lainnya</span><span class="cv-value">${esc(item.legalIjin || "-")}</span></div>
                </div>
            </div>

            <div class="cv-section">
                <div class="cv-section-title">Struktur Organisasi</div>
                <div class="cv-grid">
                    <div class="cv-field"><span class="cv-label">Penasehat</span><span class="cv-value">${esc(item.orgPenasehat || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Pengawas</span><span class="cv-value">${esc(item.orgPengawas || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Ketua / Direktur</span><span class="cv-value">${esc(item.orgKetua || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Sekretaris</span><span class="cv-value">${esc(item.orgSekretaris || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Bendahara</span><span class="cv-value">${esc(item.orgBendahara || "-")}</span></div>
                </div>
            </div>
        </div>`;

        const overlay = Modal({ open: true, title: `🏢 ${esc(item.name || "Detail Perusahaan")}`, content, footer, closable: true, onClose: removeModal });
        // Apply 75% width to the dialog
        overlay.querySelector(".smart-modal-dialog")?.classList.add("modal-lg");
        document.body.appendChild(overlay);

        document.getElementById("v-close")?.addEventListener("click", removeModal);
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    async function openForm(mode, id = null) {
        state.formMode = mode;
        state.editingId = id;
        const isEdit = mode === "edit";
        const title = isEdit ? "Edit Perusahaan" : "Tambah Perusahaan Baru";

        let formData = getEmptyFormData();
        if (isEdit && id) {
            try {
                const item = await getCompany(id);
                if (item) formData = mapFormData(item);
            } catch { showToast("danger", "Gagal memuat data"); return; }
        }
        renderFormModal(title, formData, isEdit, id);
    }

    function getEmptyFormData() {
        return { code: "", jenis: "PT", name: "", address: "", phone: "", email: "", taxId: "",
            logo: null, legalId: "", legalPerdes: "", legalPerdesDate: "", legalAhu: "",
            legalNib: "", legalNpwp: "", legalInduk: "", legalIjin: "",
            orgPenasehat: "", orgPengawas: "", orgKetua: "", orgSekretaris: "", orgBendahara: "" };
    }

    function mapFormData(item) {
        return {
            code: item.code || "", jenis: item.jenis || "PT", name: item.name || "",
            address: item.address || "", phone: item.phone || "", email: item.email || "", taxId: item.taxId || "",
            logo: item.logo || null, legalId: item.legalId || "", legalPerdes: item.legalPerdes || "",
            legalPerdesDate: item.legalPerdesDate || "", legalAhu: item.legalAhu || "",
            legalNib: item.legalNib || "", legalNpwp: item.legalNpwp || item.taxId || "",
            legalInduk: item.legalInduk || "", legalIjin: item.legalIjin || "",
            orgPenasehat: item.orgPenasehat || "", orgPengawas: item.orgPengawas || "",
            orgKetua: item.orgKetua || "", orgSekretaris: item.orgSekretaris || "",
            orgBendahara: item.orgBendahara || ""
        };
    }

    function renderFormModal(title, formData, isEdit, editId) {
        const typeOptions = companyTypes.length > 0
            ? companyTypes.map(t => `<option value="${t}" ${formData.jenis === t ? "selected" : ""}>${t}</option>`).join("")
            : '<option value="PT">PT</option><option value="CV">CV</option><option value="Lainnya">Lainnya</option>';

        const logoPreviewHtml = formData.logo
            ? `<img src="${esc(formData.logo)}" class="logo-preview-img" />`
            : `<div class="logo-preview-placeholder">+</div>`;

        const contentHTML = `
        <div class="company-form">
            <div class="form-section">
                <div class="form-section-title">Logo Lembaga</div>
                <div class="logo-upload-area">
                    <div class="logo-preview" id="logo-preview">${logoPreviewHtml}</div>
                    <div class="logo-upload-controls">
                        <button type="button" class="smart-btn smart-btn-secondary" id="btn-logo-upload">Ganti Logo</button>
                        <input type="file" id="f-logo" accept="image/*" style="display:none" />
                        <span class="file-name" id="logo-file-name">No file chosen</span>
                    </div>
                </div>
            </div>
            <div class="form-section">
                <div class="form-section-title">Identitas Lembaga</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="f-code">Kode Perusahaan <span class="required">*</span></label>
                        <input type="text" id="f-code" value="${esc(formData.code)}" placeholder="e.g. PT-001" required />
                    </div>
                    <div class="form-group">
                        <label for="f-jenis">Jenis Perusahaan</label>
                        <select id="f-jenis">${typeOptions}</select>
                    </div>
                    <div class="form-group full-width">
                        <label for="f-name">Nama Lembaga <span class="required">*</span></label>
                        <input type="text" id="f-name" value="${esc(formData.name)}" placeholder="Nama perusahaan / lembaga" required />
                    </div>
                    <div class="form-group full-width">
                        <label for="f-address">Alamat</label>
                        <textarea id="f-address" placeholder="Alamat lengkap perusahaan">${esc(formData.address)}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="f-email">Email</label>
                        <input type="email" id="f-email" value="${esc(formData.email)}" placeholder="email@perusahaan.com" />
                    </div>
                    <div class="form-group">
                        <label for="f-phone">No. Telp.</label>
                        <input type="text" id="f-phone" value="${esc(formData.phone)}" placeholder="021-xxxxxxx" />
                    </div>
                </div>
            </div>
            <div class="form-section">
                <div class="form-section-title">Data Legalitas</div>
                <div class="form-grid">
                    <div class="form-group"><label for="f-legal-id">ID Legalitas</label><input type="text" id="f-legal-id" value="${esc(formData.legalId)}" placeholder="ID Legalitas" /></div>
                    <div class="form-group"><label for="f-legal-perdes">No. Perdes</label><input type="text" id="f-legal-perdes" value="${esc(formData.legalPerdes)}" placeholder="24" /></div>
                    <div class="form-group"><label for="f-legal-perdes-date">Tanggal Perdes</label><input type="date" id="f-legal-perdes-date" value="${esc(formData.legalPerdesDate)}" /></div>
                    <div class="form-group full-width"><label for="f-legal-ahu">No. AHU</label><input type="text" id="f-legal-ahu" value="${esc(formData.legalAhu)}" placeholder="AHU - Nomor" /></div>
                    <div class="form-group"><label for="f-legal-nib">No. NIB</label><input type="text" id="f-legal-nib" value="${esc(formData.legalNib)}" placeholder="NIB" /></div>
                    <div class="form-group"><label for="f-npwp">No. NPWP</label><input type="text" id="f-npwp" value="${esc(formData.legalNpwp)}" placeholder="NPWP" /></div>
                    <div class="form-group"><label for="f-legal-induk">No. Induk</label><input type="text" id="f-legal-induk" value="${esc(formData.legalInduk)}" placeholder="Induk" /></div>
                    <div class="form-group full-width"><label for="f-legal-ijin">Ijin Lainnya</label><input type="text" id="f-legal-ijin" value="${esc(formData.legalIjin)}" placeholder="Ijin" /></div>
                </div>
            </div>
            <div class="form-section">
                <div class="form-section-title">Struktur Organisasi</div>
                <div class="form-grid">
                    <div class="form-group"><label for="f-org-penasehat">Penasehat</label><input type="text" id="f-org-penasehat" value="${esc(formData.orgPenasehat)}" placeholder="Nama" /></div>
                    <div class="form-group"><label for="f-org-pengawas">Pengawas</label><input type="text" id="f-org-pengawas" value="${esc(formData.orgPengawas)}" placeholder="Nama" /></div>
                    <div class="form-group"><label for="f-org-ketua">Ketua / Direktur</label><input type="text" id="f-org-ketua" value="${esc(formData.orgKetua)}" placeholder="Nama" /></div>
                    <div class="form-group"><label for="f-org-sekretaris">Sekretaris</label><input type="text" id="f-org-sekretaris" value="${esc(formData.orgSekretaris)}" placeholder="Nama" /></div>
                    <div class="form-group"><label for="f-org-bendahara">Bendahara</label><input type="text" id="f-org-bendahara" value="${esc(formData.orgBendahara)}" placeholder="Nama" /></div>
                </div>
            </div>
        </div>`;

        const footer = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Tambah Perusahaan"}</button>`;

        const overlay = Modal({ open: true, title, content: contentHTML, footer, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);

        // When single-company view and editing, make kode perusahaan readonly
        if (state.singleViewMode && isEdit) {
            const codeInput = document.getElementById("f-code");
            if (codeInput) {
                codeInput.readOnly = true;
                codeInput.style.background = "#f3f4f6";
                codeInput.style.cursor = "not-allowed";
                codeInput.title = "Kode perusahaan hanya dapat diubah oleh Super Admin";
            }
        }

        setTimeout(() => document.getElementById("f-name")?.focus(), 100);

        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => handleSubmit(isEdit, editId));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
        overlay.querySelectorAll("input, textarea").forEach(el => el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(isEdit, editId); }
        }));

        const btnLogo = document.getElementById("btn-logo-upload");
        const fileInput = document.getElementById("f-logo");
        if (btnLogo && fileInput) {
            const MAX_LOGO_SIZE = 500 * 1024; // 500 KB
            btnLogo.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                const fileNameEl = document.getElementById("logo-file-name");
                if (file) {
                    if (file.size > MAX_LOGO_SIZE) {
                        showToast("warning", `Ukuran logo terlalu besar! Maksimal 500 KB. File saat ini: ${(file.size / 1024).toFixed(0)} KB.`);
                        fileInput.value = "";
                        fileNameEl.textContent = "No file chosen";
                        return;
                    }
                    fileNameEl.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const preview = document.getElementById("logo-preview");
                        if (preview) preview.innerHTML = `<img src="${ev.target.result}" class="logo-preview-img" />`;
                    };
                    reader.readAsDataURL(file);
                } else fileNameEl.textContent = "No file chosen";
            });
        }
    }

    async function handleSubmit(isEdit, editId) {
        const name = document.getElementById("f-name")?.value?.trim();
        if (!name) { showToast("warning", "Nama perusahaan wajib diisi"); document.getElementById("f-name")?.focus(); return; }
        const code = document.getElementById("f-code")?.value?.trim();
        if (!code) { showToast("warning", "Kode perusahaan wajib diisi"); document.getElementById("f-code")?.focus(); return; }

        const logoPreview = document.querySelector("#logo-preview img");
        const logo = logoPreview ? logoPreview.src : null;

        const data = {
            code, name, logo,
            jenis: document.getElementById("f-jenis")?.value || "PT",
            address: document.getElementById("f-address")?.value?.trim() || "",
            phone: document.getElementById("f-phone")?.value?.trim() || "",
            email: document.getElementById("f-email")?.value?.trim() || "",
            taxId: document.getElementById("f-npwp")?.value?.trim() || "",
            legalId: document.getElementById("f-legal-id")?.value?.trim() || "",
            legalPerdes: document.getElementById("f-legal-perdes")?.value?.trim() || "",
            legalPerdesDate: document.getElementById("f-legal-perdes-date")?.value || "",
            legalAhu: document.getElementById("f-legal-ahu")?.value?.trim() || "",
            legalNib: document.getElementById("f-legal-nib")?.value?.trim() || "",
            legalNpwp: document.getElementById("f-npwp")?.value?.trim() || "",
            legalInduk: document.getElementById("f-legal-induk")?.value?.trim() || "",
            legalIjin: document.getElementById("f-legal-ijin")?.value?.trim() || "",
            orgPenasehat: document.getElementById("f-org-penasehat")?.value?.trim() || "",
            orgPengawas: document.getElementById("f-org-pengawas")?.value?.trim() || "",
            orgKetua: document.getElementById("f-org-ketua")?.value?.trim() || "",
            orgSekretaris: document.getElementById("f-org-sekretaris")?.value?.trim() || "",
            orgBendahara: document.getElementById("f-org-bendahara")?.value?.trim() || ""
        };
        try {
            if (isEdit && editId) { await updateCompany(editId, data); showToast("success", "Perusahaan berhasil diperbarui"); }
            else { await createCompany(data); showToast("success", "Perusahaan berhasil ditambahkan"); }
            removeModal(); loadData();
        } catch (err) { showToast("danger", `Gagal menyimpan: ${err.message || "Unknown"}`); }
    }

    function confirmDelete(id) {
        const item = state.items.find(i => i.id === id);
        const name = item ? item.name : `#${id}`;
        const footer = `<button class="smart-btn smart-btn-secondary" id="d-cancel">Batal</button>
            <button class="smart-btn smart-btn-danger" id="d-confirm">Ya, Hapus</button>`;
        const overlay = Modal({
            open: true, title: "Konfirmasi Hapus",
            content: `<div class="delete-confirm"><p>Hapus <span class="item-name">${esc(name)}</span>?</p><p style="font-size:0.85rem;color:#6b7280">Tindakan tidak dapat dibatalkan.</p></div>`,
            footer, closable: true, onClose: removeModal
        });
        overlay.querySelector("#d-confirm")?.setAttribute("style", "background:#dc2626;color:#fff;border-color:#dc2626;");
        document.body.appendChild(overlay);
        document.getElementById("d-cancel")?.addEventListener("click", removeModal);
        document.getElementById("d-confirm")?.addEventListener("click", async () => {
            try { await deleteCompany(id); showToast("success", "Perusahaan berhasil dihapus"); loadData(); }
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
     * Render an inline detail view of the company (for single-company mode).
     * @param {object} item Company data
     * @returns {string} HTML
     */
    function renderInlineDetail(item) {
        if (!item) return "";
        const logoHtml = item.logo
            ? `<img src="${esc(item.logo)}" class="cv-logo-img" />`
            : `<div class="cv-logo-placeholder">${(item.name || "?").charAt(0)}</div>`;

        const phoneVal = item.phone || "-";
        const emailVal = item.email || "-";

        return `
        <div class="company-inline-detail">
            <div class="cv-header">
                <div class="cv-logo">${logoHtml}</div>
                <div class="cv-header-info">
                    <div class="cv-name">${esc(item.name || "-")}</div>
                    <div class="cv-address">${esc(item.address || "-")}</div>
                    <div class="cv-contact">
                        <span class="cv-contact-item">Telp. ${esc(phoneVal)}</span>
                        <span class="cv-contact-sep">|</span>
                        <span class="cv-contact-item">Email: ${esc(emailVal)}</span>
                    </div>
                </div>
                <div class="cv-inline-actions">
                    <button class="smart-btn smart-btn-primary" id="btn-edit-company-inline">✏️ Edit Perusahaan</button>
                </div>
            </div>

            <div class="cv-section">
                <div class="cv-section-title">Identitas Lembaga</div>
                <div class="cv-grid">
                    <div class="cv-field"><span class="cv-label">Kode Perusahaan</span><span class="cv-value">${esc(item.code || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Jenis</span><span class="cv-value">${esc(item.jenis || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">Nama Lembaga</span><span class="cv-value">${esc(item.name || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">Alamat</span><span class="cv-value">${esc(item.address || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Email</span><span class="cv-value">${esc(item.email || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Telepon</span><span class="cv-value">${esc(item.phone || "-")}</span></div>
                </div>
            </div>

            <div class="cv-section">
                <div class="cv-section-title">Data Legalitas</div>
                <div class="cv-grid">
                    <div class="cv-field"><span class="cv-label">ID Legalitas</span><span class="cv-value">${esc(item.legalId || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. Perdes</span><span class="cv-value">${esc(item.legalPerdes || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Tanggal Perdes</span><span class="cv-value">${esc(item.legalPerdesDate || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">No. AHU</span><span class="cv-value">${esc(item.legalAhu || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. NIB</span><span class="cv-value">${esc(item.legalNib || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. NPWP</span><span class="cv-value">${esc(item.legalNpwp || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">No. Induk</span><span class="cv-value">${esc(item.legalInduk || "-")}</span></div>
                    <div class="cv-field cv-span-2"><span class="cv-label">Ijin Lainnya</span><span class="cv-value">${esc(item.legalIjin || "-")}</span></div>
                </div>
            </div>

            <div class="cv-section">
                <div class="cv-section-title">Struktur Organisasi</div>
                <div class="cv-grid">
                    <div class="cv-field"><span class="cv-label">Penasehat</span><span class="cv-value">${esc(item.orgPenasehat || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Pengawas</span><span class="cv-value">${esc(item.orgPengawas || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Ketua / Direktur</span><span class="cv-value">${esc(item.orgKetua || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Sekretaris</span><span class="cv-value">${esc(item.orgSekretaris || "-")}</span></div>
                    <div class="cv-field"><span class="cv-label">Bendahara</span><span class="cv-value">${esc(item.orgBendahara || "-")}</span></div>
                </div>
            </div>
        </div>`;
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
.crud-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; transition:border-color 0.2s; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.crud-page .search-wrapper input:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.crud-page .table-container { background:var(--smart-card-bg,#fff); border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); overflow:hidden; }
.crud-page .pagination-container { display:flex; justify-content:center; padding:1rem 0; }
.crud-page .action-buttons { display:flex; gap:0.5rem; justify-content:center; }
.crud-page .action-btn { padding:0.35rem 0.7rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; transition:all 0.15s; }
.crud-page .action-btn-edit { background:#eef2ff; color:#4f46e5; border-color:#c7d2fe; }
.crud-page .action-btn-edit:hover { background:#e0e7ff; }
.crud-page .action-btn-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.crud-page .action-btn-delete:hover { background:#fee2e2; }
.crud-page .action-btn-view { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
.crud-page .action-btn-view:hover { background:#dcfce7; }
.crud-page .skeleton-wrapper { padding:1rem; }
.crud-page .page-info { text-align:center; font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); padding:0.5rem 0 1rem; }
.crud-page .required { color:#dc2626; }
.company-form { padding:0.25rem 0; }
.form-section { margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--smart-border,#e5e7eb); }
.form-section:last-child { border-bottom:none; margin-bottom:0; padding-bottom:0; }
.form-section-title { font-size:0.9rem; font-weight:600; color:var(--smart-text-primary,#1e293b); margin-bottom:0.75rem; padding-bottom:0.4rem; border-bottom:2px solid var(--smart-primary,#4f46e5); display:inline-block; }
.logo-upload-area { display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; }
.logo-preview { width:80px; height:80px; border-radius:8px; border:2px dashed var(--smart-border,#d1d5db); display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--smart-card-bg,#f9fafb); flex-shrink:0; }
.logo-preview-img { width:100%; height:100%; object-fit:cover; border-radius:6px; }
.logo-preview-placeholder { font-size:2rem; color:var(--smart-text-secondary,#9ca3af); font-weight:300; }
.logo-upload-controls { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; }
.file-name { font-size:0.8rem; color:var(--smart-text-secondary,#9ca3af); }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; }
.form-grid .full-width { grid-column:1/-1; }
.form-group { margin-bottom:0.15rem; }
.form-group label { display:block; font-size:0.82rem; font-weight:500; margin-bottom:0.3rem; color:var(--smart-text-primary,#374151); }
.form-group input, .form-group textarea, .form-group select { width:100%; padding:0.45rem 0.7rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.85rem; outline:none; transition:border-color 0.2s; box-sizing:border-box; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.form-group textarea { resize:vertical; min-height:54px; }
.delete-confirm { text-align:center; padding:0.5rem 0; }
.delete-confirm p { font-size:0.95rem; margin-bottom:1rem; color:var(--smart-text-secondary,#6b7280); }
.delete-confirm .item-name { font-weight:600; color:var(--smart-text-primary,#1e293b); }

/* ── Large Modal (75% viewport width) ── */
.modal-lg { max-width: 75vw !important; }
@media (max-width: 768px) { .modal-lg { max-width: 95vw !important; } }

/* ── Inline Company Detail ── */
.company-inline-detail { padding: 1.5rem; background:var(--smart-card-bg,#fff); border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
.cv-inline-actions { margin-left:auto; flex-shrink:0; }

/* ── Company View Modal ── */
.company-view { padding: 0.25rem 0; }
.cv-header { display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem; padding-bottom:1.25rem; border-bottom:1px solid var(--smart-border,#e5e7eb); }
.cv-logo { width:72px; height:72px; border-radius:12px; overflow:hidden; background:var(--smart-card-bg,#f1f5f9); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:2px solid var(--smart-border,#e2e8f0); }
.cv-logo-img { width:100%; height:100%; object-fit:cover; }
.cv-logo-placeholder { font-size:1.6rem; font-weight:700; color:var(--smart-primary,#4f46e5); }
.cv-header-info { flex:1; min-width:0; }
.cv-name { font-size:1.15rem; font-weight:700; color:var(--smart-text-primary,#1e293b); margin-bottom:0.2rem; }
.cv-address { font-size:0.85rem; color:var(--smart-text-secondary,#64748b); margin-bottom:0.15rem; line-height:1.4; }
.cv-contact { display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; font-size:0.82rem; color:var(--smart-text-secondary,#6b7280); }
.cv-contact-item { white-space:nowrap; }
.cv-contact-sep { color:var(--smart-border,#d1d5db); font-weight:300; }
.cv-section { margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--smart-border,#e5e7eb); }
.cv-section:last-child { border-bottom:none; margin-bottom:0; padding-bottom:0; }
.cv-section-title { font-size:0.9rem; font-weight:600; color:var(--smart-text-primary,#1e293b); margin-bottom:0.75rem; padding-bottom:0.4rem; border-bottom:2px solid var(--smart-primary,#4f46e5); display:inline-block; }
.cv-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem 1.25rem; }
.cv-field.cv-span-2 { grid-column:1/-1; }
.cv-field { display:flex; flex-direction:column; gap:0.15rem; }
.cv-label { font-size:0.75rem; font-weight:500; color:var(--smart-text-secondary,#94a3b8); text-transform:uppercase; letter-spacing:0.4px; }
.cv-value { font-size:0.9rem; color:var(--smart-text-primary,#1e293b); padding:0.35rem 0.6rem; background:var(--smart-card-bg,#f8fafc); border-radius:4px; min-height:1.8rem; display:flex; align-items:center; }
@media (max-width:640px) { .cv-grid { grid-template-columns:1fr; } .cv-header { flex-direction:column; text-align:center; } }
`; }
