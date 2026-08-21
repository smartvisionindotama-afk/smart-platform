/**
 * QR Menu Meja Page — F&B Customer Ordering V1 (Admin/Owner).
 *
 * Admin melihat daftar meja (MEJA 01..04), membuat link QR Menu permanen,
 * salin link, preview, generate QR siap cetak, dan mencetak QR
 * (individu / SEMUA meja — template A4 beberapa QR per halaman).
 *
 * Link QR PERMANEN: https://pos.e-profit.id/m/{qrIdentifier}. QR TIDAK
 * berubah ketika dicetak ulang / preview / di-download (server mengembalikan
 * identifier yang sama — dibuat SEKALI).
 *
 * Gate: route & menu ber-capability "fnb" + permission pos.qr.manage.
 *
 * @module pos/pages/qr-menu
 */

import { showToast, Modal } from "@smart/ui";
import { esc, formatDateTime } from "@smart/core";
import {
    listQrTables,
    createQrTable,
    updateQrTable,
    deleteQrTable,
    createQrTableLink,
    disableQrTable
} from "../../data/qr-menu-data.js";
import { listWarehouse } from "../../data/index.js";
import { posDashboardCSS } from "../pos-styles.js";

const state = {
    loading: true,
    error: "",
    tables: [],
    warehouses: []
};

/** Generate QR data URI dari link (package qrcode — sudah dependency). */
async function qrDataUrl(text) {
    const QRCode = (await import("qrcode")).default;
    return QRCode.toDataURL(text, {
        width: 300,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "M"
    });
}

/**
 * Link QR permanen sebuah meja.
 * Prioritas: `qrLink` dari server; fallback derive dari `qrIdentifier`
 * (server lama belum mengirim qrLink di daftar — derive lokal tetap valid
 * karena origin = base URL yang sama).
 * @param {object} t Meja ({ qrLink?, qrIdentifier? })
 * @returns {string}
 */
function tableLink(t) {
    if (t && t.qrLink) return t.qrLink;
    if (t && t.qrIdentifier) return `${window.location.origin}/m/${t.qrIdentifier}`;
    return "";
}

export function QrMenuPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}
            .qm-toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px; }
            .qm-empty { padding:28px; text-align:center; color:var(--smart-text-secondary,#64748b); }
            /* M6-FIX — action QR Menu Link icon-only (32px) agar tiap baris tabel
               tetap satu baris: link-box tanpa wrap + input ringkas. */
            .qm-link-box { display:flex; align-items:center; gap:6px; flex-wrap:nowrap; }
            .qm-link-input { flex:0 1 auto; min-width:150px; max-width:240px; font-size:0.78rem; font-family:ui-monospace,monospace; padding:5px 8px; }
            .qm-badge-on { background:#dcfce7; color:#166534; padding:2px 10px; border-radius:999px; font-size:0.72rem; font-weight:600; }
            .qm-badge-off { background:#fee2e2; color:#991b1b; padding:2px 10px; border-radius:999px; font-size:0.72rem; font-weight:600; }
            [data-theme="dark"] .qm-badge-on { background:#065f4633; color:#6ee7b7; }
            [data-theme="dark"] .qm-badge-off { background:#991b1b33; color:#fecaca; }
            .cn-alert-danger { padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem; margin-bottom:12px; }
            .qm-icon-btn { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; font-size:0.95rem; transition:all .15s; }
            .qm-icon-btn:hover { background:#eef2ff; border-color:#c7d2fe; }
            .qm-icon-btn-danger:hover { background:#fef2f2; border-color:#fecaca; }
            .qm-icon-btn-primary { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); border-color:transparent; color:#fff; box-shadow:0 4px 12px rgba(72,106,224,0.35); }
            .qm-icon-btn-primary:hover { background:linear-gradient(135deg, #a935f4 0%, #3f80ff 100%); }
            [data-theme="dark"] .qm-icon-btn { background:#1e293b; border-color:#334155; color:#e2e8f0; }
            [data-theme="dark"] .qm-icon-btn:hover { background:#334155; border-color:#475569; }
            [data-theme="dark"] .qm-icon-btn-primary { background:linear-gradient(135deg, #b036ff 0%, #3f83ff 100%); border-color:transparent; color:#fff; }
            .qm-note { font-size:0.75rem; color:var(--smart-text-secondary,#64748b); line-height:1.45; }
            </style>
            <div class="page-header">
                <div>
                    <h1>QR Menu Meja</h1>
                    <p class="page-subtitle">QR Menu permanen per meja — customer scan untuk melihat menu & memesan (F&B V1)</p>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="smart-btn smart-btn-secondary" id="qm-print-all" title="Cetak QR SEMUA meja">🖨️ Cetak Semua</button>
                    <button class="smart-btn smart-btn-secondary" id="qm-refresh">↻ Refresh</button>
                    <button class="smart-btn smart-btn-primary" id="qm-add">+ Tambah Meja</button>
                </div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Daftar Meja</span></div>
                <div class="cn-card-body">
                    <p class="qm-note" style="margin-bottom:12px">Setiap meja memiliki satu QR Menu permanen. QR tidak berubah saat dicetak ulang — customer yang sama scan QR yang sama setiap kali memesan (order dibedakan oleh nomor order).</p>
                    <div id="qm-status"></div>
                    <div id="qm-table">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat meja...</div>` : ""}</div>
                </div>
            </div>
        </div>
    `;
}

function statusBadge(t) {
    return t.qrIdentifier
        ? (t.active !== false
            ? `<span class="qm-badge-on">● QR Aktif</span>`
            : `<span class="qm-badge-off">● QR Nonaktif</span>`)
        : `<span class="qm-badge-off">Belum ada QR</span>`;
}

function renderStatus(container) {
    const el = container.querySelector("#qm-status");
    if (!el) return;
    if (state.error) {
        el.innerHTML = `<div class="cn-alert-danger">${esc(state.error)}</div>`;
    } else {
        el.innerHTML = "";
    }
}

function renderTable(container) {
    const wrap = container.querySelector("#qm-table");
    if (!wrap) return;
    if (state.loading) {
        wrap.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat meja...</div>`;
        return;
    }
    if (!state.tables.length) {
        wrap.innerHTML = `<div class="qm-empty">Belum ada meja. Klik "+ Tambah Meja" untuk mendaftarkan meja pertama.</div>`;
        return;
    }
    const rows = state.tables.map(t => {
        const linkPart = t.qrIdentifier
            ? `
                <div class="qm-link-box">
                    <input class="smart-input qm-link-input" readonly value="${esc(tableLink(t))}" data-copy-link="${esc(String(t._id))}" />
                    <!-- M6-FIX — action icon-only (32px) agar baris tabel tidak bertumpuk -->
                    <button class="qm-icon-btn" data-copy="${esc(String(t._id))}" title="Salin link">📋</button>
                    <button class="qm-icon-btn" data-preview="${esc(String(t._id))}" title="Preview QR">👁️</button>
                    <button class="qm-icon-btn" data-genqr="${esc(String(t._id))}" title="Generate QR Code dari QR Menu Link">⬇️</button>
                    <button class="qm-icon-btn" data-print="${esc(String(t._id))}" title="Cetak QR meja ini">🖨️</button>
                    ${t.active !== false ? `<button class="qm-icon-btn qm-icon-btn-danger" data-disable="${esc(String(t._id))}" title="Nonaktifkan QR">⛔</button>` : ""}
                </div>
            `
            : `<button class="qm-icon-btn qm-icon-btn-primary" data-create-link="${esc(String(t._id))}" title="Buat Link QR Menu">🔗</button>`;
        const lokasi = t.lokasiNama || (t.lokasiId ? String(t.lokasiId) : "—");
        return `
            <tr>
                <td><strong>${esc(t.nomorMeja)}</strong></td>
                <td><span class="cn-muted">${esc(lokasi)}</span></td>
                <td>${statusBadge(t)}</td>
                <td>${linkPart}</td>
                <td>${tableLink(t) ? `<small class="cn-muted">${formatDateTime(t.updatedAt)}</small>` : `<small class="cn-muted">—</small>`}</td>
                <td>
                    <div style="display:flex;gap:6px">
                        <button class="qm-icon-btn" data-edit="${esc(String(t._id))}" title="Ubah meja">✏️</button>
                        <button class="qm-icon-btn qm-icon-btn-danger" data-delete="${esc(String(t._id))}" title="Hapus meja">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
    wrap.innerHTML = `
        <div class="dp-table-wrap">
            <table class="dp-table">
                <thead><tr>
                    <th>Meja</th><th>Lokasi</th><th>Status QR</th><th>QR Menu Link</th><th>Updated</th><th>Action</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    wrap.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", () => copyLink(container, btn.dataset.copy)));
    wrap.querySelectorAll("[data-preview]").forEach(btn => btn.addEventListener("click", () => previewQr(container, btn.dataset.preview)));
    wrap.querySelectorAll("[data-genqr]").forEach(btn => btn.addEventListener("click", () => previewQr(container, btn.dataset.genqr)));
    wrap.querySelectorAll("[data-print]").forEach(btn => btn.addEventListener("click", () => printQr(container, btn.dataset.print)));
    wrap.querySelectorAll("[data-disable]").forEach(btn => btn.addEventListener("click", () => doDisable(container, btn.dataset.disable)));
    wrap.querySelectorAll("[data-create-link]").forEach(btn => btn.addEventListener("click", () => doCreateLink(container, btn.dataset.createLink)));
    wrap.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openFormModal(container, btn.dataset.edit)));
    wrap.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => doDelete(container, btn.dataset.delete)));
}

async function load(container) {
    state.loading = true;
    state.error = "";
    renderStatus(container);
    renderTable(container);
    try {
        const [tableRes, whRes] = await Promise.all([
            listQrTables(),
            listWarehouse({ page: 1, limit: 999 }).catch(() => ({ data: [] }))
        ]);
        state.tables = Array.isArray(tableRes?.data) ? tableRes.data : [];
        state.warehouses = Array.isArray(whRes?.data) ? whRes.data : [];
        state.loading = false;
        renderStatus(container);
        renderTable(container);
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat daftar meja";
        renderStatus(container);
        renderTable(container);
    }
}

async function doCreateLink(container, id) {
    try {
        const res = await createQrTableLink(id);
        const link = res.qrLink || "";
        showToast("success", "Link QR Menu dibuat");
        await load(container);
        // Langsung preview setelah dibuat
        if (link) previewQr(container, id);
    } catch (err) {
        showToast("danger", err?.message || "Gagal membuat link QR");
    }
}

function copyLink(container, id) {
    const table = state.tables.find(t => String(t._id) === String(id));
    const link = table && tableLink(table);
    if (!link) return showToast("warning", "Link QR belum dibuat");
    try {
        navigator.clipboard.writeText(link).then(() => {
            showToast("success", "Link QR Menu disalin");
        }).catch(() => {
            // Fallback: select input
            const input = container.querySelector(`[data-copy-link="${esc(String(id))}"]`);
            if (input) { input.select(); document.execCommand("copy"); showToast("success", "Link QR Menu disalin"); }
        });
    } catch {
        showToast("warning", "Tidak dapat menyalin — salin manual dari kolom link");
    }
}

async function previewQr(container, id) {
    const table = state.tables.find(t => String(t._id) === String(id));
    if (!table || !tableLink(table)) return showToast("warning", "Link QR belum dibuat");
    let dataUrl = "";
    try {
        dataUrl = await qrDataUrl(table.qrLink);
    } catch (err) {
        console.warn("[QR Menu] Gagal generate QR:", err?.message);
        dataUrl = "";
    }
    const content = `
        <div style="text-align:center;padding:8px 0">
            <div style="font-size:1.4rem;font-weight:700;color:#667eea;margin-bottom:4px">${esc(table.nomorMeja)}</div>
            <div style="margin:10px auto;width:220px;height:220px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;border-radius:12px;background:#fff">
                ${dataUrl ? `<img src="${dataUrl}" alt="QR Menu ${esc(table.nomorMeja)}" style="width:200px;height:200px" />` : `<span class="cn-muted">QR</span>`}
            </div>
            <div style="margin-top:6px;font-size:0.8rem;word-break:break-all" class="cn-muted">${esc(tableLink(table))}</div>
            <p class="qm-note" style="margin-top:10px">QR bersifat permanen — scan kembali di lain waktu tetap menuju menu meja ini.</p>
            <p class="qm-note" style="margin-top:6px">💻 Versi <b>tablet (landscape)</b>: buka link di atas + <code>?tab=1</code> di tablet (mis. <code>${esc(tableLink(table))}?tab=1</code>), lalu Install PWA ke Home Screen — tampilan terkunci landscape untuk menu display / self-order.</p>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="qm-preview-close">Tutup</button>
        <button class="smart-btn smart-btn-secondary" id="qm-preview-download">⬇️ Download PNG</button>
        <button class="smart-btn smart-btn-primary" id="qm-preview-print">🖨️ Cetak QR Ini</button>
    `;
    const overlay = Modal({ open: true, title: `QR Menu — ${table.nomorMeja}`, content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#qm-preview-close").addEventListener("click", () => overlay.remove());
    // Prompt §8/§9 — download QR: TIDAK membuat link baru (identifier tetap sama),
    // hanya mengunduh gambar QR dari link permanen.
    overlay.querySelector("#qm-preview-download")?.addEventListener("click", () => {
        if (!dataUrl) return showToast("warning", "QR belum berhasil di-generate");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `qr-menu-${String(table.nomorMeja || "meja").replace(/[^A-Za-z0-9]+/g, "-")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("success", `QR Menu ${table.nomorMeja} diunduh`);
    });
    overlay.querySelector("#qm-preview-print").addEventListener("click", () => {
        overlay.remove();
        printQr(container, id);
    });
}

async function doDisable(container, id) {
    if (!window.confirm("Nonaktifkan QR menu meja ini? Customer akan melihat \"QR Menu tidak aktif\".")) return;
    try {
        await disableQrTable(id);
        showToast("success", "QR menu meja dinonaktifkan");
        load(container);
    } catch (err) {
        showToast("danger", err?.message || "Gagal menonaktifkan QR");
    }
}

async function doDelete(container, id) {
    if (!window.confirm("Hapus meja ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
        await deleteQrTable(id);
        showToast("success", "Meja dihapus");
        load(container);
    } catch (err) {
        showToast("danger", err?.message || "Gagal menghapus meja");
    }
}

function lokasiOptions(selectedId = "") {
    return `<option value="">— Lokasi default (gudang pertama) —</option>` + state.warehouses.map(w =>
        `<option value="${esc(String(w._id))}" ${String(w._id) === String(selectedId) ? "selected" : ""}>${esc(w.nama || w.kode || "")}</option>`
    ).join("");
}

async function openFormModal(container, id = null) {
    const table = id ? state.tables.find(t => String(t._id) === String(id)) : null;
    const content = `
        <p class="cn-muted">${table ? `Ubah meja \"${esc(table.nomorMeja)}\" — QR identifier TIDAK berubah.` : "Daftarkan meja baru untuk QR Menu."}</p>
        <div class="bl-form" style="margin-top:10px">
            <label for="qm-form-nomor">Nomor / Nama Meja</label>
            <input class="smart-input" id="qm-form-nomor" type="text" value="${table ? esc(table.nomorMeja) : ""}" placeholder="Contoh: MEJA 07" maxlength="40" />
            <label for="qm-form-lokasi">Lokasi</label>
            <select class="smart-input" id="qm-form-lokasi">${lokasiOptions(table ? table.lokasiId : "")}</select>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="qm-form-cancel">Batal</button>
        <button class="smart-btn smart-btn-primary" id="qm-form-save">${table ? "Simpan Perubahan" : "Tambah Meja"}</button>
    `;
    const overlay = Modal({ open: true, title: table ? `Edit Meja — ${table.nomorMeja}` : "Tambah Meja", content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);
    overlay.querySelector("#qm-form-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#qm-form-save").addEventListener("click", async () => {
        const nomorMeja = overlay.querySelector("#qm-form-nomor")?.value?.trim() || "";
        const lokasiId = overlay.querySelector("#qm-form-lokasi")?.value?.trim() || "";
        if (!nomorMeja) return showToast("warning", "Nomor meja wajib diisi");
        try {
            if (table) {
                await updateQrTable(id, { nomorMeja, lokasiId });
                showToast("success", `Meja \"${nomorMeja}\" diperbarui`);
            } else {
                const created = await createQrTable({ nomorMeja, lokasiId });
                showToast("success", `Meja \"${created.nomorMeja}\" ditambahkan — buat link QR Menu untuk mengaktifkannya`);
            }
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal menyimpan meja");
        }
    });
}

async function printQr(container, id) {
    const table = state.tables.find(t => String(t._id) === String(id));
    if (!table || !tableLink(table)) return showToast("warning", "Link QR belum dibuat");
    await printQrList(container, [table]);
}

async function printQrList(container, tables) {
    const withLink = tables.filter(t => tableLink(t));
    if (!withLink.length) return showToast("warning", "Belum ada meja dengan link QR — buat link QR terlebih dahulu");

    // Generate QR data URL utk semua meja terlebih dahulu
    const items = [];
    for (const t of withLink) {
        try {
            items.push({ nomorMeja: t.nomorMeja, qrLink: tableLink(t), dataUrl: await qrDataUrl(tableLink(t)) });
        } catch { /* skip gagal */ }
    }
    if (!items.length) return showToast("danger", "Gagal generate QR");

    const cards = items.map(({ nomorMeja, dataUrl }) => `
        <div class="qm-print-card">
            <div class="qm-print-logo"><img src="${dataUrl}" alt="QR Menu ${esc(nomorMeja)}" /></div>
            <div class="qm-print-title">QR MENU</div>
            <div class="qm-print-meja">${esc(nomorMeja)}</div>
            <div class="qm-print-hint">Scan untuk melihat menu<br/>dan melakukan pemesanan</div>
        </div>
    `).join("");

    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return showToast("warning", "Pop-up diblokir browser — izinkan pop-up untuk mencetak");
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>QR Menu — Cetak</title>
<style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 8mm; }
    .qm-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .qm-print-card { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10mm 6mm; text-align: center; page-break-inside: avoid; }
    .qm-print-logo { display: flex; justify-content: center; margin-bottom: 5mm; }
    .qm-print-logo img { width: 55mm; height: 55mm; }
    .qm-print-title { font-size: 13pt; font-weight: 700; letter-spacing: 2px; margin-bottom: 3mm; color:#334155; }
    .qm-print-meja { font-size: 19pt; font-weight: 700; color: #667eea; margin-bottom: 3mm; }
    .qm-print-hint { font-size: 9pt; color: #475569; line-height: 1.5; }
</style>
</head>
<body>
    <div class="qm-print-grid">${cards}</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
    }, 400);
}

export function initQrMenuPage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#qm-refresh")?.addEventListener("click", () => load(container));
    container.querySelector("#qm-add")?.addEventListener("click", () => openFormModal(container));
    container.querySelector("#qm-print-all")?.addEventListener("click", () => printQrList(container, state.tables));
    load(container);
}
