/**
 * Customer Page — Thin wrapper around Generic CRUD Module.
 */
import { CrudModule } from "@smart/ui";
import { listCustomer, getCustomer, createCustomer, updateCustomer, deleteCustomer } from "../../data/index.js";
import { checkKodeExists } from "../../data/customer-data.js";

const { CrudPage, initCrudPage } = CrudModule({
    entityId: "customer",
    title: "Master Member",
    subtitle: "Kelola data member — harga khusus (harga_khusus) hanya berlaku untuk member",
    icon: "🎫",
    singularName: "Member",
    pluralName: "member",
    tambahLabel: "Tambah Member",
    formTitleEdit: "Edit Member",
    formTitleCreate: "Tambah Member Baru",
    services: { list: listCustomer, get: getCustomer, create: createCustomer, update: updateCustomer, delete: deleteCustomer, checkKodeExists },
    columns: [
        { key: "kode", label: "Kode", width: "110px" },
        { key: "nama", label: "Nama Member" },
        { key: "kontak", label: "Kontak", width: "120px" },
        { key: "telepon", label: "Telepon", width: "130px" },
        { key: "email", label: "Email", width: "180px" }
    ],
    formDataDefaults: { kode: "", nama: "", kontak: "", telepon: "", email: "", alamat: "", deskripsi: "" },
    mapFormData: (item) => ({ kode: item.kode, nama: item.nama, kontak: item.kontak || "", telepon: item.telepon || "", email: item.email || "", alamat: item.alamat || "", deskripsi: item.deskripsi || "" }),
    getPayload: () => ({
        kode: document.getElementById("f-kode")?.value?.trim() || "",
        nama: document.getElementById("f-nama")?.value?.trim() || "",
        kontak: document.getElementById("f-kontak")?.value?.trim() || "",
        telepon: document.getElementById("f-telepon")?.value?.trim() || "",
        email: document.getElementById("f-email")?.value?.trim() || "",
        alamat: document.getElementById("f-alamat")?.value?.trim() || "",
        deskripsi: document.getElementById("f-deskripsi")?.value?.trim() || ""
    }),
    renderFormFields: (e, d) => `
        <div class="form-grid">
            <div class="form-group">
                <label for="f-kode">Kode Member <span class="required">*</span></label>
                <input type="text" id="f-kode" value="${e(d.kode)}" placeholder="contoh: MBR-001" />
            </div>
            <div class="form-group">
                <label for="f-nama">Nama Member <span class="required">*</span></label>
                <input type="text" id="f-nama" value="${e(d.nama)}" placeholder="Nama member" required />
            </div>
            <div class="form-group">
                <label for="f-kontak">Kontak Person</label>
                <input type="text" id="f-kontak" value="${e(d.kontak)}" placeholder="Nama kontak" />
            </div>
            <div class="form-group">
                <label for="f-telepon">No. Telepon</label>
                <input type="text" id="f-telepon" value="${e(d.telepon)}" placeholder="021-xxxxxxx" />
            </div>
            <div class="form-group">
                <label for="f-email">Email</label>
                <input type="email" id="f-email" value="${e(d.email)}" placeholder="pelanggan@company.com" />
            </div>
            <div class="form-group full-width">
                <label for="f-alamat">Alamat</label>
                <textarea id="f-alamat" placeholder="Alamat lengkap member">${e(d.alamat)}</textarea>
            </div>
            <div class="form-group full-width">
                <label for="f-deskripsi">Deskripsi / Catatan</label>
                <textarea id="f-deskripsi" placeholder="Catatan tentang member">${e(d.deskripsi)}</textarea>
            </div>
        </div>
    `,
    renderCard: (e, item) => `
        <div class="sm-card-header-row">
            <div class="sm-card-name">${e(item.nama)}</div>
        </div>
        <div class="sm-card-details">
            ${item.kontak ? `<div class="sm-card-detail-row"><span class="sm-card-label">Kontak</span><span class="sm-card-value">${e(item.kontak)}</span></div>` : ''}
            ${item.telepon ? `<div class="sm-card-detail-row"><span class="sm-card-label">Telepon</span><span class="sm-card-value">${e(item.telepon)}</span></div>` : ''}
            ${item.email ? `<div class="sm-card-detail-row"><span class="sm-card-label">Email</span><span class="sm-card-value">${e(item.email)}</span></div>` : ''}
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

export { CrudPage as CustomerPage, initCrudPage as initCustomerPage };
