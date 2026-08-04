/**
 * SMART Console — Platform Settings Page.
 *
 * SP-027 M1: pengaturan platform — upload/hapus logo platform (server-side
 * file based via services/platform.js) + info platform.
 *
 * @module console/pages/settings
 */

import { showToast } from "@smart/ui";
import { AppConfig } from "@smart/core";
import { uploadLogoToServer, removeLogoFromServer } from "../../services/platform.js";
import { CONSOLE_CONFIG } from "../../config/index.js";
import { pageHeader, esc } from "../_shared.js";

function currentLogo() {
    try {
        return localStorage.getItem("smart_superadmin_logo");
    } catch {
        return null;
    }
}

async function renderSettings(container) {
    const logo = currentLogo();

    container.innerHTML = `
        ${pageHeader("Platform Settings", "Pengaturan branding dan identitas platform")}
        <div class="cn-info-cards">
            <div class="cn-info-card">
                <div class="cn-info-icon">🎨</div>
                <div class="cn-info-body">
                    <div class="cn-info-label">Platform</div>
                    <div class="cn-info-value">${esc(CONSOLE_CONFIG.title)}</div>
                </div>
            </div>
            <div class="cn-info-card">
                <div class="cn-info-icon">🏷️</div>
                <div class="cn-info-body">
                    <div class="cn-info-label">Version</div>
                    <div class="cn-info-value">${esc(AppConfig.version || "1.0.0")}</div>
                </div>
            </div>
            <div class="cn-info-card">
                <div class="cn-info-icon">⚙️</div>
                <div class="cn-info-body">
                    <div class="cn-info-label">Environment</div>
                    <div class="cn-info-value">${esc(CONSOLE_CONFIG.environment)}</div>
                </div>
            </div>
        </div>

        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-header">
                    <span class="cn-card-title">Logo Platform</span>
                </div>
                <div class="cn-card-body">
                    <div class="cn-logo-row">
                        ${logo
                            ? `<img class="cn-logo-preview" src="${esc(logo)}" alt="Platform Logo" id="cn-logo-preview" />`
                            : `<div class="cn-logo-preview cn-logo-preview-empty" id="cn-logo-preview">Belum ada logo</div>`}
                        <div class="cn-logo-actions">
                            <label class="smart-btn smart-btn-primary cn-file-btn">
                                📁 Pilih Gambar
                                <input type="file" id="cn-logo-file" accept="image/*" hidden />
                            </label>
                            ${logo ? `<button class="smart-btn smart-btn-danger" id="cn-logo-remove">🗑 Hapus Logo</button>` : ""}
                            <button class="smart-btn smart-btn-success" id="cn-logo-save" disabled>💾 Simpan ke Server</button>
                            <p class="cn-muted cn-hint">Logo disimpan di server (/api/platform/logo) dan dipakai di seluruh subdomain e-profit.id.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const fileInput = container.querySelector("#cn-logo-file");
    const saveBtn = container.querySelector("#cn-logo-save");
    const removeBtn = container.querySelector("#cn-logo-remove");
    let pendingDataUrl = null;

    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new globalThis.FileReader();
        reader.onload = (e) => {
            pendingDataUrl = e.target.result;
            saveBtn.disabled = false;
            const preview = container.querySelector("#cn-logo-preview");
            if (preview) {
                if (preview.tagName === "IMG") {
                    preview.src = pendingDataUrl;
                } else {
                    const img = document.createElement("img");
                    img.id = "cn-logo-preview";
                    img.className = "cn-logo-preview";
                    img.src = pendingDataUrl;
                    preview.replaceWith(img);
                }
            }
        };
        reader.readAsDataURL(file);
    });

    saveBtn.addEventListener("click", async () => {
        if (!pendingDataUrl) return;
        try {
            await uploadLogoToServer(pendingDataUrl);
            try { localStorage.setItem("smart_superadmin_logo", pendingDataUrl); } catch { /* ignore */ }
            showToast("success", "Logo platform tersimpan");
            saveBtn.disabled = true;
            pendingDataUrl = null;
            setTimeout(() => renderSettings(container), 400);
        } catch (err) {
            showToast("danger", err.message || "Gagal menyimpan logo");
        }
    });

    if (removeBtn) {
        removeBtn.addEventListener("click", async () => {
            try {
                await removeLogoFromServer();
                try { localStorage.removeItem("smart_superadmin_logo"); } catch { /* ignore */ }
                showToast("success", "Logo platform dihapus");
                renderSettings(container);
            } catch (err) {
                showToast("danger", err.message || "Gagal menghapus logo");
            }
        });
    }
}

/**
 * Render & init halaman Platform Settings.
 * @param {HTMLElement} container
 */
export async function renderSettingsPage(container) {
    container.innerHTML = pageHeader("Platform Settings", "Pengaturan branding dan identitas platform");
    await renderSettings(container);
}
