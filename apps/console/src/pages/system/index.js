/**
 * SMART Console — System Information Page.
 *
 * SP-027 M1: Platform Version, Build Version, Environment, API URL,
 * MongoDB Status, Server Status, Node Version — SP-027 M4: semua status
 * diisi dari Monitoring API (bukan placeholder).
 *
 * @module console/pages/system
 */

import { getSystemInfo } from "../../services/system.js";
import { pageHeader, esc } from "../_shared.js";

function infoCard(icon, label, value, placeholder = false) {
    return `
        <div class="cn-info-card">
            <div class="cn-info-icon">${icon}</div>
            <div class="cn-info-body">
                <div class="cn-info-label">${label}</div>
                <div class="cn-info-value ${placeholder ? "placeholder" : ""}">${value}</div>
            </div>
        </div>
    `;
}

/**
 * Render & init halaman System Information.
 * @param {HTMLElement} container
 */
export async function renderSystem(container) {
    const info = await getSystemInfo();

    const cards = [
        infoCard("🧩", "Platform Version", esc(info.platformVersion)),
        infoCard("🏗️", "Build Version", esc(info.buildVersion)),
        infoCard("🌍", "Environment", esc(info.environment)),
        infoCard("🔗", "API URL", esc(info.apiUrl)),
        infoCard("🗄️", "MongoDB Status", info.mongoStatus ? esc(info.mongoStatus) : "—", !info.mongoStatus),
        infoCard("🖥️", "Server Status", info.serverStatus ? esc(info.serverStatus) : "—", !info.serverStatus),
        infoCard("🟢", "Node Version", info.nodeVersion ? esc(info.nodeVersion) : "—", !info.nodeVersion)
    ];

    container.innerHTML = `
        ${pageHeader("System Information", "Informasi versi dan status infrastruktur platform")}
        <div class="cn-info-cards">
            ${cards.join("")}
        </div>
        <div class="cn-stack-gap">
            <div class="cn-card">
                <div class="cn-card-body">
                    <p class="cn-muted cn-note">
                        Status MongoDB, server, dan Node.js diisi dari Monitoring API
                        (SP-027 M4) — data waktu-nyata dari Monitoring Center.
                    </p>
                </div>
            </div>
        </div>
    `;
}
