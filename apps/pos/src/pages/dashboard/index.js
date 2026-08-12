/**
 * Dashboard Page — POS.e-Profit / SMART Kasir (PRD V1 §6).
 *
 * Dashboard operasional POS (bukan ERP):
 *   - Omzet hari ini, jumlah transaksi, pajak, diskon
 *   - Produk terlaris (top 5 by qty)
 *   - Stok menipis (trading, stok ≤ stok_minimum)
 *   - Breakdown metode pembayaran
 *   - Ringkasan shift aktif
 *   - Riwayat transaksi hari ini (20 terbaru)
 *
 * Data dari GET /api/pos/dashboard (satu request), fallback statis.
 * Role kasir & admin/owner mendapat tampilan yang sama (ringkas & operasional).
 *
 * @module pos/pages/dashboard
 */

import { Auth, esc } from "@smart/core";
import { apiCall } from "../../data/api.js";
import { formatRupiah } from "../../data/index.js";
import { posDashboardCSS } from "../pos-styles.js";

const PAYMENT_LABELS = { cash: "💵 Tunai", transfer: "🏦 Transfer", qris: "📱 QRIS", card: "💳 Kartu" };

// Framework First: esc dari @smart/core (util global, bukan duplikat lokal)

export function DashboardPage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}</style>
            <div class="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p class="page-subtitle">Ringkasan operasional kasir hari ini</p>
                </div>
                <button class="smart-btn smart-btn-primary" id="pos-dash-refresh">↻ Refresh</button>
            </div>
            <div id="pos-dash-content">
                <div class="cn-loading">Memuat dashboard...</div>
            </div>
        </div>
    `;
}

function statCard(label, value, sub = "", tone = "") {
    return `
        <div class="pos-stat-card ${tone ? "tone-" + tone : ""}">
            <div class="pos-stat-label">${esc(label)}</div>
            <div class="pos-stat-value">${value}</div>
            ${sub ? `<div class="pos-stat-sub">${sub}</div>` : ""}
        </div>
    `;
}

function renderDashboard(container, data) {
    const isKasir = String(Auth.user?.()?.role || "").toLowerCase() === "kasir";
    const omzet = data.omzetHariIni || 0;
    const jumlah = data.jumlahTransaksi || 0;

    const stokMenipisHtml = (data.stokMenipis || []).length
        ? `<table class="cn-table-sm">
            <thead><tr><th>Item</th><th>Stok</th><th>Min.</th></tr></thead>
            <tbody>
                ${data.stokMenipis.map(b => `
                    <tr>
                        <td>${esc(b.nama)} <small class="cn-muted">${esc(b.kode)}</small></td>
                        <td class="${(Number(b.stok) || 0) <= 0 ? "cn-danger" : "cn-warn"}">${Number(b.stok) || 0}</td>
                        <td>${Number(b.stok_minimum) || 0}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`
        : `<p class="cn-muted">Stok aman — tidak ada item menipis.</p>`;

    const terlarisHtml = (data.produkTerlaris || []).length
        ? `<table class="cn-table-sm">
            <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Omzet</th></tr></thead>
            <tbody>
                ${data.produkTerlaris.map((p, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${esc(p.nama)}</td>
                        <td>${p.qty}</td>
                        <td>Rp ${formatRupiah(p.omzet)}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`
        : `<p class="cn-muted">Belum ada penjualan hari ini.</p>`;

    const paymentHtml = (data.metodeBayar || []).length
        ? data.metodeBayar.map(m => `
            <div class="pos-pay-row">
                <span>${PAYMENT_LABELS[m._id] || esc(m._id)}</span>
                <strong>Rp ${formatRupiah(m.omzet)}</strong>
                <small class="cn-muted">${m.jumlah} tx</small>
            </div>`).join("")
        : `<p class="cn-muted">Belum ada pembayaran hari ini.</p>`;

    const shiftHtml = data.shiftAktif
        ? `<div class="pos-shift-banner">
            <div><strong>Shift aktif</strong><br/><small class="cn-muted">${esc(data.shiftAktif.kasir)} · buka ${new Date(data.shiftAktif.waktuMulai).toLocaleTimeString("id-ID")}</small></div>
            <div class="pos-shift-kas">Kas awal: <strong>Rp ${formatRupiah(data.shiftAktif.kasAwal)}</strong></div>
        </div>`
        : `<p class="cn-muted">Tidak ada shift aktif. Buka shift di menu Shift.</p>`;

    const riwayatHtml = (data.riwayatHariIni || []).length
        ? `<table class="cn-table-sm">
            <thead><tr><th>No</th><th>Kasir</th><th>Metode</th><th>Total</th><th>Jam</th></tr></thead>
            <tbody>
                ${data.riwayatHariIni.map(t => `
                    <tr>
                        <td>${esc(t.nomor)}</td>
                        <td>${esc(t.kasir || "-")}</td>
                        <td>${PAYMENT_LABELS[t.metode_bayar] || esc(t.metode_bayar || "cash")}</td>
                        <td>Rp ${formatRupiah(t.grandTotal)}</td>
                        <td class="cn-muted">${new Date(t.tanggal).toLocaleTimeString("id-ID")}</td>
                    </tr>`).join("")}
            </tbody>
        </table>`
        : `<p class="cn-muted">Belum ada transaksi hari ini.</p>`;

    container.innerHTML = `
        <div class="pos-stat-grid">
            ${statCard("Omzet Hari Ini", `Rp ${formatRupiah(omzet)}`, `${jumlah} transaksi`)}
            ${statCard("Total Transaksi", String(jumlah), `pajak Rp ${formatRupiah(data.totalPajak || 0)}`)}
            ${statCard("Stok Menipis", String((data.stokMenipis || []).length), "perlu perhatian", data.stokMenipis?.length ? "warn" : "")}
        </div>

        <div class="pos-dash-grid">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Produk Terlaris</span></div>
                <div class="cn-card-body">${terlarisHtml}</div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Metode Pembayaran</span></div>
                <div class="cn-card-body">${paymentHtml}</div>
            </div>
        </div>

        <div class="pos-dash-grid">
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Stok Menipis</span></div>
                <div class="cn-card-body">${stokMenipisHtml}</div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">${isKasir ? "Status Kas" : "Ringkasan Shift"}</span></div>
                <div class="cn-card-body">${shiftHtml}</div>
            </div>
        </div>

        <div class="cn-card">
            <div class="cn-card-header"><span class="cn-card-title">Riwayat Transaksi Hari Ini</span></div>
            <div class="cn-card-body">${riwayatHtml}</div>
        </div>
    `;
}

export async function initDashboardPage() {
    const container = document.getElementById("pos-dash-content");
    if (!container) return;

    const refresh = document.getElementById("pos-dash-refresh");
    if (refresh) refresh.addEventListener("click", () => load(container));

    await load(container);
}

async function load(container) {
    container.innerHTML = `<div class="cn-loading">Memuat dashboard...</div>`;
    try {
        const res = await apiCall("GET", "/pos/dashboard");
        if (res && res.omzetHariIni !== undefined) {
            renderDashboard(container, res);
            return;
        }
    } catch (err) {
        console.warn("[Dashboard] API error, fallback statis:", err?.message);
    }
    renderDashboard(container, {
        omzetHariIni: 0, jumlahTransaksi: 0, totalPajak: 0, totalDiskon: 0,
        produkTerlaris: [], stokMenipis: [], metodeBayar: [], shiftAktif: null, riwayatHariIni: []
    });
}
