/**
 * Kategori Page — Thin wrapper around Generic CRUD Module.
 *
 * Icon kategori (emoji) dipilih di sini dan ditampilkan di sidebar layar
 * kasir (GET /api/pos/kasir-data → kategoriIcons).
 */
import { CrudModule } from "@smart/ui";
import { listKategori, getKategori, createKategori, updateKategori, deleteKategori } from "../../data/index.js";
import { checkKodeExists } from "../../data/kategori-data.js";

// 27 pilihan icon kategori — tampil di sidebar layar kasir
const KATEGORI_ICONS = [
    "🏷️", "🛒", "🥤", "🍞", "🍎",
    "🥦", "🥩", "🐟", "🥛", "🧀",
    "🍫", "☕", "🧃", "🍚", "🧂",
    "🧊", "🥫", "🍰", "🍦", "🍜",
    "🧼", "🧴", "💊", "📱", "🏠",
    "🧰", "📦"
];

const { CrudPage, initCrudPage } = CrudModule({
    entityId: "kategori",
    title: "Master Kategori",
    subtitle: "Kelola kategori barang",
    icon: "🏷️",
    singularName: "Kategori",
    pluralName: "kategori",
    tambahLabel: "Tambah Kategori",
    formTitleEdit: "Edit Kategori",
    formTitleCreate: "Tambah Kategori Baru",
    services: { list: listKategori, get: getKategori, create: createKategori, update: updateKategori, delete: deleteKategori, checkKodeExists },
    columns: [
        { key: "kode", label: "Kode", width: "110px" },
        { key: "nama", label: "Nama Kategori" },
        { key: "icon", label: "Icon", width: "90px", align: "center",
            render: (val) => val ? `<span style="font-size:1.35rem;line-height:1">${val}</span>` : `<span style="color:#cbd5e1">—</span>` },
        { key: "deskripsi", label: "Deskripsi" }
    ],
    formDataDefaults: { kode: "", nama: "", icon: "", deskripsi: "" },
    mapFormData: (item) => ({ kode: item.kode, nama: item.nama, icon: item.icon || "", deskripsi: item.deskripsi || "" }),
    getPayload: () => ({
        kode: document.getElementById("f-kode")?.value?.trim() || "",
        nama: document.getElementById("f-nama")?.value?.trim() || "",
        icon: document.querySelector('input[name="f-icon"]:checked')?.value || "",
        deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || ""
    }),
    renderFormFields: (e, d) => `
        <style>
        .icon-picker { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; max-height:190px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px; padding:8px; }
        .icon-picker-item { position:relative; display:flex; align-items:center; justify-content:center; padding:7px 4px; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; font-size:1.25rem; transition:border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .icon-picker-item:hover { border-color:#4f46e5; background:#eef2ff; }
        .icon-picker-item:has(input:checked) { border-color:#4f46e5; background:#eef2ff; box-shadow:0 0 0 2px rgba(79,70,229,0.25); }
        .icon-picker-item input { position:absolute; opacity:0; pointer-events:none; }
        .icon-picker-none { border-style:dashed; color:#94a3b8; font-size:0.72rem; font-weight:600; }
        </style>
        <div class="form-grid">
            <div class="form-group">
                <label for="f-kode">Kode Kategori <span class="required">*</span></label>
                <input type="text" id="f-kode" value="${e(d.kode)}" placeholder="contoh: KAT-001" />
            </div>
            <div class="form-group">
                <label for="f-nama">Nama Kategori <span class="required">*</span></label>
                <input type="text" id="f-nama" value="${e(d.nama)}" placeholder="Nama kategori" required />
            </div>
            <div class="form-group full-width">
                <label>Icon Kategori</label>
                <div class="icon-picker" id="f-icon-picker">
                    <label class="icon-picker-item icon-picker-none" title="Tanpa icon">
                        <input type="radio" name="f-icon" value="" ${!d.icon ? "checked" : ""} />
                        <span>Tanpa icon</span>
                    </label>
                    ${KATEGORI_ICONS.map(i => `
                        <label class="icon-picker-item" title="${i}">
                            <input type="radio" name="f-icon" value="${i}" ${d.icon === i ? "checked" : ""} />
                            <span>${i}</span>
                        </label>`).join("")}
                </div>
                <small>Icon ini ditampilkan di sidebar layar kasir</small>
            </div>
            <div class="form-group full-width">
                <label for="f-deskripsi">Deskripsi</label>
                <textarea id="f-deskripsi" placeholder="Deskripsi kategori (opsional)">${e(d.deskripsi)}</textarea>
            </div>
        </div>
    `,
    renderCard: (e, item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${item.icon ? `<span style="font-size:1.2rem;margin-right:6px">${e(item.icon)}</span>` : ""}${e(item.nama)}</div>
            ${item.deskripsi ? `<div class="sm-card-desc">${e(item.deskripsi)}</div>` : ''}
        </div>
        <div class="sm-card-footer-row">
            <span class="sm-card-code">${e(item.kode)}</span>
            <div class="sm-card-actions">
                <button class="sm-card-btn sm-card-btn-edit" data-edit="${item.id}">✏️ Edit</button>
                <button class="sm-card-btn sm-card-btn-delete" data-delete="${item.id}">🗑️ Hapus</button>
            </div>
        </div>
    `
});

export { CrudPage as KategoriPage, initCrudPage as initKategoriPage };
