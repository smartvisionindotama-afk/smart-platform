/**
 * Shared page styles — Dashboard POS & Laporan Kasir (PRD V1 §6, §13).
 *
 * Kelas `cn-*` / `dp-*` / `pos-*` hanya tersedia di console.css (apps/console)
 * dan TIDAK di-load oleh app POS — karena itu kedua halaman meng-inject blok
 * `<style>` sendiri (pola yang sama dengan modul shared @smart/inventory-ui).
 *
 * Palet mengikuti design token app POS (var(--smart-*) + aksen emerald SMART
 * Kasir) dengan dukungan dark mode.
 *
 * @module pos/pages/pos-styles
 */

export function posDashboardCSS() {
    return `
/* ── POS Dashboard & Laporan Kasir — shared page styles ── */
.pos-dash-page .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem; }
.pos-dash-page .page-header h1 { margin:0; font-size:1.5rem; font-weight:700; color:var(--smart-text-primary,#1e293b); }
.pos-dash-page .page-subtitle { margin:2px 0 0; font-size:0.85rem; color:var(--smart-text-secondary,#64748b); }

/* Stat cards */
.pos-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-bottom:16px; }
.pos-stat-card { background:var(--smart-card-bg,#fff); border:1px solid var(--smart-border,#e2e8f0); border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
.pos-stat-card.tone-warn { border-color:#f59e0b; }
.pos-stat-label { font-size:0.72rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--smart-text-secondary,#64748b); }
.pos-stat-value { font-size:1.6rem; font-weight:800; color:var(--smart-text-primary,#1e293b); margin-top:4px; word-break:break-word; }
.pos-stat-sub { font-size:0.75rem; color:var(--smart-text-secondary,#94a3b8); margin-top:2px; }

/* Card grid */
.pos-dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }

/* Generic cards (padanan cn-card dari console.css) */
.cn-card { background:var(--smart-card-bg,#fff); border:1px solid var(--smart-border,#e2e8f0); border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:16px; }
.cn-card-header { padding:12px 16px; border-bottom:1px solid var(--smart-border,#eef0f3); }
.cn-card-title { font-size:0.85rem; font-weight:700; color:var(--smart-text-primary,#1e293b); }
.cn-card-body { padding:14px 16px; }

/* Tables */
.cn-table-sm, .dp-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
.cn-table-sm th, .cn-table-sm td, .dp-table th, .dp-table td { padding:8px 10px; border-bottom:1px solid var(--smart-border,#eef0f3); text-align:left; }
.cn-table-sm th, .dp-table th { color:var(--smart-text-secondary,#64748b); font-weight:600; text-transform:uppercase; font-size:0.68rem; letter-spacing:0.4px; }
.dp-table-wrap { overflow-x:auto; }
.dp-table th, .dp-table td { white-space:nowrap; }

/* Utilities */
.cn-muted { color:var(--smart-text-secondary,#94a3b8); font-size:0.78rem; }
.cn-danger { color:#dc2626; font-weight:600; }
.cn-warn { color:#d97706; font-weight:600; }
.cn-text-right { text-align:right !important; }
.cn-loading { padding:28px; text-align:center; color:var(--smart-text-secondary,#94a3b8); }
.cn-empty { padding:24px; text-align:center; color:var(--smart-text-secondary,#94a3b8); border:1px dashed var(--smart-border,#d1d5db); border-radius:8px; margin:8px 0; }

/* Payment rows */
.pos-pay-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px dashed var(--smart-border,#e5e7eb); font-size:0.85rem; }
.pos-pay-row:last-child { border-bottom:0; }
.pos-pay-row strong { color:var(--smart-text-primary,#1e293b); }
.pos-pay-row small { flex-shrink:0; }

/* Shift banner */
.pos-shift-banner { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid #a7f3d0; border-radius:10px; background:#ecfdf5; color:#065f46; font-size:0.85rem; flex-wrap:wrap; }
.pos-shift-kas { text-align:right; }

/* Filter bar (Laporan Kasir) */
.dp-db-filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.dp-db-filter-bar .smart-input { width:auto; }

/* Shift page */
.cn-ok { color:#059669; font-weight:600; }
.pos-shift-empty { border-style:dashed; }
.ps-status-badge { display:inline-block; font-size:0.68rem; font-weight:700; padding:2px 9px; border-radius:999px; }
.ps-status-order { background:#dcfce7; color:#166534; }
.ps-status-void { background:#fee2e2; color:#991b1b; }

/* Form modal sederhana (padanan bl-form console.css) */
.bl-form { display:flex; flex-direction:column; gap:8px; }
.bl-form label { font-size:0.78rem; font-weight:600; color:var(--smart-text-secondary,#6b7280); margin-top:4px; }
.bl-form input.smart-input, .bl-form select.smart-input, .bl-form textarea.smart-input { width:100%; }

/* ── Dark mode ── */
[data-theme="dark"] .pos-stat-card,
[data-theme="dark"] .cn-card { background:var(--smart-card-bg,#1e293b); border-color:var(--smart-border,#334155); }
[data-theme="dark"] .pos-stat-value,
[data-theme="dark"] .cn-card-title { color:var(--smart-text-primary,#f1f5f9); }
[data-theme="dark"] .cn-card-header { border-bottom-color:#334155; }
[data-theme="dark"] .cn-table-sm th, [data-theme="dark"] .cn-table-sm td,
[data-theme="dark"] .dp-table th, [data-theme="dark"] .dp-table td { border-bottom-color:#334155; }
[data-theme="dark"] .pos-pay-row { border-bottom-color:#334155; }
[data-theme="dark"] .pos-pay-row strong { color:#f1f5f9; }
[data-theme="dark"] .pos-shift-banner { background:#064e3b; border-color:#047857; color:#a7f3d0; }
[data-theme="dark"] .cn-empty { border-color:#334155; }
[data-theme="dark"] .ps-status-order { background:#064e3b; color:#6ee7b7; }
[data-theme="dark"] .ps-status-void { background:#450a0a; color:#fca5a5; }

/* ── Responsive ── */
@media (max-width: 900px) {
    .pos-dash-grid { grid-template-columns:1fr; }
}

/* ── M6-FIX v3 — Ringkasan Tutup Shift (saldo awal, tunai, non-tunai) ── */
.shift-summary {
    display:grid; gap:6px;
    border:1px solid var(--smart-border,#e2e8f0); border-radius:8px;
    padding:10px 12px; margin-bottom:10px; background:#f8fafc;
}
[data-theme="dark"] .shift-summary { background:#0f172a; border-color:#334155; }
.shift-summary-row {
    display:flex; justify-content:space-between; gap:12px; font-size:13px;
    color:var(--smart-text-primary,#1e293b);
}
.shift-summary-row strong { font-variant-numeric:tabular-nums; }
.shift-summary-sub { padding-top:4px; border-top:1px dashed #cbd5e1; }
.shift-summary-refund { color:#dc2626; font-weight:600; }
.shift-summary-refund strong { color:#dc2626; }
.shift-summary-expected { padding-top:6px; border-top:1px solid #cbd5e1; font-weight:700; }
.shift-summary-expected strong { color:var(--smart-primary,#10b981); }
.shift-selisih { margin-top:6px; font-size:13px; }
.shift-selisih-ok { color:#059669; font-weight:600; }
.shift-selisih-warn { color:#b45309; font-weight:600; }
.shift-selisih-minus { color:#dc2626; }
`;
}
