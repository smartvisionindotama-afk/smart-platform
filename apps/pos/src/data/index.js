// ── Barang (Inventory-specific data service) ──
export {
    listBarang,
    getBarang,
    createBarang,
    updateBarang,
    deleteBarang,
    countBarang,
    checkKodeExists,
    resetData,
    formatRupiah
} from "./barang-data.js";

// ── Settings CRUD (Inventory-specific data service) ──
export {
    listCompanies,
    listAllCompanies,
    getCompany,
    getCompanyByCode,
    createCompany,
    updateCompany,
    deleteCompany,
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getRoleOptions,
    listRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    getRolesWithPermissions,
    getRolePermissions,
    grantPermissionToRole,
    revokePermissionFromRole,
    getPermissionGroups,
    getPosSettings,
    setPosSettings,
    getTransactionCapabilities,
    setTransactionCapabilities,
    getWaSettings,
    setWaSettings,
    testWaSettings
} from "./settings-data.js";

// ── Supplier (Inventory-specific data service) ──
export {
    listSupplier,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    resetSupplierData
} from "./supplier-data.js";

// ── Kategori ──
export {
    listKategori,
    getKategori,
    createKategori,
    updateKategori,
    deleteKategori
} from "./kategori-data.js";

// ── Satuan ──
export {
    listSatuan,
    getSatuan,
    createSatuan,
    updateSatuan,
    deleteSatuan
} from "./satuan-data.js";

// ── Warehouse ──
export {
    listWarehouse,
    getWarehouse,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
} from "./warehouse-data.js";

// ── Customer / Member ──
export {
    listCustomer,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getMemberByKode
} from "./customer-data.js";

// ── Sales ──
export {
    listSales,
    getSales,
    createSales,
    updateSales,
    deleteSales
} from "./sales-data.js";

// ── Rak Etalase ──
export {
    listRak,
    getRak,
    createRak,
    updateRak,
    deleteRak
} from "./rak-data.js";

// ── Activity Log ──
export {
    listActivity
} from "./activity-data.js";

// ── Pembelian (Purchase) ──
export {
    listPembelian,
    getPembelian,
    createPembelian,
    updatePembelian,
    deletePembelian,
    updatePembelianStatus,
    resetPembelianData
} from "./pembelian-data.js";

// ── Penjualan (Sales) ──
export {
    listPenjualan,
    getPenjualan,
    createPenjualan,
    updatePenjualan,
    deletePenjualan,
    updatePenjualanStatus,
    resetPenjualanData
} from "./penjualan-data.js";

// ── Shift Kasir (PRD V1) ──
export {
    listShifts,
    openShift,
    closeShift
} from "./shift-data.js";

// ── POS Void + Hold/Resume (PRD V1 §7.5) ──
export { voidPenjualan, holdPenjualan, resumePenjualan } from "./penjualan-data.js";

// ── Transfer Stok Antar Gudang ──
export {
    listTransfer,
    getTransfer,
    createTransfer,
    updateTransfer,
    updateTransferStatus,
    deleteTransfer,
    resetTransferData
} from "./transfer-data.js";

// ── Inventory Monitoring ──
export {
    getInventoryStats,
    getStockByWarehouse,
    getLowStockItems,
    getOutOfStockItems,
    getRecentMovements,
    getStockValue
} from "./inventory-data.js";

// ── Stock Opname ──
export {
    listStockOpname,
    getStockOpname,
    createStockOpname,
    updateStockOpname,
    deleteStockOpname,
    updateStockOpnameStatus,
    reconcileStockOpname,
    getBarangForOpname
} from "./stock-opname-data.js";

// ── Retur Pembelian (Purchase Return) ──
export {
    listReturPembelian,
    getReturPembelian,
    createReturPembelian,
    updateReturPembelian,
    deleteReturPembelian,
    updateReturPembelianStatus,
    resetReturPembelianData
} from "./retur-pembelian-data.js";

// ── Retur Penjualan (Sales Return) ──
export {
    listReturPenjualan,
    getReturPenjualan,
    createReturPenjualan,
    updateReturPenjualan,
    deleteReturPenjualan,
    updateReturPenjualanStatus,
    resetReturPenjualanData
} from "./retur-penjualan-data.js";

// ── F&B Recipe / BOM (M6.2) ──
export {
    listRecipes,
    getRecipe,
    getRecipeCost,
    createRecipe,
    updateRecipe,
    activateRecipe,
    archiveRecipe
} from "./recipe-data.js";

// ── Laporan (Reporting) ──
export {
    getLaporanStock,
    getLaporanPurchase,
    getLaporanSales,
    getInventoryValueReport,
    getStockMutationReport,
    getSupplierReport,
    getCustomerReport,
    getLaporanLabarugi,
    getLaporanPiutang
} from "./laporan-data.js";

// ── Laporan Kasir / POS Breakdown (PRD V1 §13) ──
export { getSalesBreakdown } from "./laporan-data.js";

// ── F&B Customer Ordering V1 — QR Menu, Order Meja, Kitchen, Payment ──
export {
    listQrTables,
    createQrTable,
    updateQrTable,
    deleteQrTable,
    createQrTableLink,
    disableQrTable
} from "./qr-menu-data.js";

export {
    listTableOrders,
    getTableOrder,
    confirmTableOrderPayment,
    updateTableOrderKitchen,
    refundTableOrder,
    listKitchenOrders,
    updateKitchenStatus,
    cancelKitchenOrder,
    cancelKitchenOrderItems
} from "./table-order-data.js";

export {
    getCompanyQris,
    saveCompanyQris,
    disableCompanyQris,
    listBankAccounts,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount
} from "./payment-data.js";
