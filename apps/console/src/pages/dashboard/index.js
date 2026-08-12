/**
 * SMART Console — Dashboard Page.
 *
 * SP-027 M1: 8 widget statistik platform:
 * Total Applications, Total Companies, Total Super Admin, Platform Version,
 * Server Status (placeholder), Database Status (placeholder),
 * Active Companies, Registered Companies.
 *
 * @module console/pages/dashboard
 */

import { StatCard, Card, showToast } from "@smart/ui";
import { AppConfig } from "@smart/core";
import { listCompanies } from "../../services/companies.js";
import { listSuperadmins } from "../../services/superadmins.js";
import { countApplications } from "../../services/applications.js";
import { getMonitoringOverview } from "../../services/monitoring.js";
import { pageHeader, loadingHTML } from "../_shared.js";

async function loadDashboardStats() {
    const [companiesResult, superadmins, totalApps, monitoring] = await Promise.all([
        listCompanies({ page: 1, limit: 999 }),
        listSuperadmins(),
        countApplications(),
        getMonitoringOverview().catch(() => null)
    ]);

    const companies = companiesResult?.data || [];
    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(c => c.active).length;

    return {
        totalApps,
        totalCompanies,
        activeCompanies,
        totalSuperadmins: (superadmins || []).length,
        version: AppConfig.version || "1.0.0",
        // SP-027 M4: status nyata dari Monitoring API (bukan placeholder)
        serverStatus: monitoring?.infrastructure?.status || "—",
        databaseStatus: monitoring?.database?.status || monitoring?.services?.mongodb?.status || "—"
    };
}

function statGrid(stats) {
    const mount = document.createElement("div");
    mount.className = "cn-stat-grid";

    const items = [
        { title: "Total Applications", value: String(stats.totalApps) },
        { title: "Total Companies", value: String(stats.totalCompanies) },
        { title: "Total Super Admin", value: String(stats.totalSuperadmins) },
        { title: "Platform Version", value: stats.version },
        { title: "Server Status", value: stats.serverStatus || "—" },
        { title: "Database Status", value: stats.databaseStatus || "—" },
        { title: "Active Companies", value: String(stats.activeCompanies) },
        { title: "Registered Companies", value: String(stats.totalCompanies) }
    ];

    items.forEach(item => {
        mount.appendChild(StatCard({ title: item.title, value: item.value }));
    });

    return mount;
}

/**
 * Render & init halaman Dashboard.
 * @param {HTMLElement} container
 */
export async function renderDashboard(container) {
    container.innerHTML = `${pageHeader("Dashboard", "Ringkasan platform SMART")}${loadingHTML()}`;

    try {
        const stats = await loadDashboardStats();
        const grid = statGrid(stats);

        container.innerHTML = pageHeader("Dashboard", "Ringkasan platform SMART");
        container.appendChild(grid);

        const card = Card({
            title: "Informasi",
            content: "SMART Console — pusat kendali platform. Halaman dashboard menampilkan ringkasan aplikasi, perusahaan, dan super admin yang terdaftar."
        });
        card.classList.add("cn-welcome-card");
        const wrapper = document.createElement("div");
        wrapper.className = "cn-stack-gap";
        wrapper.appendChild(card);
        container.appendChild(wrapper);
    } catch (err) {
        container.innerHTML = pageHeader("Dashboard", "Ringkasan platform SMART");
        showToast("danger", "Gagal memuat statistik: " + (err.message || err));
    }
}
