/**
 * SMART Console — Applications Page.
 *
 * SP-027 M1: daftar aplikasi platform (awalnya mock repository).
 * SP-027 PRE-M5 round 5: aplikasi kini data MongoDB (route /api/applications)
 * — CRUD lengkap: Tambah, Edit (termasuk logo + status), Enable/Disable,
 * Hapus (ditolak server bila masih terhubung ke perusahaan).
 *
 * @module console/pages/applications
 */

import { Table, Modal, Input, Switch, showToast } from "@smart/ui";
import {
    listApplications,
    getApplication,
    createApplication,
    updateApplication,
    toggleApplication,
    deleteApplication
} from "../../services/applications.js";
import {
    getAppLogo,
    uploadAppLogoToServer,
    removeAppLogoFromServer
} from "../../services/platform.js";
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
            render: (v, row) => `<span class="cn-app-cell"><span class="cn-app-icon" data-slug="${esc(row.slug)}">${esc(row.icon)}</span><span><strong>${esc(row.name)}</strong><br/><small class="cn-muted">${esc(row.slug)}</small></span></span>`
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
                    <button class="smart-btn smart-btn-danger" data-act="delete" data-slug="${esc(row.slug)}" data-name="${esc(row.name)}">Hapus</button>
                </div>
            `
        }
    ];

    const tableEl = Table({ columns, rows: data, emptyMessage: "Tidak ada aplikasi ditemukan" });
    wrap.innerHTML = "";
    wrap.appendChild(tableEl);

    // Tampilkan logo aplikasi (jika ada) menggantikan emoji icon — non-blocking
    wrap.querySelectorAll(".cn-app-icon[data-slug]").forEach(async (iconEl) => {
        const logo = await getAppLogo(iconEl.dataset.slug);
        if (logo) {
            iconEl.innerHTML = `<img class="cn-app-logo-img" src="${esc(logo)}" alt="Logo" />`;
        }
    });

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
            if (act === "delete") confirmDelete(container, slug, btn.dataset.name);
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

function confirmDelete(container, slug, name) {
    const content = `
        <p>Yakin ingin menghapus aplikasi <strong>${esc(name)}</strong> (${esc(slug)})?</p>
        <p class="cn-muted">Aplikasi yang masih terhubung ke perusahaan tidak dapat dihapus.</p>
    `;
    const footer = `
        <button class="smart-btn smart-btn-danger" id="cn-app-del-confirm">Hapus</button>
        <button class="smart-btn smart-btn-secondary" id="cn-app-del-cancel">Batal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "Hapus Aplikasi",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    overlay.querySelector("#cn-app-del-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#cn-app-del-confirm").addEventListener("click", async () => {
        try {
            await deleteApplication(slug);
            showToast("success", "Aplikasi dihapus");
            overlay.remove();
            renderTable(container);
        } catch (err) {
            showToast("danger", err.message || "Gagal menghapus aplikasi");
        }
    });
}

/**
 * Modal buat/edit aplikasi (create: slug + nama wajib; edit: nama wajib).
 * @param {HTMLElement} container
 * @param {string|null} slug null = create, selainnya = edit
 */
async function openEditModal(container, slug = null) {
    const isEdit = Boolean(slug);
    const app = isEdit ? await getApplication(slug) : null;
    if (isEdit && !app) {
        showToast("danger", "Aplikasi tidak ditemukan");
        return;
    }

    const nameInput = Input({ label: "Nama Aplikasi", name: "cn-app-name", value: app?.name || "", required: true, placeholder: "My App" });
    const slugInput = Input({
        label: "Slug (identitas unik)",
        name: "cn-app-slug",
        value: app?.slug || "",
        required: true,
        placeholder: "my-app",
        disabled: isEdit // slug = identitas, tidak bisa diubah
    });
    const codeInput = Input({ label: "Kode", name: "cn-app-code", value: app?.code || "", placeholder: "MYA" });
    const iconInput = Input({ label: "Icon (emoji)", name: "cn-app-icon", value: app?.icon || "📦" });
    const versionInput = Input({ label: "Version", name: "cn-app-version", value: app?.version || "0.1.0" });
    const domainInput = Input({ label: "Domain", name: "cn-app-domain", value: app?.domain || "", placeholder: "https://..." });
    const descInput = Input({ label: "Description", name: "cn-app-desc", value: app?.description || "" });
    const activeSwitch = Switch({ label: "Aktif", name: "cn-app-active", checked: app ? app.active : true });

    // SP-027 M5 — Deployment config (trusted source untuk Deployment Worker).
    const repoInput = Input({ label: "Repository", name: "cn-app-repo", value: app?.repository || "", placeholder: "https://github.com/..." });
    const branchInput = Input({ label: "Branch", name: "cn-app-branch", value: app?.branch || "main", placeholder: "main" });
    const buildCmdInput = Input({ label: "Build Command", name: "cn-app-buildcmd", value: app?.buildCommand || "npm run build", placeholder: "npm run build" });
    const testCmdInput = Input({ label: "Test Command", name: "cn-app-testcmd", value: app?.testCommand || "npm test", placeholder: "npm test" });
    const startCmdInput = Input({ label: "Start Command", name: "cn-app-startcmd", value: app?.startCommand || "pm2 start", placeholder: "pm2 start" });
    const targetInput = Input({ label: "Deployment Target (PM2 / dir)", name: "cn-app-target", value: app?.deploymentTarget || "", placeholder: "inventory-api" });
    const healthInput = Input({ label: "Health Endpoint (wajib utk deployment)", name: "cn-app-health", value: app?.healthEndpoint || "", placeholder: "https://inv.e-profit.id/api/health" });

    const content = `
        <div class="cn-modal-info">${isEdit ? "Ubah data aplikasi" : "Tambahkan aplikasi baru ke platform"}</div>
        <div class="cn-form-grid">
            ${nameInput.outerHTML}
            ${slugInput.outerHTML}
            ${codeInput.outerHTML}
            ${iconInput.outerHTML}
            ${versionInput.outerHTML}
            ${domainInput.outerHTML}
            <div class="full">${descInput.outerHTML}</div>
            <div class="full">${activeSwitch.outerHTML}</div>
            <div class="full cn-muted cn-hint">— Deployment Config (SP-027 M5) — dipakai Deployment Center; command dijalankan dari konfigurasi ini (allowlist server), bukan input bebas.</div>
            ${repoInput.outerHTML}
            ${branchInput.outerHTML}
            ${buildCmdInput.outerHTML}
            ${testCmdInput.outerHTML}
            ${startCmdInput.outerHTML}
            ${targetInput.outerHTML}
            <div class="full">${healthInput.outerHTML}</div>
        </div>
        ${isEdit ? `
        <div class="cn-logo-row cn-app-logo-row">
            <div class="cn-logo-preview cn-logo-preview-empty" id="cn-app-logo-preview">Memuat logo...</div>
            <div class="cn-logo-actions">
                <label class="smart-btn smart-btn-primary cn-file-btn">
                    📁 Pilih Gambar
                    <input type="file" id="cn-app-logo-file" accept="image/*" hidden />
                </label>
                <button class="smart-btn smart-btn-success" id="cn-app-logo-save" disabled>💾 Simpan Logo</button>
                <button class="smart-btn smart-btn-danger" id="cn-app-logo-remove" disabled>🗑 Hapus Logo</button>
                <p class="cn-muted cn-hint">Logo disimpan di server (/api/platform/app-logo/${esc(slug)}) dan dipakai aplikasi terkait.</p>
            </div>
        </div>` : ""}
    `;

    const footer = `<button class="smart-btn smart-btn-primary" id="cn-app-save">${isEdit ? "Simpan" : "Buat Aplikasi"}</button>
                    <button class="smart-btn smart-btn-secondary" id="cn-app-cancel">Batal</button>`;

    const overlay = Modal({
        open: true,
        title: isEdit ? `Edit Aplikasi — ${app.name}` : "Tambah Aplikasi",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);

    // ── Logo aplikasi (hanya edit): tampilkan existing, upload, hapus ──
    let pendingLogo = null;
    if (isEdit) {
        const fileInput = document.getElementById("cn-app-logo-file");
        const saveLogoBtn = document.getElementById("cn-app-logo-save");
        const removeLogoBtn = document.getElementById("cn-app-logo-remove");

        function setLogoPreview(dataUrl) {
            const previewEl = document.getElementById("cn-app-logo-preview");
            if (!previewEl) return;
            if (dataUrl) {
                if (previewEl.tagName === "IMG") {
                    previewEl.src = dataUrl;
                } else {
                    const img = document.createElement("img");
                    img.id = "cn-app-logo-preview";
                    img.className = "cn-logo-preview";
                    img.src = dataUrl;
                    img.alt = "Logo Aplikasi";
                    previewEl.replaceWith(img);
                }
                if (removeLogoBtn) removeLogoBtn.disabled = false;
            } else {
                previewEl.innerHTML = "Belum ada logo";
                if (removeLogoBtn) removeLogoBtn.disabled = true;
            }
        }

        getAppLogo(slug).then(logo => setLogoPreview(logo)).catch(() => setLogoPreview(null));

        fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new globalThis.FileReader();
            reader.onload = (e) => {
                pendingLogo = e.target.result;
                setLogoPreview(pendingLogo);
                saveLogoBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        });

        saveLogoBtn.addEventListener("click", async () => {
            if (!pendingLogo) return;
            saveLogoBtn.disabled = true;
            try {
                await uploadAppLogoToServer(slug, pendingLogo);
                showToast("success", `Logo ${app.name} berhasil disimpan`);
                pendingLogo = null;
                renderTable(container);
            } catch (err) {
                showToast("danger", err.message || "Gagal menyimpan logo");
                saveLogoBtn.disabled = false;
            }
        });

        removeLogoBtn.addEventListener("click", async () => {
            try {
                await removeAppLogoFromServer(slug);
                showToast("success", `Logo ${app.name} dihapus`);
                setLogoPreview(null);
                renderTable(container);
            } catch (err) {
                showToast("danger", err.message || "Gagal menghapus logo");
            }
        });
    }

    overlay.querySelector("#cn-app-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#cn-app-save").addEventListener("click", async () => {
        // Selector via [name=...] di-scope ke overlay modal — komponen Input tidak
        // punya id pada wrapper/input (hanya label `for` + input `name`).
        const q = (name) => overlay.querySelector(`[name="${name}"]`);
        const data = {
            name: q("cn-app-name")?.value?.trim() || "",
            slug: q("cn-app-slug")?.value?.trim().toLowerCase() || "",
            code: q("cn-app-code")?.value?.trim() || "",
            icon: q("cn-app-icon")?.value?.trim() || "📦",
            version: q("cn-app-version")?.value?.trim() || "0.1.0",
            domain: q("cn-app-domain")?.value?.trim() || "",
            description: q("cn-app-desc")?.value?.trim() || "",
            active: q("cn-app-active")?.checked !== false,
            // SP-027 M5 — deployment config
            repository: q("cn-app-repo")?.value?.trim() || "",
            branch: q("cn-app-branch")?.value?.trim() || "main",
            buildCommand: q("cn-app-buildcmd")?.value?.trim() || "npm run build",
            testCommand: q("cn-app-testcmd")?.value?.trim() || "npm test",
            startCommand: q("cn-app-startcmd")?.value?.trim() || "pm2 start",
            deploymentTarget: q("cn-app-target")?.value?.trim() || "",
            healthEndpoint: q("cn-app-health")?.value?.trim() || ""
        };
        if (!data.name || (!isEdit && !data.slug)) {
            showToast("danger", isEdit ? "Nama aplikasi wajib diisi" : "Nama dan slug aplikasi wajib diisi");
            return;
        }
        try {
            if (isEdit) {
                await updateApplication(slug, data);
                showToast("success", "Aplikasi berhasil diperbarui");
            } else {
                await createApplication(data);
                showToast("success", "Aplikasi berhasil dibuat");
            }
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
        ${pageHeader("Applications", "Kelola aplikasi yang tersedia di platform SMART")}
        <div class="cn-card">
            <div class="cn-card-header">
                <span class="cn-card-title">Daftar Aplikasi</span>
                <button class="smart-btn smart-btn-primary" id="cn-app-add">+ Tambah Aplikasi</button>
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
    const add = container.querySelector("#cn-app-add");

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
    add.addEventListener("click", () => openEditModal(container));

    await renderTable(container);
}
