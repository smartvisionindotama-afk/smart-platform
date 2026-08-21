/**
 * Settings — Payment Settings (F&B Customer Ordering V1).
 *
 * Setting → Company → Payment Settings:
 *   - QRIS Company: upload gambar QRIS milik COMPANY (bukan SMART VISION).
 *   - Bank Accounts: maksimal 3 rekening AKTIF (enforcement server-side).
 *
 * Dipakai customer QR Menu pada saat checkout (QRIS → tampilkan gambar;
 * Transfer → tampilkan rekening aktif).
 *
 * Permission: settings.company.edit (Admin/Owner).
 *
 * @module pos/pages/settings/payment
 */

import { showToast, Modal } from "@smart/ui";
import { esc } from "@smart/core";
import {
    getCompanyQris,
    saveCompanyQris,
    disableCompanyQris,
    listBankAccounts,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount
} from "../../../data/payment-data.js";
import { posDashboardCSS } from "../../pos-styles.js";

const MAX_BANKS = 3;

const state = {
    loading: true,
    error: "",
    qris: null,          // { qrisImage, active }
    qrisImage: "",       // preview lokal
    accounts: [],
    saving: false
};

export function PaymentSettingsPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}
            .pay-card { border:1px solid var(--smart-border,#e2e8f0); border-radius:12px; background:var(--smart-card-bg,#fff); margin-bottom:16px; overflow:hidden; }
            .pay-card-header { padding:12px 16px; border-bottom:1px solid var(--smart-border,#e2e8f0); font-weight:700; display:flex; justify-content:space-between; align-items:center; }
            .pay-card-body { padding:16px; }
            .pay-qris-preview { width:200px; height:200px; border:1px dashed #cbd5e1; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#fff; }
            .pay-qris-preview img { width:100%; height:100%; object-fit:contain; }
            .pay-qris-empty { color:var(--smart-text-secondary,#64748b); font-size:0.82rem; text-align:center; padding:0 12px; }
            .pay-badge-on { background:#dcfce7; color:#166534; padding:2px 10px; border-radius:999px; font-size:0.72rem; font-weight:600; }
            .pay-badge-off { background:#f1f5f9; color:#64748b; padding:2px 10px; border-radius:999px; font-size:0.72rem; font-weight:600; }
            .pay-count { font-size:0.8rem; color:var(--smart-text-secondary,#64748b); }
            .pay-account-row { display:grid; grid-template-columns:1fr 1fr 1fr 90px 60px 90px; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--smart-border,#e2e8f0); font-size:0.85rem; }
            .cn-alert-danger { padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem; margin-bottom:12px; }
            .cn-alert-info { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; }
            [data-theme="dark"] .pay-card { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); }
            [data-theme="dark"] .cn-alert-info { background:#3730a333; border-color:#4338ca; color:#c7d2fe; }
            </style>
            <div class="page-header">
                <div>
                    <h1>Payment Settings</h1>
                    <p class="page-subtitle">QRIS Company & Rekening Bank — dipakai customer QR Menu saat checkout (F&B V1)</p>
                </div>
                <button class="smart-btn smart-btn-secondary" id="pay-refresh">↻ Refresh</button>
            </div>
            <div id="pay-status"></div>

            <div class="pay-card">
                <div class="pay-card-header">
                    <span>📱 QRIS Company</span>
                    <span class="pay-badge-on" id="pay-qris-badge">${state.qris && state.qris.active ? "● Aktif" : "● Belum Aktif"}</span>
                </div>
                <div class="pay-card-body">
                    <div style="display:flex;gap:16px;flex-wrap:wrap">
                        <div class="pay-qris-preview" id="pay-qris-preview">
                            ${state.qris && state.qris.qrisImage
                                ? `<img src="${esc(state.qris.qrisImage)}" alt="QRIS Company" />`
                                : `<span class="pay-qris-empty">QRIS Company belum diupload</span>`}
                        </div>
                        <div style="flex:1;min-width:220px">
                            <p class="cn-muted" style="font-size:0.8rem;margin-bottom:10px">Upload gambar QRIS milik perusahaan ini. QRIS ini ditampilkan kepada customer QR Menu yang memilih metode QRIS. BUKAN QRIS milik SMART VISION.</p>
                            <div style="display:flex;gap:8px;flex-wrap:wrap">
                                <button class="smart-btn smart-btn-secondary" id="pay-qris-upload">📤 Upload QRIS</button>
                                <input type="file" id="pay-qris-file" accept="image/*" style="display:none" />
                                ${state.qris && state.qris.qrisImage ? `<button class="smart-btn smart-btn-danger" id="pay-qris-remove">🗑️ Hapus / Nonaktifkan</button>` : ""}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pay-card">
                <div class="pay-card-header">
                    <span>🏦 Bank Accounts</span>
                    <button class="smart-btn smart-btn-primary" id="pay-bank-add">+ Tambah Rekening</button>
                </div>
                <div class="pay-card-body">
                    <p class="cn-muted pay-count" style="margin-bottom:10px">Maksimal <strong>${MAX_BANKS}</strong> rekening aktif. Rekening aktif ditampilkan kepada customer QR Menu yang memilih Transfer.</p>
                    <div id="pay-bank-list">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat rekening...</div>` : ""}</div>
                </div>
            </div>
        </div>
    `;
}

function renderStatus(container) {
    const el = container.querySelector("#pay-status");
    if (!el) return;
    el.innerHTML = state.error ? `<div class="cn-alert-danger">${esc(state.error)}</div>` : "";
}

function renderQris(container) {
    const badge = container.querySelector("#pay-qris-badge");
    const preview = container.querySelector("#pay-qris-preview");
    if (!badge || !preview) return;
    const hasImage = state.qris && state.qris.qrisImage;
    const active = hasImage && state.qris.active !== false;
    badge.textContent = active ? "● Aktif" : (hasImage ? "● Nonaktif" : "● Belum Aktif");
    badge.className = `pay-badge-${active ? "on" : "off"}`;
    preview.innerHTML = hasImage
        ? `<img src="${esc(state.qris.qrisImage)}" alt="QRIS Company" />`
        : `<span class="pay-qris-empty">QRIS Company belum diupload</span>`;
}

function renderBankList(container) {
    const el = container.querySelector("#pay-bank-list");
    if (!el) return;
    if (state.loading) {
        el.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat rekening...</div>`;
        return;
    }
    if (!state.accounts.length) {
        el.innerHTML = `<div class="cn-empty">Belum ada rekening bank. Tambahkan untuk metode pembayaran Transfer.</div>`;
        return;
    }
    el.innerHTML = `
        <div style="display:flex;flex-direction:column">
            ${state.accounts.map(a => `
                <div class="pay-account-row">
                    <span><strong>${esc(a.bankName)}</strong></span>
                    <span>${esc(a.accountNumber)}</span>
                    <span class="cn-muted">${esc(a.accountName)}</span>
                    <span>${a.active ? `<span class="pay-badge-on">Aktif</span>` : `<span class="pay-badge-off">Nonaktif</span>`}</span>
                    <button class="smart-btn smart-btn-secondary" style="padding:4px 10px;font-size:0.75rem" data-bank-edit="${esc(String(a._id))}">✏️</button>
                    <button class="smart-btn smart-btn-danger" style="padding:4px 10px;font-size:0.75rem" data-bank-del="${esc(String(a._id))}">🗑️</button>
                </div>
            `).join("")}
        </div>
    `;
    el.querySelectorAll("[data-bank-edit]").forEach(b => b.addEventListener("click", () => openBankModal(container, b.dataset.bankEdit)));
    el.querySelectorAll("[data-bank-del]").forEach(b => b.addEventListener("click", () => doDeleteBank(container, b.dataset.bankDel)));
}

async function load(container) {
    state.loading = true;
    state.error = "";
    renderStatus(container);
    renderBankList(container);
    try {
        const [qrisRes, bankRes] = await Promise.all([
            getCompanyQris(),
            listBankAccounts()
        ]);
        state.qris = qrisRes?.qris || null;
        state.accounts = Array.isArray(bankRes?.data) ? bankRes.data : [];
        state.loading = false;
        renderStatus(container);
        renderQris(container);
        renderBankList(container);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat payment settings";
        renderStatus(container);
        renderBankList(container);
    }
}

async function handleQrisUpload(container) {
    const fileInput = container.querySelector("#pay-qris-file");
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (!file.type.startsWith("image/")) {
        return showToast("warning", "File harus berupa gambar");
    }
    if (file.size > 5 * 1024 * 1024) {
        return showToast("warning", "Gambar terlalu besar (maks 5MB)");
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = String(e.target?.result || "");
        try {
            const saved = await saveCompanyQris(dataUrl);
            state.qris = saved;
            showToast("success", "QRIS Company tersimpan");
            renderQris(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal menyimpan QRIS");
        }
    };
    reader.readAsDataURL(file);
}

async function openBankModal(container, id = null) {
    const acc = id ? state.accounts.find(a => String(a._id) === String(id)) : null;
    const activeCount = state.accounts.filter(a => a.active).length;
    const content = `
        <p class="cn-muted">${acc ? `Ubah rekening ${esc(acc.bankName)} ${esc(acc.accountNumber)}` : `Tambah rekening (${activeCount}/${MAX_BANKS} aktif)`}</p>
        <div class="bl-form" style="margin-top:10px">
            <label for="pay-bank-name">Nama Bank</label>
            <input class="smart-input" id="pay-bank-name" type="text" value="${acc ? esc(acc.bankName) : ""}" placeholder="Contoh: Bank Mandiri" maxlength="60" />
            <label for="pay-bank-number">Nomor Rekening</label>
            <input class="smart-input" id="pay-bank-number" type="text" value="${acc ? esc(acc.accountNumber) : ""}" placeholder="Contoh: 123456789" maxlength="40" />
            <label for="pay-bank-holder">Atas Nama</label>
            <input class="smart-input" id="pay-bank-holder" type="text" value="${acc ? esc(acc.accountName) : ""}" placeholder="Contoh: PT ABC" maxlength="80" />
            <label style="display:flex;align-items:center;gap:8px;margin-top:8px">
                <input type="checkbox" id="pay-bank-active" ${acc ? (acc.active ? "checked" : "") : "checked"} />
                <span>Aktif (ditampilkan ke customer)</span>
            </label>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="pay-bank-cancel">Batal</button>
        <button class="smart-btn smart-btn-primary" id="pay-bank-save">${acc ? "Simpan Perubahan" : "Tambah Rekening"}</button>
    `;
    const overlay = Modal({ open: true, title: acc ? "Edit Rekening" : "Tambah Rekening", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#pay-bank-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#pay-bank-save").addEventListener("click", async () => {
        const bankName = overlay.querySelector("#pay-bank-name")?.value?.trim() || "";
        const accountNumber = overlay.querySelector("#pay-bank-number")?.value?.trim() || "";
        const accountName = overlay.querySelector("#pay-bank-holder")?.value?.trim() || "";
        const active = overlay.querySelector("#pay-bank-active")?.checked ?? true;
        if (!bankName || !accountNumber || !accountName) {
            return showToast("warning", "Nama bank, nomor rekening, dan atas nama wajib diisi");
        }
        try {
            if (acc) {
                await updateBankAccount(id, { bankName, accountNumber, accountName, active });
                showToast("success", "Rekening diperbarui");
            } else {
                await createBankAccount({ bankName, accountNumber, accountName, active });
                showToast("success", "Rekening ditambahkan");
            }
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal menyimpan rekening");
        }
    });
}

async function doDeleteBank(container, id) {
    if (!window.confirm("Hapus rekening ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
        await deleteBankAccount(id);
        showToast("success", "Rekening dihapus");
        load(container);
    } catch (err) {
        showToast("danger", err?.message || "Gagal menghapus rekening");
    }
}

export function initPaymentSettingsPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#pay-refresh")?.addEventListener("click", () => load(container));
    container.querySelector("#pay-qris-upload")?.addEventListener("click", () => {
        container.querySelector("#pay-qris-file")?.click();
    });
    container.querySelector("#pay-qris-file")?.addEventListener("change", () => handleQrisUpload(container));
    container.querySelector("#pay-qris-remove")?.addEventListener("click", async () => {
        if (!window.confirm("Nonaktifkan QRIS Company? Customer tidak akan melihat QRIS ini.")) return;
        try {
            await disableCompanyQris();
            state.qris = { ...state.qris, active: false };
            showToast("success", "QRIS dinonaktifkan");
            renderQris(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal menonaktifkan QRIS");
        }
    });
    container.querySelector("#pay-bank-add")?.addEventListener("click", () => openBankModal(container));
    load(container);
}
