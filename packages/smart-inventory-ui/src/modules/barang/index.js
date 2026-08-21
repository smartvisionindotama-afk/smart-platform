/**
 * Barang Module — Framework Module.
 *
 * DI-based module untuk manajemen barang. Menerima semua data services
 * via parameter sehingga bisa dipakai aplikasi manapun.
 *
 * @module @smart/inventory-ui/modules/barang
 */

import { Modal, Table, Pagination, EmptyState, Alert, Skeleton, showToast, UI } from "@smart/ui";
import { esc, formatThousand, unformatThousand } from "@smart/core";

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
 * @param {Object} [options] Opsi modul (additive, backward compatible)
 * @param {string[]} [options.behaviorOptions] Daftar behavior yang ditampilkan
 *   di field "Tipe Barang". Default: semua (trading/service/recipe/recipe-fnb)
 *   — dipakai POS. App yang tidak memakai resep (mis. inventory: hanya
 *   barang dagangan & jasa/ongkir) mengirim subset: ["trading", "service"].
 * @param {boolean} [options.showDijual] Tampilkan field/kolom "Dijual /
 *   Tidak Dijual" (M6.2 — ingredient resep F&B). Hanya POS yang mengirim
 *   true saat company mengaktifkan F&B; app lain (inventory) default false.
 * @param {string[]} [options.varianBehaviorOptions] Daftar tipe barang yang
 *   mendukung VARIAN produk marketplace SKU (M6.2-FIX v0.43). Default
 *   ["trading","recipe"] (POS: Barang Dagangan & Resep simple). Inventory
 *   mengirim ["trading","service"] (Barang Dagangan & Jasa).
 * @param {string} [options.varianSwitchColor] Warna track toggle varian
 *   (hex). Default hijau tua "#15803d" (POS). Inventory mengirim ungu
 *   "#982deb" (selaras theme ungu inv.e-profit.id).
 * @returns {{ BarangPage: Function, initBarangPage: Function }}
 */
export function BarangModule(services, options = {}) {
    const {
        listBarang, getBarang, createBarang, updateBarang, deleteBarang,
        listKategori, listSatuan, listRak, listWarehouse,
        createKategori, createSatuan, createRak,
        formatRupiah, checkKodeExists
    } = services;

    // ── State ──
    const state = {
        items: [], page: 1, limit: 10, total: 0, totalPages: 1,
        search: "", loading: false, formMode: null, editingId: null, deletingId: null,
        // Tipe barang yang ditampilkan di form (SP-029 M3 / M6.2-FIX).
        // Default semua — app tertentu (inventory) memakai subset via options.
        behaviorOptions: Array.isArray(options.behaviorOptions) && options.behaviorOptions.length
            ? [...options.behaviorOptions]
            : ["trading", "service", "recipe", "recipe-fnb"],
        // M6.2-FIX v0.40 — kolom "Dijual / Tidak Dijual" (hanya saat F&B aktif)
        showDijual: Boolean(options.showDijual),
        // M6.2-FIX v0.43 — tipe yang mendukung VARIAN marketplace SKU
        // (POS: trading & resep simple; Inventory: trading & jasa)
        varianBehaviorOptions: Array.isArray(options.varianBehaviorOptions) && options.varianBehaviorOptions.length
            ? [...options.varianBehaviorOptions]
            : ["trading", "recipe"],
        // Warna track toggle varian (POS: hijau tua; Inventory: ungu theme)
        varianSwitchColor: String(options.varianSwitchColor || "#15803d")
    };

    // Katalog Tipe Barang — label konsisten (dipakai form & detail modal).
    const BEHAVIOR_LABELS = {
        trading: "Barang Dagangan",
        service: "Jasa / Service",
        recipe: "Resep / Menu (Tanpa Stok — simple)",
        "recipe-fnb": "Resep / Menu (Terhubung Recipe F&B)"
    };
    const NON_TRADING_BEHAVIORS = ["service", "recipe", "recipe-fnb"];

    // ── Cached Data ──
    let _rakData = [];
    let _warehouseData = [];

    let _scannerInstance = null;

    // Foto produk (data URI hasil kompresi client-side) — SP-029 M3-FIX
    let _fotoDataUri = "";

    // M6.2-FIX v0.43 — VARIAN PRODUK (marketplace SKU): dimensi + kombinasi.
    // _varianDefs: [{ nama, nilai[] }] dari input form; _existingSkus: daftar
    // SKU lama (edit) utk prefill harga/stok per kombinasi; _skuFotos: data
    // URI foto per kombinasi (label → foto) — bertahan saat tabel di-render
    // ulang (mis. dimensi berubah) dan disimpan ke skus[].foto saat submit.
    let _varianDefs = [];
    let _existingSkus = [];
    let _skuFotos = {};

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
            // PRD V1 — kode berfungsi sebagai barcode (barcode diisi di kolom Kode)
            // SP-029 M3-FIX — kolom Gambar (foto produk, thumbnail)
            { key: "foto", label: "Gambar", width: "76px", align: "center",
                render: (val, row) => val
                    ? `<img class="brg-thumb" src="${esc(val)}" alt="${esc(row.nama)}" loading="lazy" onerror="this.style.display='none'" />`
                    : `<span class="brg-thumb-empty">—</span>` },
            { key: "nama", label: "Nama Barang", render: (val, row) => `${esc(val)}${row?.behavior === "service" ? " <span class=\"badge-jasa\">Jasa</span>" : ""}${row?.behavior === "recipe" ? " <span class=\"badge-recipe\">Resep</span>" : ""}${row?.behavior === "recipe-fnb" ? " <span class=\"badge-recipe-fnb\">Resep F&B</span>" : ""}${varianBadgeHTML(row)}` },
            { key: "kategori", label: "Kategori", width: "140px" },
            { key: "satuan", label: "Satuan", width: "85px", align: "center" },
            { key: "rak", label: "Rak/Etalase", width: "100px" },
            { key: "gudang", label: "Gudang", width: "100px" },
            ...(state.showDijual
                ? [{ key: "dijual", label: "", width: "100px", align: "center",
                    render: (val) => val === false
                        ? `<span class="badge-tidak-dijual">Tidak Dijual</span>`
                        : "" }]
                : []),
            { key: "harga_beli", label: "Harga Beli", width: "130px", align: "right",
                render: (val) => `<span style="font-weight:500;color:#6b7280">${formatRupiah(val)}</span>` },
            { key: "harga_jual", label: "Harga Jual", width: "130px", align: "right",
                render: (val, row) => `<span style="font-weight:600;color:#059669">${formatRupiah(val)}</span>${(Number(row?.harga_khusus) || 0) > 0 ? `<br/><small class="brg-hk">Khusus: ${formatRupiah(row.harga_khusus)}</small>` : ""}` },
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
                <div class="sm-card-row2">
                    <div class="sm-card-col-img">
                        ${item.foto
                            ? `<img src="${esc(item.foto)}" alt="${esc(item.nama)}" class="sm-card-product-img" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\'sm-card-img-placeholder\'>📦</span>'" />`
                            : `<span class="sm-card-img-placeholder">📦</span>`}
                        ${varianBadgeHTML(item) ? `<div class="sm-card-varian-below">${varianBadgeHTML(item)}</div>` : ""}
                    </div>
                    <div class="sm-card-col-data">
                        <div class="sm-card-name-row">
                            <div class="sm-card-name">${esc(item.nama)}</div>
                            <span class="sm-card-code">${esc(item.kode)}</span>
                        </div>
                        <div class="sm-card-details">
                            ${item.gudang ? `<div class="sm-card-detail-row"><span class="sm-card-label">Gudang</span><span class="sm-card-value">${esc(item.gudang)}</span></div>` : ""}
                            <div class="sm-card-detail-row"><span class="sm-card-label">Harga Jual</span><span class="sm-card-value" style="color:#059669;font-weight:600">${formatRupiah(item.harga_jual)}</span></div>
                            <div class="sm-card-detail-row"><span class="sm-card-label">Stok</span><span class="sm-card-value ${isLow ? "stok-low" : "stok-ok"}">${item.stok}${item.satuan ? ` ${esc(item.satuan)}` : ""}</span></div>
                        </div>
                        <div class="sm-card-footer-row">
                            <div class="sm-card-footer-left">
                                ${item.behavior === "service" ? "<span class=\"sm-card-btn badge-jasa\">Jasa</span>" : ""}${item.behavior === "recipe" ? "<span class=\"sm-card-btn badge-recipe\">Resep</span>" : ""}${item.behavior === "recipe-fnb" ? "<span class=\"sm-card-btn badge-recipe-fnb\">Resep F&B</span>" : ""}${state.showDijual && item.dijual === false ? "<span class=\"sm-card-btn badge-tidak-dijual\">Tidak Dijual</span>" : ""}
                            </div>
                            <div class="sm-card-footer-right">
                                <button class="sm-card-btn sm-card-btn-edit" data-edit="${item.id}">✏️ Edit</button>
                                <button class="sm-card-btn sm-card-btn-delete" data-delete="${item.id}">🗑️ Hapus</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.appendChild(list);
        UI.attachCardEvents(container, (id) => openForm("edit", id), (id) => confirmDelete(id));
    }

    function showDetailModal(item) {
        const isLow = Number(item.stok) <= Number(item.stok_minimum);
        const contentHTML = `
            <div class="detail-grid">
                ${item.foto ? `<div class="detail-row detail-row-full"><span class="detail-label">Foto</span><span class="detail-value"><img class="brg-thumb brg-thumb-lg" src="${esc(item.foto)}" alt="${esc(item.nama)}" /></span></div>` : ""}
                ${renderDetailRow("Kode", esc(item.kode))}
                ${renderDetailRow("Nama Barang", `${esc(item.nama)}${item.behavior === "service" ? " <span class=\"badge-jasa\">Jasa</span>" : ""}${item.behavior === "recipe" ? " <span class=\"badge-recipe\">Resep</span>" : ""}${item.behavior === "recipe-fnb" ? " <span class=\"badge-recipe-fnb\">Resep F&B</span>" : ""}${varianBadgeHTML(item)}`)}
                ${renderDetailRow("Tipe", BEHAVIOR_LABELS[item.behavior] || "Barang Dagangan")}
                ${state.showDijual && item.dijual === false ? renderDetailRow("Status", "<span class=\"badge-tidak-dijual\">Tidak Dijual</span>") : ""}
                ${renderDetailRow("Kategori", esc(item.kategori || "—"))}
                ${renderDetailRow("Satuan", esc(item.satuan || "—"))}
                ${renderDetailRow("Rak/Etalase", esc(item.rak || "—"))}
                ${renderDetailRow("Gudang", esc(item.gudang || "—"))}
                ${renderDetailRow("Harga Beli", formatRupiah(item.harga_beli), "#6b7280")}
                ${renderDetailRow("Harga Jual", formatRupiah(item.harga_jual), "#059669;font-weight:600")}
                ${(Number(item.harga_khusus) || 0) > 0 ? renderDetailRow("Harga Khusus", formatRupiah(item.harga_khusus), "#b45309;font-weight:600") : ""}
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

    /** Badge jumlah SKU varian (M6.2-FIX v0.43) — kosong utk barang tanpa varian. */
    function varianBadgeHTML(row) {
        const skus = Array.isArray(row?.skus) && row.skus.length ? row.skus : [];
        if (!skus.length) return "";
        const totalStok = skus.reduce((s, x) => s + (Number(x.stok) || 0), 0);
        return ` <span class="badge-varian" title="${skus.length} SKU · total stok ${totalStok}">${skus.length} Varian</span>`;
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
        // SP-029 M3 — behavior: "trading" (barang fisik) | "service" (jasa)
        // PRD V1 — + "recipe" (resep: dijual tanpa kurangi stok di V1, engine
        // penuh V2). Placeholder enum: manufactured/digital (V2/V3) tetap
        // disimpan model — form cukup trading/service/recipe untuk V1.
        // SP-029 M3-FIX — foto produk: direset dulu, lalu diisi ulang dari data
        // item saat edit (agar foto lama TIDAK terhapus bila tidak diubah).
        _fotoDataUri = "";
        let formData = { kode: "", nama: "", behavior: "trading", kategori: "", satuan: "", rak: "", gudang: "", dijual: true, harga_beli: "", harga_jual: "", harga_khusus: "", stok: "", stok_minimum: "", deskripsi: "", foto: "", varianDef: [], skus: [] };
        if (isEdit && id) {
            try {
                const item = await getBarang(id);
                if (item) formData = { kode: item.kode, nama: item.nama, behavior: item.behavior || "trading", kategori: item.kategori, satuan: item.satuan, rak: item.rak || "", gudang: item.gudang || "", dijual: item.dijual !== false, harga_beli: item.harga_beli, harga_jual: item.harga_jual, harga_khusus: item.harga_khusus || 0, stok: item.stok, stok_minimum: item.stok_minimum, deskripsi: item.deskripsi, foto: item.foto || "", varianDef: Array.isArray(item.varianDef) ? item.varianDef : [], skus: Array.isArray(item.skus) ? item.skus : [] };
            } catch { showToast("danger", "Gagal memuat data"); return; }
        }
        // Foto lama dipertahankan sebagai baseline — bila user tidak mengubahnya,
        // foto tetap tersimpan saat submit (foto: _fotoDataUri).
        _fotoDataUri = formData.foto || "";
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
        // M6.2-FIX v0.43 — inisialisasi section VARIAN (radio + builder + SKU)
        initVarianSection(formData);
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
                <!-- Gudang di PALING ATAS form — M6.2-FIX v0.40: pilihan gudang
                     SELALU tampil utk semua tipe barang (trading, jasa, resep
                     simple & F&B). Rak/Etalase tetap model sebelumnya (hidden
                     utk non-trading). -->
                <div class="form-group" id="f-gudang-field">
                    <label for="f-gudang">Gudang <small class="cn-muted">(wajib utk Barang Dagangan)</small></label>
                    <select id="f-gudang"><option value="">— Pilih Gudang —</option>${gudangOptions.map(g => `<option value="${g}" ${data.gudang === g ? "selected" : ""}>${g}</option>`).join("")}</select>
                </div>
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
                    <label for="f-behavior">Tipe Barang</label>
                    <select id="f-behavior">
                        ${state.behaviorOptions.map(v => `<option value="${v}" ${data.behavior === v || (!data.behavior && v === "trading") ? "selected" : ""}>${BEHAVIOR_LABELS[v] || v}</option>`).join("")}
                        ${data.behavior && !state.behaviorOptions.includes(data.behavior) ? `<option value="${data.behavior}" selected>${BEHAVIOR_LABELS[data.behavior] || data.behavior} (tipe saat ini)</option>` : ""}
                    </select>
                    <small>${state.behaviorOptions.includes("recipe") || state.behaviorOptions.includes("recipe-fnb")
                        ? "Resep Tanpa Stok = model simple (penyesuaian stok via stok opname). Resep Terhubung Recipe F&B = bahan dikonsumsi realtime saat terjual (Master → Recipe F&B)."
                        : "Jasa tidak memakai stok/gudang."}</small>
                </div>
                <div class="form-group">
                    <label for="f-kategori">Kategori</label>
                    <select id="f-kategori">${renderOpts(kategoriOptions, data.kategori, "__add_kategori__", "➕ Tambah Kategori")}</select>
                </div>
                <div class="form-group">
                    <label for="f-satuan">Satuan</label>
                    <select id="f-satuan">${renderOpts(satuanOptions, data.satuan, "__add_satuan__", "➕ Tambah Satuan")}</select>
                </div>
                ${state.showDijual ? `
                <div class="form-group" id="f-dijual-field">
                    <label for="f-dijual">Dijual di Kasir</label>
                    <select id="f-dijual">
                        <option value="1" ${data.dijual !== false ? "selected" : ""}>Dijual</option>
                        <option value="0" ${data.dijual === false ? "selected" : ""}>Tidak Dijual</option>
                    </select>
                    <small>Tidak Dijual = hanya bahan resep F&B (tidak tampil di kasir).</small>
                </div>
                ` : ""}
                <div class="form-group" id="f-rak-field" style="${NON_TRADING_BEHAVIORS.includes(data.behavior) ? "display:none" : ""}">
                    <label for="f-rak">Rak / Etalase</label>
                    <select id="f-rak">${renderOpts(rakOptions, data.rak, "__add_rak__", "➕ Tambah Rak")}</select>
                </div>
                <div class="form-grid" id="f-trading-fields" style="${NON_TRADING_BEHAVIORS.includes(data.behavior) ? "display:none" : ""}">
                    <div class="form-group">
                        <label for="f-harga-beli">Harga Beli</label>
                        <input type="number" id="f-harga-beli" value="${data.harga_beli}" placeholder="0" min="0" />
                    </div>
                    <!-- f-stok-field: disembunyikan saat VARIAN AKTIF (stok awal
                         di-handle per SKU; stok utama = Σ stok SKU oleh server) -->
                    <div class="form-group" id="f-stok-field">
                        <label for="f-stok">Stok Awal</label>
                        <input type="number" id="f-stok" value="${data.stok}" placeholder="0" min="0" />
                    </div>
                    <div class="form-group">
                        <label for="f-stok-minimum">Stok Minimum</label>
                        <input type="number" id="f-stok-minimum" value="${data.stok_minimum}" placeholder="0" min="0" />
                    </div>
                </div>
                <!-- M6.2-FIX v0.43 — VARIAN PRODUK (marketplace SKU): toggle
                     geser (kiri = tanpa varian, kanan = dengan varian) +
                     builder dimensi + tabel kombinasi (label di kiri tiap
                     field + foto per SKU). Hanya utk Barang Dagangan & Resep
                     simple (resep F&B punya varian sendiri via Recipe F&B).
                     CSS varian di-inject DI DALAM modal (modal di-append ke
                     document.body — style scoped .barang-page tidak sampai). -->
                <style>${getVarianStyles()}</style>
                <div class="form-group full-width" id="f-varian-field" style="display:none">
                    <div class="varian-toggle">
                        <!-- M6.2-FIX v0.43 — toggle mandiri (pola Bootstrap form-switch
                             dari biaya-module.js, TANPA komponen @smart/ui Switch):
                             checkbox + track hijau tua + knob putih; knob digerakkan
                             via JS (inline style) → tidak bergantung CSS framework,
                             dijamin tampil di semua browser. Judul "Varian Produk"
                             di KANAN toggle; toggle pendek (44px). -->
                        <label class="varian-switch" style="position:relative;display:inline-block;width:44px;height:20px;cursor:pointer;margin:0;flex-shrink:0;">
                            <input type="checkbox" name="f-varian-mode" ${Array.isArray(data.varianDef) && data.varianDef.length ? "checked" : ""} style="opacity:0;position:absolute;width:0;height:0;" />
                            <span class="varian-switch-track" style="position:absolute;inset:0;background:${state.varianSwitchColor};border-radius:10px;transition:background .2s ease;">
                                <span class="varian-switch-knob" style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .2s ease;"></span>
                            </span>
                        </label>
                        <span style="font-size:0.85rem;font-weight:600;color:#1a1a2e;">Varian Produk</span>
                    </div>
                    <div id="f-varian-builder" style="display:none">
                        <p class="cn-muted" style="margin:6px 0 8px">Definisikan dimensi varian — mis. <strong>Ukuran</strong> (S, M, L) atau <strong>Topping</strong> (Coklat, Keju). Tiap kombinasi nilai otomatis menjadi 1 SKU dengan harga, stok &amp; foto sendiri.</p>
                        <div id="f-varian-defs"></div>
                        <button type="button" class="foto-btn" id="f-varian-add-dim">➕ Tambah Dimensi</button>
                        <div id="f-varian-skus-wrap" style="display:none">
                            <div class="varian-sku-head">Kombinasi (SKU)</div>
                            <p class="cn-muted" style="margin:0 0 6px;font-size:0.75rem">Harga = pelanggan umum · Harga Khusus = member/pelanggan terdaftar (dipakai kasir bila &gt; 0).</p>
                            <div id="f-varian-skus"></div>
                        </div>
                    </div>
                </div>
                <!-- f-harga-jual-field & f-harga-khusus-field: disembunyikan saat
                     VARIAN AKTIF — harga global diganti harga per SKU (Harga =
                     umum, Harga Khusus = member). Nonaktif = tetap seperti dulu. -->
                <div class="form-group" id="f-harga-jual-field">
                    <label for="f-harga-jual">Harga Jual</label>
                    <input type="number" id="f-harga-jual" value="${data.harga_jual}" placeholder="0" min="0" />
                    <small>Pelanggan umum</small>
                </div>
                <div class="form-group" id="f-harga-khusus-field">
                    <label for="f-harga-khusus">Harga Khusus (multi price)</label>
                    <input type="number" id="f-harga-khusus" value="${data.harga_khusus}" placeholder="0 (kosong = pakai harga jual)" min="0" />
                    <small>Dipakai layar kasir bila > 0 (PRD V1, multi price minimal) — untuk member/pelanggan</small>
                </div>
                <div class="form-group full-width">
                    <label for="f-foto">Foto Produk</label>
                    <div class="foto-upload">
                        <div class="foto-preview" id="f-foto-preview">
                            ${data.foto
                                ? `<img src="${esc(data.foto)}" alt="Preview" />`
                                : `<span class="foto-placeholder">📷</span>`}
                        </div>
                        <div class="foto-actions">
                            <button type="button" class="foto-btn" id="f-foto-btn">📁 Pilih Gambar</button>
                            ${data.foto ? `<button type="button" class="foto-btn foto-btn-danger" id="f-foto-clear">🗑 Hapus</button>` : ""}
                            <input type="file" id="f-foto-file" accept="image/*" hidden />
                            <small class="foto-hint">JPG/PNG/WebP maks 3MB — otomatis dikompres untuk layar kasir.</small>
                        </div>
                    </div>
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

    // ── VARIAN PRODUK (M6.2-FIX v0.43) — builder dimensi + kombinasi SKU ──

    /** Tipe barang yang mendukung varian marketplace SKU (per app). */
    function varianSupported(behavior) {
        return state.varianBehaviorOptions.includes(behavior);
    }

    /**
     * Tampilkan/sembunyikan builder varian (switch geser Tanpa/Dengan Varian).
     * Saat AKTIF → harga & stok di-handle per SKU: sembunyikan field global
     * (Harga Jual / Harga Khusus / Stok Awal). Nonaktif → kembali seperti dulu.
     */
    function toggleVarianBuilder(on) {
        const builder = document.getElementById("f-varian-builder");
        if (builder) builder.style.display = on ? "block" : "none";
        if (!on) _skuFotos = {};
        if (on) renderVarianDefs();
        syncVarianGlobalFields(on);
    }

    /**
     * Sembunyikan/tampilkan field global yang digantikan harga/stok per SKU
     * saat varian AKTIF (M6.2-FIX): Harga Jual (umum), Harga Khusus (member)
     * & Stok Awal — nilainya diatur per kombinasi SKU di tabel varian.
     * @param {boolean} on varian aktif?
     */
    function syncVarianGlobalFields(on) {
        ["f-harga-jual-field", "f-harga-khusus-field", "f-stok-field"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = on ? "none" : "";
        });
    }

    /**
     * CSS section VARIAN — di-inject DI DALAM konten modal (modal di-append
     * ke document.body, di luar #barang-page → style scoped .barang-page
     * tidak menjangkau isi modal; pola sama dgn modalStyles v28f).
     * Switch: hijau (#10b981) saat on, lebih panjang (96px ≈ lebar judul
     * "Varian Produk") agar kontras dgn background.
     */
    function getVarianStyles() {
        return `
            #f-varian-field .varian-toggle { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; }
            #f-varian-field .varian-dim-row { display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center; }
            #f-varian-field .varian-dim-row input { flex:1; min-width:0; }
            #f-varian-field .varian-dim-remove {
                flex-shrink:0; width:34px; height:34px; border:1px solid #fecaca; border-radius:6px;
                background:#fef2f2; color:#dc2626; cursor:pointer; font-size:0.9rem;
            }
            #f-varian-field .varian-sku-head {
                margin-top:12px; margin-bottom:6px; font-size:0.85rem; font-weight:600; color:#1a1a2e;
            }
            #f-varian-field .varian-sku-row {
                margin-bottom:0.6rem; padding:0.6rem 0.7rem;
                border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;
            }
            /* Baris 1: nama + foto SKU; Baris 2: Kode SKU/Harga/Stok selebar modal */
            #f-varian-field .varian-sku-top {
                display:flex; align-items:center; justify-content:flex-start;
                gap:8px; margin-bottom:0.6rem; min-width:0;
            }
            #f-varian-field .varian-sku-label {
                font-size:0.85rem; font-weight:600; color:#1a1a2e;
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            }
            #f-varian-field .varian-sku-fields {
                /* Kolom harga dibagi 2 @50%: Harga (umum) + Harga Khusus (member),
                   di samping Kode SKU & Stok — M6.2-FIX */
                display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr;
                gap:0.6rem; width:100%;
            }
            /* Harga, Harga Khusus & Stok: angka rata kanan (format ribuan id-ID) */
            #f-varian-field .varian-sku-harga, #f-varian-field .varian-sku-harga-khusus, #f-varian-field .varian-sku-stok { text-align:right; }
            #f-varian-field .varian-sku-foto-cell { position:relative; display:flex; align-items:center; flex-shrink:0; }
            #f-varian-field .varian-sku-foto-btn {
                width:38px; height:38px; border:1px dashed #cbd5e1; border-radius:8px;
                background:#fff; cursor:pointer; overflow:hidden;
                display:flex; align-items:center; justify-content:center; font-size:0.9rem;
            }
            #f-varian-field .varian-sku-foto-btn img { width:100%; height:100%; object-fit:cover; }
            #f-varian-field .varian-sku-foto-clear {
                position:absolute; top:-6px; right:-6px; width:16px; height:16px; border-radius:50%;
                background:#dc2626; color:#fff; font-size:0.6rem; line-height:1; cursor:pointer;
                border:none; display:flex; align-items:center; justify-content:center;
            }
            #f-varian-field .varian-field { display:flex; align-items:center; gap:12px; min-width:0; }
            #f-varian-field .varian-field label {
                flex-shrink:0; font-size:0.72rem; font-weight:600; color:#64748b; width:52px;
                text-align:right; /* label rata kanan — jarak konsisten ke input */
            }
            #f-varian-field .varian-field input {
                flex:1; min-width:0; padding:0.45rem 0.55rem;
                border:1px solid #d1d5db; border-radius:6px; font-size:0.85rem; outline:none;
                background:#fff; color:#1a1a2e;
            }
            #f-varian-field .varian-field input:focus {
                border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.1);
            }
            /* Responsif HP/tablet — baris field SKU menumpuk 1 kolom selebar modal,
               mengikuti pola .smart-modal-body .form-grid (field lain di modal ini
               juga turun ke 1 kolom di layar kecil): tiap field = label di atas
               input, bukan lagi 3 kolom mepet seperti desktop. */
            @media (max-width:1024px) {
                #f-varian-field .varian-sku-fields { grid-template-columns:1fr; }
                #f-varian-field .varian-field {
                    display:block;
                }
                #f-varian-field .varian-field label {
                    display:block; width:auto; text-align:left; font-size:0.8rem;
                    margin-bottom:0.3rem;
                }
                #f-varian-field .varian-field input {
                    width:100%; box-sizing:border-box;
                }
            }
        `;
    }

    /** Sinkronkan visibility section varian dengan tipe barang terpilih. */
    function syncVarianVisibility(behavior) {
        const field = document.getElementById("f-varian-field");
        if (!field) return;
        const supported = varianSupported(behavior);
        field.style.display = supported ? "" : "none";
        if (!supported) {
            const sw = document.querySelector('input[name="f-varian-mode"]');
            if (sw) sw.checked = false;
            toggleVarianBuilder(false);
            syncVarianKnob();
        }
    }

    /** Render baris dimensi (nama + nilai dipisah koma) dari _varianDefs. */
    function renderVarianDefs() {
        const wrap = document.getElementById("f-varian-defs");
        if (!wrap) return;
        if (!_varianDefs.length) _varianDefs.push({ nama: "", nilai: [] });
        wrap.innerHTML = _varianDefs.map((d, i) => `
            <div class="varian-dim-row" data-idx="${i}">
                <input type="text" class="varian-dim-nama" value="${esc(d.nama || "")}" placeholder="Nama dimensi (mis. Ukuran)" />
                <input type="text" class="varian-dim-nilai" value="${esc((d.nilai || []).join(", "))}" placeholder="Nilai, pisahkan koma (mis. S, M, L)" />
                <button type="button" class="varian-dim-remove" data-idx="${i}" title="Hapus dimensi">🗑</button>
            </div>
        `).join("");
        wrap.querySelectorAll(".varian-dim-nama").forEach((inp, i) => {
            inp.addEventListener("input", () => { _varianDefs[i].nama = inp.value; renderVarianSkus(); });
        });
        wrap.querySelectorAll(".varian-dim-nilai").forEach((inp, i) => {
            inp.addEventListener("input", () => {
                _varianDefs[i].nilai = inp.value.split(",").map(s => s.trim()).filter(Boolean);
                renderVarianSkus();
            });
        });
        wrap.querySelectorAll(".varian-dim-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                _varianDefs.splice(Number(btn.dataset.idx), 1);
                if (!_varianDefs.length) _varianDefs.push({ nama: "", nilai: [] });
                renderVarianDefs();
            });
        });
        renderVarianSkus();
    }

    /** Produk kartesian nilai seluruh dimensi → array kombinasi. */
    function varianCombinations(defs) {
        const valid = (defs || [])
            .filter(d => String(d.nama || "").trim() && (d.nilai || []).length);
        if (!valid.length) return [];
        return valid.reduce((acc, d) => {
            const next = [];
            acc.forEach(combo => d.nilai.forEach(v => next.push([...combo, v])));
            return next;
        }, [[]]);
    }

    /**
     * Render tabel kombinasi (SKU) — 1 baris per kombinasi, tiap field
     * (Kode SKU · Harga · Stok) berlabel di KIRI input (bukan placeholder),
     * plus foto per SKU opsional. Prefill dari SKU lama saat edit.
     */
    function renderVarianSkus() {
        const wrap = document.getElementById("f-varian-skus");
        const outer = document.getElementById("f-varian-skus-wrap");
        if (!wrap || !outer) return;
        const combos = varianCombinations(_varianDefs);
        outer.style.display = combos.length ? "" : "none";
        if (!combos.length) { wrap.innerHTML = ""; return; }
        wrap.innerHTML = combos.map((vals) => {
            const label = vals.join(" / ");
            const existing = _existingSkus.find(s => String(s.label || "").trim().toLowerCase() === label.toLowerCase());
            const kode = existing && existing.kode ? String(existing.kode) : "";
            const harga = existing ? (Number(existing.harga) || 0) : 0;
            // M6.2-FIX — harga khusus per SKU (utk member), prefill saat edit
            const hargaKhusus = existing ? (Number(existing.harga_khusus) || 0) : 0;
            const stok = existing ? (Number(existing.stok) || 0) : 0;
            const foto = _skuFotos[label] || (existing && existing.foto ? String(existing.foto) : "");
            if (foto && !_skuFotos[label]) _skuFotos[label] = foto;
            return `
                <div class="varian-sku-row" data-label="${esc(label)}">
                    <div class="varian-sku-top">
                        <span class="varian-sku-label" title="${esc(label)}">${esc(label)}</span>
                        <div class="varian-sku-foto-cell">
                            <button type="button" class="varian-sku-foto-btn" title="Pilih foto varian">
                                ${foto ? `<img src="${esc(foto)}" alt="Foto" />` : "📷"}
                            </button>
                            <input type="file" class="varian-sku-foto" accept="image/*" hidden />
                            ${foto ? `<button type="button" class="varian-sku-foto-clear" title="Hapus foto">✕</button>` : ""}
                        </div>
                    </div>
                    <div class="varian-sku-fields">
                        <div class="varian-field">
                            <label for="">Kode SKU</label>
                            <input type="text" class="varian-sku-kode" value="${esc(kode)}" placeholder="cth: BRG-001-S" />
                        </div>
                        <div class="varian-field">
                            <label for="">Harga</label>
                            <input type="text" inputmode="numeric" class="varian-sku-harga" value="${formatThousand(harga)}" placeholder="0" />
                        </div>
                        <div class="varian-field">
                            <label for="">Harga Khusus</label>
                            <input type="text" inputmode="numeric" class="varian-sku-harga-khusus" value="${formatThousand(hargaKhusus)}" placeholder="0 (kosong = pakai Harga)" />
                        </div>
                        <div class="varian-field">
                            <label for="">Stok</label>
                            <input type="text" inputmode="numeric" class="varian-sku-stok" value="${formatThousand(stok)}" placeholder="0" />
                        </div>
                    </div>
                </div>
            `;
        }).join("");
        // Foto per SKU — pilih file → kompres → simpan per label → preview
        wrap.querySelectorAll(".varian-sku-row").forEach(rowEl => {
            const label = String(rowEl.dataset.label || "");
            const fileInput = rowEl.querySelector(".varian-sku-foto");
            const btn = rowEl.querySelector(".varian-sku-foto-btn");
            if (btn && fileInput) {
                btn.addEventListener("click", (e) => { e.preventDefault(); fileInput.click(); });
                fileInput.addEventListener("change", async () => {
                    const file = fileInput.files && fileInput.files[0];
                    if (!file) return;
                    if (!/^image\//.test(file.type)) { showToast("warning", "File harus berupa gambar"); return; }
                    if (file.size > 3 * 1024 * 1024) { showToast("warning", "Ukuran gambar maksimal 3MB"); return; }
                    try {
                        _skuFotos[label] = await compressImage(file);
                        renderVarianSkus();
                    } catch { showToast("danger", "Gagal memproses gambar"); }
                });
            }
            const clear = rowEl.querySelector(".varian-sku-foto-clear");
            if (clear) {
                clear.addEventListener("click", (e) => {
                    e.preventDefault();
                    delete _skuFotos[label];
                    renderVarianSkus();
                });
            }
        });
        // Harga, Harga Khusus & Stok — format ribuan (xxx.xxx) + align right
        wrap.querySelectorAll(".varian-sku-harga, .varian-sku-harga-khusus, .varian-sku-stok").forEach(inp => bindThousandInput(inp));
    }

    /**
     * Input angka format ribuan (id-ID, pemisah titik) — ketik hanya digit,
     * reformat live, kosongkan bila tidak ada angka. Dipakai field Harga/Stok
     * SKU (bukan <input type=number> agar format titik bisa tampil).
     * @param {HTMLInputElement} input
     */
    function bindThousandInput(input) {
        if (!input) return;
        input.addEventListener("input", () => {
            const digits = String(input.value).replace(/\D/g, "").slice(0, 15);
            const formatted = digits ? formatThousand(digits) : "";
            if (input.value !== formatted) input.value = formatted;
        });
        input.addEventListener("blur", () => {
            const digits = String(input.value).replace(/\D/g, "");
            input.value = digits ? formatThousand(digits) : "";
        });
    }

    /** Baca dimensi dari state (nama + nilai) — utk payload submit. */
    function readVarianDefs() {
        return _varianDefs
            .map(d => ({ nama: String(d.nama || "").trim(), nilai: (d.nilai || []).map(n => String(n || "").trim()).filter(Boolean) }))
            .filter(d => d.nama && d.nilai.length);
    }

    /** Baca SKU dari baris tabel (foto/kode/harga/harga_khusus/stok) — utk payload submit. */
    function readVarianSkus(barangKode) {
        return Array.from(document.querySelectorAll(".varian-sku-row")).map((row, i) => {
            const kodeInput = row.querySelector(".varian-sku-kode");
            let kode = String(kodeInput?.value || "").trim();
            if (!kode) kode = `${barangKode || "SKU"}-${i + 1}`; // auto-fill bila kosong
            const label = String(row.dataset.label || "");
            return {
                kode,
                label,
                foto: _skuFotos[label] || "",
                // Harga/Stok format ribuan ("15.000") → angka bulat utk payload
                harga: Math.max(0, unformatThousand(row.querySelector(".varian-sku-harga")?.value)),
                // M6.2-FIX — harga khusus per SKU utk member (0 = pakai harga)
                harga_khusus: Math.max(0, unformatThousand(row.querySelector(".varian-sku-harga-khusus")?.value)),
                stok: Math.max(0, unformatThousand(row.querySelector(".varian-sku-stok")?.value))
            };
        });
    }

    /**
     * Inisialisasi section varian setelah modal form dirender.
     * @param {object} data formData (bisa membawa varianDef/skus saat edit)
     */
    function initVarianSection(data) {
        const field = document.getElementById("f-varian-field");
        if (!field) return;
        const hasVarian = Array.isArray(data.varianDef) && data.varianDef.length;
        _existingSkus = Array.isArray(data.skus) ? data.skus : [];
        _skuFotos = {};
        (_existingSkus || []).forEach(s => { if (s && s.label && s.foto) _skuFotos[String(s.label)] = String(s.foto); });
        _varianDefs = hasVarian
            ? data.varianDef.map(d => ({ nama: d.nama || "", nilai: (d.nilai || []).map(String) }))
            : [];
        const sw = document.querySelector('input[name="f-varian-mode"]');
        if (sw) sw.checked = hasVarian;
        toggleVarianBuilder(hasVarian);
        if (sw) {
            sw.addEventListener("change", () => {
                toggleVarianBuilder(sw.checked);
                syncVarianKnob();
            });
        }
        syncVarianKnob();
        document.getElementById("f-varian-add-dim")?.addEventListener("click", () => {
            _varianDefs.push({ nama: "", nilai: [] });
            renderVarianDefs();
        });
        syncVarianVisibility(data.behavior || "trading");
    }

    /**
     * Geser knob toggle varian via INLINE style (tanpa CSS :checked — pola
     * biaya-module.js yang terbukti stabil): kanan = Dengan Varian, kiri =
     * Tanpa Varian. Track selalu hijau tua (#15803d).
     */
    function syncVarianKnob() {
        const sw = document.querySelector('input[name="f-varian-mode"]');
        const knob = document.querySelector(".varian-switch-knob");
        // Track 44×20, knob 16×16, padding 2px → geser = 44 - 2*2 - 16 = 24px
        if (sw && knob) knob.style.transform = sw.checked ? "translateX(24px)" : "translateX(0)";
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

        // SP-029 M3 + PRD V1 + M6.2-FIX v0.40 — Tipe non-trading (Jasa & semua
        // Resep): sembunyikan stok/harga beli/rak-etalase. Gudang SELALU tampil
        // utk semua tipe (keputusan user v0.40).
        document.getElementById("f-behavior")?.addEventListener("change", (e) => {
            const isNonTrading = NON_TRADING_BEHAVIORS.includes(e.target.value);
            const tradingFields = document.getElementById("f-trading-fields");
            if (tradingFields) tradingFields.style.display = isNonTrading ? "none" : "";
            // Rak / Etalase tidak relevan utk Jasa & semua Resep
            const rakField = document.getElementById("f-rak-field");
            if (rakField) rakField.style.display = isNonTrading ? "none" : "";
            // M6.2-FIX v0.43 — section varian hanya utk trading & resep simple
            syncVarianVisibility(e.target.value);
        });

        // SP-029 M3-FIX — Foto produk: pilih file → kompres client-side → data URI
        const fotoBtn = document.getElementById("f-foto-btn");
        const fotoFile = document.getElementById("f-foto-file");
        if (fotoBtn && fotoFile) {
            fotoBtn.addEventListener("click", (e) => { e.preventDefault(); fotoFile.click(); });
            fotoFile.addEventListener("change", async () => {
                const file = fotoFile.files && fotoFile.files[0];
                if (!file) return;
                if (!/^image\//.test(file.type)) { showToast("warning", "File harus berupa gambar"); return; }
                if (file.size > 3 * 1024 * 1024) { showToast("warning", "Ukuran gambar maksimal 3MB"); return; }
                try {
                    _fotoDataUri = await compressImage(file);
                    const preview = document.getElementById("f-foto-preview");
                    if (preview) preview.innerHTML = `<img src="${_fotoDataUri}" alt="Preview" />`;
                    // Reset value agar file yang sama bisa dipilih ulang (change tetap terpicu)
                    fotoFile.value = "";
                    // Tampilkan tombol Hapus (belum ada saat barang baru / tanpa foto)
                    if (!document.getElementById("f-foto-clear")) {
                        const actions = document.querySelector(".foto-actions");
                        if (actions) {
                            const btn = document.createElement("button");
                            btn.type = "button";
                            btn.className = "foto-btn foto-btn-danger";
                            btn.id = "f-foto-clear";
                            btn.innerHTML = "🗑 Hapus";
                            btn.addEventListener("click", (ev) => { ev.preventDefault(); clearFoto(); });
                            actions.insertBefore(btn, actions.querySelector("input"));
                        }
                    }
                    showToast("success", "Foto produk diunggah");
                } catch (err) {
                    showToast("danger", err.message || "Gagal memproses gambar");
                }
            });
        }
        document.getElementById("f-foto-clear")?.addEventListener("click", (e) => { e.preventDefault(); clearFoto(); });

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
            // Pass gudang agar validasi kode discope per gudang — kode yg sama
            // di gudang berbeda dianggap valid (multi-warehouse). Saat EDIT,
            // kirim editId agar server mengecualikan barang itu sendiri — kode
            // milik item yang sedang diedit TIDAK dianggap duplikat.
            const result = await checkKodeExists(kodeVal, gudangVal, isEdit ? editId : null);
            if (result && result.exists) {
                // Defense tambahan (mis. fallback lokal): kalau kode masih milik
                // item yang sedang diedit, bukan duplikat → lanjutkan.
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
        // SP-029 M3 — Gudang wajib hanya untuk barang dagangan (trading).
        // Jasa & semua Resep (simple / terhubung F&B) tidak memakai gudang/stok.
        const behavior = document.getElementById("f-behavior")?.value || "trading";
        const gudang = document.getElementById("f-gudang")?.value?.trim() || "";
        if (behavior === "trading" && !gudang) { showToast("warning", "Gudang wajib dipilih"); document.getElementById("f-gudang")?.focus(); return; }

        const data = {
            kode, nama,
            behavior,
            kategori: document.getElementById("f-kategori")?.value || "",
            satuan: document.getElementById("f-satuan")?.value || "",
            rak: document.getElementById("f-rak")?.value?.trim() || "",
            gudang,
            // M6.2-FIX v0.40 — Dijual / Tidak Dijual (hanya ada saat F&B aktif)
            ...(state.showDijual
                ? { dijual: document.getElementById("f-dijual")?.value !== "0" }
                : {}),
            harga_beli: Number(document.getElementById("f-harga-beli")?.value) || 0,
            harga_jual: Number(document.getElementById("f-harga-jual")?.value) || 0,
            harga_khusus: Number(document.getElementById("f-harga-khusus")?.value) || 0,
            stok: Number(document.getElementById("f-stok")?.value) || 0,
            stok_minimum: Number(document.getElementById("f-stok-minimum")?.value) || 0,
            deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || "",
            foto: _fotoDataUri,
            // M6.2-FIX v0.43 — varian/SKU (switch geser: on = Dengan Varian;
            // off = tanpa varian → kirim array kosong agar server menghapus
            // varian lama)
            varianDef: document.querySelector('input[name="f-varian-mode"]')?.checked
                ? readVarianDefs()
                : [],
            skus: document.querySelector('input[name="f-varian-mode"]')?.checked
                ? readVarianSkus(kode)
                : []
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

    function clearFoto() {
        _fotoDataUri = "";
        const preview = document.getElementById("f-foto-preview");
        if (preview) preview.innerHTML = `<span class="foto-placeholder">📷</span>`;
        const clearBtn = document.getElementById("f-foto-clear");
        if (clearBtn) clearBtn.remove();
        const fotoFile = document.getElementById("f-foto-file");
        if (fotoFile) fotoFile.value = "";
    }

    /**
     * Kompresi gambar client-side (canvas) → data URI JPEG.
     * Maks dimensi maxSize px, kualitas quality — ringan untuk layar kasir
     * & tidak membludaki payload API (data URI tersimpan di field `foto`).
     * @param {File} file
     * @param {number} [maxSize=500]
     * @param {number} [quality=0.75]
     * @returns {Promise<string>}
     */
    function compressImage(file, maxSize = 500, quality = 0.75) {
        return new Promise((resolve, reject) => {
            // window.* agar tidak kena no-undef (lint config paket tanpa browser env)
            const reader = new window.FileReader();
            reader.onload = (e) => {
                const img = new window.Image();
                img.onload = () => {
                    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const w = Math.max(1, Math.round(img.width * ratio));
                    const h = Math.max(1, Math.round(img.height * ratio));
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) { reject(new Error("Canvas tidak didukung browser ini")); return; }
                    // Latar putih dulu — JPEG tidak punya alpha (hindari hitam utk PNG transparan)
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                };
                img.onerror = () => reject(new Error("File bukan gambar yang valid"));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error("Gagal membaca file"));
            reader.readAsDataURL(file);
        });
    }

    function removeModal() {
        stopScanner();
        const overlay = document.querySelector(".smart-modal-overlay");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        state.formMode = null; state.editingId = null;
    }
    // Framework First: esc dari @smart/core (util global, bukan duplikat lokal)
    function debounce(fn, ms) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; }

    function getStyles() { return `
.barang-page { padding: 0; }
.barang-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.barang-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.barang-page .page-header .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.barang-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.barang-page .search-wrapper { position:relative; display:flex; align-items:center; }
.barang-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
.barang-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.barang-page .search-wrapper input:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.barang-page .table-container { background:rgba(255,255,255,0.58); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); border:2px solid rgb(255,255,255); border-radius:28px; box-shadow:0 8px 16px rgba(0,0,0,0.08); overflow:hidden; padding:14px; }
.barang-page .table-container .smart-table-wrapper { background:transparent !important; }
.barang-page .table-container .smart-table-wrapper .smart-table,
.barang-page .table-container .smart-table-wrapper .smart-table thead,
.barang-page .table-container .smart-table-wrapper .smart-table tbody,
.barang-page .table-container .smart-table-wrapper .smart-table tr,
.barang-page .table-container .smart-table-wrapper .smart-table th,
.barang-page .table-container .smart-table-wrapper .smart-table td { background:transparent !important; }
.barang-page .table-container .smart-table-wrapper .smart-table th,
.barang-page .table-container .smart-table-wrapper .smart-table td { border-color:rgba(148,163,184,0.28); }
.barang-page .pagination-container { display:flex; justify-content:center; padding:0.75rem 0 0.25rem; }
.barang-page .action-buttons { display:flex; gap:0.5rem; justify-content:center; }
.barang-page .action-btn { padding:0.35rem 0.7rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; }
.barang-page .action-btn-edit { background:rgba(255,255,255,0.58); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); color:#4f46e5; border:1px solid rgba(255,255,255,0.92); border-radius:10px; }
.barang-page .action-btn-edit:hover { background:rgba(255,255,255,0.78); }
.barang-page .action-btn-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.barang-page .action-btn-delete:hover { background:#fee2e2; }
.barang-page .stok-low { color:#dc2626; font-weight:600; }
.barang-page .stok-ok { color:#16a34a; }
.barang-page .badge-jasa { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:#dcfce7; color:#166534; font-size:0.7rem; font-weight:600; vertical-align:middle; }
.barang-page .badge-recipe { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:#fef3c7; color:#92400e; font-size:0.7rem; font-weight:600; vertical-align:middle; }
.barang-page .badge-recipe-fnb { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:#cffafe; color:#0e7490; font-size:0.7rem; font-weight:600; vertical-align:middle; }
.barang-page .badge-varian { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:#ede9fe; color:#6d28d9; font-size:0.7rem; font-weight:600; vertical-align:middle; }
.barang-page .badge-dijual { display:inline-block; padding:1px 8px; border-radius:999px; background:#dcfce7; color:#166534; font-size:0.7rem; font-weight:600; }
.barang-page .badge-tidak-dijual { display:inline-block; padding:1px 8px; border-radius:999px; background:#f1f5f9; color:#64748b; font-size:0.7rem; font-weight:600; }
.barang-page .brg-hk { font-size:0.68rem; color:#b45309; font-weight:500; }
.barang-page .brg-thumb { width:42px; height:42px; object-fit:cover; border-radius:6px; border:1px solid #e5e7eb; background:#f8fafc; }
.barang-page .brg-thumb-lg { width:96px; height:96px; }
.barang-page .brg-thumb-empty { color:#d1d5db; }
.barang-page .foto-upload { display:flex; gap:14px; align-items:flex-start; }
.barang-page .foto-preview { width:100px; height:100px; border:1px dashed #cbd5e1; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#f8fafc; flex-shrink:0; }
.barang-page .foto-preview img { width:100%; height:100%; object-fit:cover; display:block; }
.barang-page .foto-placeholder { font-size:1.8rem; opacity:0.45; }
.barang-page .foto-actions { display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.barang-page .foto-btn { padding:0.45rem 0.9rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; background:#fff; color:var(--smart-text-primary,#1a1a2e); cursor:pointer; font-size:0.82rem; font-weight:500; transition:all 0.15s; }
.barang-page .foto-btn:hover { background:#f1f5f9; border-color:#94a3b8; }
.barang-page .foto-btn-danger { color:#dc2626; border-color:#fecaca; background:#fef2f2; }
.barang-page .foto-btn-danger:hover { background:#fee2e2; }
.barang-page .foto-hint { font-size:0.72rem; color:#94a3b8; line-height:1.4; }
.barang-page #f-trading-fields { grid-column: 1 / -1; }
.barang-page .skeleton-wrapper { padding:1rem; }
.barang-page .delete-confirm { text-align:center; padding:1rem 0; }
.barang-page .delete-confirm p { font-size:1rem; margin-bottom:1.5rem; color:var(--smart-text-secondary,#6b7280); }
.barang-page .delete-confirm .item-name { font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.barang-page .page-info { text-align:center; font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); padding:0.5rem 0 1rem; }
.barang-page .required { color:#dc2626; }
.barang-page .kode-error-container { margin-top:0.5rem; }
.barang-page .kode-error-container .smart-alert { margin:0; padding:0.5rem 0.75rem; font-size:0.8rem; }
.barang-page #f-kode.is-duplicate { border-color:#dc2626 !important; background:#fef2f2 !important; box-shadow:0 0 0 3px rgba(220,38,38,0.1) !important; }
.barang-page #f-nama:disabled { background:#f3f4f6 !important; color:#9ca3af !important; cursor:not-allowed !important; border-color:#e5e7eb !important; opacity:0.7; }
.detail-grid { display:flex; flex-direction:column; gap:0.1rem; }
.detail-row { display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid #f3f4f6; }
.detail-row:last-child { border-bottom:none; }
.detail-row-full { flex-direction:column; align-items:flex-start; gap:0.35rem; }
.detail-label { font-size:0.8rem; color:var(--smart-text-secondary,#6b7280); font-weight:500; flex-shrink:0; }
.detail-value { font-size:0.9rem; color:var(--smart-text-primary,#1a1a2e); font-weight:500; text-align:right; word-break:break-word; }
/* ── Barang card CSS (hard-coded, sama persis seperti dashboard stat-card) ── */
.barang-page .sm-card-list { display:flex; flex-direction:column; gap:0.75rem; padding:0.5rem 0; }
.barang-page .sm-card { background:var(--smart-card-bg,#fff); border-radius:10px; padding:0.85rem 0.75rem; box-shadow:2px 4px 12px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05); transition:transform 0.15s, box-shadow 0.15s; }
.barang-page .sm-card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.08); }
.barang-page .sm-card-header-row { display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.4rem; }
.barang-page .sm-card-name { font-size:0.99rem; font-weight:700; color:var(--smart-primary,#4f46e5); line-height:1.3; flex:1; min-width:0; }
.barang-page .sm-card-details { display:flex; flex-direction:column; gap:0.25rem; margin-bottom:0.5rem; }
.barang-page .sm-card-detail-row { display:flex; justify-content:space-between; align-items:center; }
.barang-page .sm-card-label { font-size:0.78rem; color:var(--smart-text-secondary,#6b7280); font-weight:400; }
.barang-page .sm-card-value { font-size:0.9rem; font-weight:500; color:var(--smart-text-primary,#1a1a2e); }
.barang-page .sm-card-footer-row { display:flex; justify-content:space-between; align-items:center; padding-top:0.25rem; }
.barang-page .sm-card-footer-left { display:flex; gap:0.5rem; align-items:center; flex-wrap:nowrap; }
.barang-page .sm-card-footer-right { display:flex; gap:0.5rem; align-items:center; }
.barang-page .sm-card-code { font-size:0.95rem; font-weight:700; color:var(--smart-primary,#4f46e5); }
.barang-page .sm-card-actions { display:flex; gap:0.5rem; align-items:center; }
.barang-page .sm-card-btn { padding:0.35rem 0.7rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; transition:all 0.15s; }
.barang-page .badge-jasa { border-radius:4px; white-space:nowrap; }
.barang-page .badge-recipe { border-radius:4px; white-space:nowrap; }
.barang-page .badge-recipe-fnb { border-radius:4px; white-space:nowrap; }
.barang-page .badge-dijual { border-radius:4px; white-space:nowrap; }
.barang-page .badge-tidak-dijual { border-radius:4px; white-space:nowrap; }
.barang-page .sm-card-btn-edit { background:#eef2ff; color:#4f46e5; border-color:#c7d2fe; }
.barang-page .sm-card-btn-edit:hover { background:#e0e7ff; }
.barang-page .sm-card-btn-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.barang-page .sm-card-btn-delete:hover { background:#fee2e2; }
/* ── 2-column card layout (image left, data right) ── */
.barang-page .sm-card-row2 { display:flex; gap:0.75rem; align-items:center; }
.barang-page .sm-card-col-img { flex:0 0 20%; max-width:20%; display:flex; flex-direction:column; align-items:center; gap:0.35rem; }
.barang-page .sm-card-product-img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; border:1px solid #e5e7eb; background:#f8fafc; }
.barang-page .sm-card-img-placeholder { display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:1; font-size:1.8rem; background:#f1f5f9; border-radius:8px; border:1px solid #e5e7eb; }
.barang-page .sm-card-col-data { flex:1; min-width:0; }
.barang-page .sm-card-name-row { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.25rem; }
.barang-page .sm-card-name-row .sm-card-name { margin:0; flex:1; min-width:0; }
.barang-page .sm-card-name-row .sm-card-code { flex-shrink:0; }
.barang-page .sm-card-varian-below { text-align:center; font-size:0.7rem; }
@media (max-width:768px) {
.barang-page .table-container { background:transparent; border:none; box-shadow:none; padding:0; border-radius:0; }
.barang-page .table-container .sm-card { box-shadow:none; border:1px solid rgba(0,0,0,0.25); }
.barang-page .page-header { padding-top:20px; }
.barang-page .form-grid { grid-template-columns:1fr; }
.barang-page .page-header { flex-direction:column; align-items:stretch; }
.barang-page .search-wrapper { flex:1; min-width:0; }
.barang-page .search-wrapper input { width:100%; box-sizing:border-box; }
.barang-page .page-actions { flex-direction:row; }
.barang-page .page-actions .smart-btn { white-space:nowrap; flex-shrink:0; font-size:0.82rem; padding:0.45rem 0.7rem; }
}
`; }

    return { BarangPage, initBarangPage };
}
