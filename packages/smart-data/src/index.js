/**
 * @smart/data — Data Layer SDK.
 *
 * ████████████████████████████████████████████████████████████
 * PUBLIC SDK — FACADE ARCHITECTURE
 * ████████████████████████████████████████████████████████████
 *
 * ✅ BENAR:
 *   import { DB } from "@smart/data";
 *   DB.collection("barang").find({ page: 1 })
 *   DB.insert("users", { name: "John" })
 *
 * ⚠️ @deprecated (masih berfungsi, tapi akan dihapus):
 *   import { BaseRepository, InMemoryRepository } from "@smart/data";
 *
 * @module @smart/data
 */

// ═══════════════════════════════════════════════════════════════
//  PRIMARY API: DB Facade
// ═══════════════════════════════════════════════════════════════

export { DB } from "./db-facade.js";

// ═══════════════════════════════════════════════════════════════
//  @deprecated — Backward Compatible Exports
//  Aplikasi baru HARUS menggunakan DB.* atau SMART.DB.*
// ═══════════════════════════════════════════════════════════════

/** @deprecated Gunakan DB (Database Facade) */
export { createDataState } from "./state.js";

/** @deprecated Gunakan DB.collection().find() */
export { createCache, clearAllCaches } from "./cache.js";

/** @deprecated Gunakan DB */
export { createPagination } from "./pagination.js";

/** @deprecated Gunakan DB */
export { Repository } from "./repository.js";

/** @deprecated Gunakan DB */
export { BaseRepository, InMemoryRepository } from "./base-repository.js";

/** @deprecated Gunakan DB */
export { createStore } from "./persistence.js";

/** @deprecated Gunakan DB */
export { dbConfig, createDbConfig, checkConnection, createApiRepository } from "./mongodb.js";
