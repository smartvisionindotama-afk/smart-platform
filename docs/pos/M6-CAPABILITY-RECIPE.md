# SMART POS — M6: Transaction Capability (M6.1) + F&B Recipe/BOM Engine (M6.2)

Status milestone:
- **M6.1 — Transaction Capability Foundation: DONE**
- **M6.2 — F&B Recipe / BOM Engine: DONE**

> **Update (2026-08-17, pos_execution v0.46):** M6.3 (Table & Order Management),
> M6.4 (Kitchen Display System) & M6.5 (Customer QR Ordering) kini **DIIMPLEMENTASIKAN**
> sebagai **F&B Customer Ordering V1** — lihat `docs/pos/pos_execution_3.md`.
> Desain M6.1/M6.2 (capability `fnb` + engine konsumsi) memang disiapkan sebagai
> fondasi agar ketiganya dapat ditambahkan tanpa refactor besar.

---

## M6.1 — Transaction Capability Foundation

### Capability model

Struktur tersimpan pada dokumen **Company** (DB bersama Console & POS),
field `transactionTypes` — **capability array**, bukan boolean terpisah
(keputusan arsitektural V1 yang dipertahankan):

```json
{ "transactionTypes": ["retail", "fnb"] }
```

- Default V1: `["retail"]` — company lama TANPA field tetap berjalan seperti
  sekarang (POS Retail tidak pernah dimatikan oleh default).
- Array kosong `[]` diperbolehkan (bisnis tanpa jenis transaksi aktif).
- Capability tak dikenal / duplikat → ditolak (400).
- Source of truth: registry `packages/smart-core/src/transaction-types/transaction-types.js`
  (`retail`, `fnb`, `service`, `ppob`, `preorder`, `reservation`, `membership`).

### Database field

`Company.transactionTypes: [String]` — additive, di kedua model
(`apps/console/server/models/Company.js` & `apps/pos/server/models/Company.js`).
Tidak ada collection baru.

### API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `GET` | `/api/pos/settings/transaction-capabilities` | Baca jenis transaksi aktif (auth + company scope) |
| `PUT` | `/api/pos/settings/transaction-capabilities` | Simpan — permission `settings.company.edit` |
| `GET` | `/api/pos/config/transaction-types` | Alias kanonik V1 |
| `PUT` | `/api/pos/config/transaction-types` | Alias kanonik V1 |
| `GET` | `/api/pos/config/transaction-capabilities` | Alias M6 |
| `PUT` | `/api/pos/config/transaction-capabilities` | Alias M6 |

PUT menerima DUA bentuk payload (dinormalisasi ke array):

```json
{ "transactionTypes": ["retail", "fnb"] }
```
```json
{ "retail": true, "fnb": true, "service": false, "ppob": false }
```

Validasi: hanya Boolean (bentuk object) / hanya capability terdaftar (bentuk
array), capability tidak dikenal ditolak, duplikat ditolak, array kosong
diperbolehkan, payload invalid → error jelas (400).

### UI POS Settings

Halaman **Settings → Capability Transaksi** (`settings-capability`, permission
`settings.company.edit`): checkbox per capability (komponen `Switch` SMART UI),
label + description dari registry, state **loading / error / success** (toast),
tersimpan via API (bukan localStorage). Console (Edit Perusahaan) juga
menyediakan checkbox yang sama (sejak V1).

### Enforcement

- Backend `requireTransactionType()` pada endpoint terkait (mis. `POST
  /api/penjualan` → `retail`; seluruh endpoint recipe → `fnb`).
- POS client: menu & route ber-field `capability` disembunyikan/ditolak bila
  capability nonaktif.
- User tidak dapat mengaktifkan capability sendiri (PUT wajib
  `settings.company.edit`; scope perusahaan dipaksa middleware `companyScope`).

---

## M6.2 — F&B Recipe / BOM Engine

### Konsep

Produk F&B dapat memiliki recipe. Contoh:

```
NASI GORENG (recipe aktif)
  Beras    0.20 kg
  Telur    1    pcs
  Minyak   0.02 liter
  Bumbu    0.03 kg
```

Recipe adalah **struktur data engine stok** — bukan sekadar info UI: saat
produk terjual, ingredient dikonsumsi dari stok.

### Dua model resep (M6.2-FIX — sinkron Master Barang ↔ Recipe F&B)

Field `behavior` pada Barang membedakan DUA model resep:

| Behavior | Label Master Barang | Konsumsi stok | Penyesuaian stok |
| --- | --- | --- | --- |
| `recipe` | Resep / Menu (Tanpa Stok — simple) | **TIDAK realtime** | manual via **stok opname** |
| `recipe-fnb` | Resep / Menu (Terhubung Recipe F&B) | **realtime** (engine BOM) | otomatis saat transaksi |

- **Model simple (`recipe`)** — dijual tanpa kurangi stok produk; bahan
  tidak dikonsumsi otomatis (stok disesuaikan admin lewat stok opname).
- **Model terhubung (`recipe-fnb`)** — produk hanya tampil di halaman
  Master → Recipe F&B; saat terjual, ingredient dikurangi realtime.

Enforcement (bukan hanya hide/show UI):
- Halaman Recipe F&B: dropdown Produk HANYA barang `recipe-fnb` (+ produk
  yang sudah punya recipe — backward compat data existing).
- Server `validateRecipePayload`: produk `recipe` (simple) **ditolak 400**
  dengan pesan jelas (ubah tipe ke "Resep / Menu (Terhubung Recipe F&B)").
- `applyRecipeConsumption`: produk `recipe` (simple) **dilewati** — konsumsi
  realtime hanya utk `recipe-fnb` / produk ber-recipe aktif.
- `NO_STOCK_BEHAVIORS` mencakup `recipe-fnb` (produk menu tidak punya stok
  sendiri — ingredient yang berkurang).

### Model

`Recipe` (collection `recipes`):

```
companyCode, productId (Barang._id), productKode, productNama,
name, description, harga (Rp varian — 0 = fallback harga_jual produk),
version (Number), status (draft|active|archived),
ingredients[ { itemId (Barang._id), kode, nama, quantity, unit } ],
createdAt, updatedAt
```

- **Tidak ada entity Product baru** — produk tetap `Barang` existing.
- Ingredient mereferensikan `Barang` existing (validasi server: item tidak
  ada → ditolak).
- Unique index `(companyCode, productId, version)`.
- `RecipeConsumption` (collection `recipeconsumptions`): log konsumsi bahan
  terikat transaksi penjualan — unique index `(saleId, productId, recipeId)`
  sebagai **idempotency protection** (transaksi diproses ulang tidak
  mengurangi stok 2×). Status `applied | reversed`.

### Produk VARIAN (M6.2-FIX v0.42)

Satu produk F&B boleh punya **BEBERAPA recipe aktif sekaligus** — masing-
masing adalah VARIAN (mis. "Kopi Susu Manis" → varian "Pake Gula" &
"Tanpa Gula").

- Di layar kasir produk tampil **1 kartu** (badge `N Varian`, harga
  "mulai" = varian termurah); saat diorder kasir memilih varian (modal
  **Pilih Varian** — nama + harga masing-masing).
- Item transaksi menyimpan **`recipeId`** varian yang dipilih; konsumsi
  bahan memakai ingredient recipe varian tsb. 2 varian produk sama dalam 1
  transaksi → keduanya dikonsumsi (unique index per recipeId).
- Harga varian: `Recipe.harga` (Rp) — 0 = fallback `harga_jual` produk.
  Nama item di keranjang/struk: `Produk (Varian)`.
- `kasir-data` mengirim `varian: [{recipeId, nama, harga}]` per produk
  (dari Recipe aktif). Produk tanpa varian → perilaku retail existing.

### Recipe lifecycle

```
draft → active → archived
```

- Recipe baru / edit / duplikat **langsung aktif** (konsep draft dihapus
  dari UX — kolom action hanya Edit/Duplikat/Hapus).
- **BEBERAPA recipe aktif per produk diperbolehkan (varian)** — create /
  update / duplicate TIDAK meng-archive active lain.
- Edit mengubah dokumen yang sama (in-place, tanpa versi baru).
- Hapus = **hard delete permanen** (log RecipeConsumption menyimpan
  snapshot ingredients — reversal void tetap aman setelah recipe dihapus).

### Engine (pure, testable)

`apps/pos/server/services/recipe.js`:

- `calculateRecipeConsumption(recipe, quantity)`:
  `ingredient.quantity × quantity` — contoh: 2 telur × 3 porsi = 6 telur;
  0.2 kg × 3 = 0.6 kg. Pembulatan 4 desimal (hindari noise float).
- `calculateRecipeCost(recipe, itemCosts)`:
  `recipeCost = Σ ingredient.quantity × ingredient.cost` — cost memakai
  `harga_beli` item existing. Bila cost item tidak tersedia (≤ 0) →
  `totalCost`/`costPerServing` = `null` (jangan mengarang; dependency
  didokumentasikan). `costPerServing = totalCost` (resep = bahan per 1 porsi).
- `validateRecipeIngredients(ingredients, items)` — aturan:
  item wajib ada, quantity > 0 (0/negatif/non-angka ditolak), tanpa duplikat
  itemId, minimal 1 ingredient, unit konsisten dengan satuan item existing
  (tanpa sistem konversi unit V1).

### API

`/api/recipes` — seluruh endpoint di-gate `requireTransactionType("fnb")`
(Recipe/BOM tidak boleh dipakai bila F&B nonaktif):

| Method | Endpoint | Permission |
| --- | --- | --- |
| `GET` | `/api/recipes` | auth + company scope |
| `GET` | `/api/recipes/:id` | auth + company scope |
| `GET` | `/api/recipes/:id/cost` | auth + company scope |
| `POST` | `/api/recipes` | `pos.recipe.manage` |
| `PUT` | `/api/recipes/:id` | `pos.recipe.manage` |
| `POST` | `/api/recipes/:id/activate` | `pos.recipe.manage` |
| `POST` | `/api/recipes/:id/archive` | `pos.recipe.manage` |

Permission `pos.recipe.manage` diberikan ke role **Admin/Owner** (seed +
fallback + katalog permission client). **Kasir TIDAK mendapat permission
recipe** — kasir hanya memakai hasil recipe lewat transaksi.

### Stock integration (tanpa merusak Retail)

Pada `POST /api/penjualan` (sumber `pos`, bukan hold):

1. Produk tanpa recipe aktif → perilaku Retail existing (TIDAK berubah).
2. Produk dengan recipe aktif → `applyRecipeConsumption`:
   - hitung `calculateRecipeConsumption(recipe, qty)`
   - kurangi stok ingredient (pola stock mutation existing: scoped company +
     gudang transaksi, best-effort dengan log error)
   - tulis `RecipeConsumption` (idempotent per `saleId+productId`).
3. Hold draft tidak mengonsumsi (belum ada penjualan).

Item transaksi kini menyimpan `productId` (Barang._id) untuk lookup recipe
(additive; data lama tanpa field tetap valid — fallback mencocokkan
`productKode` recipe).

### Void / cancel

`POST /api/penjualan/:id/void` → setelah reversal stok existing,
`revertRecipeConsumption` mengembalikan stok ingredient dan menandai log
`reversed`. Aman: void hanya diizinkan dari status `paid` (gate existing) —
transaksi tidak bisa di-void dua kali.

### Batasan V1 (known limitations)

- Konsumsi bahan **best-effort** (kegagalan dicatat, tidak menggagalkan
  transaksi) — sama dengan pola stock mutation existing; log konsumsi
  memungkinkan rekonsiliasi manual.
- Tidak ada konversi unit (mis. kg → gram) — unit harus konsisten dengan
  item existing.
- `costPerServing = totalCost` — belum ada konversi batch / yield.
- `wastePercent` belum dipakai (field sengaja tidak ditambahkan).
- M6.3/M6.4/M6.5 (Table, Kitchen, QR Ordering) **sudah diimplementasikan**
  (F&B Customer Ordering V1 — `pos_execution_3.md` v0.46); dokumen ini
  mendokumentasikan fondasi M6.1/M6.2 yang menjadi dasarnya.

### Permission

- M6.1: `settings.company.edit` (kelola capability).
- M6.2: `pos.recipe.manage` (kelola recipe — Admin/Owner; kasir tidak).
- Enforcement tambahan: `requireTransactionType("retail")` (penjualan) &
  `requireTransactionType("fnb")` (recipe) — capability dicek di backend,
  bukan hanya hide/show UI.

### Tests

- M6.1: default capability, GET/PUT payload (array + object boolean),
  validasi invalid, authorization (403 tanpa permission), fallback company
  lama → `apps/pos/server/__tests__/transaction-capability.test.js`.
- M6.2: consumption (2 telur × 3 = 6; 0.2 kg × 3 = 0.6), quantity 0/negatif
  ditolak, cost (7400 = 2×2500 + 0.2×12000), cost null bila tidak tersedia,
  duplikat ingredient ditolak, item tidak ada ditolak, unit tidak konsisten
  ditolak, minimal 1 ingredient, integrasi konsumsi (idempotency, skip tanpa
  recipe, reversal) → `apps/pos/server/__tests__/recipe.test.js`.
