/**
 * SMART Console — Applications Page.
 *
 * SP-027 M1: daftar seluruh aplikasi platform (mock repository).
 * Kolom: Icon+Name, Code, Status, Domain, Version, Description, Action.
 * Action: Edit (Modal), Enable/Disable, Open (domain).
 *
 * @module console/pages/applications
 */

import { Table, Modal, Input, showToast } from "@smart/ui";
import {
    listApplications,
    getApplication,
    updateApplication,
    toggleApplication
} from "../../services/applications.js";
import { pageHeader, loadingHTML, esc, mountPagination } from "../_shared.js";

let currentFilter = { page: 1, limit: 10, search: "", status: "all" };

async function renderTable(container) {
    const wrap = container.querySelector("#cn-apps-table");
    if (!wrap) return;

    wrap.innerHTML = loadingHTML();
    const { data, pagination } = await listApplications(currentFilter);

    const columns = [
        {
            key: "name",
            label: "Aplikasi",
            render: (v, row) => `<span class="cn-app-cell"><span class="cn-app-icon">${esc(row.icon)}</span><span><strong>${esc(row.name)}</strong><br/><small class="cn-muted">${esc(row.slug)}</small></span></span>`
        },
        { key: "code", label: "Kode" },
        {
            key: "active",
            label: "Status",
            render: (v) => v
                ? `<span class="smart-badge smart-badge-success">Active</span>`
                : `<span class="smart-badge smart-badge-danger">Inactive</span>`
        },
        {
            key: "domain",
            label: "Domain",
            render: (v) => v ? `<span class="cn-mono">${esc(v)}</span>` : `<span class="cn-muted">—</span>`
        },
        { key: "version", label: "Version" },
        { key: "description", label: "Description" },
        {
            key: "actions",
            label: "Action",
            render: (_, row) => `
                <div class="cn-actions">
                    <button class="smart-btn smart-btn-secondary" data-act="edit" data-slug="${esc(row.slug)}">Edit</button>
                    <button class="smart-btn ${row.active ? "smart-btn-danger" : "smart-btn-success"}" data-act="toggle" data-slug="${esc(row.slug)}">${row.active ? "Disable" : "Enable"}</button>
                    ${row.domain
                        ? `<button class="smart-btn smart-btn-primary" data-act="open" data-slug="${esc(row.slug)}">Open</button>`
                        : ""}
                </div>
            `
        }
    ];

    const tableEl = Table({ columns, rows: data, emptyMessage: "Tidak ada aplikasi ditemukan" });
    wrap.innerHTML = "";
    wrap.appendChild(tableEl);

    // Pagination
    const pageRow = container.querySelector("#cn-apps-pagination");
    mountPagination(pageRow, pagination, (p) => {
        currentFilter.page = p;
        renderTable(container);
    }, "aplikasi");

    // Actions
    wrap.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", () => {
            const act = btn.dataset.act;
            const slug = btn.dataset.slug;
            if (act === "edit") openEditModal(container, slug);
            if (act === "toggle") handleToggle(container, slug);
            if (act === "open") {
                const app = data.find(a => a.slug === slug);
                if (app?.domain) window.open(app.domain, "_blank");
            }
        });
    });
}

async function handleToggle(container, slug) {
    try {
        await toggleApplication(slug);
        showToast("success", "Status aplikasi diperbarui");
        renderTable(container);
    } catch (err) {
        showToast("danger", err.message || "Gagal memperbarui status");
    }
}

async function openEditModal(container, slug) {
    const app = await getApplication(slug);
    if (!app) return;

    const nameInput = Input({ label: "Nama Aplikasi", name: "cn-app-name", value: app.name, required: true });
    const codeInput = Input({ label: "Kode", name: "cn-app-code", value: app.code });
    const versionInput = Input({ label: "Version", name: "cn-app-version", value: app.version });
    const domainInput = Input({ label: "Domain", name: "cn-app-domain", value: app.domain || "", placeholder: "https://..." });
    const descInput = Input({ label: "Description", name: "cn-app-desc", value: app.description });

    const content = `
        <div class="cn-form-grid">
            ${nameInput.outerHTML}
            ${codeInput.outerHTML}
            ${versionInput.outerHTML}
            ${domainInput.outerHTML}
            <div class="full">${descInput.outerHTML}</div>
        </div>
    `;

    const footer = `<button class="smart-btn smart-btn-primary" id="cn-app-save">Simpan</button>
                    <button class="smart-btn smart-btn-secondary" id="cn-app-cancel">Batal</button>`;

    const overlay = Modal({
        open: true,
        title: `Edit Aplikasi — ${app.name}`,
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);

    document.getElementById("cn-app-cancel").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-app-save").addEventListener("click", async () => {
        const data = {
            name: document.querySelector("#cn-app-name input").value.trim(),
            code: document.querySelector("#cn-app-code input").value.trim(),
            version: document.querySelector("#cn-app-version input").value.trim(),
            domain: document.querySelector("#cn-app-domain input").value.trim(),
            description: document.querySelector("#cn-app-desc input").value.trim()
        };
        if (!data.name) {
            showToast("danger", "Nama aplikasi wajib diisi");
            return;
        }
        try {
            await updateApplication(slug, data);
            showToast("success", "Aplikasi berhasil diperbarui");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal menyimpan");
        }
    });
}

/**
 * Render & init halaman Applications.
 * @param {HTMLElement} container
 */
export async function renderApplications(container) {
    currentFilter = { page: 1, limit: 10, search: "", status: "all" };
    container.innerHTML = `
        ${pageHeader("Applications", "Seluruh aplikasi yang tersedia di platform SMART")}
        <div class="cn-card">
            <div class="cn-card-header">
                <span class="cn-card-title">Daftar Aplikasi</span>
            </div>
            <div class="cn-card-body">
                <div class="cn-toolbar">
                    <input class="smart-input" id="cn-app-search" placeholder="Cari aplikasi..." />
                    <select class="smart-select" id="cn-app-status">
                        <option value="all">Semua Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <div class="cn-toolbar-actions">
                        <button class="smart-btn smart-btn-secondary" id="cn-app-refresh">↻ Refresh</button>
                    </div>
                </div>
                <div id="cn-apps-table"></div>
            </div>
            <div class="cn-pagination-row" id="cn-apps-pagination"></div>
        </div>
    `;

    const search = container.querySelector("#cn-app-search");
    const status = container.querySelector("#cn-app-status");
    const refresh = container.querySelector("#cn-app-refresh");

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
    refresh.addEventListener("click", () => renderTable(container));

    await renderTable(container);
}
