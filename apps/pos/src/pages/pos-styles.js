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

/* Stat cards — glass effect */
.pos-stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-bottom:16px; }
.pos-stat-card { background:rgba(255,255,255,0.72); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.6); border-radius:14px; padding:16px 18px; box-shadow:0 4px 16px rgba(31,38,135,0.06); }
.pos-stat-card.tone-warn { border-color:rgba(245,158,11,0.5); background:rgba(255,255,230,0.72); }
.pos-stat-label { font-size:0.72rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--smart-text-secondary,#64748b); }
.pos-stat-value { font-size:1.6rem; font-weight:800; color:var(--smart-text-primary,#1e293b); margin-top:4px; word-break:break-word; }
.pos-stat-sub { font-size:0.75rem; color:var(--smart-text-secondary,#94a3b8); margin-top:2px; }

/* Card grid */
.pos-dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }

/* Generic cards — glass effect */
.cn-card { background:rgba(255,255,255,0.72); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.6); border-radius:14px; overflow:hidden; box-shadow:0 4px 16px rgba(31,38,135,0.06); margin-bottom:16px; }
.cn-card-header { padding:12px 16px; border-bottom:1px solid rgba(209,213,219,0.3); background:rgba(255,255,255,0.35); }
.cn-card-title { font-size:0.85rem; font-weight:700; color:var(--smart-text-primary,#1e293b); }
.cn-card-body { padding:14px 16px; }

/* Tables — glass inner */
.cn-table-sm, .dp-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
.cn-table-sm th, .cn-table-sm td, .dp-table th, .dp-table td { padding:8px 10px; border-bottom:1px solid rgba(209,213,219,0.3); text-align:left; }
.cn-table-sm th, .dp-table th { color:var(--smart-text-secondary,#64748b); font-weight:600; text-transform:uppercase; font-size:0.68rem; letter-spacing:0.4px; background:rgba(255,255,255,0.3); }
.cn-table-sm tbody tr:nth-child(even) { background:rgba(255,255,255,0.18); }
.cn-table-sm tbody tr:hover { background:rgba(255,255,255,0.35); }
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
.pos-shift-banner { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid #c7d2fe; border-radius:10px; background:#eef2ff; color:#3730a3; font-size:0.85rem; flex-wrap:wrap; }
.pos-shift-kas { text-align:right; }

/* Filter bar (Laporan Kasir) */
.dp-db-filter-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.dp-db-filter-bar .smart-input { width:auto; }

/* Shift page */
#pos-shift-active + .cn-card { margin-top: 20px; }
.cn-ok { color:#667eea; font-weight:600; }
.pos-shift-empty { border-style:dashed; }
.ps-status-badge { display:inline-block; font-size:0.68rem; font-weight:700; padding:2px 9px; border-radius:999px; }
.ps-status-order { background:#e0e7ff; color:#3730a3; }
.ps-status-void { background:#fee2e2; color:#991b1b; }

/* Form modal sederhana (padanan bl-form console.css) */
.bl-form { display:flex; flex-direction:column; gap:8px; }
.bl-form label { font-size:0.78rem; font-weight:600; color:var(--smart-text-secondary,#6b7280); margin-top:4px; }
.bl-form input.smart-input, .bl-form select.smart-input, .bl-form textarea.smart-input { width:100%; }

/* ── Dark mode — glass dark ── */
[data-theme="dark"] .pos-stat-card,
[data-theme="dark"] .cn-card { background:rgba(30,41,59,0.82); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-color:rgba(255,255,255,0.06); box-shadow:0 4px 16px rgba(0,0,0,0.2); }
[data-theme="dark"] .pos-stat-value,
[data-theme="dark"] .cn-card-title { color:var(--smart-text-primary,#f1f5f9); }
[data-theme="dark"] .cn-card-header { border-bottom-color:rgba(255,255,255,0.06); background:rgba(255,255,255,0.04); }
[data-theme="dark"] .cn-table-sm th, [data-theme="dark"] .cn-table-sm td,
[data-theme="dark"] .dp-table th, [data-theme="dark"] .dp-table td { border-bottom-color:rgba(255,255,255,0.05); }
[data-theme="dark"] .cn-table-sm th { background:rgba(255,255,255,0.04); }
[data-theme="dark"] .cn-table-sm tbody tr:nth-child(even) { background:rgba(255,255,255,0.02); }
[data-theme="dark"] .cn-table-sm tbody tr:hover { background:rgba(255,255,255,0.05); }
[data-theme="dark"] .pos-pay-row { border-bottom-color:#334155; }
[data-theme="dark"] .pos-pay-row strong { color:#f1f5f9; }
[data-theme="dark"] .pos-shift-banner { background:#1e1b4b; border-color:#4338ca; color:#c7d2fe; }
[data-theme="dark"] .cn-empty { border-color:#334155; }
[data-theme="dark"] .ps-status-order { background:#1e1b4b; color:#a5b4fc; }
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
.shift-summary-expected strong { color:var(--smart-primary,#667eea); }
.shift-selisih { margin-top:6px; font-size:13px; }
.shift-selisih-ok { color:#667eea; font-weight:600; }
.shift-selisih-warn { color:#b45309; font-weight:600; }
.shift-selisih-minus { color:#dc2626; }
`;
}
