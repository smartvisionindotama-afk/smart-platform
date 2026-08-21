/**
 * Settings — Permission Module (Framework Module).
 *
 * Reusable role-permission management module for SMART Platform.
 * Accepts data service functions via dependency injection.
 *
 * @module @smart/ui/modules/settings/permission
 */

import { Modal, Toast, Table, EmptyState, Alert, Skeleton, UI } from "../../index.js";
import { esc } from "@smart/core";

/**
 * Permission Settings Page component.
 *
 * @param {object} options
 * @param {function} options.getRolesWithPermissions   Async (params) => { data }
 * @param {function} options.getRolePermissions        Async (roleName) => string[]
 * @param {function} options.grantPermissionToRole     Async (roleName, permission) => boolean
 * @param {function} options.revokePermissionFromRole  Async (roleName, permission) => boolean
 * @param {function} options.getPermissionGroups       Sync () => { [group]: string[] }
 * @returns {{ render: function, init: function }}
 */
export function SettingsPermissionModule({ getRolesWithPermissions, getRolePermissions, grantPermissionToRole, revokePermissionFromRole, getPermissionGroups, onPermissionsChanged }) {
    const state = { items: [], page: 1, limit: 20, loading: false };

    function render() {
        return `
        <div id="settings-permission-page" class="crud-page">
            <style>${getStyles()}</style>
            <div class="page-header">
                <div>
                    <h1>Permission Management</h1>
                    <div class="header-subtitle">Atur izin akses untuk setiap role</div>
                </div>
            </div>
            <div class="table-container">
                <div id="perm-table-area"></div>
            </div>
        </div>`;
    }

    function init() {
        loadData();
    }

    async function loadData() {
        const tableArea = document.getElementById("perm-table-area");
        if (!tableArea) return;
        state.loading = true;
        tableArea.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.className = "skeleton-wrapper";
        wrapper.appendChild(Skeleton({ variant: "table-row", count: 4 }));
        tableArea.appendChild(wrapper);

        try {
            const result = await getRolesWithPermissions({ page: state.page, limit: state.limit });
            state.items = result.data;

            tableArea.innerHTML = "";
            if (state.items.length === 0) {
                tableArea.appendChild(EmptyState({ icon: "🛡️", title: "Belum ada role", description: "Tambahkan role terlebih dahulu" }));
            } else if (window.innerWidth < 768) {
                renderPermCards(tableArea);
            } else {
                const table = Table({
                    columns: [
                        { key: "label", label: "Role", width: "160px" },
                        { key: "name", label: "ID", width: "110px" },
                        { key: "level", label: "Level", width: "70px", align: "center", render: (val) => `<span class="badge-level">${val}</span>` },
                        { key: "permissionCount", label: "Total Izin", width: "100px", align: "center", render: (v) => `<strong>${v}</strong>` },
                        { key: "actions", label: "Kelola Izin", render: (_, row) => `<button class="perm-manage-btn" data-manage="${row.name}">🔑 Atur Izin (${row.permissionCount})</button>` }
                    ],
                    rows: state.items, striped: true, hoverable: true, bordered: false
                });
                tableArea.appendChild(table);
                tableArea.querySelectorAll("[data-manage]").forEach(btn => {
                    btn.addEventListener("click", () => openPermissionEditor(btn.dataset.manage));
                });
            }
        } catch (err) {
            console.error("[SettingsPermission] Failed to load:", err);
            tableArea.innerHTML = "";
            tableArea.appendChild(Alert({ variant: "danger", message: "Gagal memuat data", dismissible: true }));
        } finally { state.loading = false; }
    }

    function renderPermCards(container) {
        const list = UI.CardList(state.items, (item) => {
            return `
                <div class="sm-card-header-row">
                    <div class="sm-card-name">${esc(item.label)}</div>
                    <span class="sm-card-code">${esc(item.name)}</span>
                </div>
                <div class="sm-card-divider"></div>
                <div class="sm-card-details">
                    <div class="sm-card-detail-row"><span class="sm-card-label">Level</span><span class="sm-card-value"><span class="badge-level">${item.level}</span></span></div>
                    <div class="sm-card-detail-row"><span class="sm-card-label">Total Izin</span><span class="sm-card-value"><strong>${item.permissionCount}</strong></span></div>
                </div>
                <div class="sm-card-footer-row">
                    <div class="sm-card-footer-left"></div>
                    <div class="sm-card-footer-right">
                        <button class="sm-card-btn sm-card-btn-edit perm-manage-btn" data-manage="${item.name}">🔑 Atur Izin (${item.permissionCount})</button>
                    </div>
                </div>
            `;
        });
        container.appendChild(list);
        container.querySelectorAll("[data-manage]").forEach(btn => {
            btn.addEventListener("click", () => openPermissionEditor(btn.dataset.manage));
        });
    }

    async function openPermissionEditor(roleName) {
        const role = state.items.find(r => r.name === roleName);
        if (!role) return;

        let currentPerms = [];
        try {
            currentPerms = await getRolePermissions(roleName);
        } catch { showToast("danger", "Gagal memuat izin"); return; }

        const groups = getPermissionGroups();
        const title = `Atur Izin — ${role.label}`;

        let contentHTML = `<p style="font-size:0.85rem;color:#64748b;margin-bottom:1rem">Centang izin yang ingin diberikan ke role <strong>${esc(role.label)}</strong></p>`;

        for (const [group, perms] of Object.entries(groups)) {
            contentHTML += `
                <div class="perm-group">
                    <div class="perm-group-header" data-group="${group}">
                        <span class="perm-group-toggle">▶</span>
                        <strong>${group.charAt(0).toUpperCase() + group.slice(1)}</strong>
                        <span class="perm-count">${perms.length}</span>
                    </div>
                    <div class="perm-items" style="display:none">
                        ${perms.map(p => {
                            const checked = currentPerms.includes("*") || currentPerms.includes(p);
                            return `<label class="perm-item ${checked ? 'checked' : ''}">
                                <input type="checkbox" data-perm="${p}" data-role="${roleName}" ${checked ? "checked" : ""} ${currentPerms.includes("*") ? "disabled" : ""} />
                                <span class="perm-name">${p}</span>
                            </label>`;
                        }).join("")}
                        ${currentPerms.includes("*") ? '<p style="font-size:0.8rem;color:#64748b;margin-top:4px">Semua izin sudah diberikan (wildcard "*")</p>' : ""}
                    </div>
                </div>`;
        }

        const footer = `<button class="smart-btn smart-btn-secondary" id="p-close">Tutup</button>`;
        const overlay = Modal({ open: true, title, content: contentHTML, footer, closable: true, onClose: removeModal });
        overlay.classList.add("perm-modal");
        document.body.appendChild(overlay);

        document.getElementById("p-close")?.addEventListener("click", () => { loadData(); removeModal(); });
        overlay.querySelector(".smart-modal-close")?.addEventListener("click", () => { loadData(); removeModal(); });

        overlay.querySelectorAll(".perm-group-header").forEach(header => {
            header.addEventListener("click", () => {
                const items = header.nextElementSibling;
                const toggle = header.querySelector(".perm-group-toggle");
                if (items) {
                    const isHidden = items.style.display === "none";
                    items.style.display = isHidden ? "block" : "none";
                    if (toggle) toggle.textContent = isHidden ? "▼" : "▶";
                }
            });
        });

        const firstGroup = overlay.querySelector(".perm-group-header");
        if (firstGroup) firstGroup.click();

        overlay.querySelectorAll("[data-perm]").forEach(cb => {
            cb.addEventListener("change", async (e) => {
                const perm = e.target.dataset.perm;
                const rName = e.target.dataset.role;
                const label = e.target.closest(".perm-item");
                try {
                    let ok;
                    if (e.target.checked) {
                        ok = await grantPermissionToRole(rName, perm);
                    } else {
                        ok = await revokePermissionFromRole(rName, perm);
                    }
                    if (!ok) {
                        e.target.checked = !e.target.checked;
                        showToast("danger", `Gagal ${e.target.checked ? "menambahkan" : "mencabut"} izin ${perm}`);
                        return;
                    }
                    if (e.target.checked) label?.classList.add("checked");
                    else label?.classList.remove("checked");
                    showToast("success", `Izin ${perm} ${e.target.checked ? "ditambahkan" : "dicabut"}`);
                    // Notifikasi agar sesi aktif & sidebar ikut diperbarui (jika disediakan oleh host app)
                    if (typeof onPermissionsChanged === "function") {
                        Promise.resolve(onPermissionsChanged()).catch(() => {});
                    }
                } catch (err) {
                    console.error("Permission change failed:", err);
                    e.target.checked = !e.target.checked;
                    showToast("danger", "Gagal mengubah izin");
                }
            });
        });
    }

    function removeModal() {
        const overlay = document.querySelector(".perm-modal");
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function showToast(variant, message) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.style.cssText = "position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;max-width:400px;";
            document.body.appendChild(container);
        }
        const toast = Toast({ variant, message, onDismiss: () => toast.remove() });
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3500);
    }

    return { render, init };
}

// Framework First: esc dari @smart/core (util global, bukan duplikat lokal)

function getStyles() { return `
.crud-page { padding: 1.5rem; }
.crud-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
.crud-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:600; color:var(--smart-text-primary,#1a1a2e); }
.crud-page .header-subtitle { font-size:0.85rem; color:var(--smart-text-secondary,#6b7280); }
.crud-page .table-container { background:var(--smart-card-bg,#fff); border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); overflow:hidden; }
.crud-page .skeleton-wrapper { padding:1rem; }
.crud-page .badge-level { display:inline-block; padding:2px 8px; border-radius:4px; font-size:0.8rem; background:#f0fdf4; color:#16a34a; font-weight:600; }
.perm-manage-btn { padding:0.4rem 0.8rem; border:1px solid #c7d2fe; border-radius:6px; background:#eef2ff; color:#4f46e5; cursor:pointer; font-size:0.8rem; transition:all 0.15s; white-space:nowrap; }
.perm-manage-btn:hover { background:#e0e7ff; }
.perm-modal .modal-content { max-width: 600px !important; }
.perm-group { margin-bottom:8px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
.perm-group-header { display:flex; align-items:center; gap:8px; padding:10px 14px; background:#f8fafc; cursor:pointer; user-select:none; transition:background 0.15s; }
.perm-group-header:hover { background:#f1f5f9; }
.perm-group-toggle { font-size:10px; color:#94a3b8; width:16px; }
.perm-count { margin-left:auto; font-size:0.75rem; color:#94a3b8; background:#e2e8f0; padding:1px 8px; border-radius:10px; }
.perm-items { padding:6px 14px 14px 28px; }
.perm-item { display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer; font-size:0.85rem; color:#475569; }
.perm-item:hover { color:#1e293b; }
.perm-item input[type="checkbox"] { accent-color:#4f46e5; cursor:pointer; }
.perm-item.checked .perm-name { color:#1e293b; font-weight:500; }
.perm-name { font-family:monospace; font-size:0.8rem; }
`;}
