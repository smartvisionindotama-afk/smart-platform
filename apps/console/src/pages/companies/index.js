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
import { platform, COMPANY_TYPES } from "@smart/core";
import {
    listCompanies,
    getCompany,
    updateCompany,
    deleteCompany,
    createCompany
} from "../../services/companies.js";
import { startImpersonation } from "../../services/impersonation.js";
import { APPS_REGISTRY } from "../../config/index.js";
import { pageHeader, loadingHTML, esc, statusBadge, formatDateTime, mountPagination } from "../_shared.js";

let currentFilter = { page: 1, limit: 10, search: "", status: "all" };

async function loadCompanyApps(companyCode) {
    try {
        return platform.getCompanyApps(companyCode);
    } catch {
        return [];
    }
}

function companyAppsBadges(companyCode) {
    const enabled = platform.getCompanyApps(companyCode);
    return enabled.length
        ? enabled.map(a => `<span class="smart-badge smart-badge-info">${esc(a.name)}</span>`).join(" ")
        : `<span class="cn-muted">—</span>`;
}

async function renderTable(container) {
    const wrap = container.querySelector("#cn-companies-table");
    if (!wrap) return;

    wrap.innerHTML = loadingHTML();

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
            render: (_, row) => companyAppsBadges(row.code)
        },
        {
            key: "actions",
            label: "Action",
            render: (_, row) => `
                <div class="cn-actions">
                    <button class="smart-btn smart-btn-primary" data-act="login-as" data-code="${esc(row.code)}" data-name="${esc(row.name)}">Login As</button>
                    <button class="smart-btn smart-btn-secondary" data-act="detail" data-id="${esc(row.id)}">Detail</button>
                    <button class="smart-btn smart-btn-secondary" data-act="edit" data-id="${esc(row.id)}">Edit</button>
                    <button class="smart-btn smart-btn-danger" data-act="delete" data-id="${esc(row.id)}" data-name="${esc(row.name)}">Hapus</button>
                </div>
            `
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
            if (act === "login-as") {
                startImpersonation("inventory", btn.dataset.code, btn.dataset.name);
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
    const apps = await loadCompanyApps(company.code);

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

function jenisOptions() {
    return Object.keys(COMPANY_TYPES).map(k => ({
        value: COMPANY_TYPES[k],
        label: COMPANY_TYPES[k]
    }));
}

// ── Wilayah cascading (provinsi → kabupaten → kecamatan → desa) ──
// Dipertahankan dari monolith dashboard.js (SP-027 M1) — endpoint /api/wilayah/*.

async function fetchWilayah(path) {
    const res = await fetch(`/api/wilayah/${path}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

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

    const fillOptions = (select, items, textFn) => {
        if (!select) return;
        select.innerHTML = `<option value="">Pilih...</option>` +
            items.map(i => `<option value="${esc(i.code || i.id)}">${esc(textFn(i))}</option>`).join("");
    };

    const provinces = await fetchWilayah("provinces");
    fillOptions(prov, provinces, p => p.name || p.province);

    prov.addEventListener("change", async () => {
        const provCode = prov.value;
        fillOptions(kab, [], () => "");
        fillOptions(kec, [], () => "");
        fillOptions(desa, [], () => "");
        if (!provCode) return;
        const regencies = await fetchWilayah(`${provCode}/regencies`);
        fillOptions(kab, regencies, r => r.name || r.regency);
    });

    kab.addEventListener("change", async () => {
        const kabCode = kab.value;
        fillOptions(kec, [], () => "");
        fillOptions(desa, [], () => "");
        if (!kabCode) return;
        const districts = await fetchWilayah(`${prov.value}/${kabCode}/districts`);
        fillOptions(kec, districts, d => d.name || d.district);
    });

    kec.addEventListener("change", async () => {
        const kecCode = kec.value;
        fillOptions(desa, [], () => "");
        if (!kecCode) return;
        const villages = await fetchWilayah(`${prov.value}/${kab.value}/${kecCode}/villages`);
        fillOptions(desa, villages, v => v.name || v.village);
    });
}

async function openEditModal(container, id = null) {
    const company = id ? await getCompany(id) : null;
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

    const provSelect = regionSelect("Provinsi", "cn-cmp-prov");
    const kabSelect = regionSelect("Kabupaten/Kota", "cn-cmp-kab");
    const kecSelect = regionSelect("Kecamatan", "cn-cmp-kec");
    const desaSelect = regionSelect("Desa/Kelurahan", "cn-cmp-desa");

    const appToggles = APPS_REGISTRY.map(app => {
        const checked = company ? platform.hasAccess(company.code, app.slug) : false;
        const sw = Switch({
            label: `${app.icon} ${app.name}`,
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
            jenis: q("cn-cmp-jenis")?.value || "PT/CV/Perorangan"
        };
        if (!data.code || !data.name) {
            showToast("danger", "Kode dan nama perusahaan wajib diisi");
            return;
        }
        try {
            let companyCode;
            if (isEdit) {
                await updateCompany(company.id, data);
                companyCode = data.code;
            } else {
                const created = await createCompany(data);
                companyCode = created.code;
            }
            // Sync app access (create & edit) ke platform manager
            APPS_REGISTRY.forEach(app => {
                const checked = document.querySelector(`[name="cn-cmp-app-${app.slug}"]`)?.checked;
                if (checked) platform.enableAppForCompany(companyCode, app.slug);
                else platform.disableAppForCompany(companyCode, app.slug);
            });
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
