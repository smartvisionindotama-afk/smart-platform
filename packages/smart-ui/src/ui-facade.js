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
    Skeleton as _Skeleton,
    CardList as _CardList,
    attachCardEvents as _attachCardEvents,
    BarcodeScanner as _BarcodeScanner,
    SearchableSelect as _SearchableSelect
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
    CardList: (items, renderContent) => _CardList(items, renderContent),
    attachCardEvents: (container, onEdit, onDelete) => _attachCardEvents(container, onEdit, onDelete),
    BarcodeScanner: _BarcodeScanner,
    SearchableSelect: (selectEl, opts) => _SearchableSelect(selectEl, opts),
    load: loadUI
};

/**
 * Load the SMART UI framework.
 * Initializes global UI tokens and logs confirmation.
 */
export function loadUI() {
    console.log("SMART UI Loaded");
}

// ── Toast Convenience ──

let _toastContainer = null;

/**
 * Ensure toast container exists in DOM.
 * @returns {HTMLElement}
 */
function _ensureToastContainer() {
    if (!_toastContainer) {
        _toastContainer = document.createElement("div");
        _toastContainer.id = "toast-container";
        _toastContainer.style.cssText =
            "position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;max-width:400px;";
        document.body.appendChild(_toastContainer);
    }
    return _toastContainer;
}

/**
 * Show a toast notification. Framework-wide convenience function.
 *
 * @param {"success"|"danger"|"info"|"warning"} variant
 * @param {string} message
 */
export function showToast(variant, message) {
    const container = _ensureToastContainer();
    const toast = _Toast({ variant, message, onDismiss: () => toast.remove() });
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3500);
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
