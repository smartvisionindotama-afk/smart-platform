import { routes } from "./routes";

import { Permission } from "@smart/core";
import { isTransactionTypeEnabled } from "../config/company-config.js";

/**
 * Navigate to a page.
 *
 * Supports lifecycle:
 *   route.component()  → returns HTML string for innerHTML
 *   route.init()       → called after mount for post-render initialization
 *
 * SP-029 POS V1 — Transaction Capability gate:
 * route dengan field `capability` hanya tersedia bila capability tsb
 * diaktifkan untuk perusahaan (Company.transactionTypes). Jika disabled,
 * frontend menolak render + mengarahkan ke halaman POS yang aman
 * (dashboard) — enforcement backend tetap ada di endpoint terkait.
 *
 * @param {string} page
 */
export function navigate(page) {
    const app = document.getElementById("content");
    const route = routes[page];

    if (!route) {
        app.innerHTML = "<h2>404 Page Not Found</h2>";
        return;
    }

    // ── Transaction Capability gate (SP-029 POS V1) ──
    // Menolak render route yang capability-nya tidak aktif (bukan hanya
    // menyembunyikan menu) — direct access via URL pun diblokir frontend.
    const capability = route.capability;
    if (capability && !isTransactionTypeEnabled(capability)) {
        console.warn(`[Router] Route "${page}" membutuhkan capability "${capability}" yang tidak aktif untuk perusahaan ini`);
        app.innerHTML = `
            <div class="capability-unavailable">
                <h2>Jenis Transaksi Tidak Aktif</h2>
                <p>
                    Halaman ini membutuhkan jenis transaksi
                    <strong>"${capability}"</strong> yang belum diaktifkan untuk
                    perusahaan ini. Hubungi admin untuk mengaktifkannya di
                    konfigurasi perusahaan.
                </p>
                <button class="smart-btn smart-btn-primary" id="capability-back-dashboard">Kembali ke Dashboard</button>
            </div>
        `;
        const backBtn = document.getElementById("capability-back-dashboard");
        if (backBtn) {
            backBtn.addEventListener("click", () => navigate("dashboard"));
        }
        return;
    }

    const allowed = Permission.can(route.permission);
    if (!allowed) {
        app.innerHTML = `
            <div>
                <h2>Access Denied</h2>
                <p>Anda tidak memiliki hak akses ke halaman ini.</p>
            </div>
        `;
        return;
    }

    const render = route.component;
    app.innerHTML = render();

    // Post-mount lifecycle
    if (typeof route.init === "function") {
        route.init();
    }
}
