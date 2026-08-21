# Transaction Capability Foundation V1 — SMART POS

## Tujuan

Admin perusahaan dapat menentukan **jenis transaksi apa saja yang boleh
dilakukan oleh kasir**. Daftar ini menjadi *source of truth* untuk
menentukan workflow / menu transaksi yang tersedia bagi user/kasir, serta
gerbang (gate) di sisi backend — bukan sekadar hide/show UI.

Fondasi ini memungkinkan fitur F&B (Recipe/BOM, Table Management, Kitchen
Display, QR Ordering) dipasang sebagai workflow tambahan pada milestone
berikutnya, tanpa mengubah arsitektur inti POS.

## Konsep: capability array (BUKAN boolean terpisah)

```js
// ✅ BENAR — capability array
transactionTypes: ["retail", "fnb"]

// ❌ JANGAN — boolean terpisah
// isRetail: true
// isFnb: true
// isService: false ...
```

Capability baru ditambahkan cukup dengan menambah entri di registry —
**tanpa mengubah struktur database utama** (Company.transactionTypes tetap
array of string).

## Daftar capability V1

Satu-satunya sumber kebenaran: **`packages/smart-core/src/transaction-types/transaction-types.js`**
(diekspor dari `@smart/core`).

| Key | Label | Description |
| --- | --- | --- |
| `retail` | Retail | Penjualan barang secara langsung |
| `fnb` | F&B | Transaksi makanan dan minuman |
| `service` | Jasa | Transaksi penjualan jasa |
| `ppob` | PPOB | Pembayaran tagihan & isi ulang (PPOB) |
| `preorder` | Pre-Order | Pesanan barang yang dipesan terlebih dahulu |
| `reservation` | Reservasi | Pemesanan meja / waktu layanan |
| `membership` | Membership | Transaksi keanggotaan & isi saldo member |

Setiap capability memiliki metadata `{ key, label, description }`.
Registry digunakan oleh Console (admin), POS server (validasi & gate) dan
POS client (filter menu/route) — **tidak di-hard-code di banyak file**.

## Struktur data

Disimpan pada **dokumen Company** (DB bersama Console & POS), field
`transactionTypes`:

```json
{
  "transactionTypes": ["retail", "fnb"]
}
```

Validasi saat penyimpanan (diterapkan di Console `POST/PUT /api/companies`
dan POS `PUT /api/pos/config/transaction-types`):

- hanya capability **terdaftar** yang boleh disimpan
- **duplikasi capability ditolak** (400)
- **array kosong diperbolehkan** (bisnis valid: tanpa jenis transaksi aktif)
- **capability tidak dikenal ditolak** (400)
- **fallback aman** untuk company lama tanpa field → `["retail"]`

## Hirarki capability

```
SMART CONSOLE (master.e-profit.id)
  └── Available Capabilities        → registry @smart/core (TRANSACTION_TYPES)
        └── Company Configuration   → Company.transactionTypes
              └── Enabled Transaction Capabilities
                    └── POS (pos.e-profit.id)
                          └── Kasir (role kasir → halaman kasir standalone)
```

Tiga lapisan yang dibedakan:

1. **Available Capability** — capability yang secara platform tersedia
   (registry @smart/core).
2. **Enabled Capability** — capability yang diaktifkan untuk perusahaan
   (`Company.transactionTypes`, dikelola Master Platform / Admin POS).
3. **User Permission** — hak role/user (framework permission existing,
   mis. `settings.company.edit`, `pos.kasir.use`). **Tidak membuat sistem
   permission baru** — capability berbeda dari permission.

## API

### Console (Master Platform)

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `GET` | `/api/companies/transaction-types` | Katalog Available Capabilities (metadata) |
| `POST` | `/api/companies` | Create company (validasi ketat transactionTypes) |
| `PUT` | `/api/companies/:id` | Update company — menyimpan `transactionTypes` (validasi ketat) |

### POS

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `GET` | `/api/pos/config/transaction-types` | Baca jenis transaksi aktif (authenticated + company scope, default V1) |
| `PUT` | `/api/pos/config/transaction-types` | Simpan jenis transaksi aktif — permission `settings.company.edit` |

Response minimal:

```json
{ "transactionTypes": ["retail", "fnb"] }
```

`transactionTypes` juga dikirim pada:
- response `POST /api/auth/login` & `POST /api/auth/impersonate` (field `companyConfig`)
- `GET /api/settings` (field `companyConfig`)
- `GET /api/pos/kasir-data` (field `transactionTypes`)

## UI Admin

**SMART Console → Administration → Companies → Edit Perusahaan** — bagian
**"Jenis Transaksi Kasir"**:

```
Jenis Transaksi Kasir
☑ Retail      Penjualan barang secara langsung
☑ F&B         Transaksi makanan dan minuman
☐ Jasa        Transaksi penjualan jasa
☐ PPOB        Pembayaran tagihan & isi ulang (PPOB)
☐ Pre-Order   Pesanan barang yang dipesan terlebih dahulu
☐ Reservasi   Pemesanan meja / waktu layanan
☐ Membership  Transaksi keanggotaan & isi saldo member
```

Setiap capability memakai **checkbox** (komponen `Switch` = `input type="checkbox"`),
dengan label + description dari registry (satu sumber kebenaran).

## Perilaku POS (client)

- Menu sidebar: item dengan field `capability` hanya tampil bila capability
  tsb diaktifkan (`filterMenusByTransactionTypes` dari `@smart/core`).
- Route: `navigate()` menolak render route yang `capability`-nya tidak aktif
  (mis. route `pos` = `capability: "retail"`) dan menampilkan pesan
  "Jenis Transaksi Tidak Aktif" — akses langsung via URL pun diblokir.
- Kasir: `transactionTypes` tersedia dari `companyConfig` (sessionStorage /
  GET settings / kasir-data) untuk gate workflow di milestone berikutnya.
- F&B belum aktif → menu F&B, workflow meja, kitchen, dan QR ordering
  tidak tampil (semua belum diimplementasikan — fondasi saja).

## Enforcement backend (security)

Capability **tidak hanya hide/show UI**:

- `PUT /api/pos/config/transaction-types` wajib permission
  `settings.company.edit` — user biasa/kasir ditolak 403; user **tidak dapat
  mengaktifkan capability sendiri** lewat request API.
- `PUT /api/companies/:id` (Console) hanya untuk Super Admin platform
  (audience console, permission `*`).
- Scope perusahaan: middleware `companyScope` memastikan admin hanya mengubah
  capability untuk company miliknya (header `x-company-code` cocok dengan
  token).
- **Gate endpoint transaksi**: `requireTransactionType("retail")` dipasang
  pada `POST /api/penjualan` (pembuatan transaksi penjualan = workflow
  retail). Bila retail tidak diaktifkan → 403. Default V1 (`["retail"]`)
  membuat perilaku existing tidak berubah.

## Backward compatibility

- Company lama **tanpa** field `transactionTypes` → diperlakukan sebagai
  `["retail"]` (default V1, sesuai perilaku POS saat ini). POS tetap bisa
  dibuka.
- Default aman ada di 4 lapisan: schema model, normalisasi server
  (`normalizeCompanyConfig`), normalisasi client (`company-config.js`), dan
  helper `isTransactionTypeEnabled`.
- Tidak ada perubahan perilaku retail existing selama `retail` tetap diaktifkan.

## Future extension (F&B — milestone berikutnya)

Capability `fnb` menjadi pintu untuk workflow F&B:

- Recipe / BOM (✅ M6.2 — lihat `M6-CAPABILITY-RECIPE.md`)
- Table Management (✅ M6.3)
- Kitchen Display System (KDS) / Kitchen Order (✅ M6.4)
- Customer QR Ordering (✅ M6.5)

> **Update (2026-08-17, v0.46):** M6.3 – M6.5 sudah diimplementasikan sebagai
> **F&B Customer Ordering V1** — lihat `docs/pos/pos_execution_3.md`.
> Task ini (M6.1) memang sengaja hanya membangun **fondasi capability**
> (registry transaction-types + gate) agar fitur-fitur tersebut dapat dipasang
> sebagai workflow F&B tanpa aplikasi terpisah.
(`pos-retail`, `pos-fnb`, dst) — semua tetap satu POS engine dengan
capability.

## File penting

- `packages/smart-core/src/transaction-types/transaction-types.js` — registry (source of truth)
- `apps/console/server/models/Company.js` & `apps/pos/server/models/Company.js` — field `transactionTypes`
- `apps/console/server/routes/companies.js` — POST/PUT + katalog endpoint
- `apps/pos/server/services/transaction-capability.js` — baca config & middleware `requireTransactionType`
- `apps/pos/server/routes/pos-config.js` — GET/PUT `/api/pos/config/transaction-types`
- `apps/pos/src/config/company-config.js` — normalize client + helper
- `apps/pos/src/router/index.js` — gate route berdasarkan capability
