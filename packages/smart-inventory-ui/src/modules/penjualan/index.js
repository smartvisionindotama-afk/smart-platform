/**
 * Penjualan Module — Sales Order Management.
 *
 * Framework module menangani:
 * - List SO (table desktop + card mobile)
 * - Create/Edit SO dengan multi-item barang + pelanggan
 * - Status lifecycle: order → delivered (surat jalan) → invoiced → paid
 * - Cetak SO, Surat Jalan, Invoice, Kwitansi (normal + thermal receipt)
 * - Stock otomatis berkurang saat Surat Jalan terbit
 *
 * DI yang dibutuhkan:
 *   listPenjualan, getPenjualan, createPenjualan, updatePenjualan,
 *   deletePenjualan, updatePenjualanStatus,
 *   listCustomer, listBarang, listWarehouse,
 *   formatRupiah,
 *   getCompanyInfo — async function() => { name, address, phone, email, logo, orgBendahara, orgKetua }
 *
 * @module @smart/inventory-ui/modules/penjualan
 */

import { Modal, Table, Pagination, EmptyState, Alert, showToast, UI, printToWindow } from "@smart/ui";
import { scannerSectionHTML, scanButtonHTML, attachScanner } from "@smart/ui";
import QRCode from "qrcode";
import { esc, formatThousand, unformatThousand, formatDate, formatDateID } from "@smart/core";

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

// Stock lookup: kode barang → stok saat ini
let _barangStockMap = {};

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

// Framework First: formatThousand/unformatThousand/formatDate/formatDateID
// dari @smart/core (util global, bukan duplikat lokal)

function statusBadgeHTML(status) {
    const map = {
        "order":      { label: "Pesanan",      cls: "ps-status-order" },
        "delivered":  { label: "Dikirim",       cls: "ps-status-delivered" },
        "invoiced":   { label: "Invoice",       cls: "ps-status-invoiced" },
        "paid":       { label: "Lunas",         cls: "ps-status-paid" },
        // PRD V1 — void transaksi POS (permission pos.transaction.void)
        "void":       { label: "Void",           cls: "ps-status-void" }
    };
    const s = map[status] || { label: status, cls: "" };
    return `<span class="ps-status-badge ${s.cls}">${s.label}</span>`;
}

// PRD V1 — hanya transaksi POS lunas yang bisa di-void (permission gate server).
function canVoid(item) {
    return Boolean(
        typeof services.voidPenjualan === "function"
        && item
        && item.sumber === "pos"
        && item.status === "paid"
    );
}

function canEdit(status) { return status === "order"; }
function canDeliver(status) { return status === "order"; }
function canInvoice(status) { return status === "delivered"; }
function canPay(status) { return status === "invoiced"; }

const pageId = "penjualan-page";

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

function PenjualanPage() {
    return `
        <div id="${pageId}" class="penjualan-page">
            <style>${getStyles()}</style>
            <div class="ps-tabs">
                <button class="ps-tab active" data-ps-tab="list">💰 Penjualan</button>
                <button class="ps-tab" data-ps-tab="retur">↩️ Retur Penjualan</button>
                ${services.isPos ? `<button class="ps-tab" data-ps-tab="pengaturan">⚙️ Pengaturan</button>` : ""}
            </div>
            <div id="ps-tab-list">
                <div class="page-header">
                    <div>
                        <h1>💰 Penjualan</h1>
                        <div class="header-subtitle">Kelola transaksi penjualan & cetak dokumen — transaksi kasir otomatis terbit Nota (DDMMYYYY-XXXX)</div>
                    </div>
                    <div class="page-actions">
                        <div class="search-wrapper">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="ps-search-input" placeholder="Cari no. nota/SO, pelanggan, status..." autocomplete="off" />
                        </div>
                    </div>
                </div>
                <div id="ps-table-area">
                    <table class="ps-table">
                        <thead>
                            <tr>
                                <th>${services.isPos ? "No. Nota" : "No. SO"}</th>
                                <th>Tanggal</th>
                                <th>Pelanggan</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="ps-table-body"></tbody>
                    </table>
                </div>
                <div id="ps-card-area" class="ps-card-view" style="display:none"></div>
                <div id="ps-pagination"></div>
                <div id="ps-empty-state"></div>
                <div id="ps-loading" class="ps-loading" style="display:none">Memuat...</div>
            </div>
            <div id="ps-tab-retur" style="display:none">
                <div class="page-header">
                    <div>
                        <h1>↩️ Retur Penjualan</h1>
                        <div class="header-subtitle">Catat pengembalian barang dari pelanggan</div>
                    </div>
                    <div class="page-actions">
                        <div class="search-wrapper">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="prj-search-input" placeholder="Cari no. retur, ${services.isPos ? "nota" : "SO"}, pelanggan..." autocomplete="off" />
                        </div>
                    </div>
                </div>
                <div id="prj-table-area">
                    <table class="ps-table">
                        <thead>
                            <tr>
                                <th>No. Retur</th>
                                <th>Tanggal</th>
                                <th>${services.isPos ? "No. Nota" : "No. SO"}</th>
                                <th>Pelanggan</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="prj-table-body"></tbody>
                    </table>
                </div>
                <div id="prj-card-area" class="ps-card-view" style="display:none"></div>
                <div id="prj-pagination"></div>
                <div id="prj-empty-state"></div>
                <div id="prj-loading" class="ps-loading" style="display:none">Memuat...</div>
            </div>
            ${services.isPos ? `
            <div id="ps-tab-pengaturan" style="display:none">
                <div class="page-header">
                    <div>
                        <h1>⚙️ Pengaturan</h1>
                        <div class="header-subtitle">Pajak transaksi &amp; mapping gudang-kasir — berlaku untuk transaksi kasir berikutnya</div>
                    </div>
                </div>
                <!-- M3-FIX v19 — pengaturan pajak transaksi (diprovide POS app) -->
                <div id="ps-tax-setting"></div>
                <!-- M3-FIX v21 — pengaturan Gudang-Kasir (POS app only) -->
                <div id="ps-gudang-setting"></div>
            </div>
            ` : ""}
        </div>
    `;
}

// ═══════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════

function initPenjualanPage() {
    state.items = [];
    state.pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
    state.search = "";
    state.loading = false;
    state.editingId = null;

    const searchInput = document.getElementById("ps-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", debounce((e) => {
            state.search = e.target.value.trim();
            state.pagination.page = 1;
            loadData();
        }, 300));
    }

    const pageActions = document.querySelector(`.${pageId} .page-actions`);
    // M3-FIX v21 — mode POS: semua penjualan dibuat di layar Kasir,
    // tombol "Buat SO Baru" disembunyikan.
    if (pageActions && !services.isPos) {
        const addBtn = document.createElement("button");
        addBtn.className = "smart-btn smart-btn-primary";
        addBtn.innerHTML = "➕ Buat SO Baru";
        addBtn.addEventListener("click", () => openForm("create"));
        pageActions.appendChild(addBtn);
    }

    loadData();

    window.addEventListener("resize", toggleView);
    toggleView();

    // ── Tab switching: Penjualan / Retur Penjualan ──
    document.querySelectorAll("[data-ps-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.psTab;
            document.querySelectorAll("[data-ps-tab]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const listEl = document.getElementById("ps-tab-list");
            const returEl = document.getElementById("ps-tab-retur");
            const pengaturanEl = document.getElementById("ps-tab-pengaturan");
            if (listEl) listEl.style.display = tab === "list" ? "" : "none";
            if (returEl) returEl.style.display = tab === "retur" ? "" : "none";
            if (pengaturanEl) pengaturanEl.style.display = tab === "pengaturan" ? "" : "none";
            if (tab === "retur") initReturTab();
            // Pengaturan pajak & gudang-kasir di-init saat tab dibuka — data
            // fresh dari server; innerHTML diganti tiap kali, listener tidak menumpuk.
            if (tab === "pengaturan") {
                initTaxSetting();
                initGudangKasirSetting();
            }
        });
    });
}

// ═══════════════════════════════════════════════
//  Pengaturan Pajak (M3-FIX v19) — diatur Admin, dipakai layar kasir
// ═══════════════════════════════════════════════

async function initTaxSetting() {
    const host = document.getElementById("ps-tax-setting");
    if (!host || typeof services.getPosSettings !== "function") return;

    let taxEnabled = true;
    try {
        const s = await services.getPosSettings();
        if (s && typeof s.taxEnabled === "boolean") taxEnabled = s.taxEnabled;
    } catch (err) {
        console.warn("[Penjualan] Gagal baca pengaturan pajak:", err?.message);
    }

    host.style.display = "";
    host.innerHTML = `
        <div class="ps-tax-box">
            <span class="ps-tax-label">🧾 Pajak Transaksi (layar kasir)</span>
            <label class="ps-tax-radio"><input type="radio" name="ps-tax-radio" value="1" ${taxEnabled ? "checked" : ""} /> <span>Aktif</span></label>
            <label class="ps-tax-radio"><input type="radio" name="ps-tax-radio" value="0" ${taxEnabled ? "" : "checked"} /> <span>Off</span></label>
            <span class="ps-tax-hint">Pajak 11% — kasir tidak bisa mengubah; berlaku untuk transaksi kasir berikutnya.</span>
        </div>
    `;

    host.querySelectorAll('input[name="ps-tax-radio"]').forEach(input => {
        input.addEventListener("change", async () => {
            const next = input.value === "1";
            try {
                await services.setPosSettings({ taxEnabled: next });
                showToast("success", `Pajak transaksi ${next ? "AKTIF" : "OFF"} — berlaku untuk transaksi kasir berikutnya`);
            } catch (err) {
                showToast("danger", err.message || "Gagal menyimpan pengaturan pajak");
                input.checked = !next;
            }
        });
    });
}

/**
 * M3-FIX v21 — Pengaturan Gudang-Kasir (mode POS, PRD V1 §X).
 *
 * Tiga mode (berdasarkan data nyata gudang & user kasir):
 *   gudang == 1            → info single lokasi (tanpa kontrol)
 *   gudang > 1, kasir == 1 → pilih gudang yang terhubung (multi-select)
 *   gudang > 1, kasir > 1  → mapping per kasir (setiap kasir 1 gudang)
 *
 * Additive: hanya dirender di POS app (services.isPos) yang menyediakan
 * getPosSettings/setPosSettings — inventory tidak terpengaruh.
 */
async function initGudangKasirSetting() {
    const host = document.getElementById("ps-gudang-setting");
    if (!host || !services.isPos || typeof services.getPosSettings !== "function") return;

    let s = null;
    try {
        s = await services.getPosSettings();
    } catch (err) {
        console.warn("[Penjualan] Gagal baca pengaturan gudang:", err?.message);
        return;
    }
    const warehouses = Array.isArray(s.warehouses) ? s.warehouses : [];
    const kasirUsers = Array.isArray(s.kasirUsers) ? s.kasirUsers : [];
    const gudangTerkoneksi = Array.isArray(s.gudangTerkoneksi) ? s.gudangTerkoneksi : [];
    const gudangKasir = Array.isArray(s.gudangKasir) ? s.gudangKasir : [];

    host.style.display = "";

    // M3-FIX v24 — mapping FLEKSIBEL: baris [gudang][kasir]. Satu gudang boleh
    // dipakai banyak kasir (mis. Store Kebohoran 3 kasir, Gudang Utama 2 kasir),
    // komposisi bisa diubah (tambah/hapus baris) kapan saja.
    const rowHTML = (r) => `
        <div class="ps-gudang-row ps-gudang-map-row">
            <select class="ps-gudang-select ps-gudang-w smart-input" data-field="kodeGudang">
                <option value="">— pilih gudang —</option>
                ${warehouses.map(w => `<option value="${esc(w.kode)}" ${w.kode === r?.kodeGudang ? "selected" : ""}>${esc(w.nama)} (${esc(w.kode)})</option>`).join("")}
            </select>
            <select class="ps-gudang-select ps-gudang-k smart-input" data-field="kasir">
                <option value="">— pilih kasir —</option>
                ${kasirUsers.map(u => `<option value="${esc(u.username)}" ${u?.username === r?.kasir ? "selected" : ""}>${esc(u.nama || u.username)} (${esc(u.username)})</option>`).join("")}
            </select>
            <button type="button" class="ps-gudang-del" title="Hapus baris">🗑️</button>
        </div>
    `;

    let inner = "";
    if (warehouses.length <= 1) {
        const nama = warehouses[0] ? warehouses[0].nama : "Gudang Utama";
        inner = `
            <div class="ps-gudang-box">
                <span class="ps-gudang-title">🏬 Gudang Kasir</span>
                <span class="ps-gudang-info">Single lokasi — seluruh kasir terhubung ke <strong>${esc(nama)}</strong>. Pengaturan gudang muncul otomatis saat jumlah gudang &gt; 1 (Master Platform → Edit Perusahaan).</span>
            </div>
        `;
    } else if (!kasirUsers.length) {
        // Belum ada user kasir — mapping tidak bisa diisi; jangan tampilkan
        // tombol simpan (mencegah gudangTerkoneksi legacy ter-wipe percuma).
        inner = `
            <div class="ps-gudang-box">
                <span class="ps-gudang-title">🏬 Mapping Gudang — Kasir</span>
                <span class="ps-gudang-info">Belum ada user ber-role <strong>kasir</strong>. Buat user kasir dulu di Pengaturan → User, lalu atur mapping gudang-kasir di sini.</span>
            </div>
        `;
    } else {
        // Seed baris: mapping tersimpan (gudangKasir) — fallback migrasi
        // gudangTerkoneksi legacy (tiap kasir × tiap gudang tercentang) —
        // fallback 1 baris kosong siap diisi.
        let seed = (gudangKasir || [])
            .filter(e => e && String(e.kasir || "").trim() && String(e.kodeGudang || "").trim())
            .map(e => ({ kasir: String(e.kasir).trim(), kodeGudang: String(e.kodeGudang).trim() }));
        if (!seed.length && gudangTerkoneksi.length) {
            seed = [];
            for (const u of kasirUsers) {
                for (const k of gudangTerkoneksi) seed.push({ kasir: u.username, kodeGudang: k });
            }
        }
        if (!seed.length) seed = [{ kasir: "", kodeGudang: "" }];

        inner = `
            <div class="ps-gudang-box">
                <span class="ps-gudang-title">🏬 Mapping Gudang — Kasir</span>
                <span class="ps-gudang-hint">Atur gudang mana yang terhubung dengan kasir mana. Satu gudang boleh dipakai banyak kasir — komposisi bisa diubah kapan saja. Kasir tanpa baris akan melihat seluruh stok.</span>
                <div class="ps-gudang-grid" id="ps-gudang-map">${seed.map(rowHTML).join("")}</div>
                <div class="ps-gudang-actions">
                    <button type="button" class="smart-btn smart-btn-secondary smart-btn-sm" id="ps-gudang-add">➕ Tambah Baris</button>
                    <button class="smart-btn smart-btn-primary smart-btn-sm" id="ps-gudang-save">💾 Simpan Mapping</button>
                </div>
            </div>
        `;
    }
    host.innerHTML = inner;

    const mapHost = host.querySelector("#ps-gudang-map");
    if (mapHost) {
        const addBtn = host.querySelector("#ps-gudang-add");
        if (addBtn) {
            addBtn.addEventListener("click", () => mapHost.insertAdjacentHTML("beforeend", rowHTML({ kasir: "", kodeGudang: "" })));
        }
        mapHost.addEventListener("click", (ev) => {
            const del = ev.target.closest(".ps-gudang-del");
            if (!del) return;
            const rows = mapHost.querySelectorAll(".ps-gudang-map-row");
            if (rows.length > 1) del.closest(".ps-gudang-map-row").remove();
            else showToast("danger", "Minimal satu baris mapping");
        });
    }

    const saveBtn = host.querySelector("#ps-gudang-save");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", async () => {
        // Jangan menimpa pajak — kirim nilai radio saat ini bersama mapping;
        // fallback ke pengaturan yang baru dibaca bila radio tidak tersedia.
        const radio = document.querySelector('input[name="ps-tax-radio"]:checked');
        const nextTax = radio ? radio.value === "1" : (typeof s?.taxEnabled === "boolean" ? s.taxEnabled : true);
        const body = { taxEnabled: nextTax };
        if (warehouses.length > 1) {
            // Mapping kini eksplisit — gudangTerkoneksi (legacy) dikosongkan.
            body.gudangKasir = [...host.querySelectorAll(".ps-gudang-map-row")]
                .map(r => ({
                    kasir: r.querySelector('[data-field="kasir"]')?.value || "",
                    kodeGudang: r.querySelector('[data-field="kodeGudang"]')?.value || ""
                }))
                .filter(e => e.kasir && e.kodeGudang);
            body.gudangTerkoneksi = [];
        }
        try {
            await services.setPosSettings(body);
            showToast("success", "Pengaturan gudang kasir disimpan — berlaku untuk transaksi berikutnya");
        } catch (err) {
            showToast("danger", err.message || "Gagal menyimpan pengaturan gudang");
        }
    });
}

// ═══════════════════════════════════════════════
//  Data Loading
// ═══════════════════════════════════════════════

async function loadData() {
    const loadingEl = document.getElementById("ps-loading");
    const emptyEl = document.getElementById("ps-empty-state");
    const tableArea = document.getElementById("ps-table-area");
    const cardArea = document.getElementById("ps-card-area");
    const paginationEl = document.getElementById("ps-pagination");

    if (!tableArea) return;
    state.loading = true;
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.innerHTML = "";

    try {
        const result = await services.listPenjualan({
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
                const emptyProps = {
                    icon: "💰",
                    title: state.search ? "Pencarian tidak ditemukan" : "Belum ada Penjualan",
                    description: state.search
                        ? "Coba kata kunci lain"
                        : (services.isPos
                            ? "Transaksi kasir otomatis tercatat di sini. Buat transaksi baru dari layar Kasir."
                            : "Buat Sales Order pertama untuk mulai mencatat penjualan")
                };
                if (state.search) {
                    emptyProps.actionText = "Reset Pencarian";
                    emptyProps.onAction = () => { state.search = ""; const inp = document.getElementById("ps-search-input"); if (inp) inp.value = ""; loadData(); };
                } else if (!services.isPos) {
                    emptyProps.actionText = "Buat SO Baru";
                    emptyProps.onAction = () => openForm("create");
                }
                emptyEl.appendChild(EmptyState(emptyProps));
            }
            if (paginationEl) paginationEl.innerHTML = "";
            return;
        }

        renderTable();
        renderCards();
        toggleView();
        renderPagination();
    } catch (err) {
        console.error("[Penjualan] loadData failed:", err);
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) {
            emptyEl.innerHTML = `<div class="ps-error">Gagal memuat data: ${esc(err.message)}</div>`;
        }
    }
}

// ═══════════════════════════════════════════════
//  Desktop Table
// ═══════════════════════════════════════════════

function renderTable() {
    const tbody = document.getElementById("ps-table-body");
    if (!tbody) return;
    tbody.innerHTML = state.items.map(item => {
        return `
            <tr>
                <td><strong>${esc(item.nomor)}</strong></td>
                <td>${formatDate(item.tanggal)}</td>
                <td>${esc(item.pelangganNama || item.pelanggan)}</td>
                <td class="ps-text-right">${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</td>
                <td>${statusBadgeHTML(item.status)}</td>
                <td>
                    <div class="ps-mgmt-actions">
                        ${services.isPos ? `
                            ${item.status === "invoiced" || item.status === "paid" ? `<button class="ps-action-btn ps-action-nota" data-action="print-nota" data-id="${item._id || item.id}" title="Cetak Nota">📋 Nota</button>` : ""}
                            ${canVoid(item) ? `<button class="ps-action-btn ps-action-void" data-action="void" data-id="${item._id || item.id}" title="Void transaksi (kembalikan stok)">🚫 Void</button>` : ""}
                            <button class="ps-action-btn ps-action-delete" data-action="delete" data-id="${item._id || item.id}" title="Hapus">🗑️</button>
                        ` : `
                            <button class="ps-action-btn ps-action-invoice" data-action="print-so" data-id="${item._id || item.id}" title="Cetak SO">🖨️ SO</button>
                            ${canEdit(item.status) ? `<button class="ps-action-btn ps-action-edit" data-action="edit" data-id="${item._id || item.id}" title="Edit SO">✏️</button>` : ""}
                            ${canDeliver(item.status) ? `<button class="ps-action-btn ps-action-deliver" data-action="deliver" data-id="${item._id || item.id}" title="Terbitkan Surat Jalan">🚚 SJ</button>` : ""}
                            ${item.status === "delivered" || item.status === "invoiced" || item.status === "paid" ? `<button class="ps-action-btn ps-action-sj" data-action="print-sj" data-id="${item._id || item.id}" title="Cetak Surat Jalan">📄 SJ</button>` : ""}
                            ${canInvoice(item.status) ? `<button class="ps-action-btn ps-action-invoice" data-action="invoice" data-id="${item._id || item.id}" title="Terbitkan Invoice">🧾 Invoice</button>` : ""}
                            ${item.status === "invoiced" || item.status === "paid" ? `<button class="ps-action-btn ps-action-invoice" data-action="print-inv" data-id="${item._id || item.id}" title="Cetak Invoice">🧾 Inv</button>` : ""}
                            ${item.status === "invoiced" || item.status === "paid" ? `<button class="ps-action-btn ps-action-nota" data-action="print-nota" data-id="${item._id || item.id}" title="Cetak Nota">📋 Nota</button>` : ""}
                            ${canPay(item.status) ? `<button class="ps-action-btn ps-action-pay" data-action="pay" data-id="${item._id || item.id}" title="Terbitkan Kwitansi">💵 Kwitansi</button>` : ""}
                            ${item.status === "paid" && item.sumber !== "pos" ? `<button class="ps-action-btn ps-action-pay" data-action="print-kwt" data-id="${item._id || item.id}" title="Cetak Kwitansi">💵 Kwitansi</button>` : ""}
                            ${canVoid(item) ? `<button class="ps-action-btn ps-action-void" data-action="void" data-id="${item._id || item.id}" title="Void transaksi (kembalikan stok)">🚫 Void</button>` : ""}
                            <button class="ps-action-btn ps-action-delete" data-action="delete" data-id="${item._id || item.id}" title="Hapus">🗑️</button>
                        `}
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
            if (action === "print-so") printSO(id);
            else if (action === "edit") openForm("edit", id);
            else if (action === "delete") confirmDelete(id);
            else if (action === "deliver") updateStatus(id, "delivered");
            else if (action === "print-sj") printSuratJalan(id);
            else if (action === "invoice") updateStatus(id, "invoiced");
            else if (action === "print-inv") printInvoice(id);
            else if (action === "print-nota") printNota(id);
            else if (action === "pay") updateStatus(id, "paid");
            else if (action === "print-kwt") printKwitansi(id);
            else if (action === "void") confirmVoid(id);
        });
    });
}

// ═══════════════════════════════════════════════
//  Mobile Card View
// ═══════════════════════════════════════════════

function renderCards() {
    const cardArea = document.getElementById("ps-card-area");
    if (!cardArea) return;
    cardArea.innerHTML = "";
    const list = UI.CardList(state.items, (item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${esc(item.nomor)}</div>
            <div class="sm-card-desc">${formatDate(item.tanggal)}</div>
        </div>
        <div class="sm-card-details">
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Pelanggan</span>
                <span class="sm-card-value">${esc(item.pelangganNama || item.pelanggan)}</span>
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
                ${services.isPos ? `
                    ${item.status === "invoiced" || item.status === "paid" ? `<button class="sm-card-btn sm-card-btn-nota" data-ps-nota="${item._id || item.id}">📋 Nota</button>` : ""}
                    ${canVoid(item) ? `<button class="sm-card-btn sm-card-btn-void" data-ps-void="${item._id || item.id}">🚫 Void</button>` : ""}
                    <button class="sm-card-btn sm-card-btn-delete" data-ps-delete="${item._id || item.id}">🗑️</button>
                ` : `
                    ${canEdit(item.status) ? `<button class="sm-card-btn sm-card-btn-edit" data-ps-edit="${item._id || item.id}">✏️ Edit</button>` : ""}
                    ${canDeliver(item.status) ? `<button class="sm-card-btn sm-card-btn-primary" data-ps-deliver="${item._id || item.id}">🚚 SJ</button>` : ""}
                    ${canInvoice(item.status) ? `<button class="sm-card-btn sm-card-btn-primary" data-ps-invoice="${item._id || item.id}">🧾 Invoice</button>` : ""}
                    ${canPay(item.status) ? `<button class="sm-card-btn sm-card-btn-primary" data-ps-pay="${item._id || item.id}">💵 Kwitansi</button>` : ""}
                    <button class="sm-card-btn sm-card-btn-invoice" data-ps-so="${item._id || item.id}">🖨️ SO</button>
                    ${item.status !== "order" ? `<button class="sm-card-btn sm-card-btn-sj" data-ps-sj="${item._id || item.id}">📄 SJ</button>` : ""}
                    ${item.status === "invoiced" || item.status === "paid" ? `<button class="sm-card-btn sm-card-btn-inv" data-ps-inv="${item._id || item.id}">🧾 Inv</button>` : ""}
                    ${item.status === "invoiced" || item.status === "paid" ? `<button class="sm-card-btn sm-card-btn-nota" data-ps-nota="${item._id || item.id}">📋 Nota</button>` : ""}
                    ${item.status === "paid" && item.sumber !== "pos" ? `<button class="sm-card-btn sm-card-btn-kwt" data-ps-kwt="${item._id || item.id}">💵 KWT</button>` : ""}
                    ${canVoid(item) ? `<button class="sm-card-btn sm-card-btn-void" data-ps-void="${item._id || item.id}">🚫 Void</button>` : ""}
                    <button class="sm-card-btn sm-card-btn-delete" data-ps-delete="${item._id || item.id}">🗑️</button>
                `}
            </div>
        </div>
    `);
    cardArea.appendChild(list);

    cardArea.querySelectorAll("[data-ps-edit]").forEach(btn => {
        btn.addEventListener("click", () => openForm("edit", btn.dataset.psEdit));
    });
    cardArea.querySelectorAll("[data-ps-delete]").forEach(btn => {
        btn.addEventListener("click", () => confirmDelete(btn.dataset.psDelete));
    });
    cardArea.querySelectorAll("[data-ps-deliver]").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.psDeliver, "delivered"));
    });
    cardArea.querySelectorAll("[data-ps-invoice]").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.psInvoice, "invoiced"));
    });
    cardArea.querySelectorAll("[data-ps-pay]").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.psPay, "paid"));
    });
    cardArea.querySelectorAll("[data-ps-so]").forEach(btn => {
        btn.addEventListener("click", () => printSO(btn.dataset.psSo));
    });
    cardArea.querySelectorAll("[data-ps-sj]").forEach(btn => {
        btn.addEventListener("click", () => printSuratJalan(btn.dataset.psSj));
    });
    cardArea.querySelectorAll("[data-ps-inv]").forEach(btn => {
        btn.addEventListener("click", () => printInvoice(btn.dataset.psInv));
    });
    cardArea.querySelectorAll("[data-ps-nota]").forEach(btn => {
        btn.addEventListener("click", () => printNota(btn.dataset.psNota));
    });
    cardArea.querySelectorAll("[data-ps-kwt]").forEach(btn => {
        btn.addEventListener("click", () => printKwitansi(btn.dataset.psKwt));
    });
    cardArea.querySelectorAll("[data-ps-void]").forEach(btn => {
        btn.addEventListener("click", () => confirmVoid(btn.dataset.psVoid));
    });
}

// ═══════════════════════════════════════════════
//  Responsive Toggle
// ═══════════════════════════════════════════════

function toggleView() {
    const tableArea = document.getElementById("ps-table-area");
    const cardArea = document.getElementById("ps-card-area");
    if (!tableArea || !cardArea) return;
    const isMobile = window.innerWidth < 768;
    tableArea.style.display = isMobile ? "none" : "";
    cardArea.style.display = isMobile ? "block" : "none";
}

// ═══════════════════════════════════════════════
//  Pagination
// ═══════════════════════════════════════════════

function renderPagination() {
    const el = document.getElementById("ps-pagination");
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
        pelanggan: "",
        pelangganNama: "",
        noPoPelanggan: "",
        kirimDari: "",
        sales: "",
        kirimDariNama: "",
        items: [],
        diskon: 0,
        catatan: "",
        nomor: ""
    };

    if (isEdit) {
        try {
            const item = await services.getPenjualan(id);
            if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
            formData = {
                tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split("T")[0] : "",
                pelanggan: item.pelanggan || "",
                pelangganNama: item.pelangganNama || "",
                noPoPelanggan: item.noPoPelanggan || "",
                kirimDari: item.kirimDari || "",
                kirimDariNama: item.kirimDariNama || "",
                items: (item.items || []).map(i => ({ ...i })),
                diskon: item.diskon || 0,
                catatan: item.catatan || "",
                nomor: item.nomor || "",
                sales: item.sales || ""
            };
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
            return;
        }
    }

    const title = isEdit ? `✏️ Edit SO: ${formData.nomor}` : "💰 Buat Sales Order Baru";
    const contentHTML = buildFormHTML(formData, isEdit);
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-submit">${isEdit ? "Simpan Perubahan" : "Buat SO"}</button>
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

    // Fetch customers, barangs, sales & warehouses for dropdowns
    let customers = [];
    let barangs = [];
    let warehouses = [];
    let salesPersons = [];
    try {
        try {
            const custRes = await services.listCustomer({ page: 1, limit: 999 });
            customers = custRes.data || [];
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
        if (typeof services.listSales === "function") {
            try {
                const slsRes = await services.listSales({ page: 1, limit: 999 });
                salesPersons = slsRes.data || [];
            } catch (e) { console.warn("[Penjualan] Fetch sales failed:", e); }
        }
    } catch (err) {
        console.warn("[Penjualan] Fetch error:", err);
    }

    // Build stock map for validation
    _barangStockMap = {};
    for (const b of barangs) {
        _barangStockMap[b.kode] = Number(b.stok) || 0;
    }

    populateCustomerDropdown(customers, formData.pelanggan);
    populateWarehouseDropdown(warehouses, formData.kirimDari);
    populateSalesDropdown(salesPersons, formData.sales);
    renderItemRows(barangs, formData.items);

    const kodeList = document.getElementById(`ps-barang-list-${pageId}`);
    const namaList = document.getElementById(`ps-nama-list-${pageId}`);
    if (kodeList) {
        kodeList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.kode)}" data-kode="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan)}" data-harga="${b.harga_jual || b.harga_beli || 0}" data-stok="${Number(b.stok) || 0}">${esc(b.nama)}</option>`
        ).join("");
    }
    if (namaList) {
        namaList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan)}" data-harga="${b.harga_jual || b.harga_beli || 0}" data-stok="${Number(b.stok) || 0}">${esc(b.kode)}</option>`
        ).join("");
    }

    const diskonInput = document.getElementById("f-diskon");
    if (diskonInput) {
        diskonInput.addEventListener("input", () => { diskonInput.value = diskonInput.value.replace(/\D/g, ""); });
        diskonInput.addEventListener("focus", () => { diskonInput.value = String(unformatThousand(diskonInput.value)); });
        diskonInput.addEventListener("blur", () => { diskonInput.value = formatThousand(unformatThousand(diskonInput.value)); });
        diskonInput.addEventListener("input", calcTotals);
    }
    initItemRowEvents(barangs);
    attachAddItemBtn(barangs);
    let scannerCleanup = initScanner();
    calcTotals();

    document.getElementById("f-cancel")?.addEventListener("click", () => { if (typeof scannerCleanup === "function") scannerCleanup(); removeModal(overlay); });
    document.getElementById("f-submit")?.addEventListener("click", () => { if (typeof scannerCleanup === "function") scannerCleanup(); handleSubmit(overlay, formData, isEdit ? id : null); });

    function initScanner() {
        const itemsBody = document.getElementById("ps-items-body");
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
                const kodeInput = document.querySelector(`.ps-item-kode[data-index="${activeScanIndex}"]`);
                if (kodeInput) {
                    kodeInput.value = decodedText.trim();
                    kodeInput.dispatchEvent(new Event("blur", { bubbles: true }));
                    showToast("success", `✅ Kode: ${decodedText.trim()}`);
                }
            }
            setTimeout(() => stopScanner(), 400);
        }

        async function startScanner() {
            const section = document.getElementById("scanner-section-scanner-penjualan");
            if (!section) return;
            section.style.display = "block"; section.classList.add("active");
            try {
                scannerInstance = new UI.BarcodeScanner("scanner-penjualan", { onScan: onScanSuccess, fps: 10 });
                await scannerInstance.start();
            } catch { stopScanner(); showToast("warning", "Kamera tidak tersedia. Silakan ketik kode manual."); }
        }

        function stopScanner() {
            if (scannerInstance) { scannerInstance.destroy(); scannerInstance = null; }
            const section = document.getElementById("scanner-section-scanner-penjualan");
            if (section) { section.classList.remove("active"); section.style.display = "none"; }
            activeScanIndex = -1;
        }

        function toggleScanner(index) {
            const section = document.getElementById("scanner-section-scanner-penjualan");
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
            const flash = document.getElementById("scanner-flash-penjualan");
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

        document.getElementById("btn-switch-penjualan")?.addEventListener("click", switchCamera);

        return () => { stopScanner(); };
    }
}

function buildFormHTML(data, isEdit) {
    const itemRows = (data.items || []).map((item, idx) => buildItemRow(item, idx)).join("");
    return `
        <div class="ps-form">
            ${isEdit ? `<div class="ps-nomor-row">
                <div class="form-group" style="max-width:280px">
                    <label>${services.isPos ? "No. Nota" : "No. SO"}</label>
                    <input type="text" value="${esc(data.nomor)}" disabled />
                </div>
            </div>` : ""}
            <div class="ps-form-row">
                <div class="form-group">
                    <label for="f-tanggal">Tanggal</label>
                    <input type="date" id="f-tanggal" value="${esc(data.tanggal)}" />
                </div>
                <div class="form-group">
                    <label for="f-kirim-dari">Kirim Dari (Gudang) <span class="required">*</span></label>
                    <select id="f-kirim-dari">
                        <option value="">— Pilih Gudang —</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="f-pelanggan">Pelanggan <span class="required">*</span></label>
                    <select id="f-pelanggan">
                        <option value="">— Pilih Pelanggan —</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="f-sales">Sales</label>
                    <select id="f-sales">
                        <option value="">— Pilih Sales —</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="f-no-po">No. PO Pelanggan</label>
                    <input type="text" id="f-no-po" value="${esc(data.noPoPelanggan)}" placeholder="Nomor PO dari pelanggan (opsional)" />
                </div>
            </div>

            ${scannerSectionHTML(
                'scanner-penjualan',
                'btn-switch-penjualan',
                'scanner-flash-penjualan'
            )}
            <div class="ps-section-title">📦 Item Barang</div>
            <div class="ps-items-header">
                <span class="ps-col-code">Kode</span>
                <span class="ps-col-name">Nama Barang</span>
                <span class="ps-col-qty">Qty</span>
                <span class="ps-col-satuan">Satuan</span>
                <span class="ps-col-price">Harga</span>
                <span class="ps-col-diskon">Diskon</span>
                <span class="ps-col-subtotal">Subtotal</span>
                <span class="ps-col-action"></span>
            </div>
            <div id="ps-items-body">${itemRows}</div>
            <datalist id="ps-barang-list-${pageId}"></datalist>
            <datalist id="ps-nama-list-${pageId}"></datalist>
            <div class="ps-add-item">
                <button type="button" id="ps-add-item-btn" class="ps-add-item-btn">➕ Tambah Item</button>
            </div>

            <div class="ps-totals">
                <div class="ps-total-row">
                    <span>Total</span>
                    <span id="ps-total-display">0</span>
                </div>
                <div class="ps-total-row">
                    <span>Diskon</span>
                    <input type="text" inputmode="numeric" id="f-diskon" value="${esc(formatThousand(data.diskon || 0))}" class="ps-diskon-input" />
                </div>
                <div class="ps-total-row ps-grand-total">
                    <span>Grand Total</span>
                    <span id="ps-grand-total-display">Rp 0</span>
                </div>
            </div>

            <div class="form-group">
                <label for="f-catatan">Catatan</label>
                <textarea id="f-catatan" rows="3" placeholder="Catatan penjualan...">${esc(data.catatan)}</textarea>
            </div>
        </div>
    `;
}

function buildItemRow(item, idx) {
    return `
        <div class="ps-item-row" data-index="${idx}">
            <span class="ps-col-code" data-label="Kode">
                <span class="kode-scan-wrapper">
                    <input type="text" class="ps-item-kode" value="${esc(item.kode)}" placeholder="Kode" list="ps-barang-list-${pageId}" data-index="${idx}" />
                    ${scanButtonHTML(`data-scan-index="${idx}"`)}
                </span>
            </span>
            <span class="ps-col-name" data-label="Nama Barang">
                <input type="text" class="ps-item-nama" value="${esc(item.nama)}" placeholder="Nama barang" list="ps-nama-list-${pageId}" data-index="${idx}" />
            </span>
            <span class="ps-col-qty" data-label="Qty">
                <input type="text" inputmode="numeric" class="ps-item-qty" value="${esc(formatThousand(item.qty || 0))}" data-index="${idx}" />
            </span>
            <span class="ps-col-satuan" data-label="Satuan">
                <input type="text" class="ps-item-satuan" value="${esc(item.satuan || '')}" readonly data-index="${idx}" />
            </span>
            <span class="ps-col-price" data-label="Harga">
                <input type="text" inputmode="numeric" class="ps-item-harga" value="${esc(formatThousand(item.harga || 0))}" data-index="${idx}" />
            </span>
            <span class="ps-col-diskon" data-label="Diskon">
                <input type="text" inputmode="numeric" class="ps-item-diskon" value="${esc(formatThousand(item.diskon || 0))}" data-index="${idx}" />
            </span>
            <span class="ps-col-subtotal" data-label="Subtotal">
                <input type="text" class="ps-item-subtotal" value="${esc(formatThousand(item.subtotal || 0))}" readonly data-index="${idx}" />
            </span>
            <span class="ps-col-action" data-label="">
                <button type="button" class="ps-item-remove" data-index="${idx}" title="Hapus item">Tutup</button>
            </span>
        </div>
    `;
}

function populateWarehouseDropdown(warehouses, selected) {
    const sel = document.getElementById("f-kirim-dari");
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

function populateCustomerDropdown(customers, selected) {
    const sel = document.getElementById("f-pelanggan");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih Pelanggan —</option>`;
    for (const c of customers) {
        const code = c.kode || c._id || "";
        const name = c.nama || code;
        const alamat = c.alamat || "";
        sel.innerHTML += `<option value="${esc(code)}" data-name="${esc(name)}" data-alamat="${esc(alamat)}" ${code === selected ? "selected" : ""}>${esc(code)} - ${esc(name)}</option>`;
    }
    if (selected && !customers.find(c => (c.kode || c._id || "") === selected)) {
        sel.innerHTML += `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
    }
}

function populateSalesDropdown(salesPersons, selected) {
    const sel = document.getElementById("f-sales");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih Sales —</option>`;
    for (const s of salesPersons) {
        const code = s.kode || s._id || "";
        const name = s.nama || code;
        sel.innerHTML += `<option value="${esc(code)}" data-name="${esc(name)}" ${code === selected ? "selected" : ""}>${esc(code)} - ${esc(name)}</option>`;
    }
    if (selected && !salesPersons.find(s => (s.kode || s._id || "") === selected)) {
        sel.innerHTML += `<option value="${esc(selected)}" selected>${esc(selected)}</option>`;
    }
}

function renderItemRows(barangs, items) {
    const body = document.getElementById("ps-items-body");
    if (!body) return;
    body.innerHTML = items.length > 0
        ? items.map((item, idx) => buildItemRow(item, idx)).join("")
        : '<div class="ps-empty-items">Belum ada item. Klik "Tambah Item" untuk menambahkan barang.</div>';
}

function initItemRowEvents(barangs) {
    document.querySelectorAll(".ps-item-qty, .ps-item-harga, .ps-item-diskon").forEach(inp => {
        // Digit-only + format ribuan (fokus → angka mentah, blur → format ulang)
        inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); });
        inp.addEventListener("focus", () => { inp.value = String(unformatThousand(inp.value)); });
        inp.addEventListener("blur", () => { inp.value = formatThousand(unformatThousand(inp.value)); });
        inp.addEventListener("input", recalcRow);
        inp.addEventListener("change", recalcRow);
    });

    // Stock validation on qty change
    document.querySelectorAll(".ps-item-qty").forEach(inp => {
        inp.addEventListener("change", function validateStock() {
            const row = this.closest(".ps-item-row");
            if (!row) return;
            const idx = row.dataset.index;
            const kodeInput = document.querySelector(`.ps-item-kode[data-index="${idx}"]`);
            if (!kodeInput) return;
            const kode = kodeInput.value.trim();
            if (!kode) return;
            const qty = unformatThousand(this.value);
            const stok = _barangStockMap[kode] || 0;
            if (qty > stok) {
                showToast("warning", `Stok ${esc(kode)} tinggal ${stok}, silahkan isi dengan jumlah yang lebih kecil`);
                this.value = formatThousand(stok);
                recalcRow({ target: this });
            }
        });
    });

    document.querySelectorAll(".ps-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const row = btn.closest(".ps-item-row");
            if (row) {
                row.remove();
                reindexRows();
                calcTotals();
            }
        });
    });

    document.querySelectorAll(".ps-item-kode, .ps-item-nama").forEach(inp => {
        inp.addEventListener("blur", () => findAndFillBarang(inp, barangs));
    });
}

function findAndFillBarang(inputEl, barangs) {
    const val = inputEl.value.trim();
    if (!val) return;
    const barang = barangs.find(b => b.kode === val || b.nama === val);
    if (!barang) return;
    const idx = inputEl.dataset.index;
    const kodeInput = document.querySelector(`.ps-item-kode[data-index="${idx}"]`);
    const namaInput = document.querySelector(`.ps-item-nama[data-index="${idx}"]`);
    const satuanInput = document.querySelector(`.ps-item-satuan[data-index="${idx}"]`);
    const hargaInput = document.querySelector(`.ps-item-harga[data-index="${idx}"]`);
    if (kodeInput) kodeInput.value = barang.kode || "";
    if (namaInput) namaInput.value = barang.nama || "";
    let satuan = barang.satuan || "";
    let stok = Number(barang.stok) || 0;
    if (!satuan && inputEl.list) {
        const opt = Array.from(inputEl.list.options).find(o => o.value === val);
        if (opt) {
            satuan = opt.getAttribute("data-satuan") || "";
            const stokAttr = opt.getAttribute("data-stok");
            if (stokAttr) stok = Number(stokAttr) || 0;
        }
    }
    if (satuanInput) satuanInput.value = satuan;
    if (hargaInput) { hargaInput.value = formatThousand(barang.harga_jual || barang.harga_beli || 0); recalcRow({ target: hargaInput }); }
    // Update stock map
    if (barang.kode) _barangStockMap[barang.kode] = stok;
    // Stock validation: cek qty jika sudah terisi sebelumnya
    const qtyInput = document.querySelector(`.ps-item-qty[data-index="${idx}"]`);
    if (qtyInput) {
        const currentQty = unformatThousand(qtyInput.value);
        if (currentQty > stok) {
            // Jalankan validasi seperti di initItemRowEvents
            const evt = new Event("change", { bubbles: true });
            qtyInput.dispatchEvent(evt);
        }
    }
}

function attachAddItemBtn(barangs) {
    document.getElementById("ps-add-item-btn")?.addEventListener("click", function addItemHandler() {
        const body = document.getElementById("ps-items-body");
        if (!body) return;
        const idx = document.querySelectorAll(".ps-item-row").length;
        const emptyMsg = body.querySelector(".ps-empty-items");
        if (emptyMsg) emptyMsg.remove();
        body.insertAdjacentHTML("beforeend", buildItemRow({ kode: "", nama: "", qty: 0, harga: 0, subtotal: 0 }, idx));
        initItemRowEvents(barangs);
        calcTotals();
    });
}

function recalcRow(e) {
    const row = e.target.closest(".ps-item-row");
    if (!row) return;
    const idx = row.dataset.index;
    const qty = unformatThousand(document.querySelector(`.ps-item-qty[data-index="${idx}"]`)?.value);
    const harga = unformatThousand(document.querySelector(`.ps-item-harga[data-index="${idx}"]`)?.value);
    const diskon = unformatThousand(document.querySelector(`.ps-item-diskon[data-index="${idx}"]`)?.value);
    const subtotalEl = document.querySelector(`.ps-item-subtotal[data-index="${idx}"]`);
    const subtotal = Math.max(0, (qty * harga) - diskon);
    if (subtotalEl) {
        subtotalEl.value = formatThousand(subtotal);
    }
    calcTotals();
}

function calcTotals() {
    let total = 0;
    document.querySelectorAll(".ps-item-row").forEach(row => {
        const idx = row.dataset.index;
        const qty = unformatThousand(document.querySelector(`.ps-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.ps-item-harga[data-index="${idx}"]`)?.value);
        const diskon = unformatThousand(document.querySelector(`.ps-item-diskon[data-index="${idx}"]`)?.value);
        total += Math.max(0, (qty * harga) - diskon);
    });
    const diskon = unformatThousand(document.getElementById("f-diskon")?.value);
    const grandTotal = Math.max(0, total - diskon);

    const totalEl = document.getElementById("ps-total-display");
    const grandEl = document.getElementById("ps-grand-total-display");
    if (totalEl) totalEl.textContent = services.formatRupiah ? services.formatRupiah(total) : total.toLocaleString();
    if (grandEl) grandEl.textContent = "Rp " + (services.formatRupiah ? services.formatRupiah(grandTotal) : grandTotal.toLocaleString());
}

function reindexRows() {
    document.querySelectorAll(".ps-item-row").forEach((row, idx) => {
        row.dataset.index = idx;
        row.querySelectorAll("[data-index]").forEach(el => el.dataset.index = idx);
    });
}

// ═══════════════════════════════════════════════
//  Form Submit
// ═══════════════════════════════════════════════

async function handleSubmit(overlay, existingData, editId) {
    const pelanggan = document.getElementById("f-pelanggan")?.value;
    const tanggal = document.getElementById("f-tanggal")?.value;
    const diskon = unformatThousand(document.getElementById("f-diskon")?.value);
    const catatan = document.getElementById("f-catatan")?.value || "";
    const noPoPelanggan = document.getElementById("f-no-po")?.value || "";

    if (!pelanggan) {
        document.getElementById("f-pelanggan")?.focus();
        showToast("danger", "Pelanggan wajib diisi");
        return;
    }

    const itemRows = document.querySelectorAll(".ps-item-row");
    if (itemRows.length === 0) {
        showToast("danger", "Minimal 1 item barang harus ditambahkan");
        return;
    }

    const items = [];
    for (const row of itemRows) {
        const idx = row.dataset.index;
        const kode = document.querySelector(`.ps-item-kode[data-index="${idx}"]`)?.value.trim() || "";
        const nama = document.querySelector(`.ps-item-nama[data-index="${idx}"]`)?.value.trim() || "";
        const qty = unformatThousand(document.querySelector(`.ps-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.ps-item-harga[data-index="${idx}"]`)?.value);

        if (!kode && !nama) continue;
        if (qty <= 0) {
            showToast("danger", `Qty untuk "${nama || kode}" harus lebih dari 0`);
            return;
        }
        if (harga <= 0) {
            showToast("danger", `Harga untuk "${nama || kode}" harus diisi`);
            return;
        }
        // Stock validation sebelum submit
        const availableStock = _barangStockMap[kode] || 0;
        if (kode && qty > availableStock) {
            showToast("warning", `Stok ${esc(kode)} (${esc(nama)}) tinggal ${availableStock}, tidak bisa menjual ${qty}. Silakan kurangi jumlahnya.`);
            return;
        }

        const pelangganSel = document.getElementById("f-pelanggan");
        const pelangganNama = pelangganSel?.selectedOptions?.[0]?.getAttribute("data-name") || pelanggan;

        const satuan = document.querySelector(`.ps-item-satuan[data-index="${idx}"]`)?.value?.trim() || "";
        const diskonItem = unformatThousand(document.querySelector(`.ps-item-diskon[data-index="${idx}"]`)?.value);

        items.push({ kode, nama, satuan, qty, harga, diskon: diskonItem, subtotal: Math.max(0, (qty * harga) - diskonItem) });
    }

    if (items.length === 0) {
        showToast("danger", "Minimal 1 item barang dengan qty > 0 harus ditambahkan");
        return;
    }

    const currentUser = getCurrentUserName() || "System";
    const kirimDariSel = document.getElementById("f-kirim-dari");
    const kirimDari = kirimDariSel?.value || "";
    const kirimDariNama = kirimDariSel?.selectedOptions?.[0]?.getAttribute("data-name") || kirimDari;
    const salesSel = document.getElementById("f-sales");
    const salesNama = salesSel?.selectedOptions?.[0]?.getAttribute("data-name") || "";
    const sales = salesNama;

    const payload = {
        tanggal: tanggal || new Date().toISOString(),
        pelanggan,
        pelangganNama: (document.getElementById("f-pelanggan")?.selectedOptions?.[0]?.getAttribute("data-name")) || pelanggan,
        pelangganAlamat: (document.getElementById("f-pelanggan")?.selectedOptions?.[0]?.getAttribute("data-alamat")) || "",
        noPoPelanggan,
        sales,
        kirimDari,
        kirimDariNama,
        items,
        diskon,
        catatan,
        createdBy: currentUser
    };

    try {
        if (editId) {
            await services.updatePenjualan(editId, payload);
            showToast("success", "SO berhasil diperbarui");
        } else {
            await services.createPenjualan(payload);
            showToast("success", "SO berhasil dibuat");
        }
        removeModal(overlay);
        loadData();
    } catch (err) {
        showToast("danger", "Gagal menyimpan: " + err.message);
    }
}

// ═══════════════════════════════════════════════
//  Print Functions
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
        } catch (e) { console.warn("[Penjualan] getCompanyInfo DI failed:", e); }
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
    try {
        return await services.getPenjualan(id);
    } catch { return null; }
}

// printToWindow diimpor dari @smart/ui — shared utility untuk cetak langsung ke dialog print

// ── Print SO ──

async function printSO(id) {
    const item = await getItem(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
    await printSOHTML(item);
}

async function printSOHTML(item) {
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
    } catch (e) { console.warn("[Penjualan] SO QR generation failed:", e); }

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

    const html = buildPrintDocument({
        title: "SALES ORDER",
        nomor: item.nomor,
        companyName, companyAddress, companyPhone, companyEmail, logoUrl,
        infoGrid: `
            <div class="invoice-info-item"><div class="invoice-info-label">Pelanggan</div><div class="invoice-info-value">${esc(item.pelangganNama || item.pelanggan)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Tanggal</div><div class="invoice-info-value">${formatDate(item.tanggal)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">No. PO Pelanggan</div><div class="invoice-info-value">${esc(item.noPoPelanggan || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Kirim Dari</div><div class="invoice-info-value">${esc(item.kirimDariNama || item.kirimDari || '-')}</div></div>
        `,
        itemsHTML,
        total: item.total,
        diskon: item.diskon,
        grandTotal: item.grandTotal || item.total,
        catatan: item.catatan,
        nomorLabel: "No. SO",
        showQr: true,
        qrDataUrl,
        showSignatures: true,
        singleSignature: true,
        signatureLeftLabel: "Dibuat oleh",
        signatureLeftName: item.sales || getCurrentUserName() || "_______________"
    });

    printToWindow(html);
}

// ── Print Surat Jalan ──

async function printSuratJalan(id) {
    const item = await getItem(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
    if (!item.noSuratJalan) { showToast("warning", "Surat Jalan belum diterbitkan"); return; }
    await printSuratJalanHTML(item);
}

async function printSuratJalanHTML(item) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";
    const logoUrl = company.logo || "";

        // Generate QR code
    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.noSuratJalan, { width: 200, margin: 1 });
    } catch (e) { console.warn("[Penjualan] QR generation failed:", e); }

    const itemsHTML = (item.items || []).map((i, idx) => `
        <tr>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${idx + 1}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.kode)}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${i.qty}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e2e8f0;">${esc(i.satuan || '-')}</td>
            <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:0.8rem;">${esc(i.keterangan || '')}</td>
        </tr>
    `).join("");

    const html = buildPrintDocument({
        title: "SURAT JALAN",
        nomor: item.noSuratJalan,
        companyName, companyAddress, companyPhone, companyEmail, logoUrl,
        infoGrid: `
            <div class="invoice-info-item"><div class="invoice-info-label">Pelanggan</div><div class="invoice-info-value">${esc(item.pelangganNama || item.pelanggan)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Alamat</div><div class="invoice-info-value">${esc(item.pelangganAlamat || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Tanggal</div><div class="invoice-info-value">${formatDate(item.tanggal)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">No. SO</div><div class="invoice-info-value">${esc(item.nomor)}</div></div>
        `,
        itemsHTML,
        total: 0,
        diskon: 0,
        grandTotal: 0,
        catatan: item.catatan,
        nomorLabel: "No. Surat Jalan",
        showQr: true,
        qrDataUrl,
        showTotals: false,
        showSignatures: true,
        signatureLeftLabel: "Penerima",
        signatureRightLabel: "Pengirim",
        signatureLeftName: "",
        signatureRightName: "",
        tableHeaders: `<tr>
                            <th style="width:36px">No</th>
                            <th style="width:80px">Kode</th>
                            <th style="width:160px">Nama Barang</th>
                            <th style="width:40px">Qty</th>
                            <th style="width:60px">Satuan</th>
                            <th style="width:120px">Keterangan</th>
                        </tr>`
    });

    printToWindow(html);
}

// ── Print Invoice ──

async function printInvoice(id) {
    const item = await getItem(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
    if (!item.noInvoice) { showToast("warning", "Invoice belum diterbitkan"); return; }
    await printInvoiceNormal(item);
}

async function printInvoiceNormal(item) {
    await printInvoiceHTML(item, false);
}

async function printInvoiceThermal(item) {
    await printInvoiceHTML(item, true);
}

async function printInvoiceHTML(item, isThermal) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";
    const logoUrl = company.logo || "";

    // Generate QR code
    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.noInvoice, { width: 200, margin: 1 });
    } catch (e) { console.warn("[Penjualan] Invoice QR generation failed:", e); }

    if (isThermal) {
        await printInvoiceThermalHTML(item, company);
        return;
    }

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

    const html = buildPrintDocument({
        title: "INVOICE",
        nomor: item.noInvoice,
        companyName, companyAddress, companyPhone, companyEmail, logoUrl,
        infoGrid: `
            <div class="invoice-info-item"><div class="invoice-info-label">Kepada</div><div class="invoice-info-value">${esc(item.pelangganNama || item.pelanggan)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Alamat</div><div class="invoice-info-value">${esc(item.pelangganAlamat || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">No. Surat Jalan</div><div class="invoice-info-value">${esc(item.noSuratJalan || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Tanggal Kirim</div><div class="invoice-info-value">${formatDate(item.tanggal)}</div></div>
        `,
        itemsHTML,
        total: item.total,
        diskon: item.diskon,
        grandTotal: item.grandTotal || item.total,
        catatan: item.catatan,
        nomorLabel: "No. Invoice",
        showQr: true,
        qrDataUrl,
        showSignatures: true,
        singleSignature: true,
        signatureLeftLabel: "Dibuat oleh",
        signatureLeftName: company.bendahara || company.orgBendahara || "_______________",
        company
    });

    printToWindow(html);
}

async function printInvoiceThermalHTML(item, company) {
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "";
    const companyPhone = company.phone || "";
    const logoUrl = company.logo || "";

    const itemsHTML = (item.items || []).map(i => `
        <tr>
            <td style="padding:2px 0;font-size:9px;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:2px 0;font-size:9px;">${i.qty}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${services.formatRupiah ? services.formatRupiah(i.harga) : i.harga.toLocaleString()}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${services.formatRupiah ? services.formatRupiah(i.subtotal) : i.subtotal.toLocaleString()}</td>
        </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Invoice - ${esc(item.noInvoice)}</title>
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
    .total { text-align:right; font-size:10px; font-weight:bold; margin-top:3px; }
    .footer { text-align:center; font-size:8px; margin-top:6px; }
    @media print { body { width:72mm; } }
</style></head>
<body>
    <div class="header">
        ${logoUrl ? `<img src="${esc(logoUrl)}" />` : ""}
        <div class="name">${esc(companyName)}</div>
        ${companyAddress ? `<div class="addr">${esc(companyAddress)}</div>` : ""}
        ${companyPhone ? `<div class="addr">Telp: ${esc(companyPhone)}</div>` : ""}
    </div>
    <div class="divider"></div>
    <div class="info">
        Invoice: ${esc(item.noInvoice)}<br/>
        Tanggal: ${formatDate(item.tanggal)}<br/>
        Pelanggan: ${esc(item.pelangganNama || item.pelanggan)}<br/>
        SO: ${esc(item.nomor)}
    </div>
    <div class="divider"></div>
    <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Harga</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
    </table>
    <div class="divider"></div>
    ${item.diskon > 0 ? `<div style="text-align:right;font-size:9px;">Diskon: -${services.formatRupiah ? services.formatRupiah(item.diskon) : item.diskon.toLocaleString()}</div>` : ""}
    <div class="total">Grand Total: Rp ${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</div>
    ${item.catatan ? `<div style="font-size:8px;margin-top:3px;">Catatan: ${esc(item.catatan)}</div>` : ""}
    <div class="divider"></div>
    <div class="footer">Terima Kasih</div>
    <script>window.print();window.close();<\\/script>
</body></html>`;

    printToWindow(html);
}

// ── Print Nota ──

async function printNota(id) {
    const item = await getItem(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
    showNotaPrintChoice(item);
}

async function showNotaPrintChoice(item) {
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-nota-thermal">🧾 Cetak Struk Thermal</button>
        <button class="smart-btn smart-db-primary" id="f-nota-normal">📄 Cetak Normal</button>
    `;

    const overlay = Modal({
        open: true,
        title: "📋 Cetak Nota",
        content: `<p>Pilih format cetak untuk Nota <strong>${esc(item.noInvoice || item.nomor)}</strong></p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-nota-thermal")?.addEventListener("click", () => {
        removeModal(overlay);
        printNotaThermal(item);
    });
    document.getElementById("f-nota-normal")?.addEventListener("click", () => {
        removeModal(overlay);
        printNotaNormal(item);
    });
}

async function printNotaNormal(item) {
    await printNotaHTML(item, false);
}

async function printNotaThermal(item) {
    await printNotaHTML(item, true);
}

async function printNotaHTML(item, isThermal) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";
    const logoUrl = company.logo || "";

    // Generate QR code
    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.noInvoice || item.nomor, { width: 200, margin: 1 });
    } catch (e) { console.warn("[Penjualan] Nota QR generation failed:", e); }

    if (isThermal) {
        await printNotaThermalHTML(item, company);
        return;
    }

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

    const html = buildPrintDocument({
        title: "NOTA PENJUALAN",
        nomor: "No. " + (item.noInvoice || item.nomor),
        companyName, companyAddress, companyPhone, companyEmail, logoUrl,
        infoGrid: `
            <div class="invoice-info-item"><div class="invoice-info-label">Kepada</div><div class="invoice-info-value">${esc(item.pelangganNama || item.pelanggan)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Alamat</div><div class="invoice-info-value">${esc(item.pelangganAlamat || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">No. Surat Jalan</div><div class="invoice-info-value">${esc(item.noSuratJalan || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Tanggal Kirim</div><div class="invoice-info-value">${formatDate(item.tanggal)}</div></div>
        `,
        itemsHTML,
        total: item.total,
        diskon: item.diskon,
        pajak: Number(item.pajak) || 0,
        grandTotal: item.grandTotal || item.total,
        catatan: item.catatan,
        nomorLabel: "No. Nota",
        showQr: true,
        qrDataUrl,
        showSignatures: true,
        singleSignature: true,
        signatureLeftLabel: "Dibuat oleh",
        signatureLeftName: company.bendahara || company.orgBendahara || "_______________",
        company
    });

    printToWindow(html);
}

async function printNotaThermalHTML(item, company) {
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "";
    const companyPhone = company.phone || "";
    const logoUrl = company.logo || "";
    const rp = (v) => services.formatRupiah ? services.formatRupiah(v) : (Number(v) || 0).toLocaleString();
    // M3-FIX v21 — struk PERSIS kasir (judul "Nota Penjualan") HANYA untuk
    // transaksi kasir (sumber "pos"); dokumen SO (inventory) tetap memakai
    // layout nota lama agar tidak merusak alur SO/SJ/Invoice.
    const isKasirStruk = services.isPos || String(item.sumber || "") === "pos";

    const itemsHTML = (item.items || []).map(i => `
        <tr>
            <td style="padding:2px 0;font-size:9px;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:2px 0;font-size:9px;">${i.qty}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${rp(i.harga)}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${rp(i.subtotal)}</td>
        </tr>
    `).join("");

    // M3-FIX v21 — struk admin dibuat PERSIS dengan struk kasir (printNotaThermal
    // di halaman kasir): nama perusahaan kecil, judul "Nota Penjualan" besar,
    // field No. Nota/Tgl/Kasir/Gudang/Pelanggan-Member + Subtotal/Diskon/Pajak/
    // TOTAL/Dibayar/Kembali/Metode + footer Terima Kasih.
    const memberLine = String(item.tipePelanggan || "").toLowerCase() === "member"
        ? `<div class="info">Member: ${esc(item.pelangganNama || item.pelanggan || "-")}</div>`
        : `<div class="info">Pelanggan: Umum</div>`;
    const metodeLabel = ({ cash: "Tunai", transfer: "Transfer", qris: "QRIS", card: "Kartu" })[item.metode_bayar] || "Tunai";

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Nota - ${esc(item.noKwitansi || item.nomor)}</title>
<style>
    @page { margin:0; size:80mm auto; }
    body { font-family:'Courier New',Courier,monospace; margin:0; padding:4mm; width:72mm; color:#000; font-size:9px; line-height:1.3; }
    .header { text-align:center; margin-bottom:4px; }
    .header img { max-width:${isKasirStruk ? "50px" : "60px"}; max-height:${isKasirStruk ? "30px" : "40px"}; }
    .header .name { font-size:${isKasirStruk ? "8px" : "11px"}; ${isKasirStruk ? "" : "font-weight:bold;"} }
    .header .addr { font-size:${isKasirStruk ? "13px" : "8px"}; ${isKasirStruk ? "font-weight:bold;" : "color:#333;"} }
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
        ${isKasirStruk ? `<div class="addr">Nota Penjualan</div>` : (companyAddress ? `<div class="addr">${esc(companyAddress)}</div>` : "")}
        ${!isKasirStruk && companyPhone ? `<div class="addr">Telp: ${esc(companyPhone)}</div>` : ""}
    </div>
    <div class="divider"></div>
    ${isKasirStruk ? `
    <div class="info">No. Nota: ${esc(item.noKwitansi || item.nomor)}</div>
    <div class="info">Tgl: ${new Date(item.tanggal || Date.now()).toLocaleString("id-ID")}</div>
    <div class="info">Kasir: ${esc(item.kasir || "-")}</div>
    ${item.gudang ? `<div class="info">Gudang: ${esc(item.gudang)}</div>` : ""}
    ${memberLine}
    ` : `
    <div class="info">
        Nota: ${esc(item.noInvoice || item.nomor)}<br/>
        Tanggal: ${formatDate(item.tanggal)}<br/>
        Pelanggan: ${esc(item.pelangganNama || item.pelanggan)}<br/>
        SJ: ${esc(item.noSuratJalan || '-')}
    </div>
    `}
    <div class="divider"></div>
    <table>
        <thead><tr><th>${isKasirStruk ? "Nama" : "Item"}</th><th style="text-align:center">Qty</th>${isKasirStruk ? "" : `<th style="text-align:right">Harga</th>`}<th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
    </table>
    <div class="divider"></div>
    ${isKasirStruk ? `
    <div style="text-align:right;font-size:9px;">Subtotal: ${rp(item.total)}</div>
    ${item.diskon ? `<div style="text-align:right;font-size:9px;">Diskon: -${rp(item.diskon)}</div>` : ""}
    ${item.pajak ? `<div style="text-align:right;font-size:9px;">Pajak: ${rp(item.pajak)}</div>` : ""}
    <div class="total">TOTAL: ${rp(item.grandTotal || item.total)}</div>
    <div style="text-align:right;font-size:9px;">Dibayar: ${rp(item.bayar)}</div>
    <div style="text-align:right;font-size:9px;">Kembali: ${rp(item.kembalian)}</div>
    <div style="text-align:right;font-size:9px;">Metode: ${metodeLabel}</div>
    ` : `
    ${item.diskon > 0 ? `<div style="text-align:right;font-size:9px;">Diskon: -${services.formatRupiah ? services.formatRupiah(item.diskon) : item.diskon.toLocaleString()}</div>` : ""}
    <div class="total">Grand Total: Rp ${services.formatRupiah ? services.formatRupiah(item.grandTotal || item.total) : (item.grandTotal || item.total).toLocaleString()}</div>
    ${item.catatan ? `<div style="font-size:8px;margin-top:3px;">Catatan: ${esc(item.catatan)}</div>` : ""}
    `}
    <div class="divider"></div>
    <div class="footer">Terima Kasih</div>
    <script>window.print();window.close();<\\/script>
</body></html>`;

    printToWindow(html);
}

// ── Print Kwitansi ──

async function printKwitansi(id) {
    const item = await getItem(id);
    if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
    if (!item.noKwitansi) { showToast("warning", "Kwitansi belum diterbitkan"); return; }

    // Transaksi kasir (sumber=pos) hanya punya NOTA — cetak ukuran thermal 72mm
    if (item.sumber === "pos") {
        await printKwitansiThermal(item);
    } else {
        await printKwitansiNormal(item);
    }
}

async function printKwitansiNormal(item) {
    await printKwitansiHTML(item);
}

async function printKwitansiThermal(item) {
    await printKwitansiThermalHTML(item);
}

async function printKwitansiHTML(item) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";
    const logoUrl = company.logo || "";

    const grandTotal = item.grandTotal || item.total || 0;
    const terbilang = numberToWords(grandTotal);
    const tanggal = formatDate(item.tanggal);
    const customerName = item.pelangganNama || item.pelanggan || "-";
    const customerAlamat = item.pelangganAlamat || "";
    const customerInfo = customerAlamat ? `${esc(customerName)}, ${esc(customerAlamat)}` : esc(customerName);
    const paymentDesc = `Pembayaran atas Pembelian dengan No. ${esc(item.noInvoice || item.nomor || '-')}`;

    // Extract city from company address
    function extractCity(addr) {
        if (!addr) return "";
        // Coba ambil setelah ' - ' (format umum: ...Kecamatan - Kota)
        const dashIdx = addr.lastIndexOf(" - ");
        if (dashIdx !== -1) return addr.substring(dashIdx + 3).trim();
        // Fallback: ambil setelah koma terakhir
        const commaIdx = addr.lastIndexOf(",");
        if (commaIdx !== -1) return addr.substring(commaIdx + 1).trim();
        // Fallback: ambil kata terakhir
        const parts = addr.trim().split(/\s+/);
        return parts[parts.length - 1] || "";
    }
    const kota = extractCity(company.address || "");
    // Format date — ganti day name dengan kota
    const rawDateStr = formatDateID(item.tanggal); // "Minggu, 26 Juli 2026"
    const dateParts = rawDateStr.split(', ');
    const cityDateStr = kota ? `${esc(kota)}, ${dateParts.slice(1).join(', ')}` : rawDateStr;

    // Generate QR
    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.noKwitansi, { width: 200, margin: 1 });
    } catch (e) { console.warn("[Penjualan] Kwitansi QR failed:", e); }

    // Colors matching Invoice/SJ/Nota scheme (blue/indigo professional)
    const accentColor = "#3b82f6";       // blue-500
    const accentDark = "#2563eb";        // blue-600
    const accentLight = "#eff6ff";       // blue-50
    const accentBorder = "#bfdbfe";      // blue-200
    const textColor = "#1e293b";         // slate-800

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>${item.sumber === "pos" ? "Nota" : "Kwitansi"} - ${esc(item.noKwitansi)}</title>
<style>
    @page { margin:0; }
    body { font-family:'Segoe UI',system-ui,sans-serif; margin:0; padding:0; color:${textColor}; background:#fff; }
    .receipt { max-width:700px; margin:0 auto; padding:2rem 1.5rem; position:relative; overflow:hidden; }
    .receipt::before {
        content:''; position:absolute; bottom:-50px; left:-50px;
        width:140px; height:140px;
        background-image:repeating-radial-gradient(${accentColor}33 0, ${accentColor}33 2px, transparent 3px, transparent 10px);
        border-radius:50%; opacity:0.5;
    }
    .header { display:flex; justify-content:space-between; align-items:end; border-bottom:2px solid ${accentColor}; padding-bottom:0.5rem; margin-bottom:1.5rem; }
    .header-left { display:flex; align-items:center; gap:1rem; }
    .header-left img { max-height:70px; max-width:100px; }
    .header-left .name { font-size:1rem; font-weight:700; text-transform:uppercase; color:${accentDark}; margin-bottom:0.25rem; }
    .header-left .addr { font-size:0.75rem; color:#64748b; line-height:1.3; }
    .header-left .contact { font-size:0.7rem; color:#64748b; }
    .title { font-family:'Times New Roman',serif; font-size:2.5rem; font-weight:bold; color:${accentColor}; margin-bottom:0; }
    .doc-no { font-size:0.85rem; color:#475569; font-weight:600; margin-bottom:1rem; }
    .info-table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }
    .info-table td { padding:4px 0; vertical-align:top; }
    .info-table td:first-child { width:160px; font-weight:600; color:#475569; font-size:0.85rem; }
    .info-table td.label-cell { border-bottom:1px solid ${accentBorder}; padding-bottom:6px; }
    .info-table td.value-cell { border-bottom:1px solid ${accentBorder}; padding-bottom:6px; }
    .info-table td.value-cell .col-label { display:inline-block; width:20px; color:#94a3b8; }
    .info-table td.value-cell .col-value { color:${textColor}; }
    .terbilang-box { background:${accentLight}; border:1px solid ${accentBorder}; border-radius:8px; padding:12px 16px; margin-bottom:1.5rem; }
    .terbilang-box .amount-words { font-size:0.85rem; color:${accentDark}; font-weight:600; }
    .terbilang-box .amount-desc { font-size:0.75rem; color:#64748b; margin-top:4px; }
    .footer-row { display:flex; justify-content:space-between; align-items:flex-start; margin-top:1.5rem; }
    .amount-box { background:${accentColor}; color:#fff; padding:0.75rem 2rem; font-weight:700; font-size:1.25rem; transform:skewX(-20deg); display:inline-block; }
    .amount-box span { display:inline-block; transform:skewX(20deg); }
    .signature-area { text-align:center; }
    .signature-area .city-date { font-size:0.85rem; color:#475569; margin-bottom:0.25rem; }
    .signature-area .company-name { font-weight:700; text-transform:uppercase; margin-bottom:3rem; font-size:0.85rem; }
    .signature-area .signer-name { font-weight:700; text-decoration:underline; margin-bottom:0; font-size:0.85rem; }
    .signature-area .signer-label { font-size:0.7rem; color:#64748b; }
    .qr-area { display:flex; align-items:center; gap:8px; margin-top:1rem; }
    .qr-area img { width:70px; height:70px; border-radius:4px; }
    .qr-area .qr-label { font-size:0.65rem; color:#94a3b8; }
</style></head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="header-left">
                ${logoUrl ? `<img src="${esc(logoUrl)}" />` : ""}
                <div>
                    <div class="name">${esc(companyName)}</div>
                    ${companyAddress ? `<div class="addr">${esc(companyAddress)}</div>` : ""}
                    <div class="contact">${companyPhone ? `Telp: ${esc(companyPhone)}` : ""}${companyEmail ? ` | Email: ${esc(companyEmail)}` : ""}</div>
                </div>
            </div>
            <div class="title">${item.sumber === "pos" ? "NOTA" : "KWITANSI"}</div>
        </div>

        <div class="doc-no">${item.sumber === "pos" ? "No. Nota: " : "No. "}${esc(item.noKwitansi)}</div>

        <table class="info-table">
            <tr><td class="label-cell">Sudah terima dari</td><td class="value-cell"><span class="col-label">:</span><span class="col-value"><strong>${customerInfo}</strong></span></td></tr>
            <tr><td class="label-cell">Banyaknya uang</td><td class="value-cell"><span class="col-label">:</span><span class="col-value"><em>${esc(terbilang)} Rupiah</em></span></td></tr>
            <tr><td class="label-cell">Untuk pembayaran</td><td class="value-cell"><span class="col-label">:</span><span class="col-value">${esc(paymentDesc)}</span></td></tr>
        </table>

        <div class="terbilang-box">
            <div class="amount-words"># ${esc(terbilang)} Rupiah</div>
            <div class="amount-desc">Telah diterima pembayaran sejumlah tersebut di atas</div>
        </div>

        <div class="footer-row">
            <div>
                <div class="amount-box"><span>Rp ${grandTotal.toLocaleString('id-ID')},-</span></div>
                <div class="qr-area">
                    ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : ""}
                    ${qrDataUrl ? `<div class="qr-label">Scan untuk verifikasi</div>` : ""}
                </div>
            </div>
            <div class="signature-area">
                <div class="city-date">${cityDateStr}</div>
                <div class="company-name">${esc(companyName)}</div>
                <div style="height:34px;"></div>
                <div class="signer-name">${esc(company.bendahara || company.orgBendahara || '_______________')}</div>
                <div class="signer-label">Bendahara</div>
            </div>
        </div>
    </div>
    <script>window.print();window.close();<\\/script>
</body></html>`;

    printToWindow(html);
}

async function printKwitansiThermalHTML(item) {
    const company = await getCompanyInfo();
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyPhone = company.phone || "";
    const logoUrl = company.logo || "";
    const grandTotal = item.grandTotal || item.total || 0;

    const itemsHTML = (item.items || []).map(i => `
        <tr>
            <td style="padding:2px 0;font-size:9px;">${esc(i.nama)} x${i.qty}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${services.formatRupiah ? services.formatRupiah(i.subtotal) : i.subtotal.toLocaleString()}</td>
        </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>${item.sumber === "pos" ? "Nota" : "Kwitansi"} - ${esc(item.noKwitansi)}</title>
<style>
    @page { margin:0; size:80mm auto; }
    body { font-family:'Courier New',Courier,monospace; margin:0; padding:4mm; width:72mm; color:#000; font-size:9px; line-height:1.3; }
    .header { text-align:center; margin-bottom:4px; }
    .header img { max-width:60px; max-height:40px; }
    .header .name { font-size:11px; font-weight:bold; }
    .header .title { font-size:14px; font-weight:bold; margin-top:2px; }
    .divider { border-top:1px dashed #000; margin:3px 0; }
    .info { font-size:8px; margin-bottom:3px; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:8px; border-bottom:1px solid #000; padding:2px 0; }
    td { font-size:9px; padding:2px 0; }
    .total { text-align:right; font-size:14px; font-weight:bold; margin-top:3px; }
    .terbilang { font-size:9px; font-style:italic; margin:3px 0; padding:3px; background:#f0fdf4; }
    .footer { text-align:center; font-size:8px; margin-top:6px; }
    @media print { body { width:72mm; } }
</style></head>
<body>
    <div class="header">
        ${logoUrl ? `<img src="${esc(logoUrl)}" />` : ""}
        <div class="name">${esc(companyName)}</div>
        <div class="title">K W I T A N S I</div>
    </div>
    <div class="divider"></div>
    <div class="info">
        No: ${esc(item.noKwitansi)}<br/>
        Tanggal: ${formatDate(item.tanggal)}<br/>
        Pelanggan: ${esc(item.pelangganNama || item.pelanggan)}<br/>
        Invoice: ${esc(item.noInvoice || '-')}
    </div>
    <div class="divider"></div>
    <table><thead><tr><th>Item</th><th style="text-align:right">Jumlah</th></tr></thead><tbody>${itemsHTML}</tbody></table>
    <div class="divider"></div>
    <div class="total">Rp ${services.formatRupiah ? services.formatRupiah(grandTotal) : grandTotal.toLocaleString()}</div>
    <div class="terbilang"># ${numberToWords(grandTotal)}</div>
    <div class="divider"></div>
    ${companyPhone ? `<div style="text-align:center;font-size:8px;">Info: ${esc(companyPhone)}</div>` : ""}
    <div class="footer">Terima Kasih</div>
    <script>window.print();window.close();<\\/script>
</body></html>`;

    printToWindow(html);
}

// ── Number to Words (Indonesian) ──

function numberToWords(n) {
    const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (n < 12) return angka[n] || "Nol";
    if (n < 20) return numberToWords(n % 10) + " Belas";
    if (n < 100) {
        const sisa = n % 10;
        return numberToWords(Math.floor(n / 10)) + " Puluh" + (sisa > 0 ? " " + numberToWords(sisa) : "");
    }
    if (n < 200) return "Seratus" + (n > 100 ? " " + numberToWords(n - 100) : "");
    if (n < 1000) {
        const sisa = n % 100;
        return numberToWords(Math.floor(n / 100)) + " Ratus" + (sisa > 0 ? " " + numberToWords(sisa) : "");
    }
    if (n < 2000) return "Seribu" + (n > 1000 ? " " + numberToWords(n - 1000) : "");
    if (n < 1000000) {
        const sisa = n % 1000;
        return numberToWords(Math.floor(n / 1000)) + " Ribu" + (sisa > 0 ? " " + numberToWords(sisa) : "");
    }
    if (n < 1000000000) {
        const sisa = n % 1000000;
        return numberToWords(Math.floor(n / 1000000)) + " Juta" + (sisa > 0 ? " " + numberToWords(sisa) : "");
    }
    if (n < 1000000000000) {
        const sisa = n % 1000000000;
        return numberToWords(Math.floor(n / 1000000000)) + " Miliar" + (sisa > 0 ? " " + numberToWords(sisa) : "");
    }
    return n.toLocaleString();
}

// ── Print Document Builder ──

function buildPrintDocument(opts) {
    const {
        title, nomor, companyName, companyAddress, companyPhone, companyEmail, logoUrl,
        infoGrid, itemsHTML, total, diskon, pajak = 0, grandTotal, catatan,
        nomorLabel = "No. Dokumen",
        showQr = false, showSignatures = false, singleSignature = false, company = {},
        extraContent = "",
        qrDataUrl = "",
        tableHeaders = "",
        showTotals = true,
        signatureLeftLabel = "Disetujui oleh",
        signatureRightLabel = "Dibuat oleh",
        signatureLeftName = company.orgKetua || "_______________",
        signatureRightName = company.orgBendahara || "_______________"
    } = opts;

    // QR code data URL dipass dari caller (generate async sebelum panggil buildPrintDocument)

    const statusLabel = title;

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)} - ${esc(nomor)}</title>
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
        .invoice-totals { margin-left:auto; width:300px; }
        .invoice-total-row { display:flex; justify-content:space-between; padding:5px 0; font-size:0.85rem; color:#475569; }
        .invoice-total-row.total { border-top:2px solid #059669; padding-top:8px; margin-top:4px; font-weight:700; font-size:1rem; color:#1e293b; }
        .invoice-notes { margin-top:20px; padding:12px 16px; background:#f8fafc; border-radius:8px; font-size:0.82rem; color:#64748b; border-left:3px solid #059669; }
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
                <div class="invoice-title">${esc(title)}</div>
                <div class="invoice-po-num">${esc(nomor)}</div>
            </div>
        </div>
        <div class="invoice-body">
            <div class="invoice-info-grid">${infoGrid}</div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        ${tableHeaders || `<tr>
                            <th style="width:36px">No</th>
                            <th style="width:90px">Kode</th>
                            <th>Nama Barang</th>
                            <th style="width:40px">Qty</th>
                            <th style="width:60px">Satuan</th>
                            <th style="width:90px">Harga</th>
                            <th style="width:80px">Diskon</th>
                            <th style="width:100px">Subtotal</th>
                        </tr>`}
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>

            <div class="invoice-bottom">${showQr ? `<div class="invoice-qr">
    ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:90px;height:90px;border-radius:6px;" alt="QR" />` : `<div style="width:90px;height:90px;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#94a3b8;background:#f8fafc">QR</div>`}
    <div class="invoice-qr-label">Scan untuk verifikasi</div>
</div>` : `<div style="flex:1;min-width:0;"></div>`}
                ${extraContent ? `<div style="flex:1;min-width:0;">${extraContent}</div>` : ""}${showSignatures ? (singleSignature ? `<div class="invoice-signatures" style="flex:1;display:flex;justify-content:center;align-items:flex-start;">
    <div class="invoice-signature-item" style="text-align:center;">
        <div style="font-size:0.75rem;font-weight:600;color:#475569;margin-bottom:8px;">${esc(signatureLeftLabel)}</div>
        <div style="height:45px;"></div>
        <div style="font-size:0.85rem;font-weight:600;color:#1e293b;">${esc(signatureLeftName || '_______________')}</div>
    </div>
</div>` : `<div class="invoice-signatures" style="flex:1;min-width:280px;display:flex;gap:24px;justify-content:center;align-items:flex-start;">
    <div class="invoice-signature-item" style="text-align:center;flex:1;">
        <div style="font-size:0.75rem;font-weight:600;color:#475569;margin-bottom:8px;">${esc(signatureLeftLabel)}</div>
        <div style="height:45px;"></div>
        <div style="font-size:0.85rem;font-weight:600;color:#1e293b;">${esc(signatureLeftName || '_______________')}</div>
    </div>
    <div class="invoice-signature-item" style="text-align:center;flex:1;">
        <div style="font-size:0.75rem;font-weight:600;color:#475569;margin-bottom:8px;">${esc(signatureRightLabel)}</div>
        <div style="height:45px;"></div>
        <div style="font-size:0.85rem;font-weight:600;color:#1e293b;">${esc(signatureRightName || '_______________')}</div>
    </div>
</div>`) : ""}
                ${showTotals ? `
                <div class="invoice-totals">
                    <div class="invoice-total-row">
                        <span>Total</span>
                        <span>${services.formatRupiah ? services.formatRupiah(total || 0) : (total || 0).toLocaleString()}</span>
                    </div>
                    ${diskon > 0 ? `
                    <div class="invoice-total-row">
                        <span>Diskon</span>
                        <span>-${services.formatRupiah ? services.formatRupiah(diskon) : diskon.toLocaleString()}</span>
                    </div>` : ""}
                    ${Number(pajak) > 0 ? `
                    <div class="invoice-total-row">
                        <span>Pajak</span>
                        <span>${services.formatRupiah ? services.formatRupiah(pajak) : pajak.toLocaleString()}</span>
                    </div>` : ""}
                    <div class="invoice-total-row total">
                        <span>Grand Total</span>
                        <span>Rp ${services.formatRupiah ? services.formatRupiah(grandTotal) : grandTotal.toLocaleString()}</span>
                    </div>
                </div>
                ` : ""}
            </div>

            ${catatan ? `<div class="invoice-notes"><strong>Catatan:</strong><br/>${esc(catatan)}</div>` : ""}
        </div>
    </div>
    <script>window.print();<\\/script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════
//  Delete Confirmation
// ═══════════════════════════════════════════════

// PRD V1 — Void transaksi POS (keputusan PO: hanya Admin/Owner via
// permission pos.transaction.void). Konfirmasi + alasan wajib (audit trail).
function confirmVoid(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-void">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-void" style="background:#b45309">🚫 Ya, Void</button>
    `;
    const overlay = Modal({
        open: true,
        title: "🚫 Void Transaksi",
        content: `
            <p>Batalkan transaksi POS <strong>${esc(name)}</strong>?</p>
            <p style="font-size:0.85rem;color:#6b7280">Stok item trading akan dikembalikan. Tindakan dicatat (audit trail).</p>
            <div class="form-group" style="margin-top:0.75rem">
                <label for="f-void-reason">Alasan Void <span class="required">*</span></label>
                <textarea id="f-void-reason" rows="2" placeholder="Contoh: transaksi salah / pembatalan pelanggan" style="width:100%;padding:0.5rem;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box"></textarea>
            </div>
        `,
        footer: footerHTML,
        closable: true,
        onClose: () => overlay?.parentNode?.removeChild(overlay)
    });
    document.body.appendChild(overlay);
    document.getElementById("f-cancel-void")?.addEventListener("click", () => overlay?.parentNode?.removeChild(overlay));
    overlay.querySelector(".smart-modal-close")?.addEventListener("click", () => overlay?.parentNode?.removeChild(overlay));
    document.getElementById("f-confirm-void")?.addEventListener("click", async () => {
        const reason = document.getElementById("f-void-reason")?.value?.trim() || "";
        if (!reason) { showToast("warning", "Alasan void wajib diisi"); document.getElementById("f-void-reason")?.focus(); return; }
        try {
            await services.voidPenjualan(id, reason);
            showToast("success", `Transaksi ${esc(name)} di-void`);
            overlay?.parentNode?.removeChild(overlay);
            loadData();
        } catch (err) {
            showToast("danger", `Void gagal: ${err.message || "coba lagi"}`);
        }
    });
}

function confirmDelete(id) {
    const item = state.items.find(i => (i._id || i.id) === id);
    const name = item ? item.nomor : "#" + id;

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-del">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-del" style="background:#dc2626">Ya, Hapus</button>
    `;

    const overlay = Modal({
        open: true,
        title: "🗑️ Hapus SO",
        content: `<p>Yakin ingin menghapus SO <strong>${esc(name)}</strong>? Tindakan ini tidak bisa dibatalkan.</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-del")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-del")?.addEventListener("click", async () => {
        try {
            await services.deletePenjualan(id);
            showToast("success", `SO ${name} berhasil dihapus`);
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
    const statusLabels = { delivered: "Surat Jalan", invoiced: "Invoice", paid: "Lunas" };
    const label = statusLabels[newStatus] || newStatus;

    let confirmMsg = "";
    if (newStatus === "delivered") {
        confirmMsg = `Terbitkan <strong>Surat Jalan</strong> untuk SO <strong>${esc(name)}</strong>?<br/><br/>Stok barang akan <strong>berkurang</strong> secara otomatis.`;
    } else if (newStatus === "invoiced") {
        confirmMsg = `Terbitkan <strong>Invoice</strong> untuk SO <strong>${esc(name)}</strong>?`;
    } else if (newStatus === "paid") {
        confirmMsg = `Terbitkan <strong>Kwitansi</strong> untuk SO <strong>${esc(name)}</strong>?<br/><br/>Status akan menjadi <strong>Lunas</strong>.`;
    }

    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="f-cancel-st">Batal</button>
        <button class="smart-btn smart-db-primary" id="f-confirm-st">Ya, ${label}</button>
    `;

    const overlay = Modal({
        open: true,
        title: `🔄 ${label}`,
        content: `<p>${confirmMsg}</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-st")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-st")?.addEventListener("click", async () => {
        try {
            const result = await services.updatePenjualanStatus(id, newStatus);
            showToast("success", `SO ${name} → ${label} berhasil`);
            removeModal(overlay);
            loadData();
        } catch (err) {
            showToast("danger", "Gagal update status: " + err.message);
        }
    });
}

// ═══════════════════════════════════════════════
//  Retur Penjualan — State
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
        "draft":    { label: "Draft",      cls: "ps-status-order" },
        "returned": { label: "Dikembalikan", cls: "ps-status-delivered" }
    };
    const s = map[status] || { label: status, cls: "" };
    return `<span class="ps-status-badge ${s.cls}">${s.label}</span>`;
}

// ═══════════════════════════════════════════════
//  Retur Penjualan — Init / Load
// ═══════════════════════════════════════════════

function initReturTab() {
    returState.items = [];
    returState.pagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
    returState.search = "";
    returState.loading = false;
    returState.editingId = null;

    const searchInput = document.getElementById("prj-search-input");
    if (searchInput && !_returTabInit) {
        searchInput.addEventListener("input", debounce((e) => {
            returState.search = e.target.value.trim();
            returState.pagination.page = 1;
            loadReturData();
        }, 300));
    }

    const pageActions = document.querySelector(`#ps-tab-retur .page-actions`);
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
    const loadingEl = document.getElementById("prj-loading");
    const emptyEl = document.getElementById("prj-empty-state");
    const tableArea = document.getElementById("prj-table-area");
    const cardArea = document.getElementById("prj-card-area");
    const paginationEl = document.getElementById("prj-pagination");

    if (!tableArea) return;
    returState.loading = true;
    if (loadingEl) loadingEl.style.display = "block";
    if (emptyEl) emptyEl.innerHTML = "";

    try {
        const result = await services.listReturPenjualan({
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
                    title: returState.search ? "Pencarian tidak ditemukan" : "Belum ada Retur Penjualan",
                    description: returState.search ? "Coba kata kunci lain" : "Buat retur untuk mencatat pengembalian barang dari pelanggan",
                    actionText: returState.search ? "Reset Pencarian" : "Buat Retur",
                    onAction: returState.search ? () => { returState.search = ""; const inp = document.getElementById("prj-search-input"); if (inp) inp.value = ""; loadReturData(); } : () => openReturForm("create")
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
        console.error("[Penjualan] loadReturData failed:", err);
        if (loadingEl) loadingEl.style.display = "none";
        if (emptyEl) {
            emptyEl.innerHTML = `<div class="ps-error">Gagal memuat data: ${esc(err.message)}</div>`;
        }
    }
}

// ═══════════════════════════════════════════════
//  Retur Penjualan — Render
// ═══════════════════════════════════════════════

function renderReturTable() {
    const tbody = document.getElementById("prj-table-body");
    if (!tbody) return;
    tbody.innerHTML = returState.items.map(item => {
        const itemsCount = (item.items || []).length;
        return `
            <tr>
                <td><strong>${esc(item.nomor)}</strong></td>
                <td>${formatDate(item.tanggal)}</td>
                <td>${esc(item.nomorSO || '-')}</td>
                <td>${esc(item.pelangganNama || item.pelanggan || '-')}</td>
                <td class="ps-text-right">${services.formatRupiah ? services.formatRupiah(item.total || 0) : (item.total || 0).toLocaleString()}</td>
                <td>${returStatusBadgeHTML(item.status)}</td>
                <td>
                    <div class="ps-mgmt-actions">
                        <button class="ps-action-btn ps-action-invoice" data-action="print" data-id="${item._id || item.id}" title="Cetak Nota Retur">🖨️</button>
                        ${item.status === "draft" ? `<button class="ps-action-btn ps-action-edit" data-action="edit" data-id="${item._id || item.id}" title="Edit Retur">✏️</button>` : ""}
                        ${item.status === "draft" ? `<button class="ps-action-btn ps-action-deliver" data-action="confirm" data-id="${item._id || item.id}" title="Konfirmasi Retur (stok bertambah)">✅ Retur</button>` : ""}
                        <button class="ps-action-btn ps-action-delete" data-action="delete" data-id="${item._id || item.id}" title="Hapus">🗑️</button>
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
    const cardArea = document.getElementById("prj-card-area");
    if (!cardArea) return;
    cardArea.innerHTML = "";
    const list = UI.CardList(returState.items, (item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${esc(item.nomor)}</div>
            <div class="sm-card-desc">${formatDate(item.tanggal)}</div>
        </div>
        <div class="sm-card-details">
            <div class="sm-card-detail-row">
                <span class="sm-card-label">${services.isPos ? "No. Nota" : "No. SO"}</span>
                <span class="sm-card-value">${esc(item.nomorSO || '-')}</span>
            </div>
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Pelanggan</span>
                <span class="sm-card-value">${esc(item.pelangganNama || item.pelanggan || '-')}</span>
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
                <button class="sm-card-btn sm-card-btn-invoice" data-prj-print="${item._id || item.id}">🖨️</button>
                ${item.status === "draft" ? `<button class="sm-card-btn sm-card-btn-primary" data-prj-confirm="${item._id || item.id}">✅ Retur</button>` : ""}
                ${item.status === "draft" ? `<button class="sm-card-btn sm-card-btn-edit" data-prj-edit="${item._id || item.id}">✏️</button>` : ""}
                <button class="sm-card-btn sm-card-btn-delete" data-prj-delete="${item._id || item.id}">🗑️</button>
            </div>
        </div>
    `);
    cardArea.appendChild(list);

    cardArea.querySelectorAll("[data-prj-print]").forEach(btn => {
        btn.addEventListener("click", () => printRetur(btn.dataset.prjPrint));
    });
    cardArea.querySelectorAll("[data-prj-edit]").forEach(btn => {
        btn.addEventListener("click", () => openReturForm("edit", btn.dataset.prjEdit));
    });
    cardArea.querySelectorAll("[data-prj-delete]").forEach(btn => {
        btn.addEventListener("click", () => confirmReturDelete(btn.dataset.prjDelete));
    });
    cardArea.querySelectorAll("[data-prj-confirm]").forEach(btn => {
        btn.addEventListener("click", () => updateReturStatus(btn.dataset.prjConfirm));
    });
}

function toggleReturView() {
    const tableArea = document.getElementById("prj-table-area");
    const cardArea = document.getElementById("prj-card-area");
    if (!tableArea || !cardArea) return;
    const isMobile = window.innerWidth < 768;
    tableArea.style.display = isMobile ? "none" : "";
    cardArea.style.display = isMobile ? "block" : "none";
}

function renderReturPagination() {
    const el = document.getElementById("prj-pagination");
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
//  Retur Penjualan — Form (Create / Edit)
// ═══════════════════════════════════════════════

async function openReturForm(mode, id) {
    const isEdit = mode === "edit" && id;
    let formData = {
        tanggal: new Date().toISOString().split("T")[0],
        nomorSO: "",
        idSO: "",
        pelanggan: "",
        pelangganNama: "",
        items: [],
        catatan: "",
        nomor: ""
    };

    if (isEdit) {
        try {
            const item = await services.getReturPenjualan(id);
            if (!item) { showToast("danger", "Data tidak ditemukan"); return; }
            formData = {
                tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split("T")[0] : "",
                nomorSO: item.nomorSO || "",
                idSO: item.idSO || "",
                pelanggan: item.pelanggan || "",
                pelangganNama: item.pelangganNama || "",
                items: (item.items || []).map(i => ({ ...i })),
                catatan: item.catatan || "",
                nomor: item.nomor || ""
            };

            // Merge qty SO asli ke item retur, agar kolom "Qty SO" & max validation
            // menampilkan qty SO asli (bukan qty retur) saat mode edit.
            try {
                if (formData.idSO) {
                    const so = await services.getPenjualan(formData.idSO);
                    if (so && so.items) {
                        formData.items = formData.items.map(ri => {
                            const soItem = so.items.find(p => p.kode === ri.kode);
                            return { ...ri, qtySo: soItem ? soItem.qty : ri.qty };
                        });
                    }
                }
            } catch (e) { console.warn("[ReturPenjualan] Gagal memuat SO asal:", e); }
        } catch (err) {
            showToast("danger", "Gagal memuat data: " + err.message);
            return;
        }
    }

    const title = isEdit ? `✏️ Edit Retur: ${formData.nomor}` : "↩️ Buat Retur Penjualan Baru";
    const contentHTML = buildReturFormHTML(formData, isEdit);
    const footerHTML = `
        <button class="smart-btn smart-btn-secondary" id="prj-cancel">Batal</button>
        <button class="smart-btn smart-db-primary" id="prj-submit">${isEdit ? "Simpan Perubahan" : "Buat Retur"}</button>
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

    // Fetch SO list (delivered/invoiced/paid) for dropdown
    let soList = [];
    try {
        const soRes = await services.listPenjualan({ page: 1, limit: 999 });
        soList = (soRes.data || []).filter(s => s.status !== "order");
    } catch {}

    populateReturSoDropdown(soList, formData.nomorSO);

    // ── Fetch customers & barangs ──
    let customers = [];
    let barangs = [];
    try {
        const custRes = await services.listCustomer({ page: 1, limit: 999 });
        customers = custRes.data || [];
    } catch {}
    try {
        const barangRes = await services.listBarang({ page: 1, limit: 999 });
        barangs = barangRes.data || [];
    } catch {}
    populateReturPelangganDropdowns(customers, formData.pelanggan, formData.pelangganNama);

    // ── Pelanggan cross-fill: pilih kode → nama terisi, pilih nama → kode terisi ──
    const pkSel = document.getElementById("prj-pelanggan");
    const pnSel = document.getElementById("prj-pelanggan-nama");
    if (pkSel && pnSel) {
        pkSel.addEventListener("change", () => {
            const opt = pkSel.selectedOptions?.[0];
            setReturPelangganPair(pkSel.value, opt?.dataset?.nama || "");
        });
        pnSel.addEventListener("change", () => {
            const opt = pnSel.selectedOptions?.[0];
            setReturPelangganPair(opt?.dataset?.kode || "", pnSel.value);
        });
    }

    // ── Populate datalist barang (manual mode) ──
    const kodeList = document.getElementById(`prj-barang-list-${pageId}`);
    const namaList = document.getElementById(`prj-nama-list-${pageId}`);
    if (kodeList) {
        kodeList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.kode)}" data-nama="${esc(b.nama)}" data-satuan="${esc(b.satuan || '')}" data-harga="${b.harga_jual || b.harga_beli || 0}" data-stok="${Number(b.stok) || 0}"></option>`
        ).join("");
    }
    if (namaList) {
        namaList.innerHTML = barangs.map(b =>
            `<option value="${esc(b.nama)}" data-kode="${esc(b.kode)}" data-satuan="${esc(b.satuan || '')}" data-harga="${b.harga_jual || b.harga_beli || 0}" data-stok="${Number(b.stok) || 0}"></option>`
        ).join("");
    }

    // ── Mode switch (SO / Manual) ──
    const modeSel = document.getElementById("prj-mode");
    const soSection = document.getElementById("prj-so-section");
    const pelangganSection = document.getElementById("prj-pelanggan-section");
    const addItemSection = document.getElementById("prj-add-item-section");
    const modeHint = document.getElementById("prj-mode-hint");
    const modeHintItems = document.getElementById("prj-mode-hint-items");

    function switchMode(mode) {
        if (mode === "manual") {
            if (soSection) soSection.style.display = "none";
            if (addItemSection) addItemSection.style.display = "block";
            if (pelangganSection) pelangganSection.style.display = "";
            if (modeHint) modeHint.textContent = "Input item barang secara manual satu per satu.";
            if (modeHintItems) modeHintItems.textContent = "(isi kode, nama, qty, harga — stok otomatis dari master barang)";
            const body = document.getElementById("prj-items-body");
            if (body) {
                const existing = body.querySelectorAll(".ps-item-row");
                if (existing.length === 0) {
                    body.innerHTML = '<div class="ps-empty-items">Klik "Tambah Item Barang" untuk menambahkan barang.</div>';
                }
            }
            const pk = document.getElementById("prj-pelanggan");
            const pn = document.getElementById("prj-pelanggan-nama");
            if (pk) pk.disabled = false;
            if (pn) pn.disabled = false;
        } else {
            if (soSection) soSection.style.display = "";
            if (addItemSection) addItemSection.style.display = "none";
            if (pelangganSection) pelangganSection.style.display = "none";
            if (modeHint) modeHint.textContent = `Pilih ${services.isPos ? "Nota" : "SO"} untuk memuat item otomatis, atau Manual untuk input item satu per satu.`;
            if (modeHintItems) modeHintItems.textContent = `(qty retur diisi manual, max = qty ${services.isPos ? "nota" : "SO"})`;
            const pk = document.getElementById("prj-pelanggan");
            const pn = document.getElementById("prj-pelanggan-nama");
            if (pk) pk.disabled = true;
            if (pn) pn.disabled = true;
        }
    }

    if (modeSel) {
        modeSel.addEventListener("change", () => {
            switchMode(modeSel.value);
            renderReturItemRows([]);
            calcReturTotals();
        });
    }

    // Edit retur manual (tanpa SO): paksa mode manual + render item editable
    if (modeSel && isEdit && !formData.idSO) {
        modeSel.value = "manual";
        switchMode("manual");
        const body = document.getElementById("prj-items-body");
        if (body) {
            body.innerHTML = (formData.items || []).map((it, idx) => buildReturItemRow({ ...it, _manual: true }, idx)).join("");
        }
        initReturItemEvents();
        calcReturTotals();
    }

    const soSel = document.getElementById("prj-so-select");
    if (soSel) {
        soSel.addEventListener("change", async () => {
            const soId = soSel.value;
            if (!soId) { renderReturItemRows([]); calcReturTotals(); setReturPelangganPair("", ""); return; }
            try {
                const so = await services.getPenjualan(soId);
                if (so && so.items) {
                    renderReturItemRows(so.items.map(i => ({
                        kode: i.kode, nama: i.nama, satuan: i.satuan || "",
                        qty: i.qty || 0, harga: i.harga || 0,
                        subtotal: (i.qty || 0) * (i.harga || 0)
                    })));
                }
                const opt = soSel.selectedOptions?.[0];
                if (opt) {
                    setReturPelangganPair(opt.dataset.pelanggan || "", opt.dataset.pelangganNama || "");
                }
            } catch (err) {
                showToast("danger", "Gagal memuat item SO: " + err.message);
            }
        });
    }

    // ── Tambah Item Barang (manual mode) ──
    document.getElementById("prj-add-item-btn")?.addEventListener("click", function prjAddItemHandler() {
        const body = document.getElementById("prj-items-body");
        if (!body) return;
        const idx = document.querySelectorAll(".ps-item-row").length;
        const emptyMsg = body.querySelector(".ps-empty-items");
        if (emptyMsg) emptyMsg.remove();
        body.insertAdjacentHTML("beforeend", buildReturItemRow({ _manual: true, kode: "", nama: "", qty: 0, harga: 0, subtotal: 0 }, idx));
        initReturItemEvents();
        // Re-attach scanner agar tombol 📷 di baris baru berfungsi
        attachReturScanner();
        calcReturTotals();
    });

    // ── Scanner (manual mode) ──
    const scanContainerId = "prj-scanner-container";
    const scanSwitchId = "prj-btn-switch";
    const scanFlashId = "prj-scanner-flash";
    if (!document.getElementById(`scanner-section-${scanContainerId}`)) {
        const prjItemsBody = document.getElementById("prj-items-body");
        if (prjItemsBody) {
            prjItemsBody.insertAdjacentHTML("beforebegin", scannerSectionHTML(scanContainerId, scanSwitchId, scanFlashId));
        }
    }

    let _prjScanner = null;
    function attachReturScanner() {
        if (_prjScanner) { _prjScanner.destroy(); _prjScanner = null; }
        _prjScanner = attachScanner({
            containerId: scanContainerId,
            switchBtnId: scanSwitchId,
            flashId: scanFlashId,
            scanBtnSel: "[data-scan-index]",
            onScanDecoded: (idx, decodedText) => {
                const kodeInput = document.querySelector(`.prj-item-kode[data-index="${idx}"]`);
                if (kodeInput) {
                    kodeInput.value = decodedText;
                    kodeInput.dispatchEvent(new Event("blur", { bubbles: true }));
                }
            }
        });
    }
    attachReturScanner();

    document.getElementById("prj-cancel")?.addEventListener("click", () => { if (_prjScanner) _prjScanner.destroy(); removeModal(overlay); });
    document.getElementById("prj-submit")?.addEventListener("click", () => { if (_prjScanner) _prjScanner.destroy(); handleReturSubmit(overlay, formData, isEdit ? id : null); });

    initReturItemEvents();
    calcReturTotals();

    // ── Override overlay close untuk destroy scanner ──
    const origClose = overlay.close;
    if (typeof origClose === "function") {
        overlay.close = function() { if (_prjScanner) _prjScanner.destroy(); return origClose.apply(this, arguments); };
    }
}

function populateReturPelangganDropdowns(customers, selectedKode, selectedNama) {
    const kodeSel = document.getElementById("prj-pelanggan");
    const namaSel = document.getElementById("prj-pelanggan-nama");
    if (kodeSel) {
        kodeSel.innerHTML = `<option value="">— Pilih Pelanggan —</option>`;
        for (const c of customers) {
            const code = c.kode || c._id || "";
            const name = c.nama || code;
            kodeSel.innerHTML += `<option value="${esc(code)}" data-nama="${esc(name)}">${esc(code)}</option>`;
        }
    }
    if (namaSel) {
        namaSel.innerHTML = `<option value="">— Pilih Pelanggan —</option>`;
        for (const c of customers) {
            const code = c.kode || c._id || "";
            const name = c.nama || code;
            namaSel.innerHTML += `<option value="${esc(name)}" data-kode="${esc(code)}">${esc(name)}</option>`;
        }
    }
    if (selectedKode || selectedNama) {
        setReturPelangganPair(selectedKode, selectedNama);
    }
}

function setReturPelangganPair(kode, nama) {
    const kodeSel = document.getElementById("prj-pelanggan");
    const namaSel = document.getElementById("prj-pelanggan-nama");

    // Prefer nama master jika kode cocok di daftar master
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

function findAndFillReturBarang(inputEl) {
    const val = inputEl.value.trim();
    if (!val) return;
    const idx = inputEl.dataset.index;
    const kodeList = document.getElementById(`prj-barang-list-${pageId}`);
    const namaList = document.getElementById(`prj-nama-list-${pageId}`);
    let opt = null;
    if (kodeList) opt = Array.from(kodeList.options).find(o => o.value === val);
    if (!opt && namaList) opt = Array.from(namaList.options).find(o => o.value === val);
    if (!opt) return;
    const kode = opt.getAttribute("data-kode") || opt.value;
    const nama = opt.getAttribute("data-nama") || opt.value;
    const satuan = opt.getAttribute("data-satuan") || "";
    const harga = Number(opt.getAttribute("data-harga")) || 0;
    const stok = Number(opt.getAttribute("data-stok")) || 0;
    const kodeInput = document.querySelector(`.prj-item-kode[data-index="${idx}"]`);
    const namaInput = document.querySelector(`.prj-item-nama[data-index="${idx}"]`);
    const satuanInput = document.querySelector(`.prj-item-satuan[data-index="${idx}"]`);
    const hargaInput = document.querySelector(`.prj-item-harga[data-index="${idx}"]`);
    const qtySoInput = document.querySelector(`.prj-item-qty-so[data-index="${idx}"]`);
    if (kodeInput) kodeInput.value = kode;
    if (namaInput) namaInput.value = nama;
    if (satuanInput) satuanInput.value = satuan;
    if (hargaInput) hargaInput.value = formatThousand(harga);
    if (qtySoInput) qtySoInput.value = formatThousand(stok);
    recalcReturRow(idx);
}

function buildReturFormHTML(data, isEdit) {
    const itemRows = (data.items || []).map((item, idx) => buildReturItemRow(item, idx)).join("");
    return `
        <div class="ps-form">
            ${isEdit ? `<div class="ps-nomor-row">
                <div class="form-group" style="max-width:280px">
                    <label>No. Retur</label>
                    <input type="text" value="${esc(data.nomor)}" disabled />
                </div>
            </div>` : ""}
            <div class="ps-form-row">
                <div class="form-group">
                    <label for="prj-tanggal">Tanggal</label>
                    <input type="date" id="prj-tanggal" value="${esc(data.tanggal)}" />
                </div>
                <div class="form-group" style="grid-column:span 2">
                    <label for="prj-mode">Mode Input <span class="required">*</span></label>
                    <select id="prj-mode" ${isEdit ? "disabled" : ""}>
                        <option value="so">📋 Berdasarkan ${services.isPos ? "Nota" : "SO"}</option>
                        <option value="manual">✏️ Input Manual</option>
                    </select>
                    <div id="prj-mode-hint" style="font-size:0.72rem;color:#9ca3af;margin-top:0.2rem">Pilih ${services.isPos ? "Nota" : "SO"} untuk memuat item otomatis, atau Manual untuk input item satu per satu.</div>
                </div>
            </div>
            <div id="prj-so-section">
            <div class="ps-form-row">
                <div class="form-group" style="grid-column:span 2">
                    <label for="prj-so-select">Pilih ${services.isPos ? "Nota" : "SO (Dikirim/Invoice/Lunas)"} <span class="required">*</span></label>
                    <select id="prj-so-select">
                        <option value="">— Pilih ${services.isPos ? "Nota" : "Sales Order"} —</option>
                    </select>
                    <div style="font-size:0.72rem;color:#9ca3af;margin-top:0.2rem">Item barang akan dimuat otomatis dari ${services.isPos ? "nota" : "SO"} yang dipilih.</div>
                </div>
            </div>
            </div>
            <div id="prj-pelanggan-section" style="display:none">
            <div class="ps-form-row">
                <div class="form-group">
                    <label for="prj-pelanggan">Pelanggan (Kode)</label>
                    <select id="prj-pelanggan" disabled></select>
                </div>
                <div class="form-group">
                    <label for="prj-pelanggan-nama">Pelanggan (Nama)</label>
                    <select id="prj-pelanggan-nama" disabled></select>
                </div>
            </div>
            </div>

            <div class="ps-section-title">📦 Item Retur <span id="prj-mode-hint-items" style="font-weight:normal;color:#9ca3af;font-size:0.75rem">(qty retur diisi manual, max = qty ${services.isPos ? "nota" : "SO"})</span></div>
            <div class="prj-items-header">
                <span class="ps-col-code">Kode</span>
                <span class="ps-col-name">Nama Barang</span>
                <span class="ps-col-qty">Qty ${services.isPos ? "Nota" : "SO"}</span>
                <span class="ps-col-satuan">Satuan</span>
                <span class="ps-col-price">Harga</span>
                <span class="ps-col-qty">Qty Retur</span>
                <span class="ps-col-subtotal">Subtotal</span>
                <span class="ps-col-action"></span>
            </div>
            <datalist id="prj-barang-list-${pageId}"></datalist>
            <datalist id="prj-nama-list-${pageId}"></datalist>
            <div id="prj-items-body">${itemRows}</div>
            <div class="ps-add-item" id="prj-add-item-section" style="display:none">
                <button type="button" id="prj-add-item-btn" class="ps-add-item-btn">➕ Tambah Item Barang</button>
            </div>

            <div class="ps-totals">
                <div class="ps-total-row ps-grand-total">
                    <span>Total Retur</span>
                    <span id="prj-total-display">Rp 0</span>
                </div>
            </div>

            <div class="form-group">
                <label for="prj-catatan">Catatan / Alasan Retur</label>
                <textarea id="prj-catatan" rows="3" placeholder="Contoh: barang rusak, salah kirim, dikembalikan pelanggan...">${esc(data.catatan)}</textarea>
            </div>
        </div>
    `;
}

function buildReturItemRow(item, idx) {
    // Manual mode (item._manual === true): kode/nama/harga/qty editable + scanner + tombol Tutup
    const isEditable = item._manual === true;
    const kodeHTML = isEditable
        ? `<span class="kode-scan-wrapper">
                <input type="text" class="prj-item-kode" value="${esc(item.kode)}" placeholder="Kode" list="prj-barang-list-${pageId}" data-index="${idx}" />
                ${scanButtonHTML(`data-scan-index="${idx}"`)}
           </span>`
        : `<input type="text" class="prj-item-kode" value="${esc(item.kode)}" readonly data-index="${idx}" />`;

    const namaReadonly = isEditable ? "" : "readonly";
    const hargaReadonly = isEditable ? "" : "readonly";
    const qtySoReadonly = isEditable ? "" : "readonly";
    const removeBtn = isEditable
        ? `<button type="button" class="ps-item-remove" data-index="${idx}" title="Hapus item">Tutup</button>`
        : "";
    const qtySoVal = isEditable ? (item.stok !== undefined ? item.stok : (item.qty || 0)) : (item.qtySo !== undefined ? item.qtySo : (item.qty || 0));
    const qtySoLabel = isEditable ? "Qty Stok" : (services.isPos ? "Qty Nota" : "Qty SO");

    return `
        <div class="ps-item-row" data-index="${idx}">
            <span class="ps-col-code" data-label="Kode">${kodeHTML}</span>
            <span class="ps-col-name" data-label="Nama Barang">
                <input type="text" class="prj-item-nama" value="${esc(item.nama)}" placeholder="Nama barang" list="prj-nama-list-${pageId}" ${namaReadonly} data-index="${idx}" />
            </span>
            <span class="ps-col-qty" data-label="${qtySoLabel}">
                <input type="text" inputmode="numeric" class="prj-item-qty-so" value="${esc(formatThousand(qtySoVal))}" ${qtySoReadonly} data-index="${idx}" />
            </span>
            <span class="ps-col-satuan" data-label="Satuan">
                <input type="text" class="prj-item-satuan" value="${esc(item.satuan || '')}" readonly data-index="${idx}" />
            </span>
            <span class="ps-col-price" data-label="Harga">
                <input type="text" inputmode="numeric" class="prj-item-harga" value="${esc(formatThousand(item.harga || 0))}" ${hargaReadonly} data-index="${idx}" />
            </span>
            <span class="ps-col-qty" data-label="Qty Retur">
                <input type="text" inputmode="numeric" class="prj-item-qty" value="${esc(formatThousand(item.returQty !== undefined ? item.returQty : (item.qty || 0)))}" data-index="${idx}" />
            </span>
            <span class="ps-col-subtotal" data-label="Subtotal">
                <input type="text" class="prj-item-subtotal" value="${esc(formatThousand(item.subtotal || 0))}" readonly data-index="${idx}" />
            </span>
            <span class="ps-col-action" data-label="">
                ${removeBtn}
            </span>
        </div>
    `;
}

function populateReturSoDropdown(soList, selected) {
    const sel = document.getElementById("prj-so-select");
    if (!sel) return;
    sel.innerHTML = `<option value="">— Pilih ${services.isPos ? "Nota" : "Sales Order"} —</option>`;
    for (const s of soList) {
        const sid = s._id || s.id || "";
        const name = s.nomor || sid;
        const pelangganNama = s.pelangganNama || s.pelanggan || "";
        sel.innerHTML += `<option value="${esc(sid)}" data-pelanggan="${esc(s.pelanggan || '')}" data-pelanggan-nama="${esc(pelangganNama)}" ${name === selected ? "selected" : ""}>${esc(name)} - ${esc(pelangganNama)}</option>`;
    }
}

function renderReturItemRows(rows) {
    const body = document.getElementById("prj-items-body");
    if (!body) return;
    body.innerHTML = rows.length > 0
        ? rows.map((item, idx) => buildReturItemRow(item, idx)).join("")
        : `<div class="ps-empty-items">Pilih ${services.isPos ? "Nota" : "SO"} terlebih dahulu untuk memuat item barang.</div>`;
    initReturItemEvents();
    calcReturTotals();
}

function initReturItemEvents() {
    // Format ribuan: digit-only + fokus/blur (hanya input yang editable)
    document.querySelectorAll(".prj-item-qty, .prj-item-qty-so, .prj-item-harga").forEach(inp => {
        if (inp.readOnly) return;
        inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); });
        inp.addEventListener("focus", () => { inp.value = String(unformatThousand(inp.value)); });
        inp.addEventListener("blur", () => { inp.value = formatThousand(unformatThousand(inp.value)); });
    });

    // Auto-fill barang dari master (manual mode)
    document.querySelectorAll(".prj-item-kode, .prj-item-nama").forEach(inp => {
        if (inp.readOnly) return;
        inp.addEventListener("blur", () => findAndFillReturBarang(inp));
    });

    // Tombol Tutup (manual mode)
    document.querySelectorAll(".ps-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const row = btn.closest(".ps-item-row");
            if (row) { row.remove(); calcReturTotals(); }
        });
    });

    document.querySelectorAll(".prj-item-qty").forEach(inp => {
        inp.addEventListener("input", () => {
            const idx = inp.dataset.index;
            const qtySo = unformatThousand(document.querySelector(`.prj-item-qty-so[data-index="${idx}"]`)?.value);
            let qty = unformatThousand(inp.value);
            if (qty > qtySo) {
                qty = qtySo;
                inp.value = formatThousand(qtySo);
                showToast("warning", `Qty retur tidak boleh melebihi batas (${qtySo})`);
            }
            recalcReturRow(idx);
        });
    });
}

function recalcReturRow(idx) {
    const qty = unformatThousand(document.querySelector(`.prj-item-qty[data-index="${idx}"]`)?.value);
    const harga = unformatThousand(document.querySelector(`.prj-item-harga[data-index="${idx}"]`)?.value);
    const subtotalEl = document.querySelector(`.prj-item-subtotal[data-index="${idx}"]`);
    const subtotal = Math.max(0, qty * harga);
    if (subtotalEl) {
        subtotalEl.value = formatThousand(subtotal);
    }
    calcReturTotals();
}

function calcReturTotals() {
    let total = 0;
    document.querySelectorAll(".ps-item-row").forEach(row => {
        const idx = row.dataset.index;
        const qty = unformatThousand(document.querySelector(`.prj-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.prj-item-harga[data-index="${idx}"]`)?.value);
        total += Math.max(0, qty * harga);
    });
    const totalEl = document.getElementById("prj-total-display");
    if (totalEl) totalEl.textContent = "Rp " + (services.formatRupiah ? services.formatRupiah(total) : total.toLocaleString());
}

// ═══════════════════════════════════════════════
//  Retur Penjualan — Submit / Status / Delete
// ═══════════════════════════════════════════════

async function handleReturSubmit(overlay, existingData, editId) {
    const modeSel = document.getElementById("prj-mode");
    const isManual = modeSel?.value === "manual";
    const soSel = document.getElementById("prj-so-select");
    const soId = soSel?.value || "";
    const tanggal = document.getElementById("prj-tanggal")?.value;
    const catatan = document.getElementById("prj-catatan")?.value || "";

    if (!isManual && !soId) {
        showToast("danger", `Pilih ${services.isPos ? "Nota" : "SO"} terlebih dahulu`);
        return;
    }

    const rows = document.querySelectorAll(".ps-item-row");
    const items = [];
    for (const row of rows) {
        const idx = row.dataset.index;
        const kode = document.querySelector(`.prj-item-kode[data-index="${idx}"]`)?.value.trim() || "";
        const nama = document.querySelector(`.prj-item-nama[data-index="${idx}"]`)?.value.trim() || "";
        const qty = unformatThousand(document.querySelector(`.prj-item-qty[data-index="${idx}"]`)?.value);
        const harga = unformatThousand(document.querySelector(`.prj-item-harga[data-index="${idx}"]`)?.value);
        if (!kode && !nama) continue;
        if (qty <= 0) continue;
        items.push({ kode, nama, satuan: document.querySelector(`.prj-item-satuan[data-index="${idx}"]`)?.value?.trim() || "", qty, harga, subtotal: Math.max(0, qty * harga) });
    }

    if (items.length === 0) {
        showToast("danger", "Minimal 1 item dengan qty retur > 0");
        return;
    }

    const currentUser = getCurrentUserName() || "System";
    const opt = soSel?.selectedOptions?.[0];
    const payload = {
        tanggal: tanggal || new Date().toISOString(),
        nomorSO: isManual ? "(Manual)" : (opt?.textContent?.split(" - ")[0] || existingData.nomorSO || ""),
        idSO: isManual ? "" : soId,
        pelanggan: document.getElementById("prj-pelanggan")?.value || "",
        pelangganNama: document.getElementById("prj-pelanggan-nama")?.value || "",
        items,
        catatan,
        createdBy: currentUser
    };

    try {
        if (editId) {
            await services.updateReturPenjualan(editId, payload);
            showToast("success", "Retur berhasil diperbarui");
        } else {
            await services.createReturPenjualan(payload);
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
        content: `<p>Yakin ingin mengonfirmasi retur <strong>${esc(name)}</strong>?</p><p style="font-size:0.85rem;color:#6b7280">Stok barang akan <strong>bertambah</strong> otomatis (barang diterima kembali dari pelanggan).</p>`,
        footer: footerHTML,
        closable: true,
        onClose: () => removeModal(overlay)
    });
    document.body.appendChild(overlay);

    document.getElementById("f-cancel-st")?.addEventListener("click", () => removeModal(overlay));
    document.getElementById("f-confirm-st")?.addEventListener("click", async () => {
        try {
            await services.updateReturPenjualanStatus(id, "returned");
            showToast("success", `Retur ${name} dikonfirmasi, stok bertambah`);
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
            await services.deleteReturPenjualan(id);
            showToast("success", `Retur ${name} berhasil dihapus`);
            removeModal(overlay);
            loadReturData();
        } catch (err) {
            showToast("danger", "Gagal menghapus: " + err.message);
        }
    });
}

// ═══════════════════════════════════════════════
//  Retur Penjualan — Print (Normal + Thermal)
// ═══════════════════════════════════════════════

async function printRetur(id) {
    let item = returState.items.find(i => (i._id || i.id) === id);
    if (!item) {
        try { item = await services.getReturPenjualan(id); } catch { item = null; }
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
    const companyName = company.name || company.companyName || "Perusahaan";
    const companyAddress = company.address || "-";
    const companyPhone = company.phone || "-";
    const companyEmail = company.email || "-";
    const logoUrl = company.logo || "";

    let qrDataUrl = "";
    try {
        qrDataUrl = await QRCode.toDataURL(item.nomor, { width: 200, margin: 1 });
    } catch (e) { console.warn("[Penjualan] Retur QR generation failed:", e); }

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

    const html = buildPrintDocument({
        title: "NOTA RETUR PENJUALAN",
        nomor: item.nomor,
        companyName, companyAddress, companyPhone, companyEmail, logoUrl,
        infoGrid: `
            <div class="invoice-info-item"><div class="invoice-info-label">Pelanggan</div><div class="invoice-info-value">${esc(item.pelangganNama || item.pelanggan)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Tanggal</div><div class="invoice-info-value">${formatDate(item.tanggal)}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">${services.isPos ? "No. Nota" : "No. SO"}</div><div class="invoice-info-value">${esc(item.nomorSO || '-')}</div></div>
            <div class="invoice-info-item"><div class="invoice-info-label">Status</div><div class="invoice-info-value">${item.status === 'returned' ? 'Dikembalikan' : 'Draft'}</div></div>
        `,
        itemsHTML,
        total: item.total || 0,
        diskon: 0,
        grandTotal: item.total || 0,
        catatan: item.catatan,
        nomorLabel: "No. Nota Retur",
        showQr: true,
        qrDataUrl,
        showSignatures: true,
        singleSignature: true,
        signatureLeftLabel: "Dibuat oleh",
        signatureLeftName: company.bendahara || company.orgBendahara || getCurrentUserName() || "_______________",
        company
    });

    printToWindow(html);
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
<head><meta charset="UTF-8"><title>Retur Penjualan - ${esc(item.nomor)}</title>
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
        <div class="title">NOTA RETUR PENJUALAN</div>
    </div>
    <div class="divider"></div>
    <div class="info">
        No: ${esc(item.nomor)}<br/>
        Tanggal: ${formatDate(item.tanggal)}<br/>
        ${services.isPos ? "Nota" : "SO"}: ${esc(item.nomorSO || '-')}<br/>
        Pelanggan: ${esc(item.pelangganNama || item.pelanggan || '-')}
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
        .smart-modal-dialog { overflow-y:visible !important; display:flex; flex-direction:column; max-height:85vh; }
        .smart-modal-body { overflow-y:auto !important; flex:1 1 auto; min-height:0; }

        /* Tabs */
        .ps-tabs { display:flex; gap:0; margin-bottom:1.25rem; border-bottom:2px solid #e5e7eb; }
        /* M3-FIX v19 — radio pajak transaksi (POS app) */
        .ps-tax-box {
            display:flex; align-items:center; gap:14px; flex-wrap:wrap;
            margin:0 0 1rem; padding:10px 14px; border:1px solid #e2e8f0; border-radius:10px;
            background:#f8fafc; font-size:0.85rem;
        }
        .ps-tax-label { font-weight:700; color:#0f172a; }
        .ps-tax-radio { display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:#334155; }
        .ps-tax-radio input { accent-color:#10b981; }
        .ps-tax-hint { color:#94a3b8; font-size:0.75rem; }
        /* M3-FIX v21 — Gudang-Kasir settings */
        .ps-gudang-box { display:flex; flex-direction:column; gap:10px; margin:0 0 1rem; padding:10px 14px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; font-size:0.85rem; }
        .ps-gudang-title { font-weight:700; color:#0f172a; }
        .ps-gudang-info { color:#334155; }
        .ps-gudang-hint { color:#94a3b8; font-size:0.75rem; }
        .ps-gudang-grid { display:flex; flex-direction:column; gap:8px; }
        .ps-gudang-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .ps-gudang-select { flex:1; min-width:200px; }
        /* M3-FIX v24 — mapping fleksibel baris [gudang][kasir] */
        .ps-gudang-map-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .ps-gudang-w { flex:1.2; }
        .ps-gudang-k { flex:1; }
        .ps-gudang-del { flex-shrink:0; width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#b45309; cursor:pointer; font-size:0.9rem; transition:all 0.15s; }
        .ps-gudang-del:hover { background:#fef2f2; border-color:#fca5a5; color:#b91c1c; }
        .ps-gudang-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .ps-tab { padding:0.65rem 1.25rem; cursor:pointer; border:none; background:none; font-size:0.92rem; font-weight:600; color:#6b7280; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.2s; }
        .ps-tab:hover { color:#059669; }
        .ps-tab.active { color:#059669; border-bottom-color:#059669; }

        /* Retur items header */
        .prj-items-header { display:grid; grid-template-columns:100px 180px 50px 60px 80px 70px 90px auto; gap:0.25rem; align-items:center; padding:0.35rem 0; font-size:0.7rem; font-weight:600; color:#64748b; text-transform:uppercase; border-bottom:1px solid #e2e8f0; }
        @media (max-width:768px) { .prj-items-header { display:none; } }

        .penjualan-page { padding: 1.5rem; }
        .penjualan-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
        .penjualan-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
        .penjualan-page .page-header .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
        .penjualan-page .page-actions { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
        .penjualan-page .search-wrapper { position:relative; display:flex; align-items:center; }
        .penjualan-page .search-wrapper .search-icon { position:absolute; left:0.75rem; font-size:0.9rem; pointer-events:none; opacity:0.5; }
        .penjualan-page .search-wrapper input { padding:0.5rem 0.75rem 0.5rem 2.2rem; border:1px solid #d1d5db; border-radius:6px; font-size:0.875rem; width:240px; outline:none; }
        .penjualan-page .search-wrapper input:focus { border-color:#059669; box-shadow:0 0 0 3px rgba(5,150,105,0.1); }

        /* Table */
        .ps-table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
        .ps-table th { background:#f8fafc; padding:0.6rem 0.75rem; border-bottom:2px solid #e2e8f0; font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.3px; text-align:left; white-space:nowrap; }
        .ps-table td { padding:0.55rem 0.75rem; border-bottom:1px solid #f1f5f9; font-size:0.85rem; }
        .ps-table tr:hover td { background:#f8fafc; }
        .ps-table .ps-text-right { text-align:right; }
        .ps-mgmt-actions { display:flex; gap:0.3rem; flex-wrap:wrap; }
        .ps-action-btn { padding:0.25rem 0.5rem; border:1px solid #e2e8f0; border-radius:4px; background:#fff; font-size:0.75rem; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .ps-action-btn:hover { border-color:#94a3b8; background:#f8fafc; transform:translateY(-1px); }
        .ps-action-edit:hover { border-color:#f59e0b; color:#d97706; }
        .ps-action-delete:hover { border-color:#ef4444; color:#dc2626; }
        .ps-action-deliver:hover { border-color:#3b82f6; color:#2563eb; }
        .ps-action-invoice:hover { border-color:#059669; color:#047857; }
        .ps-action-pay:hover { border-color:#8b5cf6; color:#7c3aed; }
        .ps-action-sj:hover { border-color:#0ea5e9; color:#0284c7; }

        /* Status */
        .ps-status-badge { display:inline-block; padding:0.25rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:600; letter-spacing:0.2px; }
        .ps-status-order { background:#fef3c7; color:#92400e; }
        .ps-status-delivered { background:#dbeafe; color:#1e40af; }
        .ps-status-invoiced { background:#d1fae5; color:#065f46; }
        .ps-status-paid { background:#ede9fe; color:#5b21b6; }
        .ps-status-void { background:#fef3c7; color:#92400e; }
        .ps-action-void { background:#fffbeb; color:#b45309; border-color:#fcd34d; }
        .ps-action-void:hover { background:#fef3c7; }
        .sm-card-btn-void { background:#fffbeb; color:#b45309; border-color:#fcd34d; }
        .sm-card-btn-void:hover { background:#fef3c7; }

        /* Form */
        .ps-form { }
        .ps-nomor-row { margin-bottom: 0.75rem; }
        .ps-form-row { display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 0.75rem; margin-bottom: 1rem; }
        .ps-section-title { font-weight:600; font-size:0.9rem; color:#1e293b; margin-bottom:0.5rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; }
        .required { color:#dc2626; }

        /* Items grid */
        .ps-items-header, .ps-item-row { display: grid; grid-template-columns: 100px 180px 50px 60px 80px 70px 90px auto; gap: 0.25rem; align-items: center; margin-bottom: 0.25rem; }
        .ps-items-header { font-size:0.7rem; font-weight:600; color:#64748b; text-transform:uppercase; padding:0.35rem 0; border-bottom:1px solid #e2e8f0; margin-bottom:0.35rem; }
        .ps-col-action { text-align:center; }
        .ps-item-remove { padding: 0.1rem 0.35rem; border: none; background: #fee2e2; color: #dc2626; cursor: pointer; font-size: 0.75rem; line-height: 1.2; flex-shrink: 0; font-weight: 600; border-radius: 4px; white-space: nowrap; justify-self: start; }
        .ps-item-remove:hover { background: #fecaca; }
        .ps-col-action { text-align: left; }
        .ps-item-row input { width:100%; padding:0.3rem; border:1px solid #e2e8f0; border-radius:4px; font-size:0.8rem; background:#fff; }
        .ps-item-row input:focus { border-color:#059669; outline:none; box-shadow:0 0 0 2px rgba(5,150,105,0.1); }
        .ps-item-satuan { background:#f8fafc; cursor:default; color:#64748b; }
        .ps-add-item { margin: 0.5rem 0; }
        .ps-add-item-btn { padding: 0.35rem 0.75rem; border: 1px dashed #93c5fd; border-radius: 6px; background: #eff6ff; color: #2563eb; cursor: pointer; font-size: 0.8rem; transition: all 0.12s; }
        .ps-add-item-btn:hover { background: #dbeafe; }
        .ps-empty-items { padding:1rem; text-align:center; color:#94a3b8; font-size:0.85rem; border:1px dashed #e2e8f0; border-radius:6px; background:#f8fafc; }
        .ps-add-item { margin-top:0.5rem; }
        .ps-add-item-btn { border:1px dashed #cbd5e1; background:#fff; padding:0.4rem 1rem; border-radius:6px; font-size:0.85rem; color:#64748b; cursor:pointer; transition:all 0.15s; }
        .ps-add-item-btn:hover { border-color:#059669; color:#059669; background:#f0fdf4; }

        /* Totals */
        .ps-totals { margin-left:auto; width:300px; margin-top:1rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; }
        .ps-total-row { display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; font-size:0.85rem; color:#475569; }
        .ps-total-row input { width:100px; padding:0.25rem 0.5rem; border:1px solid #e2e8f0; border-radius:4px; font-size:0.85rem; text-align:right; }
        .ps-total-row input:focus { border-color:#059669; outline:none; }
        .ps-grand-total { font-weight:700; font-size:1rem; color:#059669; border-top:2px solid #059669; padding-top:0.5rem; margin-top:0.25rem; }

        /* Loading / Error */
        .ps-loading { text-align:center; padding:2rem; color:#64748b; }
        .ps-error { padding:2rem; text-align:center; color:#dc2626; background:#fef2f2; border-radius:8px; }

        /* Modal: form group helpers */
        .ps-form .form-group { display:flex; flex-direction:column; gap:0.25rem; }
        .ps-form .form-group label { font-size:0.8rem; font-weight:600; color:#475569; }
        .ps-form .form-group input, .ps-form .form-group select, .ps-form .form-group textarea { padding:0.45rem 0.6rem; border:1px solid #d1d5db; border-radius:6px; font-size:0.85rem; outline:none; }
        .ps-form .form-group input:focus, .ps-form .form-group select:focus, .ps-form .form-group textarea:focus { border-color:#059669; box-shadow:0 0 0 3px rgba(5,150,105,0.1); }
        .ps-form .form-group select { background:#fff; }
        .ps-form .form-group textarea { resize:vertical; }
        .ps-diskon-input { width:100px; text-align:right; }
        .ps-detail { }
        .ps-detail-header { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1rem; padding:0.75rem; background:#f8fafc; border-radius:6px; }
        .ps-detail-field { display:flex; flex-direction:column; gap:0.15rem; }
        .ps-detail-field strong { font-size:0.7rem; color:#94a3b8; text-transform:uppercase; }
        .ps-detail-field span { font-size:0.9rem; color:#1e293b; font-weight:500; }
        .ps-detail-items { margin-bottom:1rem; }
        .ps-detail-items th { font-size:0.7rem; padding:0.4rem 0.5rem; }
        .ps-detail-items td { font-size:0.8rem; padding:0.35rem 0.5rem; }
        .ps-detail-totals { margin-left:auto; width:250px; }
        .ps-detail-notes { margin-top:0.75rem; padding:0.75rem; background:#fffbeb; border-radius:6px; font-size:0.85rem; color:#92400e; border-left:3px solid #f59e0b; }

        /* Card */
        .ps-card-view { display:none; }
        @media (max-width:768px) {
            .ps-card-view { display:block; }
            /* Toolbar: judul di atas, pencarian + tombol di baris sendiri, mepet kanan */
            .penjualan-page .page-header { flex-direction: column; align-items: stretch; gap: 0.5rem; }
            .penjualan-page .page-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: nowrap; justify-content: flex-end; min-width: 0; }
            .penjualan-page .search-wrapper { flex: 1; min-width: 0; }
            .penjualan-page .search-wrapper input { width: 100%; padding: 0.45rem 0.75rem 0.45rem 2rem; font-size: 0.8rem; box-sizing: border-box; }
            .penjualan-page .smart-btn { font-size: 0.8rem; padding: 0.45rem 0.75rem; white-space: nowrap; flex-shrink: 0; }
            .ps-form-row { grid-template-columns:1fr; }
            .ps-items-header { display: none; }
            .ps-item-row { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem; margin-bottom: 0.5rem; background: #f0fdfa; border: 1px solid #d1fae5; border-radius: 8px; position: relative; }
            .ps-item-row input { width: 100%; box-sizing: border-box; }
            .ps-item-row > span { display: flex; align-items: center; gap: 0.35rem; }
            .ps-item-row > span[data-label]:not([data-label=""])::before { content: attr(data-label); font-size: 0.7rem; font-weight: 600; color: #6b7280; min-width: 70px; flex-shrink: 0; }
            /* Subtotal = input readonly identik field lain; tombol Tutup di kanan-bawah card */
            .ps-item-row:has(.ps-item-remove) { padding-bottom: 2.3rem; }
            .ps-item-remove { position: absolute; right: 0.15rem; bottom: 0.15rem; top: auto; transform: none; font-size: 0.9rem; padding: 0.2rem 0.45rem; border-radius: 6px; background: #fee2e2; color: #dc2626; z-index: 1; font-weight: 700; }
            /* Kode: ikon kamera pindah ke KANAN-ATAS kolom isian */
            .ps-item-row:has(.btn-scan) .ps-col-code { position: relative; padding-top: 1.7rem; padding-left: 0; }
            .ps-item-row:has(.btn-scan) .ps-col-code .kode-scan-wrapper { flex: 1; margin-right: 0; padding-left: 0; }
            .ps-item-row:has(.btn-scan) .ps-col-code .btn-scan { position: absolute; top: 0.05rem; right: 0; margin-left: 0; z-index: 1; padding: 0.2rem 0.45rem; }
            .ps-card-view .sm-card-actions { gap: 0.25rem; flex-wrap: wrap; }
            .ps-card-view .sm-card-btn { font-size: 0.65rem; padding: 0.2rem 0.35rem; }
        }

        /* Scanner integration */
        .kode-scan-wrapper { display:flex; gap:0.35rem; align-items:center; }
        .kode-scan-wrapper input { flex:1; min-width:0; }
        .btn-scan { padding:0.35rem 0.4rem; border:1px solid #d1d5db; border-radius:4px; background:#f8fafc; cursor:pointer; font-size:0.8rem; transition:all 0.15s; white-space:nowrap; display:inline-flex; align-items:center; gap:0.2rem; line-height:1; flex-shrink:0; }
        .btn-scan:hover { background:#eef2ff; border-color:#c7d2fe; }
    `;
}

// ═══════════════════════════════════════════════
//  Module Factory
// ═══════════════════════════════════════════════

export function PenjualanModule(deps = {}) {
    services = {
        listPenjualan: deps.listPenjualan || (async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
        getPenjualan: deps.getPenjualan || (async () => null),
        createPenjualan: deps.createPenjualan || (async () => { throw new Error("createPenjualan not configured"); }),
        updatePenjualan: deps.updatePenjualan || (async () => { throw new Error("updatePenjualan not configured"); }),
        deletePenjualan: deps.deletePenjualan || (async () => { throw new Error("deletePenjualan not configured"); }),
        voidPenjualan: deps.voidPenjualan || (async () => { throw new Error("voidPenjualan not configured"); }),
        updatePenjualanStatus: deps.updatePenjualanStatus || (async () => { throw new Error("updatePenjualanStatus not configured"); }),
        listCustomer: deps.listCustomer || (async () => ({ data: [] })),
        listBarang: deps.listBarang || (async () => ({ data: [] })),
        listWarehouse: deps.listWarehouse || (async () => ({ data: [] })),
        listSales: deps.listSales || (async () => ({ data: [] })),
        listReturPenjualan: deps.listReturPenjualan || (async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
        getReturPenjualan: deps.getReturPenjualan || (async () => null),
        createReturPenjualan: deps.createReturPenjualan || (async () => { throw new Error("createReturPenjualan not configured"); }),
        updateReturPenjualan: deps.updateReturPenjualan || (async () => { throw new Error("updateReturPenjualan not configured"); }),
        deleteReturPenjualan: deps.deleteReturPenjualan || (async () => { throw new Error("deleteReturPenjualan not configured"); }),
        updateReturPenjualanStatus: deps.updateReturPenjualanStatus || (async () => { throw new Error("updateReturPenjualanStatus not configured"); }),
        formatRupiah: deps.formatRupiah || ((v) => v?.toLocaleString?.() || "0"),
        getCompanyInfo: deps.getCompanyInfo || null,
        // M3-FIX v19 — pengaturan pajak transaksi kasir (radio di halaman ini).
        // Additive: hanya diaktifkan bila deps disediakan (POS app); inventory
        // tidak mengirim → radio tidak dirender.
        getPosSettings: deps.getPosSettings || null,
        setPosSettings: deps.setPosSettings || null,
        // M3-FIX v21 — mode POS (kasir): aksi hanya Nota/Void/Hapus, kolom
        // "No. Nota", tanpa tombol "Buat SO Baru". Additive: inventory tidak
        // mengirim flag ini → perilaku inventory tidak berubah.
        isPos: deps.isPos === true
    };

    return { PenjualanPage, initPenjualanPage };
}
