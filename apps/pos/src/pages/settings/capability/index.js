/**
 * Settings — Transaction Capabilities (M6.1).
 *
 * Admin mengatur jenis transaksi yang boleh dilakukan kasir (capability):
 *   ☑ Retail   ☑ F&B   ☐ Jasa   ☐ PPOB  (+ registry @smart/core)
 *
 * Source of truth: backend (Company.transactionTypes) — BUKAN localStorage.
 * Halaman ini memakai API GET/PUT /api/pos/settings/transaction-capabilities
 * dengan state loading / error / success, komponen SMART UI (Switch =
 * checkbox), dan daftar capability dari registry @smart/core (satu sumber).
 *
 * Hak akses: settings.company.edit (Admin/Owner — kasir tidak punya).
 *
 * @module pos/pages/settings/capability
 */

import { showToast, Switch } from "@smart/ui";
import { esc, TRANSACTION_TYPES } from "@smart/core";
import { getTransactionCapabilities, setTransactionCapabilities } from "../../../data/index.js";
import { posDashboardCSS } from "../../pos-styles.js";

const state = {
    loading: true,
    error: "",
    saving: false,
    enabled: []      // daftar capability yang diaktifkan (array string)
};

export function CapabilityPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}
            .cap-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; }
            .cap-item { display:flex; flex-direction:column; gap:4px; padding:10px 12px; border:1px solid var(--smart-border,#e2e8f0); border-radius:8px; background:var(--smart-card-bg,#fff); }
            .cap-item .smart-switch-wrapper { justify-content:flex-start; }
            .cap-item-desc { font-size:0.72rem; color:var(--smart-text-secondary,#64748b); line-height:1.4; }
            .cn-alert { padding:10px 14px; border-radius:8px; font-size:0.82rem; margin-bottom:12px; }
            .cn-alert-info { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; }
            .cn-alert-danger { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }
            .cn-spinner { display:inline-block; width:14px; height:14px; border:2px solid var(--smart-border,#e2e8f0); border-top-color:var(--smart-primary,#667eea); border-radius:50%; animation:cap-spin 0.7s linear infinite; vertical-align:-2px; margin-right:6px; }
            @keyframes cap-spin { to { transform:rotate(360deg); } }
            [data-theme="dark"] .cap-item { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); }
            [data-theme="dark"] .cn-alert-info { background:#3730a333; border-color:#4338ca; color:#c7d2fe; }
            [data-theme="dark"] .cn-alert-danger { background:#7f1d1d33; border-color:#991b1b; color:#fecaca; }
            </style>
            <div class="page-header">
                <div>
                    <h1>Transaction Capabilities</h1>
                    <p class="page-subtitle">Pilih jenis transaksi yang digunakan oleh bisnis ini (M6.1)</p>
                </div>
                <button class="smart-btn smart-btn-secondary" id="cap-refresh">↻ Refresh</button>
            </div>
            <div class="cn-card" style="max-width:720px">
                <div class="cn-card-header"><span class="cn-card-title">Jenis Transaksi yang Diaktifkan</span></div>
                <div class="cn-card-body">
                    <div id="cap-status"></div>
                    <div id="cap-body">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat konfigurasi...</div>` : ""}</div>
                </div>
            </div>
        </div>
    `;
}

function renderStatus(container) {
    const el = container.querySelector("#cap-status");
    if (!el) return;
    if (state.loading) {
        el.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat konfigurasi...</div>`;
        return;
    }
    if (state.error) {
        el.innerHTML = `<div class="cn-alert cn-alert-danger">${esc(state.error)}</div>`;
        return;
    }
    el.innerHTML = `<div class="cn-alert cn-alert-info">Tersimpan: <strong>${state.enabled.length ? esc(state.enabled.join(", ")) : "(tidak ada jenis transaksi aktif)"}</strong></div>`;
}

function renderBody(container) {
    const el = container.querySelector("#cap-body");
    if (!el) return;
    if (state.loading) {
        el.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat konfigurasi...</div>`;
        return;
    }
    if (state.error) {
        el.innerHTML = `<p class="cn-muted">Gagal memuat konfigurasi. Periksa koneksi lalu coba refresh.</p>`;
        return;
    }
    el.innerHTML = `
        <div class="cn-muted" style="margin-bottom:12px">Capability yang diaktifkan menentukan workflow/menu transaksi yang tersedia bagi kasir. Perubahan tersimpan di server (konfigurasi perusahaan).</div>
        <div class="cap-grid" id="cap-toggles"></div>
        <div style="display:flex;gap:10px;margin-top:18px">
            <button class="smart-btn smart-btn-primary" id="cap-save" ${state.saving ? "disabled" : ""}>${state.saving ? "Menyimpan..." : "Simpan Perubahan"}</button>
            <button class="smart-btn smart-btn-secondary" id="cap-cancel">Batal</button>
        </div>
    `;
    const grid = el.querySelector("#cap-toggles");
    grid.innerHTML = TRANSACTION_TYPES.map(cap => {
        const checked = state.enabled.includes(cap.key);
        const sw = Switch({
            label: cap.label,
            name: `cap-${cap.key}`,
            checked
        });
        return `
            <div class="cap-item" title="${esc(cap.description)}">
                <div class="cap-item-switch">${sw.outerHTML}</div>
                <span class="cap-item-desc">${esc(cap.description)}</span>
            </div>
        `;
    }).join("");
    el.querySelector("#cap-save")?.addEventListener("click", () => save(container));
    el.querySelector("#cap-cancel")?.addEventListener("click", () => load(container));
}

async function load(container) {
    state.loading = true;
    state.error = "";
    renderStatus(container);
    renderBody(container);
    try {
        const res = await getTransactionCapabilities();
        state.enabled = Array.isArray(res?.transactionTypes) ? res.transactionTypes : [];
        state.loading = false;
        renderStatus(container);
        renderBody(container);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat konfigurasi";
        renderStatus(container);
        renderBody(container);
    }
}

async function save(container) {
    const enabled = TRANSACTION_TYPES
        .filter(cap => container.querySelector(`[name="cap-${cap.key}"]`)?.checked)
        .map(cap => cap.key);
    state.saving = true;
    renderBody(container);
    try {
        const res = await setTransactionCapabilities(enabled);
        state.enabled = Array.isArray(res?.transactionTypes) ? res.transactionTypes : enabled;
        state.saving = false;
        state.error = "";
        renderStatus(container);
        renderBody(container);
        showToast("success", "Transaction capabilities tersimpan");
    } catch (err) {
        state.saving = false;
        state.error = err?.message || "Gagal menyimpan konfigurasi";
        renderStatus(container);
        renderBody(container);
        showToast("danger", state.error);
    }
}

export function initCapabilityPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#cap-refresh")?.addEventListener("click", () => load(container));
    load(container);
}
