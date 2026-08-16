/**
 * Settings — Konfigurasi WhatsApp (F&B V1).
 *
 * Admin mengatur gateway WhatsApp untuk kirim notifikasi status order
 * otomatis ke customer (diterima, siap, pembayaran dikonfirmasi, batal,
 * refund) via provider API (default: Sidobe).
 *
 *   Gateway Settings
 *     Provider API URL          https://api.sidobe.com/wa/v1/send-message
 *     Secret Key (X-Secret-Key) ••••••••
 *     Nomor Pengirim (Optional) 08xxxxxxxxxx
 *
 * Secret key TIDAK pernah dikembalikan server (hanya hasSecretKey) —
 * form menampilkan placeholder terkunci; kosongkan input utk mempertahankan
 * secret yang sudah ada, atau centang "Hapus Secret Key" utk menghapusnya.
 *
 * Endpoint: GET/PUT /api/pos/settings/wa
 * Permission: settings.company.edit (Admin/Owner).
 *
 * @module pos/pages/settings/wa
 */

import { showToast, Modal } from "@smart/ui";
import { esc } from "@smart/core";
import { getWaSettings, setWaSettings, testWaSettings } from "../../../data/index.js";
import { posDashboardCSS } from "../../pos-styles.js";

const DEFAULT_PROVIDER_URL = "https://api.sidobe.com/wa/v1/send-message";

const state = {
    loading: true,
    error: "",
    saving: false,
    saved: false,
    wa: {
        providerUrl: DEFAULT_PROVIDER_URL,
        hasSecretKey: false,
        senderNumber: ""
    }
};

export function WaSettingsPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}
            .wa-card { border:1px solid var(--smart-border,#e2e8f0); border-radius:12px; background:var(--smart-card-bg,#fff); max-width:680px; }
            .wa-card-header { padding:12px 16px; border-bottom:1px solid var(--smart-border,#e2e8f0); font-weight:700; display:flex; align-items:center; gap:8px; }
            .wa-card-body { padding:18px 16px; }
            .wa-field { margin-bottom:16px; }
            .wa-field label { display:block; font-size:0.8rem; font-weight:600; color:var(--smart-text,#0f172a); margin-bottom:5px; }
            .wa-field .wa-hint { font-size:0.72rem; color:var(--smart-text-secondary,#64748b); margin-top:4px; line-height:1.45; }
            .wa-field input { width:100%; padding:10px 12px; border:1px solid var(--smart-border,#cbd5e1); border-radius:8px; font-size:0.88rem; box-sizing:border-box; background:var(--smart-card-bg,#fff); color:var(--smart-text,#0f172a); }
            .wa-sec-label { display:flex; justify-content:space-between; align-items:center; }
            .wa-sec-label .wa-badge { font-size:0.68rem; font-weight:600; padding:2px 8px; border-radius:999px; }
            .wa-badge-on { background:#dcfce7; color:#166534; }
            .wa-badge-off { background:#f1f5f9; color:#64748b; }
            .wa-clear-row { display:flex; align-items:center; gap:8px; font-size:0.78rem; color:var(--smart-text-secondary,#64748b); margin-top:6px; }
            .cn-alert { padding:10px 14px; border-radius:8px; font-size:0.82rem; margin-bottom:12px; }
            .cn-alert-info { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; }
            .cn-alert-danger { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }
            .cn-alert-success { background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; }
            .cn-spinner { display:inline-block; width:14px; height:14px; border:2px solid var(--smart-border,#e2e8f0); border-top-color:var(--smart-primary,#059669); border-radius:50%; animation:wa-spin 0.7s linear infinite; vertical-align:-2px; margin-right:6px; }
            @keyframes wa-spin { to { transform:rotate(360deg); } }
            [data-theme="dark"] .wa-card { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); }
            [data-theme="dark"] .wa-field label { color:#e2e8f0; }
            [data-theme="dark"] .wa-field input { background:#0f172a; border-color:#334155; color:#e2e8f0; }
            [data-theme="dark"] .cn-alert-info { background:#064e3b33; border-color:#065f46; color:#a7f3d0; }
            [data-theme="dark"] .cn-alert-danger { background:#7f1d1d33; border-color:#991b1b; color:#fecaca; }
            [data-theme="dark"] .cn-alert-success { background:#14532d33; border-color:#166534; color:#bbf7d0; }
            </style>
            <div class="page-header">
                <div>
                    <h1>Konfigurasi WhatsApp</h1>
                    <p class="page-subtitle">Gateway notifikasi status order otomatis ke customer (F&B V1)</p>
                </div>
                <button class="smart-btn smart-btn-secondary" id="wa-refresh">↻ Refresh</button>
            </div>
            <div id="wa-status"></div>

            <div class="wa-card">
                <div class="wa-card-header">⚙️ Gateway Settings</div>
                <div class="wa-card-body">
                    <div class="wa-field">
                        <label for="wa-provider-url">Provider API URL</label>
                        <input type="text" id="wa-provider-url" placeholder="${esc(DEFAULT_PROVIDER_URL)}" autocomplete="off" spellcheck="false" />
                        <div class="wa-hint">Endpoint API pengirim pesan WhatsApp. Kosongkan utk memakai default (Sidobe).</div>
                    </div>
                    <div class="wa-field">
                        <div class="wa-sec-label">
                            <label for="wa-secret-key" style="margin-bottom:0">Secret Key (X-Secret-Key)</label>
                            <span id="wa-secret-badge" class="wa-badge wa-badge-off">● Belum diisi</span>
                        </div>
                        <input type="password" id="wa-secret-key" placeholder="${state.wa.hasSecretKey ? "•••••••• (secret tersimpan — biarkan kosong utk mempertahankan)" : "Masukkan secret key dari provider"}" autocomplete="new-password" spellcheck="false" style="margin-top:5px" />
                        <div class="wa-hint">Diisi dari dashboard provider (mis. Sidobe → Developer Tools → Credential). Biarkan kosong saat simpan utk mempertahankan secret yang sudah ada.</div>
                        <div class="wa-clear-row">
                            <input type="checkbox" id="wa-clear-secret" />
                            <label for="wa-clear-secret" style="margin:0">Hapus Secret Key yang tersimpan</label>
                        </div>
                    </div>
                    <div class="wa-field">
                        <label for="wa-sender-number">Nomor Pengirim</label>
                        <input type="tel" id="wa-sender-number" placeholder="08xxxxxxxxxx" autocomplete="tel" inputmode="tel" />
                        <div class="wa-hint">Nomor WhatsApp restoran ini. Dipakai customer saat checkout (wa.me menerima pesanan) dan sebagai nomor pengirim notifikasi status order ke customer. Menggantikan field "No. WhatsApp (QR Menu)" di Settings → Company.</div>
                    </div>
                    <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
                        <button class="smart-btn smart-btn-primary" id="wa-save" ${state.saving ? "disabled" : ""}>${state.saving ? "Menyimpan..." : "Simpan Konfigurasi"}</button>
                        <button class="smart-btn smart-btn-secondary" id="wa-test">📨 Test Koneksi</button>
                        <button class="smart-btn smart-btn-secondary" id="wa-cancel">Batal</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderStatus(container) {
    const el = container.querySelector("#wa-status");
    if (!el) return;
    if (state.loading) {
        el.innerHTML = `<div class="cn-alert cn-alert-info"><span class="cn-spinner"></span> Memuat konfigurasi...</div>`;
        return;
    }
    if (state.error) {
        el.innerHTML = `<div class="cn-alert cn-alert-danger">${esc(state.error)}</div>`;
        return;
    }
    if (state.saved) {
        el.innerHTML = `<div class="cn-alert cn-alert-success">✓ Konfigurasi WhatsApp tersimpan. Notifikasi status order akan dikirim via provider ini.</div>`;
        return;
    }
    el.innerHTML = `<div class="cn-alert cn-alert-info">Notifikasi status order (diterima, siap, pembayaran dikonfirmasi, batal, refund) dikirim ke nomor WhatsApp customer melalui gateway ini.</div>`;
}

function renderSecretBadge(container) {
    const badge = container.querySelector("#wa-secret-badge");
    if (!badge) return;
    badge.textContent = state.wa.hasSecretKey ? "● Tersimpan" : "● Belum diisi";
    badge.className = `wa-badge ${state.wa.hasSecretKey ? "wa-badge-on" : "wa-badge-off"}`;
}

function syncForm(container) {
    const url = container.querySelector("#wa-provider-url");
    const phone = container.querySelector("#wa-sender-number");
    if (url) url.value = state.wa.providerUrl || DEFAULT_PROVIDER_URL;
    if (phone) phone.value = state.wa.senderNumber || "";
    renderSecretBadge(container);
}

async function load(container) {
    state.loading = true;
    state.error = "";
    state.saved = false;
    renderStatus(container);
    try {
        const res = await getWaSettings();
        state.wa = Object.assign({}, state.wa, res?.wa || {});
        state.loading = false;
        renderStatus(container);
        syncForm(container);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat konfigurasi";
        renderStatus(container);
        syncForm(container);
    }
}

const TEST_MESSAGE = "Test koneksi WhatsApp dari SMART Kasir ✅";

/**
 * Test Koneksi — kirim pesan uji ke nomor tujuan.
 * Memakai NILAI FORM saat ini (bisa belum disimpan) → server mengirim via
 * gateway dan mengembalikan hasil; konfigurasi TIDAK diubah.
 */
async function openTestModal(container) {
    const content = `
        <p class="cn-muted">Kirim pesan uji coba ke nomor WhatsApp Anda untuk memastikan gateway terhubung. Memakai nilai form saat ini — belum perlu disimpan.</p>
        <div class="bl-form" style="margin-top:10px">
            <label for="wa-test-phone">No. Tujuan</label>
            <input class="smart-input" id="wa-test-phone" type="tel" placeholder="08xxxxxxxxxx — nomor yang akan menerima pesan uji" autocomplete="tel" inputmode="tel" />
            <label for="wa-test-message" style="margin-top:12px">Pesan (opsional)</label>
            <textarea class="smart-input" id="wa-test-message" rows="3" placeholder="Pesan uji coba...">${esc(TEST_MESSAGE)}</textarea>
            <div id="wa-test-result" style="margin-top:12px"></div>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="wa-test-close">Tutup</button>
        <button class="smart-btn smart-btn-primary" id="wa-test-send">Kirim Pesan Uji</button>
    `;
    const overlay = Modal({
        open: true,
        title: "📨 Test Koneksi WhatsApp",
        content,
        footer,
        closable: true,
        onClose: () => overlay?.remove?.()
    });
    document.body.appendChild(overlay);
    overlay.querySelector("#wa-test-close")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector("#wa-test-send")?.addEventListener("click", async () => {
        const phone = String(overlay.querySelector("#wa-test-phone")?.value || "").trim();
        const message = String(overlay.querySelector("#wa-test-message")?.value || "").trim() || TEST_MESSAGE;
        const result = overlay.querySelector("#wa-test-result");
        if (!phone) {
            if (result) result.innerHTML = `<div class="cn-alert cn-alert-danger">Nomor tujuan wajib diisi.</div>`;
            return;
        }
        const sendBtn = overlay.querySelector("#wa-test-send");
        if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "Mengirim..."; }
        if (result) result.innerHTML = `<div class="cn-alert cn-alert-info">Mengirim pesan uji...</div>`;
        try {
            // Nilai form saat ini (bisa belum disimpan) — biar test akurat.
            const providerUrl = String(container.querySelector("#wa-provider-url")?.value || "").trim();
            const secretKey = String(container.querySelector("#wa-secret-key")?.value || "").trim();
            const senderNumber = String(container.querySelector("#wa-sender-number")?.value || "").trim();
            const res = await testWaSettings({ phone, message, providerUrl, secretKey, senderNumber });
            if (result) result.innerHTML = `<div class="cn-alert cn-alert-success">✓ ${esc(res?.message || "Pesan uji coba terkirim")}</div>`;
        } catch (err) {
            if (result) result.innerHTML = `<div class="cn-alert cn-alert-danger">✗ ${esc(err?.message || "Gagal mengirim pesan uji")}</div>`;
        } finally {
            if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "Kirim Pesan Uji"; }
        }
    });
}

async function save(container) {
    const providerUrl = String(container.querySelector("#wa-provider-url")?.value || "").trim();
    const secretKey = String(container.querySelector("#wa-secret-key")?.value || "").trim();
    const senderNumber = String(container.querySelector("#wa-sender-number")?.value || "").trim();
    const clearSecretKey = container.querySelector("#wa-clear-secret")?.checked === true;

    if (providerUrl && !/^https?:\/\//i.test(providerUrl)) {
        return showToast("warning", "Provider API URL harus diawali http(s)://");
    }
    if (clearSecretKey && secretKey) {
        return showToast("warning", "Tidak bisa mengisi secret baru sekaligus mencentang 'Hapus Secret Key'");
    }

    state.saving = true;
    renderBody(container);
    try {
        await setWaSettings({ providerUrl, secretKey, senderNumber, clearSecretKey });
        state.saving = false;
        state.error = "";
        state.saved = true;
        // Form disetel ulang: secret baru TIDAK di-refresh (server tidak
        // mengembalikannya), hanya flag ada/tidak + URL + sender.
        state.wa = Object.assign({}, state.wa, {
            providerUrl,
            senderNumber,
            hasSecretKey: clearSecretKey ? false : (secretKey ? true : state.wa.hasSecretKey)
        });
        renderStatus(container);
        renderBody(container);
        syncForm(container);
        showToast("success", "Konfigurasi WhatsApp tersimpan");
    } catch (err) {
        state.saving = false;
        state.error = err?.message || "Gagal menyimpan konfigurasi";
        renderStatus(container);
        renderBody(container);
        showToast("danger", state.error);
    }
}

function renderBody(container) {
    const card = container.querySelector(".wa-card");
    if (!card) return;
    const btn = card.querySelector("#wa-save");
    if (!btn) return;
    btn.disabled = state.saving;
    btn.textContent = state.saving ? "Menyimpan..." : "Simpan Konfigurasi";
}

export function initWaSettingsPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#wa-refresh")?.addEventListener("click", () => load(container));
    container.querySelector("#wa-save")?.addEventListener("click", () => save(container));
    container.querySelector("#wa-test")?.addEventListener("click", () => openTestModal(container));
    container.querySelector("#wa-cancel")?.addEventListener("click", () => load(container));
    load(container);
}
