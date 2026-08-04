/**
 * SMART Console — Central Configuration.
 *
 * Semua URL, registry aplikasi, dan metadata platform dipusatkan di sini
 * (SP-027 M1: "Tidak boleh ada hardcoded URL. Gunakan configuration.").
 *
 * @module console/config
 */

// ── Platform Identity ──

export const CONSOLE_CONFIG = {
    title: "SMART Console",
    tagline: "Platform Administration",
    version: "1.0.0",
    buildVersion: "M1-2026.08",
    environment: "production",
    apiUrl: "/api"
};

// ── App Entry URLs ──
// SP-027 Phase 1: tiap app dilayani domain sendiri.
// Bisa dioverride untuk dev/staging via window.__APP_URLS__.

export const APP_URLS = {
    inventory: "https://inv.e-profit.id/"
};

/**
 * URL entry aplikasi tujuan (untuk impersonation / Open app).
 * @param {string} slug App slug
 * @returns {string} Base URL (dengan trailing slash)
 */
export function getAppEntryUrl(slug) {
    const overrides = (typeof window !== "undefined" && window.__APP_URLS__) || {};
    if (overrides[slug]) {
        return String(overrides[slug]).replace(/\/?$/, "/");
    }
    return APP_URLS[slug] || "/";
}

// ── Platform Applications Registry ──

/**
 * Registry aplikasi platform (SP-027 M1 — mock repository).
 * @typedef {object} PlatformApp
 * @property {string} slug App slug
 * @property {string} name Display name
 * @property {string} code App code
 * @property {string} icon Emoji icon
 * @property {boolean} active Status aplikasi
 * @property {string} domain Deployment domain ("" jika belum live)
 * @property {string} version Version
 * @property {string} description Deskripsi
 */
export const APPS_REGISTRY = [
    {
        slug: "inventory", name: "Inventory", code: "INV", icon: "📦",
        active: true, domain: "https://inv.e-profit.id/", version: "1.0.0",
        description: "Manajemen inventori gudang dan stok barang"
    },
    {
        slug: "accounting", name: "Accounting", code: "ACC", icon: "💰",
        active: false, domain: "", version: "0.1.0",
        description: "Akuntansi dan pembukuan keuangan"
    },
    {
        slug: "pos", name: "POS", code: "POS", icon: "🛒",
        active: false, domain: "", version: "0.1.0",
        description: "Point of Sale untuk kasir dan transaksi"
    },
    {
        slug: "payroll", name: "Payroll", code: "PAY", icon: "🧾",
        active: false, domain: "", version: "0.1.0",
        description: "Penggajian dan administrasi karyawan"
    },
    {
        slug: "hrm", name: "HRM", code: "HRM", icon: "👥",
        active: false, domain: "", version: "0.1.0",
        description: "Human Resource Management"
    },
    {
        slug: "crm", name: "CRM", code: "CRM", icon: "🤝",
        active: false, domain: "", version: "0.1.0",
        description: "Customer Relationship Management"
    },
    {
        slug: "wms", name: "WMS", code: "WMS", icon: "🏭",
        active: false, domain: "", version: "0.1.0",
        description: "Warehouse Management System"
    },
    {
        slug: "ai", name: "AI", code: "AI", icon: "🤖",
        active: false, domain: "", version: "0.1.0",
        description: "Artificial Intelligence Services"
    }
];

// ── Sidebar Menu (SP-027 M1) ──

export const MENU_ITEMS = [
    { title: "Dashboard", icon: "📊", page: "dashboard" },
    { title: "Applications", icon: "📦", page: "applications" },
    { title: "Companies", icon: "🏢", page: "companies" },
    { title: "Super Admin", icon: "🛡️", page: "superadmins" },
    { title: "Platform Settings", icon: "⚙️", page: "settings" },
    { title: "System Information", icon: "🖥️", page: "system" },
    { title: "Activity Log", icon: "📋", page: "activity" },
    { title: "Documentation", icon: "📚", page: "documentation" }
];

// ── Session Storage Key ──

export const SESSION_KEY = "smart_console_session";
