/**
 * Menu Configuration — Permission-based menu items.
 *
 * Menggunakan namespace-based permissions (format: {app}.{resource}.{action}).
 *
 * @module inventory/config/menu
 */

const menus = [

    // ── Dashboard ──
    {
        title: "Dashboard",
        icon: "📊",
        page: "dashboard",
        permission: "inventory.dashboard.view"
    },

    // ── Kasir (SP-029 M3) + Shift (PRD V1 §12) ──
    {
        title: "Kasir",
        icon: "🧾",
        page: "pos",
        permission: "pos.kasir.use"
    },
    {
        title: "Shift",
        icon: "🕐",
        page: "shift",
        permission: "pos.shift.open"
    },

    // ── Master ──
    {
        title: "Master",
        icon: "📋",
        children: [
            { title: "Barang",        icon: "📦", page: "barang",     permission: "inventory.barang.read" },
            { title: "Kategori",      icon: "🏷️", page: "category",   permission: "inventory.category.read" },
            { title: "Satuan",        icon: "📏", page: "satuan",     permission: "inventory.satuan.read" },
            { title: "Gudang",        icon: "🏭", page: "warehouse",  permission: "inventory.warehouse.read" },
            { title: "Rak Etalase",   icon: "🏪", page: "rak",        permission: "inventory.rak.read" },
            { title: "Supplier",      icon: "🚚", page: "supplier",   permission: "inventory.supplier.read" },
            { title: "Member",        icon: "🎫", page: "customer",   permission: "inventory.customer.read" },
            { title: "Sales",          icon: "👨‍💼", page: "sales-master", permission: "inventory.sales.read" },
            // M6.2 — F&B Recipe/BOM (hanya tampil bila capability fnb aktif)
            { title: "Recipe F&B",    icon: "🍳", page: "recipe",     permission: "pos.recipe.manage", capability: "fnb" }
        ]
    },

    // ── Transaksi ──
    {
        title: "Transaksi",
        icon: "🔄",
        children: [
            { title: "Pembelian",     icon: "🛒", page: "purchase",   permission: "inventory.pembelian.read" },
            { title: "Penjualan",     icon: "💰", page: "sales",      permission: "inventory.sales.read" },
            { title: "Transfer",      icon: "🚚", page: "transfer",   permission: "inventory.transfer.read" }
        ]
    },

    // ── Persediaan ──
    {
        title: "Persediaan",
        icon: "📦",
        page: "inventory",
        permission: "inventory.inventory.view"
    },

    // ── Laporan ──
    {
        title: "Laporan",
        icon: "📈",
        page: "report",
        permission: "inventory.report.view"
    },
    {
        title: "Laporan Kasir",
        icon: "🧾",
        page: "report-pos",
        permission: "inventory.report.view"
    },

    // ── F&B (Customer Ordering V1) — hanya tampil bila capability fnb aktif ──
    {
        title: "F&B",
        icon: "🍽️",
        children: [
            // Order Meja dipindah ke SIDEBAR KASIR (layar kasir) — yang
            // mengonfirmasi pembayaran QR Menu adalah kasir, bukan admin.
            { title: "QR Menu Meja", icon: "🔗", page: "qr-menu",      permission: "pos.qr.manage", capability: "fnb" },
            { title: "Kitchen",      icon: "👨‍🍳", page: "kitchen",      permission: "pos.kitchen.view", capability: "fnb" }
        ]
    },

    // ── Settings ──
    {
        title: "Settings",
        icon: "⚙️",
        children: [
            { title: "Company",      icon: "🏢", page: "company",         permission: "settings.company.edit" },
            { title: "User",         icon: "👥", page: "settings-user",   permission: "settings.user.manage" },
            { title: "Role",         icon: "🔑", page: "settings-role",   permission: "settings.role.manage" },
            { title: "Permission",   icon: "🛡️", page: "settings-permission", permission: "settings.permission.manage" },
            // M6.1 — jenis transaksi kasir (Transaction Capabilities)
            { title: "Capability Transaksi", icon: "✅", page: "settings-capability", permission: "settings.company.edit" },
            // F&B V1 — Payment Settings (QRIS + Bank Accounts, gate fnb)
            { title: "Payment Settings", icon: "💳", page: "settings-payment", permission: "settings.company.edit", capability: "fnb" },
            // F&B V1 — Konfigurasi WA (gateway notifikasi status order, gate fnb)
            { title: "Konfigurasi WA", icon: "💬", page: "settings-wa", permission: "settings.company.edit", capability: "fnb" }
        ]
    }

];

export default menus;
