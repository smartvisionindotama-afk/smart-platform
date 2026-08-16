/**
 * Customer Menu Page — Mobile QR Menu (F&B Customer Ordering V1).
 *
 * Customer scan QR meja → https://pos.e-profit.id/m/{qrIdentifier} → halaman
 * ini (tanpa login/dashboard/desktop). Semua data di-resolve SERVER dari
 * qrIdentifier: company, lokasi, meja, produk, payment (QRIS/bank).
 *
 * Alur: SCAN QR → MENU → ADD TO CART → CART → BILL → PAYMENT METHOD →
 * CREATE ORDER (paymentStatus PENDING — tidak otomatis PAID).
 *
 *   - Tunai    : "Silakan lakukan pembayaran di kasir."
 *   - QRIS     : tampilkan QRIS Company (active) + konfirmasi ke kasir.
 *   - Transfer : tampilkan rekening aktif (maks 3) + konfirmasi ke kasir.
 *   - Card     : TIDAK ditampilkan.
 *
 * Setelah order: status order live (diterima → dibuat → siap) + tombol
 * "Beritahu saya saat pesanan siap" (Web Push — tanpa login/HP). Saat chef
 * menekan PESANAN SIAP → backend kirim push → notifikasi + suara/vibrate
 * (ikut capability browser/OS; jika ditolak, order tetap berjalan).
 *
 * @module pos/pages/customer-menu
 */

import { esc } from "@smart/core";
import {
    fetchQrMenu,
    createQrOrder,
    fetchQrOrderStatus,
    uploadQrOrderProof,
    fetchPushPublicKey,
    subscribeOrderPush
} from "../../data/customer-menu-data.js";
import { speak } from "../../utils/audio-notify.js";
import { buildWaCheckoutUrl, buildWaCheckoutMessage } from "../../utils/whatsapp.js";

// ── State ──
const state = {
    identifier: "",
    loading: true,
    error: "",
    menu: null,           // { company, table, produk[], kategori[], payment, taxEnabled }
    activeKategori: "Semua",
    cart: [],             // [{ productId, nama, kode, harga, qty, recipeId, skuKode, catatan }]
    view: "menu",         // menu | cart | payment | status
    paymentMethod: "cash",
    order: null,          // { orderId, orderToken, ... }
    pollTimer: null,
    notified: false,
    gate: null          // QR MENU GATE — null (lewat) | chrome | notif | denied | no-api | kasir
};

const KITCHEN_STEPS = [
    { key: "new", label: "Order diterima" },
    { key: "preparing", label: "Sedang dibuat" },
    { key: "ready", label: "Pesanan siap" }
];

function rupiah(n) {
    return "Rp " + (Number(n) || 0).toLocaleString("id-ID");
}

// ── Versi TAB (PWA landscape) ──
// Aktif bila URL memakai ?tab=1 (dibuka staff di tablet) ATAU preferensi
// tersimpan (cm-tab-mode). Dipakai untuk: (1) index.html mengganti manifest
// ke manifest-tablet.json (orientation: landscape — PWA terkunci landscape),
// (2) layout kiosk full-width (class cm-tab) — menu display / self-order.
function isTabMode() {
    try {
        if (new URLSearchParams(window.location.search).get("tab") === "1") {
            localStorage.setItem("cm-tab-mode", "1");
            return true;
        }
        return localStorage.getItem("cm-tab-mode") === "1";
    } catch {
        return false;
    }
}

// ── Page ──

export function CustomerMenuPage(identifier) {
    state.identifier = identifier || "";
    const tabMode = isTabMode();
    return `
        <div class="cm-root${tabMode ? " cm-tab" : ""}" id="cm-root">
            <style>${styles()}</style>
            <div id="cm-app">${state.loading ? `<div class="cm-loading"><span class="cm-spinner"></span> Memuat menu...</div>` : ""}</div>
        </div>
    `;
}

// ── Init ──

export async function initCustomerMenuPage() {
    const root = document.getElementById("cm-app");
    if (!root) return;

    // QR MENU GATE — reset state gate (state module-level; view status
    // ?order= TIDAK di-gate — reset di sini menjamin status selalu terbuka).
    state.gate = null;

    // F&B V1 — register service worker SEGERA (bukan hanya saat tombol
    // AKTIFKAN NOTIFIKASI diklik). SW yang aktif sejak awal = push tetap
    // diterima walau browser ditutup, dan alur enable jadi lebih cepat.
    registerServiceWorker();

    // Deep-link: ?order=<orderToken> → langsung tampilkan status order
    const params = new URLSearchParams(window.location.search);
    const orderToken = params.get("order");

    try {
        state.menu = await fetchQrMenu(state.identifier);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat menu. Silakan coba lagi.";
        render();
        return;
    }

    if (orderToken) {
        state.order = { orderToken };
        state.view = "status";
        state.loading = false;
        render();
        // Customer kembali ke status order (mis. dari notifikasi / setelah
        // browser ditutup): RE-BIND subscription push ke order ini (server
        // upsert per company+order+endpoint — idempotent). Sebelumnya hanya
        // mengecek keberadaan subscription LOKAL: bila server sudah menghapus
        // subscription (410/404/VAPID mismatch), halaman mengklaim "notifikasi
        // aktif" padahal order tsb 0 subscription → push tidak pernah sampai.
        // autoEnableNotification: bind ulang yang ada ATAU buat baru bila
        // permission granted; state.notified mencerminkan hasil sebenarnya.
        autoEnableNotification().then(() => {
            if (document.getElementById("cm-root")) render();
        }).catch(() => { /* non-blokir — tombol manual tetap tersedia */ });
        startStatusPolling();
        return;
    }

    // QR MENU GATE — browser & notifikasi (Chrome-first): customer yang akan
    // ORDER wajib lewat gate dulu sebelum menu tampil (lihat renderGate).
    // View status (?order=) di atas TIDAK di-gate — customer tsb sudah
    // melewati gate saat memesan dan datang dari notifikasi/deep-link utk
    // melihat status pesanan.
    // F&B V2 — company dengan nomor WA (Settings → Company): checkout via
    // WhatsApp, jadi gate notifikasi (Chrome-first) TIDAK diperlukan —
    // customer langsung masuk menu web. Tanpa nomor WA → alur lama (gate
    // Chrome/notifikasi + order web + push).
    state.gate = waCheckoutEnabled() ? null : computeGate();
    state.loading = false;
    state.view = "menu";
    render();
}

// ── Render ──

function render() {
    const app = document.getElementById("cm-app");
    if (!app) return;

    if (state.loading) {
        app.innerHTML = `<div class="cm-loading"><span class="cm-spinner"></span> Memuat menu...</div>`;
        return;
    }
    if (state.error) {
        app.innerHTML = `
            <div class="cm-card cm-center">
                <div style="font-size:3rem">🍽️</div>
                <h2>${esc(state.error)}</h2>
                <button class="cm-btn cm-btn-primary" id="cm-retry">Coba Lagi</button>
            </div>
        `;
        const retry = app.querySelector("#cm-retry");
        if (retry) retry.addEventListener("click", () => window.location.reload());
        return;
    }
    if (!state.menu) return;

    // QR MENU GATE — tampil SEBELUM menu (alur order QR Menu).
    if (state.gate) {
        renderGate(app);
        return;
    }

    if (state.view === "menu") renderMenu(app);
    else if (state.view === "cart") renderCart(app);
    else if (state.view === "payment") renderPayment(app);
    else if (state.view === "wa-sent") renderWaSent(app);
    else if (state.view === "status") renderStatus(app);
}

// Timer order WA — order dibuat OTOMATIS setelah delay (customer tidak perlu
// kembali ke web; delay memberi waktu menekan Send di WhatsApp).
let waOrderTimer = null;
const WA_ORDER_DELAY_MS = 15000;

function headerHTML() {
    const m = state.menu;
    const cartCount = state.cart.reduce((s, i) => s + i.qty, 0);
    // F&B V1 — bell notifikasi customer: tampil bila ada order (status order
    // dipoll → event turunan: order diterima/dibuat/siap + bukti & pembayaran).
    const hasOrder = !!(state.order && state.order.orderToken);
    const unread = hasOrder ? unreadEventCount() : 0;
    return `
        <header class="cm-header">
            <div class="cm-header-left">
                <div class="cm-company">${esc((m.company && m.company.name) || "")}</div>
                <div class="cm-meja">${esc(m.table && m.table.nomorMeja)}</div>
            </div>
            <div class="cm-header-right">
                ${hasOrder ? `<button class="cm-bell-btn" id="cm-bell-btn" aria-label="Notifikasi order">🔔<span class="cm-bell-count" id="cm-bell-count" style="${unread ? "" : "display:none"}">${unread}</span></button>` : ""}
                <button class="cm-cart-fab" id="cm-cart-btn" aria-label="Keranjang">
                    🛒<span class="cm-cart-count" id="cm-cart-count">${cartCount}</span>
                </button>
            </div>
        </header>
    `;
}

function renderMenu(app) {
    const m = state.menu;
    const list = state.activeKategori === "Semua"
        ? m.produk
        : m.produk.filter(p => p.kategori === state.activeKategori);

    app.innerHTML = `
        ${headerHTML()}
        <div class="cm-categories">
            ${["Semua", ...m.kategori].map(k => `
                <button class="cm-cat ${state.activeKategori === k ? "active" : ""}" data-cat="${esc(k)}">${esc(k)}</button>
            `).join("")}
        </div>
        <div class="cm-products">
            ${list.map(p => productCard(p)).join("")}
        </div>
        ${state.cart.length ? `<div class="cm-bill-bar"><button class="cm-btn cm-btn-primary" id="cm-to-cart">🛒 Lihat Bill · ${rupiah(cartTotal())}</button></div>` : ""}
    `;
    app.querySelectorAll("[data-cat]").forEach(btn => btn.addEventListener("click", () => {
        state.activeKategori = btn.dataset.cat;
        render();
    }));
    // M6-FIX — SELURUH area kartu produk dapat diklik (bukan hanya tombol +):
    // kartu punya data-add + dukungan keyboard (Enter/Space) agar aksesibel.
    app.querySelectorAll("[data-add]").forEach(el => {
        el.addEventListener("click", () => addProduct(el.dataset.add));
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                addProduct(el.dataset.add);
            }
        });
    });
    app.querySelector("#cm-cart-btn")?.addEventListener("click", () => { state.view = "cart"; render(); });
    app.querySelector("#cm-to-cart")?.addEventListener("click", () => { state.view = "cart"; render(); });
    bindCustomerBell(app);
}

/** F&B V2 — company punya nomor WA valid → checkout via WhatsApp. */
function waCheckoutEnabled() {
    const m = state.menu || {};
    return buildWaCheckoutUrl(m.company, m.table, state.cart) ? true : false;
}

function productCard(p) {
    const hasVarian = (Array.isArray(p.variants) && p.variants.length) || (Array.isArray(p.skus) && p.skus.length);
    const varianTerendah = hasVarian
        ? Math.min(
            ...(p.variants || []).map(v => Number(v.harga) || 0),
            ...(p.skus || []).map(s => Number(s.harga) || 0)
        )
        : 0;
    const displayHarga = varianTerendah > 0 ? varianTerendah : (Number(p.harga) || 0);
    const noStock = ["service", "recipe", "recipe-fnb"].includes(p.behavior);
    const habis = !noStock && (Number(p.stok) || 0) <= 0 && !(p.skus && p.skus.length);
    // M6-FIX — kartu utuh bisa diklik (data-add di CARD, bukan tombol):
    // klik area mana pun = tambah ke keranjang (produk ber-varian tetap
    // membuka modal pilih varian). Kartu "Habis" TIDAK bisa diklik.
    return `
        <div class="cm-product ${habis ? "cm-product-habis" : ""}" ${habis ? "" : `data-add="${esc(String(p.id))}" role="button" tabindex="0" aria-label="Tambah ${esc(p.nama)} ke keranjang"`}>
            ${p.foto ? `<img class="cm-product-img" src="${esc(p.foto)}" alt="${esc(p.nama)}" loading="lazy" />` : `<div class="cm-product-img cm-product-img-ph">${esc((p.kategori || "").slice(0, 1))}</div>`}
            <div class="cm-product-body">
                <div class="cm-product-name">${esc(p.nama)}</div>
                ${p.deskripsi ? `<div class="cm-product-desc">${esc(p.deskripsi)}</div>` : ""}
                <div class="cm-product-foot">
                    <span class="cm-product-price">${rupiah(displayHarga)}${hasVarian ? " <small>mulai</small>" : ""}</span>
                    ${habis ? `<span class="cm-habis">Habis</span>` : `<span class="cm-add-btn" aria-hidden="true">+</span>`}
                </div>
            </div>
        </div>
    `;
}

function cartTotal() {
    const subtotal = state.cart.reduce((s, i) => s + i.harga * i.qty, 0);
    const tax = (state.menu && state.menu.taxEnabled) ? subtotal * 0.11 : 0;
    return subtotal + tax;
}

function renderCart(app) {
    // F&B V2 — checkout via WhatsApp bila company punya nomor WA.
    const useWaCheckout = waCheckoutEnabled();
    app.innerHTML = `
        ${headerHTML()}
        <div class="cm-section">
            <h2 class="cm-section-title">🛒 Keranjang</h2>
            ${state.cart.length === 0 ? `<p class="cm-muted">Keranjang kosong — tambahkan produk dari menu.</p>` : ""}
            ${state.cart.map((i, idx) => `
                <div class="cm-cart-item">
                    <div class="cm-cart-info">
                        <div class="cm-cart-name">${esc(i.nama)}</div>
                        ${i.catatan ? `<div class="cm-cart-note">📝 ${esc(i.catatan)}</div>` : ""}
                        <div class="cm-cart-price">${rupiah(i.harga)}</div>
                    </div>
                    <div class="cm-qty">
                        <button class="cm-qty-btn" data-dec="${idx}">−</button>
                        <span class="cm-qty-val">${i.qty}</span>
                        <button class="cm-qty-btn" data-inc="${idx}">+</button>
                    </div>
                </div>
            `).join("")}
            ${state.cart.length ? `
                <div class="cm-bill">
                    <div class="cm-bill-row"><span>Total</span><strong>${rupiah(cartTotal())}</strong></div>
                </div>
                ${useWaCheckout ? `
                    <div class="cm-wa-nama">
                        <label for="cm-wa-nama">Nama Anda (opsional)</label>
                        <input type="text" id="cm-wa-nama" placeholder="Nama — biar kasir tahu siapa pemesannya" autocomplete="name" />
                    </div>
                    <div class="cm-wa-nama">
                        <label for="cm-wa-phone">No. WhatsApp Anda <span style="color:#dc2626">*</span></label>
                        <input type="tel" id="cm-wa-phone" placeholder="08xx — wajib diisi untuk menerima status pesanan" autocomplete="tel" inputmode="tel" required />
                    </div>
                ` : ""}
                <div style="display:flex;gap:8px;margin-top:14px">
                    <button class="cm-btn cm-btn-secondary" id="cm-back-menu">← Menu</button>
                    ${useWaCheckout
                        ? `<button class="cm-btn cm-btn-wa" id="cm-wa-checkout" style="flex:1">💬 KIRIM PESANAN VIA WHATSAPP</button>`
                        : `<button class="cm-btn cm-btn-primary" id="cm-to-payment" style="flex:1">Lanjut ke Pembayaran →</button>`}
                </div>
                ${useWaCheckout ? `<p class="cm-muted" style="font-size:0.74rem;line-height:1.5;margin-top:10px">WhatsApp restoran akan terbuka dengan pesanan Anda — tinggal tekan <strong>Send</strong>. Status pesanan (diterima, siap, batal) dikirim otomatis ke <strong>No. WhatsApp Anda</strong>.</p>` : ""}
            ` : `<button class="cm-btn cm-btn-secondary" id="cm-back-menu">← Kembali ke Menu</button>`}
        </div>
    `;
    app.querySelector("#cm-cart-btn")?.addEventListener("click", () => { state.view = "cart"; render(); });
    app.querySelector("#cm-back-menu")?.addEventListener("click", () => { state.view = "menu"; render(); });
    bindCustomerBell(app);
    app.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => { state.cart[Number(b.dataset.inc)].qty++; renderCart(app); }));
    app.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => {
        const idx = Number(b.dataset.dec);
        if (state.cart[idx].qty > 1) state.cart[idx].qty--;
        else state.cart.splice(idx, 1);
        renderCart(app);
    }));
    app.querySelector("#cm-wa-checkout")?.addEventListener("click", () => waCheckout());
    app.querySelector("#cm-to-payment")?.addEventListener("click", () => { state.view = "payment"; render(); });
}

/**
 * F&B V2 — KIRIM PESANAN VIA WHATSAPP.
 * Buka wa.me nomor restoran dgn pesan order otomatis (meja, item, total,
 * nama, no. WA). Order TIDAK dibuat langsung: dibuat OTOMATIS ±25 detik
 * setelah tombol diklik (cukup waktu customer menekan Send di WhatsApp) —
 * jadi notifikasi "pesanan diterima" tidak mendahului kiriman customer.
 */
function waCheckout() {
    const nama = String(document.getElementById("cm-wa-nama")?.value || "").trim();
    const phone = String(document.getElementById("cm-wa-phone")?.value || "").trim();
    // No. WA customer WAJIB — dipakai kirim status order (diterima/siap/batal)
    // via WhatsApp. Tanpa nomor, notifikasi status tidak bisa dikirim.
    if (!phone || phone.replace(/[^\d]/g, "").length < 9) {
        return showError("No. WhatsApp wajib diisi — status pesanan (diterima, siap, batal) akan dikirim ke nomor ini.");
    }
    const m = state.menu || {};
    const waItems = state.cart.map(i => ({ nama: i.nama, qty: i.qty, harga: i.harga }));
    // Pesan & URL wa.me dari KERANJANG (order belum dibuat — baru setelah delay).
    const waUrl = buildWaCheckoutUrl(m.company, m.table, waItems, {
        taxEnabled: !!m.taxEnabled,
        nama,
        waPhone: phone
    });
    const message = buildWaCheckoutMessage(m.company, m.table, waItems, {
        taxEnabled: !!m.taxEnabled,
        nama,
        waPhone: phone
    });

    state.pendingWa = { nama, phone, waUrl, message };
    state.view = "wa-sent";
    render();
    openWaUrl(waUrl);

    // Order dibuat OTOMATIS setelah delay — customer tidak perlu kembali ke web.
    if (waOrderTimer) clearTimeout(waOrderTimer);
    waOrderTimer = setTimeout(() => {
        waOrderTimer = null;
        confirmWaOrderSent();
    }, WA_ORDER_DELAY_MS);
}

/** Buka wa.me (popup). Bila diblokir — tombol manual tersedia di layar. */
function openWaUrl(waUrl) {
    if (!waUrl) return;
    try {
        const win = window.open(waUrl, "_blank");
        if (!win) {
            showError("WhatsApp tidak terbuka otomatis — ketuk tombol 'Buka WhatsApp' di bawah.");
        }
    } catch { /* ignore */ }
}

/** Layar perantara: WhatsApp terbuka + pesan preview + tombol buka/batal. */
function renderWaSent(app) {
    const p = state.pendingWa || {};
    app.innerHTML = `
        ${headerHTML()}
        <div class="cm-section">
            <style>
            .cm-wa-card { border:1px solid var(--cm-border); border-radius:14px; background:#fff; padding:16px; margin-bottom:12px; }
            .cm-wa-step { font-size:0.88rem; line-height:1.55; color:var(--cm-text,#0f172a); margin-bottom:8px; }
            .cm-wa-preview pre { background:#f8fafc; border:1px solid var(--cm-border); border-radius:10px; padding:12px; font-size:0.78rem; line-height:1.5; white-space:pre-wrap; word-break:break-word; margin:10px 0 0; color:#334155; }
            .cm-btn-wa { background:#25d366 !important; color:#fff !important; }
            </style>
            <h2 class="cm-section-title">📲 Kirim Pesanan via WhatsApp</h2>
            <div class="cm-wa-card">
                <div class="cm-wa-step">💬 WhatsApp restoran telah dibuka — tekan <strong>Send</strong> untuk mengirim pesanan.</div>
                <div class="cm-wa-step">⏳ Pesanan akan dibuat otomatis dalam ±25 detik. Anda tidak perlu kembali ke halaman ini.</div>
                ${p.waUrl ? `<button class="cm-btn cm-btn-wa" id="cm-wa-open" style="width:100%">💬 Buka WhatsApp</button>` : ""}
                <div class="cm-wa-preview"><pre>${esc(p.message || "")}</pre></div>
            </div>
            <button class="cm-btn cm-btn-secondary" id="cm-wa-cancel" style="width:100%">Batal — kembali ke keranjang</button>
        </div>
    `;
    app.querySelector("#cm-wa-open")?.addEventListener("click", () => openWaUrl(p.waUrl));
    app.querySelector("#cm-wa-cancel")?.addEventListener("click", () => {
        if (waOrderTimer) { clearTimeout(waOrderTimer); waOrderTimer = null; }
        state.pendingWa = null;
        state.view = "cart";
        render();
    });
}

/**
 * BUAT ORDER DI SISTEM (dipanggil otomatis setelah delay) — persis seperti
 * order web: masuk kitchen otomatis (bell dapur), nomor order asli dari
 * server, status bisa dipantau. TIDAK ADA input manual staf.
 */
async function confirmWaOrderSent() {
    const p = state.pendingWa;
    if (!p || (state.order && state.order.orderToken)) return; // guard double
    try {
        const items = state.cart.map(i => ({
            productId: i.productId,
            qty: i.qty,
            recipeId: i.recipeId || "",
            skuKode: i.skuKode || "",
            catatan: i.catatan || ""
        }));
        const res = await createQrOrder(state.identifier, items, "cash", "", p.phone);
        state.order = res.order;
        try {
            const u = new URL(window.location.href);
            u.searchParams.set("order", res.order.orderToken);
            window.history.replaceState({}, "", u.toString());
        } catch { /* URL tidak dapat diubah — non-blokir */ }
        state.cart = [];
        state.pendingWa = null;
        state.view = "status";
        render();
        startStatusPolling();
        // Web push TETAP aktif sebagai cadangan (auto-subscribe bila diizinkan).
        autoEnableNotification().then(() => {
            if (document.getElementById("cm-root")) render();
        }).catch(() => { /* non-blokir */ });
    } catch (err) {
        showError(err?.message || "Gagal membuat pesanan");
        state.view = "cart";
        render();
    }
}

function renderPayment(app) {
    const m = state.menu;
    const qrisActive = !!(m.payment && m.payment.qris);
    const banks = (m.payment && m.payment.bankAccounts) || [];
    app.innerHTML = `
        ${headerHTML()}
        <div class="cm-section">
            <h2 class="cm-section-title">💳 Pembayaran</h2>
            <div class="cm-bill">
                <div class="cm-bill-row"><span>Total</span><strong>${rupiah(cartTotal())}</strong></div>
            </div>
            <div class="cm-pay-options">
                <button class="cm-pay-opt ${state.paymentMethod === "cash" ? "active" : ""}" data-pay="cash">💵 Tunai</button>
                ${qrisActive ? `<button class="cm-pay-opt ${state.paymentMethod === "qris" ? "active" : ""}" data-pay="qris">📱 QRIS</button>` : ""}
                ${banks.length ? `<button class="cm-pay-opt ${state.paymentMethod === "transfer" ? "active" : ""}" data-pay="transfer">🏦 Transfer</button>` : ""}
            </div>
            ${paymentHintHTML()}
            <div class="cm-wa-nama">
                <label for="cm-phone">No. WhatsApp Anda <span style="font-weight:400">(opsional — untuk info status pesanan)</span></label>
                <input type="tel" id="cm-phone" placeholder="08xx — status diterima / siap / batal dikirim ke nomor ini" autocomplete="tel" inputmode="tel" />
                <p class="cm-muted" style="font-size:0.72rem;margin-top:4px">Status pesanan (diterima, siap, pembayaran dikonfirmasi, dll.) akan dikirim ke nomor ini via WhatsApp.</p>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px">
                <button class="cm-btn cm-btn-secondary" id="cm-pay-back">← Kembali</button>
                <button class="cm-btn cm-btn-primary" id="cm-create-order" style="flex:1">Buat Pesanan · ${rupiah(cartTotal())}</button>
            </div>
        </div>
    `;
    app.querySelector("#cm-cart-btn")?.addEventListener("click", () => { state.view = "cart"; render(); });
    app.querySelectorAll("[data-pay]").forEach(b => b.addEventListener("click", () => {
        state.paymentMethod = b.dataset.pay;
        renderPayment(app);
    }));
    bindCustomerBell(app);
    app.querySelector("#cm-pay-back")?.addEventListener("click", () => { state.view = "cart"; render(); });
    app.querySelector("#cm-create-order")?.addEventListener("click", () => createOrder(app));
}

function paymentHintHTML() {
    const m = state.menu;
    if (state.paymentMethod === "cash") {
        return `<p class="cm-pay-hint">💵 Silakan lakukan pembayaran di kasir setelah pesanan dibuat.</p>`;
    }
    if (state.paymentMethod === "qris") {
        return `
            <div class="cm-qris-box">
                <img class="cm-qris-img" src="${esc(m.payment.qris)}" alt="QRIS Company" />
                <p class="cm-pay-hint">Silakan scan QRIS untuk melakukan pembayaran.<br/>Setelah melakukan pembayaran, silakan lakukan konfirmasi kepada kasir.</p>
            </div>
        `;
    }
    const banks = m.payment.bankAccounts || [];
    return `
        <div class="cm-bank-box">
            <p class="cm-pay-hint" style="font-weight:700">SILAKAN TRANSFER KE SALAH SATU REKENING DI BAWAH INI.</p>
            ${banks.map(b => `
                <div class="cm-bank">
                    <div><strong>${esc(b.bankName)}</strong></div>
                    <div class="cm-bank-num">${esc(b.accountNumber)}</div>
                    <div class="cm-bank-name">a.n. ${esc(b.accountName)}</div>
                </div>
            `).join("")}
            <p class="cm-pay-hint">Setelah melakukan pembayaran, silakan lakukan konfirmasi kepada kasir.</p>
        </div>
    `;
}

async function createOrder(app) {
    const btn = app.querySelector("#cm-create-order");
    if (btn) { btn.disabled = true; btn.textContent = "Membuat pesanan..."; }
    try {
        const phone = String(app.querySelector("#cm-phone")?.value || "").trim();
        const items = state.cart.map(i => ({
            productId: i.productId,
            qty: i.qty,
            recipeId: i.recipeId || "",
            skuKode: i.skuKode || "",
            catatan: i.catatan || ""
        }));
        const res = await createQrOrder(state.identifier, items, state.paymentMethod, "", phone);
        state.order = res.order;
        // Simpan orderToken ke URL (?order=) — deep link yang sudah didukung:
        // (1) refresh / bagikan tautan mengembalikan ke halaman status,
        // (2) tombol "Buka di Chrome" (Android) membawa token sehingga status
        //     order pulih di Chrome tanpa customer mencari-cari lagi.
        try {
            const u = new URL(window.location.href);
            u.searchParams.set("order", res.order.orderToken);
            window.history.replaceState({}, "", u.toString());
        } catch { /* URL tidak dapat diubah — non-blokir */ }
        state.cart = [];
        state.view = "status";
        render();
        startStatusPolling();
        // AUTO-SUBSCRIBE — customer sudah WAJIB memberi izin notifikasi saat
        // melewati gate Chrome (permission granted utk bisa order), jadi
        // subscription push dibuat OTOMATIS tanpa menunggu tombol
        // "AKTIFKAN NOTIFIKASI" ditekan. Tanpa ini customer yang tidak
        // menekan tombol TIDAK akan menerima push (mis. saat pesanan sebagian
        // dibatalkan / siap / pembayaran dikonfirmasi).
        autoEnableNotification().then(() => {
            if (document.getElementById("cm-root")) render();
        }).catch(() => { /* non-blokir — tombol manual tetap tersedia */ });
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = "Buat Pesanan"; }
        showError(err?.message || "Gagal membuat pesanan");
    }
}

// ── Status + Web Push ──

function renderStatus(app) {
    const o = state.order || {};
    const m = state.menu;
    const steps = kitchenStepIndex();
    const paid = o.paymentStatus === "paid";
    // F&B V1 — item yang dibatalkan PER-ITEM oleh kitchen (sebagian)
    const cancelledItems = (Array.isArray(o.items) ? o.items : []).filter(i => i && i.cancelled);

    // ORDER DIBATALKAN (kitchen) — status khusus: info pembatalan + status
    // refund (bila lunas); tanpa steps / tombol notifikasi / pesan siap.
    if (o.kitchenStatus === "cancelled") {
        const refunded = o.refundStatus === "refunded";
        app.innerHTML = `
            ${headerHTML()}
            <div class="cm-section cm-status">
                <div style="text-align:center;margin-bottom:14px">
                    <div class="cm-order-id">${esc(o.orderId || "")}</div>
                    <div class="cm-status-meja">${esc(o.nomorMeja || (m && m.table && m.table.nomorMeja) || "")}</div>
                    <div class="cm-pay-hint">${paymentMethodLabel(o.paymentMethod)} · ${paid ? "✅ Lunas" : "🕐 Belum lunas"}</div>
                </div>
                <div class="cm-cancel-box">
                    <div style="font-size:2.4rem;line-height:1">❌</div>
                    <h2 style="margin:8px 0 0;font-size:1.05rem;font-weight:800">Pesanan telah dibatalkan</h2>
                    <p class="cm-pay-hint">Pesanan Anda dibatalkan oleh dapur${o.cancelledBy ? ` (${esc(o.cancelledBy)})` : ""}.</p>
                    ${paid
                        ? (refunded
                            ? `<p class="cm-pay-hint">💰 Pembayaran <strong>${rupiah(o.refundAmount || o.total)}</strong> telah direfund. Terima kasih.</p>`
                            : `<p class="cm-pay-hint">💰 Pembayaran Anda <strong>${rupiah(o.total)}</strong> akan direfund oleh kasir. Silakan hubungi kasir bila perlu.</p>`)
                        : `<p class="cm-pay-hint">Belum ada pembayaran yang perlu dikembalikan. Silakan hubungi kasir bila perlu.</p>`}
                </div>
                <button class="cm-btn cm-btn-secondary" id="cm-close-status" style="width:100%;margin-top:10px">Tutup</button>
            </div>
        `;
        app.querySelector("#cm-cart-btn")?.addEventListener("click", () => { state.view = "menu"; render(); });
        bindCustomerBell(app);
        app.querySelector("#cm-close-status")?.addEventListener("click", () => {
            state.order = null;
            state.notified = false;
            stopPolling();
            state.view = "menu";
            render();
        });
        return;
    }

    app.innerHTML = `
        ${headerHTML()}
        <div class="cm-section cm-status">
            <div style="text-align:center;margin-bottom:14px">
                <div class="cm-order-id">${esc(o.orderId || "")}</div>
                <div class="cm-status-meja">${esc(o.nomorMeja || (m && m.table && m.table.nomorMeja) || "")}</div>
                <div class="cm-pay-hint">${paymentMethodLabel(o.paymentMethod)} · ${paid ? "✅ Lunas" : "🕐 Menunggu pembayaran"}</div>
            </div>
            ${cancelledItems.length ? `
                <div class="cm-cancel-partial">
                    🗑️ <strong>${cancelledItems.length} item dibatalkan</strong> oleh dapur: ${esc(cancelledItems.map(i => `${i.qty}× ${i.nama}`).join(", "))}.${paid && Number(o.refundAmount) > 0 ? ` Refund <strong>${rupiah(o.refundAmount)}</strong> akan diproses kasir.` : ""}
                </div>
            ` : ""}
            ${proofSectionHTML(o, paid)}
            ${o.hasKitchenItems === false
                ? `<div class="cm-no-kitchen-msg">🧺 Pesanan tanpa proses dapur — disiapkan kasir. Silakan ambil di kasir.</div>`
                : `<div class="cm-steps">
                    ${KITCHEN_STEPS.map((s, idx) => `
                        <div class="cm-step ${steps >= idx ? "done" : ""}">
                            <div class="cm-step-dot">${steps > idx ? "✓" : (steps === idx ? "●" : "")}</div>
                            <div class="cm-step-label">${s.label}</div>
                        </div>
                    `).join("")}
                </div>`}
            ${!state.notified ? `
                <div class="cm-notify-box">
                    <div>🔔 Beritahu saya saat pesanan siap <small style="opacity:.75">atau pembayaran dikonfirmasi</small>.</div>
                    ${chromeHintHTML()}
                    <button class="cm-btn cm-btn-primary" id="cm-enable-notif" style="width:100%">AKTIFKAN NOTIFIKASI</button>
                    <p class="cm-muted" style="font-size:0.72rem">Tanpa login & tanpa nomor HP — notifikasi tetap diterima <strong>setelah browser ditutup</strong> (web push).</p>
                    ${/iphone|ipad|ipod/i.test(navigator.userAgent || "") ? `<p class="cm-muted" style="font-size:0.72rem">📱 iPhone: buka menu <strong>bagikan (📤) → Tambahkan ke Layar Utama</strong>, lalu buka dari ikonnya agar notifikasi aktif.</p>` : ""}
                </div>
            ` : `<div class="cm-notify-on">🔔 Notifikasi aktif — Anda akan diberi tahu saat pesanan siap / pembayaran dikonfirmasi, walau browser ditutup.</div>`}
            ${steps >= 2 ? `<div class="cm-ready-msg">🎉 Pesanan sudah siap! Silakan mengambil pesanan di kasir.</div>` : ""}
            <button class="cm-btn cm-btn-secondary" id="cm-close-status" style="width:100%;margin-top:10px">Tutup</button>
        </div>
    `;
    app.querySelector("#cm-cart-btn")?.addEventListener("click", () => { state.view = "menu"; render(); });
    app.querySelector("#cm-enable-notif")?.addEventListener("click", () => enableNotification());
    app.querySelector("#cm-upload-proof")?.addEventListener("click", () => uploadProof());
    bindCustomerBell(app);
    app.querySelector("#cm-confirm-direct")?.addEventListener("click", () => {
        showError("Silakan konfirmasi langsung ke kasir — status order akan diperbarui setelah kasir mengonfirmasi pembayaran.");
    });
    app.querySelector("#cm-close-status")?.addEventListener("click", () => {
        // Kembali ke menu meja (order baru diperbolehkan — order dibedakan
        // oleh orderId, bukan meja).
        state.order = null;
        state.notified = false;
        stopPolling();
        state.view = "menu";
        render();
    });
}

/**
 * F&B Payment Proof V1 — section bukti pembayaran di halaman status:
 *  - QRIS/Transfer + PENDING: instruksi upload ATAU konfirmasi ke kasir
 *  - bukti pending: "telah dikirim, tunggu konfirmasi kasir"
 *  - bukti ditolak: upload ulang / konfirmasi ke kasir
 *  - PAID: "Pembayaran Anda telah dikonfirmasi"
 * Tunai: tanpa section (bayar di kasir — workflow existing).
 * @param {object} o Order
 * @param {boolean} paid
 * @returns {string}
 */
function proofSectionHTML(o, paid) {
    if (!["qris", "transfer"].includes(o.paymentMethod)) return "";
    const proofs = Array.isArray(o.proofs) ? o.proofs : [];
    const latest = proofs[0] || null; // terbaru dulu (server sort createdAt desc)

    if (paid) {
        return `<div class="cm-paid-msg">✅ <strong>Pembayaran Anda telah dikonfirmasi.</strong></div>`;
    }

    if (latest && latest.status === "pending") {
        return `
            <div class="cm-proof-box">
                <div>📤 <strong>Bukti transaksi telah dikirim.</strong></div>
                <p class="cm-pay-hint">Silakan tunggu konfirmasi dari kasir. Untuk pemberitahuan otomatis, aktifkan notifikasi di bawah.</p>
            </div>
        `;
    }

    const rejected = latest && latest.status === "rejected";
    return `
        <div class="cm-proof-box ${rejected ? "cm-proof-rejected" : ""}">
            ${rejected
                ? `<div>⚠️ <strong>Bukti pembayaran belum dapat diverifikasi.</strong></div>
                   <p class="cm-pay-hint">Silakan upload kembali atau konfirmasi langsung ke kasir.</p>`
                : `<p class="cm-pay-hint">Silakan lakukan pembayaran sesuai instruksi di atas. Setelah pembayaran berhasil, silakan upload bukti transaksi atau konfirmasi langsung ke kasir.</p>`}
            <div style="display:flex;gap:8px;margin-top:10px">
                <button class="cm-btn cm-btn-primary" id="cm-upload-proof" style="flex:1">📤 ${rejected ? "UPLOAD ULANG" : "UPLOAD BUKTI TRANSAKSI"}</button>
                <button class="cm-btn cm-btn-secondary" id="cm-confirm-direct">🗣️ KONFIRMASI KE KASIR</button>
            </div>
        </div>
    `;
}

/**
 * Upload bukti pembayaran: pilih file gambar (JPG/PNG/WEBP) → kompresi
 * client-side (canvas, pola foto produk) → kirim data URI ke server.
 * Order TETAP PENDING — PAID hanya setelah kasir verifikasi.
 */
async function uploadProof() {
    const o = state.order || {};
    if (!o.orderToken) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/jpg,image/png,image/webp";
    input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            return showError("File terlalu besar (maks 10 MB) — pilih gambar lain");
        }
        let dataUri = "";
        try {
            dataUri = await compressImage(file, 900, 0.7);
        } catch (err) {
            return showError(err?.message || "Gagal membaca gambar");
        }
        showError("Mengirim bukti transaksi...");
        try {
            const res = await uploadQrOrderProof(o.orderToken, dataUri, file.name);
            // Perbarui status order lokal: riwayat bukti + canUploadProof=false
            state.order = {
                ...state.order,
                proofs: [res.proof, ...(Array.isArray(o.proofs) ? o.proofs : [])],
                canUploadProof: false
            };
            render();
            showError(res.message || "Bukti transaksi telah dikirim.");
        } catch (err) {
            showError(err?.message || "Gagal mengirim bukti — coba lagi");
        }
    };
    input.click();
}

/**
 * Kompresi gambar client-side (canvas) → data URI JPEG — pola sama dengan
 * foto produk (barang). Maks dimensi maxSize px, kualitas quality.
 * @param {File} file
 * @param {number} [maxSize=900]
 * @param {number} [quality=0.7]
 * @returns {Promise<string>}
 */
function compressImage(file, maxSize = 900, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * ratio));
                const h = Math.max(1, Math.round(img.height * ratio));
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                if (!ctx) { reject(new Error("Canvas tidak didukung browser ini")); return; }
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

function kitchenStepIndex() {
    const o = state.order || {};
    const ks = o.kitchenStatus || "new";
    const idx = KITCHEN_STEPS.findIndex(s => s.key === ks);
    return idx >= 0 ? idx : (ks === "ready" ? 2 : 0);
}

function startStatusPolling() {
    stopPolling();
    state.pollTimer = setInterval(async () => {
        if (!state.order || !state.order.orderToken) return;
        try {
            const res = await fetchQrOrderStatus(state.order.orderToken);
            const o = res.order;
            const prevStatus = state.order.kitchenStatus;
            // Deteksi item yang BARU dibatalkan (pembatalan parsial) — bandingkan
            // id baris yang cancelled sebelum & sesudah poll.
            const prevCancelledIds = new Set(
                (Array.isArray(state.order.items) ? state.order.items : [])
                    .filter(i => i && i.cancelled)
                    .map(i => String(i.itemId || i.nama || ""))
            );
            state.order = { ...state.order, ...o };
            const cancelledIds = new Set(
                (Array.isArray(o.items) ? o.items : [])
                    .filter(i => i && i.cancelled)
                    .map(i => String(i.itemId || i.nama || ""))
            );
            const newCancelled = [...cancelledIds].filter(id => !prevCancelledIds.has(id));
            if (document.getElementById("cm-root")) render();
            // ITEM DIBATALKAN (parsial, halaman status sedang terbuka) — suara +
            // vibrate + notifikasi lokal (push server tetap berjalan utk customer
            // yang sudah aktifkan notifikasi).
            if (newCancelled.length && o.kitchenStatus !== "cancelled") {
                speak("Beberapa item pesanan Anda telah dibatalkan.");
                try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch { /* ignore */ }
                try {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Beberapa item pesanan dibatalkan", {
                            body: `Meja ${o.nomorMeja} · ${o.orderId}\nSilakan cek status pesanan Anda.`,
                            vibrate: [150, 80, 150],
                            tag: `item-cancelled-${o.orderId}`
                        });
                    }
                } catch { /* ignore */ }
            }
            // PESANAN SIAP → suara (TTS) + vibrate + notifikasi lokal (halaman terbuka)
            if (o.kitchenStatus === "ready" && prevStatus !== "ready") {
                speak("Pesanan Anda sudah siap. Silakan mengambil pesanan di kasir.");
                playReadySound();
                try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* ignore */ }
                try {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Pesanan Anda sudah siap 🍽️", {
                            body: `Meja ${o.nomorMeja} · ${o.orderId}\nSilakan mengambil pesanan di kasir.`,
                            vibrate: [200, 100, 200],
                            tag: `ready-${o.orderId}`
                        });
                    }
                } catch { /* ignore */ }
                stopPolling();
            }
            // ORDER DIBATALKAN → suara + vibrate + notifikasi lokal; polling
            // dihentikan (status final — tidak ada transisi lagi).
            if (o.kitchenStatus === "cancelled" && prevStatus !== "cancelled") {
                speak("Pesanan Anda telah dibatalkan.");
                try { if (navigator.vibrate) navigator.vibrate([150, 80, 150]); } catch { /* ignore */ }
                try {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Pesanan Anda telah dibatalkan", {
                            body: `Meja ${o.nomorMeja} · ${o.orderId}\nSilakan hubungi kasir bila perlu.`,
                            vibrate: [150, 80, 150],
                            tag: `cancelled-${o.orderId}`
                        });
                    }
                } catch { /* ignore */ }
                stopPolling();
            }
        } catch { /* polling lanjut */ }
    }, 10000);
}

function stopPolling() {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }
}

/** Suara pendek via Web Audio API (fallback bila browser menolak — diam). */
function playReadySound() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        [880, 1108, 1318].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const t = now + i * 0.18;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.18);
        });
    } catch { /* audio tidak didukung — ikuti capability OS/browser */ }
}

function urlBase64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

async function enableNotification() {
    if (!("serviceWorker" in navigator)) {
        return showError("Browser tidak mendukung notifikasi");
    }
    if (!("Notification" in window)) {
        return showError("Browser tidak mendukung notifikasi");
    }
    if (!state.order || !state.order.orderToken) {
        return showError("Order belum tersedia");
    }
    try {
        let subscription = await getExistingSubscription();
        // PERBAIKAN (F&B V1-FIX): jangan SKIP saat subscription existing
        // ditemukan — subscription tsb TETAP harus di-ikat ke order ini
        // (server upsert per company+order+endpoint, jadi satu browser bisa
        // terikat banyak order). Sebelumnya: existing → return → order ini 0
        // subscription → push tidak terkirim.
        if (!subscription) {
            let permission = Notification.permission;
            if (permission === "default") {
                permission = await Notification.requestPermission();
            }
            if (permission !== "granted") {
                showError("Notifikasi ditolak — order tetap berjalan. Anda tetap dapat melihat status di halaman ini.");
                return;
            }
            const publicKey = await fetchPushPublicKey();
            if (!publicKey) {
                return showError("Push belum dikonfigurasi server — order tetap berjalan.");
            }
            const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            await navigator.serviceWorker.ready;
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }
        if (!subscription) {
            return showError("Tidak dapat membuat subscription push — coba lagi.");
        }
        await subscribeOrderPush(state.order.orderToken, subscription.toJSON());
        state.notified = true;
        render();
    } catch (err) {
        console.warn("[CustomerMenu] Gagal mengaktifkan notifikasi:", err);
        // PERBAIKAN: jangan pura-pura berhasil. state.notified TETAP false
        // agar tombol AKTIFKAN NOTIFIKASI bisa dicoba lagi — sebelumnya catch
        // menandai notified=true sehingga customer mengira notif aktif padahal
        // subscription tidak pernah tersimpan (DB = 0 subscription).
        state.notified = false;
        render();
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
        showError(ios
            ? "Notifikasi browser butuh langkah tambahan di iPhone: buka menu bagikan (📤) → \"Tambahkan ke Layar Utama\" → buka dari ikonnya. Order tetap berjalan."
            : "Tidak dapat mengaktifkan notifikasi — periksa izin browser Anda lalu coba lagi. Order tetap berjalan.");
    }
}

/**
 * AUTO-subscribe push setelah order dibuat (permission sudah granted dari
 * gate Chrome). Sama dengan enableNotification, TANPA tombol — gagal diam
 * (state.notified tetap false → tombol AKTIFKAN NOTIFIKASI tetap tampil).
 */
async function autoEnableNotification() {
    try {
        if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
        if (Notification.permission !== "granted") return;
        if (!state.order || !state.order.orderToken) return;
        // PERBAIKAN (F&B V1-FIX): jangan SKIP saat subscription existing
        // ditemukan. Browser yang sama boleh subscribe untuk BANYAK order —
        // subscription lama HARUS tetap di-ikat ke order baru ini juga
        // (server upsert per company+order+endpoint). Sebelumnya: existing
        // ditemukan → return → subscribeOrderPush TIDAK pernah dipanggil
        // untuk order baru → order tsb 0 subscription → push tidak terkirim.
        let subscription = await getExistingSubscription();
        if (!subscription) {
            const publicKey = await fetchPushPublicKey();
            if (!publicKey) return;
            const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            await navigator.serviceWorker.ready;
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }
        if (!subscription) return;
        await subscribeOrderPush(state.order.orderToken, subscription.toJSON());
        state.notified = true;
    } catch (err) {
        console.warn("[CustomerMenu] Auto-subscribe gagal:", err);
        state.notified = false;
    }
}

/**
 * Register service worker (fire-and-forget) — dipanggil saat halaman dimuat
 * agar push tetap diterima walau browser ditutup.
 */
function registerServiceWorker() {
    try {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(err => {
                console.warn("[CustomerMenu] Gagal register SW:", err);
            });
        }
    } catch (err) {
        console.warn("[CustomerMenu] Gagal register SW:", err);
    }
}

// ── F&B V1 — Buka di Chrome (Android) ──
// Web push paling stabil di Google Chrome. Halaman TIDAK bisa memaksa ganti
// browser sendiri (batasan keamanan browser/OS) — tapi di Android kami
// menawarkan 1 ketukan: intent:// deep link yang membuka ulang URL saat ini
// di Google Chrome (paket com.android.chrome), membawa ?order=<orderToken>
// sehingga status order pulih di Chrome. iOS: mustahil dari halaman web
// (custom scheme diblokir) — ikuti panduan "Tambahkan ke Layar Utama" yang
// sudah tampil di bawah.

function isAndroid() {
    return /android/i.test(navigator.userAgent || "");
}

/** Deteksi browser nyata dari User-Agent (aman, tanpa asumsi token tunggal).
 *  Tujuan utama: membedakan Google Chrome (Android/iOS/desktop) dari browser
 *  Chromium lain (Edge, Samsung Internet, Opera, Xiaomi, UC, Brave, …) +
 *  in-app browser/WebView (WhatsApp/Instagram/LINE/FB) yang JUGA menyertakan
 *  token "Chrome/" di UA-nya. Semua token browser lain dicek SEBELUM token
 *  "Chrome/" — spec: jangan anggap browser lain sebagai Chrome hanya karena
 *  memakai Chromium. */
function detectBrowser() {
    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    // In-app browser / WebView — BUKAN Chrome utuh (tanpa UI & notifikasi penuh)
    if (/FB_IAB|FB4A|Instagram|Line\//i.test(ua) || /wv\b|WebView/i.test(ua)) return "in-app";
    // Browser Chromium TAPI BUKAN Google Chrome — cek sebelum token "Chrome/".
    if (/SamsungBrowser\//i.test(ua)) return "samsung-internet";
    if (/EdgA\//i.test(ua) || /EdgiOS\//i.test(ua) || /Edg\//i.test(ua)) return "edge";
    if (/OPR\//i.test(ua) || /OPiOS/i.test(ua) || /Opera/i.test(ua)) return "opera";
    if (/FxiOS/i.test(ua) || /Firefox\//i.test(ua)) return "firefox";
    if (/CriOS/i.test(ua)) return "chrome-ios";
    if (/MiuiBrowser\//i.test(ua)) return "miui";
    if (/UCBrowser/i.test(ua) || /Quark\//i.test(ua)) return "uc";
    if (/HuaweiBrowser\//i.test(ua)) return "huawei";
    if (/VivoBrowser\//i.test(ua) || /OppoBrowser\//i.test(ua) || /ColorOS/i.test(ua)) return "vivo-oppo";
    if (/Baidu/i.test(ua) || /baiduboxapp/i.test(ua)) return "baidu";
    if (/Brave\//i.test(ua)) return "brave";
    if (/Vivaldi\//i.test(ua)) return "vivaldi";
    if (/YaBrowser\//i.test(ua)) return "yandex";
    if (/DuckDuckGo\//i.test(ua)) return "duckduckgo";
    // Android stock browser / browser bawaan HP (mis. OPPO A12 & HP Android
    // sejenis): pola "Version/4.0 Chrome/xx" TANPA nama browser sendiri.
    // Chrome asli TIDAK pernah menyertakan "Version/" di UA-nya — aman,
    // tanpa false positive. (Browser ini tetap bisa order via Chrome.)
    if (isAndroid && /Version\//i.test(ua) && /Chrome\//i.test(ua)) return "other";
    // Benar-benar Google Chrome (Android/iOS/desktop).
    if (/Chrome\//i.test(ua)) return isAndroid ? "chrome-android" : (isIOS ? "chrome-ios" : "chrome");
    if (/Safari\//i.test(ua) || isIOS) return "safari";
    return "other";
}

/** Google Chrome asli (Android/iOS/desktop) — Edge/Samsung/Opera/Firefox/
 *  Safari/in-app TIDAK dianggap Chrome walau memakai Chromium. */
function isGoogleChrome() {
    const b = detectBrowser();
    return b === "chrome" || b === "chrome-android" || b === "chrome-ios";
}

/** Build Android intent:// URL yang membuka ulang halaman ini di Chrome.
 *  Fallback: bila Chrome tidak terpasang, browser saat ini membuka URL yang
 *  sama (halaman tidak hilang). @returns {string} */
function chromeIntentUrl() {
    try {
        const clean = window.location.href.split("#")[0];
        const scheme = (window.location.protocol || "https:").replace(":", "");
        const rest = clean.replace(/^[a-z]+:\/\//i, "");
        return `intent://${rest}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(clean)};end`;
    } catch {
        return "";
    }
}

/** Box "Buka di Google Chrome" — hanya tampil di Android non-Chrome.
 *  @returns {string} */
function chromeHintHTML() {
    if (!isAndroid() || isGoogleChrome()) return "";
    const url = chromeIntentUrl();
    if (!url) return "";
    return `
        <div class="cm-chrome-box">
            <div>🌐 Notifikasi paling stabil di <strong>Google Chrome</strong> — buka halaman ini di Chrome (order & status tetap tersimpan, dibuka ulang otomatis di Chrome).</div>
            <a class="cm-btn cm-btn-chrome" id="cm-open-chrome" href="${url}" role="button">BUKA DI GOOGLE CHROME</a>
        </div>
    `;
}

// ── QR MENU GATE — Browser & Notifikasi (Chrome-first) ──
// Alur masuk halaman ORDER QR Menu (lihat computeGate + renderGate):
//   1. Bukan Google Chrome (Safari/Firefox/Edge/Samsung/Opera/Xiaomi/UC/
//      Brave/in-app/…) → gate "Buka di Google Chrome": tombol utama
//      [Buka di Chrome] (Android intent://, iOS googlechrome-x-callback://,
//      desktop = salin URL) + URL & Copy URL sebagai fallback — halaman
//      TIDAK bisa memaksa buka Chrome di semua platform.
//   2. Chrome + Notification granted → langsung menu (tanpa gate).
//   3. Chrome + permission default → gate "Aktifkan Notifikasi" → Allow →
//      menu; Deny → arahkan ke pengaturan notifikasi, lalu gate
//      "Notifikasi tidak aktif" → [Order di Kasir].
//   4. Chrome + permission denied → gate "Notifikasi tidak aktif. Silakan
//      order di kasir." → [Order di Kasir] (+ pengaturan & Coba Lagi).
//   5. Chrome + tanpa Notification API (praktis tak terjadi) → gate
//      "Notifikasi tidak aktif" → [Order di Kasir].
// View STATUS (?order=<token>) TIDAK di-gate — customer yang sudah punya
// order berarti sudah melewati gate saat memesan; ia datang dari notifikasi
// / deep-link untuk melihat status pesanan.

function computeGate() {
    // #4 dulu: bukan Google Chrome → gate "Buka di Google Chrome" (browser
    // lain sering punya Notification API tapi push tidak stabil — target
    // utama tetap Chrome). no-api hanya relevan di Chrome (praktis tak terjadi).
    if (!isGoogleChrome()) return "chrome";
    if (!("Notification" in window)) return "no-api";
    const perm = Notification.permission;
    if (perm === "granted") return null;
    if (perm === "denied") return "denied";
    return "notif";
}

function renderGate(app) {
    const m = state.menu || {};
    const companyName = (m.company && m.company.name) || "";
    const tableNo = (m.table && m.table.nomorMeja) || "";

    if (state.gate === "chrome") {
        app.innerHTML = chromeGateHTML();
        bindCopyUrl(app);
        // Desktop/lain: [Buka di Chrome] tak bisa membuka Chrome langsung →
        // tombol menyalin URL + menampilkan instruksi fallback yang jelas.
        app.querySelector("#cm-gate-open-chrome")?.addEventListener("click", () => {
            copyUrlToClipboard(window.location.href, () => {
                const btn = app.querySelector("#cm-gate-open-chrome");
                if (btn) {
                    const old = btn.textContent;
                    btn.textContent = "✓ URL disalin — tempel di Chrome";
                    setTimeout(() => { btn.textContent = old; }, 2500);
                }
                showError("Salin alamat halaman ini dan buka di Google Chrome, lalu tempel di address bar.");
            });
        });
        return;
    }
    if (state.gate === "notif") {
        app.innerHTML = notifGateHTML();
        app.querySelector("#cm-gate-notif")?.addEventListener("click", requestNotifPermission);
        return;
    }
    if (state.gate === "kasir") {
        app.innerHTML = kasirGateHTML(companyName, tableNo);
        app.querySelector("#cm-gate-back")?.addEventListener("click", () => {
            state.gate = computeGate();
            render();
        });
        return;
    }
    // "denied" | "no-api"
    const noApi = state.gate === "no-api";
    app.innerHTML = deniedGateHTML(noApi);
    // "denied" (bukan no-api): tombol utama = buka PENGATURAN notifikasi
    // (user yang bersedia memberi izin tidak boleh buntu ke "Order di Kasir")
    // + Coba Lagi untuk memeriksa ulang izin setelah kembali dari pengaturan.
    if (!noApi) {
        app.querySelector("#cm-gate-settings")?.addEventListener("click", openNotificationSettings);
        app.querySelector("#cm-gate-retry")?.addEventListener("click", () => {
            state.gate = computeGate();
            render();
        });
    }
    app.querySelector("#cm-gate-kasir")?.addEventListener("click", () => {
        state.gate = "kasir";
        render();
    });
}

function chromeGateHTML() {
    const url = window.location.href;
    return `
        <div class="cm-gate">
            <div class="cm-gate-icon">🌐</div>
            <h2 class="cm-gate-title">Buka di Google Chrome</h2>
            <p class="cm-gate-desc">Untuk mendapatkan notifikasi pesanan dengan baik, silakan buka halaman ini menggunakan Google Chrome.</p>
            ${chromeOpenButtonHTML(url)}
            <div class="cm-url-box">
                <code class="cm-url-text">${esc(url)}</code>
                <button class="cm-btn cm-btn-secondary" id="cm-gate-copy">Copy URL</button>
            </div>
            <p class="cm-gate-fallback">Salin alamat halaman ini dan buka di Google Chrome.</p>
        </div>
    `;
}

/** [Buka di Chrome] — TOMBOL UTAMA gate (spec #4), SELALU dirender. Mekanisme
 *  sesuai platform (jangan paksa — halaman tidak boleh rusak bila deep-link
 *  tidak didukung; URL + Copy tetap tersedia di bawah sebagai fallback):
 *   - Android : intent:// (paket com.android.chrome) — buka langsung.
 *   - iOS     : googlechrome-x-callback:// (Chrome iOS) — buka langsung;
 *               bila Chrome tak terpasang, iOS menampilkan alert sistem.
 *   - Desktop : browser tak bisa dipaksa membuka Chrome → tombol menyalin
 *               URL & menampilkan instruksi fallback (di-render + di-bind
 *               oleh renderGate).
 * @param {string} url URL halaman saat ini
 * @returns {string}
 */
function chromeOpenButtonHTML(url) {
    if (isAndroid()) {
        const intentUrl = chromeIntentUrl();
        return intentUrl ? `<a class="cm-btn cm-btn-chrome" href="${esc(intentUrl)}">Buka di Chrome</a>` : "";
    }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent || "")) {
        const iosUrl = "googlechrome-x-callback://x-callback-url/open/?x-source=SMART%20Kasir&url=" + encodeURIComponent(url);
        return `<a class="cm-btn cm-btn-chrome" href="${esc(iosUrl)}">Buka di Chrome</a>`;
    }
    return `<button class="cm-btn cm-btn-chrome" id="cm-gate-open-chrome">Buka di Chrome</button>`;
}

function notifGateHTML() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    return `
        <div class="cm-gate">
            <div class="cm-gate-icon">🔔</div>
            <h2 class="cm-gate-title">Aktifkan Notifikasi</h2>
            <p class="cm-gate-desc">Izinkan notifikasi agar Anda dapat menerima informasi mengenai pesanan.</p>
            <button class="cm-btn cm-btn-primary" id="cm-gate-notif">Izinkan Notifikasi</button>
            ${ios ? `<p class="cm-gate-ios-hint">📱 iPhone: setelah izin diberikan, buka menu bagikan (📤) → “Tambahkan ke Layar Utama” → buka dari ikonnya agar notifikasi tetap aktif.</p>` : ""}
        </div>
    `;
}

function deniedGateHTML(noApi) {
    // Notifikasi tidak tersedia/ditolak (OPPO A12 & HP Android sejenis):
    // tampilkan singkat "Notifikasi tidak aktif. Silakan order di kasir."
    // [Buka Pengaturan Notifikasi] + [Coba Lagi] tetap tersedia sebagai
    // opsi sekunder utk user yang bersedia memberi izin ulang (bukan no-api).
    return `
        <div class="cm-gate">
            <div class="cm-gate-icon">${noApi ? "⚠️" : "🔕"}</div>
            <h2 class="cm-gate-title">Notifikasi tidak aktif</h2>
            <p class="cm-gate-desc">Silakan order di kasir.</p>
            <button class="cm-btn cm-btn-primary" id="cm-gate-kasir">Order di Kasir</button>
            ${noApi ? "" : `
                <button class="cm-btn cm-btn-secondary" id="cm-gate-settings" style="width:auto">Buka Pengaturan Notifikasi</button>
                <button class="cm-btn cm-btn-secondary" id="cm-gate-retry" style="width:auto">Coba Lagi</button>
            `}
        </div>
    `;
}

function kasirGateHTML(companyName, tableNo) {
    return `
        <div class="cm-gate">
            <div class="cm-gate-icon">🧑‍🍳</div>
            <h2 class="cm-gate-title">Order di Kasir</h2>
            <p class="cm-gate-desc">Silakan lakukan pemesanan langsung di kasir${tableNo ? " dan sebutkan nomor meja Anda" : ""} — kasir akan membantu membuat pesanan Anda.</p>
            ${(companyName || tableNo) ? `
                <div class="cm-gate-table">
                    ${companyName ? `<div>${esc(companyName)}</div>` : ""}
                    ${tableNo ? `<div class="cm-gate-meja">Meja ${esc(tableNo)}</div>` : ""}
                </div>
            ` : ""}
            <button class="cm-btn cm-btn-secondary" id="cm-gate-back" style="width:auto">← Kembali</button>
        </div>
    `;
}

/** [Izinkan Notifikasi] — Allow → lanjut ke menu; Deny → ARAHKAN ke
 *  pengaturan notifikasi (user justru sedang bersedia memberi izin, jadi
 *  tidak boleh langsung buntu ke "Order di Kasir"); dismiss (default) →
 *  tetap di gate, user boleh coba lagi. */
async function requestNotifPermission() {
    const btn = document.getElementById("cm-gate-notif");
    if (btn) { btn.disabled = true; btn.textContent = "Meminta izin..."; }
    try {
        let perm = Notification.permission;
        if (perm === "default") {
            perm = await Notification.requestPermission();
        }
        if (perm === "granted") {
            state.gate = null;
            render();
            return;
        }
        if (perm === "denied") {
            // Izin diblokir (ditolak sebelumnya / OS) — permintaan ulang via
            // popup browser TIDAK mungkin. Buka pengaturan notifikasi HP.
            state.gate = "denied";
            render();
            openNotificationSettings();
            return;
        }
        // "default" — popup ditutup tanpa pilihan; biarkan user coba lagi
        if (btn) { btn.disabled = false; btn.textContent = "Izinkan Notifikasi"; }
        showError("Izin belum diberikan — tekan “Izinkan Notifikasi” untuk melanjutkan.");
    } catch (err) {
        console.warn("[CustomerMenu] requestPermission gagal:", err);
        if (btn) { btn.disabled = false; btn.textContent = "Izinkan Notifikasi"; }
        showError("Tidak dapat meminta izin notifikasi — coba lagi.");
    }
}

/** Buka pengaturan notifikasi HP/browser — dipakai saat izin notifikasi
 *  diblokir ("denied") padahal user bersedia memberi izin. Halaman web
 *  TIDAK bisa memaksa membuka pengaturan di semua platform (batasan
 *  keamanan browser/OS), jadi:
 *   - Android: deep-link intent ke pengaturan notifikasi Chrome (paket
 *     com.android.chrome, action android.settings.APP_NOTIFICATION_SETTINGS
 *     — Settings Android). Bila intent tidak didukung, browser_fallback_url
 *     mengembalikan ke halaman ini (tidak hilang).
 *   - iOS: tidak bisa dibuka dari web — tampilkan panduan manual.
 *   - Desktop: panduan manual (chrome://settings/content/notifications). */
function openNotificationSettings() {
    let opened = false;
    try {
        if (isAndroid()) {
            const intentUrl = "intent://#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.app_package=com.android.chrome;S.browser_fallback_url="
                + encodeURIComponent(window.location.href) + ";end";
            const a = document.createElement("a");
            a.href = intentUrl;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            opened = true;
        }
    } catch (err) {
        console.warn("[CustomerMenu] Gagal membuka pengaturan notifikasi:", err);
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    if (ios) {
        showError("Notifikasi diblokir di iPhone. Buka Pengaturan iPhone → Notifikasi → izinkan browser ini, lalu kembali ke halaman ini dan tekan \u201cCoba Lagi\u201d.");
    } else if (!opened) {
        showError("Notifikasi diblokir. Buka pengaturan notifikasi browser Anda dan izinkan situs ini" + (isAndroid() ? "" : " (Chrome: chrome://settings/content/notifications)") + ", lalu kembali ke halaman ini dan tekan \u201cCoba Lagi\u201d.");
    } else {
        showError("Pengaturan notifikasi dibuka — izinkan notifikasi Chrome, lalu kembali ke halaman ini dan tekan \u201cCoba Lagi\u201d.");
    }
}

/** [Copy URL] — navigator.clipboard dengan fallback textarea (browser lama /
 *  konteks non-secure). Selalu sediakan fallback manual — JANGAN sampai
 *  halaman rusak bila clipboard tidak tersedia. */
/** Salin URL ke clipboard (navigator.clipboard + fallback textarea).
 * @param {string} url
 * @param {() => void} done dipanggil setelah berhasil disalin
 */
function copyUrlToClipboard(url, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(() => legacyCopyUrl(url, done));
    } else {
        legacyCopyUrl(url, done);
    }
}

function bindCopyUrl(app) {
    const btn = app.querySelector("#cm-gate-copy");
    if (!btn) return;
    btn.addEventListener("click", () => {
        copyUrlToClipboard(window.location.href, () => {
            const old = btn.textContent;
            btn.textContent = "✓ Tersalin";
            setTimeout(() => { btn.textContent = old; }, 2000);
        });
    });
}

function legacyCopyUrl(url, done) {
    try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) { done(); return; }
    } catch { /* lanjut fallback manual */ }
    showError("Tidak dapat menyalin otomatis — salin alamat di atas secara manual.");
}

/**
 * Cek apakah browser ini sudah punya push subscription (untuk order ini).
 * @returns {Promise<PushSubscription|null>}
 */
async function getExistingSubscription() {
    try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg && reg.pushManager) {
            return await reg.pushManager.getSubscription();
        }
    } catch { /* ignore */ }
    return null;
}

// ── Helpers ──

function addProduct(productId) {
    const p = state.menu.produk.find(x => String(x.id) === String(productId));
    if (!p) return;
    // Produk ber-varian (recipe F&B / SKU) → pilih varian dulu
    const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : [];
    const skus = Array.isArray(p.skus) && p.skus.length ? p.skus : [];
    if (variants.length || skus.length) {
        openVarianModal(p, variants, skus);
        return;
    }
    const existing = state.cart.find(i => i.productId === String(p.id) && !i.recipeId && !i.skuKode);
    if (existing) existing.qty++;
    else state.cart.push({ productId: String(p.id), nama: p.nama, kode: p.kode || "", harga: Number(p.harga) || 0, qty: 1, recipeId: "", skuKode: "", catatan: "" });
    render();
}

function openVarianModal(p, variants, skus) {
    const app = document.getElementById("cm-app");
    if (!app) return;
    const options = variants.length
        ? variants.map(v => ({ key: `r:${v.recipeId}`, nama: v.nama, harga: Number(v.harga) || Number(p.harga) || 0 }))
        : skus.map(s => ({ key: `s:${s.kode}`, nama: s.label || s.kode, harga: Number(s.harga) || 0 }));
    const html = `
        <div class="cm-modal-overlay" id="cm-varian-overlay">
            <div class="cm-modal">
                <div class="cm-modal-title">${esc(p.nama)}</div>
                <div class="cm-modal-sub">Pilih ${variants.length ? "varian" : "pilihan"} — harga ${variants.length ? "varian" : "per pilihan"}</div>
                <div class="cm-varian-list">
                    ${options.map((o, idx) => `
                        <button class="cm-varian" data-opt="${idx}">
                            <span>${esc(o.nama)}</span><span>${rupiah(o.harga)}</span>
                        </button>
                    `).join("")}
                </div>
                <button class="cm-btn cm-btn-secondary" id="cm-varian-cancel" style="width:100%;margin-top:10px">Batal</button>
            </div>
        </div>
    `;
    const overlay = document.createElement("div");
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstElementChild);
    const modal = document.getElementById("cm-varian-overlay");
    const choose = (idx) => {
        const opt = options[idx];
        const recipeId = opt.key.startsWith("r:") ? opt.key.slice(2) : "";
        const skuKode = opt.key.startsWith("s:") ? opt.key.slice(2) : "";
        const existing = state.cart.find(i => i.productId === String(p.id) && i.recipeId === recipeId && i.skuKode === skuKode);
        if (existing) existing.qty++;
        else state.cart.push({ productId: String(p.id), nama: `${p.nama} (${opt.nama})`, kode: p.kode || "", harga: opt.harga, qty: 1, recipeId, skuKode, catatan: "" });
        modal.remove();
        render();
    };
    modal.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => choose(Number(b.dataset.opt))));
    modal.querySelector("#cm-varian-cancel").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function paymentMethodLabel(method) {
    return { cash: "💵 Tunai", qris: "📱 QRIS", transfer: "🏦 Transfer" }[method] || method || "";
}

// ── F&B V1 — Bell Notifikasi CUSTOMER (di QR Menu) ──
// Event diturunkan dari status order + riwayat bukti (server-sourced,
// dipoll 10 detik). Read-state per perangkat (localStorage per orderToken)
// — customer tanpa login, jadi tidak ada user account untuk read state.

/** Daftar event order (terbaru relevan) utk bell customer. */
function orderEvents() {
    const o = state.order || {};
    const ev = [];
    if (o.orderId) {
        ev.push({ id: "created", icon: "📥", title: `Order ${o.orderId} diterima`, time: o.createdAt });
    }
    const ks = o.kitchenStatus;
    if (ks === "preparing") ev.push({ id: "preparing", icon: "👨‍🍳", title: "Order sedang dibuat", time: null });
    if (ks === "ready") ev.push({ id: "ready", icon: "🍽️", title: "Pesanan sudah siap — silakan ambil di kasir", time: o.readyAt });
    const proofs = Array.isArray(o.proofs) ? o.proofs : [];
    for (const p of proofs) {
        if (p.status === "pending") ev.push({ id: `proof-p-${p.id}`, icon: "📤", title: "Bukti transaksi telah dikirim — menunggu verifikasi kasir", time: p.uploadedAt });
        else if (p.status === "rejected") ev.push({ id: `proof-r-${p.id}`, icon: "⚠️", title: "Bukti belum dapat diverifikasi — silakan upload ulang", time: p.verifiedAt });
        else if (p.status === "approved") ev.push({ id: `proof-a-${p.id}`, icon: "✅", title: "Pembayaran Anda telah dikonfirmasi", time: p.verifiedAt });
    }
    if (o.paymentStatus === "paid") ev.push({ id: "paid", icon: "✅", title: "Pembayaran Anda telah dikonfirmasi", time: o.confirmedAt });
    return ev;
}

function notifReadKey() {
    const tok = (state.order && state.order.orderToken) || "";
    return `cm_notif_read_${tok}`;
}

function readEventIds() {
    try {
        const raw = localStorage.getItem(notifReadKey());
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function unreadEventCount() {
    if (!state.order || !state.order.orderToken) return 0;
    const read = readEventIds();
    return orderEvents().filter(e => !read.includes(e.id)).length;
}

function markEventRead(id) {
    try {
        const read = readEventIds();
        if (!read.includes(id)) {
            read.push(id);
            localStorage.setItem(notifReadKey(), JSON.stringify(read));
        }
    } catch { /* ignore */ }
}

/** Bind bell customer (dipanggil tiap render — header bisa berganti). */
function bindCustomerBell(app) {
    app.querySelector("#cm-bell-btn")?.addEventListener("click", openNotifModal);
}

/** Modal bell customer — daftar event order (read/unread). */
function openNotifModal() {
    const app = document.getElementById("cm-app");
    if (!app) return;
    const events = orderEvents();
    if (!events.length) return;
    const read = readEventIds();
    const html = `
        <div class="cm-modal-overlay" id="cm-notif-overlay">
            <div class="cm-modal">
                <div class="cm-modal-title">🔔 Notifikasi</div>
                <div class="cm-modal-sub">Perkembangan order Anda</div>
                <div class="cm-notif-list">
                    ${events.map(e => `
                        <button class="cm-notif-item ${read.includes(e.id) ? "read" : ""}" data-ev="${esc(e.id)}">
                            <span class="cm-notif-icon">${e.icon}</span>
                            <span class="cm-notif-text">
                                <span class="cm-notif-title">${esc(e.title)}</span>
                                ${e.time ? `<span class="cm-notif-time">${esc(formatBellTime(e.time))}</span>` : ""}
                            </span>
                            ${read.includes(e.id) ? "" : `<span class="cm-notif-dot"></span>`}
                        </button>
                    `).join("")}
                </div>
                <button class="cm-btn cm-btn-secondary" id="cm-notif-close" style="width:100%;margin-top:10px">Tutup</button>
            </div>
        </div>
    `;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);
    const modal = document.getElementById("cm-notif-overlay");
    modal.querySelectorAll("[data-ev]").forEach(b => b.addEventListener("click", () => {
        markEventRead(b.dataset.ev);
        b.classList.add("read");
        b.querySelector(".cm-notif-dot")?.remove();
        const count = unreadEventCount();
        const badge = document.getElementById("cm-bell-count");
        if (badge) {
            badge.textContent = String(count);
            badge.style.display = count ? "inline-flex" : "none";
        }
    }));
    modal.querySelector("#cm-notif-close").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function formatBellTime(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    } catch {
        return String(d);
    }
}

function showError(msg) {
    const root = document.getElementById("cm-root");
    if (!root) return;
    let el = root.querySelector(".cm-toast");
    if (!el) {
        el = document.createElement("div");
        el.className = "cm-toast";
        root.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 4000);
}

// ── Styles ──

function styles() {
    return `
        .cm-root { --cm-green:#059669; --cm-dark:#064e3b; --cm-text:#1e293b; --cm-muted:#64748b; --cm-border:#e2e8f0; --cm-bg:#f8fafc; }
        .cm-root { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--cm-bg); color:var(--cm-text); min-height:100vh; min-height:100dvh; max-width:640px; margin:0 auto; padding-bottom:90px; }
        /* Tablet & lebih lebar — QR Menu mengikuti orientasi perangkat (PWA tidak
           lagi dikunci portrait, lihat manifest.json): konten memakai layar lebih
           banyak, kartu produk lebih besar & grid lebih luas, tidak tampil sebagai
           kolom HP sempit di tengah tablet. */
        @media (min-width: 700px) {
            .cm-root { max-width:960px; }
            .cm-header { padding:16px 24px; }
            .cm-company { font-size:1rem; }
            .cm-meja { font-size:1.5rem; }
            .cm-cart-fab { width:52px; height:52px; font-size:1.5rem; }
            .cm-cart-count { font-size:.75rem; min-width:22px; height:22px; }
            .cm-bell-btn { width:48px; height:48px; font-size:1.3rem; }
            .cm-categories { padding:14px 24px; gap:10px; }
            .cm-cat { padding:9px 18px; font-size:0.95rem; }
            .cm-products { grid-template-columns:repeat(3, 1fr); gap:16px; padding:8px 24px 24px; }
            .cm-product-img { height:150px; }
            .cm-product-body { padding:12px 14px; gap:6px; }
            .cm-product-name { font-size:1rem; }
            .cm-product-desc { font-size:0.8rem; }
            .cm-product-price { font-size:1rem; }
            .cm-add-btn { width:38px; height:38px; font-size:1.3rem; }
            .cm-bill-bar { width:min(92%, 900px); }
            .cm-section { padding:24px; max-width:720px; margin:0 auto; }
            .cm-section-title { font-size:1.3rem; }
            .cm-qris-img { width:260px; height:260px; }
            .cm-modal-overlay { align-items:center; }
            .cm-modal { max-width:560px; border-radius:18px; }
            .cm-toast { font-size:0.9rem; }
        }
        @media (min-width: 1024px) {
            .cm-products { grid-template-columns:repeat(4, 1fr); }
        }
        /* Versi TAB (PWA landscape) — menu display / self-order di tablet
           landscape (manifest-tablet.json terkunci orientation: landscape):
           pakai SELURUH lebar layar (bukan kolom tengah 960px), grid produk
           mengikuti lebar (auto-fill), kartu lebih besar, sentuh lebih lega. */
        .cm-tab { max-width:none; }
        @media (min-width: 900px) {
            .cm-tab .cm-products { grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:18px; padding:8px 28px 120px; }
            .cm-tab .cm-product-img { height:170px; }
            .cm-tab .cm-bill-bar { width:min(94%, 900px); }
            .cm-tab .cm-categories { padding:14px 28px; }
            .cm-tab .cm-header { padding:16px 28px; }
            .cm-tab .cm-cart-fab { width:54px; height:54px; font-size:1.6rem; }
            .cm-tab .cm-bell-btn { width:50px; height:50px; font-size:1.35rem; }
            .cm-tab .cm-meja { font-size:1.6rem; }
        }
        .cm-header { position:sticky; top:0; z-index:20; background:linear-gradient(135deg,var(--cm-dark),var(--cm-green)); color:#fff; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,.12); }
        .cm-header-right { display:flex; align-items:center; gap:10px; }
        .cm-bell-btn { position:relative; background:rgba(255,255,255,.18); border:0; color:#fff; font-size:1.15rem; width:42px; height:42px; border-radius:50%; cursor:pointer; }
        .cm-bell-count { position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:.7rem; font-weight:700; min-width:18px; height:18px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; padding:0 4px; }
        .cm-notif-list { display:flex; flex-direction:column; gap:8px; }
        .cm-notif-item { display:flex; align-items:center; gap:10px; border:1px solid var(--cm-border); background:#fff; border-radius:10px; padding:10px 12px; font-size:0.85rem; cursor:pointer; text-align:left; }
        .cm-notif-item.read { opacity:.7; }
        .cm-notif-icon { font-size:1.1rem; }
        .cm-notif-text { flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
        .cm-notif-title { font-weight:600; line-height:1.35; }
        .cm-notif-time { font-size:0.7rem; color:var(--cm-muted); }
        .cm-notif-dot { width:8px; height:8px; border-radius:50%; background:#ef4444; flex-shrink:0; }
        .cm-company { font-size:0.85rem; opacity:.85; }
        .cm-meja { font-size:1.3rem; font-weight:800; letter-spacing:.5px; }
        .cm-cart-fab { position:relative; background:rgba(255,255,255,.18); border:0; color:#fff; font-size:1.3rem; width:46px; height:46px; border-radius:50%; cursor:pointer; }
        .cm-cart-count { position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:.7rem; font-weight:700; min-width:20px; height:20px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 4px; }
        .cm-categories { display:flex; gap:8px; overflow-x:auto; padding:12px 16px; scrollbar-width:none; }
        .cm-categories::-webkit-scrollbar { display:none; }
        .cm-cat { border:1px solid var(--cm-border); background:#fff; border-radius:999px; padding:7px 14px; font-size:0.85rem; cursor:pointer; white-space:nowrap; }
        .cm-cat.active { background:var(--cm-green); color:#fff; border-color:var(--cm-green); }
        .cm-products { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:4px 16px 20px; }
        .cm-product { background:#fff; border:1px solid var(--cm-border); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; cursor:pointer; transition:box-shadow .15s ease, transform .05s ease; }
        .cm-product:not(.cm-product-habis):hover, .cm-product:not(.cm-product-habis):focus-visible { border-color:var(--cm-green); box-shadow:0 4px 14px rgba(6,78,59,.14); outline:none; }
        .cm-product:active:not(.cm-product-habis) { transform:scale(.985); }
        .cm-product-habis { cursor:default; opacity:.72; }
        .cm-product-img { width:100%; height:110px; object-fit:cover; pointer-events:none; }
        .cm-product-img-ph { display:flex; align-items:center; justify-content:center; font-size:2.2rem; color:#fff; background:linear-gradient(135deg,var(--cm-dark),var(--cm-green)); }
        .cm-product-body { padding:10px 12px; display:flex; flex-direction:column; gap:4px; flex:1; }
        .cm-product-name { font-weight:700; font-size:0.92rem; line-height:1.3; }
        .cm-product-desc { font-size:0.74rem; color:var(--cm-muted); line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .cm-product-foot { display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:6px; }
        .cm-product-price { font-weight:800; color:var(--cm-green); font-size:0.9rem; }
        .cm-product-price small { font-size:0.68rem; color:var(--cm-muted); font-weight:400; }
        .cm-add-btn { width:34px; height:34px; border-radius:50%; border:0; background:var(--cm-green); color:#fff; font-size:1.2rem; display:inline-flex; align-items:center; justify-content:center; }
        .cm-habis { font-size:0.72rem; color:#ef4444; font-weight:600; }
        .cm-bill-bar { position:fixed; bottom:14px; left:50%; transform:translateX(-50%); width:min(92%, 600px); z-index:15; }
        .cm-bill-bar .cm-btn { width:100%; padding:15px; font-size:1rem; box-shadow:0 8px 24px rgba(6,78,59,.35); }
        .cm-section { padding:16px; }
        .cm-section-title { font-size:1.15rem; margin-bottom:12px; }
        .cm-muted { color:var(--cm-muted); font-size:0.85rem; }
        .cm-cart-item { background:#fff; border:1px solid var(--cm-border); border-radius:12px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px; }
        .cm-cart-name { font-weight:600; font-size:0.9rem; }
        .cm-cart-note { font-size:0.74rem; color:var(--cm-muted); }
        .cm-cart-price { font-size:0.85rem; color:var(--cm-green); font-weight:700; }
        .cm-qty { display:flex; align-items:center; gap:10px; }
        .cm-qty-btn { width:30px; height:30px; border-radius:8px; border:1px solid var(--cm-border); background:#fff; font-size:1rem; cursor:pointer; }
        .cm-qty-val { min-width:18px; text-align:center; font-weight:700; }
        .cm-bill { background:#fff; border:1px solid var(--cm-border); border-radius:12px; padding:12px 14px; margin-top:12px; }
        .cm-bill-row { display:flex; justify-content:space-between; font-size:0.95rem; padding:2px 0; }
        .cm-btn { border:0; border-radius:10px; padding:12px 16px; font-size:0.92rem; cursor:pointer; font-weight:600; }
        .cm-btn-primary { background:var(--cm-green); color:#fff; }
        .cm-btn-secondary { background:#fff; color:var(--cm-text); border:1px solid var(--cm-border); }
        .cm-btn:disabled { opacity:.55; cursor:not-allowed; }
        .cm-pay-options { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
        .cm-pay-opt { flex:1; min-width:100px; border:1px solid var(--cm-border); background:#fff; border-radius:10px; padding:12px 8px; font-size:0.85rem; cursor:pointer; text-align:center; }
        .cm-pay-opt.active { border-color:var(--cm-green); background:#ecfdf5; color:var(--cm-green); font-weight:700; }
        .cm-pay-hint { font-size:0.85rem; color:var(--cm-muted); line-height:1.5; margin-top:12px; text-align:center; }
        .cm-qris-box, .cm-bank-box { text-align:center; margin-top:12px; }
        .cm-qris-img { width:220px; height:220px; object-fit:contain; border:1px solid var(--cm-border); border-radius:12px; background:#fff; padding:8px; }
        .cm-bank { background:#fff; border:1px solid var(--cm-border); border-radius:10px; padding:10px 12px; margin:8px 0; text-align:left; }
        .cm-bank-num { font-size:1.15rem; font-weight:800; letter-spacing:.5px; margin:2px 0; }
        .cm-bank-name { font-size:0.8rem; color:var(--cm-muted); }
        .cm-order-id { font-size:1.35rem; font-weight:800; }
        .cm-status-meja { font-size:1rem; color:var(--cm-green); font-weight:700; margin-top:4px; }
        .cm-steps { display:flex; justify-content:space-between; gap:6px; margin:18px 0; }
        .cm-no-kitchen-msg { background:#f1f5f9; border:1px solid var(--cm-border); color:#334155; border-radius:12px; padding:12px 14px; text-align:center; font-size:0.85rem; margin-top:6px; }
        .cm-step { flex:1; text-align:center; }
        .cm-step-dot { width:30px; height:30px; border-radius:50%; margin:0 auto 6px; border:2px solid var(--cm-border); background:#fff; color:var(--cm-muted); display:flex; align-items:center; justify-content:center; font-size:0.9rem; }
        .cm-step.done .cm-step-dot { background:var(--cm-green); border-color:var(--cm-green); color:#fff; }
        .cm-step-label { font-size:0.72rem; color:var(--cm-muted); }
        .cm-step.done .cm-step-label { color:var(--cm-text); font-weight:600; }
        .cm-notify-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:12px; padding:12px; text-align:center; margin-top:16px; }
        .cm-chrome-box { background:#e0f2fe; border:1px solid #7dd3fc; border-radius:10px; padding:10px 12px; margin-top:10px; text-align:left; font-size:0.8rem; color:#075985; line-height:1.45; }
        .cm-chrome-box .cm-btn-chrome { display:block; width:100%; margin-top:8px; text-align:center; background:#1a73e8; color:#fff; text-decoration:none; }
        .cm-chrome-box .cm-btn-chrome:active { background:#1765cc; }
        .cm-notify-on { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:10px; padding:10px 12px; text-align:center; font-size:0.85rem; margin-top:14px; }
        .cm-ready-msg { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:12px; padding:14px; text-align:center; font-weight:700; margin-top:12px; }
        .cm-paid-msg { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:12px; padding:12px 14px; text-align:center; font-size:0.9rem; margin-top:6px; }
        /* F&B V1 — status ORDER DIBATALKAN (kitchen) */
        .cm-cancel-box { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:12px; padding:16px 14px; text-align:center; margin-top:6px; }
        .cm-cancel-box .cm-pay-hint { color:#991b1b; margin-top:6px; }
        .cm-cancel-partial { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:12px; padding:10px 12px; font-size:0.83rem; line-height:1.5; margin-top:6px; }
        .cm-proof-box { background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; border-radius:12px; padding:12px 14px; margin-top:6px; }
        .cm-proof-box .cm-pay-hint { margin-top:6px; text-align:left; }
        .cm-proof-rejected { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
        .cm-loading, .cm-center { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:60px 20px; text-align:center; }
        .cm-spinner { width:26px; height:26px; border:3px solid var(--cm-border); border-top-color:var(--cm-green); border-radius:50%; animation:cm-spin .8s linear infinite; }
        @keyframes cm-spin { to { transform:rotate(360deg); } }
        .cm-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:50; display:flex; align-items:flex-end; justify-content:center; }
        .cm-modal { background:#fff; width:100%; max-width:520px; border-radius:18px 18px 0 0; padding:18px 16px 22px; }
        .cm-modal-title { font-size:1.1rem; font-weight:800; }
        .cm-modal-sub { font-size:0.8rem; color:var(--cm-muted); margin:4px 0 12px; }
        .cm-varian-list { display:flex; flex-direction:column; gap:8px; }
        .cm-varian { display:flex; justify-content:space-between; border:1px solid var(--cm-border); background:#fff; border-radius:10px; padding:12px 14px; font-size:0.9rem; cursor:pointer; }
        .cm-varian span:last-child { color:var(--cm-green); font-weight:700; }
        /* QR MENU GATE — browser & notifikasi (Chrome-first) */
        .cm-gate { max-width:440px; margin:0 auto; padding:44px 22px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .cm-gate-icon { font-size:3rem; line-height:1; }
        .cm-gate-title { font-size:1.15rem; font-weight:800; margin:0; line-height:1.45; }
        .cm-gate-desc { font-size:0.88rem; color:var(--cm-muted); line-height:1.6; margin:0; max-width:340px; }
        .cm-gate .cm-btn { width:100%; max-width:320px; padding:14px; }
        .cm-gate .cm-btn-chrome { background:#1a73e8; color:#fff; text-decoration:none; }
        .cm-gate .cm-btn-chrome:active { background:#1765cc; }
        .cm-gate .cm-btn-wa { background:#25d366; color:#fff; text-decoration:none; }
        .cm-gate .cm-btn-wa:active { background:#1fb457; }
        .cm-btn-wa { background:#25d366; color:#fff; text-decoration:none; }
        .cm-btn-wa:active { background:#1fb457; }
        .cm-wa-nama { margin-top:12px; }
        .cm-wa-nama label { display:block; font-size:0.78rem; color:var(--cm-muted); margin-bottom:4px; }
        .cm-wa-nama input { width:100%; padding:10px 12px; border:1px solid var(--cm-border); border-radius:10px; font-size:0.9rem; box-sizing:border-box; }
        .cm-url-box { width:100%; max-width:320px; background:#fff; border:1px solid var(--cm-border); border-radius:10px; padding:8px 8px 8px 12px; display:flex; align-items:center; gap:8px; }
        .cm-url-text { flex:1; font-size:0.72rem; color:var(--cm-text); word-break:break-all; text-align:left; user-select:all; line-height:1.5; }
        .cm-url-box .cm-btn { width:auto; padding:9px 12px; font-size:0.76rem; flex-shrink:0; }
        .cm-gate-fallback { font-size:0.78rem; color:var(--cm-muted); margin:0; max-width:340px; }
        .cm-gate-table { background:#fff; border:1px solid var(--cm-border); border-radius:10px; padding:10px 16px; width:100%; max-width:320px; font-size:0.88rem; }
        .cm-gate-meja { font-size:1.05rem; font-weight:800; color:var(--cm-green); margin-top:2px; }
        .cm-gate-ios-hint { font-size:0.72rem; color:var(--cm-muted); line-height:1.55; max-width:340px; margin:0; }
        .cm-toast { position:fixed; bottom:80px; left:50%; transform:translateX(-50%) translateY(20px); background:#1e293b; color:#fff; padding:10px 16px; border-radius:10px; font-size:0.82rem; max-width:90%; text-align:center; opacity:0; transition:all .3s; z-index:60; pointer-events:none; }
        .cm-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
    `;
}

// Halaman ini dirender langsung ke #app (bukan #content) — tidak ada init
// lifecycle tambahan; initCustomerMenuPage dipanggil main.js setelah mount.
export default { CustomerMenuPage, initCustomerMenuPage };
