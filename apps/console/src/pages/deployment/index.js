/**
 * SMART Console — Deployment Center (SP-027 M5).
 *
 * Control plane deployment: Applications + Environments, Builds, Releases,
 * Deployments (+ History), dan Database Explorer (read-only).
 *
 * @module console/pages/deployment
 */

import { Modal, Select, Input, showToast } from "@smart/ui";
import {
    listEnvironments,
    createEnvironment,
    updateEnvironment,
    listBuilds,
    triggerBuild,
    listReleases,
    createRelease,
    listDeployments,
    triggerDeployment,
    rollbackDeployment,
    getDeployment
} from "../../services/deployment.js";
import { listApplications } from "../../services/applications.js";
import { pageHeader, loadingHTML, esc, mountPagination, formatDateTime } from "../_shared.js";

let currentTab = "overview";
let _apps = [];
let _envs = [];

const STATUS_BADGE = {
    QUEUED: { cls: "smart-badge-secondary", label: "Queued" },
    RUNNING: { cls: "smart-badge-info", label: "Running" },
    SUCCESS: { cls: "smart-badge-success", label: "Success" },
    FAILED: { cls: "smart-badge-danger", label: "Failed" },
    CANCELLED: { cls: "smart-badge-secondary", label: "Cancelled" },
    ROLLED_BACK: { cls: "smart-badge-warning", label: "Rolled Back" }
};

function statusChip(status) {
    const s = STATUS_BADGE[status] || { cls: "smart-badge-secondary", label: status || "—" };
    return `<span class="smart-badge ${s.cls}">${esc(s.label)}</span>`;
}

function appName(id) {
    const app = _apps.find(a => String(a._id) === String(id));
    return app ? `${esc(app.icon || "📦")} ${esc(app.name)}` : esc(String(id).slice(0, 8));
}

async function loadApps() {
    const res = await listApplications({ page: 1, limit: 999, status: "all" });
    _apps = res?.data || [];
    return _apps;
}

async function loadEnvs() {
    const res = await listEnvironments();
    _envs = res?.data || [];
    return _envs;
}

// ═══════════════════════════════ OVERVIEW ═══════════════════════════════

async function renderOverview(container) {
    await Promise.all([loadApps(), loadEnvs()]);
    const [builds, deployments, releases] = await Promise.all([
        listBuilds({ page: 1, limit: 5 }),
        listDeployments({ page: 1, limit: 5 }),
        listReleases({ page: 1, limit: 5 })
    ]);

    const envRows = _envs
        .filter(e => e.status !== "disabled")
        .map(e => {
            const app = _apps.find(a => String(a._id) === String(e.applicationId));
            return `<tr>
                <td>${esc(app?.name || "?")}</td>
                <td><span class="smart-badge smart-badge-info">${esc(e.name)}</span></td>
                <td>${esc(e.currentVersion || "—")}</td>
                <td>${statusChip(e.lastDeploymentStatus)}</td>
            </tr>`;
        }).join("");

    container.innerHTML = `
        <div class="dp-grid dp-grid-3">
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Aplikasi</span></div>
                <div class="cn-card-body dp-stat">${_apps.length}</div></div>
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Builds (terakhir)</span></div>
                <div class="cn-card-body dp-stat">${builds?.pagination?.total ?? 0}</div></div>
            <div class="cn-card"><div class="cn-card-header"><span class="cn-card-title">Deployments (terakhir)</span></div>
                <div class="cn-card-body dp-stat">${deployments?.pagination?.total ?? 0}</div></div>
        </div>

        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Environment Status</span></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Aplikasi</th><th>Environment</th><th>Current Version</th><th>Status</th></tr></thead>
                    <tbody>${envRows || `<tr><td colspan="4" class="cn-muted">Belum ada environment dikonfigurasi</td></tr>`}</tbody>
                </table>
            </div>
        </div>

        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Deployment Terakhir</span></div>
            <div class="cn-card-body dp-table-wrap">
                <table class="dp-table">
                    <thead><tr><th>Aplikasi</th><th>Env</th><th>Version</th><th>Status</th><th>Waktu</th></tr></thead>
                    <tbody>
                        ${(deployments?.data || []).map(d => `<tr>
                            <td>${appName(d.applicationId)}</td>
                            <td>${esc(d.environment)}</td>
                            <td class="cn-mono">${esc(d.version)}</td>
                            <td>${statusChip(d.status)}</td>
                            <td>${formatDateTime(d.createdAt)}</td>
                        </tr>`).join("") || `<tr><td colspan="5" class="cn-muted">Belum ada deployment</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ═══════════════════════════════ BUILD ═══════════════════════════════

async function renderBuilds(container, page = 1) {
    const res = await listBuilds({ page, limit: 10 });
    const rows = (res.data || []).map(b => `<tr>
        <td>${appName(b.applicationId)}</td>
        <td><span class="smart-badge smart-badge-info">${esc(b.environment)}</span></td>
        <td class="cn-mono">${esc((b.commit || "—").slice(0, 8))}</td>
        <td>${statusChip(b.status)}</td>
        <td>${formatDateTime(b.startedAt)}</td>
        <td>${b.durationMs != null ? `${(b.durationMs / 1000).toFixed(1)}s` : "—"}</td>
    </tr>`).join("");

    container.querySelector("#dp-builds-body").innerHTML = rows || `<tr><td colspan="6" class="cn-muted">Belum ada build. Klik "Build Baru".</td></tr>`;
    mountPagination(container.querySelector("#dp-builds-pagination"), res.pagination, (p) => renderBuilds(container, p), "build");
}

function openBuildModal(container) {
    const appSelect = Select({
        label: "Aplikasi", name: "dp-build-app",
        options: _apps.map(a => ({ value: String(a._id), label: `${a.icon || "📦"} ${a.name}` })),
        placeholder: "Pilih aplikasi"
    });
    const envSelect = Select({
        label: "Environment", name: "dp-build-env",
        options: ["development", "staging", "production"].map(v => ({ value: v, label: v })),
        value: "development"
    });
    const commitInput = Input({ label: "Commit (opsional)", name: "dp-build-commit", placeholder: "abc123" });

    const content = `
        <div class="cn-form-grid">
            ${appSelect.outerHTML}
            ${envSelect.outerHTML}
            ${commitInput.outerHTML}
        </div>
        <p class="cn-muted cn-hint">Command build diambil dari konfigurasi aplikasi (trusted) — bukan input bebas.</p>
    `;
    const footer = `<button class="smart-btn smart-btn-primary" id="dp-build-go">Mulai Build</button>
                    <button class="smart-btn smart-btn-secondary" id="dp-build-cancel">Batal</button>`;
    const overlay = Modal({ open: true, title: "Build Baru", content, footer, closable: true, onClose: () => overlay.remove() });
    document.body.appendChild(overlay);

    overlay.querySelector("#dp-build-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#dp-build-go").addEventListener("click", async () => {
        const q = (n) => overlay.querySelector(`[name="${n}"]`);
        const applicationId = q("dp-build-app")?.value;
        const environment = q("dp-build-env")?.value || "development";
        const commit = q("dp-build-commit")?.value?.trim() || "";
        if (!applicationId) {
            showToast("danger", "Pilih aplikasi terlebih dahulu");
            return;
        }
        try {
            await triggerBuild({ applicationId, environment, commit });
            showToast("success", "Build diantrikan");
            overlay.remove();
            renderTab(container, "builds");
        } catch (err) {
            showToast("danger", err.message);
        }
    });
}

// ═══════════════════════════════ RELEASE ═══════════════════════════════

async function renderReleases(container, page = 1) {
    const res = await listReleases({ page, limit: 10 });
    const rows = (res.data || []).map(r => `<tr>
        <td>${appName(r.applicationId)}</td>
        <td class="cn-mono">${esc(r.version)}</td>
        <td class="cn-mono">${esc((r.commit || "—").slice(0, 8))}</td>
        <td>${statusChip(r.status === "deployed" ? "SUCCESS" : r.status === "rolled_back" ? "ROLLED_BACK" : "QUEUED")}</td>
        <td>${esc(r.createdBy || "—")}</td>
        <td>${formatDateTime(r.createdAt)}</td>
    </tr>`).join("");

    container.querySelector("#dp-releases-body").innerHTML = rows || `<tr><td colspan="6" class="cn-muted">Belum ada release.</td></tr>`;
    mountPagination(container.querySelector("#dp-releases-pagination"), res.pagination, (p) => renderReleases(container, p), "release");
}

function openReleaseModal(container) {
    const appSelect = Select({
        label: "Aplikasi", name: "dp-rel-app",
        options: _apps.map(a => ({ value: String(a._id), label: `${a.icon || "📦"} ${a.name}` })),
        placeholder: "Pilih aplikasi"
    });
    const versionInput = Input({ label: "Version (semver)", name: "dp-rel-version", placeholder: "1.0.0" });
    const commitInput = Input({ label: "Commit", name: "dp-rel-commit", placeholder: "abc123" });
    const notesInput = Input({ label: "Catatan", name: "dp-rel-notes", placeholder: "Deskripsi rilis" });

    const content = `
        <div class="cn-form-grid">
            ${appSelect.outerHTML}
            ${versionInput.outerHTML}
            ${commitInput.outerHTML}
            <div class="full">${notesInput.outerHTML}</div>
        </div>
    `;
    const footer = `<button class="smart-btn smart-btn-primary" id="dp-rel-go">Buat Release</button>
                    <button class="smart-btn smart-btn-secondary" id="dp-rel-cancel">Batal</button>`;
    const overlay = Modal({ open: true, title: "Release Baru", content, footer, closable: true, onClose: () => overlay.remove() });
    document.body.appendChild(overlay);

    overlay.querySelector("#dp-rel-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#dp-rel-go").addEventListener("click", async () => {
        const q = (n) => overlay.querySelector(`[name="${n}"]`);
        const applicationId = q("dp-rel-app")?.value;
        const version = q("dp-rel-version")?.value?.trim();
        if (!applicationId || !version) {
            showToast("danger", "Aplikasi dan version wajib diisi");
            return;
        }
        try {
            await createRelease({
                applicationId,
                version,
                commit: q("dp-rel-commit")?.value?.trim() || "",
                notes: q("dp-rel-notes")?.value?.trim() || ""
            });
            showToast("success", "Release dibuat");
            overlay.remove();
            renderTab(container, "releases");
        } catch (err) {
            showToast("danger", err.message);
        }
    });
}

// ═══════════════════════════════ DEPLOYMENT ═══════════════════════════════

async function renderDeployments(container, page = 1) {
    const res = await listDeployments({ page, limit: 10 });
    const rows = (res.data || []).map(d => `<tr>
        <td>${appName(d.applicationId)}</td>
        <td><span class="smart-badge smart-badge-info">${esc(d.environment)}</span></td>
        <td class="cn-mono">${esc(d.version)}</td>
        <td>${statusChip(d.status)}</td>
        <td>${esc(d.triggeredBy || "—")}</td>
        <td>${formatDateTime(d.createdAt)}</td>
        <td>
            <div class="cn-actions">
                <button class="smart-btn smart-btn-secondary" data-act="detail" data-id="${esc(d._id)}">Detail</button>
                ${d.status === "SUCCESS" ? `<button class="smart-btn smart-btn-danger" data-act="rollback" data-id="${esc(d._id)}">Rollback</button>` : ""}
            </div>
        </td>
    </tr>`).join("");

    container.querySelector("#dp-deployments-body").innerHTML = rows || `<tr><td colspan="7" class="cn-muted">Belum ada deployment.</td></tr>`;
    mountPagination(container.querySelector("#dp-deployments-pagination"), res.pagination, (p) => renderDeployments(container, p), "deployment");

    container.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const act = btn.dataset.act;
            if (act === "detail") openDeploymentDetail(container, btn.dataset.id);
            if (act === "rollback") handleRollback(container, btn.dataset.id);
        });
    });
}

function openDeployModal(container) {
    const appSelect = Select({
        label: "Aplikasi", name: "dp-dep-app",
        options: _apps.map(a => ({ value: String(a._id), label: `${a.icon || "📦"} ${a.name}` })),
        placeholder: "Pilih aplikasi"
    });
    const envSelect = Select({
        label: "Environment", name: "dp-dep-env",
        options: ["development", "staging", "production"].map(v => ({ value: v, label: v })),
        value: "development"
    });
    const releaseSelect = Select({
        label: "Release", name: "dp-dep-release",
        options: [],
        placeholder: "Pilih release (setelah pilih aplikasi)"
    });

    const content = `
        <div class="cn-form-grid">
            ${appSelect.outerHTML}
            ${envSelect.outerHTML}
            <div class="full">${releaseSelect.outerHTML}</div>
        </div>
        <p class="cn-muted cn-hint">Deploy = pilih Aplikasi + Environment + Release. Tidak ada shell command bebas.</p>
    `;
    const footer = `<button class="smart-btn smart-btn-primary" id="dp-dep-go">Deploy</button>
                    <button class="smart-btn smart-btn-secondary" id="dp-dep-cancel">Batal</button>`;
    const overlay = Modal({ open: true, title: "Deploy Release", content, footer, closable: true, onClose: () => overlay.remove() });
    document.body.appendChild(overlay);

    const appQ = () => overlay.querySelector('[name="dp-dep-app"]');
    const relQ = () => overlay.querySelector('[name="dp-dep-release"]');
    let releases = [];

    appQ().addEventListener("change", async () => {
        const appId = appQ().value;
        if (!appId) return;
        try {
            const res = await listReleases({ applicationId: appId, page: 1, limit: 100 });
            releases = res.data || [];
            relQ().innerHTML = `<option value="">Pilih release...</option>` +
                releases.map(r => `<option value="${esc(String(r._id))}">${esc(r.version)} (${esc((r.commit || "").slice(0, 7))})</option>`).join("");
        } catch { /* ignore */ }
    });

    overlay.querySelector("#dp-dep-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#dp-dep-go").addEventListener("click", async () => {
        const applicationId = appQ().value;
        const environment = overlay.querySelector('[name="dp-dep-env"]')?.value;
        const releaseId = relQ().value;
        if (!applicationId || !environment || !releaseId) {
            showToast("danger", "Aplikasi, environment, dan release wajib dipilih");
            return;
        }
        try {
            await triggerDeployment({ applicationId, environment, releaseId });
            showToast("success", "Deployment diantrikan");
            overlay.remove();
            renderTab(container, "deployments");
        } catch (err) {
            showToast("danger", err.message);
        }
    });
}

async function handleRollback(container, id) {
    const footer = `
        <button class="smart-btn smart-btn-danger" id="dp-rb-go">Rollback</button>
        <button class="smart-btn smart-btn-secondary" id="dp-rb-cancel">Batal</button>
    `;
    const overlay = Modal({
        open: true,
        title: "Rollback Deployment",
        content: `<p>Rollback akan men-deploy ulang release SUCCESS terakhir untuk environment yang sama, lalu menandai deployment ini <strong>ROLLED_BACK</strong>.</p>`,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    overlay.querySelector("#dp-rb-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#dp-rb-go").addEventListener("click", async () => {
        try {
            const res = await rollbackDeployment(id);
            showToast("success", `Rollback ke ${res.rollbackDeployment?.version || "release sebelumnya"} diantrikan`);
            overlay.remove();
            renderTab(container, "deployments");
        } catch (err) {
            showToast("danger", err.message);
        }
    });
}

async function openDeploymentDetail(container, id) {
    const d = await getDeployment(id);
    if (!d) {
        showToast("danger", "Deployment tidak ditemukan");
        return;
    }
    const duration = d.durationMs != null ? `${(d.durationMs / 1000).toFixed(1)}s` : "—";
    const content = `
        <div class="dp-detail">
            <div class="dp-detail-row"><span>Aplikasi</span><strong>${appName(d.applicationId)}</strong></div>
            <div class="dp-detail-row"><span>Environment</span><strong>${esc(d.environment)}</strong></div>
            <div class="dp-detail-row"><span>Version</span><strong class="cn-mono">${esc(d.version)}</strong></div>
            <div class="dp-detail-row"><span>Commit</span><strong class="cn-mono">${esc((d.commit || "—").slice(0, 12))}</strong></div>
            <div class="dp-detail-row"><span>Triggered By</span><strong>${esc(d.triggeredBy || "—")}</strong></div>
            <div class="dp-detail-row"><span>Started</span><strong>${formatDateTime(d.startedAt)}</strong></div>
            <div class="dp-detail-row"><span>Finished</span><strong>${formatDateTime(d.finishedAt)}</strong></div>
            <div class="dp-detail-row"><span>Duration</span><strong>${duration}</strong></div>
            <div class="dp-detail-row"><span>Status</span><strong>${statusChip(d.status)}</strong></div>
            <div class="dp-detail-row"><span>Health Check</span><strong>${d.healthCheck?.ok ? "✅ " : "❌ "}${esc(d.healthCheck?.message || "—")}${d.healthCheck?.responseTimeMs != null ? ` (${d.healthCheck.responseTimeMs}ms)` : ""}</strong></div>
        </div>
        <div class="dp-logs"><pre>${esc(d.logs || "Belum ada log.")}</pre></div>
    `;
    const footer = `<button class="smart-btn smart-btn-secondary" id="dp-det-close">Tutup</button>`;
    const overlay = Modal({ open: true, title: "Deployment Detail", content, footer, closable: true, onClose: () => overlay.remove() });
    document.body.appendChild(overlay);
    overlay.querySelector("#dp-det-close").addEventListener("click", () => overlay.remove());
}

// ═══════════════════════════════ TAB DISPATCH ═══════════════════════════════

function renderTab(container, tab) {
    currentTab = tab;
    container.querySelectorAll(".dp-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    const body = container.querySelector("#dp-body");

    if (tab === "overview") return renderOverview(container);
    if (tab === "builds") {
        body.innerHTML = `
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Build Pipeline</span>
                    <button class="smart-btn smart-btn-primary" id="dp-build-new">+ Build Baru</button></div>
                <div class="cn-card-body dp-table-wrap">
                    <table class="dp-table">
                        <thead><tr><th>Aplikasi</th><th>Env</th><th>Commit</th><th>Status</th><th>Mulai</th><th>Durasi</th></tr></thead>
                        <tbody id="dp-builds-body"></tbody>
                    </table>
                </div>
                <div class="cn-pagination-row" id="dp-builds-pagination"></div>
            </div>`;
        container.querySelector("#dp-build-new").addEventListener("click", () => openBuildModal(container));
        renderBuilds(container);
        return;
    }
    if (tab === "releases") {
        body.innerHTML = `
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Release Management</span>
                    <button class="smart-btn smart-btn-primary" id="dp-rel-new">+ Release Baru</button></div>
                <div class="cn-card-body dp-table-wrap">
                    <table class="dp-table">
                        <thead><tr><th>Aplikasi</th><th>Version</th><th>Commit</th><th>Status</th><th>Dibuat oleh</th><th>Waktu</th></tr></thead>
                        <tbody id="dp-releases-body"></tbody>
                    </table>
                </div>
                <div class="cn-pagination-row" id="dp-releases-pagination"></div>
            </div>`;
        container.querySelector("#dp-rel-new").addEventListener("click", () => openReleaseModal(container));
        renderReleases(container);
        return;
    }
    if (tab === "deployments") {
        body.innerHTML = `
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Deployment History</span>
                    <button class="smart-btn smart-btn-primary" id="dp-dep-new">+ Deploy Release</button></div>
                <div class="cn-card-body dp-table-wrap">
                    <table class="dp-table">
                        <thead><tr><th>Aplikasi</th><th>Env</th><th>Version</th><th>Status</th><th>Trigger</th><th>Waktu</th><th>Action</th></tr></thead>
                        <tbody id="dp-deployments-body"></tbody>
                    </table>
                </div>
                <div class="cn-pagination-row" id="dp-deployments-pagination"></div>
            </div>`;
        container.querySelector("#dp-dep-new").addEventListener("click", () => openDeployModal(container));
        renderDeployments(container);
        return;
    }
    if (tab === "database") {
        body.innerHTML = `<div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Database Explorer</span></div>
            <div class="cn-card-body" id="dp-db-root"></div>
        </div>`;
        // Modul Database Explorer lengkap (SP-027 M5-FIX) — lazy load
        import("./database.js").then(m => m.renderDatabaseExplorer(container.querySelector("#dp-db-root")));
        return;
    }
}

/**
 * Render & init halaman Deployment Center.
 * @param {HTMLElement} container
 */
export async function renderDeployment(container) {
    currentTab = "overview";
    await loadApps();

    container.innerHTML = `
        ${pageHeader("Deployment Center", "Control plane deployment platform — build, release, deploy, dan observasi database")}
        <div class="dp-tabs">
            <button class="smart-btn smart-btn-secondary dp-tab active" data-tab="overview">Overview</button>
            <button class="smart-btn smart-btn-secondary dp-tab" data-tab="builds">Builds</button>
            <button class="smart-btn smart-btn-secondary dp-tab" data-tab="releases">Releases</button>
            <button class="smart-btn smart-btn-secondary dp-tab" data-tab="deployments">Deployments</button>
            <button class="smart-btn smart-btn-secondary dp-tab" data-tab="database">Database</button>
        </div>
        <div id="dp-body"></div>
    `;

    container.querySelectorAll(".dp-tab").forEach(btn => {
        btn.addEventListener("click", () => renderTab(container, btn.dataset.tab));
    });

    await renderTab(container, "overview");
}
