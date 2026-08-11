/**
 * Kategori Page — Thin wrapper around Generic CRUD Module.
 */
import { CrudModule } from "@smart/ui";
import { listKategori, getKategori, createKategori, updateKategori, deleteKategori } from "../../data/index.js";
import { checkKodeExists } from "../../data/kategori-data.js";

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
        { key: "deskripsi", label: "Deskripsi" }
    ],
    formDataDefaults: { kode: "", nama: "", deskripsi: "" },
    mapFormData: (item) => ({ kode: item.kode, nama: item.nama, deskripsi: item.deskripsi || "" }),
    getPayload: () => ({
        kode: document.getElementById("f-kode")?.value?.trim() || "",
        nama: document.getElementById("f-nama")?.value?.trim() || "",
        deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || ""
    }),
    renderFormFields: (e, d) => `
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
                <label for="f-deskripsi">Deskripsi</label>
                <textarea id="f-deskripsi" placeholder="Deskripsi kategori (opsional)">${e(d.deskripsi)}</textarea>
            </div>
        </div>
    `,
    renderCard: (e, item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${e(item.nama)}</div>
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
