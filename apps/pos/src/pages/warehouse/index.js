/**
 * Warehouse Page — Thin wrapper around Generic CRUD Module.
 *
 * SP-029 M2-FIX: kuota gudang dari Master Platform (Company.jumlahGudang)
 * di-enforce di UI (createGuard) — tombol Tambah Gudang dinonaktifkan saat
 * kuota penuh. Server juga menolak (defense in depth, routes/warehouse.js).
 */
import { CrudModule } from "@smart/ui";
import { listWarehouse, getWarehouse, createWarehouse, updateWarehouse, deleteWarehouse } from "../../data/index.js";
import { checkKodeExists } from "../../data/warehouse-data.js";
import { getCompanyConfig, refreshCompanyConfig } from "../../config/company-config.js";

const { CrudPage, initCrudPage } = CrudModule({
    entityId: "warehouse",
    title: "Master Gudang",
    subtitle: "Kelola data gudang",
    icon: "🏭",
    singularName: "Gudang",
    pluralName: "gudang",
    tambahLabel: "Tambah Gudang",
    formTitleEdit: "Edit Gudang",
    formTitleCreate: "Tambah Gudang Baru",
    // SP-029 M2-FIX — kuota gudang (jumlahGudang) dari Master Platform.
    // Hitung gudang NON-archived (konsisten dengan enforcement server
    // routes/warehouse.js POST: status $ne "archived").
    createGuard: async () => {
        // Refresh dari server — Company doc ditulis Master Platform; cache
        // sessionStorage (saat login) bisa basi bila Company diubah di Console.
        await refreshCompanyConfig();
        const cfg = getCompanyConfig();
        const limit = cfg.jumlahGudang || 1;
        try {
            const res = await listWarehouse({ page: 1, limit: 999 });
            const all = Array.isArray(res?.data) ? res.data : [];
            const current = all.filter(w => w.status !== "archived").length;
            if (current >= limit) {
                return {
                    allowed: false,
                    message: `Kuota gudang tercapai (${current}/${limit}).`
                };
            }
            return { allowed: true };
        } catch (err) {
            console.warn("[Warehouse] createGuard gagal — izinkan (server tetap enforce):", err?.message);
            return { allowed: true };
        }
    },
    services: { list: listWarehouse, get: getWarehouse, create: createWarehouse, update: updateWarehouse, delete: deleteWarehouse, checkKodeExists },
    columns: [
        { key: "kode", label: "Kode", width: "110px" },
        { key: "nama", label: "Nama Gudang" },
        { key: "alamat", label: "Alamat" },
        { key: "kontak", label: "Kontak", width: "120px" },
        { key: "telepon", label: "Telepon", width: "130px" }
    ],
    formDataDefaults: { kode: "", nama: "", alamat: "", kontak: "", telepon: "", deskripsi: "" },
    mapFormData: (item) => ({ kode: item.kode, nama: item.nama, alamat: item.alamat || "", kontak: item.kontak || "", telepon: item.telepon || "", deskripsi: item.deskripsi || "" }),
    getPayload: () => ({
        kode: document.getElementById("f-kode")?.value?.trim() || "",
        nama: document.getElementById("f-nama")?.value?.trim() || "",
        alamat: document.getElementById("f-alamat")?.value?.trim() || "",
        kontak: document.getElementById("f-kontak")?.value?.trim() || "",
        telepon: document.getElementById("f-telepon")?.value?.trim() || "",
        deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || ""
    }),
    renderFormFields: (e, d) => `
        <div class="form-grid">
            <div class="form-group">
                <label for="f-kode">Kode Gudang <span class="required">*</span></label>
                <input type="text" id="f-kode" value="${e(d.kode)}" placeholder="contoh: WH-001" />
            </div>
            <div class="form-group">
                <label for="f-nama">Nama Gudang <span class="required">*</span></label>
                <input type="text" id="f-nama" value="${e(d.nama)}" placeholder="Nama gudang" required />
            </div>
            <div class="form-group">
                <label for="f-kontak">Kontak Person</label>
                <input type="text" id="f-kontak" value="${e(d.kontak)}" placeholder="Nama kontak" />
            </div>
            <div class="form-group">
                <label for="f-telepon">No. Telepon</label>
                <input type="text" id="f-telepon" value="${e(d.telepon)}" placeholder="021-xxxxxxx" />
            </div>
            <div class="form-group full-width">
                <label for="f-alamat">Alamat</label>
                <textarea id="f-alamat" placeholder="Alamat lengkap gudang">${e(d.alamat)}</textarea>
            </div>
            <div class="form-group full-width">
                <label for="f-deskripsi">Deskripsi / Catatan</label>
                <textarea id="f-deskripsi" placeholder="Catatan tentang gudang">${e(d.deskripsi)}</textarea>
            </div>
        </div>
    `,
    renderCard: (e, item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${e(item.nama)}</div>
        </div>
        <div class="sm-card-details">
            ${item.alamat ? `<div class="sm-card-detail-row"><span class="sm-card-label">Alamat</span><span class="sm-card-value">${e(item.alamat)}</span></div>` : ''}
            ${item.kontak ? `<div class="sm-card-detail-row"><span class="sm-card-label">Kontak</span><span class="sm-card-value">${e(item.kontak)}</span></div>` : ''}
            ${item.telepon ? `<div class="sm-card-detail-row"><span class="sm-card-label">Telepon</span><span class="sm-card-value">${e(item.telepon)}</span></div>` : ''}
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

export { CrudPage as WarehousePage, initCrudPage as initWarehousePage };
