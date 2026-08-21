/**
 * Kasir Page — SMART Kasir (SP-029 M3).
 *
 * Layar kasir mengikuti mockup /srv/shared/uploads/kasir.html:
 *   - Login view tetap memakai shell aplikasi (Auth framework)
 *   - 3 kolom: Kategori (kiri) · Produk (tengah) · Bill (kanan)
 *   - Kart produk dengan tile gambar (foto opsional / placeholder), badge
 *     kategori & Jasa, harga
 *   - Keranjang dengan stepper qty, jenis pelanggan Member/Umum, bayar → kembalian
 *   - Pajak (11%) diatur Admin (Transaksi → Penjualan) — kasir hanya mengikuti
 *   - Checkout → POST /api/penjualan (sumber "pos") → struk printable (No. Nota)
 *
 * Data diambil dari GET /api/pos/kasir-data (satu request), fallback ke
 * listBarang bila API tidak tersedia.
 *
 * @module pos/pages/pos
 */

import { showToast, scanButtonHTML, scannerSectionHTML, attachScanner, Modal } from "@smart/ui";
import { Auth, Permission, esc } from "@smart/core";
import { apiCall } from "../../data/api.js";
// F&B V1 — audio notifikasi kasir (tone + pesan suara saat pembayaran masuk)
import { speak, playAlertTone } from "../../utils/audio-notify.js";
import { mountOrderMeja, refreshOrderMejaPanel } from "../order-meja/index.js";
// F&B V1 — Role-Based Notification Bell (cashier) + verifikasi bukti pembayaran
import {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead
} from "../../data/notification-data.js";
import {
    listOrderProofs,
    approvePaymentProof,
    rejectPaymentProof
} from "../../data/payment-proof-data.js";
import { listBarang, listKategori, listPenjualan, createPenjualan, getCompanyByCode, formatRupiah, openShift, closeShift, resumePenjualan, deletePenjualan, getMemberByKode, listCustomer, getPosSettings, listTableOrders } from "../../data/index.js";
import { isTransactionTypeEnabled } from "../../config/company-config.js";

// PRD V1 (keputusan PO 2026-08-10): tarif pajak transaksi = 11%.
const TAX_RATE = 0.11;

// Label & emoji metode pembayaran (PRD V1 §7.6 — extensible).
const PAYMENT_METHODS = [
    { value: "cash", label: "Tunai", icon: "💵" },
    { value: "transfer", label: "Transfer", icon: "🏦" },
    { value: "qris", label: "QRIS", icon: "📱" },
    { value: "card", label: "Kartu", icon: "💳" }
];

// Icon logout — SVG panah keluar dari pintu (pola icon logout umum, lihat
// Feather "log-out" / Flaticon 12635060). SVG dipakai karena simbol Unicode
// (mis. ⏻ / U+23FB) tidak dirender di sebagian font/perangkat (kotak kosong),
// sedangkan SVG konsisten di semua browser & HP. Warna mengikuti currentColor
// agar ikut warna teks tombol (putih di header kasir).
const LOGOUT_ICON = `<svg class="pos-logout-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

// ── State ──

const state = {
    produk: [],
    kategori: [],
    // Icon per kategori (Master Kategori → sidebar kasir); fallback 🏷️
    kategoriIcons: {},
    activeKategori: "Semua",
    searchQuery: "",
    keranjang: [],
    taxEnabled: true,
    // M3-FIX v19 — jenis pelanggan kasir: "umum" (default, harga normal) | "member" (harga khusus)
    tipePelanggan: "umum",
    // M3-FIX v20 — member terverifikasi (scan kartu / input kode) → { kode, nama }
    member: null,
    metodeBayar: "cash",
    diskonTransaksi: 0,
    catatanTransaksi: "",
    page: 1,
    pageSize: 24,
    // PRD V1 §12 — shift kasir (indikator + buka/tutup inline)
    shiftAktif: null,
    // PRD V1 §7.5 — transaksi ditahan (hold/resume)
    heldList: [],
    heldLoaded: false,
    // M3-FIX v21 — gudang terhubung kasir ({ kodeGudang, namaGudang } | null)
    gudang: null,
    // F&B V1 — tampilan konten tengah kasir: "produk" (default) | "order-meja"
    // (Order Meja EMBEDDED — tetap konten halaman kasir, bukan fullscreen)
    view: "produk"
};

let kasirName = "Kasir";
let kasirCompany = "";
let kasirLogo = "";

/**
 * Deteksi kasir dari ROLE user (sumber kebenaran), tidak hanya bergantung
 * pada shellConfig.fullscreen — M6-FIX v3: beberapa jalur render (mis. kasir
 * dibuka di dalam AppShell) tidak men-set flag fullscreen, sehingga modal
 * wajib & guard logout tidak aktif.
 * @returns {boolean}
 */
export function isKasirLogin() {
    try {
        const user = Auth.user && Auth.user();
        return Boolean(user && String(user.role || "").toLowerCase() === "kasir");
    } catch {
        return false;
    }
}

// ── Konfigurasi shell (di-set main.js) ──
// fullscreen=true → halaman kasir standalone (tanpa AppShell admin),
// sesuai mockup kasir.html (header + logout sendiri).
let shellConfig = { fullscreen: false, onLogout: null };

/**
 * Atur mode shell halaman kasir dari main.js.
 * @param {{ fullscreen?: boolean, onLogout?: Function|null }} opts
 */
export function configureKasirShell({ fullscreen = false, onLogout = null } = {}) {
    shellConfig = {
        fullscreen: Boolean(fullscreen),
        onLogout: typeof onLogout === "function" ? onLogout : null
    };
}

// Framework First: esc dari @smart/core (util global, bukan duplikat lokal)

// ── Page Shell ──

export function PosPage() {
    const fullscreen = shellConfig.fullscreen;
    return `
        <div class="pos-page ${fullscreen ? "pos-fullscreen" : ""}">
            <style>${getStyles()}</style>

            <header class="pos-header">
                <div class="pos-header-left">
                    <span class="pos-header-icon" id="pos-header-logo">🧾</span>
                    <div class="pos-header-text">
                        <h1>SMART Kasir</h1>
                        <span class="pos-header-sub"><span class="pos-header-kasir">${esc(kasirName)}</span>${kasirCompany ? `<span class="pos-header-company"> - ${esc(kasirCompany)}</span>` : ""}</span>
                    </div>
                </div>
                <div class="pos-header-right">
                    <!-- HP/Tablet — widget buka/tutup shift pindah ke TOP BAR
                         (footer sidebar disembunyikan di HP/tablet, jadi shift
                         tidak bisa dibuka/ditutup di sana). Desktop tetap
                         memakai widget sidebar (#pos-shift-widget). -->
                    <button id="pos-shift-header" class="pos-shift-header-btn" title="Buka Shift" aria-label="Buka Shift">🕐</button>
                    <!-- HP: bill tersembunyi — ikon keranjang membuka overlay bill -->
                    <button id="pos-cart-btn" class="pos-cart-btn" title="Buka Bill" aria-label="Buka Bill">
                        <span class="pos-cart-icon">🛒</span>
                        <span id="pos-cart-count" class="pos-cart-count">0</span>
                    </button>
                    <!-- F&B Payment Proof V1 — bell notifikasi kasir (muncul via
                         initCashierBell; tersembunyi bila tanpa permission fnb). -->
                    <button id="pos-bell-btn" class="pos-bell-btn" title="Order pending — klik untuk notifikasi" aria-label="Order pending — klik untuk notifikasi" style="display:none">
                        🔔<span id="pos-bell-count" class="pos-bell-count">0</span>
                    </button>
                    <!-- F&B V1 — Order Meja HP: icon-only di header (kanan lonceng),
                         tampil hanya di layar HP (media query). Desktop/tablet tetap
                         memakai tombol Order Meja di sidebar Kategori. -->
                    <button id="pos-order-meja-header" class="pos-order-meja-btn" title="Order Meja" aria-label="Order Meja">🍽️</button>
                    ${fullscreen ? "" : `<span class="pos-header-hint">Pilih produk, atur jumlah, lalu checkout</span>`}
                    ${fullscreen ? `<button id="pos-logout" class="pos-logout-btn" title="Keluar dari kasir">${LOGOUT_ICON}<span class="pos-logout-label"> Logout</span></button>` : ""}
                </div>
            </header>

            <div class="pos-body">
                <!-- KIRI: Kategori -->
                <aside class="pos-kategori">
                    <h3 class="pos-panel-title">Kategori</h3>
                    <div id="pos-kategori" class="pos-kategori-list"></div>
                    <!-- F&B V1 — Order Meja di SIDEBAR KASIR (setelah Kategori):
                         yang mengonfirmasi pembayaran QR Menu adalah kasir, bukan
                         admin — tombol navigasi ke halaman order-meja. -->
                    <button type="button" class="pos-kat-btn pos-kat-order-meja" id="pos-order-meja-sidebar" data-title="Order Meja" title="Order Meja">
                        <span class="pos-kat-icon">🧾</span>
                        <span class="pos-kat-name">Order Meja</span>
                    </button>
                    <!-- M3-FIX v23 — status bawah sidebar KIRI: Gudang, Shift, Pajak -->
                    <div class="pos-kategori-footer">
                        <div class="pos-status-row" id="pos-gudang-row" style="display:none">
                            <span>🏬 Gudang</span><span id="pos-gudang">-</span>
                        </div>
                        <div class="pos-status-row">
                            <span>Pajak (11%)</span>
                            <span id="pos-tax-status" class="pos-tax-status">Aktif</span>
                        </div>
                        <div id="pos-shift-widget"></div>
                        <!-- Tombol sembunyikan/lebarkan panel Kategori (pola sidebar admin) -->
                        <button type="button" class="pos-sidebar-collapse-btn" id="pos-sidebar-collapse-btn" aria-label="Collapse sidebar">
                            <span class="collapse-icon">◀</span>
                            <span class="collapse-label">Sembunyikan</span>
                        </button>
                    </div>
                </aside>

                <!-- TENGAH: Produk -->
                <section class="pos-produk">
                    <div class="pos-produk-head">
                        <h2 id="pos-kategori-title">Semua</h2>
                        <div class="pos-produk-tools">
                            <!-- Barcode dibaca USB reader: ketikan kode/barcode di kolom ini
                                 cocok persis → otomatis masuk bill (tanpa tombol kamera). -->
                            <input type="search" id="pos-search" placeholder="Cari nama / kode / barcode..." autocomplete="off" />
                        </div>
                    </div>
                    <div id="pos-produk-grid" class="pos-produk-grid"></div>
                    <div id="pos-produk-pager" class="pos-produk-pager"></div>
                </section>

                <!-- F&B V1 — Order Meja EMBEDDED di halaman kasir (bukan fullscreen):
                     konten tampil menggantikan produk+bill, sidebar Kategori tetap
                     terlihat — konsisten dengan halaman menu lainnya. -->
                <section class="pos-order-meja" id="pos-order-meja-panel" hidden></section>

                <!-- KANAN: Bill -->
                <aside class="pos-bill">
                    <!-- M3-FIX v23 — Jenis Pelanggan sejajar judul Bill (mepet kanan) -->
                    <div class="pos-bill-header">
                        <div class="pos-bill-header-left">
                            <!-- HP: tutup overlay bill kembali ke daftar produk (kiri judul Bill) -->
                            <button id="pos-bill-close" class="pos-bill-close" title="Tutup Bill" aria-label="Tutup Bill">✕</button>
                            <h2 class="pos-bill-title">Bill</h2>
                        </div>
                        <div class="pos-pelanggan-type" id="pos-pelanggan-type">
                            <button type="button" class="pos-type-btn active" data-type="umum">👤 Umum</button>
                            <button type="button" class="pos-type-btn" data-type="member">🎫 Member</button>
                        </div>
                    </div>
                    <div id="pos-keranjang" class="pos-keranjang"></div>

                    <div class="pos-bill-summary">
                        <div class="pos-bill-row"><span id="pos-subtotal-label">Sub Total</span><span id="pos-subtotal">Rp 0</span></div>
                        <div class="pos-bill-row pos-bill-meta">
                            <label for="pos-metode">Metode Bayar</label>
                            <select id="pos-metode" class="pos-metode-select">
                                ${PAYMENT_METHODS.map(m => `<option value="${m.value}">${m.icon} ${m.label}</option>`).join("")}
                            </select>
                        </div>
                        <div class="pos-bill-row">
                            <span>Diskon (Rp)</span>
                            <input id="pos-diskon" type="text" inputmode="numeric" value="0" autocomplete="off" placeholder="0" />
                        </div>
                        <div class="pos-bill-row"><span>Jumlah Pajak</span><span id="pos-pajak">Rp 0</span></div>
                        <div class="pos-bill-row pos-bill-total"><span>Total</span><span id="pos-total">Rp 0</span></div>
                        <div class="pos-bill-row pos-bill-bayar">
                            <span>Bayar</span>
                            <input id="pos-bayar" type="text" inputmode="numeric" value="0" autocomplete="off" />
                        </div>
                        <div class="pos-bill-row"><span>Kembalian</span><span id="pos-kembalian">Rp 0</span></div>
                        <input id="pos-catatan" type="text" placeholder="Catatan transaksi (opsional)" class="pos-catatan-input" autocomplete="off" />
                        <!-- PRD V1 §7.5 — Hold / Resume transaksi -->
                        <div id="pos-hold-actions" class="pos-hold-actions"></div>
                        <button id="pos-checkout-btn" class="pos-checkout-btn">
                            💵 Checkout &amp; Cetak Struk
                        </button>
                    </div>
                </aside>
                <!-- Tombol scroll ▲/▼ kolom bill (desktop & tablet) — mengambang
                     di tepi kanan; disembunyikan di HP (bill overlay sempit) dan
                     saat panel Order Meja terbuka (lihat showOrderMejaPanel). -->
                <div class="pos-bill-scroll" id="pos-bill-scroll">
                    <button type="button" class="pos-bill-scroll-btn" id="pos-bill-scroll-up" title="Gulir bill ke atas" aria-label="Gulir bill ke atas">▲</button>
                    <button type="button" class="pos-bill-scroll-btn" id="pos-bill-scroll-down" title="Gulir bill ke bawah" aria-label="Gulir bill ke bawah">▼</button>
                </div>
            </div>
        </div>
    `;
}

// ── Init ──

/**
 * Tombol scroll ▲/▼ kolom bill: scroll `.pos-bill` per langkah (smooth).
 * Tombol dinonaktifkan otomatis saat sudah di ujung atas/bawah; state
 * di-refresh saat scroll, resize, dan setiap perubahan konten bill
 * (item masuk/keluar, widget shift, hold, dll).
 */
function initBillScrollButtons() {
    const bill = document.querySelector(".pos-bill");
    const up = document.getElementById("pos-bill-scroll-up");
    const down = document.getElementById("pos-bill-scroll-down");
    if (!bill || !up || !down) return;
    const STEP = 260;
    const update = () => {
        const canUp = bill.scrollTop > 2;
        const canDown = bill.scrollTop + bill.clientHeight < bill.scrollHeight - 2;
        up.disabled = !canUp;
        down.disabled = !canDown;
    };
    up.addEventListener("click", () => bill.scrollBy({ top: -STEP, behavior: "smooth" }));
    down.addEventListener("click", () => bill.scrollBy({ top: STEP, behavior: "smooth" }));
    bill.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    try {
        new MutationObserver(update).observe(bill, { childList: true, subtree: true, attributes: true });
    } catch { /* observer tidak tersedia — state tetap di-refresh saat scroll/resize */ }
    update();
}

export async function initPosPage() {
    const user = Auth.user && Auth.user();
    if (user && user.name) kasirName = user.name;
    try {
        if (typeof globalThis !== "undefined" && globalThis.SMART) {
            const companyCode = globalThis.SMART.Session?.get?.("company.code")
                || globalThis.SMART.Company?.getCode?.();
            // Fallback instan: kode company — header langsung render,
            // nama perusahaan diperbaiki non-blocking (lihat bawah).
            if (companyCode) kasirCompany = String(companyCode);
        }
    } catch { /* ignore */ }

    // F&B V1 — tombol Order Meja di SIDEBAR KIRI kasir (setelah Kategori).
    // Yang mengonfirmasi pembayaran QR Menu adalah KASIR, bukan admin.
    // Tampil hanya bila permission pos.order.view + capability fnb aktif
    // (route tetap di-gate di router bila capability tidak aktif).
    const orderMejaSidebar = document.getElementById("pos-order-meja-sidebar");
    const orderMejaHeader = document.getElementById("pos-order-meja-header");
    if (orderMejaSidebar || orderMejaHeader) {
        let canOrder = false;
        try { canOrder = Permission.can("pos.order.view"); } catch { /* ignore */ }
        let fnbActive = false;
        try { fnbActive = isTransactionTypeEnabled("fnb"); } catch { /* ignore */ }
        if (!canOrder || !fnbActive) {
            if (orderMejaSidebar) orderMejaSidebar.style.display = "none";
            if (orderMejaHeader) orderMejaHeader.style.display = "none";
        } else {
            // F&B V1 — buka Order Meja sebagai KONTEN halaman kasir (embedded),
            // bukan halaman fullscreen terpisah. Sidebar (desktop/tablet) dan
            // tombol header HP sama-sama memanggil showOrderMejaPanel.
            if (orderMejaSidebar) orderMejaSidebar.addEventListener("click", showOrderMejaPanel);
            if (orderMejaHeader) orderMejaHeader.addEventListener("click", showOrderMejaPanel);
        }
    }

    // Mode fullscreen (role kasir): tombol Logout sendiri di header kasir
    const logoutBtn = document.getElementById("pos-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // M6-FIX v2/v3 — kasir yang masih punya shift terbuka wajib menutup
            // shift dulu sebelum logout (rekonsiliasi kas tidak terlewat).
            requestKasirLogout(() => {
                if (typeof shellConfig.onLogout === "function") shellConfig.onLogout();
            });
        });
    }

    // HP/Tablet — tombol shift di TOP BAR: klik membuka/tutup shift sesuai
    // state (perilaku sama dengan widget sidebar; di desktop tombol ini
    // tersembunyi via CSS). Shift milik kasir login aktif → Tutup Shift,
    // selainnya (belum ada / shift kasir lain) → Buka Shift.
    const shiftHeaderBtn = document.getElementById("pos-shift-header");
    if (shiftHeaderBtn) {
        shiftHeaderBtn.addEventListener("click", () => {
            const shift = state.shiftAktif;
            if (shift && isMyShift(shift)) {
                closeShiftModal();
            } else {
                openShiftModal();
            }
        });
    }

    // Search + scan (USB reader) — kolom pencarian berperilaku "pintar":
    // - ketikan/scan yang COCOK PERSIS kode/barcode produk → langsung masuk
    //   bill (reader barcode USB yang mengetik ke kolom ini otomatis ikut
    //   perilaku ini).
    // - ketikan berupa nama produk (tidak cocok persis kode) → tetap filter
    //   grid seperti biasa.
    const searchEl = document.getElementById("pos-search");
    if (searchEl) {
        let searchTimer = null;
        const processSearch = () => {
            const raw = String(searchEl.value || "").trim();
            if (raw) {
                const isExactKode = state.produk.some(p =>
                    String(p.kode || "").toLowerCase() === raw.toLowerCase()
                    || (p.barcode && String(p.barcode).toLowerCase() === raw.toLowerCase())
                );
                if (isExactKode) {
                    const ok = addByBarcode(raw);
                    if (ok) {
                        // Scan sukses → bersihkan pencarian, kembali ke daftar penuh
                        searchEl.value = "";
                        state.searchQuery = "";
                        renderProduk();
                        return;
                    }
                    // Stok habis → biarkan grid menampilkan produk tsb (filter)
                }
            }
            state.searchQuery = raw.toLowerCase();
            state.page = 1;
            renderProduk();
        };
        searchEl.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(processSearch, 150);
        });
        searchEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(searchTimer);
                processSearch();
            }
        });
    }

    // Tombol sembunyikan/lebarkan panel Kategori — pola sidebar admin
    // (class .collapsed + persist localStorage + ikon/label ◀/▶).
    initKasirSidebarCollapse();

    // HP — ikon keranjang di header: buka/tutup overlay bill (bill tersembunyi
    // di layar HP, produk memenuhi seluruh halaman). Tombol tutup (✕) di
    // header bill menutupnya kembali.
    const cartBtn = document.getElementById("pos-cart-btn");
    if (cartBtn) {
        cartBtn.addEventListener("click", () => {
            document.querySelector(".pos-page")?.classList.toggle("bill-open");
        });
    }
    const billCloseBtn = document.getElementById("pos-bill-close");
    if (billCloseBtn) {
        billCloseBtn.addEventListener("click", () => {
            document.querySelector(".pos-page")?.classList.remove("bill-open");
        });
    }

    // Barcode dibaca USB reader (bukan kamera) — ketikan masuk kolom #pos-search
    // dan diproses addByBarcode di atas. Kamera produk dihapus (tanpa attachScanner).

    // PRD V1 — metode bayar / diskon / catatan transaksi
    const metodeEl = document.getElementById("pos-metode");
    if (metodeEl) {
        metodeEl.addEventListener("change", () => {
            state.metodeBayar = metodeEl.value;
            renderBill();
        });
    }
    const diskonEl = document.getElementById("pos-diskon");
    if (diskonEl) {
        diskonEl.addEventListener("input", () => {
            const digits = String(diskonEl.value || "").replace(/\D/g, "");
            diskonEl.value = digits ? Number(digits).toLocaleString("id-ID") : "";
            state.diskonTransaksi = digits ? Number(digits) : 0;
            renderBill();
        });
    }
    const catatanEl = document.getElementById("pos-catatan");
    if (catatanEl) {
        catatanEl.addEventListener("input", () => {
            state.catatanTransaksi = catatanEl.value.trim().slice(0, 200);
        });
    }

    // Delegated clicks: kategori, produk, keranjang, pager, tax, bayar, checkout
    const root = document.querySelector(".pos-page");
    if (root) {
        root.addEventListener("click", handleClick);
    }
    const bayarEl = document.getElementById("pos-bayar");
    if (bayarEl) {
        bayarEl.addEventListener("input", () => {
            const digits = String(bayarEl.value || "").replace(/\D/g, "");
            bayarEl.value = digits ? Number(digits).toLocaleString("id-ID") : "";
            renderBill();
        });
        bayarEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); checkout(); }
        });
    }

    await loadKasirData();
    renderKasir();
    renderShiftWidget();
    // Omset Kasir (sidebar kiri) — refresh berkala agar tetap sinkron
    // walau halaman dibiarkan terbuka (mis. refund dari KDS mengurangi
    // penjualan shift tanpa interaksi kasir).
    startOmsetAutoRefresh();
    renderHoldActions();
    refreshHeldList();

    // Tombol scroll ▲/▼ kolom bill (desktop & tablet).
    initBillScrollButtons();

    // F&B Payment Proof V1 — bell notifikasi kasir (unread count + verifikasi
    // bukti pembayaran QRIS/Transfer dari customer).
    initCashierBell();

    // M6-FIX v2/v3 — kasir yang login & belum ada shift aktif: arahkan
    // langsung ke modal Buka Shift (melayang di atas halaman kasir,
    // NON-dismissable — kasir tidak bisa bertransaksi sebelum shift dibuka).
    // Identitas = kasir yang login, jadi modal TANPA pilihan kasir (lihat
    // openShiftModal). Guard permission konsisten dengan renderShiftWidget.
    let canShift = false;
    try { canShift = Permission.can("pos.shift.open"); } catch { /* ignore */ }
    const kasirMode = Boolean(shellConfig.fullscreen) || isKasirLogin();
    if (kasirMode && !state.shiftAktif && canShift) {
        openShiftModal(true);
    }

    // Non-blocking: ganti kode → NAMA perusahaan (SSOT Master Platform via
    // getCompanyByCode). Render tidak menunggu network call (pola sama dgn
    // fetch logo async di halaman lain).
    patchKasirCompanyName();
}

/**
 * F&B V1 — tampilkan panel Order Meja EMBEDDED di halaman kasir.
 * Produk & bill disembunyikan, panel order-meja mengisi area konten;
 * sidebar Kategori (dan tombol Order Meja) tetap terlihat.
 */
function showOrderMejaPanel() {
    if (state.view === "order-meja") return;
    state.view = "order-meja";
    const produk = document.querySelector(".pos-produk");
    const bill = document.querySelector(".pos-bill");
    const panel = document.getElementById("pos-order-meja-panel");
    if (produk) produk.style.display = "none";
    if (bill) bill.style.display = "none";
    // Tombol scroll bill tidak relevan saat panel Order Meja mengisi konten
    const scrollBtns = document.getElementById("pos-bill-scroll");
    if (scrollBtns) scrollBtns.style.display = "none";
    if (panel) {
        panel.hidden = false;
        mountOrderMeja(panel, { showBack: true, onBack: showProdukPanel, showRefresh: true });
    }
}

/**
 * F&B V1 — kembali ke tampilan produk kasir (panel Order Meja disembunyikan).
 */
function showProdukPanel() {
    if (state.view === "produk") return;
    state.view = "produk";
    const produk = document.querySelector(".pos-produk");
    const bill = document.querySelector(".pos-bill");
    const panel = document.getElementById("pos-order-meja-panel");
    if (produk) produk.style.display = "";
    if (bill) bill.style.display = "";
    const scrollBtns = document.getElementById("pos-bill-scroll");
    if (scrollBtns) scrollBtns.style.display = "";
    if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
    }
    renderKasir();
}

/**
 * Tombol sembunyikan/lebarkan panel Kategori (pola sidebar admin):
 * toggle class `.collapsed` (ikon-only + tooltip), persist ke localStorage,
 * ubah ikon ◀/▶ & label Sembunyikan/Lebarkan.
 */
function initKasirSidebarCollapse() {
    const btn = document.getElementById("pos-sidebar-collapse-btn");
    const panel = document.querySelector(".pos-kategori");
    if (!btn || !panel) return;
    const saved = localStorage.getItem("pos-kategori-collapsed");
    if (saved === "true") {
        panel.classList.add("collapsed");
        const icon = btn.querySelector(".collapse-icon");
        if (icon) icon.textContent = "▶";
        const label = btn.querySelector(".collapse-label");
        if (label) label.textContent = "Lebarkan";
    }
    btn.addEventListener("click", () => {
        const isCollapsed = panel.classList.toggle("collapsed");
        localStorage.setItem("pos-kategori-collapsed", isCollapsed);
        const icon = btn.querySelector(".collapse-icon");
        const label = btn.querySelector(".collapse-label");
        if (isCollapsed) {
            if (icon) icon.textContent = "▶";
            if (label) label.textContent = "Lebarkan";
        } else {
            if (icon) icon.textContent = "◀";
            if (label) label.textContent = "Sembunyikan";
        }
    });
}

/**
 * Apakah shift milik kasir yang login? (M6-FIX multi-kasir) — selain nama,
 * bandingkan juga kasirUsername (shift legacy tersimpan nama generik "Kasir"
 * tapi kasirUsername asli dari JWT). Dipakai widget sidebar & tombol top bar.
 * @param {object|null} shift Dokumen Shift
 * @returns {boolean}
 */
function isMyShift(shift) {
    if (!shift) return false;
    const userNow = Auth.user && Auth.user();
    return !shift.kasir
        || String(shift.kasir).toLowerCase() === String(kasirName).toLowerCase()
        || (shift.kasirUsername && userNow && String(shift.kasirUsername).toLowerCase() === String(userNow.username || "").toLowerCase());
}

/**
 * PRD V1 §12 — widget shift di kolom bill (role kasir):
 * - tanpa shift aktif → tombol "Buka Shift" (kas awal)
 * - shift aktif → badge kasir + kas awal + tombol "Tutup Shift"
 * Hanya ditampilkan bila user punya permission pos.shift.open (kasir/admin).
 * Sekaligus menyinkronkan tombol shift di TOP BAR (HP/tablet).
 */
function renderShiftWidget() {
    const el = document.getElementById("pos-shift-widget");
    if (!el) return;
    // HP/Tablet — tombol shift di top bar ikut state yang sama dengan widget
    // sidebar (desktop: tombol tersembunyi via CSS, widget sidebar yang jalan).
    updateShiftHeaderBtn();
    let canShift = false;
    try { canShift = Permission.can("pos.shift.open"); } catch { /* ignore */ }
    if (!canShift) { el.innerHTML = ""; return; }

    const shift = state.shiftAktif;
    if (!shift) {
        el.innerHTML = `
            <button class="pos-shift-btn" id="pos-shift-open">🕐 Buka Shift</button>
        `;
        const btn = el.querySelector("#pos-shift-open");
        if (btn) btn.addEventListener("click", () => openShiftModal());
        return;
    }
    // M6-FIX — multi-kasir: hanya shift milik kasir LOGIN yang aktif & bisa
    // ditutup. Shift kasir lain (fallback legacy) tampil sebagai info saja,
    // dan kasir ini tetap bisa membuka shift sendiri.
    // M6-FIX v3 lanjutan — selain nama, bandingkan juga kasirUsername (shift
    // legacy tersimpan nama generik "Kasir" tapi kasirUsername asli dari JWT).
    const mine = isMyShift(shift);
    if (!mine) {
        el.innerHTML = `
            <div class="pos-shift-active pos-shift-other">
                <div class="pos-shift-row">
                    <span class="pos-shift-dot"></span>
                    <span class="pos-shift-txt">Shift aktif oleh <strong>${esc(shift.kasir)}</strong></span>
                </div>
                <button class="pos-shift-btn" id="pos-shift-open">🕐 Buka Shift Saya</button>
            </div>
        `;
        const btn = el.querySelector("#pos-shift-open");
        if (btn) btn.addEventListener("click", () => openShiftModal());
        return;
    }
    el.innerHTML = `
        <div class="pos-shift-active">
            <div class="pos-shift-row">
                <span class="pos-shift-dot"></span>                    <!-- M6-FIX: nama kasir sudah tampil di topbar — cukup kas awal -->
                <span class="pos-shift-txt">Kas awal <strong>Rp ${formatRupiah(shift.kasAwal)}</strong></span>
                <button class="pos-shift-btn pos-shift-btn-close" id="pos-shift-close">🧾 Tutup</button>
            </div>
            <div class="pos-shift-row pos-shift-omzet-row">
                <span class="pos-shift-txt">Omset Kasir</span>
                <strong class="pos-shift-omzet-val" id="pos-shift-omzet">Rp 0</strong>
            </div>
        </div>
    `;
    const btn = el.querySelector("#pos-shift-close");
    if (btn) btn.addEventListener("click", () => closeShiftModal());
    // Omset kasir (penjualan sejak shift dibuka) — refresh non-blocking
    refreshShiftOmset();
}

/**
 * HP/Tablet — tombol shift di TOP BAR (pola icon tombol header kasir):
 * - tanpa shift aktif → 🕐 (klik = Buka Shift)
 * - shift kasir lain aktif → 🕐 (klik = Buka Shift Saya)
 * - shift MILIK kasir login aktif → 🧾 (klik = Tutup Shift)
 * Tersembunyi di desktop (CSS) — desktop tetap memakai widget sidebar.
 */
function updateShiftHeaderBtn() {
    const btn = document.getElementById("pos-shift-header");
    if (!btn) return;
    let canShift = false;
    try { canShift = Permission.can("pos.shift.open"); } catch { /* ignore */ }
    if (!canShift) { btn.style.display = "none"; return; }
    // Kembalikan ke CSS: desktop display:none, HP/tablet display:inline-flex
    btn.style.display = "";
    const shift = state.shiftAktif;
    const mine = isMyShift(shift);
    if (shift && mine) {
        btn.title = "Tutup Shift";
        btn.setAttribute("aria-label", "Tutup Shift");
        btn.innerHTML = `🧾`;
    } else if (shift) {
        btn.title = "Buka Shift Saya";
        btn.setAttribute("aria-label", "Buka Shift Saya");
        btn.innerHTML = `🕐`;
    } else {
        btn.title = "Buka Shift";
        btn.setAttribute("aria-label", "Buka Shift");
        btn.innerHTML = `🕐`;
    }
}

/**
 * Omset kasir yang login — total penjualan (grandTotal) sejak shift dibuka
 * sampai sekarang (GET /pos/shift/summary, scoped per-kasir oleh server).
 * Dipanggil saat widget shift dirender, setelah checkout berhasil, setelah
 * aksi bell kasir (verifikasi bukti bayar / refund), dan tiap 30 detik
 * (refresh berkala — widget tetap sinkron walau halaman dibiarkan terbuka).
 */
async function refreshShiftOmset() {
    const el = document.getElementById("pos-shift-omzet");
    if (!el) return;
    try {
        const res = await apiCall("GET", "/pos/shift/summary");
        // Terima number ATAU string numerik (robust thd perubahan bentuk
        // response server) — selain itu 0 (formatRupiah NaN-safe).
        const raw = res && res.totalPenjualan;
        const omset = (raw === null || raw === undefined || raw === "") ? 0 : (Number(raw) || 0);
        el.textContent = `Rp ${formatRupiah(omset)}`;
    } catch {
        // Gagal (offline / summary 404): biarkan nilai terakhir — jangan
        // menimpa angka yang sudah benar dengan "Rp 0" yang menyesatkan.
    }
}

// Refresh berkala Omset Kasir (30 detik) — widget di sidebar kiri tetap
// sinkron walau tidak ada interaksi (mis. refund dari KDS/kitchen yang
// mengurangi penjualan shift, atau halaman dibiarkan terbuka lama).
let omsetTimer = null;

function startOmsetAutoRefresh() {
    clearInterval(omsetTimer);
    omsetTimer = setInterval(refreshShiftOmset, 30000);
}

async function openShiftModal(required = false) {
    // M6-FIX v2 — mode kasir (fullscreen): identitas = kasir yang login, jadi
    // TANPA pilihan kasir. Mode admin: pilihan nama kasir bila ada >1 kasir
    // (daftar dari Settings API), kasir login dipilih otomatis.
    // required=true (auto setelah login kasir): modal non-dismissable — kasir
    // wajib buka shift dulu sebelum bisa bertransaksi.
    const isKasirMode = Boolean(shellConfig.fullscreen) || isKasirLogin();
    const me = String(kasirName || "").trim().toLowerCase();
    let kasirList = [];
    let selected = null;
    if (!isKasirMode) {
        try {
            const s = await getPosSettings();
            kasirList = Array.isArray(s?.kasirUsers) ? s.kasirUsers : [];
        } catch (err) {
            console.warn("[Kasir] Gagal memuat daftar kasir:", err?.message);
        }
        if (kasirList.length) {
            selected = kasirList.find(k => String(k.nama || "").trim().toLowerCase() === me)
                || (kasirList.length === 1 ? kasirList[0] : null);
        }
    }

    const kasirSelectHTML = !isKasirMode && kasirList.length > 1
        ? `
            <label for="f-shift-kasir">Kasir</label>
            <select class="smart-input" id="f-shift-kasir">
                ${kasirList.map(k => `<option value="${esc(k.username || k.nama)}" ${selected && k.username === selected.username ? "selected" : ""}>${esc(k.nama || k.username)}${String(k.nama || "").trim().toLowerCase() === me ? " (Anda)" : ""}</option>`).join("")}
            </select>
        `
        : "";

    const content = `
        <p class="pos-modal-hint">Masukkan kas awal (uang fisik di laci) untuk membuka shift.</p>
        <div class="bl-form" style="margin-top:10px">
            ${kasirSelectHTML}
            <label for="f-kas-awal">Kas Awal (Rp)</label>
            <input class="smart-input" id="f-kas-awal" type="text" inputmode="numeric" value="0" autocomplete="off" />
        </div>
    `;
    // M6-FIX v3 — modal wajib (setelah login): Buka Shift 49% + Logout 49%
    // (spasi 2%) — jalur keluar utk kasir yg terlanjur login tapi batal buka
    // shift (modal non-dismissable, jadi Logout adalah satu-satunya jalan).
    const footer = required
        ? `
            <div class="shift-open-actions">
                <button class="smart-btn smart-btn-primary" id="f-shift-confirm" style="width:49%">Buka Shift</button>
                <button class="smart-btn smart-btn-secondary" id="f-shift-logout" style="width:49%">${LOGOUT_ICON} Logout</button>
            </div>
        `
        : `
            <button class="smart-btn smart-btn-secondary" id="f-shift-cancel">Batal</button>
            <button class="smart-btn smart-btn-primary" id="f-shift-confirm">Buka Shift</button>
        `;
    const overlay = Modal({ open: true, title: required ? "🕐 Buka Shift — Wajib" : "🕐 Buka Shift", content, footer, closable: !required, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    const kasAwalEl = overlay.querySelector("#f-kas-awal");
    kasAwalEl?.addEventListener("input", () => {
        const digits = String(kasAwalEl.value || "").replace(/\D/g, "");
        kasAwalEl.value = digits ? Number(digits).toLocaleString("id-ID") : "0";
    });
    overlay.querySelector("#f-shift-cancel")?.addEventListener("click", () => overlay.remove());
    // M6-FIX v3 — Logout dari modal wajib: kasir batal buka shift → keluar.
    // Reuse requestKasirLogout (guard shift) lalu panggil onLogout shell.
    overlay.querySelector("#f-shift-logout")?.addEventListener("click", () => {
        overlay.remove();
        requestKasirLogout(() => {
            if (typeof shellConfig.onLogout === "function") shellConfig.onLogout();
        });
    });
    overlay.querySelector("#f-shift-confirm")?.addEventListener("click", async () => {
        const kasAwal = Number(String(kasAwalEl?.value || "0").replace(/\D/g, "")) || 0;
        const kasirSel = overlay.querySelector("#f-shift-kasir");
        const picked = kasirSel
            ? kasirList.find(k => String(k.username || k.nama) === kasirSel.value) || null
            : (isKasirMode ? null : selected);
        try {
            // M6-FIX v3 lanjutan — mode kasir: kirim nama kasir EKSPLISIT dari
            // Auth.user() (bukan bergantung fallback header/JWT) agar shift
            // tersimpan persis dengan nama yang dibandingkan widget (kasirName).
            const userNow = Auth.user && Auth.user();
            const kasirObj = picked
                ? { name: picked.nama, username: picked.username }
                : (isKasirMode ? { name: kasirName, username: (userNow && userNow.username) || "" } : {});
            const shift = await openShift(kasAwal, "", kasirObj);
            state.shiftAktif = shift || { kasAwal };
            showToast("success", `Shift dibuka untuk ${esc(picked ? (picked.nama || picked.username) : kasirName)} — kas awal Rp ${formatRupiah(kasAwal)}`);
            overlay.remove();
            renderShiftWidget();
        } catch (err) {
            showToast("danger", err.message || "Gagal membuka shift");
            // Modal wajib (login kasir tanpa shift): tetap tampil agar kasir
            // tidak bisa melewati buka shift — buka ulang tanpa spinner hang.
            if (required) {
                overlay.remove();
                setTimeout(() => openShiftModal(true), 400);
            }
        }
    });
}

/**
 * Wajib tutup shift sebelum logout (M6-FIX v3). Dipakai tombol Logout kasir
 * & handleLogout (main.js) — bila masih ada shift aktif milik kasir, buka
 * modal Tutup Shift dulu; logout hanya dieksekusi setelah shift tertutup.
 *
 * Bila state lokal kosong (kasir di-render jalur lain / loadKasirData belum
 * jalan), cek ke SERVER (listShifts status=open) supaya shift yang terbuka
 * tidak lolos logout (hasil review — defense in depth).
 * @param {Function} onDone Callback saat aman logout (shift sudah ditutup / tidak ada)
 */
export async function requestKasirLogout(onDone = null) {
    const done = typeof onDone === "function" ? onDone : () => {};
    if (state.shiftAktif) {
        closeShiftModal(() => done());
        return;
    }
    // State lokal kosong → verifikasi ke server SEBELUM mengizinkan logout.
    // M6-FIX v3: filter HANYA shift milik kasir login (nama/username dari
    // Auth.user()) — jangan company-wide, karena shift kasir lain TIDAK boleh
    // menahan logout kasir yang tak punya shift sendiri.
    try {
        const { listShifts } = await import("../../data/shift-data.js");
        const res = await listShifts({ page: 1, limit: 10, status: "open" });
        const openShifts = res?.data || [];
        const me = Auth.user && Auth.user();
        const myName = String((me && (me.name || "")) || "").trim().toLowerCase();
        const myUsername = String((me && (me.username || "")) || "").trim().toLowerCase();
        const mine = openShifts.find(s => {
            const k = String(s.kasir || "").trim().toLowerCase();
            const ku = String(s.kasirUsername || "").trim().toLowerCase();
            return (myName && k === myName) || (myUsername && ku === myUsername);
        });
        if (mine) {
            state.shiftAktif = mine;
            closeShiftModal(() => done());
            return;
        }
    } catch { /* offline / gagal cek — izinkan logout (perilaku lama aman) */ }
    done();
}

function closeShiftModal(onDone = null) {
    // M6-FIX v3 — ringkasan shift sebelum menutup: saldo awal, penjualan
    // tunai & non-tunai, lalu kas diharapkan (= saldo awal + penjualan tunai).
    // Selisih live = actual − kas diharapkan ditampilkan saat kasir mengetik.
    let summary = null;
    const content = `
        <p class="pos-modal-hint">Cocokkan uang fisik di laci. Kas diharapkan = saldo awal + penjualan tunai.</p>
        <div class="bl-form" style="margin-top:10px">
            <div class="shift-summary" id="f-shift-summary"><div class="cn-muted">Memuat ringkasan…</div></div>
            <label for="f-actual-cash">Actual Cash (Rp)</label>
            <input class="smart-input" id="f-actual-cash" type="text" inputmode="numeric" value="0" autocomplete="off" />
            <div class="shift-selisih" id="f-shift-selisih"></div>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="f-shift-cancel">Batal</button>
        <button class="smart-btn smart-btn-danger" id="f-shift-confirm">Tutup Shift</button>
    `;
    const overlay = Modal({ open: true, title: "🧾 Tutup Shift", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    const actualEl = overlay.querySelector("#f-actual-cash");

    const renderSelisih = () => {
        const el = overlay.querySelector("#f-shift-selisih");
        if (!el) return;
        if (!summary) { el.innerHTML = ""; return; }
        const actual = Number(String(actualEl?.value || "0").replace(/\D/g, "")) || 0;
        const diff = actual - summary.expectedCash;
        if (diff === 0) {
            el.innerHTML = `<div class="shift-selisih-ok">✓ Kas pas — actual sesuai kas diharapkan (Rp ${formatRupiah(summary.expectedCash)})</div>`;
        } else if (diff > 0) {
            el.innerHTML = `<div class="shift-selisih-warn">➕ Kas lebih <strong>Rp ${formatRupiah(diff)}</strong> dari kas diharapkan</div>`;
        } else {
            el.innerHTML = `<div class="shift-selisih-warn shift-selisih-minus">➖ Kas kurang <strong>Rp ${formatRupiah(Math.abs(diff))}</strong> — cek kembali hitungan fisik Anda</div>`;
        }
    };

    actualEl?.addEventListener("input", () => {
        const digits = String(actualEl.value || "").replace(/\D/g, "");
        actualEl.value = digits ? Number(digits).toLocaleString("id-ID") : "0";
        renderSelisih();
    });
    overlay.querySelector("#f-shift-cancel")?.addEventListener("click", () => overlay.remove());

    // Ambil ringkasan shift (fresh dari server) saat modal dibuka
    (async () => {
        try {
            const res = await apiCall("GET", "/pos/shift/summary");
            if (res && typeof res.expectedCash === "number") {
                summary = res;
                const rowsEl = overlay.querySelector("#f-shift-summary");
                if (rowsEl) {
                    rowsEl.innerHTML = `
                        <div class="shift-summary-row"><span>Saldo Awal</span><strong>Rp ${formatRupiah(res.kasAwal)}</strong></div>
                        <div class="shift-summary-row"><span>Penjualan Tunai</span><strong>Rp ${formatRupiah(res.penjualanTunai)}</strong></div>
                        <div class="shift-summary-row"><span>Penjualan Non-Tunai</span><strong>Rp ${formatRupiah(res.penjualanNonTunai)}</strong></div>
                        ${Number(res.totalRefund) ? `<div class="shift-summary-row shift-summary-refund"><span>Refund (order dibatalkan)</span><strong>− Rp ${formatRupiah(res.totalRefund)}</strong></div>` : ""}
                        <div class="shift-summary-row shift-summary-sub"><span>Total Penjualan (${res.totalTransaksi} transaksi)${Number(res.totalRefund) ? " — sudah dipotong refund" : ""}</span><strong>Rp ${formatRupiah(res.totalPenjualan)}</strong></div>
                        <div class="shift-summary-row shift-summary-expected"><span>Kas Diharapkan (saldo awal + tunai)</span><strong>Rp ${formatRupiah(res.expectedCash)}</strong></div>
                    `;
                }
                renderSelisih();
            }
        } catch (err) {
            const rowsEl = overlay.querySelector("#f-shift-summary");
            if (rowsEl) rowsEl.innerHTML = `<div class="cn-muted">Ringkasan tidak tersedia — server akan menghitung saat tutup.</div>`;
        }
    })();

    overlay.querySelector("#f-shift-confirm")?.addEventListener("click", async () => {
        const actualCash = Number(String(actualEl?.value || "0").replace(/\D/g, "")) || 0;
        try {
            const closed = await closeShift(actualCash);
            state.shiftAktif = null;
            const diff = Number(closed?.difference) || 0;
            showToast("success", `Shift ditutup — expected Rp ${formatRupiah(closed?.expectedCash || 0)}, selisih ${diff > 0 ? "+" : ""}Rp ${formatRupiah(diff)}`);
            overlay.remove();
            renderShiftWidget();
            // M6-FIX v2 — setelah shift tertutup, lanjutkan aksi berikutnya
            // (mis. logout kasir yang menunggu shift ditutup dulu).
            if (typeof onDone === "function") onDone();
        } catch (err) {
            showToast("danger", err.message || "Gagal menutup shift");
        }
    });
}

/**
 * Perbaiki label header kasir menjadi "[nama kasir] - [Nama Perusahaan]"
 * tanpa memblokir render awal (fallback awal = kode company).
 */
function patchKasirCompanyName() {
    try {
        if (typeof globalThis === "undefined" || !globalThis.SMART) return;
        const companyCode = globalThis.SMART.Session?.get?.("company.code")
            || globalThis.SMART.Company?.getCode?.();
        if (!companyCode) return;
        getCompanyByCode(companyCode)
            .then((company) => {
                if (company) {
                    // Nama perusahaan (SSOT Console) — fallback kode bila kosong
                    const name = company.name ? String(company.name) : "";
                    if (name) {
                        kasirCompany = name;
                        const companyEl = document.querySelector(".pos-header-company");
                        if (companyEl) {
                            companyEl.textContent = ` - ${name}`;
                        } else {
                            // Fallback (header dirender sebelum patch): tambah span company
                            const sub = document.querySelector(".pos-header-sub");
                            if (sub) sub.innerHTML = `<span class="pos-header-kasir">${esc(kasirName)}</span><span class="pos-header-company"> - ${esc(name)}</span>`;
                        }
                    }
                    // Logo perusahaan — branding header kiri (pola halaman admin).
                    // onerror: logo rusak/kadaluarsa → kembali ke emoji fallback.
                    if (company.logo) {
                        kasirLogo = String(company.logo);
                        const logoHost = document.getElementById("pos-header-logo");
                        if (logoHost) {
                            logoHost.innerHTML = `<img class="pos-header-logo-img" src="${esc(kasirLogo)}" alt="${esc(company.name || "Logo")}" onerror="this.parentNode.textContent='🧾'" />`;
                        }
                    }
                }
                // Icon tab browser = logo yang sama dgn halaman admin:
                // company logo, fallback logo superadmin (pola renderApp main.js).
                const faviconUrl = company && company.logo ? String(company.logo) : null;
                if (faviconUrl) {
                    setKasirFavicon(faviconUrl);
                } else {
                    try {
                        const saLogo = localStorage.getItem("smart_superadmin_logo");
                        if (saLogo) setKasirFavicon(saLogo);
                    } catch { /* ignore */ }
                }
            })
            .catch(() => { /* tetap pakai kode */ });
    } catch { /* ignore */ }
}

/**
 * Set favicon (icon tab browser) = logo yang sama dgn halaman admin.
 * @param {string} url
 */
function setKasirFavicon(url) {
    if (!url) return;
    try {
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = url;
    } catch { /* ignore */ }
}

function handleClick(e) {
    const katBtn = e.target.closest("[data-kategori]");
    if (katBtn) {
        // F&B V1 — klik kategori saat panel Order Meja terbuka: kembali ke produk
        if (state.view !== "produk") showProdukPanel();
        state.activeKategori = katBtn.dataset.kategori;
        state.page = 1;
        renderKasir();
        return;
    }
    const prod = e.target.closest("[data-key]");
    if (prod) {
        if (prod.dataset.disabled === "1") return;
        // M6.2-FIX v0.42 — produk ber-varian: buka modal pilih varian dulu
        if (prod.dataset.varian) {
            openVarianModal(prod.dataset.key);
        } else {
            addToCart(prod.dataset.key);
        }
        return;
    }
    const minus = e.target.closest("[data-minus]");
    if (minus) {
        changeQty(minus.dataset.minus, -1);
        return;
    }
    const plus = e.target.closest("[data-plus]");
    if (plus) {
        changeQty(plus.dataset.plus, 1);
        return;
    }
    const remove = e.target.closest("[data-remove]");
    if (remove) {
        state.keranjang = state.keranjang.filter(i => i.key !== remove.dataset.remove);
        renderBill();
        return;
    }
    const pager = e.target.closest("[data-page]");
    if (pager) {
        state.page = Number(pager.dataset.page);
        renderProduk();
        return;
    }
    const typeBtn = e.target.closest("[data-type]");
    if (typeBtn) {
        setTipePelanggan(typeBtn.dataset.type);
        return;
    }
    if (e.target.closest("#pos-checkout-btn")) {
        checkout();
        return;
    }
    if (e.target.closest("#pos-hold-btn")) {
        holdCurrentCart();
        return;
    }
    if (e.target.closest("#pos-cancel-btn")) {
        cancelCurrentCart();
        return;
    }
    if (e.target.closest("#pos-held-badge")) {
        openHeldModal();
        return;
    }
}

// ── Data ──

/**
 * Pastikan access token valid (decode klaim `exp` lokal). Bila kedaluwarsa,
 * refresh via httpOnly cookie (server) — pola sama dengan boot main.js.
 * @returns {Promise<string|null>} Token segar atau null bila gagal
 */
async function ensureFreshAccessToken() {
    try {
        const { getAccessToken, refreshAccessToken } = await import("../../data/api.js");
        const token = getAccessToken();
        if (!token) return null;
        if (isJwtExpiredLocal(token)) {
            return await refreshAccessToken();
        }
        return token;
    } catch {
        return null;
    }
}

/** Decode klaim exp JWT lokal (tanpa network). */
function isJwtExpiredLocal(token) {
    try {
        const parts = String(token || "").split(".");
        if (parts.length !== 3) return true;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(globalThis.atob(padded));
        if (!payload || !payload.exp) return true;
        return Number(payload.exp) * 1000 <= Date.now();
    } catch {
        return true;
    }
}

async function loadKasirData() {
    // M6-FIX — refresh PREVENTIF: akses token mungkin sudah kedaluwarsa dari
    // sesi lama (browser dibiarkan terbuka semalaman). Refresh duluan (cookie
    // httpOnly, tanpa 401) agar kasir-data TIDAK memunculkan 401 di console
    // (authorizedFetch akan 401 sekali lalu retry — hindari kebisingan itu).
    await ensureFreshAccessToken();
    let produk = null;
    let kategori = null;
    let kategoriIcons = {};
    let shiftFromApi = null;
    let taxEnabled = null;
    try {
        const res = await apiCall("GET", "/pos/kasir-data");
        if (res && Array.isArray(res.produk)) {
            produk = res.produk;
            kategori = res.kategori || [];
            kategoriIcons = res.kategoriIcons || {};
            shiftFromApi = res.shiftAktif || null;
            // Pajak diatur Admin (Settings) — kasir hanya mengikuti
            if (typeof res.taxEnabled === "boolean") taxEnabled = res.taxEnabled;
            // M3-FIX v21 — gudang terhubung kasir (dari Settings Admin)
            if (res.gudang && res.gudang.kodeGudang) {
                state.gudang = { kodeGudang: res.gudang.kodeGudang, namaGudang: res.gudang.namaGudang || res.gudang.kodeGudang };
            }
        }
    } catch (err) {
        console.warn("[Kasir] kasir-data API error, fallback listBarang:", err?.message);
    }
    if (!produk) {
        const result = await listBarang({ page: 1, limit: 999 });
        // M6.2-FIX v0.40 — fallback offline ikut menyaring barang "Tidak
        // Dijual" (dijual:false) agar konsisten dengan server kasir-data.
        // Produk ber-SKU tetap tampil walau harga_jual global 0 (harga per SKU).
        const all = (result.data || []).filter(b => b.active !== false && b.dijual !== false && ((Number(b.harga_jual) || 0) > 0 || (Array.isArray(b.skus) && b.skus.length)));
        produk = all.map(b => ({
            id: String(b.id || b._id || ""),
            kode: b.kode,
            nama: b.nama,
            kategori: b.kategori || "",
            satuan: b.satuan || "",
            harga: Number(b.harga_jual) || 0,
            harga_jual: Number(b.harga_jual) || 0,
            harga_khusus: Number(b.harga_khusus) || 0,
            stok: Number(b.stok) || 0,
            behavior: b.behavior || "trading",
            foto: b.foto || "",
            // M6.2-FIX — fallback offline menyertakan SKU varian marketplace
            // (harga utk umum + harga_khusus utk member) agar pilih varian &
            // reprice member tetap berfungsi saat API down.
            skus: Array.isArray(b.skus) && b.skus.length
                ? b.skus.map(s => ({
                    kode: s.kode || "",
                    label: s.label || "",
                    foto: s.foto || "",
                    harga: Number(s.harga) || 0,
                    harga_khusus: Number(s.harga_khusus) || 0,
                    stok: Number(s.stok) || 0
                }))
                : [],
            varianDef: Array.isArray(b.varianDef) ? b.varianDef : []
        }));
        // Kategori sidebar kasir = Master Kategori (SSOT, sama dengan server):
        // fallback offline tetap mengambil dari listKategori (bukan menurunkan
        // dari Barang.kategori) agar perilaku konsisten — M6-FIX.
        try {
            const katRes = await listKategori({ page: 1, limit: 999 });
            kategori = (katRes.data || [])
                .filter(k => k.active !== false)
                .map(k => String(k.nama || "").trim())
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            for (const k of katRes.data || []) {
                if (k.nama && k.icon) kategoriIcons[k.nama] = k.icon;
            }
        } catch { /* ignore — sidebar kosong */ }
        if (!kategori.length) {
            kategori = [...new Set(all.map(b => (b.kategori || "").trim()).filter(Boolean))];
        }
    }
    state.produk = produk;
    state.kategori = kategori;
    state.kategoriIcons = kategoriIcons;
    // PRD V1 §12 — shift aktif dari kasir-data (indikator widget bill)
    state.shiftAktif = shiftFromApi;
    if (taxEnabled !== null) state.taxEnabled = taxEnabled;
    if (kategori.length && !kategori.includes(state.activeKategori)) {
        state.activeKategori = "Semua";
    }
}

// ── Render ──

function renderKasir() {
    renderKategori();
    renderProduk();
    renderBill();
}

function renderKategori() {
    const el = document.getElementById("pos-kategori");
    if (!el) return;
    const list = ["Semua", ...state.kategori];
    // data-title dipakai tooltip saat panel Kategori disembunyikan (pola sidebar admin)
    // Icon diambil dari Master Kategori (kategoriIcons); fallback 🏷️.
    el.innerHTML = list.map(k => `
        <button class="pos-kat-btn ${state.activeKategori === k ? "active" : ""}" data-kategori="${esc(k)}" data-title="${esc(k)}">
            <span class="pos-kat-icon">${k === "Semua" ? "🗂️" : (state.kategoriIcons[k] || "🏷️")}</span>
            <span class="pos-kat-name">${esc(k)}</span>
        </button>
    `).join("");
    const titleEl = document.getElementById("pos-kategori-title");
    if (titleEl) titleEl.textContent = state.activeKategori;
}

function getFilteredProduk() {
    const search = state.searchQuery;
    let list = state.activeKategori === "Semua"
        ? state.produk.slice()
        : state.produk.filter(p => p.kategori === state.activeKategori);
    if (search) {
        // PRD V1 §7.1 — search nama / SKU (kode) / barcode
        list = list.filter(p =>
            (p.nama || "").toLowerCase().includes(search) ||
            (p.kode || "").toLowerCase().includes(search) ||
            (p.barcode || "").toLowerCase().includes(search)
        );
    }
    return list;
}

/**
 * Tambahkan produk ke keranjang berdasarkan barcode (scan / ketik manual).
 * Kode barang berfungsi sebagai barcode (barcode diisi di kolom Kode) —
 * tetap mencocokkan field barcode lama bila masih terisi (data legacy).
 * @param {string} barcode
 * @returns {boolean} true bila produk berhasil ditambahkan, false bila tidak
 */
function addByBarcode(barcode) {
    const q = String(barcode || "").trim().toLowerCase();
    if (!q) return false;
    const p = state.produk.find(x =>
        String(x.kode || "").toLowerCase() === q ||
        (x.barcode && String(x.barcode).toLowerCase() === q)
    );
    if (!p) {
        showToast("warning", `Barcode "${esc(barcode)}" tidak ditemukan`);
        return false;
    }
    if ((Number(p.stok) || 0) <= 0 && p.behavior !== "service" && p.behavior !== "recipe" && p.behavior !== "recipe-fnb") {
        showToast("warning", `${p.nama} stok habis`);
        return false;
    }
    // M6.2-FIX v0.42/0.43 — scan produk ber-varian (recipe F&B / SKU) →
    // buka modal pilih varian/kombinasi
    if ((Array.isArray(p.varian) && p.varian.length) || (Array.isArray(p.skus) && p.skus.length)) {
        openVarianModal(String(p.id || p.kode));
    } else {
        addToCart(String(p.id || p.kode));
    }
    return true;
}

function renderProduk() {
    const grid = document.getElementById("pos-produk-grid");
    const pager = document.getElementById("pos-produk-pager");
    if (!grid) return;

    let filtered = getFilteredProduk();
    const pageSize = state.pageSize;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(state.page, totalPages);
    state.page = page;
    const start = (page - 1) * pageSize;
    filtered = filtered.slice(start, start + pageSize);

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="pos-empty">Tidak ada produk ditemukan</div>`;
    } else {
        grid.innerHTML = filtered.map(p => renderProdukCard(p)).join("");
    }

    if (pager) {
        if (totalPages <= 1) {
            pager.innerHTML = "";
        } else {
            const pages = [];
            const from = Math.max(1, page - 2);
            const to = Math.min(totalPages, page + 2);
            if (page > 1) pages.push(`<button class="pos-page-btn" data-page="${page - 1}">‹ Prev</button>`);
            for (let i = from; i <= to; i++) {
                pages.push(`<button class="pos-page-btn ${i === page ? "active" : ""}" data-page="${i}">${i}</button>`);
            }
            if (page < totalPages) pages.push(`<button class="pos-page-btn" data-page="${page + 1}">Next ›</button>`);
            pager.innerHTML = pages.join("");
        }
    }
}

const TILE_PALETTES = [
    ["#3b4e9f", "#667eea"],
    ["#1e40af", "#3b82f6"],
    ["#7c3aed", "#a78bfa"],
    ["#b45309", "#f59e0b"],
    ["#be123c", "#fb7185"],
    ["#0f766e", "#14b8a6"]
];

function tileStyle(p) {
    const seed = ((p.kategori || "").length * 7 + (p.kode || "").charCodeAt(0) || 0) % TILE_PALETTES.length;
    const [a, b] = TILE_PALETTES[seed];
    return `background:linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function renderProdukCard(p) {
    // PRD V1 — non-trading (jasa/resep/manufaktur/digital) tidak memakai stok
    const noStock = ["service", "recipe", "recipe-fnb", "manufactured", "digital"].includes(p.behavior);
    const isService = p.behavior === "service";
    const isRecipe = p.behavior === "recipe";
    const isRecipeFnb = p.behavior === "recipe-fnb";
    // M6.2-FIX v0.42 — VARIAN recipe F&B: produk punya beberapa recipe aktif
    // (mis. Kopi Susu Manis → Pake Gula / Tanpa Gula).
    // M6.2-FIX v0.43 — SKU varian marketplace (trading & resep simple):
    // produk punya beberapa KOMBINASI (mis. Ukuran: S/M, Warna: Merah/Biru),
    // tiap kombinasi = SKU dengan harga & stok sendiri.
    // Keduanya: kartu tetap 1 produk; harga tampil "mulai" (termurah);
    // klik → modal pilih varian/kombinasi.
    const variants = Array.isArray(p.varian) && p.varian.length ? p.varian : [];
    const skus = Array.isArray(p.skus) && p.skus.length ? p.skus : [];
    const hasVarian = variants.length > 0 || skus.length > 0;
    const varianTerendah = hasVarian
        ? Math.min(
            ...variants.map(v => Number(v.harga) || 0),
            // M6.2-FIX — member melihat harga khusus (harga_khusus) per SKU
            ...skus.map(s => skuPrice(s) || Number(s.harga) || 0)
        )
        : 0;
    const displayHarga = hasVarian
        ? (varianTerendah > 0 ? varianTerendah : effectivePrice(p))
        : effectivePrice(p);
    // SKU: produk habis bila SEMUA kombinasi stok 0
    const habis = skus.length
        ? !skus.some(s => (Number(s.stok) || 0) > 0)
        : (!noStock && (Number(p.stok) || 0) <= 0);
    const jumlahVarian = skus.length || variants.length;
    const imgHTML = p.foto
        ? `<img class="pos-prod-img" src="${esc(p.foto)}" alt="${esc(p.nama)}" loading="lazy" onerror="this.style.display='none'" />`
        : `<div class="pos-prod-tile" style="${tileStyle(p)}"><span>${esc((p.nama || "?").charAt(0).toUpperCase())}</span></div>`;
    return `
        <div class="pos-prod-card ${habis ? "disabled" : ""}" data-key="${esc(p.id || p.kode)}" data-disabled="${habis ? "1" : "0"}" ${hasVarian ? `data-varian="${jumlahVarian}"` : ""}>
            <div class="pos-prod-media">${imgHTML}</div>
            <div class="pos-prod-info">
                <div class="pos-prod-name">${esc(p.nama)}</div>
                <div class="pos-prod-meta">
                    ${p.kode ? `<span class="pos-badge pos-badge-kat">${esc(p.kode)}</span>` : ""}
                    ${isService ? `<span class="pos-badge pos-badge-jasa">Jasa</span>` : ""}
                    ${isRecipe ? `<span class="pos-badge pos-badge-recipe">Resep</span>` : ""}
                    ${isRecipeFnb ? `<span class="pos-badge pos-badge-recipe-fnb">Resep F&B</span>` : ""}
                    ${hasVarian ? `<span class="pos-badge pos-badge-varian">${jumlahVarian} Varian</span>` : ""}
                </div>
                <div class="pos-prod-price">${hasVarian ? "mulai " : ""}Rp ${formatRupiah(displayHarga)}</div>
            </div>
            ${habis ? `<div class="pos-prod-habis">Habis</div>` : ""}
            ${!habis ? `<div class="pos-prod-add">${hasVarian ? "∨" : "+"}</div>` : ""}
        </div>
    `;
}

function renderBill() {
    const cartEl = document.getElementById("pos-keranjang");
    if (!cartEl) return;

    const itemCount = state.keranjang.reduce((s, i) => s + (i.qty || 0), 0);
    // HP — badge jumlah item di ikon keranjang header (bill overlay). Cap
    // "99+" utk >99 (pola lonceng), namun SELALU TAMPIL — termasuk saat 0
    // (jangan disembunyikan: penomoran tidak boleh menghilang).
    const cartCountEl = document.getElementById("pos-cart-count");
    if (cartCountEl) {
        cartCountEl.textContent = itemCount > 99 ? "99+" : String(itemCount);
        cartCountEl.style.display = "";
    }
    const subtotal = state.keranjang.reduce((s, i) => s + (i.harga * i.qty), 0);
    // Diskon transaksi (keputusan PO: diskon tidak mengurangi basis pajak di V1)
    const diskonTransaksi = Math.min(state.diskonTransaksi || 0, subtotal);
    const taxRate = state.taxEnabled ? TAX_RATE : 0;
    const pajak = Math.round((subtotal - diskonTransaksi) * taxRate);
    const total = subtotal - diskonTransaksi + pajak;
    const bayarRaw = String(document.getElementById("pos-bayar")?.value || "").replace(/\D/g, "");
    const bayar = bayarRaw ? Number(bayarRaw) : 0;
    const kembalian = Math.max(0, bayar - total);

    if (state.keranjang.length === 0) {
        cartEl.innerHTML = `<p class="pos-cart-empty">Belum ada item. Klik produk untuk menambahkan.</p>`;
    } else {
        cartEl.innerHTML = state.keranjang.map(i => `
            <div class="pos-cart-item">
                <div class="pos-cart-left">
                    <div class="pos-cart-name">${esc(i.nama)}${i.behavior === "service" ? ' <span class="pos-badge pos-badge-jasa">Jasa</span>' : ""}${i.behavior === "recipe" ? ' <span class="pos-badge pos-badge-recipe">Resep</span>' : ""}${i.behavior === "recipe-fnb" ? ' <span class="pos-badge pos-badge-recipe-fnb">Resep F&B</span>' : ""}</div>
                    <div class="pos-cart-qty">
                        <button class="pos-qty-btn" data-minus="${esc(i.key)}">−</button>
                        <span class="pos-qty-val">${i.qty}</span>
                        <button class="pos-qty-btn" data-plus="${esc(i.key)}">+</button>
                        <span class="pos-cart-sub">@ ${formatRupiah(i.harga)}</span>
                    </div>
                </div>
                <div class="pos-cart-right">
                    <div class="pos-cart-price">${formatRupiah(i.harga * i.qty)}</div>
                    <button class="pos-cart-remove" data-remove="${esc(i.key)}" title="Hapus">🗑</button>
                </div>
            </div>
        `).join("");
    }

    document.getElementById("pos-subtotal-label").textContent = `Sub Total (${itemCount} item)`;
    document.getElementById("pos-subtotal").textContent = `Rp ${formatRupiah(subtotal)}`;
    document.getElementById("pos-pajak").textContent = `Rp ${formatRupiah(pajak)}`;
    document.getElementById("pos-total").textContent = `Rp ${formatRupiah(total)}`;
    document.getElementById("pos-kembalian").textContent = `Rp ${formatRupiah(kembalian)}`;

    // Metode bayar & diskon — sinkron state → UI (dan sebaliknya)
    const metodeEl = document.getElementById("pos-metode");
    if (metodeEl && metodeEl.value !== state.metodeBayar) metodeEl.value = state.metodeBayar;
    const diskonEl = document.getElementById("pos-diskon");
    if (diskonEl && String(diskonEl.value || "").replace(/\D/g, "") !== String(state.diskonTransaksi || 0)) {
        diskonEl.value = state.diskonTransaksi ? Number(state.diskonTransaksi).toLocaleString("id-ID") : "";
    }

    const taxStatus = document.getElementById("pos-tax-status");
    if (taxStatus) {
        taxStatus.textContent = state.taxEnabled ? "Aktif" : "Nonaktif";
        taxStatus.classList.toggle("off", !state.taxEnabled);
    }

    // M3-FIX v21 — gudang terhubung kasir (chip di bill)
    const gudangRow = document.getElementById("pos-gudang-row");
    const gudangEl = document.getElementById("pos-gudang");
    if (gudangRow && gudangEl) {
        if (state.gudang && state.gudang.namaGudang) {
            gudangRow.style.display = "";
            gudangEl.textContent = state.gudang.namaGudang;
        } else {
            gudangRow.style.display = "none";
        }
    }
    document.querySelectorAll(".pos-type-btn").forEach(btn => {
        const isActive = btn.dataset.type === state.tipePelanggan;
        btn.classList.toggle("active", isActive);
        if (btn.dataset.type === "member") {
            btn.textContent = isActive && state.member ? `🎫 ${state.member.nama}` : "🎫 Member";
        }
    });

    const btn = document.getElementById("pos-checkout-btn");
    if (btn) {
        const valid = state.keranjang.length > 0 && bayar >= total;
        btn.disabled = !valid;
        btn.classList.toggle("ready", valid);
        btn.innerHTML = valid ? "💵 Checkout &amp; Cetak Struk" : (state.keranjang.length === 0 ? "Keranjang kosong" : "Bayar kurang dari total");
    }

    // Hold button state ikut keranjang
    renderHoldActions();
}

// ── Cart Actions ──

/**
 * Harga efektif per jenis pelanggan (M3-FIX v19, PRD V1 §7.4):
 * harga khusus (harga_khusus) HANYA berlaku untuk member; pelanggan
 * umum memakai harga normal (harga_jual).
 */
function effectivePrice(p) {
    if (state.tipePelanggan === "member" && Number(p?.harga_khusus) > 0) {
        return Number(p.harga_khusus);
    }
    return Number(p?.harga_jual || p?.harga) || 0;
}

/**
 * Harga efektif SKU varian marketplace (M6.2-FIX — harga khusus utk member):
 * `harga` = pelanggan umum; `harga_khusus` = member/pelanggan terdaftar
 * (dipakai bila > 0). `isMember` opsional utk unit test (default: tipe
 * pelanggan aktif).
 * @param {{harga?:*, harga_khusus?:*}} sku SKU varian dari katalog kasir
 * @param {boolean} [isMember] apakah tipe pelanggan saat ini "member"
 * @returns {number}
 */
export function skuPrice(sku, isMember = state.tipePelanggan === "member") {
    if (isMember && Number(sku?.harga_khusus) > 0) {
        return Number(sku.harga_khusus);
    }
    return Number(sku?.harga) || 0;
}

/**
 * Ganti jenis pelanggan (M3-FIX v20):
 * - "member" → WAJIB verifikasi kartu member / kode (modal scan/input),
 *   harga khusus hanya berlaku setelah member terverifikasi.
 * - "umum"   → langsung, harga normal.
 */
function setTipePelanggan(tipe) {
    const next = tipe === "member" ? "member" : "umum";
    // Member sudah terverifikasi → TIDAK boleh langsung ganti member lain;
    // wajib Batal transaksi dulu (kasir harus sadar member masih aktif).
    if (next === "member" && state.member) {
        showToast("warning", `Member ${state.member.nama} sudah terverifikasi — batalkan transaksi dulu untuk mengganti member`);
        return;
    }
    // Member selalu buka modal verifikasi (termasuk saat sudah member → ganti member)
    if (next === "member") {
        openMemberModal();
        return;
    }
    if (state.tipePelanggan === next) return;
    state.tipePelanggan = "umum";
    state.member = null;
    repriceCart();
    renderKasir();
    showToast("info", "👤 Pelanggan Umum — harga normal");
}

/** Re-price semua item keranjang sesuai jenis pelanggan aktif. */
function repriceCart() {
    state.keranjang.forEach(item => {
        // M6.2-FIX — item VARIAN resep F&B punya harga sendiri (tidak ditimpa).
        // Item SKU varian marketplace IKUT di-reprice: member → harga_khusus
        // per SKU (bila > 0), umum → harga per SKU.
        if (item.recipeId) return;
        const p = state.produk.find(x => (x.kode || "") === (item.kode || ""));
        if (!p) return;
        if (item.skuKode) {
            const sku = (Array.isArray(p.skus) ? p.skus : []).find(s => String(s.kode || "") === String(item.skuKode));
            if (sku) { item.harga = skuPrice(sku) || effectivePrice(p); return; }
        }
        item.harga = effectivePrice(p);
    });
}

let memberScannerHandle = null;

/**
 * Modal verifikasi member — scan kartu member (kamera) atau input kode.
 * Sukses → tipePelanggan "member" + state.member terisi (harga khusus aktif).
 */
function openMemberModal() {
    const content = `
        <p class="pos-modal-hint">Pilih salah satu cara untuk verifikasi member (harga khusus).</p>
        <!-- 1) Scan kartu (kamera) -->
        <div class="pos-member-method">
            <div class="pos-member-method-title">📷 Scan Kartu (Kamera)</div>
            <div class="pos-member-scan-row">
                ${scanButtonHTML('data-scan-member="1" title="Scan kartu member"')}
            </div>
            <div id="pos-member-scan-wrap">${scannerSectionHTML("pos-member-cam", "pos-member-switch", "pos-member-flash")}</div>
        </div>
        <!-- 2) Tap kartu (reader NFC USB — pola sama dengan Master Member admin:
             fokus otomatis ke input, reader mengetik No. Kartu + Enter) -->
        <div class="pos-member-method">
            <div class="pos-member-method-title">📱 Tap Kartu (Reader NFC)</div>
            <input class="smart-input" id="f-member-nfc" type="text" placeholder="Tap kartu di reader NFC…" autocomplete="off" />
            <div id="f-member-nfc-status" class="pos-member-nfc-status"></div>
        </div>
        <!-- 3) Pilih dari daftar member — pola "akun biaya" (1 input + datalist):
             ketik kode / nama / No. Kartu → saran tampil langsung; pilih salah
             satu → verifikasi otomatis (Enter juga berfungsi). -->
        <div class="pos-member-method">
            <div class="pos-member-method-title">👥 Pilih dari Daftar Member</div>
            <input class="smart-input" id="f-member-pick" list="f-member-list" type="text" placeholder="Ketik kode / nama / No. Kartu member…" autocomplete="off" />
            <datalist id="f-member-list"></datalist>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="f-member-cancel">Batal</button>
        <button class="smart-btn smart-btn-primary" id="f-member-ok">Verifikasi</button>
    `;
    const overlay = Modal({
        open: true,
        title: "🎫 Verifikasi Member",
        content,
        footer,
        closable: true,
        onClose: () => closeMemberOverlay(overlay)
    });
    document.body.appendChild(overlay);
    const nfcInput = overlay.querySelector("#f-member-nfc");
    const memberPick = overlay.querySelector("#f-member-pick");
    const memberList = overlay.querySelector("#f-member-list");

    // 1) Scanner kartu member — selektor khusus [data-scan-member].
    //    scanIndexAttr=data-scan-member → tombol scan bisa diklik.
    try { memberScannerHandle?.destroy?.(); } catch { /* ignore */ }
    memberScannerHandle = attachScanner({
        containerId: "pos-member-cam",
        switchBtnId: "pos-member-switch",
        flashId: "pos-member-flash",
        scanBtnSel: "[data-scan-member]",
        scanIndexAttr: "data-scan-member",
        onScanDecoded: (_idx, code) => {
            const kode = String(code || "").trim();
            if (kode) doVerifyMemberByKode(kode, overlay);
        }
    });

    // 2) Tap kartu (reader NFC USB — pola sama dgn Master Member admin):
    // input auto-focus; reader mengetik No. Kartu (kodeNfc) lalu Enter →
    // verifikasi otomatis. Status live ditampilkan saat kode mulai terbaca.
    if (nfcInput) {
        nfcInput.addEventListener("input", () => {
            const statusEl = overlay.querySelector("#f-member-nfc-status");
            if (!statusEl) return;
            const v = String(nfcInput.value || "").trim();
            if (v) {
                statusEl.textContent = `✓ No. Kartu terbaca: ${v} — tekan Enter untuk verifikasi`;
                statusEl.classList.add("ok");
            } else {
                statusEl.textContent = "";
                statusEl.classList.remove("ok");
            }
        });
        nfcInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const kode = String(nfcInput.value || "").trim();
                if (kode) doVerifyMemberByKode(kode, overlay, nfcInput);
            }
        });
    }

    // 3) Daftar member — 1 field isian fleksibel (pola akun biaya): input +
    // datalist. Hasil pencarian langsung tampil sebagai saran; pilih salah
    // satu → verifikasi otomatis. Enter juga memverifikasi nilai yang cocok.
    if (memberPick) {
        memberPick.addEventListener("input", () => {
            renderMemberOptions(memberList, String(memberPick.value || "").trim());
        });
        memberPick.addEventListener("change", () => {
            const hit = findMemberFromPick(String(memberPick.value || "").trim());
            if (hit) doVerifyMemberByKode(hit.kode, overlay, memberPick);
        });
        memberPick.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const hit = findMemberFromPick(String(memberPick.value || "").trim());
                if (hit) doVerifyMemberByKode(hit.kode, overlay, memberPick);
                else showToast("warning", "Member tidak ditemukan — pilih dari saran yang muncul");
            }
        });
    }
    loadMemberOptions(memberPick, memberList);

    // Bonus (Chrome Android): bila browser mendukung Web NFC, mulai scan
    // otomatis — tap kartu ke HP juga bisa. Browser lain → reader NFC USB
    // (keyboard-wedge) yang mengetik No. Kartu ke input di atas.
    startNfcMemberScan(overlay);

    // Footer: Verifikasi memakai kode dari reader NFC (atau member dari datalist).
    overlay.querySelector("#f-member-ok")?.addEventListener("click", () => {
        const nfcKode = String(nfcInput?.value || "").trim();
        const hit = findMemberFromPick(String(memberPick?.value || "").trim());
        if (nfcKode) doVerifyMemberByKode(nfcKode, overlay, nfcInput);
        else if (hit) doVerifyMemberByKode(hit.kode, overlay, memberPick);
        else showToast("warning", "Tap kartu, scan, atau pilih member terlebih dahulu");
    });
    overlay.querySelector("#f-member-cancel")?.addEventListener("click", () => closeMemberOverlay(overlay));
    setTimeout(() => nfcInput?.focus(), 100);
}

function closeMemberOverlay(overlay) {
    stopNfcMemberScan();
    try { memberScannerHandle?.destroy?.(); } catch { /* ignore */ }
    memberScannerHandle = null;
    overlay?.remove?.();
}

/**
 * Muat daftar member (Customer aktif, non-archived) ke dropdown verifikasi.
 * Gagal/offline → dropdown kosong + hint (metode lain tetap tersedia).
 */
// Cache daftar member (Customer aktif) untuk pencarian dropdown verifikasi.
let _memberCache = [];
let _memberLoading = false;
let _memberLoadFailed = false;
// Guard verifikasi ganda (mis. change saat blur input + klik tombol Verifikasi).
let _memberVerifying = false;

async function loadMemberOptions(pickEl, listEl) {
    if (!pickEl || !listEl) return;
    _memberLoading = true;
    _memberLoadFailed = false;
    renderMemberOptions(listEl, "");
    try {
        const res = await listCustomer({ page: 1, limit: 999 });
        _memberCache = (res?.data || []).filter(m => m.active !== false && String(m.status || "") !== "archived");
    } catch {
        _memberCache = [];
        _memberLoadFailed = true;
    } finally {
        _memberLoading = false;
    }
    // Re-render dengan query yang sedang diketik user (bukan reset ke kosong)
    renderMemberOptions(listEl, String(pickEl.value || "").trim());
}

/**
 * Render saran <datalist> member dengan filter pencarian (kode / nama / No.
 * Kartu) — pola "akun biaya": 1 input + datalist, hasil langsung tampil.
 * @param {HTMLElement} listEl <datalist>
 * @param {string} query
 */
function renderMemberOptions(listEl, query) {
    if (!listEl) return;
    if (_memberLoading) {
        listEl.innerHTML = `<option value="">Memuat member…</option>`;
        return;
    }
    if (_memberLoadFailed) {
        listEl.innerHTML = `<option value="">Gagal memuat member — coba metode lain</option>`;
        return;
    }
    if (!_memberCache.length) {
        listEl.innerHTML = `<option value="">Belum ada member</option>`;
        return;
    }
    const q = String(query || "").trim().toLowerCase();
    const filtered = _memberCache.filter(m =>
        !q
        || String(m.kode || "").toLowerCase().includes(q)
        || String(m.nama || "").toLowerCase().includes(q)
        || String(m.kodeNfc || "").toLowerCase().includes(q)
    );
    listEl.innerHTML = filtered.map(m =>
        `<option value="${esc(m.kode)}">${esc(m.kode)} — ${esc(m.nama)}</option>`
    ).join("");
}

/**
 * Cari member dari nilai input datalist — cocok persis kode / No. Kartu / nama.
 * @param {string} value
 * @returns {object|null} member atau null
 */
function findMemberFromPick(value) {
    const v = String(value || "").trim().toLowerCase();
    if (!v) return null;
    return _memberCache.find(m =>
        String(m.kode || "").toLowerCase() === v
        || String(m.kodeNfc || "").toLowerCase() === v
        || String(m.nama || "").toLowerCase() === v
    ) || null;
}

// ── Tap Kartu — Web NFC API (Chrome Android) + fallback keyboard-wedge ──
// Input #f-member-nfc menangani reader NFC USB (pola admin: reader mengetik
// No. Kartu + Enter). Bila browser punya Web NFC, startNfcMemberScan membaca
// kartu langsung dari HP (bonus di Chrome Android).
let _nfcReader = null;

function stopNfcMemberScan() {
    try { _nfcReader?.stop?.(); } catch { /* ignore */ }
    _nfcReader = null;
}

/**
 * Mulai scan NFC via Web NFC API (hanya Chrome Android). Browser lain
 * memakai reader NFC USB (keyboard-wedge) lewat input #f-member-nfc.
 */
async function startNfcMemberScan(overlay) {
    if (typeof window === "undefined" || !("NDEFReader" in window)) return;
    const statusEl = overlay?.querySelector("#f-member-nfc-status");
    const setStatus = (msg, ok = false) => {
        if (statusEl) {
            statusEl.textContent = msg;
            statusEl.classList.toggle("ok", ok);
        }
    };
    try {
        stopNfcMemberScan();
        const reader = new window.NDEFReader();
        await reader.scan();
        _nfcReader = reader;
        setStatus("Menunggu kartu… dekatkan kartu member ke perangkat.", true);
        reader.onreadingerror = () => setStatus("Gagal membaca kartu — coba lagi atau gunakan metode lain.");
        reader.onreading = (event) => {
            const kode = parseNfcPayload(event?.message);
            if (!kode) {
                setStatus("Kartu tidak berisi kode member — coba lagi.");
                return;
            }
            setStatus(`✓ No. Kartu terbaca: ${kode}`, true);
            doVerifyMemberByKode(kode, overlay);
        };
    } catch {
        setStatus("Izin NFC dibutuhkan — izinkan akses lalu coba lagi.");
    }
}

/** Ekstrak teks kode dari pesan NDEF (record pertama yang berisi teks). */
function parseNfcPayload(message) {
    try {
        for (const record of (message?.records || [])) {
            let text = "";
            const data = record?.data;
            if (typeof data === "string") text = data;
            else if (data && typeof data.text === "string") text = data.text;
            else if (data instanceof ArrayBuffer) text = new globalThis.TextDecoder().decode(data);
            else if (data && typeof data.buffer !== "undefined") text = new globalThis.TextDecoder().decode(data.buffer);
            text = String(text || "").trim();
            if (text) return text;
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Verifikasi member dari kode yang sudah pasti (dropdown / NFC).
 * @param {string} kode
 * @param {object} overlay
 * @param {HTMLElement|null} [focusEl] elemen yang di-select ulang saat gagal
 */
async function doVerifyMemberByKode(kode, overlay, focusEl = null) {
    const key = String(kode || "").trim();
    if (!key) {
        showToast("warning", "Pilih member atau masukkan kode member");
        return;
    }
    // Cegah verifikasi ganda (mis. change saat input blur + klik tombol Verifikasi)
    if (_memberVerifying) return;
    _memberVerifying = true;
    const btn = overlay?.querySelector("#f-member-ok");
    if (btn) btn.disabled = true;
    try {
        const m = await getMemberByKode(key);
        if (!m) {
            showToast("danger", `Kode member "${key}" tidak ditemukan di Master Member`);
            if (btn) btn.disabled = false;
            if (focusEl) focusEl?.select?.();
            return;
        }
        state.member = { kode: m.kode, nama: m.nama };
        state.tipePelanggan = "member";
        repriceCart();
        closeMemberOverlay(overlay);
        renderKasir();
        showToast("success", `🎫 Member: ${m.nama} — harga khusus berlaku`);
    } catch (err) {
        showToast("danger", err.message || "Gagal verifikasi member");
        if (btn) btn.disabled = false;
    } finally {
        _memberVerifying = false;
    }
}

function addToCart(key, varian = null, sku = null) {
    const p = state.produk.find(x => (x.id || x.kode) === key);
    if (!p) return;
    // M6.2-FIX v0.42 — VARIAN: key unik per varian (produk::recipeId) sehingga
    // varian berbeda bisa ada bersamaan di keranjang; nama = "Produk (Varian)".
    // M6.2-FIX v0.43 — SKU: key unik per kombinasi (produk::sku::<kode>);
    // nama = "Produk (label SKU)"; harga & stok per kombinasi.
    const itemKey = sku
        ? `${key}::sku::${sku.kode}`
        : (varian ? `${key}::${varian.recipeId}` : key);
    const existing = state.keranjang.find(i => i.key === itemKey);
    if (existing) {
        existing.qty++;
    } else {
        // id dipakai server untuk pengurangan stok deterministik (dokumen yang diklik)
        state.keranjang.push({
            key: itemKey,
            id: p.id || null,
            kode: p.kode,
            nama: sku
                ? `${p.nama} (${sku.label})`
                : (varian ? `${p.nama} (${varian.nama})` : p.nama),
            satuan: p.satuan || "",
            harga: sku
                // M6.2-FIX — SKU: member → harga_khusus per SKU, umum → harga
                ? (skuPrice(sku) || effectivePrice(p))
                : (varian ? (Number(varian.harga) || effectivePrice(p)) : effectivePrice(p)),
            behavior: p.behavior || "trading",
            // recipeId varian — server konsumsi bahan memakai ingredient varian ini
            recipeId: varian ? varian.recipeId : "",
            // skuKode/skuLabel — server decrement/reversal stok kombinasi spesifik
            skuKode: sku ? sku.kode : "",
            skuLabel: sku ? sku.label : "",
            qty: 1
        });
    }
    renderBill();
}

/**
 * Modal pilih VARIAN (M6.2-FIX v0.42): produk ber-varian (beberapa recipe
 * aktif) menampilkan 1 kartu; saat diorder kasir memilih varian yang punya
 * ingredient & harga sendiri.
 * @param {string} key Produk key (id atau kode)
 */
function openVarianModal(key) {
    const p = state.produk.find(x => (x.id || x.kode) === key);
    if (!p) return;
    const skus = (Array.isArray(p.skus) && p.skus.length) ? p.skus : [];
    const variants = (Array.isArray(p.varian) && p.varian.length) ? p.varian : [];
    if (!skus.length && !variants.length) { addToCart(key); return; }

    // ── M6.2-FIX v0.43 — SKU varian marketplace: daftar tombol per KOMBINASI
    // (label + harga) — tampilan SAMA dengan varian resep F&B (v0.42); klik
    // langsung tambah ke keranjang. Kombinasi stok 0 dinonaktifkan ("Habis").
    if (skus.length) {
        const rows = skus.map((sku, idx) => {
            const stok = Number(sku.stok) || 0;
            const habis = stok <= 0;
            return `
                <button type="button" class="pos-varian-row" data-sku-pick="${idx}" ${habis ? "disabled" : ""} style="display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--smart-border,#e2e8f0);border-radius:10px;background:#fff;cursor:pointer;margin-bottom:8px;text-align:left;${habis ? "opacity:0.55;cursor:not-allowed;" : ""}">
                    <span style="display:flex;align-items:center;gap:8px;min-width:0">
                        ${sku.foto ? `<img src="${esc(sku.foto)}" alt="" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0" />` : ""}
                        <span style="font-size:0.95rem;font-weight:600;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sku.label || "Varian")}</span>
                    </span>
                    <span style="font-size:0.95rem;font-weight:700;color:#667eea;white-space:nowrap">Rp ${formatRupiah(skuPrice(sku) || Number(sku.harga) || 0)}${habis ? ' <span style="font-size:0.72rem;color:#dc2626;font-weight:600">· Habis</span>' : ""}</span>
                </button>
            `;
        }).join("");
        const content = `
            <p class="cn-muted" style="margin-top:0">Pilih varian <strong>${esc(p.nama)}</strong>:</p>
            <div>${rows}</div>
        `;
        const footer = `<button class="smart-btn smart-btn-secondary" id="pos-varian-close">Batal</button>`;
        const overlay = Modal({ open: true, title: "Pilih Varian", content, footer, closable: true, onClose: () => overlay?.remove?.() });
        document.body.appendChild(overlay);
        overlay.querySelector("#pos-varian-close")?.addEventListener("click", () => overlay.remove());
        overlay.querySelectorAll("[data-sku-pick]").forEach(btn => {
            btn.addEventListener("click", () => {
                const sku = skus[Number(btn.dataset.skuPick)];
                overlay.remove();
                if (sku) addToCart(key, null, sku);
            });
        });
        return;
    }

    // ── VARIAN recipe F&B (existing) ──
    const rows = variants.map((v, idx) => `
        <button type="button" class="pos-varian-row" data-varian-pick="${idx}" style="display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--smart-border,#e2e8f0);border-radius:10px;background:#fff;cursor:pointer;margin-bottom:8px;text-align:left">
            <span style="font-size:0.95rem;font-weight:600;color:#1a1a2e">${esc(v.nama || "Varian")}</span>
            <span style="font-size:0.95rem;font-weight:700;color:#667eea;white-space:nowrap">Rp ${formatRupiah(Number(v.harga) || 0)}</span>
        </button>
    `).join("");
    const content = `
        <p class="cn-muted" style="margin-top:0">Pilih varian <strong>${esc(p.nama)}</strong>:</p>
        <div>${rows}</div>
    `;
    const footer = `<button class="smart-btn smart-btn-secondary" id="pos-varian-close">Batal</button>`;
    const overlay = Modal({ open: true, title: "Pilih Varian", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#pos-varian-close")?.addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll("[data-varian-pick]").forEach(btn => {
        btn.addEventListener("click", () => {
            const v = variants[Number(btn.dataset.varianPick)];
            overlay.remove();
            if (v) addToCart(key, v);
        });
    });
}

function changeQty(key, delta) {
    const item = state.keranjang.find(i => i.key === key);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        state.keranjang = state.keranjang.filter(i => i.key !== key);
    }
    renderBill();
}

// ── PRD V1 §7.5 — Hold / Resume Transaksi ──

/** Bisa hold? Kasir/Admin dengan permission pos.transaction.hold. */
function canHold() {
    try { return Permission.can("pos.transaction.hold"); } catch { /* ignore */ }
    return true;
}

/**
 * Batal transaksi yang belum dibayar — kosongkan keranjang (lokal saja,
 * tanpa efek ke server karena transaksi belum dibuat).
 */
function cancelCurrentCart() {
    // Batal tetap tersedia saat member terverifikasi walau keranjang kosong
    // (kasir bisa langsung membatalkan/ganti member tanpa input produk dulu).
    if (state.keranjang.length === 0 && !state.member) return;
    const footer = `
        <button class="smart-btn smart-btn-danger" id="pos-cancel-confirm">Batal Transaksi</button>
        <button class="smart-btn smart-btn-secondary" id="pos-cancel-no">Tutup</button>
    `;
    const cancelDesc = state.keranjang.length > 0
        ? `Keranjang (${state.keranjang.length} item) akan dikosongkan${state.member ? " dan verifikasi member dibatalkan" : ""}.`
        : "Verifikasi member akan dibatalkan (kembali ke pelanggan Umum).";
    const overlay = Modal({
        open: true,
        title: "🗑️ Batal Transaksi",
        content: `<p>Yakin membatalkan transaksi ini? ${cancelDesc}</p>`,
        footer,
        closable: true,
        onClose: () => overlay?.remove?.()
    });
    document.body.appendChild(overlay);
    overlay.querySelector("#pos-cancel-no")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#pos-cancel-confirm")?.addEventListener("click", () => {
        overlay.remove();
        state.keranjang = [];
        state.member = null;
        state.tipePelanggan = "umum";
        const bayarEl = document.getElementById("pos-bayar");
        if (bayarEl) bayarEl.value = "";
        const diskonEl = document.getElementById("pos-diskon");
        if (diskonEl) diskonEl.value = "";
        const catatanEl = document.getElementById("pos-catatan");
        if (catatanEl) catatanEl.value = "";
        renderBill();
        showToast("warning", "Transaksi dibatalkan");
    });
}

/**
 * Render area tombol di bawah bill: Hold 50% + Batal 50% (keranjang aktif)
 * dan badge jumlah transaksi ditahan (klik → modal resume).
 */
function renderHoldActions() {
    const el = document.getElementById("pos-hold-actions");
    if (!el) return;

    const cartCount = state.keranjang.length;
    const heldCount = state.heldList.length;
    // Hold/Batal aktif sejak member terverifikasi (keranjang boleh kosong):
    // kasir bisa langsung membatalkan verifikasi member tanpa input produk dulu.
    const actionsEnabled = cartCount > 0 || Boolean(state.member);

    // Batal = operasi lokal (kosongkan keranjang) — selalu tersedia.
    // Hold & badge ditahan butuh permission pos.transaction.hold.
    if (!canHold()) {
        el.innerHTML = `
            <div class="pos-hold-row">
                <button class="pos-cancel-btn" id="pos-cancel-btn" ${actionsEnabled ? "" : "disabled"}>
                    🗑️ Batal
                </button>
            </div>
        `;
        return;
    }

    el.innerHTML = `
        <div class="pos-hold-row">
            <button class="pos-hold-btn" id="pos-hold-btn" ${actionsEnabled ? "" : "disabled"}>
                ⏸️ Hold
            </button>
            <button class="pos-cancel-btn" id="pos-cancel-btn" ${actionsEnabled ? "" : "disabled"}>
                🗑️ Batal
            </button>
        </div>
        ${heldCount > 0 ? `<div class="pos-held-row"><button class="pos-held-badge" id="pos-held-badge" title="Lanjutkan transaksi ditahan">🧾 ${heldCount} ditahan</button></div>` : ""}
    `;
}

/**
 * Simpan keranjang saat ini sebagai transaksi ditahan (status "held").
 * POST /api/penjualan (hold:true) → dibuat langsung berstatus "held":
 * tanpa pembayaran, tanpa kwitansi, tanpa perubahan stok.
 * Satu request atomik — tidak ada lagi create order lalu hold terpisah
 * (mencegah id palsu dari fallback saat server menolak).
 */
async function holdCurrentCart() {
    if (state.keranjang.length === 0) {
        showToast("warning", "Keranjang masih kosong");
        return;
    }
    const subtotal = state.keranjang.reduce((s, i) => s + (i.harga * i.qty), 0);
    const diskonTransaksi = Math.min(state.diskonTransaksi || 0, subtotal);
    const note = state.catatanTransaksi ? ` (${state.catatanTransaksi})` : "";
    const payload = {
        sumber: "pos",
        hold: true,
        holdNote: `Keranjang ditahan oleh ${kasirName}${note}`,
        kasir: kasirName,
        tipePelanggan: state.tipePelanggan,
        pelanggan: state.member ? state.member.kode : undefined,
        items: state.keranjang.map(i => ({
            id: i.id || undefined,
            kode: i.kode,
            nama: i.nama,
            satuan: i.satuan || "",
            qty: i.qty,
            harga: i.harga,
            diskon: 0,
            subtotal: i.harga * i.qty,
            recipeId: i.recipeId || undefined,
            skuKode: i.skuKode || undefined,
            skuLabel: i.skuLabel || undefined
        })),
        total: subtotal,
        diskon: diskonTransaksi,
        pajak: 0,
        bayar: 0,
        kembalian: 0,
        gudang: state.gudang?.kodeGudang || undefined,
        catatan: `DITAHAN — ${state.catatanTransaksi || "keranjang sementara"}`
    };

    try {
        await createPenjualan(payload);

        // Bersihkan keranjang & UI (reset jenis pelanggan — transaksi baru)
        state.keranjang = [];
        state.diskonTransaksi = 0;
        state.catatanTransaksi = "";
        state.member = null;
        state.tipePelanggan = "umum";
        const bayarEl = document.getElementById("pos-bayar");
        if (bayarEl) bayarEl.value = "";
        const diskonEl = document.getElementById("pos-diskon");
        if (diskonEl) diskonEl.value = "";
        const catatanEl = document.getElementById("pos-catatan");
        if (catatanEl) catatanEl.value = "";
        renderBill();
        showToast("success", "Transaksi di-hold — bisa dilanjutkan nanti");
        refreshHeldList();
    } catch (err) {
        console.error("[Kasir] Hold error:", err);
        showToast("danger", `Gagal menyimpan: ${err.message || "coba lagi"}`);
    }
}

/**
 * Muat ulang daftar transaksi ditahan (status=held, company-scoped).
 */
async function refreshHeldList() {
    if (!canHold()) { state.heldList = []; return; }
    try {
        const res = await listPenjualan({ page: 1, limit: 50, status: "held" });
        state.heldList = (res.data || []).filter(t => t.status === "held");
    } catch (err) {
        console.warn("[Kasir] Gagal memuat transaksi ditahan:", err?.message);
        state.heldList = [];
    }
    state.heldLoaded = true;
    renderHoldActions();
}

/**
 * Modal daftar transaksi ditahan — resume (lanjutkan keranjang) / hapus.
 */
function openHeldModal() {
    const list = state.heldList;
    if (list.length === 0) {
        showToast("info", "Tidak ada transaksi ditahan");
        return;
    }
    // Cegah resume menimpa keranjang yang sedang terisi (data kasir hilang)
    if (state.keranjang.length > 0) {
        showToast("warning", "Selesaikan atau kosongkan keranjang aktif dulu sebelum melanjutkan transaksi ditahan");
        return;
    }
    const rows = list.map(t => {
        const items = (t.items || []).map(i => `${esc(i.nama)} x${i.qty}`).join(", ") || "-";
        const waktu = t.heldAt ? new Date(t.heldAt).toLocaleString("id-ID") : (t.tanggal ? new Date(t.tanggal).toLocaleString("id-ID") : "-");
        return `
            <div class="pos-held-item" data-held-id="${esc(t._id || t.id)}">
                <div class="pos-held-info">
                    <div class="pos-held-nomor">🧾 ${esc(t.nomor || "-")} <span class="pos-held-time">${esc(waktu)}</span></div>
                    <div class="pos-held-items">${items}</div>
                    <div class="pos-held-total">Total: Rp ${formatRupiah(Number(t.grandTotal) || 0)}${t.heldNote ? ` · ${esc(t.heldNote)}` : ""}</div>
                </div>
                <div class="pos-held-actions">
                    <button class="smart-btn smart-btn-primary smart-btn-sm" data-held-resume="${esc(t._id || t.id)}">Lanjutkan</button>
                    <button class="smart-btn smart-btn-danger smart-btn-sm" data-held-delete="${esc(t._id || t.id)}" title="Hapus transaksi ditahan">🗑</button>
                </div>
            </div>
        `;
    }).join("");

    const footer = `<button class="smart-btn smart-btn-secondary" id="f-held-close">Tutup</button>`;
    const overlay = Modal({
        open: true,
        title: `🧾 Transaksi Ditahan (${list.length})`,
        content: `<div class="pos-held-list">${rows}</div>`,
        footer,
        closable: true,
        onClose: () => overlay?.remove?.()
    });
    document.body.appendChild(overlay);
    overlay.querySelector("#f-held-close")?.addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll("[data-held-resume]").forEach(btn => {
        btn.addEventListener("click", () => resumeHeldTransaction(btn.dataset.heldResume, overlay));
    });
    overlay.querySelectorAll("[data-held-delete]").forEach(btn => {
        btn.addEventListener("click", () => deleteHeldTransaction(btn.dataset.heldDelete, overlay));
    });
}

/**
 * Lanjutkan transaksi ditahan: resume server (held → order) lalu muat
 * items kembali ke keranjang & hapus transaksi agar tidak ganda.
 */
async function resumeHeldTransaction(id, overlay) {
    if (!id) return;
    if (state.keranjang.length > 0) {
        showToast("warning", "Selesaikan atau kosongkan keranjang aktif dulu");
        return;
    }
    try {
        const held = await resumePenjualan(id);
        if (!held) throw new Error("Transaksi tidak ditemukan");

        // Muat items ke keranjang (validasi stok tetap berlaku saat checkout).
        // Behavior item dokumen Penjualan tidak tersimpan → derive ulang dari
        // katalog agar badge Jasa/Resep tetap tampil benar setelah resume.
        state.keranjang = (held.items || []).map((i, idx) => {
            const cat = state.produk.find(p => (p.kode || "") === (i.kode || ""));
            return {
                key: `${i.kode}-${idx}-${Date.now()}`, // key unik per baris resume
                id: i.id || null,
                kode: i.kode,
                nama: i.nama,
                satuan: i.satuan || "",
                harga: Number(i.harga) || 0,
                behavior: cat?.behavior || "trading",
                // recipeId varian tersimpan di item transaksi ditahan — konsumsi
                // bahan tetap memakai ingredient varian yang benar setelah resume
                recipeId: i.recipeId || "",
                // skuKode/skuLabel tersimpan — stok kombinasi tetap konsisten
                skuKode: i.skuKode || "",
                skuLabel: i.skuLabel || "",
                qty: Number(i.qty) || 1
            };
        });
        state.diskonTransaksi = Math.min(Number(held.diskon) || 0, state.keranjang.reduce((s, i) => s + (i.harga * i.qty), 0));
        state.catatanTransaksi = String(held.catatan || "").replace(/^DITAHAN —\s*/, "");
        const isMemberHeld = String(held.tipePelanggan || "umum").toLowerCase() === "member";
        state.tipePelanggan = isMemberHeld ? "member" : "umum";
        state.member = isMemberHeld && held.pelanggan && held.pelanggan !== "UMUM"
            ? { kode: held.pelanggan, nama: held.pelangganNama || held.pelanggan }
            : null;
        // M3-FIX v21 — pulihkan gudang transaksi ditahan (bila tersimpan)
        if (held.gudang) {
            state.gudang = { kodeGudang: held.kodeGudang || "", namaGudang: held.gudang };
        }

        // Hapus dokumen held (transaksi sementara tidak boleh tersisa duplikat)
        try { await deletePenjualan(id); } catch (e) { console.warn("[Kasir] Gagal hapus dokumen held:", e?.message); }

        overlay?.remove?.();
        refreshHeldList();
        const bayarEl = document.getElementById("pos-bayar");
        if (bayarEl) bayarEl.value = "";
        renderBill();
        showToast("success", "Transaksi dilanjutkan — silakan lanjutkan checkout");
    } catch (err) {
        console.error("[Kasir] Resume error:", err);
        showToast("danger", `Gagal melanjutkan: ${err.message || "coba lagi"}`);
    }
}

/** Hapus transaksi ditahan (status held). */
async function deleteHeldTransaction(id, overlay) {
    if (!id) return;
    try {
        await deletePenjualan(id);
        showToast("success", "Transaksi ditahan dihapus");
        overlay?.remove?.();
        refreshHeldList();
    } catch (err) {
        showToast("danger", err.message || "Gagal menghapus transaksi ditahan");
    }
}

// ── Checkout & Struk ──

async function checkout() {
    if (state.keranjang.length === 0) {
        showToast("warning", "Keranjang masih kosong");
        return;
    }
    const subtotal = state.keranjang.reduce((s, i) => s + (i.harga * i.qty), 0);
    const diskonTransaksi = Math.min(state.diskonTransaksi || 0, subtotal);
    const pajak = state.taxEnabled ? Math.round((subtotal - diskonTransaksi) * TAX_RATE) : 0;
    const total = subtotal - diskonTransaksi + pajak;
    const bayar = Number(String(document.getElementById("pos-bayar")?.value || "").replace(/\D/g, "")) || 0;
    if (bayar < total) {
        showToast("warning", "Jumlah bayar kurang dari total");
        document.getElementById("pos-bayar")?.focus();
        return;
    }
    const kembalian = Math.max(0, bayar - total);

    const payload = {
        sumber: "pos",
        kasir: kasirName,
        tipePelanggan: state.tipePelanggan,
        pelanggan: state.member ? state.member.kode : undefined,
        metode_bayar: state.metodeBayar || "cash",
        items: state.keranjang.map(i => ({
            id: i.id || undefined,
            kode: i.kode,
            nama: i.nama,
            satuan: i.satuan || "",
            qty: i.qty,
            harga: i.harga,
            diskon: 0,
            subtotal: i.harga * i.qty,
            recipeId: i.recipeId || undefined,
            skuKode: i.skuKode || undefined,
            skuLabel: i.skuLabel || undefined
        })),
        total: subtotal,
        diskon: diskonTransaksi,
        pajak,
        bayar,
        kembalian,
        gudang: state.gudang?.kodeGudang || undefined,
        catatan: state.catatanTransaksi || ""
    };

    const btn = document.getElementById("pos-checkout-btn");
    const original = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="pos-spinner"></span> Memproses...';
    }    try {
        const res = await createPenjualan(payload);
        const nomor = res && (res.nomor || res.noKwitansi) ? (res.nomor || res.noKwitansi) : `TX-${Date.now()}`;
        const metodeLabel = PAYMENT_METHODS.find(m => m.value === state.metodeBayar)?.label || "Tunai";
        const memberInfo = state.member;
        const tipeInfo = state.tipePelanggan;

        // Transaksi sudah tersimpan — bersihkan keranjang & reset kasir
        state.keranjang = [];
        state.diskonTransaksi = 0;
        state.catatanTransaksi = "";
        state.member = null;
        state.tipePelanggan = "umum";
        const bayarEl = document.getElementById("pos-bayar");
        if (bayarEl) bayarEl.value = "";
        const diskonEl = document.getElementById("pos-diskon");
        if (diskonEl) diskonEl.value = "";
        const catatanEl = document.getElementById("pos-catatan");
        if (catatanEl) catatanEl.value = "";
        renderBill();
        // HP — setelah transaksi selesai, tutup overlay bill (kembali ke daftar produk)
        document.querySelector(".pos-page")?.classList.remove("bill-open");
        // Omset kasir di widget shift ikut ter-update setelah transaksi selesai
        refreshShiftOmset();
        showToast("success", `Transaksi ${nomor} berhasil disimpan`);

        // M3-FIX v21 — langsung cetak struk thermal 72mm (tanpa pilihan format)
        printNotaThermal({
            nomor, kasir: kasirName, items: payload.items, subtotal, diskon: diskonTransaksi,
            pajak, total, bayar, kembalian, metode: metodeLabel, tipePelanggan: tipeInfo, member: memberInfo,
            gudang: state.gudang?.namaGudang || ""
        });
    } catch (err) {
        console.error("[Kasir] Checkout error:", err);
        showToast("danger", `Checkout gagal: ${err.message || "coba lagi"}`);
    } finally {
        if (btn) {
            btn.innerHTML = original;
            btn.disabled = false;
            renderBill();
        }
    }
}

// ── M3-FIX v21 — Cetak Bukti Transaksi: langsung Struk Thermal 72mm ──
// (pilihan format "Struk Thermal / Normal" dihapus — format struk thermal tetap)

/** Cetak struk ukuran thermal 72mm (model Nota kasir di Transaksi → Penjualan). */
function printNotaThermal(payload) {
    const itemsHtml = (payload.items || []).map(i => `
        <tr>
            <td style="padding:2px 0;font-size:9px;">${esc(i.nama)}</td>
            <td style="text-align:center;padding:2px 0;font-size:9px;">${i.qty}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${formatRupiah(i.harga)}</td>
            <td style="text-align:right;padding:2px 0;font-size:9px;">${formatRupiah(i.harga * i.qty)}</td>
        </tr>
    `).join("");
    const memberLine = payload.tipePelanggan === "member"
        ? `<div class="info">Member: ${esc(payload.member?.nama || "-")}${payload.member?.kode ? ` (${esc(payload.member.kode)})` : ""}</div>`
        : `<div class="info">Pelanggan: Umum</div>`;
    const gudangLine = payload.gudang ? `<div class="info">Gudang: ${esc(payload.gudang)}</div>` : "";

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>Nota - ${esc(payload.nomor)}</title>
<style>
    @page { margin:0; size:80mm auto; }
    body { font-family:'Courier New',Courier,monospace; margin:0; padding:4mm; width:72mm; color:#000; font-size:9px; line-height:1.3; }
    .header { text-align:center; margin-bottom:4px; }
    .header .name { font-size:8px; }
    .header .addr { font-size:13px; font-weight:bold; }
    .divider { border-top:1px dashed #000; margin:3px 0; }
    .info { font-size:8px; margin-bottom:3px; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:8px; border-bottom:1px solid #000; padding:2px 0; }
    td { font-size:9px; padding:2px 0; }
    .total { text-align:right; font-size:10px; font-weight:bold; margin-top:3px; }
    .footer { text-align:center; font-size:8px; margin-top:6px; }
    @media print { body { width:72mm; } }
</style></head>
<body>        <div class="header">
        <div class="name">${esc(kasirCompany || "SMART Kasir")}</div>
        <div class="addr">Nota Penjualan</div>
    </div>
    <div class="divider"></div>
    <div class="info">No. Nota: ${esc(payload.nomor)}</div>
    <div class="info">Tgl: ${new Date().toLocaleString("id-ID")}</div>
    <div class="info">Kasir: ${esc(payload.kasir)}</div>
    ${gudangLine}
    ${memberLine}
    <div class="divider"></div>
    <table>
        <thead><tr><th>Nama</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
    </table>
    <div class="divider"></div>
    <div style="text-align:right;font-size:9px;">Subtotal: ${formatRupiah(payload.subtotal)}</div>
    ${payload.diskon ? `<div style="text-align:right;font-size:9px;">Diskon: -${formatRupiah(payload.diskon)}</div>` : ""}
    ${payload.pajak ? `<div style="text-align:right;font-size:9px;">Pajak: ${formatRupiah(payload.pajak)}</div>` : ""}
    <div class="total">TOTAL: ${formatRupiah(payload.total)}</div>
    <div style="text-align:right;font-size:9px;">Dibayar: ${formatRupiah(payload.bayar)}</div>
    <div style="text-align:right;font-size:9px;">Kembali: ${formatRupiah(payload.kembalian)}</div>
    <div style="text-align:right;font-size:9px;">Metode: ${esc(payload.metode)}</div>
    <div class="divider"></div>
    <div class="footer">Terima Kasih</div>
    <script>window.print();window.close();<\/script>
</body></html>`;

    printToWindow(html);
}

/** Buka window print untuk HTML struk. */
function printToWindow(html) {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) {
        showToast("danger", "Pop-up diblokir — izinkan pop-up untuk mencetak struk");
        return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 250);
}

// ── F&B Payment Proof V1 — Bell Notifikasi Kasir ──
// Badge menampilkan JUMLAH ORDER PENDING (paymentStatus=pending) — kasir
// langsung tahu berapa order menunggu diproses. Order BARU → badge naik +
// SUARA "Ada order masuk". Klik bell → modal notifikasi (bukti pembayaran,
// pembatalan) seperti sebelumnya.

let bellTimer = null;
let bellLastCount = -1;      // jumlah order PENDING (suara/toast "ada order masuk")
let bellNotifLast = -1;      // jumlah notifikasi unread (BADGE 🔔 — semua tipe)
let bellProofLast = -1;      // jumlah notifikasi unread tipe payment_proof (suara)

/**
 * Inisialisasi bell notifikasi kasir: tampil hanya bila permission
 * pos.order.view + capability fnb aktif. Poll tiap 15 detik (pola kitchen
 * display):
 *   - Badge 🔔 = JUMLAH NOTIFIKASI BELUM DIBACA (role kasir) — order baru
 *     masuk (order_new), bukti pembayaran (payment_proof), order dibatalkan
 *     (order_cancelled). Naik 1, 2, 3... saat order masuk; kembali 0 setelah
 *     dibaca / "Tandai semua dibaca".
 *   - Order BARU masuk → toast + SUARA "Ada order masuk" (order pending naik)
 *   - Bukti pembayaran BARU diupload (unread payment_proof naik) → SUARA
 *     "Pembayaran baru menunggu verifikasi" (tidak dipicu order_new)
 */
function initCashierBell() {
    const bell = document.getElementById("pos-bell-btn");
    if (!bell) return;
    let canView = false;
    try { canView = Permission.can("pos.order.view"); } catch { /* ignore */ }
    let fnbActive = false;
    try { fnbActive = isTransactionTypeEnabled("fnb"); } catch { /* ignore */ }
    if (!canView || !fnbActive) return;

    bell.style.display = "inline-flex";
    bell.addEventListener("click", openCashierBellModal);

    clearInterval(bellTimer);
    refreshBellCount();
    bellTimer = setInterval(() => {
        const prevPending = bellLastCount;
        const prevProof = bellProofLast;
        refreshBellCount().then(() => {
            // Order BARU masuk saat halaman terbuka → toast + SUARA.
            if (bellLastCount > prevPending && prevPending >= 0 && bellLastCount > 0) {
                showToast("info", `🔔 Ada ${bellLastCount} order pending menunggu diproses`);
                playAlertTone();
                speak("Ada order masuk");
            }
            // Bukti pembayaran BARU diupload — HANYA unread payment_proof
            // yang naik (order_new ikut menaikkan badge, bukan suara ini).
            if (bellProofLast > prevProof && prevProof >= 0 && bellProofLast > 0) {
                showToast("info", "🔔 Pembayaran baru menunggu verifikasi");
                playAlertTone();
                speak("Pembayaran baru menunggu verifikasi");
            }
        });
    }, 15000);
}

/**
 * Ambil order PENDING (suara/toast) + notifikasi unread (BADGE — nomor
 * kembali ke 0 setelah semua dibaca, termasuk "Tandai semua dibaca").
 * Badge = SEMUA tipe unread (order_new, payment_proof, order_cancelled) —
 * naik 1, 2, 3... saat order masuk; bellProofLast hanya utk suara verifikasi.
 */
async function refreshBellCount() {
    try {
        const [pendingRes, notifRes] = await Promise.allSettled([
            listTableOrders({ status: "pending" }),
            listNotifications({ role: "cashier", unread: true })
        ]);
        const pending = pendingRes.status === "fulfilled" && Array.isArray(pendingRes.value?.data)
            ? pendingRes.value.data.length : 0;
        bellLastCount = pending;
        let notifCount = 0;
        let proofCount = 0;
        if (notifRes.status === "fulfilled" && Array.isArray(notifRes.value?.data)) {
            notifCount = notifRes.value.data.length;
            proofCount = notifRes.value.data.filter(n => String(n.type || "") === "payment_proof").length;
        }
        bellNotifLast = notifCount;
        bellProofLast = proofCount;
        const el = document.getElementById("pos-bell-count");
        if (el) {
            // Badge = JUMLAH NOTIFIKASI BELUM DIBACA (role kasir), bukan order
            // pending — setelah semua dibaca (termasuk "Tandai semua dibaca")
            // nomor kembali ke 0. Cap "99+" utk >99; SELALU TAMPIL (termasuk 0)
            // supaya penomoran tidak menghilang (pola badge keranjang).
            el.textContent = notifCount > 99 ? "99+" : String(notifCount);
            el.style.display = "inline-flex";
        }
    } catch { /* server tidak tersedia — jangan mengganggu kasir */ }
}

/** Modal bell — daftar notifikasi (unread + read) dengan [LIHAT]. */
async function openCashierBellModal() {
    const content = `
        <div id="pos-bell-body">
            <div class="cn-loading"><span class="cn-spinner"></span> Memuat notifikasi...</div>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="pos-bell-close">Tutup</button>
    `;
    const overlay = Modal({ open: true, title: "🔔 Notifikasi Kasir", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#pos-bell-close")?.addEventListener("click", () => overlay.remove());
    const body = overlay.querySelector("#pos-bell-body");
    try {
        const res = await listNotifications({ role: "cashier" });
        const items = Array.isArray(res?.data) ? res.data : [];
        if (!items.length) {
            body.innerHTML = `<p class="cn-muted" style="text-align:center;padding:20px 0">Belum ada notifikasi.</p>`;
            return;
        }
        body.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="cn-muted" style="font-size:0.78rem">${items.length} notifikasi</span>
                <button class="smart-btn smart-btn-secondary" id="pos-bell-read-all" style="font-size:0.75rem;padding:4px 10px">Tandai semua dibaca</button>
            </div>
            ${items.map(n => `
                <div class="pos-bell-item ${n.read ? "read" : ""}" data-notif-id="${esc(String(n._id))}">
                    <div class="pos-bell-item-head">
                        <span class="pos-bell-item-title">${esc(n.title || "Notifikasi")}</span>
                        ${n.read ? "" : `<span class="pos-bell-dot"></span>`}
                    </div>
                    <div class="pos-bell-item-msg">${esc(n.message || "")}</div>
                    <div class="pos-bell-item-meta">${fmtBellTime(n.createdAt)}</div>
                    ${n.read ? "" : `<button class="smart-btn smart-btn-primary" data-bell-view="${esc(String(n._id))}" data-order-id="${esc(String(n.orderId || ""))}" data-notif-type="${esc(String(n.type || ""))}" style="margin-top:8px;font-size:0.8rem;padding:6px 14px">LIHAT</button>`}
                </div>
            `).join("")}
        `;
        body.querySelector("#pos-bell-read-all")?.addEventListener("click", async () => {
            try {
                await markAllNotificationsRead("cashier");
                showToast("success", "Semua notifikasi ditandai dibaca");
                overlay.remove();
                refreshBellCount();
            } catch (err) {
                showToast("danger", err?.message || "Gagal menandai dibaca");
            }
        });
        body.querySelectorAll("[data-bell-view]").forEach(btn => btn.addEventListener("click", async () => {
            const notifId = btn.dataset.bellView;
            const orderId = btn.dataset.orderId;
            const notifType = btn.dataset.notifType || "";
            try { await markNotificationRead(notifId); } catch { /* best effort */ }
            overlay.remove();
            refreshBellCount();
            if (!orderId) return;
            // ORDER BARU MASUK → buka panel Order Meja (kasir lihat order
            // baru yang perlu disiapkan/dilayani). ORDER DIBATALKAN (kitchen)
            // → modal refund (bila lunas) / info pembatalan; selain itu
            // (payment_proof) → verifikasi bukti bayar.
            if (notifType === "order_new") {
                showOrderMejaPanel();
            } else if (notifType === "order_cancelled") {
                openCancelledOrderModal(orderId);
            } else {
                openPaymentVerificationModal(orderId);
            }
        }));
    } catch (err) {
        body.innerHTML = `<p class="cn-muted" style="text-align:center;padding:20px 0">${esc(err?.message || "Gagal memuat notifikasi")}</p>`;
    }
}

/**
 * Modal PAYMENT VERIFICATION — kasir membuka bukti yang di-upload customer:
 * tampilkan Order / Meja / Metode / Total + gambar bukti + [TOLAK]
 * [KONFIRMASI BAYAR]. Approve → PENDING → PAID (manual); Reject → bukti
 * REJECTED, order TETAP PENDING (customer dapat upload ulang).
 * @param {string} orderId TableOrder._id
 */
async function openPaymentVerificationModal(orderId) {
    let proofs = [];
    try {
        const res = await listOrderProofs(orderId);
        proofs = Array.isArray(res?.data) ? res.data : [];
    } catch (err) {
        return showToast("danger", err?.message || "Gagal memuat bukti pembayaran");
    }
    const pending = proofs.find(p => p.status === "pending");
    if (!pending) {
        return showToast("warning", "Tidak ada bukti pembayaran yang menunggu verifikasi");
    }

    // Info order (orderId, meja, metode, total) untuk tampilan verifikasi.
    let order = null;
    try {
        const { getTableOrder } = await import("../../data/table-order-data.js");
        order = await getTableOrder(orderId);
    } catch { /* info order fallback dari bukti */ }
    const nomorMeja = (order && order.nomorMeja) || pending.nomorMeja || "—";
    const paymentMethod = (order && order.paymentMethod) || "";
    const total = (order && Number(order.total)) || 0;

    const content = `
        <div class="pv-head">
            <div class="pv-order-id">${esc((order && order.orderId) || pending.orderId || "")}</div>
            <div class="cn-muted" style="font-size:0.85rem">
                Meja ${esc(nomorMeja)} · ${paymentMethodLabel(paymentMethod)} · <strong>Rp ${total.toLocaleString("id-ID")}</strong>
            </div>
        </div>
        <div class="pv-proof-img"><img src="${esc(pending.dataUri || "")}" alt="Bukti pembayaran" /></div>
        <div class="pv-proof-meta">Bukti di-upload ${fmtBellTime(pending.createdAt)}${pending.uploadedBy ? ` oleh ${esc(pending.uploadedBy)}` : ""}</div>
        <label for="pv-reason" class="cn-muted" style="font-size:0.78rem">Catatan (wajib saat menolak):</label>
        <input class="smart-input pv-reason-input" id="pv-reason" placeholder="Contoh: nominal tidak sesuai" maxlength="300" />
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="pv-close">Tutup</button>
        <button class="smart-btn smart-btn-danger" id="pv-reject">✕ TOLAK</button>
        <button class="smart-btn smart-btn-primary" id="pv-approve">✅ KONFIRMASI BAYAR</button>
    `;
    const overlay = Modal({ open: true, title: "PAYMENT VERIFICATION", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#pv-close")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#pv-approve")?.addEventListener("click", async () => {
        if (!window.confirm(`Konfirmasi pembayaran order ini? Status berubah PENDING → PAID dan customer diberi notifikasi.`)) return;
        try {
            await approvePaymentProof(pending._id);
            showToast("success", "Pembayaran dikonfirmasi — customer diberi notifikasi");
            overlay.remove();
            refreshBellCount();
            refreshOrderMejaPanel();
            // Omset Kasir widget sidebar ikut ter-update (pembayaran QR Menu
            // dikonfirmasi → nilai penjualan shift berubah).
            refreshShiftOmset();
        } catch (err) {
            showToast("danger", err?.message || "Gagal mengonfirmasi pembayaran");
        }
    });
    overlay.querySelector("#pv-reject")?.addEventListener("click", async () => {
        const reason = (overlay.querySelector("#pv-reason")?.value || "").trim();
        if (!window.confirm(`Tolak bukti pembayaran ini? Order tetap ${paymentMethod ? "menunggu pembayaran" : "pending"} dan customer dapat upload ulang.`)) return;
        try {
            await rejectPaymentProof(pending._id, reason);
            showToast("success", "Bukti ditolak — customer diberi notifikasi");
            overlay.remove();
            refreshBellCount();
            refreshOrderMejaPanel();
        } catch (err) {
            showToast("danger", err?.message || "Gagal menolak bukti");
        }
    });
}

/** Label metode bayar utk tampilan verifikasi (mirror PAYMENT_LABEL order-meja). */
function paymentMethodLabel(method) {
    return { cash: "💵 Tunai", qris: "📱 QRIS", transfer: "🏦 Transfer", card: "💳 Kartu" }[method] || method || "";
}

/**
 * Modal ORDER DIBATALKAN (dibuka dari bell kasir, type order_cancelled):
 * tampilkan info pembatalan; bila order SUDAH LUNAS → tombol [💰 REFUND]
 * (kasir wajib mengembalikan pembayaran). Belum lunas → info saja (tanpa
 * refund — tidak ada yang perlu dikembalikan; notifikasi sudah terkirim).
 * @param {string} orderId TableOrder._id
 */
async function openCancelledOrderModal(orderId) {
    let order = null;
    try {
        const { getTableOrder } = await import("../../data/table-order-data.js");
        order = await getTableOrder(orderId);
    } catch (err) {
        return showToast("danger", err?.message || "Gagal memuat order");
    }
    if (!order) return showToast("warning", "Order tidak ditemukan");
    // Berlaku utk pembatalan SELURUH (kitchenStatus=cancelled) ATAU parsial
    // (sebagian item ditandai cancelled).
    const hasCancelledItems = (Array.isArray(order.items) ? order.items : []).some(i => i && i.cancelled);
    if (String(order.kitchenStatus || "") !== "cancelled" && !hasCancelledItems) {
        return showToast("warning", "Order ini tidak berstatus dibatalkan");
    }

    const isPaid = order.paymentStatus === "paid";
    const isRefunded = order.refundStatus === "refunded";
    const canRefund = isPaid && !isRefunded;
    const total = Number(order.total || 0);
    const refundAmount = Number(order.refundAmount || order.total || 0);
    // F&B V1 — pembatalan PER-ITEM: tampilkan baris yang dibatalkan.
    const cancelledItems = (Array.isArray(order.items) ? order.items : []).filter(i => i && i.cancelled);
    const partial = cancelledItems.length > 0 && cancelledItems.length < (Array.isArray(order.items) ? order.items : []).length;
    const cancelledLines = cancelledItems.length
        ? `<div class="pv-proof-meta" style="margin-top:8px">🗑️ Dibatalkan: ${esc(cancelledItems.map(i => `${i.qty}× ${i.nama}`).join(", "))}</div>`
        : "";

    const content = `
        <div class="pv-head">
            <div class="pv-order-id">${esc(order.orderId || "")}</div>
            <div class="cn-muted" style="font-size:0.85rem">
                Meja ${esc(order.nomorMeja || "-")} · ${paymentMethodLabel(order.paymentMethod)} · <strong>Rp ${total.toLocaleString("id-ID")}</strong>
            </div>
        </div>
        <p class="pv-proof-meta">❌ ${partial ? "Item dibatalkan" : "Order dibatalkan"} oleh <strong>${esc(order.cancelledBy || "-")}</strong> pada ${fmtBellTime(order.cancelledAt)}${order.cancelReason ? `<br/>📝 ${esc(order.cancelReason)}` : ""}</p>
        ${cancelledLines}
        ${isPaid ? (isRefunded
            ? `<div class="pv-proof-meta">💰 Refund <strong>Rp ${Number(order.refundAmount || 0).toLocaleString("id-ID")}</strong> diproses oleh <strong>${esc(order.refundedBy || "-")}</strong> pada ${fmtBellTime(order.refundedAt)}</div>`
            : `<div class="cn-alert-danger" style="margin-top:8px">⚠️ ${partial ? "Sebagian item sudah lunas — wajib refund parsial" : "Order SUDAH LUNAS — wajib refund"} ke pelanggan sebesar <strong>Rp ${refundAmount.toLocaleString("id-ID")}</strong>.</div>`)
            : `<div class="pv-proof-meta" style="margin-top:8px">Pembayaran belum lunas — tidak ada refund. Pelanggan sudah diberi notifikasi pembatalan.</div>`}
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="pv-close">Tutup</button>
        ${canRefund ? `<button class="smart-btn smart-btn-danger" id="pv-refund">💰 REFUND Rp ${refundAmount.toLocaleString("id-ID")}</button>` : ""}
    `;
    const overlay = Modal({ open: true, title: partial ? "Item Dibatalkan" : "Order Dibatalkan", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#pv-close")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#pv-refund")?.addEventListener("click", async () => {
        if (!window.confirm(`Proses REFUND ${order.orderId} (Meja ${order.nomorMeja}) sebesar Rp ${refundAmount.toLocaleString("id-ID")}?\n\nRefund tercatat sebagai pengurang nilai penjualan shift dan pelanggan diberi notifikasi.`)) return;
        try {
            const { refundTableOrder } = await import("../../data/table-order-data.js");
            await refundTableOrder(orderId);
            showToast("success", `Refund Rp ${total.toLocaleString("id-ID")} diproses — pelanggan diberi notifikasi`);
            overlay.remove();
            refreshBellCount();
            refreshOrderMejaPanel();
            // Refund mengurangi nilai penjualan shift — Omset Kasir di
            // widget sidebar langsung disinkronkan.
            refreshShiftOmset();
        } catch (err) {
            showToast("danger", err?.message || "Gagal memproses refund");
        }
    });
}

/** Format timestamp ringkas utk bell (id-ID). */
function fmtBellTime(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    } catch {
        return String(d);
    }
}

// ── Styles ──

function getStyles() {
    return `
/* dvh fallback: 100vh mengukur viewport besar termasuk area di belakang toolbar
   browser tablet/mobile → konten bawah terpotong & seolah tidak bisa discroll.
   100dvh = tinggi viewport dinamis yang benar-benar terlihat. */
.pos-page { display:flex; flex-direction:column; gap:0; height:calc(100vh - 118px); height:calc(100dvh - 118px); min-height:480px; }
/* Header — samakan dengan topbar admin: var(--topbar-bg/--topbar-text)
   (putih + aksen emerald di light mode; ikut gelap di dark mode admin) */
/* Header — SITAMPAN-inspired purple-blue gradient, font putih */
.pos-header {
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color:#fff;
    padding:12px 18px; border-radius:0; flex-shrink:0; /* tanpa radius atas — menyatu dengan tab browser */
    border-bottom:1px solid rgba(255,255,255,0.14);
}
.pos-header-left { display:flex; align-items:center; gap:12px; min-width:0; }
.pos-header-icon { font-size:1.5rem; display:flex; align-items:center; flex-shrink:0; }
.pos-header-text { min-width:0; }
.pos-header-logo-img {
    width:40px; height:40px; border-radius:50%; object-fit:cover;
    border:2px solid rgba(255,255,255,0.35); display:block; background:#fff;
    box-shadow:0 1px 3px rgba(0,0,0,0.15);
}
.pos-header h1 { margin:0; font-size:1.1rem; font-weight:700; line-height:1.1; color:#fff; }
.pos-header-sub { font-size:0.78rem; color:rgba(255,255,255,0.88); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pos-header-right { display:flex; align-items:center; gap:8px; margin-left:auto; }
.pos-header-right .pos-header-hint { font-size:0.78rem; color:rgba(255,255,255,0.75); }
.pos-logout-btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:7px 14px; border:1px solid rgba(255,255,255,0.55); border-radius:8px;
    background:rgba(255,255,255,0.16); color:#fff; cursor:pointer;
    font-size:0.8rem; font-weight:600; white-space:nowrap;
    transition:background 0.15s, transform 0.1s;
}
.pos-logout-btn .pos-logout-icon {
    display:block; flex-shrink:0;
}
.pos-logout-btn:hover .pos-logout-icon { transform:translateX(2px); }
.pos-logout-btn .pos-logout-icon { transition:transform 0.15s; }
/* SVG logout di dalam smart-btn (modal shift) — sejajar dengan teks */
.shift-open-actions .pos-logout-icon,
.smart-btn .pos-logout-icon { vertical-align:-2px; margin-right:4px; }
/* HP — ikon keranjang di header (bill overlay). Tersembunyi di desktop/tablet. */
.pos-cart-btn {
    position:relative; display:none; align-items:center; gap:6px;
    padding:7px 12px; border:1px solid rgba(255,255,255,0.55); border-radius:8px;
    background:rgba(255,255,255,0.16); color:#fff; cursor:pointer;
    font-size:0.85rem; font-weight:600; white-space:nowrap;
    transition:background 0.15s, transform 0.1s;
}
.pos-cart-btn:hover { background:rgba(255,255,255,0.28); }
.pos-cart-btn:active { transform:scale(0.97); }
/* Badge jumlah item — LAYOUT disamakan dgn badge lonceng: pojok kanan ATAS
   icon (absolute top/right), bukan di samping icon. */
.pos-cart-count {
    position:absolute; top:-5px; right:-5px; min-width:18px; height:18px; padding:0 4px;
    border-radius:999px; background:#f59e0b; color:#0f172a; font-size:0.72rem; font-weight:700;
    display:inline-flex; align-items:center; justify-content:center;
}
/* F&B Payment Proof V1 — bell notifikasi kasir di header (unread count badge). */
.pos-bell-btn {
    position:relative; display:none; align-items:center; gap:6px;
    padding:7px 11px; border:1px solid rgba(255,255,255,0.55); border-radius:8px;
    background:rgba(255,255,255,0.16); color:#fff; cursor:pointer;
    font-size:0.95rem; font-weight:600; white-space:nowrap;
    transition:background 0.15s, transform 0.1s;
}
.pos-bell-btn:hover { background:rgba(255,255,255,0.28); }
.pos-bell-btn:active { transform:scale(0.97); }
.pos-bell-count {
    position:absolute; top:-5px; right:-5px; min-width:18px; height:18px; padding:0 4px;
    border-radius:999px; background:#ef4444; color:#fff; font-size:0.7rem; font-weight:700;
    display:none; align-items:center; justify-content:center;
}
/* F&B V1 — Order Meja HP: icon-only di header (kanan lonceng). Tersembunyi
   di desktop/tablet — tombol Order Meja tetap di sidebar Kategori. */
.pos-order-meja-btn {
    display:none; align-items:center; justify-content:center;
    padding:7px 11px; border:1px solid rgba(255,255,255,0.55); border-radius:8px;
    background:rgba(255,255,255,0.16); color:#fff; cursor:pointer;
    font-size:0.95rem; font-weight:600; white-space:nowrap;
    transition:background 0.15s, transform 0.1s;
}
.pos-order-meja-btn:hover { background:rgba(255,255,255,0.28); }
.pos-order-meja-btn:active { transform:scale(0.97); }
/* HP/Tablet — buka/tutup shift di TOP BAR (widget sidebar disembunyikan di
   HP/tablet — footer pos-kategori-footer display:none). Tersembunyi di
   desktop: desktop tetap memakai widget shift di sidebar kiri. */
.pos-shift-header-btn {
    display:none; align-items:center; justify-content:center; position:relative;
    padding:7px 11px; border:1px solid rgba(255,255,255,0.55); border-radius:8px;
    background:rgba(255,255,255,0.16); color:#fff; cursor:pointer;
    font-size:0.95rem; font-weight:600; white-space:nowrap;
    transition:background 0.15s, transform 0.1s;
}
.pos-shift-header-btn:hover { background:rgba(255,255,255,0.28); }
.pos-shift-header-btn:active { transform:scale(0.97); }

/* Modal bell — daftar notifikasi pembayaran */
.pos-bell-item { padding:10px 12px; border:1px solid var(--smart-border,#e2e8f0); border-radius:10px; margin-bottom:8px; }
.pos-bell-item.read { opacity:0.72; }
.pos-bell-item-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.pos-bell-item-title { font-weight:700; font-size:0.88rem; }
.pos-bell-dot { width:8px; height:8px; border-radius:50%; background:#ef4444; flex-shrink:0; }
.pos-bell-item-msg { font-size:0.82rem; color:var(--smart-text-secondary,#64748b); margin-top:2px; line-height:1.4; }
.pos-bell-item-meta { font-size:0.72rem; color:var(--smart-text-secondary,#64748b); margin-top:4px; }

/* Modal verifikasi pembayaran — bukti + tombol TOLAK / KONFIRMASI BAYAR */
.pv-head { margin-bottom:10px; }
.pv-order-id { font-size:1.15rem; font-weight:800; }
.pv-proof-img { border:1px solid var(--smart-border,#e2e8f0); border-radius:10px; overflow:hidden; margin:10px 0; background:#f8fafc; }
.pv-proof-img img { display:block; width:100%; max-height:420px; object-fit:contain; }
.pv-proof-meta { font-size:0.75rem; color:var(--smart-text-secondary,#64748b); margin-top:6px; }
.pv-reason-input { width:100%; margin-top:8px; }

/* HP — tombol tutup (✕) di header bill overlay: kiri judul Bill, merah + X putih. */
.pos-bill-header-left { display:flex; align-items:center; gap:8px; min-width:0; }
.pos-bill-close {
    display:none; align-items:center; justify-content:center;
    width:30px; height:30px; border:1px solid #dc2626; border-radius:8px;
    background:#dc2626; color:#fff; cursor:pointer; font-size:0.9rem;
    transition:background 0.15s;
}
.pos-bill-close:hover { background:#b91c1c; }
.pos-logout-btn:hover { background:rgba(255,255,255,0.3); }
.pos-logout-btn:active { transform:scale(0.97); }

/* Mode fullscreen (role kasir) — halaman standalone tanpa shell admin */
.pos-page.pos-fullscreen { height:100vh; height:100dvh; min-height:0; border-radius:0; }
.pos-shell-host { height:100vh; height:100dvh; overflow:hidden; }

.pos-body { flex:1; display:flex; overflow:hidden; min-height:0; position:relative; border-radius:0 0 10px 10px; box-shadow:0 6px 24px rgba(0,0,0,0.08); }

/* Kiri: Kategori — SITAMPAN-inspired purple-blue gradient */
.pos-kategori {
    width:20%; min-width:170px;
    background:linear-gradient(180deg, #5870c8 0%, #3b4e9f 100%);
    color:#fff; padding:14px; overflow-y:auto; scrollbar-width:thin;
    display:flex; flex-direction:column;
    transition:width 0.25s ease, min-width 0.25s ease;
}
/* Tombol sembunyikan panel Kategori — pola sidebar admin */
.pos-sidebar-collapse-btn {
    display:flex; align-items:center; gap:10px; width:100%; margin-top:2px;
    padding:8px 10px; border:0; border-radius:8px;
    background:rgba(255,255,255,0.10); color:rgba(255,255,255,0.85);
    cursor:pointer; font-size:0.78rem; font-weight:600;
    transition:background 0.15s, color 0.15s;
}
.pos-sidebar-collapse-btn:hover { background:rgba(255,255,255,0.22); color:#fff; }
.pos-sidebar-collapse-btn .collapse-icon {
    font-size:0.68rem; width:20px; text-align:center; flex-shrink:0;
    transition:transform 0.3s ease;
}
.pos-sidebar-collapse-btn .collapse-label { white-space:nowrap; }
/* ── Panel Kategori collapsed — pola sidebar admin (ikon + tooltip) ── */
.pos-kategori.collapsed {
    width:64px; min-width:64px; padding:14px 8px; overflow:visible;
}
.pos-kategori.collapsed .pos-kategori-list { overflow:visible; }
.pos-kategori.collapsed .pos-panel-title { display:none; }
.pos-kategori.collapsed .pos-kat-btn { justify-content:center; padding:9px 4px; position:relative; }
.pos-kategori.collapsed .pos-kat-name { display:none; }
.pos-kategori.collapsed .pos-kat-icon { font-size:1.05rem; }
.pos-kategori.collapsed .pos-kat-btn::after {
    content:attr(data-title);
    position:absolute; left:calc(100% + 14px); top:50%;
    transform:translateY(-50%) translateX(-6px);
    z-index:200; padding:7px 14px; border-radius:8px;
    background:rgba(30,27,75,0.92); border:1px solid rgba(255,255,255,0.12);
    color:#fff; font-size:0.8rem; font-weight:500; white-space:nowrap;
    pointer-events:none; opacity:0; visibility:hidden;
    transition:opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
}
.pos-kategori.collapsed .pos-kat-btn::before {
    content:""; position:absolute; left:calc(100% + 9px); top:50%;
    transform:translateY(-50%);
    border:5px solid transparent; border-right-color:rgba(30,27,75,0.92);
    z-index:201; opacity:0; visibility:hidden;
    transition:opacity 0.3s ease, visibility 0.3s ease;
}
.pos-kategori.collapsed .pos-kat-btn:hover::after,
.pos-kategori.collapsed .pos-kat-btn:hover::before { opacity:1; visibility:visible; transition-delay:0.12s; }
.pos-kategori.collapsed .pos-kat-btn:hover::after { transform:translateY(-50%) translateX(0); }
/* Footer: status & widget shift disembunyikan; tombol tetap (ikon saja) */
.pos-kategori.collapsed .pos-status-row,
.pos-kategori.collapsed #pos-shift-widget { display:none; }
.pos-kategori.collapsed .pos-sidebar-collapse-btn { justify-content:center; padding:8px 6px; }
.pos-kategori.collapsed .pos-sidebar-collapse-btn .collapse-label { display:none; }
.pos-kategori.collapsed .pos-sidebar-collapse-btn .collapse-icon { transform:rotate(180deg); }
.pos-panel-title { margin:0 0 10px; font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.6); }
.pos-kategori-list { display:flex; flex-direction:column; gap:3px; flex:1; overflow-y:auto; min-height:0; }
/* M3-FIX v23 — status bawah sidebar kiri: Gudang, Shift, Pajak */
.pos-kategori-footer {
    display:flex; flex-direction:column; gap:6px; flex-shrink:0;
    margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.25);
    font-size:0.75rem; color:rgba(255,255,255,0.85);
}
.pos-status-row { display:flex; justify-content:space-between; align-items:center; gap:6px; }
.pos-kat-btn {
    display:flex; align-items:center; gap:8px; width:100%; text-align:left;
    padding:9px 10px; border:0; border-radius:8px; cursor:pointer;
    background:transparent; color:rgba(255,255,255,0.85); font-size:0.82rem;
    transition:background 0.15s, color 0.15s;
}
.pos-kat-btn:hover { background:rgba(255,255,255,0.23); color:#fff; }
.pos-kat-btn.active { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); color:#fff; font-weight:700; box-shadow:0 4px 12px rgba(108, 86, 231, 0.35); }
.pos-kat-icon { flex-shrink:0; }
.pos-kat-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* F&B V1 — tombol Order Meja di sidebar kasir (setelah daftar Kategori) */
.pos-kat-order-meja {
    flex-shrink:0; margin-top:8px;
    border-top:1px dashed rgba(255,255,255,0.35);
    border-radius:0 0 8px 8px;
    font-weight:600;
}
/* F&B V1 — panel Order Meja embedded (menggantikan produk+bill, sidebar tetap) */
.pos-order-meja {
    flex:1; background:#f8fafc; padding:14px; overflow-y:auto;
    display:flex; flex-direction:column; gap:12px; min-width:0;
}
/* display:flex di atas menimpa UA [hidden] — pastikan hidden tetap menang */
.pos-order-meja[hidden] { display:none; }

/* Tengah: Produk */
.pos-produk {
    flex:1; background:#f8fafc; padding:14px; overflow-y:auto;
    border-left:1px solid #e2e8f0; border-right:1px solid #e2e8f0;
    display:flex; flex-direction:column; gap:12px; min-width:0;
}
/* Kolom produk melebar otomatis (flex:1) saat sidebar Kategori disembunyikan */
.pos-kategori.collapsed ~ .pos-produk { border-left-color:transparent; }
.pos-produk-head { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-shrink:0; }
.pos-produk-head h2 { margin:0; font-size:1.15rem; font-weight:700; color:#0f172a; }
.pos-produk-tools { display:flex; align-items:center; gap:6px; }
.pos-produk-head input {
    width:210px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px;
    font-size:0.82rem; outline:none; background:#fff; color:#0f172a;
}
.pos-produk-head input:focus { border-color:#667eea; box-shadow:0 0 0 3px rgba(102,126,234,0.18); }
.pos-produk-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(132px, 1fr)); gap:10px; align-content:start; }
/* Sidebar disembunyikan → kartu lebih kecil agar lebih banyak tampil per baris */
.pos-kategori.collapsed ~ .pos-produk .pos-produk-grid { grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); }
.pos-prod-card {
    position:relative; background:rgba(255,255,255,0.72); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,0.6); border-radius:12px;
    overflow:hidden; cursor:pointer; transition:transform 0.15s, box-shadow 0.15s;
    display:flex; flex-direction:column;
    box-shadow:0 4px 12px rgba(31,38,135,0.06);
}
.pos-prod-card:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(31,38,135,0.12); }
.pos-prod-card.disabled { opacity:0.55; cursor:not-allowed; }
.pos-prod-media { aspect-ratio:1/1; background:linear-gradient(135deg,#64748b,#94a3b8); position:relative; overflow:hidden; }
.pos-prod-img {
    width:100%; height:100%; object-fit:cover; object-position:center top;
    display:block;
}
.pos-prod-tile { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
.pos-prod-tile span { font-size:2.4rem; font-weight:800; color:rgba(255,255,255,0.9); }
.pos-prod-info { padding:8px 10px 10px; display:flex; flex-direction:column; gap:4px; }
.pos-prod-name { font-size:0.8rem; font-weight:600; color:#0f172a; line-height:1.25; min-height:2em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.pos-prod-meta { display:flex; gap:4px; flex-wrap:wrap; min-height:18px; align-items:center; }
.pos-badge { font-size:0.62rem; font-weight:700; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; line-height:1.2; }
.pos-badge-kat { background:#e0f2fe; color:#0369a1; }
.pos-badge-jasa { background:#d1fae5; color:#065f46; }
.pos-badge-recipe { background:#fef3c7; color:#92400e; }
.pos-badge-recipe-fnb { background:#cffafe; color:#0e7490; }
.pos-badge-varian { background:#ede9fe; color:#6d28d9; }
.pos-prod-price { font-size:0.85rem; font-weight:700; color:#667eea; }
.pos-prod-habis {
    position:absolute; inset:auto 0 0 0; background:rgba(15,23,42,0.75); color:#fff;
    text-align:center; padding:3px; font-size:0.7rem; font-weight:700;
}
.pos-prod-add {
    position:absolute; top:6px; right:6px; width:22px; height:22px; border-radius:50%;
    background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); color:#fff; display:flex; align-items:center; justify-content:center;
    font-size:0.95rem; font-weight:700; box-shadow:0 2px 8px rgba(108, 86, 231, 0.4);
}
.pos-empty { grid-column:1/-1; text-align:center; padding:40px 0; color:#94a3b8; font-size:0.85rem; }
.pos-produk-pager { display:flex; justify-content:center; gap:4px; flex-wrap:wrap; flex-shrink:0; }
.pos-page-btn {
    padding:4px 10px; border:1px solid #cbd5e1; border-radius:6px; background:#fff;
    color:#334155; font-size:0.75rem; cursor:pointer; transition:all 0.15s;
}
.pos-page-btn:hover { border-color:#667eea; color:#667eea; }
.pos-page-btn.active { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); border-color:transparent; color:#fff; font-weight:700; }

/* Kanan: Bill */
.pos-bill {
    width:20%; min-width:250px; background:rgba(255,255,255,0.72); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    border-left:1px solid rgba(255,255,255,0.5);
    padding:14px 16px;
    display:flex; flex-direction:column; gap:10px;
    /* min-height:0 + overflow-y:auto → bila isi kolom bill melebihi tinggi
       panel (mis. layout desktop di tablet landscape), kolom discroll
       internal — bayar/checkout selalu terjangkau, tidak terpotong. */
    min-height:0; overflow-y:auto;
}
/* Tombol scroll ▲/▼ kolom bill — mengambang di tepi kanan, discroll per
   langkah (smooth). Disabled otomatis saat di ujung atas/bawah. HP: hidden. */
.pos-bill-scroll {
    position:absolute; right:10px; top:50%; transform:translateY(-50%);
    display:flex; flex-direction:column; gap:8px; z-index:20;
}
.pos-bill-scroll-btn {
    width:30px; height:30px; border-radius:8px; border:1px solid #cbd5e1;
    background:rgba(255,255,255,0.92); color:#334155; cursor:pointer;
    font-size:0.7rem; line-height:1; display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,0.15); transition:all 0.15s;
}
.pos-bill-scroll-btn:hover:not(:disabled) { background:#fff; color:#667eea; border-color:#667eea; }
.pos-bill-scroll-btn:disabled { opacity:0.35; cursor:default; }
[data-theme="dark"] .pos-bill-scroll-btn { background:#1e293b; border-color:#475569; color:#e2e8f0; }
[data-theme="dark"] .pos-bill-scroll-btn:hover:not(:disabled) { color:#93c5fd; border-color:#667eea; }
@media (max-width: 767px) { .pos-bill-scroll { display:none; } }
.pos-bill-title { margin:0; font-size:1.1rem; font-weight:700; color:#0f172a; }
.pos-bill-header { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-shrink:0; }
/* Item terpilih memakai tinggi NATURAL (semua item tampil, tidak dibatasi
   max-height & tidak discroll sendiri) — yang discroll adalah SELURUH kolom
   bill (overflow-y:auto di .pos-bill), termasuk summary + checkout. Saat
   item sedikit, flex:1 membuat area item mengisi sisa (checkout tetap di
   bawah); saat item banyak, kolom bill discroll utuh. */
.pos-keranjang { flex:1; border-bottom:1px dashed #cbd5e1; padding-bottom:4px; }
.pos-cart-empty { text-align:center; color:#94a3b8; font-size:0.8rem; padding:18px 0; }
.pos-cart-item { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; padding:7px 0; border-bottom:1px solid #f1f5f9; }
.pos-cart-name { font-size:0.78rem; font-weight:600; color:#0f172a; line-height:1.3; }
.pos-cart-qty { display:flex; align-items:center; gap:6px; margin-top:4px; }
.pos-qty-btn {
    width:20px; height:20px; border-radius:5px; border:1px solid #cbd5e1; background:#f1f5f9;
    color:#334155; font-size:0.8rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center;
    transition:all 0.12s;
}
.pos-qty-btn:hover { background:#e2e8f0; }
.pos-qty-val { font-size:0.82rem; font-weight:700; min-width:18px; text-align:center; color:#0f172a; }
.pos-cart-sub { font-size:0.68rem; color:#94a3b8; }
.pos-cart-right { text-align:right; }
.pos-cart-price { font-size:0.78rem; font-weight:700; color:#0f172a; }
.pos-cart-remove { border:0; background:none; cursor:pointer; font-size:0.72rem; color:#ef4444; padding:2px 0 0; opacity:0.7; }
.pos-cart-remove:hover { opacity:1; }

.pos-bill-summary { display:flex; flex-direction:column; gap:3px; flex-shrink:0; }
.pos-bill-row { display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#475569; }
.pos-bill-tax { justify-content:space-between; }
.pos-bill-meta { gap:8px; }
.pos-bill-meta label { font-size:0.75rem; color:#475569; white-space:nowrap; }
.pos-metode-select {
    padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.78rem;
    background:#fff; color:#0f172a; outline:none; cursor:pointer;
}
.pos-bill-row input[type="text"], .pos-catatan-input {
    width:96px; padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px;
    text-align:right; font-size:0.8rem; outline:none; color:#0f172a;
}
.pos-catatan-input { width:100%; text-align:left; font-size:0.75rem; }
/* ── PRD V1 §7.5 — Hold / Resume transaksi ── */
.pos-hold-actions { display:flex; gap:8px; }
.pos-hold-row { display:flex; gap:8px; width:100%; }
.pos-hold-btn {
    flex:1; padding:6px; border:1px dashed #f59e0b; border-radius:8px; background:#fffbeb;
    color:#b45309; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;
}
.pos-hold-btn:hover:not(:disabled) { background:#fef3c7; }
.pos-hold-btn:disabled { opacity:0.5; cursor:not-allowed; }
.pos-cancel-btn {
    flex:1; padding:6px; border:1px dashed #ef4444; border-radius:8px; background:#fef2f2;
    color:#b91c1c; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;
}
.pos-cancel-btn:hover:not(:disabled) { background:#fee2e2; }
.pos-cancel-btn:disabled { opacity:0.5; cursor:not-allowed; }
.pos-held-row { width:100%; margin-top:8px; }
.pos-held-badge {
    width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px;
    background:#f8fafc; color:#475569; font-size:0.78rem; font-weight:600; cursor:pointer;
    transition:all 0.15s;
}
.pos-held-badge:hover { border-color:#667eea; color:#4338ca; background:#eef2ff; }
.pos-held-list { display:flex; flex-direction:column; gap:8px; max-height:380px; overflow-y:auto; }
.pos-held-item {
    display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
    border:1px solid var(--border, #e2e8f0); border-radius:8px; padding:10px;
}
.pos-held-info { min-width:0; }
.pos-held-nomor { font-size:0.82rem; font-weight:700; color:#0f172a; }
.pos-held-time { font-size:0.68rem; color:#94a3b8; font-weight:400; margin-left:6px; }
.pos-held-items { font-size:0.72rem; color:#64748b; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:360px; }
.pos-held-total { font-size:0.74rem; font-weight:600; color:#047857; margin-top:3px; }
.pos-held-actions { display:flex; gap:6px; flex-shrink:0; }
[data-theme="dark"] .pos-hold-btn { background:#451a03; border-color:#f59e0b; color:#fcd34d; }
[data-theme="dark"] .pos-hold-btn:hover:not(:disabled) { background:#78350f; }
[data-theme="dark"] .pos-cancel-btn { background:#450a0a; border-color:#ef4444; color:#fca5a5; }
[data-theme="dark"] .pos-cancel-btn:hover:not(:disabled) { background:#7f1d1d; }
[data-theme="dark"] .pos-held-badge { background:#0f172a; border-color:#334155; color:#cbd5e1; }
[data-theme="dark"] .pos-held-item { border-color:#334155; }
[data-theme="dark"] .pos-held-nomor { color:#f1f5f9; }

/* Widget shift (PRD V1 §12) */
#pos-shift-widget { display:flex; }
.pos-shift-btn {
    width:100%; padding:8px; border:1px dashed #667eea; border-radius:8px; background:#eef2ff;
    color:#047857; font-size:0.78rem; font-weight:600; cursor:pointer; transition:all 0.15s;
}
.pos-shift-btn:hover { background:#d1fae5; }
.pos-shift-btn-close { border-color:#f59e0b; background:#fffbeb; color:#b45309; }
.pos-shift-btn-close:hover { background:#fef3c7; }
.pos-shift-active {
    display:flex; flex-direction:column; gap:6px; width:100%; padding:7px 9px;
    border:1px solid #a7f3d0; border-radius:8px; background:#ecfdf5; font-size:0.72rem; color:#065f46;
}
.pos-shift-row { display:flex; align-items:center; gap:6px; min-width:0; }
.pos-shift-dot { width:8px; height:8px; border-radius:50%; background:#667eea; flex-shrink:0; animation:pos-pulse 1.6s infinite; }
@keyframes pos-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
.pos-shift-txt { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pos-shift-active .pos-shift-btn { width:auto; padding:5px 9px; flex-shrink:0; align-self:center; }
.pos-shift-omzet-row { margin-top:2px; padding-top:6px; border-top:1px dashed #a7f3d0; }
.pos-shift-omzet-val { flex-shrink:0; font-size:0.78rem; font-weight:700; color:#065f46; }
[data-theme="dark"] .pos-shift-omzet-row { border-top-color:#047857; }
[data-theme="dark"] .pos-shift-omzet-val { color:#a7f3d0; }
.pos-modal-hint { margin:0; font-size:0.85rem; color:#6b7280; }
[data-theme="dark"] .pos-shift-btn { background:#1e1b4b; border-color:#667eea; color:#a5b4fc; }
[data-theme="dark"] .pos-shift-btn:hover { background:#047857; color:#fff; }
[data-theme="dark"] .pos-shift-active { background:#1e1b4b; border-color:#4338ca; color:#c7d2fe; }
[data-theme="dark"] .pos-shift-btn-close { background:#451a03; border-color:#f59e0b; color:#fcd34d; }
.pos-bill-bayar input {
    width:96px; padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px;
    text-align:right; font-size:0.8rem; outline:none; color:#0f172a;
}
.pos-bill-bayar input:focus { border-color:#667eea; box-shadow:0 0 0 3px rgba(102,126,234,0.18); }
.pos-bill-total { border-top:2px solid #0f172a; padding-top:6px; margin-top:2px; font-weight:800; color:#0f172a; font-size:0.9rem; }
.pos-checkout-btn {
    width:100%; padding:7px; border:0; border-radius:8px; cursor:pointer;
    background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); color:#fff; font-size:0.85rem; font-weight:700;
    display:flex; align-items:center; justify-content:center; gap:6px;
    box-shadow:0 6px 16px rgba(72, 106, 224, 0.35);
    transition:background 0.15s, transform 0.1s, box-shadow 0.15s;
}
.pos-checkout-btn:hover:not(:disabled) { background:linear-gradient(135deg, #a935f4 0%, #3f80ff 100%); box-shadow:0 8px 20px rgba(72, 106, 224, 0.45); }
.pos-checkout-btn:active:not(:disabled) { transform:scale(0.98); }
.pos-checkout-btn:disabled { background:#cbd5e1; color:#64748b; cursor:not-allowed; box-shadow:none; }
.pos-checkout-btn.ready { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); color:#fff; }
.pos-spinner {
    display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3);
    border-top-color:#fff; border-radius:50%; animation:pos-spin 0.8s linear infinite;
}
@keyframes pos-spin { to { transform:rotate(360deg); } }

/* ── Dark mode kasir (ikuti tema admin [data-theme="dark"]) ──
   Header & panel kategori sudah tema-aware (var(--topbar-bg) + gradient
   emerald). Override di bawah menyesuaikan area produk/bill/kart. */
[data-theme="dark"] .pos-produk { background:var(--content-bg, #0f172a); border-left-color:#1e293b; border-right-color:#1e293b; }
[data-theme="dark"] .pos-produk-head h2 { color:#f1f5f9; }
[data-theme="dark"] .pos-produk-head input { background:#334155; border-color:#475569; color:#f1f5f9; }
[data-theme="dark"] .pos-produk-head input::placeholder { color:#94a3b8; }
[data-theme="dark"] .pos-prod-card { background:#1e293b; border-color:#334155; }
[data-theme="dark"] .pos-prod-card:hover { box-shadow:0 8px 20px rgba(0,0,0,0.45); }
[data-theme="dark"] .pos-prod-name { color:#f1f5f9; }
[data-theme="dark"] .pos-prod-price { color:#34d399; }
[data-theme="dark"] .pos-bill { background:rgba(30,41,59,0.85); border-color:rgba(255,255,255,0.06); }
[data-theme="dark"] .pos-bill-title { color:#f1f5f9; }
[data-theme="dark"] .pos-keranjang { border-bottom-color:#334155; }
[data-theme="dark"] .pos-cart-empty { color:#64748b; }
[data-theme="dark"] .pos-cart-item { border-bottom-color:#1f2937; }
[data-theme="dark"] .pos-cart-name { color:#f1f5f9; }
[data-theme="dark"] .pos-cart-price { color:#f1f5f9; }
[data-theme="dark"] .pos-cart-sub { color:#64748b; }
[data-theme="dark"] .pos-qty-btn { background:#334155; border-color:#475569; color:#e2e8f0; }
[data-theme="dark"] .pos-qty-btn:hover { background:#475569; }
[data-theme="dark"] .pos-qty-val { color:#f1f5f9; }
[data-theme="dark"] .pos-bill-row { color:#94a3b8; }
[data-theme="dark"] .pos-bill-bayar input { background:#334155; border-color:#475569; color:#f1f5f9; }
[data-theme="dark"] .pos-metode-select { background:#334155; border-color:#475569; color:#f1f5f9; }
[data-theme="dark"] .pos-bill-row input[type="text"], [data-theme="dark"] .pos-catatan-input { background:#334155; border-color:#475569; color:#f1f5f9; }

[data-theme="dark"] .pos-badge-recipe { background:#78350f; color:#fcd34d; }
[data-theme="dark"] .pos-badge-recipe-fnb { background:#155e75; color:#a5f3fc; }
[data-theme="dark"] .pos-badge-varian { background:#4c1d95; color:#ddd6fe; }
[data-theme="dark"] .pos-varian-row { background:#1e293b; border-color:#475569; }
[data-theme="dark"] .pos-varian-row span:first-child { color:#f1f5f9; }
[data-theme="dark"] .pos-bill-total { border-top-color:#475569; color:#f1f5f9; }
[data-theme="dark"] .pos-cart-remove { color:#f87171; }
[data-theme="dark"] .pos-empty { color:#64748b; }
[data-theme="dark"] .pos-page-btn { background:#1e293b; border-color:#475569; color:#cbd5e1; }
[data-theme="dark"] .pos-page-btn:hover { border-color:#667eea; color:#93c5fd; }
[data-theme="dark"] .pos-page-btn.active { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); border-color:transparent; color:#fff; }
[data-theme="dark"] .pos-checkout-btn:disabled { background:#334155; color:#64748b; }
[data-theme="dark"] .pos-badge-kat { background:#0c4a6e; color:#7dd3fc; }
[data-theme="dark"] .pos-badge-jasa { background:#1e1b4b; color:#a5b4fc; }

/* M6-FIX v3 — aksi Buka Shift wajib: Buka Shift 49% + Logout 49% (spasi 2%) */
.shift-open-actions { display:flex; gap:2%; width:100%; }
.shift-open-actions .smart-btn { margin:0; }

/* M6-FIX v3 — Ringkasan Tutup Shift (saldo awal, tunai, non-tunai) */
.shift-summary {
    display:grid; gap:6px;
    border:1px solid var(--border,#e2e8f0); border-radius:8px;
    padding:10px 12px; margin-bottom:10px; background:#f8fafc;
}
[data-theme="dark"] .shift-summary { background:#0f172a; border-color:#334155; }
.shift-summary-row {
    display:flex; justify-content:space-between; gap:12px; font-size:13px;
    color:var(--text,#1e293b);
}
.shift-summary-row strong { font-variant-numeric:tabular-nums; }
.shift-summary-sub { padding-top:4px; border-top:1px dashed #cbd5e1; }
.shift-summary-refund { color:#dc2626; font-weight:600; }
.shift-summary-refund strong { color:#dc2626; }
.shift-summary-expected { padding-top:6px; border-top:1px solid #cbd5e1; font-weight:700; }
.shift-summary-expected strong { color:var(--primary,#667eea); }
.shift-selisih { margin-top:6px; font-size:13px; }
.shift-selisih-ok { color:#667eea; font-weight:600; }
.shift-selisih-warn { color:#b45309; font-weight:600; }
.shift-selisih-minus { color:#dc2626; }

/* M3-FIX v19 — jenis pelanggan (Member/Umum) + status pajak */
.pos-member-method { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; margin-bottom:10px; background:#f8fafc; }
.pos-member-method-title { font-size:0.8rem; font-weight:700; color:#0f172a; margin-bottom:6px; }
.pos-member-method .smart-input { width:100%; box-sizing:border-box; }
.pos-member-nfc-btn {
    width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;
    background:#fff; color:#0f172a; cursor:pointer; font-size:0.85rem; font-weight:600;
    transition:all 0.15s;
}
.pos-member-nfc-btn:hover:not(:disabled) { background:#eef2ff; border-color:#667eea; }
.pos-member-nfc-btn:disabled { opacity:0.6; cursor:not-allowed; }
.pos-member-nfc-status { font-size:0.75rem; color:#94a3b8; margin-top:6px; }
.pos-member-nfc-status.ok { color:#667eea; }
.pos-member-scan-row { display:flex; align-items:center; gap:8px; margin:10px 0 4px; }
.pos-member-scan-row .btn-scan {
    padding:8px 12px; border:1px solid #667eea; border-radius:8px; background:#eef2ff;
    color:#047857; font-size:0.9rem; font-weight:700; cursor:pointer; white-space:nowrap;
    transition:all 0.15s;
}
.pos-member-scan-row .btn-scan:hover { background:#d1fae5; }
.pos-member-scan-row .smart-input { flex:1; min-width:0; }
.pos-pelanggan-row { justify-content:space-between; align-items:center; gap:8px; }
.pos-bill-label { font-size:0.78rem; color:#475569; white-space:nowrap; }
.pos-pelanggan-type { display:flex; gap:6px; flex-shrink:0; }
.pos-type-btn {
    padding:4px 10px; border:1px solid #cbd5e1; border-radius:999px; background:#f8fafc;
    color:#475569; font-size:0.72rem; font-weight:600; cursor:pointer;
    transition:all 0.15s;
}
.pos-type-btn:hover { border-color:#667eea; color:#4338ca; }
.pos-type-btn.active { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); border-color:transparent; color:#fff; }
.pos-tax-status {
    font-size:0.75rem; font-weight:700; padding:2px 10px; border-radius:999px;
    background:#d1fae5; color:#065f46;
}
.pos-tax-status.off { background:#fef3c7; color:#92400e; }
[data-theme="dark"] .pos-type-btn { background:#1e293b; border-color:#334155; color:#cbd5e1; }
[data-theme="dark"] .pos-type-btn:hover { border-color:#667eea; color:#a5b4fc; }
[data-theme="dark"] .pos-type-btn.active { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); color:#fff; }
[data-theme="dark"] .pos-tax-status { background:#1e1b4b; color:#a5b4fc; }

/* Struk cetak */
@media print {
    body * { visibility:hidden; }
    #rcpt-print, #rcpt-print * { visibility:visible; }
    #rcpt-print {
        display:block !important; position:absolute; left:0; top:0; width:100%;
        padding:20px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
        color:#000; background:#fff;
    }
}

/* ── Responsive: TABLET (768–1100px) — sidebar pindah ke atas menjadi strip
   horizontal di bawah topbar (kategori digeser kanan 0,5cm dari judul), lalu
   daftar barang 80% + bill 20% di bawahnya ── */
@media (min-width: 768px) and (max-width: 1100px) {
    /* Grid (bukan flex-wrap): baris 1 = strip kategori (60px), baris 2 =
       produk (74.7%) + bill (25.3%). minmax(0,1fr) membuat baris 2 terikat
       ke sisa tinggi panel dengan NILAI PASTI di semua browser — flex-wrap
       lama mengikat tinggi baris ke tinggi KONTEN sehingga konten bawah
       terpotong & tidak bisa discroll (dan height:% pada flex item tidak
       selalu teresolusi, mis. Safari iPad). overflow-y:auto produk/bill
       sekarang benar-benar jalan. */
    .pos-body { display:grid; grid-template-rows:60px minmax(0,1fr); grid-template-columns:minmax(0,74.7%) minmax(0,25.3%); }
    .pos-kategori {
        grid-row:1; grid-column:1 / -1;
        flex:1 1 100%; width:100%; max-width:100%; min-width:0;
        height:60px; min-height:60px; max-height:60px;
        flex-direction:row; align-items:center; gap:8px;
        overflow-x:auto; overflow-y:hidden; padding:10px 14px;
    }
    .pos-panel-title { flex-shrink:0; margin:0; }
    .pos-kategori-list { flex-direction:row; overflow-x:auto; margin-left:0.5cm; }
    /* M3-FIX v23 — status bawah tidak relevan di strip (tersembunyi di mobile) */
    .pos-kategori-footer { display:none; }
    .pos-kat-btn { width:auto; white-space:nowrap; }
    /* Bill tablet diperlebar 115% (22% → 25.3%); produk mengisi sisa (74.7%) */
    .pos-produk { grid-row:2; grid-column:1; width:auto; max-width:none; min-width:0; min-height:0; border:0; }
    .pos-bill { grid-row:2; grid-column:2; width:auto; max-width:none; min-width:0; min-height:0; background:#f0f4f8; border:1px solid #d1d9e6; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
    /* F&B V1 — Order Meja: saat produk & bill disembunyikan, panel mengisi
       kedua kolom baris 2 (selebar area produk+bill, bukan 74.7% saja). */
    .pos-order-meja { grid-row:2; grid-column:1 / -1; min-height:0; }
    /* Kartu produk tablet: tetap 5 kartu per baris (kolom produk 78%) */
    .pos-produk-grid { grid-template-columns:repeat(5, 1fr); gap:8px; }
    /* Bill header tablet (kolom bill sempit 22%): judul "Bill" di baris atas,
       tombol Umum/Member di baris bawah — tidak saling menimpa */
    .pos-bill-header { flex-direction:column; align-items:stretch; }
    .pos-pelanggan-type { width:100%; }
    .pos-type-btn { flex:1; justify-content:center; }
    .pos-bill-title { align-self:flex-start; }
    /* Collapsed diabaikan di tablet (pola sidebar admin) — tetap strip horizontal */
    .pos-kategori.collapsed {
        grid-row:1; grid-column:1 / -1;
        width:100%; max-width:100%; min-width:0; height:60px; max-height:60px;
        padding:10px 14px; overflow-x:auto; overflow-y:hidden;
    }
    .pos-kategori.collapsed .pos-kategori-list { overflow-x:auto; margin-left:0.5cm; }
    .pos-kategori.collapsed .pos-panel-title { display:block; }
    .pos-kategori.collapsed .pos-kat-btn { justify-content:flex-start; padding:9px 10px; }
    .pos-kategori.collapsed .pos-kat-name { display:inline; }
    .pos-kategori.collapsed .pos-kat-btn::before,
    .pos-kategori.collapsed .pos-kat-btn::after { display:none; }
    /* F&B V1 — TABLET: Order Meja pindah ke TOP BAR (pola & icon sama dengan
       HP — 🍽️ icon-only di header); tombol di strip sidebar disembunyikan. */
    .pos-order-meja-btn { display:inline-flex; }
    .pos-kat-order-meja { display:none; }
    /* HP/Tablet — shift buka/tutup tampil sebagai icon di top bar (footer
       sidebar disembunyikan di tablet, jadi widget shift tidak terlihat). */
    .pos-shift-header-btn { display:inline-flex; }
}

/* ── Responsive: HP (<768px) — bill DISEMBUNYIKAN, daftar barang memenuhi
   seluruh halaman; produk yang dipilih masuk ikon keranjang (header), dan
   bill tampil sebagai overlay saat ikon keranjang diklik ── */
@media (max-width: 767px) {
    .pos-body { flex-direction:column; overflow-y:auto; }
    .pos-kategori {
        width:100%; min-width:0; flex-direction:row; align-items:center; gap:8px;
        overflow-x:auto; overflow-y:hidden; padding:8px 12px;
    }
    .pos-panel-title { flex-shrink:0; margin:0; }
    .pos-kategori-list { flex-direction:row; overflow-x:auto; margin-left:0.5cm; }
    .pos-kategori-footer { display:none; }
    .pos-kat-btn { width:auto; white-space:nowrap; }
    .pos-produk { width:100%; border:0; }
    /* Kartu produk HP: 3 kartu per baris */
    .pos-produk-grid { grid-template-columns:repeat(3, 1fr); gap:8px; }
    /* Header HP: kurangi padding & pastikan ikon keranjang + logout mepet kanan */
    .pos-header { padding:10px 10px; gap:8px; }
    .pos-header-hint { display:none; }
    .pos-header-right { gap:6px; }
    /* HP: nama perusahaan disembunyikan (tidak muat di samping tombol) */
    .pos-header-company { display:none; }
    /* Bill hidden — hanya tampil saat .bill-open (ikon keranjang diklik) */
    .pos-bill { display:none; }
    .pos-page.bill-open .pos-bill {
        display:flex; position:fixed; top:0; right:0; bottom:0; left:auto;
        /* Bill HP diperkecil 75% (88% → 66%, 400px → 300px) */
        width:min(66%, 300px); min-width:0; z-index:300;
        background:#f0f4f8; border:1px solid #d1d9e6; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); padding:14px 16px; overflow-y:auto;
        box-shadow:-10px 0 30px rgba(0,0,0,0.3); border-radius:12px 0 0 12px;
    }
    .pos-page.bill-open .pos-bill-close { display:inline-flex; }
    .pos-keranjang { max-height:none; }
    /* HP — tombol Umum/Member di baris BAWAH judul "Bill" (pola sama dengan
       tampilan tablet): judul di baris atas, tombol di baris bawah, melebar
       penuh & mepet kanan. Nama member yang panjang tidak lagi menimpa judul
       karena berada di baris terpisah. */
    .pos-bill-header { flex-direction:column; align-items:stretch; }
    .pos-pelanggan-type { width:100%; }
    .pos-type-btn { flex:1; justify-content:center; }
    .pos-bill-title { align-self:flex-start; }
    .pos-cart-btn { display:inline-flex; }
    /* F&B V1 — Order Meja HP: tombol pindah dari sidebar Kategori ke header
       (kanan lonceng), icon-only. Sidebar disembunyikan di HP. */
    .pos-order-meja-btn { display:inline-flex; }
    .pos-kat-order-meja { display:none; }
    /* HP/Tablet — shift buka/tutup tampil sebagai icon di top bar (footer
       sidebar disembunyikan di HP). */
    .pos-shift-header-btn { display:inline-flex; }
    /* Logout HP: icon saja (label disembunyikan), ukuran tombol mengikuti
       pola tombol icon lain di header (cart/bell/order meja). */
    .pos-logout-btn { padding:7px 11px; }
    .pos-logout-label { display:none; }
    /* SVG logout HP sedikit lebih besar agar proporsional sbg tombol icon */
    .pos-logout-btn .pos-logout-icon { width:18px; height:18px; }
    /* HP — perkecil ukuran icon & padding SEMUA tombol top bar (shift, cart,
       bell, order meja, logout) agar cluster kanan tidak mendorong hingga ke
       posisi logo/judul di kiri. Ukuran icon tablet & desktop TIDAK berubah. */
    .pos-header-right .pos-shift-header-btn,
    .pos-header-right .pos-cart-btn,
    .pos-header-right .pos-bell-btn,
    .pos-header-right .pos-order-meja-btn {
        padding:5px 8px; font-size:0.8rem; gap:4px;
    }
    .pos-header-right .pos-logout-btn { padding:5px 8px; }
    .pos-header-right .pos-logout-btn .pos-logout-icon { width:15px; height:15px; }
    /* Collapsed diabaikan di HP — tetap strip horizontal */
    .pos-kategori.collapsed { width:100%; min-width:0; padding:8px 12px; overflow-x:auto; overflow-y:hidden; }
    .pos-kategori.collapsed .pos-kategori-list { overflow-x:auto; margin-left:0.5cm; }
    .pos-kategori.collapsed .pos-panel-title { display:block; }
    .pos-kategori.collapsed .pos-kat-btn { justify-content:flex-start; padding:9px 10px; }
    .pos-kategori.collapsed .pos-kat-name { display:inline; }
    .pos-kategori.collapsed .pos-kat-btn::before,
    .pos-kategori.collapsed .pos-kat-btn::after { display:none; }
}
`;
}
