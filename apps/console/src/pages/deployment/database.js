/**
 * SMART Console — Database Explorer UI (SP-027 M5-FIX).
 *
 * Database observation console READ-ONLY untuk Super Admin:
 *
 *   Database Explorer
 *     ├── Database (pilih)      → list dari /api/database/databases
 *     ├── Collections           → /api/database/:db/collections (dengan docCount)
 *     ├── Documents             → /api/database/:db/:coll/documents (pagination+filter)
 *     ├── Document Detail       → field/type/value + nested object + array (tree)
 *     ├── Indexes               → /api/database/:db/:coll/indexes
 *     └── Statistics            → /api/database/:db/:coll/stats
 *
 * READ-ONLY: tidak ada mutation dari sisi UI. Seluruh aksi memakai endpoint
 * yang sudah diamankan Security M3 (authenticate + requireSuperAdmin).
 *
 * @module console/pages/deployment/database
 */

import { Modal } from "@smart/ui";
import {
    listDatabases,
    listCollections,
    listDocuments,
    listIndexes,
    getCollectionStats
} from "../../services/deployment.js";
import { loadingHTML, esc, mountPagination } from "../_shared.js";

const PAGE_LIMIT = 10; // aman & sesuai batas backend (max 100)

// ══════════════════════════════════════════════════════════
// Pure functions (unit-testable)
// ══════════════════════════════════════════════════════════

const OBJECTID_RE = /^[0-9a-f]{24}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Deteksi tipe nilai MongoDB dari JSON response.
 * @param {*} value
 * @returns {string} ObjectId | Date | Number | Boolean | String | Array | Object | Null
 */
export function detectType(value) {
    if (value === null) return "Null";
    if (value === undefined) return "Null";
    if (Array.isArray(value)) return "Array";
    if (typeof value === "object") return "Object";
    if (typeof value === "number") return "Number";
    if (typeof value === "boolean") return "Boolean";
    if (typeof value === "string") {
        if (OBJECTID_RE.test(value)) return "ObjectId";
        if (DATE_RE.test(value) && !Number.isNaN(new Date(value).getTime())) return "Date";
        return "String";
    }
    return "String";
}

/**
 * Format nilai menjadi string pendek untuk preview (tidak mengubah struktur).
 * @param {*} value
 * @param {number} [maxLen=60]
 * @returns {string}
 */
export function formatValue(value, maxLen = 60) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return `Array[${value.length}]`;
    if (typeof value === "object") return "Object";
    let s = String(value);
    if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
    return s;
}

/**
 * Ambil kolom umum dari sekumpulan dokumen (untuk header tabel preview).
 * Diurutkan berdasarkan frekuensi kemunculan, _id selalu didahulukan.
 * @param {object[]} docs
 * @param {number} [max=6]
 * @returns {string[]}
 */
export function unionFields(docs, max = 6) {
    if (!Array.isArray(docs) || docs.length === 0) return ["_id"];
    const freq = new Map();
    for (const doc of docs) {
        if (!doc || typeof doc !== "object") continue;
        for (const k of Object.keys(doc)) {
            freq.set(k, (freq.get(k) || 0) + 1);
        }
    }
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    // _id pertama (identitas)
    const ordered = [...sorted.filter(k => k === "_id"), ...sorted.filter(k => k !== "_id")];
    return ordered.slice(0, max);
}

/**
 * Bangun tree node untuk satu nilai (dokumen/nested/array).
 * @param {*} value
 * @param {string} key
 * @returns {object} { key, type, value, children }
 */
export function buildNode(key, value) {
    const type = detectType(value);
    if (type === "Object") {
        return {
            key,
            type,
            value: "Object",
            children: Object.entries(value).map(([k, v]) => buildNode(k, v))
        };
    }
    if (type === "Array") {
        return {
            key,
            type,
            value: `Array[${value.length}]`,
            children: value.map((v, i) => buildNode(`[${i}]`, v))
        };
    }
    return { key, type, value: formatValue(value, 200), children: null };
}

/**
 * Render satu node tree + children menjadi HTML (recursive).
 * Object/array memakai <details>/<summary> agar bisa di-expand tanpa JS.
 * @param {object} node Hasil buildNode
 * @param {number} [depth]
 * @returns {string}
 */
export function renderNodeHTML(node, depth = 0) {
    const indent = Math.min(depth, 8);
    const pad = "".padStart(indent * 16, " ");

    if (!node.children) {
        return `${pad}<div class="dp-tree-row">` +
            `<span class="dp-tree-key">${esc(node.key)}</span>` +
            `<span class="dp-type-badge dp-type-${node.type.toLowerCase()}">${esc(node.type)}</span>` +
            `<span class="dp-tree-value">${esc(node.value)}</span>` +
            `</div>`;
    }

    const childrenHTML = node.children.map(c => renderNodeHTML(c, depth + 1)).join("");
    const badge = node.type === "Array" ? `Array[${node.children.length}]` : "Object";
    return `${pad}<details class="dp-tree-node"${depth === 0 ? " open" : ""}>` +
        `<summary class="dp-tree-summary">` +
        `<span class="dp-tree-key">${esc(node.key)}</span>` +
        `<span class="dp-type-badge dp-type-${node.type.toLowerCase()}">${esc(badge)}</span>` +
        `</summary><div class="dp-tree-children">${childrenHTML}</div></details>`;
}

/**
 * Render tree lengkap dokumen.
 * @param {object} doc
 * @returns {string} HTML
 */
export function renderDocTree(doc) {
    if (!doc || typeof doc !== "object") {
        return `<div class="dp-tree-row"><span class="dp-tree-key">value</span><span class="dp-tree-value">${esc(String(doc))}</span></div>`;
    }
    const root = buildNode("document", doc);
    return root.children.map(c => renderNodeHTML(c, 0)).join("");
}

/**
 * Format angka besar (bytes / count) ke tampilan ramah.
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return String(v);
}

// ══════════════════════════════════════════════════════════
// UI state (module-level, satu instance per halaman)
// ══════════════════════════════════════════════════════════

let _dbs = [];
let _selectedDb = "";
let _selectedColl = "";
let _colls = [];
let _filterField = "";
let _filterValue = "";
let _currentPage = 1;

function dbBadge(db) {
    return `<span class="smart-badge smart-badge-warning">READ ONLY</span>`;
}

function errorHTML(message) {
    return `<div class="cn-empty dp-error"><p>⚠️ ${esc(message)}</p>` +
        `<button class="smart-btn smart-btn-secondary" data-act="retry">↻ Coba Lagi</button></div>`;
}

function emptyHTML(message) {
    return `<div class="cn-empty">${esc(message)}</div>`;
}

// ══════════════════════════════════════════════════════════
// Database level
// ══════════════════════════════════════════════════════════

async function loadDatabases(root) {
    const listEl = root.querySelector("#dp-db-list");
    listEl.innerHTML = loadingHTML();
    try {
        const res = await listDatabases();
        _dbs = (res?.data || []).filter(Boolean);
        _selectedDb = _dbs.includes("smart_inventory") ? "smart_inventory" : (_dbs[0] || "");
        _selectedColl = "";
        renderDatabaseList(root);
        if (_selectedDb) {
            await loadCollections(root);
        } else {
            listEl.innerHTML = emptyHTML("Tidak ada database dapat diakses");
        }
    } catch (err) {
        listEl.innerHTML = errorHTML(err.message || "Gagal memuat database");
        bindRetry(root);
    }
}

function renderDatabaseList(root) {
    const listEl = root.querySelector("#dp-db-list");
    listEl.innerHTML = `<h4 class="dp-db-section-title">Databases</h4>` +
        _dbs.map(db => `
            <button class="dp-db-item ${db === _selectedDb ? "active" : ""}" data-db="${esc(db)}">
                <span class="dp-db-item-icon">🗄️</span> ${esc(db)}
            </button>`).join("") +
        `<button class="smart-btn smart-btn-secondary dp-db-refresh" id="dp-db-refresh">↻ Refresh</button>`;

    listEl.querySelectorAll(".dp-db-item").forEach(btn => {
        btn.addEventListener("click", async () => {
            _selectedDb = btn.dataset.db;
            _selectedColl = "";
            _filterField = "";
            _filterValue = "";
            _currentPage = 1;
            renderDatabaseList(root);
            await loadCollections(root);
        });
    });
    listEl.querySelector("#dp-db-refresh").addEventListener("click", () => loadDatabases(root));
}

// ══════════════════════════════════════════════════════════
// Collection level
// ══════════════════════════════════════════════════════════

async function loadCollections(root) {
    const collEl = root.querySelector("#dp-db-collections");
    collEl.innerHTML = loadingHTML();
    try {
        const res = await listCollections(_selectedDb);
        _colls = (res?.data || []).filter(Boolean);
        renderCollectionList(root);
    } catch (err) {
        collEl.innerHTML = errorHTML(err.message || "Gagal memuat collections");
        bindRetry(root);
    }
}

function renderCollectionList(root) {
    const collEl = root.querySelector("#dp-db-collections");
    collEl.innerHTML = `<h4 class="dp-db-section-title">Collections (${_colls.length})</h4>` +
        _colls.map(c => `
            <button class="dp-db-item ${c.name === _selectedColl ? "active" : ""}" data-col="${esc(c.name)}">
                <span class="dp-db-item-icon">📄</span>
                <span class="dp-db-col-name">${esc(c.name)}</span>
                ${c.docCount != null ? `<span class="dp-db-col-count">${formatNumber(c.docCount)}</span>` : ""}
            </button>`).join("") ||
        emptyHTML("No collections found.");

    collEl.querySelectorAll(".dp-db-item").forEach(btn => {
        btn.addEventListener("click", () => {
            _selectedColl = btn.dataset.col;
            _currentPage = 1;
            _filterField = "";
            _filterValue = "";
            renderCollectionList(root);
            renderCollectionDetail(root);
        });
    });
}

// ══════════════════════════════════════════════════════════
// Collection detail: Documents / Indexes / Statistics
// ══════════════════════════════════════════════════════════

async function renderCollectionDetail(root) {
    const detail = root.querySelector("#dp-db-detail");
    if (!_selectedColl) {
        detail.innerHTML = emptyHTML("Pilih collection untuk melihat dokumen.");
        return;
    }
    detail.innerHTML = loadingHTML();
    try {
        // Promise.allSettled — kegagalan SATU sumber (stats/indexes) TIDAK boleh
        // menggagalkan tampilan dokumen (prinsip failure isolation M4/M5).
        const [docsRes, indexesRes, statsRes] = await Promise.allSettled([
            listDocuments(_selectedDb, _selectedColl, { page: _currentPage, limit: PAGE_LIMIT, filter: buildFilterQuery(_filterField, _filterValue) }),
            listIndexes(_selectedDb, _selectedColl),
            getCollectionStats(_selectedDb, _selectedColl)
        ]);
        if (docsRes.status === "rejected") {
            detail.innerHTML = errorHTML(docsRes.reason?.message || "Gagal memuat dokumen");
            bindRetry(root);
            return;
        }
        renderDetailHTML(root, docsRes.value, indexesRes.status === "fulfilled" ? indexesRes.value : null, statsRes.status === "fulfilled" ? statsRes.value : null);
    } catch (err) {
        detail.innerHTML = errorHTML(err.message || "Gagal memuat collection");
        bindRetry(root);
    }
}

/**
 * Bangun query string filter (key-value sederhana, diamankan backend).
 * Pure function — menerima field & value agar unit-testable.
 * @param {string} field
 * @param {string} value
 * @returns {string} JSON string query ("" bila kosong)
 */
export function buildFilterQuery(field = "", value = "") {
    const f = String(field || "").trim();
    const v = String(value || "").trim();
    if (!f || !v) return "";
    try {
        return JSON.stringify({ [f]: v });
    } catch {
        return "";
    }
}

function renderDetailHTML(root, docs, indexes, stats) {
    const detail = root.querySelector("#dp-db-detail");
    const fields = unionFields(docs.data || []);
    const rows = (docs.data || []).map(doc => `
        <tr>
            ${fields.map(f => `<td class="dp-doc-cell"><span class="dp-type-badge dp-type-${detectType(doc[f]).toLowerCase()}">${esc(detectType(doc[f]))}</span> <span class="dp-doc-val">${esc(formatValue(doc[f], 40))}</span></td>`).join("")}
            <td><button class="smart-btn smart-btn-secondary" data-act="doc" data-idx="${esc(String(doc._id))}">Lihat</button></td>
        </tr>`).join("") || `<tr><td colspan="${fields.length + 1}" class="cn-muted">No documents found.</td></tr>`;

    const idxRows = (indexes?.data || []).map(i => `
        <tr>
            <td class="cn-mono">${esc(i.name)}</td>
            <td class="cn-mono">${esc(Object.entries(i.key || {}).map(([k, dir]) => `${k}:${dir}`).join(", "))}</td>
            <td>${i.unique ? `<span class="smart-badge smart-badge-success">Unique</span>` : "—"}</td>
            <td>${i.sparse ? "sparse" : "—"}</td>
        </tr>`).join("") || `<tr><td colspan="4" class="cn-muted">Tidak ada index</td></tr>`;

    const s = stats?.data || {}; // stats bisa null (allSettled rejected) → tampil "—"
    const statRows = [
        ["Documents", formatNumber(s.count)],
        ["Size", s.size != null ? `${formatBytes(s.size)}` : "—"],
        ["Avg Object Size", s.avgObjSize != null ? `${formatBytes(s.avgObjSize)}` : "—"],
        ["Storage Size", s.storageSize != null ? `${formatBytes(s.storageSize)}` : "—"],
        ["Indexes", formatNumber(s.nindexes)],
        ["Total Index Size", s.totalIndexSize != null ? `${formatBytes(s.totalIndexSize)}` : "—"]
    ];

    detail.innerHTML = `
        <div class="dp-db-toolbar">
            <span class="dp-db-breadcrumb">
                <span class="dp-db-crumb" data-crumb="root">Database Explorer</span>
                <span class="dp-db-crumb-sep">/</span>
                <span class="dp-db-crumb" data-crumb="db">${esc(_selectedDb)}</span>
                <span class="dp-db-crumb-sep">/</span>
                <span class="dp-db-crumb dp-db-crumb-current">${esc(_selectedColl)}</span>
            </span>
            <span class="dp-db-toolbar-spacer"></span>
            <span class="cn-muted">${formatNumber(docs.total ?? 0)} dokumen</span>
        </div>

        <div class="dp-db-tabs">
            <button class="smart-btn smart-btn-primary dp-db-tab-btn active" data-tab="docs">Dokumen</button>
            <button class="smart-btn smart-btn-secondary dp-db-tab-btn" data-tab="idx">Indexes</button>
            <button class="smart-btn smart-btn-secondary dp-db-tab-btn" data-tab="stats">Statistics</button>
        </div>

        <div id="dp-db-tab-content">
            <div class="dp-db-filter-bar">
                <input class="smart-input" id="dp-filter-field" placeholder="Field (mis. status)" value="${esc(_filterField)}" />
                <input class="smart-input" id="dp-filter-value" placeholder="Value" value="${esc(_filterValue)}" />
                <button class="smart-btn smart-btn-primary" id="dp-filter-apply">Apply</button>
                ${_filterField || _filterValue ? `<button class="smart-btn smart-btn-secondary" id="dp-filter-clear">Clear</button>` : ""}
                <button class="smart-btn smart-btn-secondary" id="dp-doc-refresh">↻ Refresh</button>
            </div>
            <div class="dp-table-wrap">
                <table class="dp-table dp-doc-table">
                    <thead><tr>${fields.map(f => `<th>${esc(f)}</th>`).join("")}<th>Action</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="cn-pagination-row" id="dp-db-pagination"></div>
        </div>
    `;

    bindDetailEvents(root, docs, fields, idxRows, statRows);
}

function bindDetailEvents(root, docs, fields, idxRows, statRows) {
    const detail = root.querySelector("#dp-db-detail");
    const tabContent = detail.querySelector("#dp-db-tab-content");

    // Tabs
    detail.querySelectorAll(".dp-db-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            detail.querySelectorAll(".dp-db-tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.dataset.tab;
            if (tab === "docs") {
                renderDocumentsTab(root, docs);
            } else if (tab === "idx") {
                tabContent.innerHTML = `
                    <div class="dp-table-wrap"><table class="dp-table">
                        <thead><tr><th>Nama</th><th>Key</th><th>Unique</th><th>Properti</th></tr></thead>
                        <tbody>${idxRows}</tbody>
                    </table></div>`;
            } else if (tab === "stats") {
                tabContent.innerHTML = `<div class="dp-detail">
                    ${statRows.map(([k, v]) => `<div class="dp-detail-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}
                </div>`;
            }
        });
    });

    // Filter
    detail.querySelector("#dp-filter-apply")?.addEventListener("click", () => {
        _filterField = detail.querySelector("#dp-filter-field")?.value?.trim() || "";
        _filterValue = detail.querySelector("#dp-filter-value")?.value?.trim() || "";
        _currentPage = 1;
        renderCollectionDetail(root);
    });
    detail.querySelector("#dp-filter-clear")?.addEventListener("click", () => {
        _filterField = "";
        _filterValue = "";
        _currentPage = 1;
        renderCollectionDetail(root);
    });
    detail.querySelector("#dp-doc-refresh")?.addEventListener("click", () => renderCollectionDetail(root));

    // Document detail
    detail.querySelectorAll("[data-act='doc']").forEach(btn => {
        btn.addEventListener("click", () => {
            const doc = (docs.data || []).find(d => String(d._id) === btn.dataset.idx);
            if (doc) openDocumentDetail(doc, _selectedDb, _selectedColl);
        });
    });

    // Pagination
    mountPagination(detail.querySelector("#dp-db-pagination"), docs.pagination || { page: 1, total: docs.total || 0, limit: PAGE_LIMIT }, (p) => {
        _currentPage = p;
        renderCollectionDetail(root);
    }, "dokumen");

    // Breadcrumb — kembali ke root/db
    detail.querySelectorAll("[data-crumb]").forEach(crumb => {
        crumb.addEventListener("click", () => {
            if (crumb.dataset.crumb === "root") {
                _selectedColl = "";
                _selectedDb = "";
                _filterField = "";
                _filterValue = "";
                renderDatabaseList(root);
                loadDatabases(root);
            } else if (crumb.dataset.crumb === "db") {
                _selectedColl = "";
                renderCollectionList(root);
                renderCollectionDetail(root);
            }
        });
    });
}

function renderDocumentsTab(root, docs) {
    const detail = root.querySelector("#dp-db-detail");
    const tabContent = detail.querySelector("#dp-db-tab-content");
    if (!tabContent) return;
    const fields = unionFields(docs.data || []);
    const rows = (docs.data || []).map(doc => `
        <tr>
            ${fields.map(f => `<td class="dp-doc-cell"><span class="dp-type-badge dp-type-${detectType(doc[f]).toLowerCase()}">${esc(detectType(doc[f]))}</span> <span class="dp-doc-val">${esc(formatValue(doc[f], 40))}</span></td>`).join("")}
            <td><button class="smart-btn smart-btn-secondary" data-act="doc" data-idx="${esc(String(doc._id))}">Lihat</button></td>
        </tr>`).join("") || `<tr><td colspan="${fields.length + 1}" class="cn-muted">No documents found.</td></tr>`;
    tabContent.innerHTML = `
        <div class="dp-db-filter-bar">
            <input class="smart-input" id="dp-filter-field" placeholder="Field (mis. status)" value="${esc(_filterField)}" />
            <input class="smart-input" id="dp-filter-value" placeholder="Value" value="${esc(_filterValue)}" />
            <button class="smart-btn smart-btn-primary" id="dp-filter-apply">Apply</button>
            ${_filterField || _filterValue ? `<button class="smart-btn smart-btn-secondary" id="dp-filter-clear">Clear</button>` : ""}
            <button class="smart-btn smart-btn-secondary" id="dp-doc-refresh">↻ Refresh</button>
        </div>
        <div class="dp-table-wrap"><table class="dp-table dp-doc-table">
            <thead><tr>${fields.map(f => `<th>${esc(f)}</th>`).join("")}<th>Action</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <div class="cn-pagination-row" id="dp-db-pagination"></div>`;

    detail.querySelectorAll("[data-act='doc']").forEach(btn => {
        btn.addEventListener("click", () => {
            const doc = (docs.data || []).find(d => String(d._id) === btn.dataset.idx);
            if (doc) openDocumentDetail(doc, _selectedDb, _selectedColl);
        });
    });
    mountPagination(detail.querySelector("#dp-db-pagination"), docs.pagination || { page: 1, total: docs.total || 0, limit: PAGE_LIMIT }, (p) => {
        _currentPage = p;
        renderCollectionDetail(root);
    }, "dokumen");
    bindFilterActions(root);
}

function bindFilterActions(root) {
    const detail = root.querySelector("#dp-db-detail");
    detail.querySelector("#dp-filter-apply")?.addEventListener("click", () => {
        _filterField = detail.querySelector("#dp-filter-field")?.value?.trim() || "";
        _filterValue = detail.querySelector("#dp-filter-value")?.value?.trim() || "";
        _currentPage = 1;
        renderCollectionDetail(root);
    });
    detail.querySelector("#dp-filter-clear")?.addEventListener("click", () => {
        _filterField = "";
        _filterValue = "";
        _currentPage = 1;
        renderCollectionDetail(root);
    });
    detail.querySelector("#dp-doc-refresh")?.addEventListener("click", () => renderCollectionDetail(root));
}

// ══════════════════════════════════════════════════════════
// Document detail (modal + tree)
// ══════════════════════════════════════════════════════════

function openDocumentDetail(doc, dbName, collName) {
    const content = `
        <div class="dp-db-breadcrumb" style="margin-bottom:12px">
            <span class="dp-db-crumb">${esc(dbName)}</span>
            <span class="dp-db-crumb-sep">/</span>
            <span class="dp-db-crumb">${esc(collName)}</span>
            <span class="dp-db-crumb-sep">/</span>
            <span class="dp-db-crumb dp-db-crumb-current">document</span>
        </div>
        <div class="dp-db-toolbar">
            <span class="cn-muted">_id: <span class="cn-mono">${esc(String(doc._id))}</span></span>
        </div>
        <div class="dp-tree">${renderDocTree(doc)}</div>
    `;
    const footer = `<button class="smart-btn smart-btn-secondary" id="dp-doc-close">Tutup</button>`;
    const overlay = Modal({
        open: true,
        title: "Document Detail",
        content,
        footer,
        closable: true,
        onClose: () => overlay.remove()
    });
    document.body.appendChild(overlay);
    overlay.querySelector("#dp-doc-close").addEventListener("click", () => overlay.remove());
}

function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return "—";
    const v = Number(bytes);
    if (v >= 1024 * 1024 * 1024) return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(2)} MB`;
    if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${v} B`;
}

function bindRetry(root) {
    root.querySelector("[data-act='retry']")?.addEventListener("click", () => {
        if (_selectedColl) {
            renderCollectionDetail(root);
        } else if (_selectedDb) {
            loadCollections(root);
        } else {
            loadDatabases(root);
        }
    });
}

// ══════════════════════════════════════════════════════════
// Entry
// ══════════════════════════════════════════════════════════

/**
 * Render & init Database Explorer.
 * @param {HTMLElement} container Kontainer halaman/tab
 */
export async function renderDatabaseExplorer(container) {
    _dbs = [];
    _selectedDb = "";
    _selectedColl = "";
    _colls = [];
    _filterField = "";
    _filterValue = "";
    _currentPage = 1;

    container.innerHTML = `
        <div class="dp-db-bar">
            ${dbBadge()}
            <span class="cn-muted">Observasi MongoDB — server-side only, credentials tidak pernah ke browser.</span>
        </div>
        <div class="dp-db-cols">
            <div class="dp-db-side">
                <div id="dp-db-list"></div>
                <div id="dp-db-collections"></div>
            </div>
            <div class="dp-db-detail" id="dp-db-detail"></div>
        </div>
    `;

    await loadDatabases(container);
}

export default { renderDatabaseExplorer, detectType, formatValue, unionFields, buildNode, renderNodeHTML, renderDocTree, buildFilterQuery };
