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
import { LaporanPage, initLaporanPage } from "../pages/report";
import { CompanyPage, initCompanyPage } from "../pages/settings/company";
import { UserSettingsPage, initUserSettingsPage } from "../pages/settings/user";
import { RolePage, initRolePage } from "../pages/settings/role";
import { PermissionPage, initPermissionPage } from "../pages/settings/permission";


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
    pos: {
        component: PosPage,
        init: initPosPage,
        permission: "pos.kasir.use"
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

    // ── Report ──
    report: {
        component: LaporanPage,
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
    }

};
