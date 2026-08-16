/**
 * Recipe Page — F&B Recipe / BOM (M6.2).
 *
 * Admin/Owner mengelola recipe produk F&B:
 *   - List: Produk · Nama Recipe · Version · Status · Jumlah Ingredient ·
 *     Updated · Action (Edit / Duplikat / Hapus)
 *   - Form: Produk, Nama Recipe, Description, Ingredients (Item | Quantity |
 *     Unit | hapus), [+ Tambah Bahan], [Simpan] — simpan LANGSUNG aktif
 *   - Edit mengubah recipe yang sama (in-place, tanpa duplikat/versi baru)
 *
 * Gate: route & menu ber-capability "fnb" + permission pos.recipe.manage
 * (kasir TIDAK melihat halaman ini). Server juga menegakkan (requireTransactionType
 * + permission) — UI bukan satu-satunya pengaman.
 *
 * State: loading / error / success (toast) — source of truth backend.
 *
 * @module pos/pages/recipe
 */

import { showToast, Modal } from "@smart/ui";
import { esc, formatDateTime } from "@smart/core";
import { listBarang } from "../../data/index.js";
import {
    listRecipes, getRecipe, createRecipe, updateRecipe, duplicateRecipe, deleteRecipe
} from "../../data/recipe-data.js";
import { posDashboardCSS } from "../pos-styles.js";

const state = {
    loading: true,
    error: "",
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    statusFilter: "",
    recipes: [],
    barangs: []
};

const STATUS_LABEL = { draft: "Draft", active: "Aktif", archived: "Archived" };

export function RecipePage() {
    return `
        <div class="page-container pos-dash-page">
            <style>${posDashboardCSS()}
            .rc-toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px; }
            .rc-status { display:inline-block; padding:2px 10px; border-radius:999px; font-size:0.72rem; font-weight:600; }
            .rc-status-draft { background:#f1f5f9; color:#475569; }
            .rc-status-active { background:#dcfce7; color:#166534; }
            .rc-status-archived { background:#fee2e2; color:#991b1b; }
            .rc-ing-row { display:grid; grid-template-columns:1fr 100px 90px 44px; gap:8px; align-items:center; margin-bottom:8px; }
            [data-theme="dark"] .rc-status-draft { background:#334155; color:#cbd5e1; }
            [data-theme="dark"] .rc-status-active { background:#065f4633; color:#6ee7b7; }
            [data-theme="dark"] .rc-status-archived { background:#991b1b33; color:#fecaca; }
            .cn-alert-danger { padding:10px 14px; border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; font-size:0.82rem; margin-bottom:12px; }
            .rc-icon-btn { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; font-size:0.95rem; transition:all .15s; }
            .rc-icon-btn:hover { background:#eef2ff; border-color:#c7d2fe; }
            .rc-icon-btn-danger:hover { background:#fef2f2; border-color:#fecaca; }
            </style>
            <div class="page-header">
                <div>
                    <h1>Recipe F&B</h1>
                    <p class="page-subtitle">Resep / BOM produk F&B — bahan yang dikonsumsi saat produk terjual (M6.2)</p>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="smart-btn smart-btn-secondary" id="rc-refresh">↻ Refresh</button>
                    <button class="smart-btn smart-btn-primary" id="rc-add">+ Tambah Recipe</button>
                </div>
            </div>
            <div class="cn-card">
                <div class="cn-card-header"><span class="cn-card-title">Daftar Recipe</span></div>
                <div class="cn-card-body">
                    <div class="rc-toolbar">
                        <input class="smart-input" id="rc-search" placeholder="Cari produk / nama recipe..." style="max-width:280px" />
                        <select class="smart-select" id="rc-status">
                            <option value="">Semua Status</option>
                            <option value="draft">Draft</option>
                            <option value="active">Aktif</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div id="rc-status-msg"></div>
                    <div id="rc-table">${state.loading ? `<div class="cn-loading"><span class="cn-spinner"></span> Memuat recipe...</div>` : ""}</div>
                </div>
            </div>
            <div id="rc-pager" style="display:flex;justify-content:center;gap:8px;margin-top:12px"></div>
        </div>
    `;
}

function statusBadge(status) {
    return `<span class="rc-status rc-status-${status || "draft"}">${STATUS_LABEL[status] || status || "Draft"}</span>`;
}

function renderTable(container) {
    const wrap = container.querySelector("#rc-table");
    const msg = container.querySelector("#rc-status-msg");
    if (!wrap) return;
    if (state.error) {
        msg.innerHTML = `<div class="cn-alert-danger">${esc(state.error)}</div>`;
    } else {
        msg.innerHTML = "";
    }
    if (state.loading) {
        wrap.innerHTML = `<div class="cn-loading"><span class="cn-spinner"></span> Memuat recipe...</div>`;
        return;
    }
    if (!state.recipes.length) {
        wrap.innerHTML = `<div class="cn-empty">Belum ada recipe. Klik "+ Tambah Recipe" untuk membuat recipe pertama.</div>`;
        return;
    }
    const rows = state.recipes.map(r => `
        <tr>
            <td><strong>${esc(r.productNama || r.productKode || "-")}</strong>${r.productKode ? `<br/><small class="cn-muted">${esc(r.productKode)}</small>` : ""}</td>
            <td>${esc(r.name)}</td>
            <td>${(Number(r.harga) || 0) > 0 ? `Rp ${Number(r.harga).toLocaleString("id-ID")}` : `<small class="cn-muted">ikut produk</small>`}</td>
            <td>v${Number(r.version) || 1}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${Array.isArray(r.ingredients) ? r.ingredients.length : 0}</td>
            <td>${r.updatedAt ? formatDateTime(r.updatedAt) : "-"}</td>
            <td>
                <div class="rc-actions" style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="rc-icon-btn" data-act="edit" data-id="${esc(r._id)}" title="Edit recipe">✏️</button>
                    <button class="rc-icon-btn" data-act="duplicate" data-id="${esc(r._id)}" title="Duplikat recipe">📋</button>
                    <button class="rc-icon-btn rc-icon-btn-danger" data-act="delete" data-id="${esc(r._id)}" title="Hapus recipe">🗑️</button>
                </div>
            </td>
        </tr>
    `).join("");
    wrap.innerHTML = `
        <div class="dp-table-wrap">
            <table class="dp-table">
                <thead><tr>
                    <th>Produk</th><th>Nama Recipe</th><th>Harga</th><th>Version</th><th>Status</th>
                    <th>Jml Ingredient</th><th>Updated</th><th>Action</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    wrap.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", () => {
            const act = btn.dataset.act;
            const id = btn.dataset.id;
            if (act === "edit") openFormModal(container, id);
            if (act === "duplicate") doDuplicate(container, id);
            if (act === "delete") doDelete(container, id);
        });
    });
}

async function load(container) {
    state.loading = true;
    state.error = "";
    renderTable(container);
    try {
        const res = await listRecipes({
            page: state.page,
            limit: state.limit,
            status: state.statusFilter,
            search: container.querySelector("#rc-search")?.value?.trim() || ""
        });
        state.recipes = Array.isArray(res?.data) ? res.data : [];
        state.total = res?.pagination?.total || 0;
        state.totalPages = res?.pagination?.totalPages || 1;
        state.loading = false;
        renderTable(container);
        const pager = container.querySelector("#rc-pager");
        if (pager) {
            pager.innerHTML = state.totalPages > 1
                ? `
                    <button class="smart-btn smart-btn-secondary" id="rc-prev" ${state.page <= 1 ? "disabled" : ""}>‹ Prev</button>
                    <span class="cn-muted">${state.page} / ${state.totalPages}</span>
                    <button class="smart-btn smart-btn-secondary" id="rc-next" ${state.page >= state.totalPages ? "disabled" : ""}>Next ›</button>
                `
                : "";
            pager.querySelector("#rc-prev")?.addEventListener("click", () => { state.page--; load(container); });
            pager.querySelector("#rc-next")?.addEventListener("click", () => { state.page++; load(container); });
        }
    } catch (err) {
        state.loading = false;
        state.error = err?.message || "Gagal memuat recipe";
        renderTable(container);
    }
}

/** Siapkan katalog Barang (produk + ingredient) — cache per sesi halaman. */
async function ensureBarangs() {
    if (state.barangs.length) return state.barangs;
    const res = await listBarang({ page: 1, limit: 999 });
    const list = Array.isArray(res?.data) ? res.data : [];
    state.barangs = list.filter(b => b.active !== false);
    return state.barangs;
}

/**
 * Produk yang BOLEH dijadikan Recipe F&B — sinkron dengan Master → Barang:
 *   - barang tipe "Resep / Menu (Terhubung Recipe F&B)" (behavior recipe-fnb)
 *   - PLUS produk yang SUDAH punya recipe (backward compat — data existing
 *     dibuat sebelum tipe terhubung ada, mis. produk trading ber-recipe)
 * Produk tipe "Resep / Menu (Tanpa Stok — simple)" TIDAK muncul (model
 * simple tidak dikonsumsi realtime — penyesuaian via stok opname).
 * @param {object} [recipes] Daftar recipe saat ini (untuk produk yang sudah terpakai)
 * @returns {Promise<object[]>}
 */
async function ensureRecipeProducts(recipes = []) {
    const all = await ensureBarangs();
    const linkedIds = new Set(
        (recipes || [])
            .map(r => String(r.productId || ""))
            .filter(Boolean)
    );
    return all.filter(b =>
        b.behavior === "recipe-fnb"
        || linkedIds.has(String(b._id || b.id))
    );
}

function barangOptions(barangs, selectedId = "") {
    return `<option value="">— pilih item —</option>` + barangs.map(b =>
        `<option value="${esc(String(b._id || b.id))}" ${String(b._id || b.id) === String(selectedId) ? "selected" : ""}>${esc(b.kode || "")} — ${esc(b.nama || "")}${b.satuan ? ` (${esc(b.satuan)})` : ""}</option>`
    ).join("");
}

function ingredientRowHTML(barangs, ing = null) {
    const ingId = ing ? String(ing.itemId) : "";
    return `
        <div class="rc-ing-row" data-ing-row>
            <select class="smart-select rc-ing-item" data-ing-item>${barangOptions(barangs, ingId)}</select>
            <input class="smart-input rc-ing-qty" type="number" step="0.001" min="0.001" value="${ing ? ing.quantity : ""}" placeholder="Qty" />
            <input class="smart-input rc-ing-unit" type="text" value="${ing ? esc(ing.unit || "") : ""}" placeholder="Unit" />
            <button type="button" class="smart-btn smart-btn-danger" data-ing-remove title="Hapus">✕</button>
        </div>
    `;
}

async function openFormModal(container, id = null) {
    let recipe = null;
    if (id) {
        recipe = await getRecipe(id).catch(() => null);
        if (!recipe) {
            showToast("danger", "Recipe tidak ditemukan");
            return;
        }
    }
    let barangs = [];
    let products = [];
    try {
        barangs = await ensureBarangs();
        // Dropdown produk hanya tipe terhubung (recipe-fnb) + produk ber-recipe
        // existing — sinkron dengan Master → Barang (M6.2-FIX).
        products = await ensureRecipeProducts(state.recipes);
    } catch (err) {
        showToast("danger", "Gagal memuat daftar item: " + (err?.message || ""));
        return;
    }

    const productSelect = `
        <label for="rc-form-produk">Produk <small class="cn-muted">(tipe Resep / Menu — Terhubung Recipe F&B)</small></label>
        <select class="smart-input" id="rc-form-produk">${barangOptions(products, recipe ? recipe.productId : "")}</select>
    `;
    const content = `
        <p class="cn-muted">${recipe ? `Edit recipe "${esc(recipe.name)}" — perubahan langsung berlaku (recipe aktif)` : "Buat recipe produk F&B (langsung aktif — bahan dikonsumsi realtime saat produk terjual)"}</p>
        <p class="cn-muted" style="font-size:0.78rem">Satu produk boleh punya beberapa recipe = <strong>varian</strong> (mis. Pake Gula / Tanpa Gula). Di kasir produk tampil 1 kartu; saat diorder kasir memilih varian.</p>
        <div class="bl-form" style="margin-top:10px">
            ${productSelect}
            <label for="rc-form-name">Nama Varian</label>
            <input class="smart-input" id="rc-form-name" type="text" value="${recipe ? esc(recipe.name) : ""}" placeholder="Contoh: Pake Gula / Tanpa Gula" />
            <label for="rc-form-harga">Harga Varian (Rp) <small class="cn-muted">(kosong = pakai harga produk)</small></label>
            <input class="smart-input" id="rc-form-harga" type="number" min="0" value="${recipe && Number(recipe.harga) > 0 ? recipe.harga : ""}" placeholder="Contoh: 7000" />
            <label for="rc-form-desc">Description (opsional)</label>
            <textarea class="smart-input" id="rc-form-desc" rows="2" placeholder="Deskripsi singkat">${recipe ? esc(recipe.description || "") : ""}</textarea>
            <label>Ingredients</label>
            <div id="rc-form-ingredients">${(recipe && recipe.ingredients.length ? recipe.ingredients : [null]).map(i => ingredientRowHTML(barangs, i)).join("")}</div>
            <div><button type="button" class="smart-btn smart-btn-secondary" id="rc-form-add-ing">+ Tambah Bahan</button></div>
        </div>
    `;
    const footer = `
        <button class="smart-btn smart-btn-secondary" id="rc-form-cancel">Batal</button>
        <button class="smart-btn smart-btn-primary" id="rc-form-save">${recipe ? "Simpan Perubahan" : "Simpan Recipe"}</button>
    `;
    const title = recipe ? `Edit Varian — ${esc(recipe.name)}` : "Tambah Varian Recipe";
    const overlay = Modal({ open: true, title, content, footer, closable: true, onClose: () => overlay?.remove?.() });
    document.body.appendChild(overlay);

    const ingWrap = overlay.querySelector("#rc-form-ingredients");
    const addRow = () => {
        ingWrap.insertAdjacentHTML("beforeend", ingredientRowHTML(barangs));
    };
    ingWrap.addEventListener("click", (e) => {
        if (e.target.closest("[data-ing-remove]")) {
            const rows = ingWrap.querySelectorAll("[data-ing-row]");
            if (rows.length > 1) e.target.closest("[data-ing-row]").remove();
            else showToast("warning", "Recipe harus memiliki minimal 1 ingredient");
        }
    });
    // Saat item dipilih, isi unit dari satuan item secara otomatis (bisa diedit).
    ingWrap.addEventListener("change", (e) => {
        const sel = e.target.closest("[data-ing-item]");
        if (!sel) return;
        const row = sel.closest("[data-ing-row]");
        const unitInput = row?.querySelector(".rc-ing-unit");
        if (!unitInput) return;
        const item = barangs.find(b => String(b._id || b.id) === sel.value);
        if (item && item.satuan) unitInput.value = item.satuan;
    });
    overlay.querySelector("#rc-form-add-ing").addEventListener("click", addRow);
    overlay.querySelector("#rc-form-cancel").addEventListener("click", () => overlay.remove());

    overlay.querySelector("#rc-form-save").addEventListener("click", async () => {
        const productId = overlay.querySelector("#rc-form-produk")?.value || "";
        const name = overlay.querySelector("#rc-form-name")?.value?.trim() || "";
        const harga = Number(overlay.querySelector("#rc-form-harga")?.value) || 0;
        const description = overlay.querySelector("#rc-form-desc")?.value?.trim() || "";
        const ingredients = [...ingWrap.querySelectorAll("[data-ing-row]")].map(row => ({
            itemId: row.querySelector("[data-ing-item]")?.value || "",
            quantity: Number(row.querySelector(".rc-ing-qty")?.value) || 0,
            unit: row.querySelector(".rc-ing-unit")?.value?.trim() || ""
        }));
        if (!productId) return showToast("warning", "Produk wajib diisi");
        if (!name) return showToast("warning", "Nama varian wajib diisi");
        const body = { productId, name, harga, description, ingredients };
        try {
            if (recipe) {
                const updated = await updateRecipe(recipe._id, body);
                showToast("success", `Varian "${updated.name}" diperbarui — perubahan langsung berlaku`);
            } else {
                const created = await createRecipe(body);
                showToast("success", `Varian "${created.name}" dibuat (aktif v${created.version || 1})`);
            }
            overlay.remove();
            load(container);
        } catch (err) {
            showToast("danger", err?.message || "Gagal menyimpan varian");
        }
    });
}

async function doDuplicate(container, id) {
    try {
        const created = await duplicateRecipe(id);
        showToast("success", `Recipe disalin sebagai "${created.name}" (aktif v${created.version || 1})`);
        load(container);
    } catch (err) {
        showToast("danger", err?.message || "Gagal menduplikasi recipe");
    }
}

async function doDelete(container, id) {
    if (!window.confirm("Hapus recipe ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
        await deleteRecipe(id);
        showToast("success", "Recipe dihapus");
        load(container);
    } catch (err) {
        showToast("danger", err?.message || "Gagal menghapus recipe");
    }
}

export function initRecipePage() {
    const container = document.querySelector(".page-container");
    if (!container) return;
    container.querySelector("#rc-refresh")?.addEventListener("click", () => load(container));
    container.querySelector("#rc-add")?.addEventListener("click", () => openFormModal(container));
    container.querySelector("#rc-search")?.addEventListener("input", () => {
        clearTimeout(window.__rcSearchTimer);
        window.__rcSearchTimer = setTimeout(() => { state.page = 1; load(container); }, 300);
    });
    container.querySelector("#rc-status")?.addEventListener("change", (e) => {
        state.statusFilter = e.target.value;
        state.page = 1;
        load(container);
    });
    load(container);
}
