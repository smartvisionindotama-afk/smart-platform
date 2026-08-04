/**
 * SMART Console — Super Admin Page.
 *
 * SP-027 M1: Search, Pagination, Reset Password, Enable/Disable, Role,
 * Last Login.
 *
 * Catatan: model SuperAdmin (apps/inventory/server/models/SuperAdmin.js)
 * TIDAK memiliki field `lastLogin` (hanya createdAt/updatedAt/resetToken),
 * sehingga kolom "Last Login" menampilkan "—" (tidak dilacak).
 *
 * @module console/pages/superadmins
 */

import { Table, Modal, Input, Switch, showToast } from "@smart/ui";
import {
    listSuperadmins,
    createSuperadmin,
    updateSuperadmin,
    deleteSuperadmin
} from "../../services/superadmins.js";
import { pageHeader, loadingHTML, esc, mountPagination } from "../_shared.js";

let currentFilter = { page: 1, limit: 10, search: "" };
let allRows = [];

async function reloadData() {
    allRows = await listSuperadmins();
    return allRows || [];
}

async function renderTable(container) {
    const wrap = container.querySelector("#cn-sa-table");
    if (!wrap) return;

    wrap.innerHTML = loadingHTML();
    await reloadData();

    const search = (currentFilter.search || "").toLowerCase().trim();
    const rows = allRows.filter(sa =>
        !search ||
        (sa.username || "").toLowerCase().includes(search) ||
        (sa.name || "").toLowerCase().includes(search) ||
        (sa.email || "").toLowerCase().includes(search)
    );

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / currentFilter.limit));
    const page = Math.min(currentFilter.page, totalPages);
    const start = (page - 1) * currentFilter.limit;
    const data = rows.slice(start, start + currentFilter.limit);

    const columns = [
        { key: "username", label: "Username" },
        {
            key: "name",
            label: "Nama",
            render: (v, row) => `${esc(v)}<br/><small class="cn-muted">${esc(row.email || "—")}</small>`
        },
        {
            key: "role",
            label: "Role",
            render: (v) => `<span class="smart-badge smart-badge-info">${esc(v || "superadmin")}</span>`
        },
        {
            key: "active",
            label: "Status",
            render: (v) => v
                ? `<span class="smart-badge smart-badge-success">Active</span>`
                : `<span class="smart-badge smart-badge-danger">Disabled</span>`
        },
        {
            key: "lastLogin",
            label: "Last Login",
            render: () => `<span class="cn-muted">—</span>`
        },
        {
            key: "actions",
            label: "Action",
            render: (_, row) => `
                <div class="cn-actions">
                    <button class="smart-btn smart-btn-secondary" data-act="reset" data-id="${esc(row.id)}" data-name="${esc(row.username)}">Reset PW</button>
                    <button class="smart-btn ${row.active ? "smart-btn-danger" : "smart-btn-success"}" data-act="toggle" data-id="${esc(row.id)}">${row.active ? "Disable" : "Enable"}</button>
                    <button class="smart-btn smart-btn-danger" data-act="delete" data-id="${esc(row.id)}" data-name="${esc(row.username)}">Hapus</button>
                </div>
            `
        }
    ];

    const tableEl = Table({ columns, rows: data, emptyMessage: "Tidak ada super admin ditemukan" });
    wrap.innerHTML = "";
    wrap.appendChild(tableEl);

    const pageRow = container.querySelector("#cn-sa-pagination");
    mountPagination(pageRow, { page, total, limit: currentFilter.limit }, (p) => {
        currentFilter.page = p;
        renderTable(container);
    }, "super admin");

    wrap.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", () => {
            const act = btn.dataset.act;
            if (act === "reset") openResetModal(container, btn.dataset.id, btn.dataset.name);
            if (act === "toggle") toggleActive(container, btn.dataset.id);
            if (act === "delete") confirmDelete(container, btn.dataset.id, btn.dataset.name);
        });
    });
}

async function toggleActive(container, id) {
    const sa = allRows.find(x => String(x.id) === String(id));
    if (!sa) return;
    try {
        await updateSuperadmin(id, { active: !sa.active });
        showToast("success", sa.active ? "Super admin dinonaktifkan" : "Super admin diaktifkan");
        renderTable(container);
    } catch (err) {
        showToast("danger", err.message || "Gagal memperbarui status");
    }
}

function openResetModal(container, id, username) {
    const passInput = Input({
        label: "Password Baru", name: "cn-sa-pass",
        type: "password", required: true, placeholder: "Minimal 6 karakter"
    });
    const content = `
        <div class="cn-modal-info">Reset password untuk <strong>${esc(username)}</strong></div>
        <div class="cn-form-grid">${passInput.outerHTML}</div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-primary" id="cn-sa-reset-save">Reset Password</button>
        <button class="smart-btn smart-btn-secondary" id="cn-sa-reset-cancel">Batal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "Reset Password",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-sa-reset-cancel").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-sa-reset-save").addEventListener("click", async () => {
        const pass = document.querySelector('[name="cn-sa-pass"]')?.value || "";
        if (pass.length < 6) {
            showToast("danger", "Password minimal 6 karakter");
            return;
        }
        try {
            await updateSuperadmin(id, { password: pass });
            showToast("success", "Password berhasil direset");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal reset password");
        }
    });
}

function openAddModal(container) {
    const usernameInput = Input({ label: "Username", name: "cn-sa-user", required: true });
    const nameInput = Input({ label: "Nama", name: "cn-sa-name", required: true });
    const emailInput = Input({ label: "Email", name: "cn-sa-email" });
    const passInput = Input({ label: "Password", name: "cn-sa-new-pass", type: "password", required: true });
    const activeSwitch = Switch({ label: "Aktif", name: "cn-sa-active", checked: true });

    const content = `
        <div class="cn-form-grid">
            ${usernameInput.outerHTML}
            ${nameInput.outerHTML}
            ${emailInput.outerHTML}
            ${passInput.outerHTML}
            <div class="full">${activeSwitch.outerHTML}</div>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-primary" id="cn-sa-add-save">Buat Super Admin</button>
        <button class="smart-btn smart-btn-secondary" id="cn-sa-add-cancel">Batal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "Tambah Super Admin",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-sa-add-cancel").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-sa-add-save").addEventListener("click", async () => {
        const data = {
            username: document.querySelector('[name="cn-sa-user"]')?.value?.trim(),
            name: document.querySelector('[name="cn-sa-name"]')?.value?.trim(),
            email: document.querySelector('[name="cn-sa-email"]')?.value?.trim(),
            password: document.querySelector('[name="cn-sa-new-pass"]')?.value || "",
            active: document.querySelector('[name="cn-sa-active"]')?.checked ?? true
        };
        if (!data.username || !data.name || !data.password) {
            showToast("danger", "Username, nama, dan password wajib diisi");
            return;
        }
        try {
            await createSuperadmin(data);
            showToast("success", "Super admin dibuat");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal membuat super admin");
        }
    });
}

function confirmDelete(container, id, username) {
    const content = `<p>Yakin ingin menghapus super admin <strong>${esc(username)}</strong>?</p>`;
    const footer = `
        <button class="smart-btn smart-btn-danger" id="cn-sa-del-confirm">Hapus</button>
        <button class="smart-btn smart-btn-secondary" id="cn-sa-del-cancel">Batal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "Hapus Super Admin",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    document.getElementById("cn-sa-del-cancel").addEventListener("click", () => overlay.remove());
    document.getElementById("cn-sa-del-confirm").addEventListener("click", async () => {
        try {
            await deleteSuperadmin(id);
            showToast("success", "Super admin dihapus");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal menghapus");
        }
    });
}

/**
 * Render & init halaman Super Admin.
 * @param {HTMLElement} container
 */
export async function renderSuperAdmins(container) {
    currentFilter = { page: 1, limit: 10, search: "" };
    container.innerHTML = `
        ${pageHeader("Super Admin", "Kelola akun super admin platform")}
        <div class="cn-card">
            <div class="cn-card-header">
                <span class="cn-card-title">Daftar Super Admin</span>
                <button class="smart-btn smart-btn-primary" id="cn-sa-add">+ Tambah Super Admin</button>
            </div>
            <div class="cn-card-body">
                <div class="cn-toolbar">
                    <input class="smart-input" id="cn-sa-search" placeholder="Cari username / nama / email..." />
                </div>
                <div id="cn-sa-table"></div>
            </div>
            <div class="cn-pagination-row" id="cn-sa-pagination"></div>
        </div>
    `;

    const search = container.querySelector("#cn-sa-search");
    const add = container.querySelector("#cn-sa-add");

    let searchTimer = null;
    search.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentFilter.search = search.value.trim();
            currentFilter.page = 1;
            renderTable(container);
        }, 250);
    });
    add.addEventListener("click", () => openAddModal(container));

    await renderTable(container);
}
