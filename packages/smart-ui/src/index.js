/**
 * @smart/ui — SMART UI SDK.
 *
 * ████████████████████████████████████████████████████████████
 * PUBLIC SDK — FACADE ARCHITECTURE
 * ████████████████████████████████████████████████████████████
 *
 * ✅ BENAR:
 *   import { UI } from "@smart/ui";
 *   UI.Modal({ open: true, title: "Hello" })
 *   UI.Table({ columns: [...], rows: [...] })
 *   UI.PageContainer({ title: "Dashboard", content: "..." })
 *
 * ⚠️ @deprecated (masih berfungsi, tapi akan dihapus):
 *   import { Modal, Table, Toast } from "@smart/ui";
 *
 * @module @smart/ui
 */

import "./tokens/index.css";

// ═══════════════════════════════════════════════════════════════
//  PRIMARY API: UI Facade
// ═══════════════════════════════════════════════════════════════

export { UI, loadUI, showToast, printToWindow } from "./ui-facade.js";

// ═══════════════════════════════════════════════════════════════
//  @deprecated — Backward Compatible Exports
//  Aplikasi baru HARUS menggunakan UI.* atau SMART.UI.*
// ═══════════════════════════════════════════════════════════════

/** @deprecated Gunakan UI.PageContainer() */
export * from "./components/index.js";

/** @deprecated Gunakan UI */
export { loadWorkspace } from "./workspaces/engine.js";

/** @deprecated Gunakan Settings modules via DI */
export * from "./modules/settings/index.js";

/** @deprecated Gunakan Platform modules via DI */
export * from "./modules/platform/index.js";

/** @deprecated Gunakan Auth modules via DI */
export * from "./modules/auth/index.js";

/** @deprecated Gunakan Generic CRUD module via DI */
export { CrudModule } from "./modules/master-crud/index.js";
