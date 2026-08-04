/**
 * Barang Module — Framework Module.
 *
 * DI-based module untuk manajemen barang. Menerima semua data services
 * via parameter sehingga bisa dipakai aplikasi manapun.
 *
 * @module @smart/inventory-ui/modules/barang
 */

import { Modal, Table, Pagination, EmptyState, Alert, Skeleton, showToast, UI } from "@smart/ui";

/**
 * Create a Barang management module.
 *
 * @param {Object} services
 * @param {Function} services.listBarang
 * @param {Function} services.getBarang
 * @param {Function} services.createBarang
 * @param {Function} services.updateBarang
 * @param {Function} services.deleteBarang
 * @param {Function} services.listKategori
 * @param {Function} services.listSatuan
 * @param {Function} services.listRak
 * @param {Function} services.listWarehouse
 * @param {Function} services.createKategori
 * @param {Function} services.createSatuan
 * @param {Function} services.createRak
 * @param {Function} services.formatRupiah
 * @returns {{ BarangPage: Function, initBarangPage: Function }}
 */
export function BarangModule(services) {
    const {
        listBarang, getBarang, createBarang, updateBarang, deleteBarang,
        listKategori, listSatuan, listRak, listWarehouse,
        createKategori, createSatuan, createRak,
        formatRupiah, checkKodeExists
    } = services;

    // ── State ──
    const state = {
        items: [], page: 1, limit: 10, total: 0, totalPages: 1,
        search: "", loading: false, formMode: null, editingId: null, deletingId: null
    };

    // ── Cached Data ──
    let _rakData = [];
    let _warehouseData = [];

    let _scannerInstance = null;

    // ── Page Shell ──

    function BarangPage() {
        return `
            <div id="barang-page" class="barang-page">
                <style>${getStyles()}</style>
                <div class="page-header">
                    <div>
                        <h1>Master Barang</h1>
                        <div class="header-subtitle">Kelola data barang gudang</div>
                    </div>
                    <div class="page-actions">
                        <div class="search-wrapper">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="barang-search" placeholder="Cari kode, nama, kategori..." autocomplete="off" />
                        </div>
                    </div>
                </div>
                <div class="table-container"><div id="barang-table-area"></div></div>
                <div id="barang-pagination-area" class="pagination-container"></div>
                <div id="barang-page-info" class="page-info"></div>
            </div>
        `;
    }

    // ── Init ──

    function initBarangPage() {
        const searchInput = document.getElementById("barang-search");
        if (searchInput) {
            searchInput.addEventListener("input", debounce((e) => {
                state.search = e.target.value.trim();
                state.page = 1;
                loadData();
            }, 300));
        }
        const pageActions = document.querySelector(".barang-page .page-actions");
        if (pageActions) {
            const addBtn = document.createElement("button");
            addBtn.className = "smart-btn smart-btn-primary";
            addBtn.innerHTML = "➕ Tambah Barang";
            addBtn.addEventListener("click", () => openForm("create"));
            pageActions.appendChild(addBtn);
        }
        loadData();
    }

    // ── Data Loading ──

    async function loadData() {
        const tableArea = document.getElementById("barang-table-area");
        const paginationArea = document.getElementById("barang-pagination-area");
        const pageInfo = document.getElementById("barang-page-info");
        if (!tableArea) return;
        state.loading = true;
        const wrapper = document.createElement("div");
        wrapper.className = "skeleton-wrapper";
        wrapper.appendChild(Skeleton({ variant: "table-row", count: 5 }));
        tableArea.innerHTML = "";
        tableArea.appendChild(wrapper);
        try {
            const result = await listBarang({ page: state.page, limit: state.limit, search: state.search });
            state.items = result.data;
            state.items.sort((a, b) => (a.nama || "").localeCompare(b.nama || "", undefined, { sensitivity: "base" }));
            state.total = result.pagination.total;
            state.totalPages = result.pagination.totalPages;
            tableArea.innerHTML = "";
            if (state.items.length === 0) {
                tableArea.appendChild(EmptyState({
                    icon: "📦", title: "Belum ada barang",
                    description: state.search ? `Tidak ditemukan "${state.search}"` : "Klik Tambah Barang",
                    actionText: state.search ? "" : "Tambah Barang",
                    onAction: state.search ? null : () => openForm("create")
                }));
            } else if (window.innerWidth < 768) {
                renderBarangCards(tableArea);
            } else {
                renderDesktopTable(tableArea);
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
                pageInfo.textContent = `Menampilkan ${start}–${end} dari ${state.total} barang`;
            }
        } catch (err) {
            console.error("[Barang] Failed to load:", err);
            tableArea.innerHTML = "";
            tableArea.appendChild(Alert({ variant: "danger", message: "Gagal memuat data", dismissible: true }));
        } finally { state.loading = false; }
    }

    function renderDesktopTable(container) {
        const columns = [
            { key: "kode", label: "Kode", width: "110px" },
            { key: "nama", label: "Nama Barang" },
            { key: "kategori", label: "Kategori", width: "140px" },
            { key: "satuan", label: "Satuan", width: "85px", align: "center" },
            { key: "rak", label: "Rak/Etalase", width: "100px" },
            { key: "gudang", label: "Gudang", width: "100px" },
            { key: "harga_beli", label: "Harga Beli", width: "130px", align: "right",
                render: (val) => `<span style="font-weight:500;color:#6b7280">${formatRupiah(val)}</span>` },
            { key: "harga_jual", label: "Harga Jual", width: "130px", align: "right",
                render: (val) => `<span style="font-weight:600;color:#059669">${formatRupiah(val)}</span>` },
            { key: "stok", label: "Stok", width: "80px", align: "center",
                render: (val, row) => `<span class="${val <= row.stok_minimum ? "stok-low" : "stok-ok"}">${val}</span>` },
            { key: "actions", label: "Aksi", width: "120px", align: "center",
                render: (_, row) => `<div class="action-buttons"><button class="action-btn action-btn-edit" data-edit="${row.id}">✏️ Edit</button><button class="action-btn action-btn-delete" data-delete="${row.id}">🗑️ Hapus</button></div>` }
        ];
        const table = Table({ columns, rows: state.items, striped: true, hoverable: true, bordered: false });
        container.appendChild(table);
        container.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openForm("edit", String(btn.dataset.edit))));
        container.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => confirmDelete(String(btn.dataset.delete))));
    }

    function renderBarangCards(container) {
        const list = UI.CardList(state.items, (item) => {
            const isLow = Number(item.stok) <= Number(item.stok_minimum);
            return `
                <div class="sm-card-name">${esc(item.nama)}</div>
                <div class="card-body">
                    <div class="card-row">
                        <span class="card-label">Gudang</span>
                        <span class="card-value">${esc(item.gudang || '-')}</span>
                    </div>
                    <div class="card-row">
                        <span class="card-label">Harga Jual</span>
                        <span class="card-harga-jual">${formatRupiah(item.harga_jual)}</span>
                    </div>
                    <div class="card-row">
                        <span class="card-label">Stok</span>
                        <span class="card-stok ${isLow ? "stok-low" : "stok-ok"}">${item.stok}${item.satuan ? ` ${esc(item.satuan)}` : ""}</span>
                    </div>
                </div>
                <div class="sm-card-footer-row">
                    <span class="sm-card-code">${esc(item.kode)}</span>
                    <button class="card-btn-detail" data-detail="${item.id}">📋 Detail</button>
                </div>
            `;
        });
        container.appendChild(list);
        container.querySelectorAll("[data-detail]").forEach(btn => {
            btn.addEventListener("click", () => {
                const item = state.items.find(i => String(i.id) === String(btn.dataset.detail));
                if (item) showDetailModal(item);
            });
        });
    }

    function showDetailModal(item) {
        const isLow = Number(item.stok) <= Number(item.stok_minimum);
        const contentHTML = `
            <div class="detail-grid">
                ${renderDetailRow("Kode", esc(item.kode))}
                ${renderDetailRow("Nama Barang", esc(item.nama))}
                ${renderDetailRow("Kategori", esc(item.kategori || "—"))}
                ${renderDetailRow("Satuan", esc(item.satuan || "—"))}
                ${renderDetailRow("Rak/Etalase", esc(item.rak || "—"))}
                ${renderDetailRow("Gudang", esc(item.gudang || "—"))}
                ${renderDetailRow("Harga Beli", formatRupiah(item.harga_beli), "#6b7280")}
                ${renderDetailRow("Harga Jual", formatRupiah(item.harga_jual), "#059669;font-weight:600")}
                ${renderDetailRow("Stok", `<span class="${isLow ? "stok-low" : "stok-ok"}">${item.stok}</span>`)}
                ${renderDetailRow("Stok Minimum", item.stok_minimum)}
                ${item.deskripsi ? renderDetailRowFull("Deskripsi", esc(item.deskripsi)) : ""}
            </div>`;
        const footerHTML = `
            <button class="smart-btn smart-btn-secondary" id="d-close">Tutup</button>
            <button class="smart-btn smart-btn-primary" id="d-edit">✏️ Edit</button>
            <button class="smart-btn smart-btn-danger" id="d-delete" style="background:#dc2626;color:#fff;border-color:#dc2626;">🗑️ Hapus</button>`;
        const overlay = Modal({ open: true, title: esc(item.nama), content: contentHTML, footer: footerHTML, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);
        document.getElementById("d-close")?.addEventListener("click", removeModal);
        document.getElementById("d-edit")?.addEventListener("click", () => { removeModal(); openForm("edit", item.id); });
        document.getElementById("d-delete")?.addEventListener("click", () => { removeModal(); confirmDelete(item.id); });
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);
    }

    function renderDetailRow(label, valueHTML, extraStyle) {
        return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value" style="${extraStyle || ""}">${valueHTML}</span></div>`;
    }
    function renderDetailRowFull(label, valueHTML) {
        return `<div class="detail-row detail-row-full"><span class="detail-label">${label}</span><span class="detail-value">${valueHTML}</span></div>`;
    }

    // ── Form ──

    async function openForm(mode, id = null) {
        state.formMode = mode;
        state.editingId = id;
        const isEdit = mode === "edit";
        const title = isEdit ? "Edit Barang" : "Tambah Barang Baru";
        let formData = { kode: "", nama: "", kategori: "", satuan: "", rak: "", gudang: "", harga_beli: "", harga_jual: "", stok: "", stok_minimum: "", deskripsi: "" };
        if (isEdit && id) {
            try {
                const item = await getBarang(id);
                if (item) formData = { kode: item.kode, nama: item.nama, kategori: item.kategori, satuan: item.satuan, rak: item.rak || "", gudang: item.gudang || "", harga_beli: item.harga_beli, harga_jual: item.harga_jual, stok: item.stok, stok_minimum: item.stok_minimum, deskripsi: item.deskripsi };
            } catch { showToast("danger", "Gagal memuat data"); return; }
        }
        let kategoriOptions = [], satuanOptions = [], rakOptions = [], gudangOptions = [];
        _rakData = [];
        _warehouseData = [];
        try { kategoriOptions = (await listKategori({ page: 1, limit: 999 })).data.map(k => k.nama); } catch {}
        try { satuanOptions = (await listSatuan({ page: 1, limit: 999 })).data.map(s => s.nama); } catch {}
        try {
            const rakResult = await listRak({ page: 1, limit: 999 });
            _rakData = rakResult.data || [];
            rakOptions = _rakData.map(r => r.nama);
        } catch {}
        try {
            const whResult = await listWarehouse({ page: 1, limit: 999 });
            _warehouseData = whResult.data || [];
            gudangOptions = _warehouseData.map(g => g.nama);
        } catch {}

        const modalContent = buildFormHTML(formData, { kategoriOptions, satuanOptions, rakOptions, gudangOptions });
        renderModal(title, modalContent, isEdit, id);
    }

    function buildFormHTML(data, opts) {
        const { kategoriOptions = [], satuanOptions = [], rakOptions = [], gudangOptions = [] } = opts;
        return `
            <div id="scanner-section" class="sm-scanner-section" style="display:none">
                <div class="sm-scanner-frame">
                    <div class="sm-scanner-corner sm-scanner-corner-tl"></div>
                    <div class="sm-scanner-corner sm-scanner-corner-tr"></div>
                    <div class="sm-scanner-corner sm-scanner-corner-bl"></div>
                    <div class="sm-scanner-corner sm-scanner-corner-br"></div>
                </div>
                <div class="sm-scanner-ripple"></div>
                <div class="sm-scanner-dot"></div>
                <div class="sm-scanner-flash" id="scanner-flash"></div>
                <div id="scanner-container" class="sm-scanner-container"></div>
                <div class="sm-scanner-scan-line"><div class="sm-scanner-line-tail"></div><div class="sm-scanner-line-glow"></div></div>
                <div class="sm-scanner-hint-bar">
                    <span class="sm-scanner-hint-left"><span>📸</span><span>Arahkan kamera ke barcode atau QR code</span></span>
                    <button type="button" class="sm-scanner-hint-switch" id="btn-switch-camera" title="Ganti kamera">🔄</button>
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="f-kode">Kode Barang <span class="required">*</span></label>
                    <div class="kode-wrapper">
                        <input type="text" id="f-kode" value="${esc(data.kode)}" placeholder="Scan atau ketik kode barang" required autocomplete="off" />
                        <button type="button" class="btn-scan" id="btn-scan-barcode" title="Aktifkan/nonaktifkan kamera">📷</button>
                    </div>
                    <div id="f-kode-error" class="kode-error-container" style="display:none"></div>
                </div>
                <div class="form-group">
                    <label for="f-nama">Nama Barang <span class="required">*</span></label>
                    <input type="text" id="f-nama" value="${esc(data.nama)}" placeholder="Nama barang" required />
                </div>
                <div class="form-group">
                    <label for="f-kategori">Kategori</label>
                    <select id="f-kategori">${renderOpts(kategoriOptions, data.kategori, "__add_kategori__", "➕ Tambah Kategori")}</select>
                </div>
                <div class="form-group">
                    <label for="f-satuan">Satuan</label>
                    <select id="f-satuan">${renderOpts(satuanOptions, data.satuan, "__add_satuan__", "➕ Tambah Satuan")}</select>
                </div>
                <div class="form-group">
                    <label for="f-rak">Rak / Etalase</label>
                    <select id="f-rak">${renderOpts(rakOptions, data.rak, "__add_rak__", "➕ Tambah Rak")}</select>
                </div>
                <div class="form-group">
                    <label for="f-gudang">Gudang <span class="required">*</span></label>
                    <select id="f-gudang"><option value="">— Pilih Gudang —</option>${gudangOptions.map(g => `<option value="${g}" ${data.gudang === g ? "selected" : ""}>${g}</option>`).join("")}</select>
                </div>
                <div class="form-group">
                    <label for="f-harga-beli">Harga Beli</label>
                    <input type="number" id="f-harga-beli" value="${data.harga_beli}" placeholder="0" min="0" />
                </div>
                <div class="form-group">
                    <label for="f-harga-jual">Harga Jual</label>
                    <input type="number" id="f-harga-jual" value="${data.harga_jual}" placeholder="0" min="0" />
                </div>
                <div class="form-group">
                    <label for="f-stok">Stok Awal</label>
                    <input type="number" id="f-stok" value="${data.stok}" placeholder="0" min="0" />
                </div>
                <div class="form-group">
                    <label for="f-stok-minimum">Stok Minimum</label>
                    <input type="number" id="f-stok-minimum" value="${data.stok_minimum}" placeholder="0" min="0" />
                </div>
                <div class="form-group full-width">
                    <label for="f-deskripsi">Deskripsi</label>
                    <textarea id="f-deskripsi" placeholder="Catatan atau deskripsi barang (opsional)">${esc(data.deskripsi)}</textarea>
                </div>
            </div>`;
    }

    function renderOpts(options, selected, addVal, addText) {
        return `<option value="">— Pilih —</option>
            ${options.map(v => `<option value="${v}" ${selected === v ? "selected" : ""}>${v}</option>`).join("")}
            <option value="${addVal}" style="color:#4f46e5;font-weight:500">${addText}</option>`;
    }

    function renderModal(title, contentHTML, isEdit, editId) {
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Tambah Barang"}</button>`;
        const overlay = Modal({ open: true, title, content: contentHTML, footer: footerHTML, closable: true, onClose: removeModal });
        document.body.appendChild(overlay);
        setTimeout(() => document.getElementById("f-kode")?.focus(), 100);
        document.getElementById("f-cancel")?.addEventListener("click", removeModal);
        document.getElementById("f-submit")?.addEventListener("click", () => handleFormSubmit(isEdit, editId));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", removeModal);

        // Real-time kode validation: cek ke DB saat user meninggalkan field kode
        const kodeInput = document.getElementById("f-kode");
        if (kodeInput) {
            kodeInput.addEventListener("blur", async () => {
                await validateKode(isEdit, editId);
            });
            kodeInput.addEventListener("input", () => {
                // Hanya cleanup visual — JANGAN enable/disable submit atau nama!
                // clearKodeError() TIDAK dipanggil karena dia juga enable submit + nama.
                // Kita hanya mau reset tampilan error, tapi state submit/nama
                // tetap dikendalikan oleh validateKode() (via blur atau submit).
                const errorEl = document.getElementById("f-kode-error");
                if (errorEl) { errorEl.innerHTML = ""; errorEl.style.display = "none"; }
                if (kodeInput) kodeInput.classList.remove("is-duplicate");
            });
        }

        // Scanner
        document.getElementById("btn-scan-barcode")?.addEventListener("click", (e) => { e.preventDefault(); toggleScanner(); });
        document.getElementById("btn-switch-camera")?.addEventListener("click", switchCamera);

        // Quick-add
        document.getElementById("f-kategori")?.addEventListener("change", async (e) => { if (e.target.value === "__add_kategori__") { e.target.value = ""; await showQuickAdd("kategori", e.target); } });
        document.getElementById("f-satuan")?.addEventListener("change", async (e) => { if (e.target.value === "__add_satuan__") { e.target.value = ""; await showQuickAdd("satuan", e.target); } });
        document.getElementById("f-rak")?.addEventListener("change", async (e) => {
            if (e.target.value === "__add_rak__") { e.target.value = ""; await showQuickAdd("rak", e.target); return; }
            // Auto-fill gudang berdasarkan rak yang dipilih
            const selectedRak = _rakData.find(r => r.nama === e.target.value);
            if (selectedRak && selectedRak.gudang) {
                const wh = _warehouseData.find(w => (w.kode || w._id || "") === selectedRak.gudang);
                if (wh && wh.nama) {
                    document.getElementById("f-gudang").value = wh.nama;
                }
            }
        });

        overlay.querySelectorAll("input, select, textarea").forEach(el => {
            el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFormSubmit(isEdit, editId); } });
        });
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
        const gudangVal = document.getElementById("f-gudang")?.value?.trim() || "";
        const errorEl = document.getElementById("f-kode-error");
        const submitBtn = document.getElementById("f-submit");
        const kodeInput = document.getElementById("f-kode");

        // Skip if empty (validasi required sudah di handleFormSubmit)
        if (!kodeVal) { clearKodeError(); return; }

        // Skip checkKodeExists if service not available (defensive)
        if (typeof checkKodeExists !== "function") { clearKodeError(); return; }

        try {
            // Pass gudang agar validasi kode discope per gudang —
            // kode yg sama di gudang berbeda dianggap valid (untuk multi-warehouse)
            const result = await checkKodeExists(kodeVal, gudangVal);
            if (result && result.exists) {
                // Edit mode: if kode still belongs to current item, it's OK
                if (isEdit && editId && String(result.id) === String(editId)) {
                    clearKodeError();
                    return;
                }
                // Show Alert danger + disable submit + disable nama
                const msg = `Kode "${kodeVal}" sudah digunakan untuk barang "${result.nama}", gunakan kode barang lain`;
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
                // Kode valid — enable submit + nama
                clearKodeError();
                if (submitBtn) submitBtn.disabled = false;
                const namaInput = document.getElementById("f-nama");
                if (namaInput) namaInput.disabled = false;
            }
        } catch (err) {
            // If check fails (network error), allow submission to proceed
            console.warn("[validateKode] checkKodeExists failed:", err?.message);
            clearKodeError();
        }
    }

    async function handleFormSubmit(isEdit, editId) {
        // Pastikan validasi real-time jalan (antisipasi Enter tanpa blur)
        await validateKode(isEdit, editId);

        const submitBtn = document.getElementById("f-submit");
        if (submitBtn?.disabled) {
            showToast("danger", "Kode barang sudah digunakan, gunakan kode lain");
            return;
        }

        const kode = document.getElementById("f-kode")?.value?.trim();
        if (!kode) { showToast("warning", "Kode barang wajib diisi (scan barcode/QR atau ketik manual)"); document.getElementById("f-kode")?.focus(); return; }
        const nama = document.getElementById("f-nama")?.value?.trim();
        if (!nama) { showToast("warning", "Nama barang wajib diisi"); document.getElementById("f-nama")?.focus(); return; }
        const gudang = document.getElementById("f-gudang")?.value?.trim() || "";
        if (!gudang) { showToast("warning", "Gudang wajib dipilih"); document.getElementById("f-gudang")?.focus(); return; }

        const data = {
            kode, nama,
            kategori: document.getElementById("f-kategori")?.value || "",
            satuan: document.getElementById("f-satuan")?.value || "",
            rak: document.getElementById("f-rak")?.value?.trim() || "",
            gudang,
            harga_beli: Number(document.getElementById("f-harga-beli")?.value) || 0,
            harga_jual: Number(document.getElementById("f-harga-jual")?.value) || 0,
            stok: Number(document.getElementById("f-stok")?.value) || 0,
            stok_minimum: Number(document.getElementById("f-stok-minimum")?.value) || 0,
            deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || ""
        };
        try {
            if (isEdit && editId) { await updateBarang(editId, data); showToast("success", "Barang berhasil diperbarui"); }
            else { await createBarang(data); showToast("success", "Barang baru berhasil ditambahkan"); }
            removeModal(); loadData();
        } catch (err) {
            const msg = err.message || "";
            // Deteksi pesan duplikat dari server (409 Conflict) atau local fallback
            if (msg.includes("sudah digunakan")) {
                showToast("warning", msg);
            } else {
                showToast("danger", `Gagal menyimpan: ${msg || "Unknown"}`);
            }
        }
    }

    // ── Scanner ──

    function onScanSuccess(decodedText) {
        triggerScanFlash(); playScanBeep();
        const kodeInput = document.getElementById("f-kode");
        if (kodeInput) {
            kodeInput.value = decodedText.trim();
            kodeInput.dispatchEvent(new Event("input", { bubbles: true }));
            kodeInput.dispatchEvent(new Event("blur", { bubbles: true })); // trigger real-time validasi
            showToast("success", `✅ Kode: ${decodedText.trim()}`);
        }
        setTimeout(() => stopScanner(), 400);
    }
    async function startScanner() {
        const section = document.getElementById("scanner-section");
        if (!section) return;
        section.style.display = "block"; section.classList.add("active");
        try {
            _scannerInstance = new UI.BarcodeScanner("scanner-container", { onScan: onScanSuccess, fps: 10 });
            await _scannerInstance.start();
        } catch { stopScanner(); showToast("warning", "Kamera tidak tersedia. Silakan ketik kode manual."); }
    }
    async function switchCamera() { if (_scannerInstance) try { await _scannerInstance.switchCamera(); } catch {} }
    function stopScanner() {
        if (_scannerInstance) { _scannerInstance.destroy(); _scannerInstance = null; }
        const section = document.getElementById("scanner-section");
        if (section) { section.classList.remove("active"); section.style.display = "none"; }
        const scanBtn = document.getElementById("btn-scan-barcode");
        if (scanBtn) scanBtn.classList.remove("active");
    }
    function toggleScanner() {
        const section = document.getElementById("scanner-section");
        if (!section) return;
        if (section.style.display === "none" || !section.style.display || section.style.display === "") {
            const scanBtn = document.getElementById("btn-scan-barcode");
            if (scanBtn) scanBtn.classList.add("active");
            startScanner();
        } else { stopScanner(); }
    }
    function triggerScanFlash() {
        const flash = document.getElementById("scanner-flash");
        if (!flash) return;
        flash.classList.remove("active"); void flash.offsetWidth;
        flash.classList.add("active"); setTimeout(() => flash.classList.remove("active"), 600);
    }
    function playScanBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 1200; osc.type = "sine"; gain.gain.value = 0.15;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
            setTimeout(() => ctx.close(), 300);
        } catch {}
    }

    // ── Quick Add ──

    async function showQuickAdd(fieldType, selectEl) {
        const CFG = {
            kategori: { label: "Kategori", createFn: createKategori, listFn: listKategori, fieldId: "f-kategori", addVal: "__add_kategori__", addText: "➕ Tambah Kategori" },
            satuan: { label: "Satuan", createFn: createSatuan, listFn: listSatuan, fieldId: "f-satuan", addVal: "__add_satuan__", addText: "➕ Tambah Satuan" },
            rak: { label: "Rak/Etalase", createFn: createRak, listFn: listRak, fieldId: "f-rak", addVal: "__add_rak__", addText: "➕ Tambah Rak" }
        };
        const cfg = CFG[fieldType];
        if (!cfg) return;

        const isRak = fieldType === "rak";
        const extraField = isRak
            ? `<div class="form-group"><label for="qa-lokasi">Lokasi</label><input type="text" id="qa-lokasi" placeholder="Contoh: Gudang Utama Lt 1" /></div>`
            : `<div class="form-group"><label for="qa-deskripsi">Deskripsi (opsional)</label><input type="text" id="qa-deskripsi" placeholder="Deskripsi ${cfg.label.toLowerCase()}" /></div>`;

        const formHTML = `
            <p style="margin:0 0 1rem 0;font-size:1rem;color:var(--smart-text-primary,#374151);text-align:center">Anda akan menambah <strong>${cfg.label}</strong> baru.</p>
            <div class="form-grid" style="padding:0">
                <div class="form-group">
                    <label for="qa-kode">Kode ${cfg.label} <span class="required">*</span></label>
                    <input type="text" id="qa-kode" placeholder="contoh: ${isRak ? "RAK-001" : fieldType === "kategori" ? "KAT-001" : "SAT-001"}" />
                </div>
                <div class="form-group">
                    <label for="qa-nama">Nama ${cfg.label} <span class="required">*</span></label>
                    <input type="text" id="qa-nama" placeholder="Nama ${cfg.label.toLowerCase()}" required autofocus />
                </div>
                ${extraField}
            </div>`;
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="qa-cancel">Batal</button><button class="smart-btn smart-btn-primary" id="qa-submit">Tambah ${cfg.label}</button>`;

        const overlay = Modal({ open: true, title: `➕ Tambah ${cfg.label} Baru`, content: formHTML, footer: footerHTML, closable: true, onClose: () => overlay?.parentNode?.removeChild(overlay) });
        document.body.appendChild(overlay);
        setTimeout(() => document.getElementById("qa-kode")?.focus(), 150);

        document.getElementById("qa-cancel")?.addEventListener("click", () => overlay?.parentNode?.removeChild(overlay));
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", () => overlay?.parentNode?.removeChild(overlay));
        document.getElementById("qa-submit")?.addEventListener("click", async () => {
            const kode = document.getElementById("qa-kode")?.value?.trim() || "";
            if (!kode) { showToast("warning", `Kode ${cfg.label.toLowerCase()} wajib diisi`); document.getElementById("qa-kode")?.focus(); return; }
            const nama = document.getElementById("qa-nama")?.value?.trim();
            if (!nama) { showToast("warning", `Nama ${cfg.label.toLowerCase()} wajib diisi`); document.getElementById("qa-nama")?.focus(); return; }
            try {
                const payload = isRak ? { kode, nama, lokasi: document.getElementById("qa-lokasi")?.value?.trim() || "" } : { kode, nama, deskripsi: document.getElementById("qa-deskripsi")?.value?.trim() || "" };
                await cfg.createFn(payload);
                const result = await cfg.listFn({ page: 1, limit: 999 });
                const items = result.data.map(x => x.nama);
                const sel = document.getElementById(cfg.fieldId);
                if (sel) { sel.innerHTML = renderOpts(items, nama, cfg.addVal, cfg.addText); }
                // Sync _rakData after quick-add so auto-fill gudang works for new rak
                if (fieldType === "rak") {
                    _rakData = result.data;
                }
                showToast("success", `${cfg.label} "${nama}" berhasil ditambahkan`);
                overlay?.parentNode?.removeChild(overlay);
            } catch (err) { showToast("danger", `Gagal: ${err.message || "Unknown"}`); }
        });
        overlay.querySelectorAll("#qa-nama, #qa-lokasi, #qa-deskripsi").forEach(el => {
            el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById("qa-submit")?.click(); } });
        });
    }

    // ── Delete ──

    function confirmDelete(id) {
        state.deletingId = id;
        const item = state.items.find(i => i.id === id);
        const itemName = item ? item.nama : `#${id}`;
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="d-cancel">Batal</button><button class="smart-btn smart-btn-danger" id="d-confirm">Ya, Hapus</button>`;
        const overlay = Modal({ open: true, title: "Konfirmasi Hapus",
            content: `<div class="delete-confirm"><p>Hapus barang <span class="item-name">${esc(itemName)}</span>?</p><p style="font-size:0.85rem;color:#6b7280">Tindakan ini tidak dapat dibatalkan.</p></div>`,
            footer: footerHTML, closable: true, onClose: () => { state.deletingId = null; removeModal(); } });
        overlay.querySelector("#d-confirm")?.setAttribute("style", "background:#dc2626;color:#fff;border-color:#dc2626;");
        document.body.appendChild(overlay);
        document.getElementById("d-cancel")?.addEventListener("click", () => { state.deletingId = null; removeModal(); });
        document.getElementById("d-confirm")?.addEventListener("click", async () => {
            try { await deleteBarang(id); showToast("success", "Barang berhasil dihapus"); state.deletingId = null; removeModal(); loadData(); }
            catch (err) { showToast("danger", `Gagal menghapus: ${err.message || "Unknown"}`); }
        });
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", () => { state.deletingId = null; removeModal(); });
    }

    // ── Utilities ──

    function removeModal() {
        stopScanner();
        const overlay = document.querySelector(".smart-modal-overlay");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        state.formMode = null; state.editingId = null;
    }
    function esc(str) { if (!str) return ""; return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
    function debounce(fn, ms) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; }

    function getStyles() { return `
.barang-page { padding: 1.5rem; }
.barang-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.barang-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.barang-page .page-header .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.barang-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.barang-page .search-wrapper { position:relative; display:flex; align-items:center; }
.barang-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
.barang-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.barang-page .search-wrapper input:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.barang-page .table-container { background:var(--smart-card-bg,#fff); border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); overflow:hidden; }
.barang-page .pagination-container { display:flex; justify-content:center; padding:0.75rem 0 0.25rem; }
.barang-page .action-buttons { display:flex; gap:0.5rem; justify-content:center; }
.barang-page .action-btn { padding:0.35rem 0.7rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; }
.barang-page .action-btn-edit { background:#eef2ff; color:#4f46e5; border-color:#c7d2fe; }
.barang-page .action-btn-edit:hover { background:#e0e7ff; }
.barang-page .action-btn-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.barang-page .action-btn-delete:hover { background:#fee2e2; }
.barang-page .stok-low { color:#dc2626; font-weight:600; }
.barang-page .stok-ok { color:#16a34a; }
.barang-page .skeleton-wrapper { padding:1rem; }
.barang-page .delete-confirm { text-align:center; padding:1rem 0; }
.barang-page .delete-confirm p { font-size:1rem; margin-bottom:1.5rem; color:var(--smart-text-secondary,#6b7280); }
.barang-page .delete-confirm .item-name { font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.barang-page .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.barang-page .form-grid .full-width { grid-column:1/-1; }
.barang-page .form-group { margin-bottom:0.25rem; }
.barang-page .form-group label { display:block; font-size:0.85rem; font-weight:500; margin-bottom:0.35rem; color:var(--smart-text-primary,#374151); }
.barang-page .form-group input, .barang-page .form-group textarea, .barang-page .form-group select { width:100%; padding:0.5rem 0.75rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; outline:none; box-sizing:border-box; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.barang-page .form-group input:focus, .barang-page .form-group textarea:focus, .barang-page .form-group select:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.barang-page .form-group textarea { resize:vertical; min-height:60px; }
.barang-page .kode-wrapper { display:flex; gap:0.5rem; align-items:center; }
.barang-page .kode-wrapper input { flex:1; }
.barang-page .btn-scan { padding:0.4rem 0.65rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; background:var(--smart-card-bg,#f8fafc); cursor:pointer; font-size:0.95rem; transition:all 0.15s; white-space:nowrap; display:flex; align-items:center; gap:0.3rem; }
.barang-page .btn-scan:hover { background:#eef2ff; border-color:#c7d2fe; }
.barang-page .btn-scan.active { background:#4f46e5; color:#fff; border-color:#4f46e5; }
.barang-page .btn-scan.active:hover { background:#4338ca; }
.barang-page .page-info { text-align:center; font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); padding:0.5rem 0 1rem; }
.barang-page .required { color:#dc2626; }
.barang-page .kode-error-container { margin-top:0.5rem; }
.barang-page .kode-error-container .smart-alert { margin:0; padding:0.5rem 0.75rem; font-size:0.8rem; }
.barang-page #f-kode.is-duplicate { border-color:#dc2626 !important; background:#fef2f2 !important; box-shadow:0 0 0 3px rgba(220,38,38,0.1) !important; }
.barang-page #f-nama:disabled { background:#f3f4f6 !important; color:#9ca3af !important; cursor:not-allowed !important; border-color:#e5e7eb !important; opacity:0.7; }
.smart-modal-dialog { overflow-y:visible !important; display:flex; flex-direction:column; max-height:85vh; }
.smart-modal-body { overflow-y:auto !important; flex:1 1 auto; min-height:0; }
.sm-card .card-body { display:flex; flex-direction:column; gap:0.35rem; margin-bottom:0.5rem; padding-top:0.35rem; }
.sm-card .card-row, .sm-card .card-price-row, .sm-card .card-stok-row { display:flex; justify-content:space-between; align-items:center; }
.sm-card .card-label { font-size:0.78rem; color:var(--smart-text-secondary,#6b7280); font-weight:400; }
.sm-card .card-harga-jual { font-size:0.95rem; font-weight:700; color:#059669; }
.sm-card .card-stok { font-size:0.85rem; font-weight:500; }
.sm-card .card-value { font-size:0.95rem; font-weight:700; color:#059669; }
.sm-card .card-btn-detail { padding:0.35rem 0.85rem; border:1px solid #c7d2fe; border-radius:6px; background:#eef2ff; color:#4f46e5; cursor:pointer; font-size:0.9rem; font-weight:500; transition:all 0.15s; }
.sm-card .card-btn-detail:hover { background:#e0e7ff; }
.detail-grid { display:flex; flex-direction:column; gap:0.1rem; }
.detail-row { display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f3f4f6; }
.detail-row:last-child { border-bottom:none; }
.detail-row-full { flex-direction:column; align-items:flex-start; gap:0.35rem; }
.detail-label { font-size:0.8rem; color:var(--smart-text-secondary,#6b7280); font-weight:500; flex-shrink:0; }
.detail-value { font-size:0.9rem; color:var(--smart-text-primary,#1a1a2e); font-weight:500; text-align:right; word-break:break-word; }
@media (max-width:768px) {
.barang-page { padding:0.75rem 0.25rem; }
.barang-page .form-grid { grid-template-columns:1fr; }
.barang-page .page-header { flex-direction:column; align-items:stretch; }
.barang-page .search-wrapper { flex:1; min-width:0; }
.barang-page .search-wrapper input { width:100%; box-sizing:border-box; }
.barang-page .page-actions { flex-direction:row; }
.barang-page .page-actions .smart-btn { white-space:nowrap; flex-shrink:0; font-size:0.82rem; padding:0.45rem 0.7rem; }
.barang-page .table-container { background:none; border-radius:0; box-shadow:none; overflow:visible; }
.barang-page .pagination-container { padding:0.75rem 0 0.25rem; }
}
@media (max-width:480px) {
.barang-page .page-header h1 { font-size:1.15rem; }
.barang-page .page-header .header-subtitle { font-size:0.78rem; }
}
`; }

    return { BarangPage, initBarangPage };
}
