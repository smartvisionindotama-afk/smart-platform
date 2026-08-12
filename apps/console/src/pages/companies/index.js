/**
 * SMART Console — Companies Page.
 *
 * SP-027 M1: halaman Companies memakai API yang sudah ada
 * (services/companies.js) + Search, Pagination, Filter Active/Suspended,
 * Detail Company, Company Logo, Registered Apps, Company Status.
 *
 * @module console/pages/companies
 */

import { Table, Modal, Input, Select, Switch, showToast } from "@smart/ui";
import { COMPANY_TYPES } from "@smart/core";
import {
    listCompanies,
    getCompany,
    updateCompany,
    deleteCompany,
    createCompany,
    listBusinessTypes
} from "../../services/companies.js";
import { startImpersonation } from "../../services/impersonation.js";
import { listProvinces, listRegencies, listDistricts, listVillages } from "../../services/wilayah.js";
import { listApplications } from "../../services/applications.js";
import { companyBillingSummary } from "../../services/billing.js";
import { APPS_REGISTRY } from "../../config/index.js";
import { pageHeader, loadingHTML, esc, statusBadge, formatDateTime, mountPagination } from "../_shared.js";

let currentFilter = { page: 1, limit: 10, search: "", status: "all" };

// SP-027 PRE-M5 round 4-5: akses company→app dibaca dari SERVER (Company.apps),
// dan daftar aplikasi yang tersedia juga dari SERVER (Application collection),
// bukan state in-memory @smart/core platform (yang tidak pernah di-load dan
// hilang saat refresh). Aplikasi baru yang ditambahkan via menu Applications
// otomatis muncul di toggle "Akses Aplikasi".

// Cache daftar aplikasi dari server (slug → app) — dimuat saat render.
let _appListCache = [];

// Cache katalog business type (SP-029 M2) — dimuat saat edit modal.
let _businessTypeCache = null;

async function loadAppList() {
    try {
        const res = await listApplications({ page: 1, limit: 999, status: "all" });
        _appListCache = res?.data || [];
    } catch {
        _appListCache = APPS_REGISTRY.map(a => ({ ...a }));
    }
    return _appListCache;
}

function appsFromCompany(company) {
    if (!company || !Array.isArray(company.apps)) return [];
    return company.apps;
}

/**
 * Aplikasi yang terhubung ke company DAN aktif di registry (server-first,
 * fallback APPS_REGISTRY). Hanya aplikasi ini yang valid untuk Login As —
 * impersonation ke aplikasi nonaktif ditolak server (404).
 * @param {object} row Dokumen company
 * @returns {object[]} Daftar aplikasi aktif (slug, name, icon, domain, ...)
 */
function activeConnectedApps(row) {
    const slugs = appsFromCompany(row);
    if (!slugs.length) return [];
    const registry = _appListCache.length ? _appListCache : APPS_REGISTRY;
    return registry.filter(app => app.active !== false && slugs.includes(app.slug));
}

function appNameBySlug(slug) {
    const app = _appListCache.find(a => a.slug === slug)
        || APPS_REGISTRY.find(a => a.slug === slug);
    return app ? app.name : slug;
}

function companyAppsBadges(row) {
    const slugs = appsFromCompany(row);
    return slugs.length
        ? slugs.map(s => `<span class="smart-badge smart-badge-info">${esc(appNameBySlug(s))}</span>`).join(" ")
        : `<span class="cn-muted">—</span>`;
}

async function renderTable(container) {
    const wrap = container.querySelector("#cn-companies-table");
    if (!wrap) return;

    wrap.innerHTML = loadingHTML();

    // Muat daftar aplikasi dari server (untuk badge & toggle) — refresh cache
    await loadAppList();

    // Ambil seluruh data (limit 999) lalu filter + paginate lokal agar
    // filter status (active/suspended) konsisten tanpa bergantung server.
    const all = await listCompanies({ page: 1, limit: 999, search: currentFilter.search });
    let rows = all?.data || [];
    if (currentFilter.status === "active") rows = rows.filter(c => c.active);
    if (currentFilter.status === "inactive") rows = rows.filter(c => !c.active);

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / currentFilter.limit));
    const page = Math.min(currentFilter.page, totalPages);
    const start = (page - 1) * currentFilter.limit;
    const data = rows.slice(start, start + currentFilter.limit);

    const columns = [
        {
            key: "code",
            label: "Kode",
            render: (v, row) => `
                <span class="cn-company-cell">
                    ${row.logo
                        ? `<img class="cn-company-logo" src="${esc(row.logo)}" alt="" />`
                        : `<span class="cn-company-logo cn-company-logo-ph">${esc((row.name || "?").charAt(0))}</span>`}
                    <span><strong>${esc(row.code)}</strong><br/><small class="cn-muted">${esc(row.name)}</small></span>
                </span>`
        },
        { key: "name", label: "Nama" },
        { key: "jenis", label: "Jenis" },
        { key: "email", label: "Email" },
        {
            key: "active",
            label: "Status",
            render: (v) => statusBadge(v, "Active", "Suspended")
        },
        {
            key: "apps",
            label: "Registered Apps",
            render: (_, row) => companyAppsBadges(row)
        },
        {
            key: "actions",
            label: "Action",
            render: (_, row) => {
                // Login As SELALU bisa diklik — jika company belum terhubung ke
                // aplikasi, handler menampilkan toast penjelasan (daripada tombol
                // disabled yang tidak memberi tahu kenapa). Konsisten dgn server:
                // impersonation-token → 403 jika tidak punya akses.
                const loginAsBtn = activeConnectedApps(row).length > 0
                    ? `<button class="smart-btn smart-btn-primary" data-act="login-as" data-code="${esc(row.code)}" data-name="${esc(row.name)}">Login As</button>`
                    : `<button class="smart-btn smart-btn-secondary" data-act="login-as" data-code="${esc(row.code)}" data-name="${esc(row.name)}" title="Company belum terhubung ke aplikasi aktif">Login As</button>`;
                return `
                <div class="cn-actions">
                    ${loginAsBtn}
                    <button class="smart-btn smart-btn-secondary" data-act="detail" data-id="${esc(row.id)}">Detail</button>
                    <button class="smart-btn smart-btn-secondary" data-act="billing" data-id="${esc(row.id)}" title="Billing & subscription">Billing</button>
                    <button class="smart-btn smart-btn-secondary" data-act="edit" data-id="${esc(row.id)}">Edit</button>
                    <button class="smart-btn smart-btn-danger" data-act="delete" data-id="${esc(row.id)}" data-name="${esc(row.name)}">Hapus</button>
                </div>
            `;
            }
        }
    ];

    const tableEl = Table({ columns, rows: data, emptyMessage: "Tidak ada perusahaan ditemukan" });
    wrap.innerHTML = "";
    wrap.appendChild(tableEl);

    const pageRow = container.querySelector("#cn-companies-pagination");
    mountPagination(pageRow, { page, total, limit: currentFilter.limit }, (p) => {
        currentFilter.page = p;
        renderTable(container);
    }, "perusahaan");

    wrap.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", () => {
            const act = btn.dataset.act;
            if (act === "billing") openBillingModal(container, btn.dataset.id);
            if (act === "login-as") {
                // Cek akses company→app SEBELUM minta token impersonasi ke server:
                // beri tahu Super Admin alasan jika company belum terhubung.
                const row = data.find(r => r.code === btn.dataset.code);
                const connected = appsFromCompany(row);
                if (!connected.length) {
                    showToast("warning", "Tidak ada aplikasi yang terhubung. Silahkan hubungkan terlebih dahulu.");
                    return;
                }
                // Aplikasi tujuan hanya yang terdaftar & AKTIF — impersonation
                // ke aplikasi nonaktif/tidak terdaftar ditolak server (404).
                const available = activeConnectedApps(row);
                if (!available.length) {
                    showToast("warning", "Aplikasi yang terhubung tidak aktif atau tidak terdaftar. Cek menu Applications.");
                    return;
                }
                if (available.length === 1) {
                    startImpersonation(available[0].slug, btn.dataset.code, btn.dataset.name);
                } else {
                    openLoginAsPicker(btn.dataset.code, btn.dataset.name, available);
                }
            }
            if (act === "detail") openDetailModal(container, btn.dataset.id);
            if (act === "edit") openEditModal(container, btn.dataset.id);
            if (act === "delete") confirmDelete(container, btn.dataset.id, btn.dataset.name);
        });
    });
}

async function openDetailModal(container, id) {
    const company = await getCompany(id);
    if (!company) {
        showToast("danger", "Perusahaan tidak ditemukan");
        return;
    }
    const apps = appsFromCompany(company).map(slug => ({ name: appNameBySlug(slug) }));

    const logoHtml = company.logo
        ? `<img class="cn-detail-logo" src="${esc(company.logo)}" alt="Logo" />`
        : `<span class="cn-detail-logo cn-detail-logo-ph">${esc((company.name || "?").charAt(0))}</span>`;

    const content = `
        <div class="cn-detail-head">
            ${logoHtml}
            <div>
                <h3 class="cn-detail-name">${esc(company.name)}</h3>
                <span class="cn-muted">${esc(company.code)}</span>
            </div>
        </div>
        <div class="cn-detail-grid">
            <div class="cn-detail-item"><span class="cn-detail-label">Jenis</span><span class="cn-detail-value">${esc(company.jenis || "—")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Status</span><span class="cn-detail-value">${statusBadge(company.active, "Active", "Suspended")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Email</span><span class="cn-detail-value">${esc(company.email || "—")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Phone</span><span class="cn-detail-value">${esc(company.phone || "—")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Tax ID</span><span class="cn-detail-value">${esc(company.taxId || "—")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Business Type</span><span class="cn-detail-value">${esc(company.businessType || "—")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Mode Lokasi</span><span class="cn-detail-value">${company.lokasiMode === "multi" ? "Multi Lokasi" : "Single Lokasi"}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Kasir</span><span class="cn-detail-value">${company.jumlahKasir ?? 1} kasir</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Lisensi</span><span class="cn-detail-value">${esc(company.lisensiStatus || "active")}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Dibuat</span><span class="cn-detail-value">${formatDateTime(company.createdAt)}</span></div>
            <div class="cn-detail-item full"><span class="cn-detail-label">Alamat</span><span class="cn-detail-value">${esc(company.address || "—")}</span></div>
            <div class="cn-detail-item full"><span class="cn-detail-label">Registered Apps</span><span class="cn-detail-value">${apps.length ? apps.map(a => esc(a.name)).join(", ") : "Belum ada aplikasi"}</span></div>
        </div>
    `;

    const footer = `<button class="smart-btn smart-btn-secondary" id="cn-company-detail-close">Tutup</button>`;
    const overlay = Modal({
        open: true,
        title: "Detail Perusahaan",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-company-detail-close").addEventListener("click", () => overlay.remove());
}

const SUB_STATUS_LABEL = {
    TRIAL: { cls: "smart-badge-info", label: "Trial" },
    ACTIVE: { cls: "smart-badge-success", label: "Active" },
    PAST_DUE: { cls: "smart-badge-warning", label: "Past Due" },
    SUSPENDED: { cls: "smart-badge-danger", label: "Suspended" },
    CANCELLED: { cls: "smart-badge-secondary", label: "Cancelled" },
    EXPIRED: { cls: "smart-badge-secondary", label: "Expired" }
};

function formatIDR(n) {
    const v = Math.trunc(Number(n) || 0);
    return `Rp${v.toLocaleString("id-ID")}`;
}

/**
 * Modal Billing Detail per company (SP-029 M6-FIX Task 2).
 * Menampilkan subscription, plan, features checklist + usage langsung dari server.
 */
async function openBillingModal(container, id) {
    let summary;
    try {
        const res = await companyBillingSummary(id);
        summary = res.data;
    } catch (e) {
        showToast("danger", e.message || "Gagal memuat billing company");
        return;
    }
    const sub = summary.subscription;
    const subBadge = sub
        ? (SUB_STATUS_LABEL[sub.status] || { cls: "smart-badge-secondary", label: sub.status })
        : null;

    const subHtml = sub ? `
        <div class="cn-detail-grid">
            <div class="cn-detail-item"><span class="cn-detail-label">Plan</span><span class="cn-detail-value"><strong>${esc(sub.planName || sub.planSlug || "—")}</strong></span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Status</span><span class="cn-detail-value"><span class="smart-badge ${subBadge.cls}">${esc(subBadge.label)}</span></span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Billing</span><span class="cn-detail-value">${esc(sub.billingCycle)}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Harga</span><span class="cn-detail-value">${formatIDR(sub.price)}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Mulai</span><span class="cn-detail-value">${formatDateTime(sub.startDate)}</span></div>
            <div class="cn-detail-item"><span class="cn-detail-label">Berakhir</span><span class="cn-detail-value">${formatDateTime(sub.endDate)}</span></div>
            ${sub.trialEnd ? `<div class="cn-detail-item"><span class="cn-detail-label">Trial s/d</span><span class="cn-detail-value">${formatDateTime(sub.trialEnd)}</span></div>` : ""}
            ${sub.cancelReason ? `<div class="cn-detail-item full"><span class="cn-detail-label">Alasan cancel</span><span class="cn-detail-value">${esc(sub.cancelReason)}</span></div>` : ""}
            <div class="cn-detail-item full"><span class="cn-detail-label">MRR</span><span class="cn-detail-value">${formatIDR(summary.mrr)} / tahun ${formatIDR(summary.arr)}</span></div>
        </div>`
        : `<p class="cn-muted">Belum ada subscription untuk perusahaan ini.</p>`;

    const featuresHtml = (summary.features && summary.features.length)
        ? `<table class="cn-billing-features">
            <thead><tr><th>Feature</th><th>Akses</th><th>Limit</th><th>Used</th><th>Remaining</th></tr></thead>
            <tbody>
                ${summary.features.map(f => `
                    <tr>
                        <td class="cn-mono">${esc(f.slug)}</td>
                        <td>${f.enabled ? `<span class="smart-badge smart-badge-success">✓</span>` : `<span class="smart-badge smart-badge-danger">✗</span>`}</td>
                        <td>${f.limit ?? "∞"}</td>
                        <td>${f.used ?? 0}</td>
                        <td>${f.remaining ?? "∞"}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`
        : `<p class="cn-muted">Belum ada entitlement terhitung.</p>`;

    const changesHtml = (summary.changes && summary.changes.length)
        ? `<table class="cn-billing-features">
            <thead><tr><th>Perubahan</th><th>Dari</th><th>Ke</th><th>Waktu</th></tr></thead>
            <tbody>
                ${summary.changes.map(c => `
                    <tr>
                        <td>${esc(c.changeType)}</td>
                        <td>${esc(c.oldPlanId?.name || c.oldStatus || "—")}</td>
                        <td>${esc(c.newPlanId?.name || c.newStatus || "—")}</td>
                        <td class="cn-muted">${formatDateTime(c.createdAt)}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`
        : `<p class="cn-muted">Belum ada riwayat subscription.</p>`;

    const content = `
        <div class="cn-detail-head">
            <div>
                <h3 class="cn-detail-name">${esc(summary.company.name)}</h3>
                <span class="cn-muted">${esc(summary.company.code)}</span>
            </div>
        </div>
        <h4 class="cn-billing-section-title">Subscription</h4>
        ${subHtml}
        <h4 class="cn-billing-section-title">Features & Usage</h4>
        ${featuresHtml}
        <h4 class="cn-billing-section-title">Riwayat Subscription</h4>
        ${changesHtml}
    `;

    const footer = `
        <button class="smart-btn smart-btn-secondary" id="cn-billing-close">Tutup</button>
        <button class="smart-btn smart-btn-primary" id="cn-billing-open-center" data-code="${esc(summary.company.code)}">Buka Billing Center</button>
    `;
    const overlay = Modal({
        open: true,
        title: `Billing — ${summary.company.code}`,
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-billing-close").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-billing-open-center").addEventListener("click", () => {
        overlay.remove();
        // Navigasi ke Billing Center (halaman billing) — cleanup modal sisa.
        const { navigate } = window.__consoleNav || {};
        if (navigate) navigate("billing");
        else window.location.hash = "#/billing";
    });
}

function jenisOptions() {
    return Object.keys(COMPANY_TYPES).map(k => ({
        value: COMPANY_TYPES[k],
        label: COMPANY_TYPES[k]
    }));
}

// ── Wilayah cascading (provinsi → kabupaten → kecamatan → desa) ──
// Data diambil langsung dari shared/data/wilayah.json via services/wilayah.js
// (lazy-load, tanpa request /api/wilayah/*).

function regionSelect(label, name) {
    return Select({
        label,
        name,
        options: [],
        placeholder: "Pilih..."
    });
}

async function initWilayahCascading() {
    const prov = document.querySelector('[name="cn-cmp-prov"]');
    const kab = document.querySelector('[name="cn-cmp-kab"]');
    const kec = document.querySelector('[name="cn-cmp-kec"]');
    const desa = document.querySelector('[name="cn-cmp-desa"]');
    if (!prov) return;

    const fillOptions = (select, items) => {
        if (!select) return;
        select.innerHTML = `<option value="">Pilih...</option>` +
            items.map(i => `<option value="${esc(i.code)}">${esc(i.name)}</option>`).join("");
    };

    let provinces;
    prov.innerHTML = `<option value="">Memuat wilayah...</option>`;
    try {
        provinces = await listProvinces();
    } catch {
        prov.innerHTML = `<option value="">Pilih...</option>`;
        showToast("danger", "Gagal memuat data wilayah");
        return;
    }
    fillOptions(prov, provinces);

    prov.addEventListener("change", async () => {
        const provCode = prov.value;
        fillOptions(kab, []);
        fillOptions(kec, []);
        fillOptions(desa, []);
        if (!provCode) return;
        const regencies = await listRegencies(provCode);
        if (prov.value !== provCode) return; // user pindah provinsi saat loading
        fillOptions(kab, regencies);
    });

    kab.addEventListener("change", async () => {
        const kabCode = kab.value;
        fillOptions(kec, []);
        fillOptions(desa, []);
        if (!kabCode) return;
        const districts = await listDistricts(prov.value, kabCode);
        if (kab.value !== kabCode) return;
        fillOptions(kec, districts);
    });

    kec.addEventListener("change", async () => {
        const kecCode = kec.value;
        fillOptions(desa, []);
        if (!kecCode) return;
        const villages = await listVillages(prov.value, kab.value, kecCode);
        if (kec.value !== kecCode) return;
        fillOptions(desa, villages);
    });
}

async function openEditModal(container, id = null) {
    // Pastikan daftar aplikasi tersedia untuk toggle "Akses Aplikasi"
    // (dipakai juga saat tombol "+ Tambah Perusahaan" diklik langsung).
    if (!_appListCache.length) {
        await loadAppList();
    }
    // SP-029 M2 — katalog business type (dropdown konfigurasi POS)
    if (!_businessTypeCache) {
        _businessTypeCache = await listBusinessTypes();
    }
    let company = null;
    if (id) {
        company = await getCompany(id);
        if (!company) {
            // Pembeda tegas EDIT vs CREATE: ketika ada id tapi company tidak
            // ter-resolve (mis. API gagal), JANGAN diam-diam jatuh ke mode
            // CREATE — itu yang menyebabkan "Buat Perusahaan" + "Kode sudah
            // digunakan" saat mengedit company existing.
            showToast("danger", "Perusahaan tidak ditemukan. Muat ulang halaman lalu coba lagi.");
            return;
        }
    }
    const isEdit = Boolean(company);

    const codeInput = Input({
        label: "Kode Perusahaan", name: "cn-cmp-code",
        value: company?.code || "", required: true, placeholder: "PT-001"
    });
    const nameInput = Input({
        label: "Nama Perusahaan", name: "cn-cmp-name",
        value: company?.name || "", required: true, placeholder: "PT Contoh Sejahtera"
    });
    const emailInput = Input({
        label: "Email", name: "cn-cmp-email",
        value: company?.email || "", placeholder: "info@company.id"
    });
    const phoneInput = Input({
        label: "Phone", name: "cn-cmp-phone",
        value: company?.phone || "", placeholder: "021-0000000"
    });
    const taxInput = Input({
        label: "Tax ID", name: "cn-cmp-tax",
        value: company?.taxId || "", placeholder: "00.000.000.0-000.000"
    });
    const addressInput = Input({
        label: "Alamat", name: "cn-cmp-address",
        value: company?.address || "", placeholder: "Jl. Contoh No. 1"
    });
    const jenisSelect = Select({
        label: "Jenis", name: "cn-cmp-jenis",
        options: jenisOptions(),
        value: company?.jenis || "PT/CV/Perorangan"
    });

    // ── SP-029 M2 — Konfigurasi produk (POS): business type, lokasi, kasir, lisensi ──
    const businessTypeSelect = Select({
        label: "Business Type", name: "cn-cmp-business-type",
        options: _businessTypeCache.map(b => ({ value: b, label: b })),
        value: company?.businessType || ""
    });
    const lokasiModeSelect = Select({
        label: "Mode Lokasi", name: "cn-cmp-lokasi-mode",
        options: [
            { value: "single", label: "Single Lokasi" },
            { value: "multi", label: "Multi Lokasi" }
        ],
        value: company?.lokasiMode || "single"
    });
    const gudangInput = Input({
        label: "Jumlah Gudang", name: "cn-cmp-jumlah-gudang",
        value: String(company?.jumlahGudang ?? 1), type: "number"
    });
    const kasirInput = Input({
        label: "Jumlah Kasir", name: "cn-cmp-jumlah-kasir",
        value: String(company?.jumlahKasir ?? 1), type: "number"
    });
    const lisensiSelect = Select({
        label: "Status Lisensi", name: "cn-cmp-lisensi",
        options: [
            { value: "active", label: "Active" },
            { value: "trial", label: "Trial" },
            { value: "expired", label: "Expired" }
        ],
        value: company?.lisensiStatus || "active"
    });

    const provSelect = regionSelect("Provinsi", "cn-cmp-prov");
    const kabSelect = regionSelect("Kabupaten/Kota", "cn-cmp-kab");
    const kecSelect = regionSelect("Kecamatan", "cn-cmp-kec");
    const desaSelect = regionSelect("Desa/Kelurahan", "cn-cmp-desa");

    // Aplikasi yang bisa di-toggle diambil dari SERVER (Application collection),
    // fallback APPS_REGISTRY bila server tidak tersedia — aplikasi baru otomatis
    // muncul di sini tanpa mengubah kode. Aplikasi NONAKTIF tetap tampil (agar
    // akses lama bisa dilepas) namun diberi penanda — impersonation ke aplikasi
    // nonaktif ditolak server (404).
    const availableApps = _appListCache.length ? _appListCache : APPS_REGISTRY;
    const appToggles = availableApps.map(app => {
        const checked = company ? appsFromCompany(company).includes(app.slug) : false;
        const sw = Switch({
            label: `${app.icon || "📦"} ${app.name}${app.active === false ? " (nonaktif)" : ""}`,
            name: `cn-cmp-app-${app.slug}`,
            checked
        });
        return sw.outerHTML;
    }).join("");

    const content = `
        <div class="cn-modal-info">${isEdit ? "Ubah data perusahaan" : "Tambahkan perusahaan baru ke platform"}</div>
        <div class="cn-form-grid">
            ${codeInput.outerHTML}
            ${nameInput.outerHTML}
            ${emailInput.outerHTML}
            ${phoneInput.outerHTML}
            ${taxInput.outerHTML}
            ${jenisSelect.outerHTML}
            <div class="full">${addressInput.outerHTML}</div>
            ${provSelect.outerHTML}
            ${kabSelect.outerHTML}
            ${kecSelect.outerHTML}
            ${desaSelect.outerHTML}
            ${businessTypeSelect.outerHTML}
            ${lokasiModeSelect.outerHTML}
            ${gudangInput.outerHTML}
            ${kasirInput.outerHTML}
            ${lisensiSelect.outerHTML}
        </div>
        <div class="cn-apps-access">
            <span class="cn-detail-label">Akses Aplikasi</span>
            <div class="cn-apps-toggles">${appToggles}</div>
        </div>
    `;

    const footer = `
        <button class="smart-btn smart-btn-primary" id="cn-cmp-save">${isEdit ? "Simpan Perubahan" : "Buat Perusahaan"}</button>
        <button class="smart-btn smart-btn-secondary" id="cn-cmp-cancel">Batal</button>
    `;

    const overlay = Modal({
        open: true,
        title: isEdit ? `Edit Perusahaan — ${company.code}` : "Tambah Perusahaan",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);

    // Init wilayah cascading (fetch options setelah modal ter-mount)
    initWilayahCascading();

    document.getElementById("cn-cmp-cancel").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-cmp-save").addEventListener("click", async () => {
        const q = (name) => document.querySelector(`[name="${name}"]`);
        const data = {
            code: q("cn-cmp-code")?.value?.trim(),
            name: q("cn-cmp-name")?.value?.trim(),
            email: q("cn-cmp-email")?.value?.trim(),
            phone: q("cn-cmp-phone")?.value?.trim(),
            taxId: q("cn-cmp-tax")?.value?.trim(),
            address: q("cn-cmp-address")?.value?.trim(),
            jenis: q("cn-cmp-jenis")?.value || "PT/CV/Perorangan",
            // SP-029 M2 — konfigurasi produk (POS)
            businessType: q("cn-cmp-business-type")?.value || "",
            lokasiMode: q("cn-cmp-lokasi-mode")?.value || "single",
            jumlahGudang: parseInt(q("cn-cmp-jumlah-gudang")?.value, 10) || 1,
            jumlahKasir: parseInt(q("cn-cmp-jumlah-kasir")?.value, 10) || 1,
            lisensiStatus: q("cn-cmp-lisensi")?.value || "active"
        };
        if (!data.code || !data.name) {
            showToast("danger", "Kode dan nama perusahaan wajib diisi");
            return;
        }
        // Kumpulkan akses aplikasi dari toggle — sumber kebenaran SERVER
        // (Company.apps). Gunakan daftar aplikasi yang sama dengan toggle
        // (server-first).
        const availableApps = _appListCache.length ? _appListCache : APPS_REGISTRY;
        data.apps = availableApps
            .filter(app => document.querySelector(`[name="cn-cmp-app-${app.slug}"]`)?.checked)
            .map(app => app.slug);
        try {
            if (isEdit) {
                await updateCompany(company.id, data);
            } else {
                await createCompany(data);
            }
            showToast("success", isEdit ? "Perusahaan diperbarui" : "Perusahaan dibuat");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal menyimpan perusahaan");
        }
    });
}

function confirmDelete(container, id, name) {
    const content = `<p>Yakin ingin menghapus perusahaan <strong>${esc(name)}</strong>? Tindakan ini tidak dapat dibatalkan.</p>`;
    const footer = `
        <button class="smart-btn smart-btn-danger" id="cn-cmp-del-confirm">Hapus</button>
        <button class="smart-btn smart-btn-secondary" id="cn-cmp-del-cancel">Batal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "Hapus Perusahaan",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-cmp-del-cancel").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-cmp-del-confirm").addEventListener("click", async () => {
        try {
            await deleteCompany(id);
            showToast("success", "Perusahaan dihapus");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal menghapus");
        }
    });
}

/**
 * Modal pilih aplikasi tujuan Login As — muncul saat company terhubung ke
 * lebih dari satu aplikasi AKTIF (mis. Inventory + POS). Langsung impersonate
 * bila hanya satu aplikasi (lihat handler login-as di renderTable).
 * @param {string} companyCode Kode perusahaan
 * @param {string} companyName Nama perusahaan
 * @param {object[]} apps Daftar aplikasi aktif yang terhubung
 */
function openLoginAsPicker(companyCode, companyName, apps) {
    const content = `
        <p class="cn-muted">Masuk sebagai <strong>${esc(companyName)}</strong> (${esc(companyCode)}) — pilih aplikasi tujuan:</p>
        <div class="cn-login-as-list">
            ${apps.map(app => `
                <button type="button" class="cn-login-as-item" data-slug="${esc(app.slug)}">
                    <span class="cn-app-icon">${esc(app.icon || "📦")}</span>
                    <span class="cn-login-as-item-text">
                        <strong>${esc(app.name)}</strong>
                        <small class="cn-muted">${esc(app.slug)}${app.domain ? ` · ${esc(app.domain)}` : ""}</small>
                    </span>
                    <span class="cn-login-as-arrow">→</span>
                </button>`).join("")}
        </div>
    `;
    const footer = `<button class="smart-btn smart-btn-secondary" id="cn-login-as-cancel">Batal</button>`;
    const overlay = Modal({
        open: true,
        title: "Login As — Pilih Aplikasi",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-login-as-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll(".cn-login-as-item").forEach(btn => {
        btn.addEventListener("click", () => {
            overlay.remove();
            startImpersonation(btn.dataset.slug, companyCode, companyName);
        });
    });
}

/**
 * Render & init halaman Companies.
 * @param {HTMLElement} container
 */
export async function renderCompanies(container) {
    currentFilter = { page: 1, limit: 10, search: "", status: "all" };
    container.innerHTML = `
        ${pageHeader("Companies", "Manajemen perusahaan terdaftar di platform")}
        <div class="cn-card">
            <div class="cn-card-header">
                <span class="cn-card-title">Daftar Perusahaan</span>
                <button class="smart-btn smart-btn-primary" id="cn-company-add">+ Tambah Perusahaan</button>
            </div>
            <div class="cn-card-body">
                <div class="cn-toolbar">
                    <input class="smart-input" id="cn-company-search" placeholder="Cari nama / kode / email..." />
                    <select class="smart-select" id="cn-company-status">
                        <option value="all">Semua Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Suspended</option>
                    </select>
                </div>
                <div id="cn-companies-table"></div>
            </div>
            <div class="cn-pagination-row" id="cn-companies-pagination"></div>
        </div>
    `;

    const search = container.querySelector("#cn-company-search");
    const status = container.querySelector("#cn-company-status");
    const add = container.querySelector("#cn-company-add");

    let searchTimer = null;
    search.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentFilter.search = search.value.trim();
            currentFilter.page = 1;
            renderTable(container);
        }, 250);
    });
    status.addEventListener("change", () => {
        currentFilter.status = status.value;
        currentFilter.page = 1;
        renderTable(container);
    });
    add.addEventListener("click", () => openEditModal(container));

    await renderTable(container);
}
