/**
 * Rak Page — Thin wrapper around Generic CRUD Module.
 */
import { CrudModule } from "@smart/ui";
import { listRak, getRak, createRak, updateRak, deleteRak, listWarehouse } from "../../data/index.js";
import { checkKodeExists } from "../../data/rak-data.js";

function escAttr(str) {
    if (!str) return "";
    return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const { CrudPage, initCrudPage } = CrudModule({
    entityId: "rak",
    title: "Master Rak Etalase",
    subtitle: "Kelola rak dan etalase gudang",
    icon: "🏪",
    singularName: "Rak/Etalase",
    pluralName: "rak/etalase",
    tambahLabel: "Tambah Rak",
    formTitleEdit: "Edit Rak/Etalase",
    formTitleCreate: "Tambah Rak/Etalase Baru",
    services: { list: listRak, get: getRak, create: createRak, update: updateRak, delete: deleteRak, checkKodeExists },
    columns: [
        { key: "kode", label: "Kode", width: "110px" },
        { key: "nama", label: "Nama Rak/Etalase" },
        { key: "lokasi", label: "Lokasi", width: "100px" },
        { key: "gudang", label: "Gudang", width: "120px" },
        { key: "deskripsi", label: "Deskripsi" }
    ],
    formDataDefaults: { kode: "", nama: "", lokasi: "", gudang: "", deskripsi: "" },
    mapFormData: (item) => ({ kode: item.kode, nama: item.nama, lokasi: item.lokasi || "", gudang: item.gudang || "", deskripsi: item.deskripsi || "" }),
    getPayload: () => ({
        kode: document.getElementById("f-kode")?.value?.trim() || "",
        nama: document.getElementById("f-nama")?.value?.trim() || "",
        lokasi: document.getElementById("f-lokasi")?.value?.trim() || "",
        gudang: document.getElementById("f-gudang")?.value?.trim() || "",
        deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || ""
    }),
    loadFormDependencies: async () => {
        let warehouses = [];
        try {
            const whRes = await listWarehouse({ page: 1, limit: 999 });
            warehouses = whRes.data || [];
        } catch {}
        return { warehouses };
    },
    validateForm: (getPayload) => {
        const gudang = document.getElementById("f-gudang")?.value?.trim();
        if (!gudang) {
            document.getElementById("f-gudang")?.focus();
            return "Gudang wajib diisi";
        }
        return null;
    },
    renderFormFields: (e, d, extra) => {
        const warehouses = extra?.warehouses || [];
        const selected = d.gudang || "";
        let whOptions = `<option value="">— Pilih Gudang —</option>`;
        for (const w of warehouses) {
            const code = w.kode || w._id || "";
            const name = w.nama || code;
            const sel = code === selected ? "selected" : "";
            whOptions += `<option value="${escAttr(code)}" ${sel}>${e(code)} - ${e(name)}</option>`;
        }
        // Fallback jika gudang yang tersimpan tidak ada di daftar
        if (selected && !warehouses.find(w => (w.kode || w._id || "") === selected)) {
            whOptions += `<option value="${escAttr(selected)}" selected>${e(selected)}</option>`;
        }

        return `
        <div class="form-grid">
            <div class="form-group">
                <label for="f-kode">Kode Rak <span class="required">*</span></label>
                <input type="text" id="f-kode" value="${e(d.kode)}" placeholder="contoh: RAK-001" />
            </div>
            <div class="form-group">
                <label for="f-nama">Nama Rak/Etalase <span class="required">*</span></label>
                <input type="text" id="f-nama" value="${e(d.nama)}" placeholder="Nama rak atau etalase" required />
            </div>
            <div class="form-group">
                <label for="f-lokasi">Lokasi</label>
                <input type="text" id="f-lokasi" value="${e(d.lokasi)}" placeholder="Cth: Lt 1, Depan" />
            </div>
            <div class="form-group">
                <label for="f-gudang">Gudang <span class="required">*</span></label>
                <select id="f-gudang">
                    ${whOptions}
                </select>
            </div>
            <div class="form-group full-width">
                <label for="f-deskripsi">Deskripsi</label>
                <textarea id="f-deskripsi" placeholder="Deskripsi rak/etalase (opsional)">${e(d.deskripsi)}</textarea>
            </div>
        </div>
    `;
    },
    renderCard: (e, item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${e(item.nama)}</div>
            ${item.gudang ? `<div class="sm-card-desc">🏭 ${e(item.gudang)}</div>` : ''}
        </div>
        <div class="sm-card-details">
            <div class="sm-card-detail-row">
                <span class="sm-card-label">Kode</span>
                <span class="sm-card-value">${e(item.kode)}</span>
            </div>
            ${item.lokasi ? `<div class="sm-card-detail-row"><span class="sm-card-label">Lokasi</span><span class="sm-card-value">${e(item.lokasi)}</span></div>` : ''}
            ${item.deskripsi ? `<div class="sm-card-detail-row"><span class="sm-card-label">Deskripsi</span><span class="sm-card-value">${e(item.deskripsi)}</span></div>` : ''}
        </div>
        <div class="sm-card-footer-row">
            <div class="sm-card-actions">
                <button class="sm-card-btn sm-card-btn-edit" data-edit="${item.id}">✏️ Edit</button>
                <button class="sm-card-btn sm-card-btn-delete" data-delete="${item.id}">🗑️ Hapus</button>
            </div>
        </div>
    `
});

export { CrudPage as RakPage, initCrudPage as initRakPage };
