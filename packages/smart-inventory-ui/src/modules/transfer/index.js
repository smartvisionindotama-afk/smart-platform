/**
 * Transfer Module — Stock Transfer Antar Gudang.
 *
 * Simple module mirip Penjualan, tanpa harga, hanya qty.
 * Gudang asal → gudang tujuan, validasi stok, cetak tiket dengan TTD.
 *
 * DI yang dibutuhkan:
 *   listTransfer, getTransfer, createTransfer, updateTransfer,
 *   deleteTransfer, updateTransferStatus,
 *   listWarehouse, listBarang,
 *   getCompanyInfo — async function() => { name, address, phone, email, logo, ... }
 *
 * @module @smart/inventory-ui/modules/transfer
 */

import { Modal, Table, Pagination, EmptyState, Alert, showToast, UI, printToWindow } from "@smart/ui";
import { scannerSectionHTML, scanButtonHTML } from "@smart/ui";
import QRCode from "qrcode";

let services = {};

export function TransferModule(deps = {}) {
    services = deps;

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

// Stock & gudang lookup: kode barang → stok saat ini, gudang tempat barang berada
let _barangStockMap = {};
let _barangGudangMap = {};

// Complete + filtered barang list (filtered by selected source gudang)
let _allBarangs = [];
let _filteredBarangs = [];

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/\\\"/g, "&quot;")
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

function formatDateID(date) {
    if (!date) return "-";
    const d = new Date(date);
    const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function statusBadgeHTML(status) {
    const map = {
        "draft":       { label: "Draft",       cls: "tf-status-draft" },
        "transferred": { label: "Ditransfer",  cls: "tf-status-done" }
    };
    const s = map[status] || { label: status, cls: "" };
    return `<span class="tf-status-badge ${s.cls}">${s.label}</span>`;
}

function canEdit(status) { return status === "draft"; }
function canTransfer(status) { return status === "draft"; }

const pageId = "transfer-page";

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ═══════════════════════════════════════════════
//  Page HTML
// ═══════════════════════════════════════════════

function TransferPage() {
    return `
        <div id="${pageId}" class="transfer-page">
            <style>${getStyles()}</style>
            <div class="page-header">
                <div>
                    <h1>🚚 Transfer Stok</h1>
                    <div class="header-subtitle">Pindahkan stok barang antar gudang</div>
                </div>
                <div class="page-actions">
                    <div class="search-wrapper">
                        <span class="search-icon">🔍</span>
                        <input type="text" id="tf-search-input" placeholder="Cari no. transfer, gudang..." autocomplete="off" />
                    </div>
                </div>
            </div>
            <div id="tf-table-area">
                <table class="tf-table">
                    <thead>
                        <tr>
                            <th>No. Transfer</th>
                            <th>Tanggal</th>
                            <th>Dari Gudang</th>
                            <th>Ke Gudang</th>
                            <th>Item</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="tf-table-body"></tbody>
                </table>
            </div>
            <div id="tf-card-area" class="tf-card-view" style="display:none"></div>
            <div id="tf-pagination"></div>
            <div id="tf-empty-state"></div>
            <div id="tf-loading" class="tf-loading" style="display:none">Memuat...</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════

function initTransferPage() {
    state.items = [];
    state.pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
    state.search = "";
    state.loading = false;
    state.editingId = null;

    const searchInput = document.getElementById("tf-search-input");
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
        addBtn.innerHTML = "➕ Buat Transfer";
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
    const loadingEl = document.getElementById("tf-loading");
    const emptyEl = document.getElementById("tf-empty-state");
    const tableArea = document.getElementById("tf-table-area");
    const cardArea = document.getElementById("tf-card-area");
    const paginationEl = document.getElementById("tf-pagination");

    if (!tableArea) return;
    state.loading = true;
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.innerHTML = "";

    try {
        const result = await services.listTransfer({
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
                    icon: "🚚",
                    title: state.search ? "Pencarian tidak ditemukan" : "Belum ada Transfer",
                    description: state.search ? "Coba kata kunci lain" : "Buat transfer untuk memindahkan stok antar gudang",
                    actionText: state.search ? "Reset Pencarian" : "Buat Transfer",
                    onAction: state.search ? () => { state.search = ""; const inp = document.getElementById("tf-search-input"); if (inp) inp.value = ""; loadData(); } : () => openForm("create")
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
        console.error("[Transfer] loadData failed:", err);
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) {
            emptyEl.innerHTML = `<div class="tf-error">Gagal memuat data: ${esc(err.message)}</div>`;
        }
    }
}

// ═══════════════════════════════════════════════
//  Desktop Table
// ═══════════════════════════════════════════════

function renderTable() {
    const tbody = document.getElementById("tf-table-body");
    if (!tbody) return;
    tbody.innerHTML = state.items.map(item => {
        return `
            <tr>
                <td><strong>${esc(item.nomor)}</strong></td>
                <td>${formatDate(item.tanggal)}</td>
                <td>${esc(item.gudangAsalNama || item.gudangAsal)}</td>
                <td>${esc(item.gudangTujuanNama || item.gudangTujuan)}</td>
                <td style="text-align:center">${(item.items || []).length}</td>
                <td>${statusBadgeHTML(item.status)}</td>
                <td>
                    <div class="tf-mgmt-actions">
                        <button class="tf-action-btn tf-action-print" data-action="print" data-id="${item._id || item.id}" title="Cetak Tiket Transfer">🖨️</button>
                        ${canEdit(item.status) ? `<button class="tf-action-btn tf-action-edit" data-action="edit" data-id="${item._id || item.id}" title="Edit">✏️</button>` : ""}
                        ${canTransfer(item.status) ? `<button class="tf-action-btn tf-action-transfer" data-action="transfer" data-id="${item._id || item.id}" title="Eksekusi Transfer">✅ Transfer</button>` : ""}
                        <button class="tf-action-btn tf-action-delete" data-action="delete" data-id="${item._id || item.id}" title="Hapus">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    tbody.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === "print") printTiket(id);
            else if (action === "edit") openForm("edit", id);
            else if (action === "delete") confirmDelete(id);
            else if (action === "transfer") executeTransfer(id);
        });
    });
}

// ═══════════════════════════════════════════════
//  Mobile Card View
// ═══════════════════════════════════════════════

function renderCards() {
    const cardArea = document.getElementById("tf-card-area");
    if (!cardArea) return;
    cardArea.innerHTML = "";
    const list = UI.CardList(state.items, (item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${esc(item.nomor)}</div>
            <div class="sm-card-desc">${formatDate(item.tanggal)}</div>
        </div>
        <div class="sm-card-details">
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Dari</span>
                <span class="sm-card-value">${esc(item.gudangAsalNama || item.gudangAsal)}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Ke</span>
                <span class="sm-card-value">${esc(item.gudangTujuanNama || item.gudangTujuan)}</span>
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
                ${canTransfer(item.status) ? `<button class="sm-card-btn sm-card-btn-primary" data-tf-transfer="${item._id || item.id}">✅ Transfer</button>` : ""}
                ${canEdit(item.status) ? `<button class="sm-card-btn sm-card-btn-edit" data-tf-edit="${item._id || item.id}">✏️ Edit</button>` : ""}
                <button class="sm-card-btn sm-card-btn-invoice" data-tf-print="${item._id || item.id}">🖨️</button>
                <button class="sm-card-btn sm-card-btn-delete" data-tf-delete="${item._id || item.id}">🗑️</button>
            </div>
        </div>
    `);
    cardArea.appendChild(list);

    cardArea.querySelectorAll("[data-tf-edit]").forEach(btn => btn.addEventListener("click", () => openForm("edit", btn.dataset.tfEdit)));
    cardArea.querySelectorAll("[data-tf-delete]").forEach(btn => btn.addEventListener("click", () => confirmDelete(btn.dataset.tfDelete)));
    cardArea.querySelectorAll("[data-tf-print]").forEach(btn => btn.addEventListener("click", () => printTiket(btn.dataset.tfPrint)));
    cardArea.querySelectorAll("[data-tf-transfer]").forEach(btn => btn.addEventListener("click", () => executeTransfer(btn.dataset.tfTransfer)));
}

// ═══════════════════════════════════════════════
//  Responsive Toggle
// ═══════════════════════════════════════════════

function toggleView() {
    const tableArea = document.getElementById("tf-table-area");
    const cardArea = document.getElementById("tf-card-area");
    if (!tableArea || !cardArea) return;
    const isMobile = window.innerWidth < 768;
    tableArea.style.display = isMobile ? "none" : "";
    cardArea.style.display = isMobile ? "block" : "none";
}

// ═══════════════════════════════════════════════
//  Pagination
// ═══════════════════════════════════════════════

function renderPagination() {
    const el = document.getElementById("tf-pagination");
    if (!el) return;
    if (state.pagination.totalPages <= 1) { el.innerHTML = ""; return; }
    el.innerHTML = "";
    el.appendChild(Pagination({
        currentPage: state.pagination.page,
        totalPages: state.pagination.totalPages,
        total: state.pagination.total,
        onChange: (page) => { state.pagination.page = page; loadData(); }
    }));
}

// ═══════════════════════════════════════════════
//  Form Modal (Create / Edit)
// ═══════════════════════════════════════════════

async function openForm(mode, id) {
    const isEdit = mode === "edit" && id;
    let formData = {
        tanggal: new Date().toISOString().split("T")[0],
        gudangAsal: "", gudangAsalNama: "",
        gudangTujuan: "", gudangTujuanNama: "",
        items: [], catatan: "", nomor: ""
    };

    if (isEdit) {
        try {
            const item = await services.getTransfer(id);
            if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
            formData = {
                tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split("T")[0] : "",
                gudangAsal: item.gudangAsal || "", gudangAsalNama: item.gudangAsalNama || "",
                gudangTujuan: item.gudangTujuan || "", gudangTujuanNama: item.gudangTujuanNama || "",
                items: (item.items || []).map(i => ({ ...i })),
                catatan: item.catatan || "", nomor: item.nomor || ""
            };
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
            return;
        }
    }

    const title = isEdit ? `✏️ Edit Transfer: ${formData.nomor}` : "🚚 Buat Transfer Baru";
    const contentHTML = buildFormHTML(formData, isEdit);
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-submit">${isEdit ? "Simpan" : "Buat Transfer"}</button>
    `;

    const overlay = Modal({ open: true, title, content: contentHTML, footer: footerHTML, closable: true, onClose: () => removeModal(overlay) });
    document.body.appendChild(overlay);
    overlay.querySelector(".smart-modal-dialog")?.classList.add("modal-lg");

    // Fetch warehouses & barangs
    let warehouses = [], barangs = [];
    try {
        try {
            const whRes = await services.listWarehouse({ page: 1, limit: 999 });
            warehouses = whRes.data || [];
        } catch {}
        try {
            const brgRes = await services.listBarang({ page: 1, limit: 999 });
            barangs = brgRes.data || [];
        } catch {}
    } catch (err) {
        console.warn("[Transfer] Fetch error:", err);
    }

    // Hapus BUILD stok maps + datalist — sekarang ditangani filterBarangsByGudang()
    populateWhDropdown("f-gudang-asal", warehouses, formData.gudangAsal);
    populateWhDropdown("f-gudang-tujuan", warehouses, formData.gudangTujuan);
    renderItemRows(barangs, formData.items);

    // Build stock & gudang maps for validation — akan di-override oleh filterBarangsByGudang()
    _barangStockMap = {};
    _barangGudangMap = {};
    for (const b of barangs) {
        _barangStockMap[b.kode] = Number(b.stok) || 0;
        _barangGudangMap[b.kode] = b.gudang || "";
    }

    const kodeList = document.getElementById(`tf-barang-list-${pageId}`);
    const namaList = document.getElementById(`tf-nama-list-${pageId}`);
    if (kodeList) {
        kodeList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan)}" data-stok="${Number(b.stok) || 0}" data-gudang="${esc(b.gudang || '')}">${esc(b.nama)}</option>`
        ).join("");
    }
    if (namaList) {
        namaList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-satuan="${esc(b.satuan)}" data-stok="${Number(b.stok) || 0}" data-gudang="${esc(b.gudang || '')}">${esc(b.kode)}</option>`
        ).join("");
    }

    // Store all barangs + filter by selected gudang
    _allBarangs = barangs;
    const initialGudang = formData.gudangAsalNama || formData.gudangAsal || "";
    filterBarangsByGudang(initialGudang);

    // Ketika gudang asal berubah, filter ulang barang + bersihkan item dari gudang lain
    document.getElementById("f-gudang-asal")?.addEventListener("change", function() {
        const gudangNama = this.selectedOptions?.[0]?.getAttribute("data-name") || this.value || "";
        filterBarangsByGudang(gudangNama);

        // Hapus item rows yang barangnya tidak ada di gudang asal yang baru
        document.querySelectorAll(".tf-item-row").forEach(row => {
            const kode = row.querySelector(".tf-item-kode")?.value?.trim();
            const nama = row.querySelector(".tf-item-nama")?.value?.trim();
            if (kode || nama) {
                const barangExists = _filteredBarangs.find(b =>
                    (b.kode === kode || b.nama === nama) && (b.gudang || "") === gudangNama
                );
                if (!barangExists) {
                    row.remove();
                }
            }
        });
        reindexRows();

        if (!gudangNama && _filteredBarangs.length === 0) {
            showToast("info", "Pilih gudang asal terlebih dahulu untuk melihat daftar barang");
        }
    });

    const activeBarangs = _filteredBarangs.length > 0 ? _filteredBarangs : _allBarangs;
    initItemRowEvents(activeBarangs);
    attachAddItemBtn(activeBarangs);
    let scannerCleanup = initScanner();

    document.getElementById("f-cancel")?.addEventListener("click", () => { if (typeof scannerCleanup === "function") scannerCleanup(); removeModal(overlay); });
    document.getElementById("f-submit")?.addEventListener("click", () => { if (typeof scannerCleanup === "function") scannerCleanup(); handleSubmit(overlay, formData, isEdit ? id : null); });

    function initScanner() {
        const itemsBody = document.getElementById("tf-items-body");
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
                const kodeInput = document.querySelector(`.tf-item-kode[data-index="${activeScanIndex}"]`);
                if (kodeInput) {
                    kodeInput.value = decodedText.trim();
                    kodeInput.dispatchEvent(new Event("blur", { bubbles: true }));
                    showToast("success", `✅ Kode: ${decodedText.trim()}`);
                }
            }
            setTimeout(() => stopScanner(), 400);
        }

        async function startScanner() {
            const section = document.getElementById("scanner-section-scanner-transfer");
            if (!section) return;
            section.style.display = "block"; section.classList.add("active");
            try {
                scannerInstance = new UI.BarcodeScanner("scanner-transfer", { onScan: onScanSuccess, fps: 10 });
                await scannerInstance.start();
            } catch { stopScanner(); showToast("warning", "Kamera tidak tersedia. Silakan ketik kode manual."); }
        }

        function stopScanner() {
            if (scannerInstance) { scannerInstance.destroy(); scannerInstance = null; }
            const section = document.getElementById("scanner-section-scanner-transfer");
            if (section) { section.classList.remove("active"); section.style.display = "none"; }
            activeScanIndex = -1;
        }

        function toggleScanner(index) {
            const section = document.getElementById("scanner-section-scanner-transfer");
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
            const flash = document.getElementById("scanner-flash-transfer");
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

        document.getElementById("btn-switch-transfer")?.addEventListener("click", switchCamera);

        return () => { stopScanner(); };
    }
}

function buildFormHTML(data, isEdit) {
    const itemRows = (data.items || []).map((item, idx) => buildItemRow(item, idx)).join("");
    return `
        <div class="tf-form">
            ${isEdit ? `<div class="tf-nomor-row">
                <div class="form-group" style="max-width:280px">
                    <label>No. Transfer</label>
                    <input type="text" value="${esc(data.nomor)}" disabled />
                </div>
            </div>` : ""}
            <div class="tf-form-row">
                <div class="form-group">
                    <label for="f-tanggal">Tanggal</label>
                    <input type="date" id="f-tanggal" value="${esc(data.tanggal)}" />
                </div>
                <div class="form-group">
                    <label for="f-gudang-asal">Dari Gudang <span class="required">*</span></label>
                    <select id="f-gudang-asal"><option value="">— Pilih —</option></select>
                </div>
                <div class="form-group">
                    <label for="f-gudang-tujuan">Ke Gudang <span class="required">*</span></label>
                    <select id="f-gudang-tujuan"><option value="">— Pilih —</option></select>
                </div>
            </div>

            ${scannerSectionHTML(
                'scanner-transfer',
                'btn-switch-transfer',
                'scanner-flash-transfer'
            )}
            <div class="tf-section-title">📦 Item Barang</div>
            <div class="tf-items-header">
                <span class="tf-col-code">Kode</span>
                <span class="tf-col-name">Nama Barang</span>
                <span class="tf-col-qty">Qty</span>
                <span class="tf-col-satuan">Satuan</span>
                <span class="tf-col-action"></span>
            </div>
            <div id="tf-items-body">${itemRows || '<div class="tf-empty-items">Belum ada item.</div>'}</div>
            <datalist id="tf-barang-list-${pageId}"></datalist>
            <datalist id="tf-nama-list-${pageId}"></datalist>
            <div class="tf-add-item">
                <button type="button" id="tf-add-item-btn" class="tf-add-item-btn">➕ Tambah Item</button>
            </div>

            <div class="form-group" style="margin-top:1rem">
                <label for="f-catatan">Catatan</label>
                <textarea id="f-catatan" rows="2" placeholder="Catatan transfer (opsional)">${esc(data.catatan)}</textarea>
            </div>
        </div>
    `;
}

/** Format angka ribuan Indonesia: 15000 → "15.000" */
function formatThousand(v) {
    const n = Math.round(Number(v) || 0);
    return n.toLocaleString("id-ID");
}

/** Parsing balik: "15.000" → 15000 (buang semua non-digit) */
function unformatThousand(v) {
    const cleaned = String(v ?? "").replace(/\D/g, "");
    return parseInt(cleaned, 10) || 0;
}

function buildItemRow(item, idx) {
    return `
        <div class="tf-item-row" data-index="${idx}">
            <span class="tf-col-code" data-label="Kode">
                <span class="kode-scan-wrapper">
                    <input type="text" class="tf-item-kode" value="${esc(item.kodeBarang || item.kode || "")}" placeholder="Kode" list="tf-barang-list-${pageId}" data-index="${idx}" />
                    ${scanButtonHTML(`data-scan-index="${idx}"`)}
                </span>
            </span>
            <span class="tf-col-name" data-label="Nama Barang">
                <input type="text" class="tf-item-nama" value="${esc(item.namaBarang || item.nama || "")}" placeholder="Nama barang" list="tf-nama-list-${pageId}" data-index="${idx}" />
            </span>
            <span class="tf-col-qty" data-label="Qty">
                <input type="text" inputmode="numeric" class="tf-item-qty" value="${esc(formatThousand(item.qty || 0))}" data-index="${idx}" />
            </span>
            <span class="tf-col-satuan" data-label="Satuan">
                <input type="text" class="tf-item-satuan" value="${esc(item.satuan || '')}" readonly data-index="${idx}" />
            </span>
            <span class="tf-col-action" data-label="">
                <button type="button" class="tf-item-remove" data-index="${idx}" title="Hapus item">Tutup</button>
            </span>
        </div>
    `;
}

function populateWhDropdown(id, warehouses, selected) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih —</option>`;
    for (const w of warehouses) {
        const code = w.kode || w._id || "";
        const name = w.nama || code;
        sel.innerHTML += `<option value="${esc(code)}" data-name="${esc(name)}" ${code === selected ? "selected" : ""}>${esc(code)} - ${esc(name)}</option>`;
    }
    if (selected && !warehouses.find(w => (w.kode || w._id || "") === selected)) {
        sel.innerHTML += `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
    }
}

function renderItemRows(barangs, items) {
    const body = document.getElementById("tf-items-body");
    if (!body) return;
    body.innerHTML = items.length > 0
        ? items.map((item, idx) => buildItemRow(item, idx)).join("")
        : '<div class="tf-empty-items">Belum ada item. Klik "Tambah Item".</div>';
}

function initItemRowEvents(barangs) {
    document.querySelectorAll(".tf-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const row = btn.closest(".tf-item-row");
            if (row) { row.remove(); reindexRows(); }
        });
    });

    // Qty: digit-only + format ribuan (fokus → angka mentah, blur → format ulang)
    document.querySelectorAll(".tf-item-qty").forEach(inp => {
        inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); });
        inp.addEventListener("focus", () => { inp.value = String(unformatThousand(inp.value)); });
        inp.addEventListener("blur", () => { inp.value = formatThousand(unformatThousand(inp.value)); });
    });

    document.querySelectorAll(".tf-item-kode, .tf-item-nama").forEach(inp => {
        inp.addEventListener("blur", () => findAndFillBarang(inp, barangs));
    });

    // Stock validation on qty change — warning saja
    document.querySelectorAll(".tf-item-qty").forEach(inp => {
        inp.addEventListener("change", function validateStock() {
            const row = this.closest(".tf-item-row");
            if (!row) return;
            const idx = row.dataset.index;
            const kodeInput = document.querySelector(`.tf-item-kode[data-index="${idx}"]`);
            if (!kodeInput) return;
            const kode = kodeInput.value.trim();
            if (!kode) return;
            const qty = unformatThousand(this.value);
            const stok = _barangStockMap[kode] || 0;
            if (qty > stok) {
                showToast("warning", `Stok ${esc(kode)} tinggal ${stok}, silahkan isi dengan jumlah yang lebih kecil`);
            }
        });
    });
}

/**
 * Filter daftar barang berdasarkan gudang asal yang dipilih.
 * Update stock maps + datalist autocomplete agar hanya menampilkan barang dari gudang tersebut.
 */
function filterBarangsByGudang(gudangNama) {
    if (!gudangNama) {
        // Gudang belum dipilih — tampilkan semua barang
        _filteredBarangs = _allBarangs;
    } else {
        _filteredBarangs = _allBarangs.filter(b => (b.gudang || "") === gudangNama);
    }

    // Update stock & gudang maps sesuai barang yang sudah difilter
    _barangStockMap = {};
    _barangGudangMap = {};
    for (const b of _filteredBarangs) {
        _barangStockMap[b.kode] = Number(b.stok) || 0;
        _barangGudangMap[b.kode] = b.gudang || "";
    }

    // Update datalist autocomplete
    const kodeList = document.getElementById(`tf-barang-list-${pageId}`);
    const namaList = document.getElementById(`tf-nama-list-${pageId}`);
    if (kodeList) {
        kodeList.innerHTML = _filteredBarangs.map(b =>
            `<option value="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan)}" data-stok="${Number(b.stok) || 0}" data-gudang="${esc(b.gudang || '')}">${esc(b.nama)}</option>`
        ).join("");
    }
    if (namaList) {
        namaList.innerHTML = _filteredBarangs.map(b =>
            `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-satuan="${esc(b.satuan)}" data-stok="${Number(b.stok) || 0}" data-gudang="${esc(b.gudang || '')}">${esc(b.kode)}</option>`
        ).join("");
    }
}

function findAndFillBarang(inputEl, barangs) {
    const val = inputEl.value.trim();
    if (!val) return;

    // Cari barang di filtered list (hanya barang dari gudang asal yg dipilih)
    const searchList = _filteredBarangs.length > 0 ? _filteredBarangs : barangs;
    const barang = searchList.find(b => b.kode === val || b.nama === val);
    if (!barang) return;

    const idx = inputEl.dataset.index;
    const kodeInput = document.querySelector(`.tf-item-kode[data-index="${idx}"]`);
    const namaInput = document.querySelector(`.tf-item-nama[data-index="${idx}"]`);
    const satuanInput = document.querySelector(`.tf-item-satuan[data-index="${idx}"]`);
    const qtyInput = document.querySelector(`.tf-item-qty[data-index="${idx}"]`);
    if (kodeInput) kodeInput.value = barang.kode || "";
    if (namaInput) namaInput.value = barang.nama || "";
    let satuan = barang.satuan || "";
    let gudangBarang = barang.gudang || "";
    let stokBarang = Number(barang.stok) || 0;
    if ((!satuan || !gudangBarang || !stokBarang) && inputEl.list) {
        const opt = Array.from(inputEl.list.options).find(o => o.value === val);
        if (opt) {
            if (!satuan) satuan = opt.getAttribute("data-satuan") || "";
            if (!gudangBarang) gudangBarang = opt.getAttribute("data-gudang") || "";
            const stokAttr = opt.getAttribute("data-stok");
            if (!stokBarang && stokAttr) stokBarang = Number(stokAttr) || 0;
        }
    }
    if (satuanInput) satuanInput.value = satuan;

    // Update maps
    if (barang.kode) {
        _barangStockMap[barang.kode] = stokBarang;
        _barangGudangMap[barang.kode] = gudangBarang;
    }

    // VALIDASI GUDANG: tidak perlu — barang sudah difilter berdasarkan gudang asal

    // Stock validation
    if (qtyInput) {
        const currentQty = unformatThousand(qtyInput.value);
        if (currentQty > stokBarang) {
            showToast("warning", `Stok ${esc(barang.kode)} tinggal ${stokBarang}, silahkan isi dengan jumlah yang lebih kecil`);
            qtyInput.value = formatThousand(stokBarang);
        }
    }
}

function attachAddItemBtn(barangs) {
    document.getElementById("tf-add-item-btn")?.addEventListener("click", () => {
        const body = document.getElementById("tf-items-body");
        if (!body) return;
        const idx = document.querySelectorAll(".tf-item-row").length;
        const emptyMsg = body.querySelector(".tf-empty-items");
        if (emptyMsg) emptyMsg.remove();
        body.insertAdjacentHTML("beforeend", buildItemRow({ kodeBarang: "", namaBarang: "", qty: 0 }, idx));
        initItemRowEvents(barangs);
    });
}

function reindexRows() {
    document.querySelectorAll(".tf-item-row").forEach((row, idx) => {
        row.dataset.index = idx;
        row.querySelectorAll("[data-index]").forEach(el => el.dataset.index = idx);
    });
}

// ═══════════════════════════════════════════════
//  Form Submit
// ═══════════════════════════════════════════════

async function handleSubmit(overlay, existingData, editId) {
    const gudangAsalSel = document.getElementById("f-gudang-asal");
    const gudangTujuanSel = document.getElementById("f-gudang-tujuan");
    const gudangAsal = gudangAsalSel?.value;
    const gudangTujuan = gudangTujuanSel?.value;
    const gudangAsalNama = gudangAsalSel?.selectedOptions?.[0]?.getAttribute("data-name") || gudangAsal;
    const gudangTujuanNama = gudangTujuanSel?.selectedOptions?.[0]?.getAttribute("data-name") || gudangTujuan;
    const tanggal = document.getElementById("f-tanggal")?.value;
    const catatan = document.getElementById("f-catatan")?.value || "";

    if (!gudangAsal) { showToast("danger", "Gudang asal wajib diisi"); return; }
    if (!gudangTujuan) { showToast("danger", "Gudang tujuan wajib diisi"); return; }
    if (gudangAsal === gudangTujuan) { showToast("danger", "Gudang asal dan tujuan harus berbeda"); return; }

    const itemRows = document.querySelectorAll(".tf-item-row");
    if (itemRows.length === 0) { showToast("danger", "Minimal 1 item barang harus ditambahkan"); return; }

    const items = [];
    for (const row of itemRows) {
        const idx = row.dataset.index;
        const kodeBarang = document.querySelector(`.tf-item-kode[data-index="${idx}"]`)?.value?.trim() || "";
        const namaBarang = document.querySelector(`.tf-item-nama[data-index="${idx}"]`)?.value?.trim() || "";
        const qty = unformatThousand(document.querySelector(`.tf-item-qty[data-index="${idx}"]`)?.value);

        if (!kodeBarang && !namaBarang) continue;
        if (qty <= 0) { showToast("danger", `Qty untuk "${namaBarang || kodeBarang}" harus lebih dari 0`); return; }

        // VALIDASI #2: Cek stok sebelum submit
        const availableStock = _barangStockMap[kodeBarang] || 0;
        if (kodeBarang && qty > availableStock) {
            showToast("warning", `Stok ${esc(kodeBarang)} (${esc(namaBarang)}) tinggal ${availableStock}, tidak bisa transfer ${qty}. Silakan kurangi jumlahnya.`);
            return;
        }

        const satuan = document.querySelector(`.tf-item-satuan[data-index="${idx}"]`)?.value?.trim() || "";
        items.push({ kodeBarang, namaBarang, qty, satuan });
    }

    if (items.length === 0) { showToast("danger", "Minimal 1 item dengan qty > 0"); return; }

    const currentUser = getCurrentUserName() || "System";
    const payload = {
        tanggal: tanggal || new Date().toISOString(),
        gudangAsal, gudangAsalNama, gudangTujuan, gudangTujuanNama,
        items, catatan, createdBy: currentUser
    };

    try {
        if (editId) {
            await services.updateTransfer(editId, payload);
            showToast("success", "Transfer berhasil diperbarui");
        } else {
            await services.createTransfer(payload);
            showToast("success", "Transfer berhasil dibuat");
        }
        removeModal(overlay);
        loadData();
    } catch (err) {
        showToast("danger", "Gagal: " + err.message);
    }
}

// ═══════════════════════════════════════════════
//  Execute Transfer (draft → transferred)
// ═══════════════════════════════════════════════

async function executeTransfer(id) {
    if (!confirm("Eksekusi transfer ini? Stok akan dipindahkan dari gudang asal ke tujuan.")) return;

    try {
        const result = await services.updateTransferStatus(id, "transferred");
        showToast("success", "Transfer berhasil dieksekusi! Stok telah dipindahkan.");
        loadData();
    } catch (err) {
        showToast("danger", "Gagal: " + err.message);
    }
}

// ═══════════════════════════════════════════════
//  Delete
// ═══════════════════════════════════════════════

function confirmDelete(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    const name = item?.nomor || `#${id}`;
    const footerHTML = `<button class="smart-btn smart-btn-secondary" id="d-cancel">Batal</button>
        <button class="smart-btn smart-btn-danger" id="d-confirm">Ya, Hapus</button>`;
    const overlay = Modal({
        open: true, title: "Konfirmasi Hapus",
        content: `<div class="delete-confirm"><p>Hapus transfer <strong>${esc(name)}</strong>?</p><p style="font-size:0.85rem;color:#6b7280">Tindakan ini tidak dapat dibatalkan.</p></div>`,
        footer: footerHTML, closable: true, onClose: () => removeModal(overlay)
    });
    overlay.querySelector("#d-confirm")?.setAttribute("style", "background:#dc2626;color:#fff;border-color:#dc2626;");
    document.body.appendChild(overlay);
    document.getElementById("d-cancel")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("d-confirm")?.addEventListener("click", async () => {
        try {
            await services.deleteTransfer(id);
            showToast("success", "Transfer berhasil dihapus");
            removeModal(overlay);
            loadData();
        } catch (err) {
            showToast("danger", "Gagal menghapus: " + err.message);
        }
    });
    overlay.querySelector(".smart-modal-close")?.addEventListener("click", () => removeModal(overlay));
}

// ═══════════════════════════════════════════════
//  Print Tiket Transfer — Normal & Thermal (Struk)
//  Layout mengikuti NOTA Penjualan konsisten
// ═══════════════════════════════════════════════

function getCurrentUserName() {
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Session) {
        const name = globalThis.SMART.Session.get("user.name");
        if (name) return name;
        const state = globalThis.SMART.Session.getState?.();
        if (state?.user?.name) return state.user.name;
        if (state?.user?.email) return state.user.email;
    }
    if (typeof globalThis !== "undefined" && globalThis.__app?.Auth?.user) {
        const u = globalThis.__app.Auth.user();
        if (u?.name) return u.name;
    }
    return null;
}

async function getCompanyInfo() {
    if (typeof services.getCompanyInfo === "function") {
        try {
            const result = await services.getCompanyInfo();
            if (result && (result.name || result.companyName)) return result;
        } catch (e) { console.warn("[Transfer] getCompanyInfo failed:", e); }
    }
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Session?.company) {
        const c = globalThis.SMART.Session.company();
        if (c) return c;
    }
    if (typeof globalThis !== "undefined" && globalThis.SMART?.Company?.get) {
        const c = globalThis.SMART.Company.get();
        if (c) return c;
    }
    return {};
}

async function getItem(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    if (item) return item;
    try { return await services.getTransfer(id); }
    catch { return null; }
}

// ── Entry Point: Pilih format cetak ──

async function printTiket(id) {
    const item = await getItem(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
    showPrintChoice(item);
}

async function showPrintChoice(item) {
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="tf-print-thermal">🧾 Cetak Struk Thermal</button>
        <button class="smart-btn smart-db-primary" id="tf-print-normal">📄 Cetak Normal</button>
    `;

    const overlay = Modal({
        open: true,
        title: "📋 Cetak Tiket Transfer",
        content: `<p>Pilih format cetak untuk Tiket Transfer <strong>${esc(item.nomor)}</strong></p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("tf-print-thermal")?.addEventListener("click", () => {
        removeModal(overlay);
        printTiketThermal(item);
    });
    document.getElementById("tf-print-normal")?.addEventListener("click", () => {
        removeModal(overlay);
        printTiketNormal(item);
    });
}

// ── Print Normal ──

async function printTiketNormal(item) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";
    const logoUrl = company.logo || "";

    // Generate QR code
    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.nomor, { width: 200, margin: 1 });
    } catch (e) { console.warn("[Transfer] QR generation failed:", e); }

    const itemsHTML = (item.items || []).map((i, idx) => `
        <tr>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.kodeBarang || i.kode || "")}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.namaBarang || i.nama || "")}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${i.qty}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.satuan || '-')}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:0.8rem;">${esc(i.keterangan || '')}</td>
        </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TIKET TRANSFER - ${esc(item.nomor)}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; padding:40px; background:#f1f5f9; }
        .invoice-wrap { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
        .invoice-header { padding:32px 40px 12px 40px; border-bottom:3px solid #059669; display:flex; justify-content:space-between; align-items:flex-start; }
        .invoice-header-left { display:flex; align-items:flex-start; gap:16px; }
        .invoice-logo { height:60px; width:auto; max-width:100px; object-fit:contain; }
        .invoice-logo-placeholder { width:48px; height:60px; background:#ecfdf5; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:700; color:#059669; }
        .invoice-company-name { font-size:1.2rem; font-weight:700; color:#1e293b; }
        .invoice-company-detail { font-size:0.8rem; color:#64748b; line-height:1.5; padding-bottom:2px; }
        .invoice-title-block { text-align:right; }
        .invoice-title { font-size:1.6rem; font-weight:800; color:#059669; letter-spacing:1px; }
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
        .invoice-notes { margin-top:20px; padding:12px 16px; background:#f8fafc; border-radius:8px; font-size:0.82rem; color:#64748b; border-left:3px solid #059669; }
        .invoice-bottom { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-top:24px; }
        .invoice-qr { flex-shrink:0; text-align:center; }
        .invoice-qr img { width:90px; height:90px; display:block; border:1px solid #e2e8f0; border-radius:6px; padding:4px; background:#fff; }
        .invoice-qr-label { font-size:0.65rem; color:#94a3b8; margin-top:4px; letter-spacing:0.3px; white-space:nowrap; }
        .invoice-signatures { flex:1; display:flex; gap:24px; justify-content:center; align-items:flex-start; flex-wrap:wrap; }
        .invoice-signature-item { text-align:center; min-width:140px; }
        .invoice-signature-label { font-size:0.75rem; font-weight:600; color:#475569; margin-bottom:8px; }
        .invoice-signature-space { height:45px; }
        .invoice-signature-name { font-size:0.85rem; font-weight:600; color:#1e293b; }
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
            .invoice-bottom { flex-direction:column; align-items:stretch; gap:16px; }
            .invoice-qr { text-align:center; align-self:center; }
            .invoice-signatures { flex-direction:column; gap:16px; }
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
                <div class="invoice-title">TIKET TRANSFER</div>
                <div class="invoice-po-num">${esc(item.nomor)}</div>
            </div>
        </div>
        <div class="invoice-body">
            <div class="invoice-info-grid">
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Dari Gudang</div>
                    <div class="invoice-info-value">${esc(item.gudangAsalNama || item.gudangAsal)}</div>
                </div>
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Tanggal</div>
                    <div class="invoice-info-value">${formatDate(item.tanggal)}</div>
                </div>
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Ke Gudang</div>
                    <div class="invoice-info-value">${esc(item.gudangTujuanNama || item.gudangTujuan)}</div>
                </div>
                <div class="invoice-info-item">
                    <div class="invoice-info-label">Status</div>
                    <div class="invoice-info-value">${item.status === "transferred" ? "Ditransfer" : "Draft"}</div>
                </div>
            </div>
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width:36px">No</th>
                        <th style="width:80px">Kode</th>
                        <th style="width:120px">Nama Barang</th>
                        <th style="width:40px">Qty</th>
                        <th style="width:50px">Satuan</th>
                        <th style="width:100px">Keterangan</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="invoice-bottom">
                <div class="invoice-qr">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : `<div style="width:90px;height:90px;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#94a3b8;background:#f8fafc">QR</div>`}
                    <div class="invoice-qr-label">Scan untuk verifikasi</div>
                </div>
                <div class="invoice-signatures">
                    <div class="invoice-signature-item">
                        <div class="invoice-signature-label">Pengirim</div>
                        <div class="invoice-signature-space"></div>
                        <div class="invoice-signature-name" style="border-top:1px solid #94a3b8;padding-top:0.4rem;"></div>
                    </div>
                    <div class="invoice-signature-item">
                        <div class="invoice-signature-label">Penerima</div>
                        <div class="invoice-signature-space"></div>
                        <div class="invoice-signature-name" style="border-top:1px solid #94a3b8;padding-top:0.4rem;"></div>
                    </div>
                    <div class="invoice-signature-item">
                        <div class="invoice-signature-label">Dibuat oleh</div>
                        <div class="invoice-signature-space"></div>
                        <div class="invoice-signature-name" style="border-top:1px solid #94a3b8;padding-top:0.4rem;">${esc(item.createdBy || getCurrentUserName() || "_______________")}</div>
                    </div>
                </div>
            </div>
            ${item.catatan ? `<div class="invoice-notes"><strong>Catatan:</strong><br/>${esc(item.catatan)}</div>` : ""}
        </div>
    </div>
    <script>window.print();<\/script>
</body>
</html>`;

    printToWindow(html, "mencetak Tiket Transfer", false);
}


// ── Print Thermal (Struk 80mm) ──

async function printTiketThermal(item) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "";
    const companyPhone = company.phone || "";
    const logoUrl = company.logo || "";
    const userName = item.createdBy || getCurrentUserName() || "_______________";

    const itemsHTML = (item.items || []).map(i => `
        <tr>
            <td style="padding:2px 0;font-size:9px;">${esc(i.namaBarang || i.nama || i.kodeBarang || "")}</td>
            <td style="text-align:center;padding:2px 0;font-size:9px;">${i.qty}</td>
            <td style="text-align:center;padding:2px 0;font-size:9px;">${esc(i.satuan || '-')}</td>
            <td style="padding:2px 0;font-size:9px;">${esc(i.keterangan || '')}</td>
        </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Tiket Transfer - ${esc(item.nomor)}</title>
    <style>
        @page { margin:0; size:80mm auto; }
        body { font-family:'Courier New',Courier,monospace; margin:0; padding:4mm; width:72mm; color:#000; font-size:9px; line-height:1.3; }
        .header { text-align:center; margin-bottom:4px; }
        .header img { max-width:60px; max-height:40px; }
        .header .name { font-size:11px; font-weight:bold; }
        .header .addr { font-size:8px; color:#333; }
        .divider { border-top:1px dashed #000; margin:3px 0; }
        .info { font-size:8px; margin-bottom:3px; }
        table { width:100%; border-collapse:collapse; }
        th { font-size:8px; border-bottom:1px solid #000; padding:2px 0; }
        td { font-size:9px; padding:2px 0; }
        .footer { text-align:center; font-size:8px; margin-top:6px; }
        .signature-area { margin-top:8px; text-align:center; }
        .signature-area .sig-line { display:inline-block; width:30%; margin:0 4px; }
        .signature-area .sig-line .line { border-top:1px solid #000; margin-top:28px; padding-top:2px; font-size:8px; }
        @media print { body { width:72mm; } }
    </style>
</head>
<body>
    <div class="header">
        ${logoUrl ? `<img src="${esc(logoUrl)}" />` : ""}
        <div class="name">${esc(companyName)}</div>
        ${companyAddress ? `<div class="addr">${esc(companyAddress)}</div>` : ""}
        ${companyPhone ? `<div class="addr">Telp: ${esc(companyPhone)}</div>` : ""}
    </div>
    <div class="divider"></div>
    <div class="info">
        TIKET TRANSFER<br/>
        ${esc(item.nomor)}<br/>
        Tanggal: ${formatDate(item.tanggal)}<br/>
        Dari: ${esc(item.gudangAsalNama || item.gudangAsal)}<br/>
        Ke: ${esc(item.gudangTujuanNama || item.gudangTujuan)}
    </div>
    <div class="divider"></div>
    <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Sat</th><th style="text-align:left">Ket</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
    </table>
    ${item.catatan ? `<div style="font-size:8px;margin-top:3px;">Catatan: ${esc(item.catatan)}</div>` : ""}
    <div class="divider"></div>
    <div class="signature-area">
        <div class="sig-line">
            <div class="line">Pengirim</div>
        </div>
        <div class="sig-line">
            <div class="line">Penerima</div>
        </div>
        <div class="sig-line">
            <div class="line">Dibuat oleh</div>
        </div>
    </div>
    <div class="footer">Terima Kasih</div>
    <script>window.print();window.close();<\/script>
</body>
</html>`;

    printToWindow(html, "mencetak Tiket Transfer Thermal", false);
}

// ═══════════════════════════════════════════════
//  Helpers: Modal
// ═══════════════════════════════════════════════

function removeModal(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

// ═══════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════

function getStyles() {
    return `
.transfer-page { padding: 1.5rem; }
.transfer-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
.transfer-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.transfer-page .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.transfer-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
.transfer-page .search-wrapper { position:relative; display:flex; align-items:center; }
.transfer-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
.transfer-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid var(--smart-border,#d1d5db); border-radius:6px; font-size:0.875rem; width:240px; outline:none; background:var(--smart-input-bg,#fff); color:var(--smart-text-primary,#1a1a2e); }
.transfer-page .search-wrapper input:focus { border-color:var(--smart-primary,#4f46e5); box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
.transfer-page .tf-table { width:100%; border-collapse:collapse; background:var(--smart-card-bg,#fff); border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
.transfer-page .tf-table th { background:#f8fafc; padding:0.7rem 0.75rem; font-size:0.78rem; font-weight:600; color:#64748b; text-transform:uppercase; text-align:left; border-bottom:2px solid #e2e8f0; }
.transfer-page .tf-table td { padding:0.6rem 0.75rem; font-size:0.85rem; border-bottom:1px solid #f1f5f9; }
.transfer-page .tf-table tbody tr:hover { background:#f8fafc; }
.transfer-page .tf-mgmt-actions { display:flex; gap:0.35rem; flex-wrap:wrap; }
.transfer-page .tf-action-btn { padding:0.3rem 0.55rem; border:1px solid transparent; border-radius:4px; cursor:pointer; font-size:0.8rem; background:#f1f5f9; color:#475569; transition:all 0.15s; }
.transfer-page .tf-action-btn:hover { background:#e2e8f0; }
.transfer-page .tf-action-btn.tf-action-edit { background:#eef2ff; color:#4f46e5; border-color:#c7d2fe; }
.transfer-page .tf-action-btn.tf-action-edit:hover { background:#e0e7ff; }
.transfer-page .tf-action-btn.tf-action-transfer { background:#d1fae5; color:#065f46; border-color:#a7f3d0; }
.transfer-page .tf-action-btn.tf-action-transfer:hover { background:#a7f3d0; }
.transfer-page .tf-action-btn.tf-action-delete { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
.transfer-page .tf-action-btn.tf-action-delete:hover { background:#fee2e2; }
.transfer-page .tf-action-btn.tf-action-print { background:#fef3c7; color:#92400e; border-color:#fde68a; }
.transfer-page .tf-action-btn.tf-action-print:hover { background:#fde68a; }
.transfer-page .tf-status-badge { display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:600; }
.transfer-page .tf-status-draft { background:#fef3c7; color:#92400e; }
.transfer-page .tf-status-done { background:#d1fae5; color:#065f46; }
.transfer-page .pagination-container { display:flex; justify-content:center; padding:0.75rem 0; }
.transfer-page .delete-confirm { text-align:center; padding:1rem 0; }
.transfer-page .delete-confirm p { font-size:1rem; margin-bottom:0.5rem; color:var(--smart-text-secondary,#6b7280); }
.transfer-page .delete-confirm .item-name { font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.tf-form { }
.tf-form-row, .tf-nomor-row { margin-bottom: 0.75rem; }
.tf-form-row { display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 0.75rem; margin-bottom: 1rem; }
.tf-section-title { font-weight:600; font-size:0.9rem; color:#1e293b; margin-bottom:0.5rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; }
.tf-items-header, .tf-item-row { display: grid; grid-template-columns: 100px 1fr 50px 60px auto; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
.tf-items-header { font-size:0.7rem; font-weight:600; color:#64748b; text-transform:uppercase; padding:0.35rem 0; border-bottom:1px solid #e2e8f0; margin-bottom:0.35rem; }
.tf-col-action { text-align:left; }
.tf-item-row input { width:100%; padding:0.3rem; border:1px solid #e2e8f0; border-radius:4px; font-size:0.8rem; background:#fff; }
.tf-item-row input:focus { border-color:#059669; outline:none; box-shadow:0 0 0 2px rgba(5,150,105,0.1); }
.tf-item-satuan { background:#f8fafc; cursor:default; color:#64748b; }
.tf-item-remove { padding: 0.1rem 0.35rem; border: none; background: #fee2e2; color: #dc2626; cursor: pointer; font-size: 0.75rem; line-height: 1.2; flex-shrink: 0; font-weight: 600; border-radius: 4px; white-space: nowrap; justify-self: start; }
.tf-item-remove:hover { background:#fecaca; }
.tf-empty-items { padding:1rem; text-align:center; color:#94a3b8; font-size:0.85rem; border:1px dashed #e2e8f0; border-radius:6px; background:#f8fafc; }
.tf-add-item { margin-top:0.5rem; }
.tf-add-item-btn { border:1px dashed #cbd5e1; background:#fff; padding:0.4rem 1rem; border-radius:6px; font-size:0.85rem; color:#64748b; cursor:pointer; transition:all 0.15s; }
.tf-add-item-btn:hover { border-color:#059669; color:#059669; background:#f0fdf4; }
.tf-form .form-group { display:flex; flex-direction:column; gap:0.25rem; }
.tf-form .form-group label { font-size:0.8rem; font-weight:600; color:#475569; }
.tf-form .form-group input, .tf-form .form-group textarea, .tf-form .form-group select { padding:0.45rem 0.6rem; border:1px solid #d1d5db; border-radius:6px; font-size:0.85rem; outline:none; }
.tf-form .form-group select { background:#fff; }
.tf-form .form-group textarea { resize:vertical; }
.tf-form .form-group input:focus, .tf-form .form-group textarea:focus, .tf-form .form-group select:focus { border-color:#059669; box-shadow:0 0 0 3px rgba(5,150,105,0.1); }
.required { color:#dc2626; }
.transfer-page .tf-loading { text-align:center; padding:2rem; color:#6b7280; }
.transfer-page .tf-error { text-align:center; padding:2rem; color:#dc2626; }
.smart-modal-dialog.modal-lg { max-width:800px; }
.smart-db-primary { padding:0.6rem 1.2rem; border:1px solid #4f46e5; border-radius:6px; background:#4f46e5; color:#fff; cursor:pointer; font-size:0.875rem; font-weight:500; transition:all 0.15s; }
.smart-db-primary:hover { background:#4338ca; }
.tf-card-view { }
@media (max-width:768px) {
.transfer-page { padding:0.75rem 0.25rem; }
.transfer-page .page-header { flex-direction:column; align-items:stretch; }
.transfer-page .page-actions { flex-direction:row; justify-content:flex-end; }
.transfer-page .search-wrapper { flex:1; min-width:0; }
.transfer-page .search-wrapper input { width:100%; }
.transfer-page .smart-btn { flex-shrink:0; white-space:nowrap; }
.transfer-page .tf-table { background:none; border-radius:0; box-shadow:none; }
.tf-form-row { grid-template-columns:1fr; }
.transfer-page .tf-items-header { display: none; }
.tf-item-row { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem; margin-bottom: 0.5rem; background: #f0fdfa; border: 1px solid #d1fae5; border-radius: 8px; position: relative; }
.tf-item-row input { width: 100%; box-sizing: border-box; }
.tf-item-row > span { display: flex; align-items: center; gap: 0.35rem; }
.tf-item-row > span[data-label]:not([data-label=""])::before { content: attr(data-label); font-size: 0.7rem; font-weight: 600; color: #6b7280; min-width: 70px; flex-shrink: 0; }
.tf-item-row:has(.tf-item-remove) { padding-bottom: 2.3rem; }
.tf-item-remove { position: absolute; right: 0.15rem; bottom: 0.15rem; top: auto; transform: none; font-size: 0.9rem; padding: 0.2rem 0.45rem; border-radius: 6px; background: #fee2e2; color: #dc2626; z-index: 1; font-weight: 700; }
            /* Kode: ikon kamera pindah ke KANAN-ATAS kolom isian */
            .tf-item-row:has(.btn-scan) .tf-col-code { position: relative; padding-top: 1.7rem; padding-left: 0; }
            .tf-item-row:has(.btn-scan) .tf-col-code .kode-scan-wrapper { flex: 1; margin-right: 0; padding-left: 0; }
            .tf-item-row:has(.btn-scan) .tf-col-code .btn-scan { position: absolute; top: 0.05rem; right: 0; margin-left: 0; z-index: 1; padding: 0.2rem 0.45rem; }
        }

        /* Scanner integration */
        .kode-scan-wrapper { display:flex; gap:0.35rem; align-items:center; }
        .kode-scan-wrapper input { flex:1; min-width:0; }
        .btn-scan { padding:0.35rem 0.4rem; border:1px solid #d1d5db; border-radius:4px; background:#f8fafc; cursor:pointer; font-size:0.8rem; transition:all 0.15s; white-space:nowrap; display:inline-flex; align-items:center; gap:0.2rem; line-height:1; flex-shrink:0; margin-left:auto; }
        .btn-scan:hover { background:#eef2ff; border-color:#c7d2fe; }
    `; }

    return { TransferPage, initTransferPage };
}
