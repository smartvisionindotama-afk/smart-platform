/**
 * Pembelian Module — Purchase Order Management.
 *
 * Framework module menangani:
 * - List PO (table desktop + card mobile)
 * - Create/Edit PO dengan multi-item barang + supplier
 * - Status lifecycle (draft → confirmed → received. Any → cancelled)
 * - Kalkulasi total, diskon, grand total otomatis
 * - Search & pagination
 *
 * DI yang dibutuhkan:
 *   listPembelian, getPembelian, createPembelian, updatePembelian,
 *   deletePembelian, updatePembelianStatus,
 *   listSupplier, getSupplier,
 *   listBarang, getBarang,
 *   formatRupiah,
 *   getCompanyInfo — async function() => { name, address, phone, email, logo }
 *
 * @module @smart/ui/modules/pembelian
 */

import { Modal, Table, Pagination, EmptyState, Alert, showToast, UI } from "../../index.js";
import QRCode from "qrcode";

// ═══════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════

let state = {
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    search: "",
    loading: false,
    editingId: null
};

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(iso) {
    if (!iso) return "-";
    try {
        return new Date(iso).toLocaleDateString("id-ID", {
            year: "numeric", month: "short", day: "numeric"
        });
    } catch { return "-"; }
}

function statusBadgeHTML(status) {
    const map = {
        "draft":     { label: "Draft",     cls: "pd-status-draft" },
        "confirmed": { label: "Dikonfirmasi", cls: "pd-status-confirmed" },
        "received":  { label: "Diterima",  cls: "pd-status-received" },
        "cancelled": { label: "Dibatalkan", cls: "pd-status-cancelled" }
    };
    const s = map[status] || { label: status, cls: "" };
    return `<span class="pd-status-badge ${s.cls}">${s.label}</span>`;
}

function canEdit(status) { return status === "draft"; }
function canDelete(status) { return status === "draft"; }
function canConfirm(status) { return status === "draft"; }
function canReceive(status) { return status === "confirmed"; }
function canCancel(status) { return status === "draft" || status === "confirmed" || status === "received"; }

const pageId = "pembelian-page";

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ═══════════════════════════════════════════════
//  Config (set by module factory)
// ═══════════════════════════════════════════════

let services = {};

// ═══════════════════════════════════════════════
//  Page HTML
// ═══════════════════════════════════════════════

function PembelianPage() {
    return `
        <div id="${pageId}" class="pembelian-page">
            <style>${getStyles()}</style>
            <div class="page-header">
                <div>
                    <h1>🛒 Pembelian</h1>
                    <div class="header-subtitle">Kelola Purchase Order pembelian barang dari supplier</div>
                </div>
                <div class="page-actions">
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="pd-search-input" placeholder="Cari no. PO, supplier, status..." autocomplete="off" />
                    </div>
                </div>
            </div>
            <div id="pd-table-area">
                <table class="pd-table">
                    <thead>
                        <tr>
                            <th>No. PO</th>
                            <th>Tanggal</th>
                            <th>Supplier</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="pd-table-body"></tbody>
                </table>
            </div>
            <div id="pd-card-area" class="pd-card-view" style="display:none"></div>
            <div id="pd-pagination"></div>
            <div id="pd-empty-state"></div>
            <div id="pd-loading" class="pd-loading" style="display:none">Memuat...</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════

function initPembelianPage() {
    // Reset state for fresh initialization
    state.items = [];
    state.pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
    state.search = "";
    state.loading = false;
    state.editingId = null;

    const searchInput = document.getElementById("pd-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", debounce((e) => {
            state.search = e.target.value.trim();
            state.pagination.page = 1;
            loadData();
        }, 300));
    }

    const pageActions = document.querySelector(`.${pageId} .page-actions`);
    if (pageActions) {
        const addBtn = document.createElement("button");
        addBtn.className = "smart-btn smart-btn-primary";
        addBtn.innerHTML = "➕ Buat PO Baru";
        addBtn.addEventListener("click", () => openForm("create"));
        pageActions.appendChild(addBtn);
    }

    loadData();

    window.addEventListener("resize", toggleView);
    toggleView();
}

// ═══════════════════════════════════════════════
//  Data Loading
// ═══════════════════════════════════════════════

async function loadData() {
    const loadingEl = document.getElementById("pd-loading");
    const emptyEl = document.getElementById("pd-empty-state");
    const tableArea = document.getElementById("pd-table-area");
    const cardArea = document.getElementById("pd-card-area");
    const paginationEl = document.getElementById("pd-pagination");

    if (!tableArea) return;
    state.loading = true;
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.innerHTML = "";

    try {
        const result = await services.listPembelian({
            page: state.pagination.page,
            limit: state.pagination.limit,
            search: state.search
        });
        state.items = result.data || [];
        state.pagination = result.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

        if (loadingEl) loadingEl.style.display = "none";

        if (state.items.length === 0) {
            if (tableArea) tableArea.style.display = "none";
            if (cardArea) cardArea.style.display = "none";
            if (emptyEl) {
                emptyEl.appendChild(EmptyState({
                    icon: "🛒",
                    title: state.search ? "Pencarian tidak ditemukan" : "Belum ada Pembelian",
                    description: state.search ? "Coba kata kunci lain" : "Buat Purchase Order pertama untuk mulai mencatat pembelian",
                    actionText: state.search ? "Reset Pencarian" : "Buat PO Baru",
                    onAction: state.search ? () => { state.search = ""; const inp = document.getElementById("pd-search-input"); if (inp) inp.value = ""; loadData(); } : () => openForm("create")
                }));
            }
            if (paginationEl) paginationEl.innerHTML = "";
            return;
        }

        renderTable();
        renderCards();
        toggleView();
        renderPagination();
    } catch (err) {
        console.error("[Pembelian] loadData failed:", err);
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) {
            emptyEl.innerHTML = `<div class="pd-error">Gagal memuat data: ${esc(err.message)}</div>`;
        }
    }
}

// ═══════════════════════════════════════════════
//  Desktop Table
// ═══════════════════════════════════════════════

function renderTable() {
    const tbody = document.getElementById("pd-table-body");
    if (!tbody) return;
    tbody.innerHTML = state.items.map(item => {
        const itemsCount = (item.items || []).length;
        return `
            <tr>
                <td><strong>${esc(item.nomor)}</strong></td>
                <td>${formatDate(item.tanggal)}</td>
                <td>${esc(item.supplierName || item.supplier)}</td>
                <td class="pd-text-right">${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</td>
                <td>${statusBadgeHTML(item.status)}</td>
                <td>
                    <div class="pd-mgmt-actions">
                        <button class="pd-action-btn pd-action-view" data-action="view" data-id="${item._id || item.id}" title="Lihat Detail">👁️ Detail</button>
                        <button class="pd-action-btn pd-action-invoice" data-action="invoice" data-id="${item._id || item.id}" title="Cetak Invoice">🖨️ Invoice</button>
                        ${canEdit(item.status) ? `<button class="pd-action-btn pd-action-edit" data-action="edit" data-id="${item._id || item.id}" title="Edit PO">✏️</button>` : ""}
                        ${canConfirm(item.status) ? `<button class="pd-action-btn pd-action-confirm" data-action="confirm" data-id="${item._id || item.id}" title="Konfirmasi PO">✅ Konfirmasi</button>` : ""}
                        ${canReceive(item.status) ? `<button class="pd-action-btn pd-action-receive" data-action="receive" data-id="${item._id || item.id}" title="Terima Barang">📦 Terima</button>` : ""}
                        ${canCancel(item.status) ? `<button class="pd-action-btn pd-action-cancel" data-action="cancel" data-id="${item._id || item.id}" title="Batalkan PO">❌ Batal</button>` : ""}
                        ${canDelete(item.status) ? `<button class="pd-action-btn pd-action-delete" data-action="delete" data-id="${item._id || item.id}" title="Hapus PO">🗑️</button>` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    // Event listeners
    tbody.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === "view") viewDetail(id);
            else if (action === "invoice") printInvoice(id);
            else if (action === "edit") openForm("edit", id);
            else if (action === "delete") confirmDelete(id);
            else if (action === "confirm") updateStatus(id, "confirmed");
            else if (action === "receive") updateStatus(id, "received");
            else if (action === "cancel") confirmCancel(id);
        });
    });
}

// ═══════════════════════════════════════════════
//  Mobile Card View
// ═══════════════════════════════════════════════

function renderCards() {
    const cardArea = document.getElementById("pd-card-area");
    if (!cardArea) return;
    cardArea.innerHTML = "";
    const list = UI.CardList(state.items, (item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${esc(item.nomor)}</div>
            <div class="sm-card-desc">${formatDate(item.tanggal)}</div>
        </div>
        <div class="sm-card-details">
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Supplier</span>
                <span class="sm-card-value">${esc(item.supplierName || item.supplier)}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Total</span>
                <span class="sm-card-value">${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Item</span>
                <span class="sm-card-value">${(item.items || []).length} barang</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Status</span>
                <span class="sm-card-value">${statusBadgeHTML(item.status)}</span>
            </div>
        </div>
        <div class="sm-card-footer-row">
            <div class="sm-card-actions">
                ${canEdit(item.status) ? `<button class="sm-card-btn sm-card-btn-edit" data-po-edit="${item._id || item.id}">✏️ Edit</button>` : ""}
                ${canConfirm(item.status) ? `<button class="sm-card-btn sm-card-btn-primary" data-po-confirm="${item._id || item.id}">✅ Konfirmasi</button>` : ""}
                ${canReceive(item.status) ? `<button class="sm-card-btn sm-card-btn-primary" data-po-receive="${item._id || item.id}">📦 Terima</button>` : ""}
                ${canDelete(item.status) ? `<button class="sm-card-btn sm-card-btn-delete" data-po-delete="${item._id || item.id}">🗑️</button>` : ""}
                <button class="sm-card-btn sm-card-btn-view" data-po-view="${item._id || item.id}">👁️ Detail</button>
                <button class="sm-card-btn sm-card-btn-invoice" data-po-invoice="${item._id || item.id}">🖨️ Invoice</button>
            </div>
        </div>
    `);
    cardArea.appendChild(list);

    cardArea.querySelectorAll("[data-po-edit]").forEach(btn => {
        btn.addEventListener("click", () => openForm("edit", btn.dataset.poEdit));
    });
    cardArea.querySelectorAll("[data-po-delete]").forEach(btn => {
        btn.addEventListener("click", () => confirmDelete(btn.dataset.poDelete));
    });
    cardArea.querySelectorAll("[data-po-view]").forEach(btn => {
        btn.addEventListener("click", () => viewDetail(btn.dataset.poView));
    });
    cardArea.querySelectorAll("[data-po-invoice]").forEach(btn => {
        btn.addEventListener("click", () => printInvoice(btn.dataset.poInvoice));
    });
    cardArea.querySelectorAll("[data-po-confirm]").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.poConfirm, "confirmed"));
    });
    cardArea.querySelectorAll("[data-po-receive]").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.poReceive, "received"));
    });
}

// ═══════════════════════════════════════════════
//  Responsive Toggle
// ═══════════════════════════════════════════════

function toggleView() {
    const tableArea = document.getElementById("pd-table-area");
    const cardArea = document.getElementById("pd-card-area");
    if (!tableArea || !cardArea) return;
    const isMobile = window.innerWidth < 768;
    tableArea.style.display = isMobile ? "none" : "";
    cardArea.style.display = isMobile ? "block" : "none";
}

// ═══════════════════════════════════════════════
//  Pagination
// ═══════════════════════════════════════════════

function renderPagination() {
    const el = document.getElementById("pd-pagination");
    if (!el) return;
    if (state.pagination.totalPages <= 1) { el.innerHTML = ""; return; }
    el.innerHTML = "";
    el.appendChild(Pagination({
        currentPage: state.pagination.page,
        totalPages: state.pagination.totalPages,
        total: state.pagination.total,
        onChange: (page) => {
            state.pagination.page = page;
            loadData();
        }
    }));
}

// ═══════════════════════════════════════════════
//  Form Modal (Create / Edit)
// ═══════════════════════════════════════════════

async function openForm(mode, id) {
    const isEdit = mode === "edit" && id;
    let formData = {
        tanggal: new Date().toISOString().split("T")[0],
        supplier: "",
        supplierName: "",
        items: [],
        diskon: 0,
        catatan: "",
        nomor: ""
    };

    if (isEdit) {
        try {
            const item = await services.getPembelian(id);
            if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
            formData = {
                tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split("T")[0] : "",
                supplier: item.supplier || "",
                supplierName: item.supplierName || "",
                items: (item.items || []).map(i => ({ ...i })),
                diskon: item.diskon || 0,
                catatan: item.catatan || "",
                nomor: item.nomor || ""
            };
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
            return;
        }
    }

    const title = isEdit ? `✏️ Edit PO: ${formData.nomor}` : "🛒 Buat Purchase Order Baru";
    const contentHTML = buildFormHTML(formData, isEdit);
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Buat PO"}</button>
    `;

    const overlay = Modal({
        open: true,
        title,
        content: contentHTML,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);
    overlay.querySelector(".smart-modal-dialog")?.classList.add("modal-lg");

    // Fetch suppliers & barang for dropdowns
    let suppliers = [];
    let barangs = [];
    try {
        const supRes = await services.listSupplier({ page: 1, limit: 999 });
        suppliers = supRes.data || [];
        populateSupplierDropdown(suppliers, formData.supplier);

        const brgRes = await services.listBarang({ page: 1, limit: 999 });
        barangs = brgRes.data || [];
        renderItemRows(barangs, formData.items);

        // Init events immediately (DOM is updated)
        // Populate datalist for barang — kode field searches by kode, nama field by nama
        const kodeList = document.getElementById(`po-barang-list-${pageId}`);
        const namaList = document.getElementById(`po-nama-list-${pageId}`);
        if (kodeList) {
            kodeList.innerHTML = barangs.map(b =>
                `<option value="${esc(b.kode)}" data-kode="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-harga="${b.harga_beli || 0}">${esc(b.nama)}</option>`
            ).join("");
        }
        if (namaList) {
            namaList.innerHTML = barangs.map(b =>
                `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-harga="${b.harga_beli || 0}">${esc(b.kode)}</option>`
            ).join("");
        }

        // Diskon input → recalc on input
        document.getElementById("f-diskon")?.addEventListener("input", calcTotals);

        initItemRowEvents(barangs);
        attachAddItemBtn(barangs);
        calcTotals();
    } catch (err) {
        console.warn("[Pembelian] Failed to load dropdown data:", err);
        populateSupplierDropdown([], formData.supplier);
        renderItemRows([], formData.items);
    }

    document.getElementById("f-cancel")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-submit")?.addEventListener("click", () => handleSubmit(overlay, formData, isEdit ? id : null));
}

function buildFormHTML(data, isEdit) {
    const itemRows = (data.items || []).map((item, idx) => buildItemRow(item, idx)).join("");
    return `
        <div class="po-form">
            <div class="po-form-row">
                <div class="form-group">
                    <label for="f-tanggal">Tanggal</label>
                    <input type="date" id="f-tanggal" value="${esc(data.tanggal)}" />
                </div>
                <div class="form-group">
                    <label for="f-supplier">Supplier <span class="required">*</span></label>
                    <select id="f-supplier">
                        <option value="">— Pilih Supplier —</option>
                    </select>
                </div>
                ${isEdit ? `<div class="form-group"><label>No. PO</label><input type="text" value="${esc(data.nomor)}" disabled /></div>` : ""}
            </div>

            <div class="po-section-title">📦 Item Barang</div>
            <div class="po-items-header">
                <span class="po-col-code">Kode</span>
                <span class="po-col-name">Nama Barang</span>
                <span class="po-col-qty">Qty</span>
                <span class="po-col-price">Harga</span>
                <span class="po-col-subtotal">Subtotal</span>
                <span class="po-col-action"></span>
            </div>
            <div id="po-items-body">${itemRows}</div>
            <datalist id="po-barang-list-${pageId}"></datalist>
            <datalist id="po-nama-list-${pageId}"></datalist>
            <div class="po-add-item">
                <button type="button" id="po-add-item-btn" class="po-add-item-btn">➕ Tambah Item</button>
            </div>

            <div class="po-totals">
                <div class="po-total-row">
                    <span>Total</span>
                    <span id="po-total-display">0</span>
                </div>
                <div class="po-total-row">
                    <span>Diskon</span>
                    <input type="number" id="f-diskon" value="${esc(data.diskon || 0)}" min="0" class="po-diskon-input" />
                </div>
                <div class="po-total-row po-grand-total">
                    <span>Grand Total</span>
                    <span id="po-grand-total-display">Rp 0</span>
                </div>
            </div>

            <div class="form-group">
                <label for="f-catatan">Catatan</label>
                <textarea id="f-catatan" rows="3" placeholder="Catatan pembelian...">${esc(data.catatan)}</textarea>
            </div>
        </div>
    `;
}

function buildItemRow(item, idx) {
    return `
        <div class="po-item-row" data-index="${idx}">
            <span class="po-col-code">
                <input type="text" class="po-item-kode" value="${esc(item.kode)}" placeholder="Kode" list="po-barang-list-${pageId}" data-index="${idx}" />
            </span>
            <span class="po-col-name">
                <input type="text" class="po-item-nama" value="${esc(item.nama)}" placeholder="Nama barang" list="po-nama-list-${pageId}" data-index="${idx}" />
            </span>
            <span class="po-col-qty">
                <input type="number" class="po-item-qty" value="${item.qty || 0}" min="0" step="1" data-index="${idx}" />
            </span>
            <span class="po-col-price">
                <input type="number" class="po-item-harga" value="${item.harga || 0}" min="0" step="500" data-index="${idx}" />
            </span>
            <span class="po-col-subtotal">
                <span class="po-item-subtotal" data-index="${idx}">${services.formatRupiah ? services.formatRupiah(item.subtotal || 0) : (item.subtotal || 0).toLocaleString()}</span>
            </span>
            <span class="po-col-action">
                <button type="button" class="po-item-remove" data-index="${idx}" title="Hapus item">✕</button>
            </span>
        </div>
    `;
}

function populateSupplierDropdown(suppliers, selected) {
    const sel = document.getElementById("f-supplier");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih Supplier —</option>`;
    for (const s of suppliers) {
        const code = s.kode || s._id || "";
        const name = s.nama || code;
        sel.innerHTML += `<option value="${esc(code)}" data-name="${esc(name)}" ${code === selected ? "selected" : ""}>${esc(name)} (${esc(code)})</option>`;
    }
    if (selected && !suppliers.find(s => (s.kode || s._id || "") === selected)) {
        sel.innerHTML += `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
    }
}

function renderItemRows(barangs, items) {
    const body = document.getElementById("po-items-body");
    if (!body) return;
    body.innerHTML = items.length > 0
        ? items.map((item, idx) => buildItemRow(item, idx)).join("")
        : '<div class="po-empty-items">Belum ada item. Klik "Tambah Item" untuk menambahkan barang.</div>';
}

function initItemRowEvents(barangs) {
    // Qty & Harga changes → recalc subtotal
    document.querySelectorAll(".po-item-qty, .po-item-harga").forEach(inp => {
        inp.addEventListener("input", recalcRow);
        inp.addEventListener("change", recalcRow);
    });

    // Remove button
    document.querySelectorAll(".po-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const row = btn.closest(".po-item-row");
            if (row) {
                row.remove();
                reindexRows();
                calcTotals();
            }
        });
    });

    // Kode & Nama input → auto-fill on blur (reliable after selecting from datalist)
    document.querySelectorAll(".po-item-kode, .po-item-nama").forEach(inp => {
        inp.addEventListener("blur", () => findAndFillBarang(inp, barangs));
    });

}

/**
 * Find barang by kode or nama from datalist and fill the row fields.
 */
function findAndFillBarang(inputEl, barangs) {
    const val = inputEl.value.trim();
    if (!val) return;
    // Search by kode or nama (datalist values are pure kode/nama)
    const barang = barangs.find(b => b.kode === val || b.nama === val);
    if (!barang) return;
    const idx = inputEl.dataset.index;
    const kodeInput = document.querySelector(`.po-item-kode[data-index="${idx}"]`);
    const namaInput = document.querySelector(`.po-item-nama[data-index="${idx}"]`);
    const hargaInput = document.querySelector(`.po-item-harga[data-index="${idx}"]`);
    if (kodeInput) kodeInput.value = barang.kode || "";
    if (namaInput) namaInput.value = barang.nama || "";
    if (hargaInput) { hargaInput.value = barang.harga_beli || 0; recalcRow({ target: hargaInput }); }
}

// ═══════════════════════════════════════════════
//  Print Invoice
// ═══════════════════════════════════════════════

/**
 * Get current user's display name from SMART.Session.
 */
function getCurrentUserName() {
    // Priority 1: SMART.Session (may be null — session not populated with user data during login)
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Session) {
        const name = globalThis.SMART.Session.get("user.name");
        if (name) return name;
        const state = globalThis.SMART.Session.getState?.();
        if (state?.user?.name) return state.user.name;
        if (state?.user?.email) return state.user.email;
    }
    // Priority 2: Auth from @smart/core (set during login via window.__app)
    if (typeof globalThis !== "undefined" && globalThis.__app?.Auth?.user) {
        const u = globalThis.__app.Auth.user();
        if (u?.name) return u.name;
    }
    return null;
}

async function getCompanyInfo() {
    // Priority 1: DI-provided getCompanyInfo (has full address, phone, email)
    if (typeof services.getCompanyInfo === "function") {
        try {
            const result = await services.getCompanyInfo();
            if (result && (result.name || result.companyName)) return result;
        } catch (e) {
            console.warn("[Pembelian] getCompanyInfo DI failed:", e);
        }
    }
    // Priority 2: SMART.Session (framework global)
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Session?.company) {
        const c = globalThis.SMART.Session.company();
        if (c) return c;
    }
    // Priority 3: SMART.Company
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Company?.get) {
        const c = globalThis.SMART.Company.get();
        if (c) return c;
    }
    // Priority 4: branding
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Company?.branding) {
        const b = globalThis.SMART.Company.branding();
        if (b && b.companyName) return { name: b.companyName, logo: b.logo };
    }
    return {};
}

async function printInvoice(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    if (!item) {
        try {
            const fetched = await services.getPembelian(id);
            if (!fetched) { showToast("danger", "Data tidak ditemukan"); return; }
            await printInvoiceHTML(fetched);
        } catch { showToast("danger", "Gagal memuat data"); }
        return;
    }
    await printInvoiceHTML(item);
}

async function printInvoiceHTML(item) {
    const company = await getCompanyInfo();
    const logoUrl = company.logo || "";
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";

    // Skip placeholder 'System' from seed data — use real user name instead
    const isPlaceholder = !item.createdBy || item.createdBy === "System" || item.createdBy === "system";
    const userName = isPlaceholder
        ? (getCurrentUserName() || item.createdBy || "System")
        : item.createdBy;
    const itemsHTML = (item.items || []).map((i, idx) => `
        <tr>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.kode)}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${i.qty}</td>
            <td style="text-align:right;padding:6px 8px;border:1px solid #e2e8f0;">${services.formatRupiah ? services.formatRupiah(i.harga) : i.harga.toLocaleString()}</td>
            <td style="text-align:right;padding:6px 8px;border:1px solid #e2e8f0;">${services.formatRupiah ? services.formatRupiah(i.subtotal) : i.subtotal.toLocaleString()}</td>
        </tr>
    `).join("");

    const statusLabels = { draft: "Draft", confirmed: "Dikonfirmasi", received: "Diterima", cancelled: "Dibatalkan" };

    // Generate QR code as data URL (local, no external API dependency)
    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.nomor, { width: 180, margin: 1, color: { dark: "#1e293b", light: "#ffffff" } });
    } catch (e) {
        console.warn("[Pembelian] QR generation failed:", e);
    }

    const invoiceHTML = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - ${esc(item.nomor)}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; padding:40px; background:#f1f5f9; }
        .invoice-wrap { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
        .invoice-header { padding:32px 40px 12px 40px; border-bottom:3px solid #4f46e5; display:flex; justify-content:space-between; align-items:flex-start; }
        .invoice-header-left { display:flex; align-items:flex-start; gap:16px; }
        .invoice-logo { height:60px; width:auto; max-width:100px; object-fit:contain; }
        .invoice-logo-placeholder { width:48px; height:60px; background:#eef2ff; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:700; color:#4f46e5; }
        .invoice-company-name { font-size:1.2rem; font-weight:700; color:#1e293b; }
        .invoice-company-detail { font-size:0.8rem; color:#64748b; line-height:1.5; padding-bottom:2px; }
        .invoice-title-block { text-align:right; }
        .invoice-title { font-size:1.6rem; font-weight:800; color:#4f46e5; letter-spacing:1px; }
        .invoice-po-num { font-size:0.9rem; color:#64748b; margin-top:2px; }
        .invoice-body { padding:28px 40px; }
        .invoice-info-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; margin-bottom:24px; background:#f8fafc; border-radius:8px; padding:12px 16px; }
        .invoice-info-item { }
        .invoice-info-label { font-size:0.7rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
        .invoice-info-value { font-size:0.9rem; font-weight:500; color:#1e293b; }
        .invoice-table { width:100%; border-collapse:collapse; margin-bottom:20px; }
        .invoice-table th { background:#f1f5f9; padding:8px 10px; border:1px solid #e2e8f0; font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.3px; }
        .invoice-table td { font-size:0.85rem; }
        .invoice-table tr:last-child td { border-bottom:2px solid #e2e8f0; }
        .invoice-totals { margin-left:auto; width:300px; }
        .invoice-total-row { display:flex; justify-content:space-between; padding:5px 0; font-size:0.85rem; color:#475569; }
        .invoice-total-row.total { border-top:2px solid #4f46e5; padding-top:8px; margin-top:4px; font-weight:700; font-size:1rem; color:#1e293b; }
        .invoice-notes { margin-top:20px; padding:12px 16px; background:#f8fafc; border-radius:8px; font-size:0.82rem; color:#64748b; border-left:3px solid #4f46e5; }
        .invoice-bottom { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-top:24px; }
        .invoice-qr { flex-shrink:0; text-align:center; }
        .invoice-qr img { width:90px; height:90px; display:block; border:1px solid #e2e8f0; border-radius:6px; padding:4px; background:#fff; }
        .invoice-qr-label { font-size:0.65rem; color:#94a3b8; margin-top:4px; letter-spacing:0.3px; white-space:nowrap; }
        .invoice-bottom-center { flex:1; min-width:0; }
        
        @media print {
            body { background:#fff; padding:0; }
            .invoice-wrap { box-shadow:none; border-radius:0; }
            .invoice-header { break-inside:avoid; }
        }
        @page { margin:0; }
        @media (max-width:600px) {
            body { padding:16px; }
            .invoice-header { flex-direction:column; text-align:center; gap:12px; padding:20px 20px 12px 20px; }
            .invoice-title-block { text-align:center; }
            .invoice-header-left { flex-direction:column; align-items:center; }
            .invoice-logo { height:56px; }
            .invoice-logo-placeholder { width:44px; height:56px; }
            .invoice-info-grid { grid-template-columns:1fr 1fr; }
            .invoice-totals { width:100%; }
            .invoice-bottom { flex-direction:column; align-items:stretch; gap:16px; }
            .invoice-qr { text-align:center; align-self:center; }
            .invoice-qr img { width:80px; height:80px; }
            .invoice-totals { width:100%; }
            .invoice-body { padding:20px; }
        }
    </style>
</head>
<body>
    <div class="invoice-wrap">
        <div class="invoice-header">
            <div class="invoice-header-left">
                ${logoUrl
                    ? `<img src="${esc(logoUrl)}" class="invoice-logo" alt="Logo" />`
                    : `<div class="invoice-logo-placeholder">${(companyName || "P").charAt(0)}</div>`
                }
                <div>
                    <div class="invoice-company-name">${esc(companyName)}</div>
                    <div class="invoice-company-detail">${esc(companyAddress)}<br/>Telp: ${esc(companyPhone)} | Email: ${esc(companyEmail)}</div>
                </div>
            </div>
            <div class="invoice-title-block">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-po-num">${esc(item.nomor)}</div>
            </div>
        </div>
        <div class="invoice-body">
            <div class="invoice-info-grid">
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Supplier</div>
                    <div class="invoice-info-value">${esc(item.supplierName || item.supplier)}</div>
                </div>
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Tanggal</div>
                    <div class="invoice-info-value">${formatDate(item.tanggal)}</div>
                </div>
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Status</div>
                    <div class="invoice-info-value">${statusLabels[item.status] || item.status}</div>
                </div>
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Dibuat Oleh</div>
                    <div class="invoice-info-value">${esc(userName)}</div>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width:40px">No</th>
                        <th style="width:100px">Kode</th>
                        <th>Nama Barang</th>
                        <th style="width:50px">Qty</th>
                        <th style="width:110px">Harga</th>
                        <th style="width:120px">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>

            <div class="invoice-bottom">
                <div class="invoice-qr">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" width="90" height="90" />` : `<div style="width:90px;height:90px;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#94a3b8;background:#f8fafc">QR</div>`}
                    <div class="invoice-qr-label">Scan untuk verifikasi</div>
                </div>
                ${item.catatan ? `<div class="invoice-bottom-center"><div class="invoice-notes" style="margin-top:0"><strong>Catatan:</strong><br/>${esc(item.catatan)}</div></div>` : ""}
                <div class="invoice-totals">
                    <div class="invoice-total-row">
                        <span>Total</span>
                        <span>${services.formatRupiah ? services.formatRupiah(item.total || 0) : (item.total || 0).toLocaleString()}</span>
                    </div>
                    ${item.diskon > 0 ? `
                    <div class="invoice-total-row">
                        <span>Diskon</span>
                        <span>-${services.formatRupiah ? services.formatRupiah(item.diskon) : item.diskon.toLocaleString()}</span>
                    </div>` : ""}
                    <div class="invoice-total-row total">
                        <span>Grand Total</span>
                        <span>Rp ${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
        
    </div>
    <script>window.print();<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
        win.document.write(invoiceHTML);
        win.document.close();
    } else {
        showToast("warning", "Izinkan pop-up untuk mencetak invoice");
    }
}

function attachAddItemBtn(barangs) {
    document.getElementById("po-add-item-btn")?.addEventListener("click", function addItemHandler() {
        const body = document.getElementById("po-items-body");
        if (!body) return;
        const idx = document.querySelectorAll(".po-item-row").length;
        const emptyMsg = body.querySelector(".po-empty-items");
        if (emptyMsg) emptyMsg.remove();
        body.insertAdjacentHTML("beforeend", buildItemRow({ kode: "", nama: "", qty: 0, harga: 0, subtotal: 0 }, idx));
        initItemRowEvents(barangs);
        calcTotals();
    });
}



function recalcRow(e) {
    const row = e.target.closest(".po-item-row");
    if (!row) return;
    const idx = row.dataset.index;
    const qty = parseFloat(document.querySelector(`.po-item-qty[data-index="${idx}"]`)?.value) || 0;
    const harga = parseFloat(document.querySelector(`.po-item-harga[data-index="${idx}"]`)?.value) || 0;
    const subtotalEl = document.querySelector(`.po-item-subtotal[data-index="${idx}"]`);
    const subtotal = qty * harga;
    if (subtotalEl) {
        subtotalEl.textContent = services.formatRupiah ? services.formatRupiah(subtotal) : subtotal.toLocaleString();
    }
    calcTotals();
}

function calcTotals() {
    let total = 0;
    document.querySelectorAll(".po-item-row").forEach(row => {
        const idx = row.dataset.index;
        const qty = parseFloat(document.querySelector(`.po-item-qty[data-index="${idx}"]`)?.value) || 0;
        const harga = parseFloat(document.querySelector(`.po-item-harga[data-index="${idx}"]`)?.value) || 0;
        total += qty * harga;
    });
    const diskon = parseFloat(document.getElementById("f-diskon")?.value) || 0;
    const grandTotal = Math.max(0, total - diskon);

    const totalEl = document.getElementById("po-total-display");
    const grandEl = document.getElementById("po-grand-total-display");
    if (totalEl) totalEl.textContent = services.formatRupiah ? services.formatRupiah(total) : total.toLocaleString();
    if (grandEl) grandEl.textContent = "Rp " + (services.formatRupiah ? services.formatRupiah(grandTotal) : grandTotal.toLocaleString());
}

function reindexRows() {
    document.querySelectorAll(".po-item-row").forEach((row, idx) => {
        row.dataset.index = idx;
        row.querySelectorAll("[data-index]").forEach(el => el.dataset.index = idx);
    });
}

// ═══════════════════════════════════════════════
//  Form Submit
// ═══════════════════════════════════════════════

async function handleSubmit(overlay, existingData, editId) {
    const supplier = document.getElementById("f-supplier")?.value;
    const tanggal = document.getElementById("f-tanggal")?.value;
    const diskon = parseFloat(document.getElementById("f-diskon")?.value) || 0;
    const catatan = document.getElementById("f-catatan")?.value || "";

    // Validation
    if (!supplier) {
        document.getElementById("f-supplier")?.focus();
        showToast("danger", "Supplier wajib diisi");
        return;
    }

    const itemRows = document.querySelectorAll(".po-item-row");
    if (itemRows.length === 0) {
        showToast("danger", "Minimal 1 item barang harus ditambahkan");
        return;
    }

    const items = [];
    for (const row of itemRows) {
        const idx = row.dataset.index;
        const kode = document.querySelector(`.po-item-kode[data-index="${idx}"]`)?.value.trim() || "";
        const nama = document.querySelector(`.po-item-nama[data-index="${idx}"]`)?.value.trim() || "";
        const qty = parseFloat(document.querySelector(`.po-item-qty[data-index="${idx}"]`)?.value) || 0;
        const harga = parseFloat(document.querySelector(`.po-item-harga[data-index="${idx}"]`)?.value) || 0;

        if (!kode && !nama) continue; // skip empty rows
        if (qty <= 0) {
            showToast("danger", `Qty untuk "${nama || kode}" harus lebih dari 0`);
            return;
        }
        if (harga <= 0) {
            showToast("danger", `Harga untuk "${nama || kode}" harus diisi`);
            return;
        }

        // Get supplier name from selected option (data-name attribute)
        const supplierSel = document.getElementById("f-supplier");
        const supplierName = supplierSel?.selectedOptions?.[0]?.getAttribute("data-name") || supplier;

        items.push({ kode, nama, satuan: "", qty, harga, subtotal: qty * harga });
    }

    if (items.length === 0) {
        showToast("danger", "Minimal 1 item barang dengan qty > 0 harus ditambahkan");
        return;
    }

    const currentUser = getCurrentUserName() || "System";
    const payload = {
        tanggal: tanggal || new Date().toISOString(),
        supplier,
        supplierName: supplier,
        items,
        diskon,
        catatan,
        createdBy: currentUser
    };

    try {
        if (editId) {
            await services.updatePembelian(editId, payload);
            showToast("success", "PO berhasil diperbarui");
        } else {
            await services.createPembelian(payload);
            showToast("success", "PO berhasil dibuat");
        }
        removeModal(overlay);
        loadData();
    } catch (err) {
        showToast("danger", "Gagal menyimpan: " + err.message);
    }
}

// ═══════════════════════════════════════════════
//  Detail Modal
// ═══════════════════════════════════════════════

async function viewDetail(id) {
    try {
        const item = await services.getPembelian(id);
        if (!item) { showToast("danger", "Data tidak ditemukan"); return; }

        const itemsHTML = (item.items || []).map(i => `
            <tr>
                <td>${esc(i.kode)}</td>
                <td>${esc(i.nama)}</td>
                <td>${esc(i.qty)} ${esc(i.satuan)}</td>
                <td class="pd-text-right">${services.formatRupiah ? services.formatRupiah(i.harga) : i.harga.toLocaleString()}</td>
                <td class="pd-text-right">${services.formatRupiah ? services.formatRupiah(i.subtotal) : i.subtotal.toLocaleString()}</td>
            </tr>
        `).join("");

        const title = `📄 Detail PO: ${item.nomor}`;
        const contentHTML = `
            <div class="po-detail">
                <div class="po-detail-header">
                    <div class="po-detail-field"><strong>No. PO</strong><span>${esc(item.nomor)}</span></div>
                    <div class="po-detail-field"><strong>Tanggal</strong><span>${formatDate(item.tanggal)}</span></div>
                    <div class="po-detail-field"><strong>Supplier</strong><span>${esc(item.supplierName || item.supplier)}</span></div>
                    <div class="po-detail-field"><strong>Status</strong><span>${statusBadgeHTML(item.status)}</span></div>
                </div>
                <table class="pd-table po-detail-items">
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Nama Barang</th>
                            <th>Qty</th>
                            <th class="pd-text-right">Harga</th>
                            <th class="pd-text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <div class="po-detail-totals">
                    <div class="po-total-row"><span>Total</span><span>${services.formatRupiah ? services.formatRupiah(item.total) : item.total.toLocaleString()}</span></div>
                    ${item.diskon > 0 ? `<div class="po-total-row"><span>Diskon</span><span>-${services.formatRupiah ? services.formatRupiah(item.diskon) : item.diskon.toLocaleString()}</span></div>` : ""}
                    <div class="po-total-row po-grand-total"><span>Grand Total</span><span>Rp ${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</span></div>
                </div>
                ${item.catatan ? `<div class="po-detail-notes"><strong>Catatan:</strong><p>${esc(item.catatan)}</p></div>` : ""}
            </div>
        `;
        const footerHTML = `<button class="smart-btn smart-btn-secondary" id="f-close-detail">Tutup</button>`;

        const overlay = Modal({
            open: true,
            title,
            content: contentHTML,
            footer: footerHTML,
            closable: true,
            onClose: () => removeModal(overlay)
        });
        document.body.appendChild(overlay);

        document.getElementById("f-close-detail")?.addEventListener("click", () => removeModal(overlay));
    } catch (err) {
        showToast("danger", "Gagal memuat detail: " + err.message);
    }
}

// ═══════════════════════════════════════════════
//  Delete Confirmation
// ═══════════════════════════════════════════════

function confirmDelete(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-del">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-del" style="background:#dc2626">Ya, Hapus</button>
    `;

    const overlay = Modal({
        open: true,
        title: "🗑️ Hapus PO",
        content: `<p>Yakin ingin menghapus PO <strong>${esc(name)}</strong>? Tindakan ini tidak bisa dibatalkan.</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-del")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-del")?.addEventListener("click", async () => {
        try {
            await services.deletePembelian(id);
            showToast("success", `PO ${name} berhasil dihapus`);
            removeModal(overlay);
            loadData();
        } catch (err) {
            showToast("danger", "Gagal menghapus: " + err.message);
        }
    });
}

// ═══════════════════════════════════════════════
//  Status Update
// ═══════════════════════════════════════════════

async function updateStatus(id, newStatus) {
    const item = state.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;
    const statusLabels = { confirmed: "Dikonfirmasi", received: "Diterima", cancelled: "Dibatalkan" };
    const label = statusLabels[newStatus] || newStatus;

    // Confirmation for cancel
    if (newStatus === "cancelled") {
        confirmCancel(id);
        return;
    }

    // Confirmation for receive (stok akan bertambah)
    let confirmMsg = `Yakin ingin mengubah status PO <strong>${esc(name)}</strong> menjadi <strong>${label}</strong>?`;
    if (newStatus === "received") {
        confirmMsg += " Stok barang akan bertambah otomatis.";
    }

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-st">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-st">Ya, ${label}</button>
    `;

    const overlay = Modal({
        open: true,
        title: `🔄 Update Status`,
        content: `<p>${confirmMsg}</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-st")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-st")?.addEventListener("click", async () => {
        try {
            await services.updatePembelianStatus(id, newStatus);
            showToast("success", `PO ${name} → ${label}`);
            removeModal(overlay);
            loadData();
        } catch (err) {
            showToast("danger", "Gagal update status: " + err.message);
        }
    });
}

function confirmCancel(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;
    const isReceived = item?.status === "received";

    let msg = `Yakin ingin <strong>membatalkan</strong> PO <strong>${esc(name)}</strong>?`;
    if (isReceived) {
        msg += " Stok barang akan dikurangi secara otomatis.";
    }

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-cancel">Tidak</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-cancel" style="background:#dc2626">Ya, Batalkan</button>
    `;

    const overlay = Modal({
        open: true,
        title: "❌ Batalkan PO",
        content: `<p>${msg}</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-cancel")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-cancel")?.addEventListener("click", async () => {
        try {
            await services.updatePembelianStatus(id, "cancelled");
            showToast("success", `PO ${name} dibatalkan`);
            removeModal(overlay);
            loadData();
        } catch (err) {
            showToast("danger", "Gagal membatalkan: " + err.message);
        }
    });
}

// ═══════════════════════════════════════════════
//  Util: Remove Modal
// ═══════════════════════════════════════════════

function removeModal(overlay) {
    if (!overlay) return;
    if (typeof overlay.close === "function") overlay.close();
    else if (overlay.remove) overlay.remove();
    else {
        const el = document.getElementById("smart-modal-overlay");
        if (el) el.remove();
    }
}

// ═══════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════

function getStyles() {
    return `
        /* Modal: only body scrolls, header+footer stay fixed */
        .smart-modal-dialog { overflow-y:visible !important; display:flex; flex-direction:column; max-height:85vh; }
        .smart-modal-body { overflow-y:auto !important; flex:1 1 auto; min-height:0; }

        .pembelian-page { padding: 1.5rem; }
        .pembelian-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
        .pembelian-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
        .pembelian-page .page-header .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
        .pembelian-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
        .pembelian-page .search-wrapper { position:relative; display:flex; align-items:center; }
        .pembelian-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
        .pembelian-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid #d1d5db; border-radius:6px; font-size:0.875rem; width:240px; outline:none; }
        .pembelian-page .search-wrapper input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
        .pembelian-page .smart-btn { padding:0.5rem 1rem; border:none; border-radius:8px; cursor:pointer; font-weight:500; font-size:0.85rem; white-space:nowrap; transition:opacity 0.15s; }
        .pembelian-page .smart-btn-primary { background:linear-gradient(135deg, #1e1b4b, #7c3aed); color:#fff; }
        .pembelian-page .smart-btn-primary:hover { opacity:0.9; }

        .pd-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .pd-table th { background: #f8fafc; padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        .pd-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .pd-table tbody tr:hover { background: #f8fafc; }
        .pd-text-right { text-align: right; }

        .pd-mgmt-actions { display: flex; gap: 0.25rem; flex-wrap: wrap; }
        .pd-action-btn { padding: 0.25rem 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.75rem; transition: all 0.12s; }
        .pd-action-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
        .pd-action-confirm { color: #16a34a; border-color: #bbf7d0; }
        .pd-action-confirm:hover { background: #f0fdf4; }
        .pd-action-receive { color: #2563eb; border-color: #bfdbfe; }
        .pd-action-receive:hover { background: #eff6ff; }
        .pd-action-cancel { color: #dc2626; border-color: #fecaca; }
        .pd-action-cancel:hover { background: #fef2f2; }
        .pd-action-invoice { color: #4f46e5; border-color: #c7d2fe; }
        .pd-action-invoice:hover { background: #eef2ff; }

        .pd-status-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
        .pd-status-draft { background: #f3f4f6; color: #6b7280; }
        .pd-status-confirmed { background: #dbeafe; color: #1d4ed8; }
        .pd-status-received { background: #dcfce7; color: #16a34a; }
        .pd-status-cancelled { background: #fee2e2; color: #dc2626; }

        .pd-card-view .sm-card-btn-primary { color: #2563eb; border-color: #bfdbfe; }
        .pd-card-view .sm-card-btn-primary:hover { background: #eff6ff; }

        .po-form { padding-right: 0.25rem; }
        .po-form-row { display: grid; grid-template-columns: 1fr 2fr; gap: 0.75rem; margin-bottom: 1rem; }
        .po-section-title { font-weight: 600; margin: 0.75rem 0 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid #e2e8f0; }



        .po-items-header { display: grid; grid-template-columns: 120px 200px 70px 100px 120px 30px; gap: 0.25rem; padding: 0.25rem 0; font-size: 0.75rem; font-weight: 600; color: #6b7280; border-bottom: 1px solid #e2e8f0; }
        .po-item-row { display: grid; grid-template-columns: 120px 200px 70px 100px 120px 30px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
        .po-item-row input { width: 100%; padding: 0.35rem 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.8rem; box-sizing: border-box; }
        .po-col-qty input, .po-col-price input { text-align: right; }
        .po-item-subtotal { font-weight: 500; font-size: 0.8rem; display: block; text-align: right; padding-right: 0.25rem; }
        .po-item-remove { padding: 0.2rem 0.35rem; border: none; background: transparent; color: #dc2626; cursor: pointer; font-size: 1rem; line-height: 1; }
        .po-empty-items { text-align: center; padding: 1rem; color: #9ca3af; font-size: 0.85rem; }

        .po-add-item { margin: 0.5rem 0; }
        .po-add-item-btn { padding: 0.35rem 0.75rem; border: 1px dashed #93c5fd; border-radius: 6px; background: #eff6ff; color: #2563eb; cursor: pointer; font-size: 0.8rem; transition: all 0.12s; }
        .po-add-item-btn:hover { background: #dbeafe; }

        .po-totals { margin: 0.75rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 8px; }
        .po-total-row { display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0; font-size: 0.85rem; }
        .po-grand-total { font-weight: 700; font-size: 1rem; border-top: 1px solid #e2e8f0; padding-top: 0.4rem; margin-top: 0.25rem; }
        .po-diskon-input { width: 120px; text-align: right; padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; }

        /* Modal dialog handles scrolling */
        .po-detail-header { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem; }
        .po-detail-field { display: flex; flex-direction: column; gap: 0.15rem; }
        .po-detail-field strong { font-size: 0.75rem; color: #6b7280; }
        .po-detail-field span { font-size: 0.9rem; }
        .po-detail-items { margin-bottom: 0.75rem; }
        .po-detail-totals { background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; }
        .po-detail-notes { margin-top: 0.5rem; }
        .po-detail-notes strong { font-size: 0.8rem; color: #6b7280; }
        .po-detail-notes p { margin: 0.25rem 0 0; font-size: 0.85rem; white-space: pre-wrap; }

        .pd-loading { text-align: center; padding: 2rem; color: #6b7280; font-size: 0.9rem; }
        .pd-error { text-align: center; padding: 2rem; color: #dc2626; }

        .required { color: #dc2626; margin-left: 2px; }

        @media (max-width: 768px) {
            .pembelian-page { padding: 0.75rem; }
            .po-form-row { grid-template-columns: 1fr; }
            .po-items-header, .po-item-row { grid-template-columns: 80px 1fr 50px 70px; }
            .po-col-subtotal, .po-col-action { display: none; }
            .po-detail-header { grid-template-columns: 1fr; }
        }
    `;
}

// ═══════════════════════════════════════════════
//  Module Factory
// ═══════════════════════════════════════════════

/**
 * Create Pembelian module with dependency injection.
 *
 * @param {object} deps
 * @param {Function} deps.listPembelian
 * @param {Function} deps.getPembelian
 * @param {Function} deps.createPembelian
 * @param {Function} deps.updatePembelian
 * @param {Function} deps.deletePembelian
 * @param {Function} deps.updatePembelianStatus
 * @param {Function} deps.listSupplier
 * @param {Function} deps.listBarang
 * @param {Function} deps.formatRupiah
 * @returns {{ PembelianPage: Function, initPembelianPage: Function }}
 */
export function PembelianModule(deps = {}) {
    services = {
        listPembelian: deps.listPembelian || (async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
        getPembelian: deps.getPembelian || (async () => null),
        createPembelian: deps.createPembelian || (async () => {}),
        updatePembelian: deps.updatePembelian || (async () => {}),
        deletePembelian: deps.deletePembelian || (async () => {}),
        updatePembelianStatus: deps.updatePembelianStatus || (async () => {}),
        listSupplier: deps.listSupplier || (async () => ({ data: [] })),
        listBarang: deps.listBarang || (async () => ({ data: [] })),
        formatRupiah: deps.formatRupiah || ((v) => `Rp ${(v || 0).toLocaleString("id-ID")}`),
        getCompanyInfo: deps.getCompanyInfo || null
    };

    return {
        PembelianPage,
        initPembelianPage
    };
}
