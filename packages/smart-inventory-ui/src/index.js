/**
 * @smart/inventory-ui — SMART Inventory Domain Package (Public SDK).
 *
 * ████████████████████████████████████████████████████████████
 * PUBLIC SDK — DOMAIN PACKAGE
 * ████████████████████████████████████████████████████████████
 *
 * Package ini berisi seluruh UI Business Module Inventory.
 * Arah dependency:
 *
 *   apps/inventory
 *        ↓
 *   @smart/inventory-ui   ← package ini
 *        ↓
 *   @smart/ui  (SMART UI Framework)
 *
 * ✅ BENAR:
 *   import { InventoryBarang, InventoryPembelian, InventoryPenjualan } from "@smart/inventory-ui";
 *
 * ⚠️ Internal helper & private utility TIDAK diexpose dari package ini.
 *
 * @module @smart/inventory-ui
 */

export { BarangModule as InventoryBarang } from "./modules/barang/index.js";
export { PembelianModule as InventoryPembelian } from "./modules/pembelian/index.js";
export { PenjualanModule as InventoryPenjualan } from "./modules/penjualan/index.js";
export { TransferModule as InventoryTransfer } from "./modules/transfer/index.js";
export { DashboardModule as InventoryDashboard } from "./modules/dashboard/index.js";
export { LaporanModule as InventoryReports } from "./modules/laporan/index.js";
