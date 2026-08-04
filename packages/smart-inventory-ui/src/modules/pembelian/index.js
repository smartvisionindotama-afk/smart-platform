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
 *   listWarehouse,
 *   formatRupiah,
 *   getCompanyInfo — async function() => { name, address, phone, email, logo }
 *
 * @module @smart/inventory-ui/modules/pembelian
 */

import { Modal, Table, Pagination, EmptyState, Alert, showToast, UI, printToWindow } from "@smart/ui";
import { scannerSectionHTML, scanButtonHTML, attachScanner } from "@smart/ui";
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

/**
 * Format angka menjadi format ribuan Indonesia: 15000 → "15.000".
 */
function formatThousand(v) {
    const n = Math.round(Number(v) || 0);
    return n.toLocaleString("id-ID");
}

/**
 * Ubah string berformat ribuan ("15.000") menjadi angka bulat (15000).
 */
function unformatThousand(v) {
    if (v === null || v === undefined) return 0;
    const cleaned = String(v).replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
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
function canDelete(status) { return true; }
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
            <div class="pd-tabs">
                <button class="pd-tab active" data-pd-tab="list">🛒 Pembelian</button>
                <button class="pd-tab" data-pd-tab="retur">↩️ Retur Pembelian</button>
            </div>
            <div id="pd-tab-list">
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
            <div id="pd-tab-retur" style="display:none">
                <div class="page-header">
                    <div>
                        <h1>↩️ Retur Pembelian</h1>
                        <div class="header-subtitle">Catat pengembalian barang ke supplier</div>
                    </div>
                    <div class="page-actions">
                        <div class="search-wrapper">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="pr-search-input" placeholder="Cari no. retur, PO, supplier..." autocomplete="off" />
                        </div>
                    </div>
                </div>
                <div id="pr-table-area">
                    <table class="pd-table">
                        <thead>
                            <tr>
                                <th>No. Retur</th>
                                <th>Tanggal</th>
                                <th>No. PO</th>
                                <th>Supplier</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="pr-table-body"></tbody>
                    </table>
                </div>
                <div id="pr-card-area" class="pd-card-view" style="display:none"></div>
                <div id="pr-pagination"></div>
                <div id="pr-empty-state"></div>
                <div id="pr-loading" class="pd-loading" style="display:none">Memuat...</div>
            </div>
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

    // ── Tab switching: Pembelian / Retur Pembelian ──
    document.querySelectorAll("[data-pd-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.pdTab;
            document.querySelectorAll("[data-pd-tab]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const listEl = document.getElementById("pd-tab-list");
            const returEl = document.getElementById("pd-tab-retur");
            if (listEl) listEl.style.display = tab === "list" ? "" : "none";
            if (returEl) returEl.style.display = tab === "retur" ? "" : "none";
            if (tab === "retur") initReturTab();
        });
    });
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
                        <button class="pd-action-btn pd-action-invoice" data-action="invoice" data-id="${item._id || item.id}" title="Cetak PO">🖨️ PO</button>
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
            if (action === "invoice") printInvoice(id);
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
                <button class="sm-card-btn sm-card-btn-invoice" data-po-invoice="${item._id || item.id}">🖨️ PO</button>
                ${canDelete(item.status) ? `<button class="sm-card-btn sm-card-btn-delete" data-po-delete="${item._id || item.id}">🗑️</button>` : ""}
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
        kirimKe: "",
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
                kirimKe: item.kirimKe || "",
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

    // Fetch suppliers, barangs & warehouses for dropdowns
    let suppliers = [];
    let barangs = [];
    let warehouses = [];
    try {
        // Fetch each independently — one failure shouldn't block others
        try {
            const supRes = await services.listSupplier({ page: 1, limit: 999 });
            suppliers = supRes.data || [];
        } catch {}
        try {
            const brgRes = await services.listBarang({ page: 1, limit: 999 });
            barangs = brgRes.data || [];
        } catch {}
        if (typeof services.listWarehouse === "function") {
            try {
                const whRes = await services.listWarehouse({ page: 1, limit: 999 });
                warehouses = whRes.data || [];
            } catch {}
        }
    } catch (err) {
        console.warn("[Pembelian] Fetch error:", err);
    }

    // Populate all dropdowns (even if empty)
    populateSupplierDropdown(suppliers, formData.supplier);
    populateWarehouseDropdown(warehouses, formData.kirimKe);
    renderItemRows(barangs, formData.items);

    // Populate datalist for barang — kode field searches by kode, nama field by nama
    const kodeList = document.getElementById(`po-barang-list-${pageId}`);
    const namaList = document.getElementById(`po-nama-list-${pageId}`);
    if (kodeList) {
        kodeList.innerHTML = barangs.map(b =>                `<option value="${esc(b.kode)}" data-kode="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan)}" data-harga="${b.harga_beli || 0}">${esc(b.nama)}</option>`
        ).join("");
    }
    if (namaList) {
        namaList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan)}" data-harga="${b.harga_beli || 0}">${esc(b.kode)}</option>`
        ).join("");
    }

    // Diskon input → recalc on input
    const diskonTotalInput = document.getElementById("f-diskon");
    diskonTotalInput?.addEventListener("input", () => { diskonTotalInput.value = diskonTotalInput.value.replace(/\D/g, ""); });
    diskonTotalInput?.addEventListener("input", calcTotals);
    diskonTotalInput?.addEventListener("focus", () => { diskonTotalInput.value = String(unformatThousand(diskonTotalInput.value)); });
    diskonTotalInput?.addEventListener("blur", () => { diskonTotalInput.value = formatThousand(unformatThousand(diskonTotalInput.value)); });

    // Init item row events + add item button
    initItemRowEvents(barangs);
    attachAddItemBtn(barangs);
    let scannerCleanup = initScanner();
    calcTotals();

    document.getElementById("f-cancel")?.addEventListener("click", () => { if (typeof scannerCleanup === "function") scannerCleanup(); removeModal(overlay); });
    document.getElementById("f-submit")?.addEventListener("click", () => { if (typeof scannerCleanup === "function") scannerCleanup(); handleSubmit(overlay, formData, isEdit ? id : null); });

    function initScanner() {
        // Event delegation for scan buttons
        const itemsBody = document.getElementById("po-items-body");
        if (!itemsBody) return () => {};

        let scannerInstance = null;
        let activeScanIndex = -1;

        itemsBody.addEventListener("click", (e) => {
            const scanBtn = e.target.closest(".btn-scan");
            if (!scanBtn) return;
            e.preventDefault();
            const idx = parseInt(scanBtn.dataset.scanIndex, 10);
            if (!isNaN(idx)) toggleScanner(idx);
        });

        async function onScanSuccess(decodedText) {
            triggerScanFlash(); playScanBeep();
            if (activeScanIndex >= 0) {
                const kodeInput = document.querySelector(`.po-item-kode[data-index="${activeScanIndex}"]`);
                if (kodeInput) {
                    kodeInput.value = decodedText.trim();
                    kodeInput.dispatchEvent(new Event("blur", { bubbles: true }));
                    showToast("success", `✅ Kode: ${decodedText.trim()}`);
                }
            }
            setTimeout(() => stopScanner(), 400);
        }

        async function startScanner() {
            const section = document.getElementById("scanner-section-scanner-pembelian");
            if (!section) return;
            section.style.display = "block"; section.classList.add("active");
            try {
                scannerInstance = new UI.BarcodeScanner("scanner-pembelian", { onScan: onScanSuccess, fps: 10 });
                await scannerInstance.start();
            } catch { stopScanner(); showToast("warning", "Kamera tidak tersedia. Silakan ketik kode manual."); }
        }

        function stopScanner() {
            if (scannerInstance) { scannerInstance.destroy(); scannerInstance = null; }
            const section = document.getElementById("scanner-section-scanner-pembelian");
            if (section) { section.classList.remove("active"); section.style.display = "none"; }
            activeScanIndex = -1;
        }

        function toggleScanner(index) {
            const section = document.getElementById("scanner-section-scanner-pembelian");
            if (!section) return;
            if (section.style.display === "none" || !section.style.display || section.style.display === "") {
                activeScanIndex = index;
                startScanner();
            } else { stopScanner(); }
        }

        async function switchCamera() {
            if (scannerInstance) try { await scannerInstance.switchCamera(); } catch {}
        }

        function triggerScanFlash() {
            const flash = document.getElementById("scanner-flash-pembelian");
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

        document.getElementById("btn-switch-pembelian")?.addEventListener("click", switchCamera);

        return () => { stopScanner(); };
    }
}


function buildFormHTML(data, isEdit) {
    const itemRows = (data.items || []).map((item, idx) => buildItemRow(item, idx)).join("");
    return `
        <div class="po-form">
            ${isEdit ? `<div class="po-nomor-row">
                <div class="form-group" style="max-width:280px">
                    <label>No. PO</label>
                    <input type="text" value="${esc(data.nomor)}" disabled />
                </div>
            </div>` : ""}
            <div class="po-form-row">
                <div class="form-group">
                    <label for="f-tanggal">Tanggal</label>
                    <input type="date" id="f-tanggal" value="${esc(data.tanggal)}" />
                </div>
                <div class="form-group">
                    <label for="f-kirim-ke">Kirim Ke <span class="required">*</span></label>
                    <select id="f-kirim-ke">
                        <option value="">— Pilih Gudang —</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="f-supplier">Supplier <span class="required">*</span></label>
                    <select id="f-supplier">
                        <option value="">— Pilih Supplier —</option>
                    </select>
                </div>
            </div>

            ${scannerSectionHTML(
                'scanner-pembelian',
                'btn-switch-pembelian',
                'scanner-flash-pembelian'
            )}
            <div class="po-section-title">📦 Item Barang</div>
            <div class="po-items-header">
                <span class="po-col-code">Kode</span>
                <span class="po-col-name">Nama Barang</span>
                <span class="po-col-qty">Qty</span>
                <span class="po-col-satuan">Satuan</span>
                <span class="po-col-price">Harga</span>
                <span class="po-col-diskon">Diskon</span>
                <span class="po-col-subtotal">Subtotal</span>
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
                    <input type="text" inputmode="numeric" id="f-diskon" value="${esc(formatThousand(data.diskon || 0))}" class="po-diskon-input" />
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
            <span class="po-col-code" data-label="Kode">
                <span class="kode-scan-wrapper">
                    <input type="text" class="po-item-kode" value="${esc(item.kode)}" placeholder="Kode" list="po-barang-list-${pageId}" data-index="${idx}" />
                    ${scanButtonHTML(`data-scan-index="${idx}"`)}
                </span>
            </span>
            <span class="po-col-name" data-label="Nama Barang">
                <input type="text" class="po-item-nama" value="${esc(item.nama)}" placeholder="Nama barang" list="po-nama-list-${pageId}" data-index="${idx}" />
            </span>
            <span class="po-col-qty" data-label="Qty">
                <input type="text" inputmode="numeric" class="po-item-qty" value="${esc(formatThousand(item.qty || 0))}" data-index="${idx}" />
            </span>
            <span class="po-col-satuan" data-label="Satuan">
                <input type="text" class="po-item-satuan" value="${esc(item.satuan || '')}" readonly data-index="${idx}" />
            </span>
            <span class="po-col-price" data-label="Harga">
                <input type="text" inputmode="numeric" class="po-item-harga" value="${esc(formatThousand(item.harga || 0))}" data-index="${idx}" />
            </span>
            <span class="po-col-diskon" data-label="Diskon">
                <input type="text" inputmode="numeric" class="po-item-diskon" value="${esc(formatThousand(item.diskon || 0))}" data-index="${idx}" />
            </span>
            <span class="po-col-subtotal" data-label="Subtotal">
                <input type="text" class="po-item-subtotal" value="${esc(services.formatRupiah ? services.formatRupiah(item.subtotal || 0) : (item.subtotal || 0).toLocaleString())}" readonly data-index="${idx}" />
            </span>
            <button type="button" class="po-item-remove" data-index="${idx}" title="Hapus item">Tutup</button>
        </div>
    `;
}

function populateWarehouseDropdown(warehouses, selected) {
    const sel = document.getElementById("f-kirim-ke");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih Gudang —</option>`;
    for (const w of warehouses) {
        const code = w.kode || w._id || "";
        const name = w.nama || code;
        sel.innerHTML += `<option value="${esc(code)}" data-name="${esc(name)}" ${code === selected ? "selected" : ""}>${esc(code)} - ${esc(name)}</option>`;
    }
    if (selected && !warehouses.find(w => (w.kode || w._id || "") === selected)) {
        sel.innerHTML += `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
    }
}

function populateSupplierDropdown(suppliers, selected) {
    const sel = document.getElementById("f-supplier");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih Supplier —</option>`;
    for (const s of suppliers) {
        const code = s.kode || s._id || "";
        const name = s.nama || code;
        sel.innerHTML += `<option value="${esc(code)}" data-name="${esc(name)}" ${code === selected ? "selected" : ""}>${esc(code)} - ${esc(name)}</option>`;
    }
    if (selected && !suppliers.find(s => (s.kode || s._id || "") === selected)) {
        sel.innerHTML += `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
    }
}

/**
 * Populate supplier dropdowns (Kode & Nama) pada form Retur Pembelian,
 * lalu pilih nilai yang sudah ada (dengan fallback jika tidak ada di master).
 */
function populateReturSupplierDropdowns(suppliers, selectedKode, selectedNama) {
    const kodeSel = document.getElementById("pr-supplier");
    const namaSel = document.getElementById("pr-supplier-name");
    if (kodeSel) {
        kodeSel.innerHTML = `<option value="">— Pilih Supplier —</option>`;
        for (const s of suppliers) {
            const code = s.kode || s._id || "";
            const name = s.nama || code;
            kodeSel.innerHTML += `<option value="${esc(code)}" data-nama="${esc(name)}">${esc(code)}</option>`;
        }
    }
    if (namaSel) {
        namaSel.innerHTML = `<option value="">— Pilih Supplier —</option>`;
        for (const s of suppliers) {
            const code = s.kode || s._id || "";
            const name = s.nama || code;
            namaSel.innerHTML += `<option value="${esc(name)}" data-kode="${esc(code)}">${esc(name)}</option>`;
        }
    }
    if (selectedKode || selectedNama) {
        setReturSupplierPair(selectedKode, selectedNama);
    }
}

/**
 * Set kedua select supplier (kode + nama) sekaligus.
 * Jika nilai tidak ada di daftar, tambahkan option fallback agar tetap tampil.
 */
function setReturSupplierPair(kode, nama) {
    const kodeSel = document.getElementById("pr-supplier");
    const namaSel = document.getElementById("pr-supplier-name");

    // Prefer nama master jika kode cocok di daftar master (bukan nama snapshot PO)
    if (kodeSel && kode) {
        const opt = Array.from(kodeSel.options).find(o => o.value === kode);
        if (opt && opt.dataset.nama) nama = opt.dataset.nama;
    }

    if (kodeSel) {
        if (kode && !Array.from(kodeSel.options).some(o => o.value === kode)) {
            kodeSel.innerHTML += `<option value="${esc(kode)}" data-nama="${esc(nama || kode)}">${esc(kode)}</option>`;
        }
        kodeSel.value = kode || "";
    }
    if (namaSel) {
        if (nama && !Array.from(namaSel.options).some(o => o.value === nama)) {
            namaSel.innerHTML += `<option value="${esc(nama)}" data-kode="${esc(kode || nama)}">${esc(nama)}</option>`;
        }
        namaSel.value = nama || "";
    }
}

function renderItemRows(barangs, items) {
    const body = document.getElementById("po-items-body");
    if (!body) return;
    body.innerHTML = items.length > 0
        ? items.map((item, idx) => buildItemRow(item, idx)).join("")
        : '<div class="po-empty-items">Belum ada item. Klik "Tambah Item" untuk menambahkan barang.</div>';
}

function initItemRowEvents(barangs) {        // Qty, Harga & Diskon changes → recalc subtotal
    document.querySelectorAll(".po-item-qty, .po-item-harga, .po-item-diskon").forEach(inp => {
        // Hanya digit yang boleh diketik (format ribuan muncul saat blur)
        inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); });
        inp.addEventListener("input", recalcRow);
        inp.addEventListener("change", recalcRow);
        // Fokus → angka mentah agar mudah diedit; blur → format ribuan
        inp.addEventListener("focus", () => { inp.value = String(unformatThousand(inp.value)); });
        inp.addEventListener("blur", () => { inp.value = formatThousand(unformatThousand(inp.value)); });
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
    const satuanInput = document.querySelector(`.po-item-satuan[data-index="${idx}"]`);
    const hargaInput = document.querySelector(`.po-item-harga[data-index="${idx}"]`);
    if (kodeInput) kodeInput.value = barang.kode || "";
    if (namaInput) namaInput.value = barang.nama || "";
    // Ambil satuan dari data barang, fallback ke datalist data-satuan
    let satuan = barang.satuan || "";
    if (!satuan && inputEl.list) {
        const opt = Array.from(inputEl.list.options).find(o => o.value === val);
        if (opt) satuan = opt.getAttribute("data-satuan") || "";
    }
    if (satuanInput) satuanInput.value = satuan;
    if (hargaInput) { hargaInput.value = formatThousand(barang.harga_beli || 0); recalcRow({ target: hargaInput }); }
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
    const namaBendahara = company.orgBendahara || "";
    const namaDirektur = company.orgKetua || "";

    // Resolve warehouse name for display
    const kirimKeNama = item.kirimKeNama || item.kirimKe || "-";
    const itemsHTML = (item.items || []).map((i, idx) => `
        <tr>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.kode)}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${i.qty}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.satuan || '-')}</td>
            <td style="text-align:right;padding:6px 8px;border:1px solid #e2e8f0;">${services.formatRupiah ? services.formatRupiah(i.harga) : i.harga.toLocaleString()}</td>
            <td style="text-align:right;padding:6px 8px;border:1px solid #e2e8f0;">${i.diskon > 0 ? (services.formatRupiah ? services.formatRupiah(i.diskon) : i.diskon.toLocaleString()) : '-'}</td>
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
    <title>Purchasing Order - ${esc(item.nomor)}</title>
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
                <div class="invoice-title">PURCHASING ORDER</div>
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
                    <div class="invoice-info-label">Dikirim Ke</div>
                    <div class="invoice-info-value">${esc(kirimKeNama)}</div>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width:36px">No</th>
                        <th style="width:90px">Kode</th>
                        <th>Nama Barang</th>
                        <th style="width:40px">Qty</th>
                        <th style="width:60px">Satuan</th>
                        <th style="width:90px">Harga</th>
                        <th style="width:80px">Diskon</th>
                        <th style="width:100px">Subtotal</th>
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
                <div class="invoice-signatures" style="flex:1;min-width:280px;display:flex;gap:24px;justify-content:center;align-items:flex-start;">
                    <div class="invoice-signature-item" style="text-align:center;flex:1;">
                        <div style="font-size:0.75rem;font-weight:600;color:#475569;margin-bottom:8px;">Disetujui oleh</div>
                        <div style="height:64px;"></div>
                        <div style="border-top:1px solid #cbd5e1;padding-top:0.4rem;">
                            <div style="font-size:0.85rem;font-weight:600;color:#1e293b;">${esc(namaDirektur || '_______________')}</div>
                        </div>
                    </div>
                    <div class="invoice-signature-item" style="text-align:center;flex:1;">
                        <div style="font-size:0.75rem;font-weight:600;color:#475569;margin-bottom:8px;">Dibuat oleh</div>
                        <div style="height:64px;"></div>
                        <div style="border-top:1px solid #cbd5e1;padding-top:0.4rem;">
                            <div style="font-size:0.85rem;font-weight:600;color:#1e293b;">${esc(namaBendahara || '_______________')}</div>
                        </div>
                    </div>
                </div>
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

    printToWindow(invoiceHTML, "mencetak PO", false);
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
    const qty = unformatThousand(document.querySelector(`.po-item-qty[data-index="${idx}"]`)?.value);
    const harga = unformatThousand(document.querySelector(`.po-item-harga[data-index="${idx}"]`)?.value);
    const diskon = unformatThousand(document.querySelector(`.po-item-diskon[data-index="${idx}"]`)?.value);
    const subtotalEl = document.querySelector(`.po-item-subtotal[data-index="${idx}"]`);
    const subtotal = Math.max(0, (qty * harga) - diskon);
    if (subtotalEl) {
        subtotalEl.value = services.formatRupiah ? services.formatRupiah(subtotal) : subtotal.toLocaleString();
    }
    calcTotals();
}

function calcTotals() {
    let total = 0;
    document.querySelectorAll(".po-item-row").forEach(row => {
        const idx = row.dataset.index;
        const qty = unformatThousand(document.querySelector(`.po-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.po-item-harga[data-index="${idx}"]`)?.value);
        const diskon = unformatThousand(document.querySelector(`.po-item-diskon[data-index="${idx}"]`)?.value);
        total += Math.max(0, (qty * harga) - diskon);
    });
    const diskon = unformatThousand(document.getElementById("f-diskon")?.value);
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
    const diskon = unformatThousand(document.getElementById("f-diskon")?.value);
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

    // Get supplier name from selected option (data-name attribute)
    const supplierSel = document.getElementById("f-supplier");
    const supplierName = supplierSel?.selectedOptions?.[0]?.getAttribute("data-name") || supplier;

    const items = [];
    for (const row of itemRows) {
        const idx = row.dataset.index;
        const kode = document.querySelector(`.po-item-kode[data-index="${idx}"]`)?.value.trim() || "";
        const nama = document.querySelector(`.po-item-nama[data-index="${idx}"]`)?.value.trim() || "";
        const qty = unformatThousand(document.querySelector(`.po-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.po-item-harga[data-index="${idx}"]`)?.value);

        if (!kode && !nama) continue; // skip empty rows
        if (qty <= 0) {
            showToast("danger", `Qty untuk "${nama || kode}" harus lebih dari 0`);
            return;
        }
        if (harga <= 0) {
            showToast("danger", `Harga untuk "${nama || kode}" harus diisi`);
            return;
        }

        const satuan = document.querySelector(`.po-item-satuan[data-index="${idx}"]`)?.value?.trim() || "";
        const diskon = unformatThousand(document.querySelector(`.po-item-diskon[data-index="${idx}"]`)?.value);

        items.push({ kode, nama, satuan, qty, harga, diskon, subtotal: Math.max(0, (qty * harga) - diskon) });
    }

    if (items.length === 0) {
        showToast("danger", "Minimal 1 item barang dengan qty > 0 harus ditambahkan");
        return;
    }

    const currentUser = getCurrentUserName() || "System";
    // Get kirimKe value from warehouse dropdown
    const kirimKeSel = document.getElementById("f-kirim-ke");
    const kirimKe = kirimKeSel?.value || "";
    const kirimKeNama = kirimKeSel?.selectedOptions?.[0]?.getAttribute("data-name") || kirimKe;

    const payload = {
        tanggal: tanggal || new Date().toISOString(),
        kirimKe,
        kirimKeNama,
        supplier,
        supplierName,
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
//  Retur Pembelian — State
// ═══════════════════════════════════════════════

let returState = {
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    search: "",
    loading: false,
    editingId: null
};

let _returTabInit = false;

function returStatusBadgeHTML(status) {
    const map = {
        "draft":    { label: "Draft",     cls: "pd-status-draft" },
        "returned": { label: "Dikembalikan", cls: "pd-status-received" }
    };
    const s = map[status] || { label: status, cls: "" };
    return `<span class="pd-status-badge ${s.cls}">${s.label}</span>`;
}

// ═══════════════════════════════════════════════
//  Retur Pembelian — Init / Load
// ═══════════════════════════════════════════════

function initReturTab() {
    returState.items = [];
    returState.pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
    returState.search = "";
    returState.loading = false;
    returState.editingId = null;

    const searchInput = document.getElementById("pr-search-input");
    if (searchInput && !_returTabInit) {
        searchInput.addEventListener("input", debounce((e) => {
            returState.search = e.target.value.trim();
            returState.pagination.page = 1;
            loadReturData();
        }, 300));
    }

    const pageActions = document.querySelector(`#pd-tab-retur .page-actions`);
    if (pageActions && !_returTabInit) {
        const addBtn = document.createElement("button");
        addBtn.className = "smart-btn smart-btn-primary";
        addBtn.innerHTML = "➕ Buat Retur";
        addBtn.addEventListener("click", () => openReturForm("create"));
        pageActions.appendChild(addBtn);
    }

    _returTabInit = true;
    loadReturData();
}

async function loadReturData() {
    const loadingEl = document.getElementById("pr-loading");
    const emptyEl = document.getElementById("pr-empty-state");
    const tableArea = document.getElementById("pr-table-area");
    const cardArea = document.getElementById("pr-card-area");
    const paginationEl = document.getElementById("pr-pagination");

    if (!tableArea) return;
    returState.loading = true;
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.innerHTML = "";

    try {
        const result = await services.listReturPembelian({
            page: returState.pagination.page,
            limit: returState.pagination.limit,
            search: returState.search
        });
        returState.items = result.data || [];
        returState.pagination = result.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

        if (loadingEl) loadingEl.style.display = "none";

        if (returState.items.length === 0) {
            if (tableArea) tableArea.style.display = "none";
            if (cardArea) cardArea.style.display = "none";
            if (emptyEl) {
                emptyEl.appendChild(EmptyState({
                    icon: "↩️",
                    title: returState.search ? "Pencarian tidak ditemukan" : "Belum ada Retur Pembelian",
                    description: returState.search ? "Coba kata kunci lain" : "Buat retur untuk mencatat pengembalian barang ke supplier",
                    actionText: returState.search ? "Reset Pencarian" : "Buat Retur",
                    onAction: returState.search ? () => { returState.search = ""; const inp = document.getElementById("pr-search-input"); if (inp) inp.value = ""; loadReturData(); } : () => openReturForm("create")
                }));
            }
            if (paginationEl) paginationEl.innerHTML = "";
            return;
        }

        renderReturTable();
        renderReturCards();
        toggleReturView();
        renderReturPagination();
    } catch (err) {
        console.error("[Pembelian] loadReturData failed:", err);
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) {
            emptyEl.innerHTML = `<div class="pd-error">Gagal memuat data: ${esc(err.message)}</div>`;
        }
    }
}

// ═══════════════════════════════════════════════
//  Retur Pembelian — Render
// ═══════════════════════════════════════════════

function renderReturTable() {
    const tbody = document.getElementById("pr-table-body");
    if (!tbody) return;
    tbody.innerHTML = returState.items.map(item => {
        const itemsCount = (item.items || []).length;
        return `
            <tr>
                <td><strong>${esc(item.nomor)}</strong></td>
                <td>${formatDate(item.tanggal)}</td>
                <td>${esc(item.nomorPO || '-')}</td>
                <td>${esc(item.supplierName || item.supplier || '-')}</td>
                <td class="pd-text-right">${services.formatRupiah ? services.formatRupiah(item.total || 0) : (item.total || 0).toLocaleString()}</td>
                <td>${returStatusBadgeHTML(item.status)}</td>
                <td>
                    <div class="pd-mgmt-actions">
                        <button class="pd-action-btn pd-action-invoice" data-action="print" data-id="${item._id || item.id}" title="Cetak Nota Retur">🖨️</button>
                        ${item.status === "draft" ? `<button class="pd-action-btn pd-action-edit" data-action="edit" data-id="${item._id || item.id}" title="Edit Retur">✏️</button>` : ""}
                        ${item.status === "draft" ? `<button class="pd-action-btn pd-action-receive" data-action="confirm" data-id="${item._id || item.id}" title="Konfirmasi Retur (stok berkurang)">✅ Retur</button>` : ""}
                        <button class="pd-action-btn pd-action-cancel" data-action="delete" data-id="${item._id || item.id}" title="Hapus">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    tbody.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === "print") printRetur(id);
            else if (action === "edit") openReturForm("edit", id);
            else if (action === "delete") confirmReturDelete(id);
            else if (action === "confirm") updateReturStatus(id);
        });
    });
}

function renderReturCards() {
    const cardArea = document.getElementById("pr-card-area");
    if (!cardArea) return;
    cardArea.innerHTML = "";
    const list = UI.CardList(returState.items, (item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${esc(item.nomor)}</div>
            <div class="sm-card-desc">${formatDate(item.tanggal)}</div>
        </div>
        <div class="sm-card-details">
            <div class="sm-card-detail-row">
                <span class="sm-card-label">No. PO</span>
                <span class="sm-card-value">${esc(item.nomorPO || '-')}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Supplier</span>
                <span class="sm-card-value">${esc(item.supplierName || item.supplier || '-')}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Total</span>
                <span class="sm-card-value">${services.formatRupiah ? services.formatRupiah(item.total || 0) : (item.total || 0).toLocaleString()}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Status</span>
                <span class="sm-card-value">${returStatusBadgeHTML(item.status)}</span>
            </div>
        </div>
        <div class="sm-card-footer-row">
            <div class="sm-card-actions">
                <button class="sm-card-btn sm-card-btn-invoice" data-pr-print="${item._id || item.id}">🖨️</button>
                ${item.status === "draft" ? `<button class="sm-card-btn sm-card-btn-primary" data-pr-confirm="${item._id || item.id}">✅ Retur</button>` : ""}
                ${item.status === "draft" ? `<button class="sm-card-btn sm-card-btn-edit" data-pr-edit="${item._id || item.id}">✏️</button>` : ""}
                <button class="sm-card-btn sm-card-btn-delete" data-pr-delete="${item._id || item.id}">🗑️</button>
            </div>
        </div>
    `);
    cardArea.appendChild(list);

    cardArea.querySelectorAll("[data-pr-print]").forEach(btn => {
        btn.addEventListener("click", () => printRetur(btn.dataset.prPrint));
    });
    cardArea.querySelectorAll("[data-pr-edit]").forEach(btn => {
        btn.addEventListener("click", () => openReturForm("edit", btn.dataset.prEdit));
    });
    cardArea.querySelectorAll("[data-pr-delete]").forEach(btn => {
        btn.addEventListener("click", () => confirmReturDelete(btn.dataset.prDelete));
    });
    cardArea.querySelectorAll("[data-pr-confirm]").forEach(btn => {
        btn.addEventListener("click", () => updateReturStatus(btn.dataset.prConfirm));
    });
}

function toggleReturView() {
    const tableArea = document.getElementById("pr-table-area");
    const cardArea = document.getElementById("pr-card-area");
    if (!tableArea || !cardArea) return;
    const isMobile = window.innerWidth < 768;
    tableArea.style.display = isMobile ? "none" : "";
    cardArea.style.display = isMobile ? "block" : "none";
}

function renderReturPagination() {
    const el = document.getElementById("pr-pagination");
    if (!el) return;
    if (returState.pagination.totalPages <= 1) { el.innerHTML = ""; return; }
    el.innerHTML = "";
    el.appendChild(Pagination({
        currentPage: returState.pagination.page,
        totalPages: returState.pagination.totalPages,
        total: returState.pagination.total,
        onChange: (page) => {
            returState.pagination.page = page;
            loadReturData();
        }
    }));
}

// ═══════════════════════════════════════════════
//  Retur Pembelian — Form (Create / Edit)
// ═══════════════════════════════════════════════

async function openReturForm(mode, id) {
    const isEdit = mode === "edit" && id;
    let formData = {
        tanggal: new Date().toISOString().split("T")[0],
        nomorPO: "",
        idPO: "",
        supplier: "",
        supplierName: "",
        items: [],
        catatan: "",
        nomor: "",
        mode: "po"
    };

    if (isEdit) {
        try {
            const item = await services.getReturPembelian(id);
            if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
            formData = {
                tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split("T")[0] : "",
                nomorPO: item.nomorPO || "",
                idPO: item.idPO || "",
                supplier: item.supplier || "",
                supplierName: item.supplierName || "",
                items: (item.items || []).map(i => ({ ...i })),
                catatan: item.catatan || "",
                nomor: item.nomor || "",
                mode: "po"
            };

            // Merge qty PO asli ke item retur
            try {
                if (formData.idPO) {
                    const po = await services.getPembelian(formData.idPO);
                    if (po && po.items) {
                        formData.items = formData.items.map(ri => {
                            const poItem = po.items.find(p => p.kode === ri.kode);
                            return { ...ri, qtyPo: poItem ? poItem.qty : ri.qty };
                        });
                    }
                }
            } catch (e) { console.warn("[ReturPembelian] Gagal memuat PO asal:", e); }
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
            return;
        }
    }

    const title = isEdit ? `✏️ Edit Retur: ${formData.nomor}` : "↩️ Buat Retur Pembelian Baru";
    const contentHTML = buildReturFormHTML(formData, isEdit);
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="pr-cancel">Batal</button>
        <button class="smart-btn smart-db-primary" id="pr-submit">${isEdit ? "Simpan Perubahan" : "Buat Retur"}</button>
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

    // ── Fetch barang list for datalist (manual mode) ──
    let barangs = [];
    try {
        const barangRes = await services.listBarang({ page: 1, limit: 999 });
        barangs = barangRes.data || [];
    } catch {}

    // ── Fetch suppliers for dropdown (Kode & Nama) ──
    let suppliers = [];
    try {
        const supRes = await services.listSupplier({ page: 1, limit: 999 });
        suppliers = supRes.data || [];
    } catch {}
    populateReturSupplierDropdowns(suppliers, formData.supplier, formData.supplierName);

    // ── Supplier cross-fill: pilih kode → nama terisi, pilih nama → kode terisi ──
    const supKodeSel = document.getElementById("pr-supplier");
    const supNamaSel = document.getElementById("pr-supplier-name");
    if (supKodeSel && supNamaSel) {
        supKodeSel.addEventListener("change", () => {
            const opt = supKodeSel.selectedOptions?.[0];
            setReturSupplierPair(supKodeSel.value, opt?.dataset?.nama || "");
        });
        supNamaSel.addEventListener("change", () => {
            const opt = supNamaSel.selectedOptions?.[0];
            setReturSupplierPair(opt?.dataset?.kode || "", supNamaSel.value);
        });
    }

    // ── Populate datalist ──
    const kodeList = document.getElementById(`pr-barang-list-${pageId}`);
    const namaList = document.getElementById(`pr-nama-list-${pageId}`);
    if (kodeList) {
        kodeList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan || '')}" data-harga="${b.harga_beli || 0}" data-stok="${b.stok || 0}"></option>`
        ).join("");
    }
    if (namaList) {
        namaList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-satuan="${esc(b.satuan || '')}" data-harga="${b.harga_beli || 0}" data-stok="${b.stok || 0}"></option>`
        ).join("");
    }

    // ── Mode switch (PO / Manual) ──
    const modeSel = document.getElementById("pr-mode");
    const poSection = document.getElementById("pr-po-section");
    const addItemSection = document.getElementById("pr-add-item-section");
    const modeHint = document.getElementById("pr-mode-hint");
    const modeHintItems = document.getElementById("pr-mode-hint-items");

    function switchMode(mode) {
        if (mode === "manual") {
            if (poSection) poSection.style.display = "none";
            if (addItemSection) addItemSection.style.display = "block";
            if (modeHint) modeHint.textContent = "Input item barang secara manual satu per satu.";
            if (modeHintItems) modeHintItems.textContent = "(isi kode, nama, qty, harga, dan diskon manual)";
            // Render empty items if none
            const body = document.getElementById("pr-items-body");
            if (body) {
                const existing = body.querySelectorAll(".po-item-row");
                if (existing.length === 0) {
                    body.innerHTML = '<div class="po-empty-items">Klik "Tambah Item Barang" untuk menambahkan barang.</div>';
                }
            }
            // Tampilkan + enable supplier dropdowns (manual input)
            const supSection = document.getElementById("pr-supplier-section");
            const sup = document.getElementById("pr-supplier");
            const supName = document.getElementById("pr-supplier-name");
            if (supSection) supSection.style.display = "";
            if (sup) sup.disabled = false;
            if (supName) supName.disabled = false;
        } else {
            if (poSection) poSection.style.display = "";
            if (addItemSection) addItemSection.style.display = "none";
            if (modeHint) modeHint.textContent = "Pilih PO untuk memuat item otomatis, atau Manual untuk input item satu per satu.";
            if (modeHintItems) modeHintItems.textContent = "(qty retur diisi manual, max = qty PO / stok)";
            // Sembunyikan + disable supplier dropdowns (PO sudah include supplier)
            const supSection = document.getElementById("pr-supplier-section");
            const sup = document.getElementById("pr-supplier");
            const supName = document.getElementById("pr-supplier-name");
            if (supSection) supSection.style.display = "none";
            if (sup) sup.disabled = true;
            if (supName) supName.disabled = true;
        }
    }

    if (modeSel) {
        modeSel.addEventListener("change", () => {
            switchMode(modeSel.value);
            // Clear items when switching
            renderReturItemRows([]);
            calcReturTotals();
        });
    }

    // Edit retur manual (tanpa PO): paksa mode manual + render item editable
    if (modeSel && isEdit && !formData.idPO) {
        modeSel.value = "manual";
        switchMode("manual");
        const body = document.getElementById("pr-items-body");
        if (body) {
            body.innerHTML = (formData.items || []).map((it, idx) => buildReturItemRow({ ...it, _manual: true }, idx)).join("");
        }
        initReturItemEvents();
        calcReturTotals();
    }

    // ── Fetch PO list ──
    let poList = [];
    try {
        const poRes = await services.listPembelian({ page: 1, limit: 999 });
        poList = (poRes.data || []).filter(p => p.status !== "draft" && p.status !== "cancelled");
    } catch {}

    populateReturPoDropdown(poList, formData.nomorPO);

    const poSel = document.getElementById("pr-po-select");
    if (poSel) {
        poSel.addEventListener("change", async () => {
            const poId = poSel.value;
            if (!poId) { renderReturItemRows([]); calcReturTotals(); setReturSupplierPair("", ""); return; }
            try {
                const po = await services.getPembelian(poId);
                if (po && po.items) {
                    renderReturItemRows(po.items.map(i => ({
                        kode: i.kode, nama: i.nama, satuan: i.satuan || "",
                        qty: i.qty || 0, harga: i.harga || 0,
                        subtotal: (i.qty || 0) * (i.harga || 0)
                    })));
                }
                const opt = poSel.selectedOptions?.[0];
                if (opt) {
                    setReturSupplierPair(opt.dataset.supplier || "", opt.dataset.supplierName || "");
                }
            } catch (err) {
                showToast("danger", "Gagal memuat item PO: " + err.message);
            }
        });
    }

    // ── Tambah Item Barang (manual mode) ──
    document.getElementById("pr-add-item-btn")?.addEventListener("click", function prAddItemHandler() {
        const body = document.getElementById("pr-items-body");
        if (!body) return;
        const idx = document.querySelectorAll(".po-item-row").length;
        const emptyMsg = body.querySelector(".po-empty-items");
        if (emptyMsg) emptyMsg.remove();
        body.insertAdjacentHTML("beforeend", buildReturItemRow({ _manual: true, kode: "", nama: "", qty: 0, harga: 0, subtotal: 0 }, idx));
        initReturItemEvents();
        // Re-attach scanner agar tombol 📷 di baris baru berfungsi
        attachReturScanner();
        calcReturTotals();
    });

    // ── Scanner ──
    const scanContainerId = "pr-scanner-container";
    const scanSwitchId = "pr-btn-switch";
    const scanFlashId = "pr-scanner-flash";
    const scannerSection = document.getElementById(`scanner-section-${scanContainerId}`);
    if (!scannerSection) {
        const prItemsBody = document.getElementById("pr-items-body");
        if (prItemsBody) {
            prItemsBody.insertAdjacentHTML("beforebegin", scannerSectionHTML(scanContainerId, scanSwitchId, scanFlashId));
        }
    }

    let _prScanner = null;
    // Attach scanner events (will be called after each item add too)
    function attachReturScanner() {
        if (_prScanner) { _prScanner.destroy(); _prScanner = null; }
        _prScanner = attachScanner({
            containerId: scanContainerId,
            switchBtnId: scanSwitchId,
            flashId: scanFlashId,
            scanBtnSel: "[data-scan-index]",
            onScanDecoded: (idx, decodedText) => {
                const kodeInput = document.querySelector(`.pr-item-kode[data-index="${idx}"]`);
                if (kodeInput) {
                    kodeInput.value = decodedText;
                    // Trigger find & fill
                    const event = new Event("blur", { bubbles: true });
                    kodeInput.dispatchEvent(event);
                }
            }
        });
    }

    attachReturScanner();

    document.getElementById("pr-cancel")?.addEventListener("click", () => { if (_prScanner) _prScanner.destroy(); removeModal(overlay); });
    document.getElementById("pr-submit")?.addEventListener("click", () => { if (_prScanner) _prScanner.destroy(); handleReturSubmit(overlay, formData, isEdit ? id : null); });

    initReturItemEvents();
    calcReturTotals();

    // ── Override overlay close to also destroy scanner ──
    const origClose = overlay.close;
    if (typeof origClose === "function") {
        overlay.close = function() { if (_prScanner) _prScanner.destroy(); return origClose.apply(this, arguments); };
    }
}

function buildReturFormHTML(data, isEdit) {
    const itemRows = (data.items || []).map((item, idx) => buildReturItemRow(item, idx)).join("");
    return `
        <div class="po-form">
            ${isEdit ? `<div class="po-nomor-row">
                <div class="form-group" style="max-width:280px">
                    <label>No. Retur</label>
                    <input type="text" value="${esc(data.nomor)}" disabled />
                </div>
            </div>` : ""}
            <div class="po-form-row">
                <div class="form-group">
                    <label for="pr-tanggal">Tanggal</label>
                    <input type="date" id="pr-tanggal" value="${esc(data.tanggal)}" />
                </div>
                <div class="form-group" style="grid-column:span 2">
                    <label for="pr-mode">Mode Input <span class="required">*</span></label>
                    <select id="pr-mode" ${isEdit ? "disabled" : ""}>
                        <option value="po">📋 Berdasarkan PO</option>
                        <option value="manual">✏️ Input Manual</option>
                    </select>
                    <div id="pr-mode-hint" style="font-size:0.72rem;color:#9ca3af;margin-top:0.2rem">Pilih PO untuk memuat item otomatis, atau Manual untuk input item satu per satu.</div>
                </div>
            </div>
            <div id="pr-po-section" style="${isEdit ? '' : ''}">
            <div class="po-form-row">
                <div class="form-group" style="grid-column:span 2">
                    <label for="pr-po-select">Pilih PO (Dikonfirmasi/Diterima) <span class="required">*</span></label>
                    <select id="pr-po-select">
                        <option value="">— Pilih Purchase Order —</option>
                    </select>
                    <div style="font-size:0.72rem;color:#9ca3af;margin-top:0.2rem">Item barang akan dimuat otomatis dari PO yang dipilih.</div>
                </div>
            </div>
            </div>
            <div id="pr-supplier-section" style="display:none">
            <div class="po-form-row">
                <div class="form-group">
                    <label for="pr-supplier">Supplier (Kode)</label>
                    <select id="pr-supplier" disabled></select>
                </div>
                <div class="form-group">
                    <label for="pr-supplier-name">Supplier (Nama)</label>
                    <select id="pr-supplier-name" disabled></select>
                </div>
            </div>
            </div>

            <div class="po-section-title">📦 Item Retur</div>
            <div id="pr-mode-hint-items" style="font-size:0.75rem;color:#9ca3af;margin-bottom:0.5rem">(qty retur diisi manual, max = qty PO / stok)</div>
            <div class="pr-items-header">
                <span class="po-col-code">Kode</span>
                <span class="po-col-name">Nama Barang</span>
                <span class="po-col-qty">Qty PO</span>
                <span class="po-col-satuan">Satuan</span>
                <span class="po-col-price">Harga</span>
                <span class="po-col-qty">Qty Retur</span>
                <span class="po-col-subtotal">Subtotal</span>
            </div>
            <datalist id="pr-barang-list-${pageId}"></datalist>
            <datalist id="pr-nama-list-${pageId}"></datalist>
            <div id="pr-items-body">${itemRows}</div>
            <div class="po-add-item" id="pr-add-item-section" style="display:none">
                <button type="button" id="pr-add-item-btn" class="po-add-item-btn">➕ Tambah Item Barang</button>
            </div>

            <div class="po-totals">
                <div class="po-total-row po-grand-total">
                    <span>Total Retur</span>
                    <span id="pr-total-display">Rp 0</span>
                </div>
            </div>

            <div class="form-group">
                <label for="pr-catatan">Catatan / Alasan Retur</label>
                <textarea id="pr-catatan" rows="3" placeholder="Contoh: barang rusak, salah kirim, kadaluarsa...">${esc(data.catatan)}</textarea>
            </div>
        </div>
    `;
}

function buildReturItemRow(item, idx) {
    // Jika item tidak readonly (mode manual — punya kamera & tombol X), generate scanner button dan tombol hapus
    const isEditable = item._manual === true;
    const kodeHTML = isEditable
        ? `<span class="kode-scan-wrapper">
                <input type="text" class="pr-item-kode" value="${esc(item.kode)}" placeholder="Kode" list="pr-barang-list-${pageId}" data-index="${idx}" />
                ${scanButtonHTML(`data-scan-index="${idx}"`)}
           </span>`
        : `<input type="text" class="pr-item-kode" value="${esc(item.kode)}" readonly data-index="${idx}" />`;

    const namaReadonly = isEditable ? "" : "readonly";
    const hargaReadonly = isEditable ? "" : "readonly";
    const qtyPOReadonly = isEditable ? "" : "readonly";
    const removeBtn = isEditable
        ? `<button type="button" class="po-item-remove" data-index="${idx}" title="Hapus item">Tutup</button>`
        : "";
    const qtyPoVal = isEditable ? (item.stok !== undefined ? item.stok : (item.qty || 0)) : (item.qtyPo !== undefined ? item.qtyPo : (item.qty || 0));
    const qtyPoLabel = isEditable ? "Qty Stok" : "Qty PO";

    return `
        <div class="po-item-row pr-item-row" data-index="${idx}">
            <span class="po-col-code" data-label="Kode">${kodeHTML}</span>
            <span class="po-col-name" data-label="Nama Barang">
                <input type="text" class="pr-item-nama" value="${esc(item.nama)}" placeholder="Nama barang" list="pr-nama-list-${pageId}" ${namaReadonly} data-index="${idx}" />
            </span>
            <span class="po-col-qty" data-label="${qtyPoLabel}">
                <input type="text" inputmode="numeric" class="pr-item-qty-po" value="${esc(formatThousand(qtyPoVal))}" ${qtyPOReadonly} data-index="${idx}" />
            </span>
            <span class="po-col-satuan" data-label="Satuan">
                <input type="text" class="pr-item-satuan" value="${esc(item.satuan || '')}" readonly data-index="${idx}" />
            </span>
            <span class="po-col-price" data-label="Harga">
                <input type="text" inputmode="numeric" class="pr-item-harga" value="${esc(formatThousand(item.harga || 0))}" ${hargaReadonly} data-index="${idx}" />
            </span>
            <span class="po-col-qty" data-label="Qty Retur">
                <input type="text" inputmode="numeric" class="pr-item-qty" value="${esc(formatThousand(item.returQty !== undefined ? item.returQty : (item.qty || 0)))}" data-index="${idx}" />
            </span>
            <span class="po-col-subtotal" data-label="Subtotal">
                <input type="text" class="pr-item-subtotal" value="${esc(services.formatRupiah ? services.formatRupiah(item.subtotal || 0) : (item.subtotal || 0).toLocaleString())}" readonly data-index="${idx}" />
            </span>
            ${removeBtn}
        </div>
    `;
}

function populateReturPoDropdown(poList, selected) {
    const sel = document.getElementById("pr-po-select");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih Purchase Order —</option>`;
    for (const p of poList) {
        const pid = p._id || p.id || "";
        const name = p.nomor || pid;
        const supplierName = p.supplierName || p.supplier || "";
        sel.innerHTML += `<option value="${esc(pid)}" data-supplier="${esc(p.supplier || '')}" data-supplier-name="${esc(supplierName)}" ${name === selected ? "selected" : ""}>${esc(name)} - ${esc(supplierName)}</option>`;
    }
}

function renderReturItemRows(rows) {
    const body = document.getElementById("pr-items-body");
    if (!body) return;
    body.innerHTML = rows.length > 0
        ? rows.map((item, idx) => buildReturItemRow(item, idx)).join("")
        : '<div class="po-empty-items">Pilih PO terlebih dahulu untuk memuat item barang.</div>';
    initReturItemEvents();
    calcReturTotals();
}

function initReturItemEvents() {
    // ── Qty retur ──
    document.querySelectorAll(".pr-item-qty").forEach(inp => {
        inp.addEventListener("focus", () => { inp.value = String(unformatThousand(inp.value)); });
        inp.addEventListener("blur", () => { inp.value = formatThousand(unformatThousand(inp.value)); });
        inp.addEventListener("input", () => {
            inp.value = inp.value.replace(/\D/g, "");
            const idx = inp.dataset.index;
            const modeSel = document.getElementById("pr-mode");
            const isManual = modeSel?.value === "manual";
            const maxQty = unformatThousand(document.querySelector(`.pr-item-qty-po[data-index="${idx}"]`)?.value);
            let qty = unformatThousand(inp.value);
            if (qty > maxQty) {
                inp.value = formatThousand(maxQty);
                const label = isManual ? "stok" : "PO";
                showToast("warning", `Qty retur tidak boleh melebihi qty ${label} (${formatThousand(maxQty)})`);
            }
            recalcReturRow(idx);
        });
    });

    // ── Qty PO, Harga (manual mode: editable) ──
    document.querySelectorAll(".pr-item-qty-po, .pr-item-harga").forEach(inp => {
        if (inp.hasAttribute("readonly")) return;
        inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); });
        inp.addEventListener("focus", () => { inp.value = String(unformatThousand(inp.value)); });
        inp.addEventListener("blur", () => { inp.value = formatThousand(unformatThousand(inp.value)); });
        inp.addEventListener("input", () => recalcReturRow(inp.dataset.index));
        inp.addEventListener("change", () => recalcReturRow(inp.dataset.index));
    });

    // ── Remove button (manual mode) ──
    document.querySelectorAll(".po-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const row = btn.closest(".po-item-row");
            if (row) {
                row.remove();
                calcReturTotals();
            }
        });
    });

    // ── Kode & Nama auto-fill (manual mode) ──
    document.querySelectorAll(".pr-item-kode:not([readonly]), .pr-item-nama:not([readonly])").forEach(inp => {
        inp.addEventListener("blur", () => findAndFillReturBarang(inp));
    });
}

function findAndFillReturBarang(inputEl) {
    const val = inputEl.value.trim();
    if (!val) return;
    let barangs = [];
    try {
        const kodeList = document.getElementById(`pr-barang-list-${pageId}`);
        const namaList = document.getElementById(`pr-nama-list-${pageId}`);
        if (kodeList) {
            barangs = Array.from(kodeList.options).map(o => ({
                kode: o.value,
                nama: o.getAttribute("data-nama") || o.value,
                satuan: o.getAttribute("data-satuan") || "",
                harga_beli: parseInt(o.getAttribute("data-harga")) || 0,
                stok: parseInt(o.getAttribute("data-stok")) || 0
            }));
        }
        if (namaList && namaList.options.length > barangs.length) {
            barangs = Array.from(namaList.options).map(o => ({
                kode: o.getAttribute("data-kode") || o.value,
                nama: o.value,
                satuan: o.getAttribute("data-satuan") || "",
                harga_beli: parseInt(o.getAttribute("data-harga")) || 0,
                stok: parseInt(o.getAttribute("data-stok")) || 0
            }));
        }
    } catch {}
    const barang = barangs.find(b => b.kode === val || b.nama === val);
    if (!barang) return;
    const idx = inputEl.dataset.index;
    const kodeInput = document.querySelector(`.pr-item-kode[data-index="${idx}"]`);
    const namaInput = document.querySelector(`.pr-item-nama[data-index="${idx}"]`);
    const satuanInput = document.querySelector(`.pr-item-satuan[data-index="${idx}"]`);
    const hargaInput = document.querySelector(`.pr-item-harga[data-index="${idx}"]`);
    const qtyPoInput = document.querySelector(`.pr-item-qty-po[data-index="${idx}"]`);
    if (kodeInput && !kodeInput.readOnly) kodeInput.value = barang.kode || "";
    if (namaInput && !namaInput.readOnly) namaInput.value = barang.nama || "";
    if (satuanInput) satuanInput.value = barang.satuan || "";
    if (hargaInput && !hargaInput.readOnly) { hargaInput.value = formatThousand(barang.harga_beli || 0); recalcReturRow(idx); }
    // Isi Qty Stok otomatis untuk mode manual
    if (qtyPoInput && !qtyPoInput.readOnly) {
        qtyPoInput.value = formatThousand(barang.stok || 0);
    }
}

function recalcReturRow(idx) {
    const qty = unformatThousand(document.querySelector(`.pr-item-qty[data-index="${idx}"]`)?.value);
    const harga = unformatThousand(document.querySelector(`.pr-item-harga[data-index="${idx}"]`)?.value);
    const subtotalEl = document.querySelector(`.pr-item-subtotal[data-index="${idx}"]`);
    const subtotal = Math.max(0, qty * harga);
    if (subtotalEl) {
        subtotalEl.value = services.formatRupiah ? services.formatRupiah(subtotal) : subtotal.toLocaleString();
    }
    calcReturTotals();
}

function calcReturTotals() {
    let total = 0;
    document.querySelectorAll(".po-item-row").forEach(row => {
        const idx = row.dataset.index;
        const qty = unformatThousand(document.querySelector(`.pr-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.pr-item-harga[data-index="${idx}"]`)?.value);
        total += Math.max(0, qty * harga);
    });
    const totalEl = document.getElementById("pr-total-display");
    if (totalEl) totalEl.textContent = "Rp " + (services.formatRupiah ? services.formatRupiah(total) : total.toLocaleString());
}

// ═══════════════════════════════════════════════
//  Retur Pembelian — Submit / Status / Delete
// ═══════════════════════════════════════════════

async function handleReturSubmit(overlay, existingData, editId) {
    const modeSel = document.getElementById("pr-mode");
    const isManual = modeSel?.value === "manual";
    const poSel = document.getElementById("pr-po-select");
    const poId = poSel?.value || "";
    const tanggal = document.getElementById("pr-tanggal")?.value;
    const catatan = document.getElementById("pr-catatan")?.value || "";

    if (!isManual && !poId) {
        showToast("danger", "Pilih PO terlebih dahulu");
        return;
    }

    const rows = document.querySelectorAll(".po-item-row");
    const items = [];
    for (const row of rows) {
        const idx = row.dataset.index;
        const kode = document.querySelector(`.pr-item-kode[data-index="${idx}"]`)?.value.trim() || "";
        const nama = document.querySelector(`.pr-item-nama[data-index="${idx}"]`)?.value.trim() || "";
        const qty = unformatThousand(document.querySelector(`.pr-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.pr-item-harga[data-index="${idx}"]`)?.value);
        if (!kode && !nama) continue;
        if (qty <= 0) continue;
        items.push({ kode, nama, satuan: document.querySelector(`.pr-item-satuan[data-index="${idx}"]`)?.value?.trim() || "", qty, harga, subtotal: Math.max(0, qty * harga) });
    }

    if (items.length === 0) {
        showToast("danger", "Minimal 1 item dengan qty retur > 0");
        return;
    }

    const currentUser = getCurrentUserName() || "System";
    const opt = poSel?.selectedOptions?.[0];
    const payload = {
        tanggal: tanggal || new Date().toISOString(),
        nomorPO: isManual ? "(Manual)" : (opt?.textContent?.split(" - ")[0] || existingData.nomorPO || ""),
        idPO: isManual ? "" : poId,
        supplier: document.getElementById("pr-supplier")?.value || "",
        supplierName: document.getElementById("pr-supplier-name")?.value || "",
        items,
        catatan,
        createdBy: currentUser,
        mode: isManual ? "manual" : "po"
    };

    try {
        if (editId) {
            await services.updateReturPembelian(editId, payload);
            showToast("success", "Retur berhasil diperbarui");
        } else {
            await services.createReturPembelian(payload);
            showToast("success", "Retur berhasil dibuat");
        }
        removeModal(overlay);
        loadReturData();
    } catch (err) {
        showToast("danger", "Gagal menyimpan: " + err.message);
    }
}

async function updateReturStatus(id) {
    const item = returState.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-st">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-st">Ya, Konfirmasi</button>
    `;

    const overlay = Modal({
        open: true,
        title: "✅ Konfirmasi Retur",
        content: `<p>Yakin ingin mengonfirmasi retur <strong>${esc(name)}</strong>?</p><p style="font-size:0.85rem;color:#6b7280">Stok barang akan <strong>berkurang</strong> otomatis (barang kembali ke supplier).</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-st")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-st")?.addEventListener("click", async () => {
        try {
            await services.updateReturPembelianStatus(id, "returned");
            showToast("success", `Retur ${name} dikonfirmasi, stok berkurang`);
            removeModal(overlay);
            loadReturData();
        } catch (err) {
            showToast("danger", "Gagal update status: " + err.message);
        }
    });
}

function confirmReturDelete(id) {
    const item = returState.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;
    const isReturned = item?.status === "returned";

    let msg = `Yakin ingin menghapus retur <strong>${esc(name)}</strong>? Tindakan ini tidak bisa dibatalkan.`;
    if (isReturned) msg += " Stok akan dikembalikan (reversal).";

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-del">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-del" style="background:#dc2626">Ya, Hapus</button>
    `;

    const overlay = Modal({
        open: true,
        title: "🗑️ Hapus Retur",
        content: `<p>${msg}</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-del")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-del")?.addEventListener("click", async () => {
        try {
            await services.deleteReturPembelian(id);
            showToast("success", `Retur ${name} berhasil dihapus`);
            removeModal(overlay);
            loadReturData();
        } catch (err) {
            showToast("danger", "Gagal menghapus: " + err.message);
        }
    });
}

// ═══════════════════════════════════════════════
//  Retur Pembelian — Print (Normal + Thermal)
// ═══════════════════════════════════════════════

async function printRetur(id) {
    let item = returState.items.find(i => (i._id || i.id) === id);
    if (!item) {
        try { item = await services.getReturPembelian(id); } catch { item = null; }
    }
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-retur-thermal">🧾 Cetak Struk Thermal</button>
        <button class="smart-btn smart-db-primary" id="f-retur-normal">📄 Cetak Normal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "🖨️ Cetak Nota Retur",
        content: `<p>Pilih format cetak untuk Nota Retur <strong>${esc(item.nomor)}</strong></p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-retur-thermal")?.addEventListener("click", () => { removeModal(overlay); printReturThermal(item); });
    document.getElementById("f-retur-normal")?.addEventListener("click", () => { removeModal(overlay); printReturNormal(item); });
}

async function printReturNormal(item) {
    const company = await getCompanyInfo();
    const logoUrl = company.logo || "";
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";

    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.nomor, { width: 180, margin: 1, color: { dark: "#1e293b", light: "#ffffff" } });
    } catch (e) { console.warn("[Pembelian] Retur QR generation failed:", e); }

    const itemsHTML = (item.items || []).map((i, idx) => `
        <tr>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.kode)}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${i.qty}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.satuan || '-')}</td>
            <td style="text-align:right;padding:6px 8px;border:1px solid #e2e8f0;">${services.formatRupiah ? services.formatRupiah(i.harga) : i.harga.toLocaleString()}</td>
            <td style="text-align:right;padding:6px 8px;border:1px solid #e2e8f0;">${services.formatRupiah ? services.formatRupiah(i.subtotal) : i.subtotal.toLocaleString()}</td>
        </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nota Retur Pembelian - ${esc(item.nomor)}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; padding:40px; background:#f1f5f9; }
        .invoice-wrap { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
        .invoice-header { padding:32px 40px 12px 40px; border-bottom:3px solid #dc2626; display:flex; justify-content:space-between; align-items:flex-start; }
        .invoice-header-left { display:flex; align-items:flex-start; gap:16px; }
        .invoice-logo { height:60px; width:auto; max-width:100px; object-fit:contain; }
        .invoice-logo-placeholder { width:48px; height:60px; background:#fef2f2; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:700; color:#dc2626; }
        .invoice-company-name { font-size:1.2rem; font-weight:700; color:#1e293b; }
        .invoice-company-detail { font-size:0.8rem; color:#64748b; line-height:1.5; padding-bottom:2px; }
        .invoice-title-block { text-align:right; }
        .invoice-title { font-size:1.6rem; font-weight:800; color:#dc2626; letter-spacing:1px; }
        .invoice-po-num { font-size:0.9rem; color:#64748b; margin-top:2px; }
        .invoice-body { padding:28px 40px; }
        .invoice-info-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; margin-bottom:24px; background:#f8fafc; border-radius:8px; padding:12px 16px; }
        .invoice-info-label { font-size:0.7rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
        .invoice-info-value { font-size:0.9rem; font-weight:500; color:#1e293b; }
        .invoice-table { width:100%; border-collapse:collapse; margin-bottom:20px; }
        .invoice-table th { background:#f1f5f9; padding:8px 10px; border:1px solid #e2e8f0; font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.3px; }
        .invoice-table td { font-size:0.85rem; }
        .invoice-totals { margin-left:auto; width:300px; }
        .invoice-total-row { display:flex; justify-content:space-between; padding:5px 0; font-size:0.85rem; color:#475569; }
        .invoice-total-row.total { border-top:2px solid #dc2626; padding-top:8px; margin-top:4px; font-weight:700; font-size:1rem; color:#1e293b; }
        .invoice-bottom { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-top:24px; }
        .invoice-qr { flex-shrink:0; text-align:center; }
        .invoice-qr img { width:90px; height:90px; display:block; border:1px solid #e2e8f0; border-radius:6px; padding:4px; background:#fff; }
        .invoice-qr-label { font-size:0.65rem; color:#94a3b8; margin-top:4px; letter-spacing:0.3px; white-space:nowrap; }
        .invoice-bottom-center { flex:1; min-width:0; }
        @media print { body { background:#fff; padding:0; } .invoice-wrap { box-shadow:none; border-radius:0; } }
        @page { margin:0; }
        @media (max-width:600px) {
            body { padding:16px; }
            .invoice-header { flex-direction:column; text-align:center; gap:12px; padding:20px 20px 12px 20px; }
            .invoice-title-block { text-align:center; }
            .invoice-header-left { flex-direction:column; align-items:center; }
            .invoice-info-grid { grid-template-columns:1fr 1fr; }
            .invoice-totals { width:100%; }
            .invoice-bottom { flex-direction:column; align-items:stretch; gap:16px; }
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
                <div class="invoice-title">NOTA RETUR PEMBELIAN</div>
                <div class="invoice-po-num">${esc(item.nomor)}</div>
            </div>
        </div>
        <div class="invoice-body">
            <div class="invoice-info-grid">
                <div class="invoice-info-item"><div class="invoice-info-label">Supplier</div><div class="invoice-info-value">${esc(item.supplierName || item.supplier || '-')}</div></div>
                <div class="invoice-info-item"><div class="invoice-info-label">Tanggal</div><div class="invoice-info-value">${formatDate(item.tanggal)}</div></div>
                <div class="invoice-info-item"><div class="invoice-info-label">No. PO</div><div class="invoice-info-value">${esc(item.nomorPO || '-')}</div></div>
                <div class="invoice-info-item"><div class="invoice-info-label">Status</div><div class="invoice-info-value">${item.status === 'returned' ? 'Dikembalikan' : 'Draft'}</div></div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width:36px">No</th>
                        <th style="width:90px">Kode</th>
                        <th>Nama Barang</th>
                        <th style="width:40px">Qty</th>
                        <th style="width:60px">Satuan</th>
                        <th style="width:90px">Harga</th>
                        <th style="width:100px">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>

            <div class="invoice-bottom">
                <div class="invoice-qr">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" width="90" height="90" />` : `<div style="width:90px;height:90px;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#94a3b8;background:#f8fafc">QR</div>`}
                    <div class="invoice-qr-label">Scan untuk verifikasi</div>
                </div>
                ${item.catatan ? `<div class="invoice-bottom-center"><div style="padding:12px 16px;background:#fef2f2;border-radius:8px;font-size:0.82rem;color:#991b1b;border-left:3px solid #dc2626"><strong>Alasan Retur:</strong><br/>${esc(item.catatan)}</div></div>` : ""}
                <div class="invoice-totals">
                    <div class="invoice-total-row total">
                        <span>Total Retur</span>
                        <span>Rp ${services.formatRupiah ? services.formatRupiah(item.total || 0) : (item.total || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script>window.print();<\/script>
</body>
</html>`;

    printToWindow(html, "mencetak Nota Retur", false);
}

async function printReturThermal(item) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyPhone = company.phone || "";
    const logoUrl = company.logo || "";

    const itemsHTML = (item.items || []).map(i => `
        <tr>
            <td style="padding:2px 0;font-size:9px;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:2px 0;font-size:9px;">${i.qty}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${services.formatRupiah ? services.formatRupiah(i.subtotal) : i.subtotal.toLocaleString()}</td>
        </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Retur Pembelian - ${esc(item.nomor)}</title>
<style>
    @page { margin:0; size:80mm auto; }
    body { font-family:'Courier New',Courier,monospace; margin:0; padding:4mm; width:72mm; color:#000; font-size:9px; line-height:1.3; }
    .header { text-align:center; margin-bottom:4px; }
    .header img { max-width:60px; max-height:40px; }
    .header .name { font-size:11px; font-weight:bold; }
    .header .title { font-size:12px; font-weight:bold; margin-top:2px; }
    .divider { border-top:1px dashed #000; margin:3px 0; }
    .info { font-size:8px; margin-bottom:3px; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:8px; border-bottom:1px solid #000; padding:2px 0; }
    td { font-size:9px; padding:2px 0; }
    .total { text-align:right; font-size:10px; font-weight:bold; margin-top:3px; }
    .footer { text-align:center; font-size:8px; margin-top:6px; }
    @media print { body { width:72mm; } }
</style></head>
<body>
    <div class="header">
        ${logoUrl ? `<img src="${esc(logoUrl)}" />` : ""}
        <div class="name">${esc(companyName)}</div>
        <div class="title">NOTA RETUR PEMBELIAN</div>
    </div>
    <div class="divider"></div>
    <div class="info">
        No: ${esc(item.nomor)}<br/>
        Tanggal: ${formatDate(item.tanggal)}<br/>
        PO: ${esc(item.nomorPO || '-')}<br/>
        Supplier: ${esc(item.supplierName || item.supplier || '-')}
    </div>
    <div class="divider"></div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${itemsHTML}</tbody></table>
    <div class="divider"></div>
    <div class="total">Total: Rp ${services.formatRupiah ? services.formatRupiah(item.total || 0) : (item.total || 0).toLocaleString()}</div>
    ${item.catatan ? `<div style="font-size:8px;margin-top:3px;">Alasan: ${esc(item.catatan)}</div>` : ""}
    <div class="divider"></div>
    ${companyPhone ? `<div style="text-align:center;font-size:8px;">Info: ${esc(companyPhone)}</div>` : ""}
    <div class="footer">Terima Kasih</div>
    <script>window.print();window.close();<\\/script>
</body></html>`;

    printToWindow(html);
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

        /* Tabs */
        .pd-tabs { display:flex; gap:0; margin-bottom:1.25rem; border-bottom:2px solid #e5e7eb; }
        .pd-tab { padding:0.65rem 1.25rem; cursor:pointer; border:none; background:none; font-size:0.92rem; font-weight:600; color:#6b7280; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.2s; }
        .pd-tab:hover { color:#4f46e5; }
        .pd-tab.active { color:#4f46e5; border-bottom-color:#4f46e5; }

        /* Retur items header */
        .pr-items-header { display:grid; grid-template-columns:101px 180px 50px 60px 80px 70px 120px auto; gap:0.25rem; padding:0.25rem 0; font-size:0.75rem; font-weight:600; color:#6b7280; border-bottom:1px solid #e2e8f0; }
        @media (max-width:768px) { .pr-items-header { display:none; } }

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
        .po-nomor-row { margin-bottom: 0.75rem; }
        .po-form-row { display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 0.75rem; margin-bottom: 1rem; }
        .po-section-title { font-weight: 600; margin: 0.75rem 0 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid #e2e8f0; }



        .po-items-header { display: grid; grid-template-columns: 101px 180px 50px 60px 80px 70px 120px auto; gap: 0.25rem; padding: 0.25rem 0; font-size: 0.75rem; font-weight: 600; color: #6b7280; border-bottom: 1px solid #e2e8f0; }
        .po-item-row { display: grid; grid-template-columns: 101px 180px 50px 60px 80px 70px 120px; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; position: relative; }
        .po-item-row input { width: 100%; padding: 0.35rem 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.8rem; box-sizing: border-box; }
        .po-col-qty input, .po-col-price input { text-align: right; }
        .po-col-subtotal { display: flex; align-items: center; gap: 0.2rem; }
        .po-item-remove { padding: 0.1rem 0.35rem; border: none; background: #fee2e2; color: #dc2626; cursor: pointer; font-size: 0.75rem; line-height: 1.2; flex-shrink: 0; font-weight: 600; position: absolute; right: calc(0.4rem - 5px); top: 50%; transform: translateY(-50%); border-radius: 4px; white-space: nowrap; }
        .po-item-remove:hover { background: #fecaca; }
        /* Desktop: tombol Tutup di kolom ke-8, tepat setelah kolom Subtotal (PO & Retur) */
        .po-item-row:has(.po-item-remove) { grid-template-columns: 101px 180px 50px 60px 80px 70px 120px auto; }
        .po-item-row .po-item-remove { position: static; top: auto; right: auto; transform: none; justify-self: start; }
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
            .pembelian-page .page-header { flex-direction: column; align-items: stretch; gap: 0.5rem; }
            .pembelian-page .page-header .page-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: nowrap; justify-content: flex-end; min-width: 0; }
            .pembelian-page .search-wrapper { max-width: 70%; }
            .pembelian-page .search-wrapper input { width: 100%; padding: 0.45rem 0.75rem 0.45rem 2rem; font-size: 0.8rem; box-sizing: border-box; }
            .pembelian-page .smart-btn { font-size: 0.8rem; padding: 0.45rem 0.75rem; white-space: nowrap; flex-shrink: 0; }

            .po-form-row { grid-template-columns: 1fr; }
            .po-items-header { display: none; }
            .po-item-row { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem; margin-bottom: 0.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; position: relative; }
            .po-item-row input { width: 100%; box-sizing: border-box; }
            .po-item-row > span { display: flex; align-items: center; gap: 0.35rem; }
            .po-item-row > span[data-label]:not([data-label=""])::before { content: attr(data-label); font-size: 0.7rem; font-weight: 600; color: #6b7280; min-width: 70px; flex-shrink: 0; }
            .po-col-qty input, .po-col-price input { text-align: left; }
            /* Kode: ikon kamera pindah ke KANAN-ATAS kolom isian, field menyamai Nama Barang */
            .po-item-row:has(.btn-scan) .po-col-code { position: relative; padding-top: 1.7rem; padding-left: 0; }
            .po-item-row:has(.btn-scan) .po-col-code .kode-scan-wrapper { flex: 1; margin-right: 0; padding-left: 0; }
            .po-item-row:has(.btn-scan) .po-col-code .btn-scan { position: absolute; top: 0.05rem; right: 0; margin-left: 0; z-index: 1; padding: 0.2rem 0.45rem; }
            /* Subtotal: field = input readonly IDENTIK dengan field lain; tombol Tutup di bawah card */
            .po-item-row:has(.po-item-remove) { padding-bottom: 2.3rem; }
            .po-item-row .po-item-remove { position: absolute; right: 0.15rem; bottom: 0.15rem; top: auto; transform: none; font-size: 0.9rem; padding: 0.2rem 0.45rem; border-radius: 6px; background: #fee2e2; color: #dc2626; z-index: 1; font-weight: 700; }
            .po-detail-header { grid-template-columns: 1fr; }
        }

        /* Scanner integration */
        .kode-scan-wrapper { display:flex; align-items:center; padding-left:1px; gap:0.25rem; }
        .kode-scan-wrapper input { flex:1; min-width:0; }
        .btn-scan { padding:0.35rem 0.4rem; border:1px solid #d1d5db; border-radius:4px; background:#f8fafc; cursor:pointer; font-size:0.8rem; transition:all 0.15s; white-space:nowrap; display:inline-flex; align-items:center; gap:0.2rem; line-height:1; flex-shrink:0; margin-left:auto; }
        .btn-scan:hover { background:#eef2ff; border-color:#c7d2fe; }
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
        listWarehouse: deps.listWarehouse || (async () => ({ data: [] })),
        listReturPembelian: deps.listReturPembelian || (async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
        getReturPembelian: deps.getReturPembelian || (async () => null),
        createReturPembelian: deps.createReturPembelian || (async () => { throw new Error("createReturPembelian not configured"); }),
        updateReturPembelian: deps.updateReturPembelian || (async () => { throw new Error("updateReturPembelian not configured"); }),
        deleteReturPembelian: deps.deleteReturPembelian || (async () => { throw new Error("deleteReturPembelian not configured"); }),
        updateReturPembelianStatus: deps.updateReturPembelianStatus || (async () => { throw new Error("updateReturPembelianStatus not configured"); }),
        formatRupiah: deps.formatRupiah || ((v) => `Rp ${(v || 0).toLocaleString("id-ID")}`),
        getCompanyInfo: deps.getCompanyInfo || null
    };

    return {
        PembelianPage,
        initPembelianPage
    };
}
