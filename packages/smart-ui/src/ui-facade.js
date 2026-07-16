/**
 * UI Facade — UI SDK namespace.
 *
 * Menyediakan komponen UI yang konsisten untuk semua aplikasi SMART.
 * Inventory hanya mengimpor komponen dari UI Facade.
 *
 * @module @smart/ui/ui-facade
 */

import {
    PageContainer as _PageContainer,
    renderBreadcrumb as _renderBreadcrumb,
    Modal as _Modal,
    Table as _Table,
    Button as _Button,
    Card as _Card,
    Toast as _Toast,
    Skeleton as _Skeleton
} from "./components/index.js";

import { Sidebar as _Sidebar } from "./layouts/sidebar/Sidebar.js";
import { Topbar as _Topbar } from "./layouts/topbar/Topbar.js";

/**
 * UI — UI SDK namespace (Facade).
 *
 * Contoh:
 *   UI.Modal({ open: true, title: "Hello", content: "..." })
 *   UI.Table({ columns: [...], rows: [...] })
 *   UI.Button({ variant: "primary", label: "Simpan" })
 *   UI.PageContainer({ title: "Dashboard", content: "..." })
 *   UI.Sidebar({ appTitle: "SMART", menuItems: [...] })
 *   UI.Topbar({ title: "SMART", userName: "Admin" })
 *   UI.Toast({ variant: "success", message: "Berhasil" })
 *   UI.Loading({ variant: "spinner" })
 */
export const UI = {
    PageContainer: (opts) => _PageContainer(opts),
    renderBreadcrumb: (items) => _renderBreadcrumb(items),
    Modal: (opts) => _Modal(opts),
    /** Dialog adalah alias dari Modal (konfirmasi/perintah) */
    Dialog: (opts) => _Modal({ confirm: true, ...opts }),
    Table: (opts) => _Table(opts),
    Button: (opts) => _Button(opts),
    Sidebar: (opts) => _Sidebar(opts),
    Topbar: (opts) => _Topbar(opts),
    Notification: (opts) => _Toast(opts),
    Loading: (opts) => _Skeleton(opts),
    Card: (opts) => _Card(opts),
    Toast: (opts) => _Toast(opts),
    load: loadUI
};

/**
 * Load the SMART UI framework.
 * Initializes global UI tokens and logs confirmation.
 */
export function loadUI() {
    console.log("SMART UI Loaded");
}

// ── Attach SMART.UI to globalThis for console access ──
if (typeof globalThis !== "undefined") {
    try {
        if (!globalThis.SMART) globalThis.SMART = {};
        globalThis.SMART.UI = UI;
    } catch {
        // Silently fail in non-browser environments
    }
}

export default UI;
