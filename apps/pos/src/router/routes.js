import { PosPage, initPosPage } from "../pages/pos";
import { DashboardPage, initDashboardPage } from "../pages/dashboard";
import { ShiftPage, initShiftPage } from "../pages/shift";
import { ReportPosPage, initReportPosPage } from "../pages/report-pos";
import { BarangPage, initBarangPage } from "../pages/barang";
import { RakPage, initRakPage } from "../pages/rak";
import { SupplierPage, initSupplierPage } from "../pages/supplier";
import { KategoriPage, initKategoriPage } from "../pages/kategori";
import { SatuanPage, initSatuanPage } from "../pages/satuan";
import { WarehousePage, initWarehousePage } from "../pages/warehouse";
import { CustomerPage, initCustomerPage } from "../pages/customer";
import { SalesPage, initSalesPage } from "../pages/sales";
import { PembelianPage, initPembelianPage } from "../pages/pembelian";
import { PenjualanPage, initPenjualanPage } from "../pages/penjualan";
import { TransferPage, initTransferPage } from "../pages/transfer";
import { InventoryPage, initInventoryPage } from "../pages/inventory";
import { LaporanPage, initLaporanPage, setActiveTab } from "../pages/report";
import { CompanyPage, initCompanyPage } from "../pages/settings/company";
import { UserSettingsPage, initUserSettingsPage } from "../pages/settings/user";
import { RolePage, initRolePage } from "../pages/settings/role";
import { PermissionPage, initPermissionPage } from "../pages/settings/permission";
import { CapabilityPage, initCapabilityPage } from "../pages/settings/capability";
import { RecipePage, initRecipePage } from "../pages/recipe";
// F&B Customer Ordering V1 — QR Menu Meja, Order Meja, Kitchen, Payment Settings
import { QrMenuPage, initQrMenuPage } from "../pages/qr-menu";
import { OrderMejaPage, initOrderMejaPage } from "../pages/order-meja";
import { KitchenPage, initKitchenPage } from "../pages/kitchen";
import { PaymentSettingsPage, initPaymentSettingsPage } from "../pages/settings/payment";
import { WaSettingsPage, initWaSettingsPage } from "../pages/settings/wa";




export const routes = {

    // ── Auth ──
    login: {
        component: () => "<div id='login-mount'></div>",
        permission: null
    },

    // ── Dashboard ──
    dashboard: {
        component: DashboardPage,
        init: initDashboardPage,
        permission: "inventory.dashboard.view"
    },

    // ── Kasir (SP-029 M3) ──
    // SP-029 POS V1 — halaman kasir adalah workflow capability "retail".
    // Bila perusahaan tidak mengaktifkan retail, route ini ditolak frontend
    // (navigate) dan pembuatan transaksi ditolak backend (requireTransactionType).
    pos: {
        component: PosPage,
        init: initPosPage,
        permission: "pos.kasir.use",
        capability: "retail"
    },

    // ── Shift Kasir (PRD V1 §12) ──
    shift: {
        component: ShiftPage,
        init: initShiftPage,
        permission: "pos.shift.open"
    },

    // ── Laporan Kasir (PRD V1 §13) ──
    "report-pos": {
        component: ReportPosPage,
        init: initReportPosPage,
        permission: "inventory.report.view"
    },

    // ── Master ──
    barang: {
        component: BarangPage,
        init: initBarangPage,
        permission: "inventory.barang.read"
    },
    category: {
        component: KategoriPage,
        init: initKategoriPage,
        permission: "inventory.category.read"
    },
    satuan: {
        component: SatuanPage,
        init: initSatuanPage,
        permission: "inventory.satuan.read"
    },
    warehouse: {
        component: WarehousePage,
        init: initWarehousePage,
        permission: "inventory.warehouse.read"
    },
    rak: {
        component: RakPage,
        init: initRakPage,
        permission: "inventory.rak.read"
    },
    supplier: {
        component: SupplierPage,
        init: initSupplierPage,
        permission: "inventory.supplier.read"
    },
    customer: {
        component: CustomerPage,
        init: initCustomerPage,
        permission: "inventory.customer.read"
    },
    "sales-master": {
        component: SalesPage,
        init: initSalesPage,
        permission: "inventory.sales.read"
    },

    // ── Transaction ──
    purchase: {
        component: PembelianPage,
        init: initPembelianPage,
        permission: "inventory.pembelian.read"
    },
    sales: {
        component: PenjualanPage,
        init: initPenjualanPage,
        permission: "inventory.sales.read"
    },
    transfer: {
        component: TransferPage,
        init: initTransferPage,
        permission: "inventory.transfer.read"
    },

    // ── Inventory ──
    inventory: {
        component: InventoryPage,
        init: initInventoryPage,
        permission: "inventory.inventory.view"
    },

    // ── Report (per-tab routes) ──
    "report-stock": {
        component: () => { setActiveTab("stock"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-purchase": {
        component: () => { setActiveTab("purchase"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-sales": {
        component: () => { setActiveTab("sales"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-value": {
        component: () => { setActiveTab("value"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-mutation": {
        component: () => { setActiveTab("mutation"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-supplier": {
        component: () => { setActiveTab("supplier"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-customer": {
        component: () => { setActiveTab("customer"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-labarugi": {
        component: () => { setActiveTab("labarugi"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },
    "report-piutang": {
        component: () => { setActiveTab("piutang"); return LaporanPage(); },
        init: initLaporanPage,
        permission: "inventory.report.view"
    },

    // ── Settings ──
    company: {
        component: CompanyPage,
        init: initCompanyPage,
        permission: "settings.company.edit"
    },
    "settings-user": {
        component: UserSettingsPage,
        init: initUserSettingsPage,
        permission: "settings.user.manage"
    },
    "settings-role": {
        component: RolePage,
        init: initRolePage,
        permission: "settings.role.manage"
    },
    "settings-permission": {
        component: PermissionPage,
        init: initPermissionPage,
        permission: "settings.permission.manage"
    },

    // ── M6.1 — Transaction Capabilities (jenis transaksi kasir) ──
    "settings-capability": {
        component: CapabilityPage,
        init: initCapabilityPage,
        permission: "settings.company.edit"
    },

    // ── M6.2 — F&B Recipe / BOM (gate capability fnb + permission admin) ──
    recipe: {
        component: RecipePage,
        init: initRecipePage,
        permission: "pos.recipe.manage",
        capability: "fnb"
    },

    // ── F&B Customer Ordering V1 — QR Menu Meja + Order Meja + Kitchen ──
    "qr-menu": {
        component: QrMenuPage,
        init: initQrMenuPage,
        permission: "pos.qr.manage",
        capability: "fnb"
    },
    "order-meja": {
        component: OrderMejaPage,
        init: initOrderMejaPage,
        permission: "pos.order.view",
        capability: "fnb"
    },
    kitchen: {
        component: KitchenPage,
        init: initKitchenPage,
        permission: "pos.kitchen.view",
        capability: "fnb"
    },

    // ── F&B V1 — Settings → Payment Settings (QRIS + Bank Accounts) ──
    "settings-payment": {
        component: PaymentSettingsPage,
        init: initPaymentSettingsPage,
        permission: "settings.company.edit",
        capability: "fnb"
    },

    // ── F&B V1 — Settings → Konfigurasi WA (gateway notifikasi WhatsApp) ──
    "settings-wa": {
        component: WaSettingsPage,
        init: initWaSettingsPage,
        permission: "settings.company.edit",
        capability: "fnb"
    }

};
