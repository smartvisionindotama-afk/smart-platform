# POS.e-Profit — Execution Plan

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Dokumen        | `docs/pos/pos_execution.md`                                 |
| Versi          | 0.45 (SP-029 POS V1: M6.1 Transaction Capability Foundation + M6.2 F&B Recipe/BOM Engine — lihat §11) |
| Berdasarkan    | `docs/pos/pos_roadmap_v1.md` (PRD V1.1, 2026 — Smart Vision + Freebuff)|
| Produk         | POS.e-Profit (Point of Sales)                              |
| Domain target  | `pos.e-profit.id`                                          |
| Tim            | Freebuff Development Team                                  |
| Status         | ✅ **V1 PRODUCTION READY (audit final 2026-08-10)** — M0–M3 + M3-FIX v1–v20 selesai, live `https://pos.e-profit.id` (SSL valid, HSTS aktif, pos-api PM2 :3003); PRD V1.1 lengkap bab 4–20 + Gap Report + 5 CONFLICT disetujui PO; TODO V1 T1–T12 diimplementasikan (barcode/metode bayar/diskon/void/shift/dashboard/report/behavior/role kasir) + Retur & Koreksi (v11) + enforcement Company POS & Inventory (v12–v13) + fix Edit Perusahaan Console (v14) + pesan kuota ringkas (v15) + **T5 Hold/Resume (v16)** + **kuota kasir role-aware (v17)** + **fix Hold/Resume 500 & 400 (v18)** + **Nota / Pajak Admin / Member & Harga Khusus (v19)** + **Verifikasi Member & Cetak Bukti Thermal (v20)** + **M3-FIX v21: struk Nota Penjualan, cetak langsung thermal, tombol Hold 50%/Batal 50%, admin Penjualan hanya Nota/Void/Hapus & kolom No. Nota** + **M3-FIX v22: font struk dibalik (company kecil/Nota Penjualan besar), struk admin persis kasir, Gudang-Kasir (picker multi-gudang + grid mapping per kasir) & stok scoping penuh per gudang** + **M3-FIX v23: Jenis Pelanggan sejajar judul Bill + Gudang/Shift/Pajak pindah ke dasar SIDEBAR KIRI (panel Kategori)** + **v24 struk No. Nota & sidebar** + **v25 kuota fresh & mapping gudang-kasir fleksibel** + **v26 lazy company context (tanpa dropdown Pilih Company)** + **v27 nama company ikut Master Platform**; **full regression 862/862 (48 files)**, build pos+inv+console ✓, smoke live ✓; **M3-FIX v28 (2026-08-11): fix user role kasir tidak tampil + pesan E11000 ramah + `trust proxy` hardening 3 server (pos/inv/console)** — full suite 65/65 POS server tests, build pos+inv ✓, live bundle `index-BOENU_17.js` sinkron, GET /api/users live 200 memuat kasir1/kasir2, POST duplikat → pesan ramah; **M3-FIX v28b (2026-08-11): fix PAGINATION tabel user** — kasir tampil tapi owner/operator menghilang; akar: `allCompanies=true` membuat server mempage di SEMUA company lalu client memfilter sendiri → user company lain isi halaman 1, owner/operator PT-001 tenggelam di halaman global 2; fix: paksa `allCompanies=false` saat konteks company aktif → server yang filter + paginate (live total 5 = kasir2/kasir1/kasir/fejsingtop/operator; bundle pos `index-DxDujDZB.js` + inv `index-C5wo37eG.js`); **M3-FIX v28c (2026-08-11): fix filter pencarian tersembunyi di tabel user** — state.search persisten & input tanpa value → setelah simpan/edit tabel tampak "menghilang" (hanya user cocok search); fix: input search tampilkan value + reset `search`/`page` setelah simpan/edit/hapus (module shared; bundle pos `index-D2nYz45u.js` + inv `index-B2HVh_EL.js`); **M3-FIX v28d (2026-08-11): fix AUTOFILL browser** — Chrome password manager mengisi kotak pencarian user dengan kredensial login (email owner) saat modal Tambah/Edit User (berisi field password) terbuka → id `user-search` dianggap field username → filter aktif → tabel tinggal owner; fix: `autocomplete="new-password"` pada f-password + `data-form-type="other"`/`autocomplete="off"` pada f-username/f-email/search + tombol × clear filter (module shared; bundle pos `index-BMOl_C0u.js` + inv `index-C7MdV9Da.js`); **M3-FIX v28e (2026-08-11): eye toggle password** — icon mata 👁/🙈 di field password: modal Tambah/Edit User (`#f-password-toggle`), form login regular (`#login-password-toggle`, framework — pos & inventory), login superadmin console (`#sa-login-password-toggle`); klik = tampil/sembunyikan password + refocus input (module shared pos `index-B25LHkNm.js` + inv `index-DifPxCpA.js` (fix hasil review: spesifisitas CSS `.form-group .password-wrapper input` agar padding-right menang & icon mata tidak menimpa teks) + console `index-BSAaZACv.js`); **M3-FIX v28f (2026-08-11): fix posisi eye toggle di modal Tambah/Edit User** — akar: modal di-append ke document.body (di luar `.crud-page`) sehingga style scoped halaman tidak menjangkau isi modal → eye jatuh di bawah field; fix: style `modalStyles()` (`.smart-modal-body .password-wrapper/.password-toggle`) ditanam di DALAM konten modal + dead CSS `.crud-page .password-toggle` dihapus (module shared; bundle pos `index-D4HgKH5z.js` + inv `index-qE_xe7Fy.js`); **M3-FIX v28g (2026-08-11): eye toggle di form Register & Reset Password** — pola sama (👁/🙈, type password↔text, refocus) untuk `reg-password`+`reg-password-confirm` (register.js) & `rp-password`+`rp-confirm` (reset-password.js), style `.password-wrapper/.password-toggle` scoped halaman; atribut `autocomplete="new-password"` ditambah (module shared framework; bundle pos `index-B3n0Gswu.js` + inv `index-BdavSf0i.js` + console `index-CdxO6vs4.js`); **M6-FIX v4–v5 batch (2026-08-12): Master Barang kolom Barcode dihapus (kode berfungsi sbg barcode — pos & inv) · kasir 2 titik input barcode (produk + bill; scan bill lalu dihapus) · Bill urutan Total→Bayar + widget sidebar kiri (Tutup sejajar Kas Awal satu baris + Omset Kasir via shift/summary) · sidebar kategori Sembunyikan/Lebarkan (pola admin, persist localStorage, daftar barang melebar saat collapsed) · kolom Icon di Master Kategori (25 pilihan) & tampil di sidebar kasir · kategori kasir = Master Kategori SSOT (orphan barang dihapus, backup /srv/backups) · responsive: HP bill overlay + ikon 🛒 + badge, tablet 78/22, kategori strip atas (geser 0,5cm), kartu 3 (HP)/5 (tablet) per baris, nama company disembunyikan di HP · bill #F0FFF0 di HP/tablet · fix 401 /me (refresh preventif decode exp JWT) · fix 401 tutup shift (akar: maxAge cookie dalam detik ≠ ms di smart-security → cookie refresh mati <10 menit; fix `maxAge*1000`, berlaku pos/inv/console) · kamera barcode belakang (enumerateDevices tanpa kunci stream + reset instance saat start gagal + delay 250ms + log error asli) · kartu produk badge = kode produk (bukan kategori) · follow-up: badge radius 999px→6px (huruf tak terpotong) + font align center vertikal (inline-flex), tombol ✕ bill pindah kiri judul "Bill" (merah #dc2626, X putih); verifikasi: test 864/864, lint 0 error, build pos ✓, live bundle `index-Cdj8eO8w.js` (284.934 B) + chunk scanner `vendor-inv-ui-Dm7G2R2R.js` sinkron, restart pos-api (routes/pos.js + smart-security), health 200; **M6-FIX v6 (2026-08-13): member NFC & datalist, guard ganti member, scan pintar, lebar bill, anti double-read** — test 864/864, lint 0 error (1 warning baseline), build pos+inv ✓, live pos `index-DGKiZKcf.js` + inv `index-ChgcoraG.js`, chunk scanner `vendor-inv-ui-DukCcw7q.js`/`vendor-inv-ui-v9MbP4EB.js` identik byte-dengan-dist, marker `_dedupeMs=1500`, health 200; **M6-FIX v7 (2026-08-13): REFACTOR FRAMEWORK FIRST** — perbaikan global dipindah ke framework smart platform `@smart/core` (utils `formatRupiah`/`formatNumber`/`formatDecimal`/`parseIdNumber` + `esc`/`escHtml`/`escAttr` via facade `SMART.Utils`), definisi lokal `esc` (~18 file app & framework modules) & `formatRupiah` (hanya di app) dihapus → satu sumber kebenaran; anti double-read scan kamera dipindah ke class `BarcodeScanner` (semua pemakai: kasir, member, master barang pos/inv, pembelian, penjualan/SO, transfer) — `attachScanner` kembali polos; konsol migrasi via `_shared.js` re-export; test **864/864**, build pos+inv+console ✓, 0 duplikat tersisa, lint hanya baseline pre-existing; verifikasi: test 864/864, build 3 app ✓; tersisa backlog butuh approval PO: **T13 Retur dari layar kasir** |

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Dokumen ini adalah **rencana eksekusi** (execution plan) untuk membangun **POS.e-Profit V1** sesuai
PRD `pos_roadmap_v1.md`. Dokumen ini menerjemahkan:

- **EPIC-001 — Platform Integration** (Task 1–7) menjadi milestone & task yang bisa dieksekusi,
- **Golden Rules (1–20)** menjadi prinsip kerja & kriteria kelulusan per task,
- peta dampak ke struktur **monorepo SMART Platform yang sudah berjalan** (bukan project baru).

Format mengikuti konvensi `docs/execution_status.md` (tabel Roadmap / Task / Status / Catatan).

### 1.2 Sumber & Referensi

| Referensi | Keterangan |
|-----------|------------|
| `docs/pos/pos_roadmap_v1.md` | PRD POS.e-Profit V1.0 (acuan utama) |
| `docs/execution_status.md` | Status eksekusi platform & konvensi tabel |
| `docs/Roadmap_inventory.md` | Roadmap SMART Inventory (sumber kloning) |
| `docs/SP-027-CONSOLE-MIGRATION-REPORT.md` | Pola pemisahan aplikasi dari monorepo |
| `docs/SP-029-M6-AUDIT.md` | Pola aktivasi produk via Billing (entitlement) |
| `platform/config/nginx/app-template.conf` | Template domain baru |
| `apps/console/server/monitoring/apps.config.js` | Registry monitoring (statis) |

### 1.3 Catatan: Status Roadmap

`pos_roadmap_v1.md` kini **PRD V1.1 lengkap** (bab 4–20 + Golden Rules 1–20): Product
Architecture, Master Platform Config, Workspace, Dashboard, POS Core, Master Item,
Inventory Behavior, Mixed Transaction, Cashier & Shift, User & Permission, Reporting,
Business Config, Non-MVP Backlog, DB/API Impact, UI/UX, Acceptance Criteria, Freebuff
Execution Rule, Final V1 Delivery. Seluruh isi bab tersebut telah **disetujui Product
Owner** (CONFLICT C1–C5, 2026-08-10) dan diimplementasikan pada M3 (T1–T12).

Setiap fitur baru tetap wajib dilengkapi dokumen: *Business Rules, UI Flow, Database
Impact, API Impact, Acceptance Criteria* (lihat §10.2) — contoh: `pos-retur-koreksi.md`.

---

## 2. Prinsip Eksekusi — Golden Rules

Seluruh pengerjaan wajib mematuhi Golden Rules `pos_roadmap_v1.md`. Pemetaan aturan → cara penegakan:

| Rule | Inti | Cara penegakan di eksekusi |
|------|------|----------------------------|
| R1 **Clone, Don't Create** | Wajib kloning SMART Inventory | POS dibangun sebagai `apps/pos` (clone `apps/inventory`), **bukan project baru** |
| R2 **Reuse Before Rewrite** | Reuse business logic yang stabil | Reuse framework `@smart/*` + domain `@smart/inventory-ui` + route/model engine inventory |
| R3 **Do Not Break Inventory Engine** | Jangan ubah business logic Inventory | Perilaku POS diimplementasikan sebagai **extension** (field `behavior` + hook), bukan modifikasi engine |
| R4 **Master Platform = SSOT** | Perusahaan hanya dari master | POS **tanpa menu Tambah Perusahaan**; hanya baca konfigurasi dari `apps/console` |
| R5 **One Company ID** | Satu Company ID lintas aplikasi | POS memakai `x-company-code` / `Company.apps` yang sama (sudah tersedia) |
| R6 **One Authentication** | Auth & authz sama | Reuse `/api/auth/login`, `/api/superadmins/impersonation-token`, JWT + middleware M3 |
| R7 **One Database Architecture** | Struktur DB sama | POS memakai koleksi yang sama (Penjualan, Barang, dll.) — tanpa DB baru |
| R8 **One Product Ecosystem** | Pertimbangkan integrasi produk lain | Desain data/API POS kompatibel dengan Accounting, AI, CRM, HR (masa depan) |
| R9 **Business Behavior, Not App** | Retail/Cafe/etc = 1 engine | Dikendalikan konfigurasi `behavior` per item + `businessType` perusahaan |
| R10 **Backward Compatibility** | Inventory tetap bisa upgrade | Semua perubahan di `apps/pos`; modul bersama hanya **ditambah** (additive) |
| R11 **MVP First** | POS Core stabil dulu | Non-MVP (Recipe, KDS, Digital) masuk Backlog §9.2 |
| R12 **Documentation First** | Dokumen sebelum implementasi | Setiap milestone wajib keluar dokumen audit (lihat §10.2) |
| R13 **Code Quality** | Modular, reusable, testable | Wajib unit test + lint + build per milestone |
| R14 **Future Ready** | Desain siap roadmap berikutnya | `behavior` enum extensible (trading/service/recipe/digital) |
| R15 **Platform First, Feature Second** | Jangan korbankan platform | Perubahan shared code harus disetujui & diuji regresi full suite |
| R16 **Engine First, UI Second** | Urutan: Rules → Engine → DB → API → Workflow → UI → UX | Setiap task di M3/M4 mengikuti urutan ini |
| R17 **Configuration Driven** | Perbedaan lewat konfigurasi | `businessType`, `single/multi lokasi`, `product activation`, `behavior` |
| R18 **One Engine, Multiple Behaviors** | Satu Transaction Engine | Engine penjualan membaca `behavior` per item |
| R19 **Keep It Simple** | Sederhana di UI, kompleks di engine | Kasir screen: sedikit klik, input qty/scan barcode, langsung checkout |
| R20 **Business Value** | Setiap fitur punya nilai bisnis | Tiap task punya acceptance criteria bisnis eksplisit |

---

## 3. Strategi Eksekusi — Clone, Don't Create

### 3.1 Pendekatan

```
apps/inventory (inv.e-profit.id)          apps/pos (pos.e-profit.id)
─────────────────────────────             ────────────────────────────
  engine (models/routes)  ──clone──▶        engine (reuse, JANGAN duplikasi)
  @smart/inventory-ui     ──reuse──▶        UI domain (reuse/modular)
  @smart/core|ui|api|data|security ──reuse──▶ (framework, shared)
  pages/ (workflow Inventory)  ──ubah──▶    pages/ (workflow Kasir)
  branding "SMART Inventory"  ──ubah──▶    branding "POS.e-Profit"
```

Kunci: karena arsitektur monorepo sudah memisahkan **framework** (`packages/smart-*`) dan
**domain** (`@smart/inventory-ui`), maka "kloning" tidak berarti menyalin seluruh kode.
POS = aplikasi baru `apps/pos` yang **mereuse engine & domain yang sama**, lalu mengganti
workspace, sidebar, branding, dan workflow penjualan menjadi workflow kasir.

### 3.2 Modul Dipertahankan vs Diubah (Roadmap §3.2 & §3.3)

| Modul | Keputusan | Lokasi nyata |
|-------|-----------|--------------|
| Authentication & Authorization | **Dipertahankan** | `@smart/security`, routes `auth.js`, `users.js`, `roles.js`, `permissions.js`, `superadmins.js` |
| Database | **Dipertahankan** | MongoDB yang sama; `@smart/data` (BaseRepository auto company-scoping) |
| Inventory Engine | **Dipertahankan** | models/routes `barang`, `kategori`, `satuan`, `warehouse`, `rak`, `stock-opname`, `transfer`, `barang-gudang` |
| Purchasing Engine | **Dipertahankan** | models/routes `pembelian`, `retur-pembelian`, `supplier` |
| Customer & Sales Engine | **Dipertahankan** | models/routes `customer`, `sales`, `penjualan`, `retur-penjualan` |
| Reporting Engine | **Dipertahankan** | `laporan.js`, halaman `report/` |
| API Contract & Permission | **Dipertahankan** | `inventory.*` namespace tetap; POS menambah `pos.*` (additive) |
| Workspace, Dashboard, Sidebar, Branding, Logo, Layout | **Diubah** | baru di `apps/pos` |
| Workflow Penjualan, UX, Kasir Interface | **Diubah** | baru di `apps/pos` (inti POS Core) |

### 3.3 Target Struktur Repositori

```
apps/pos/                          ← clone apps/inventory (baru)
  index.html, vite.config.js, package.json (branding POS.e-Profit)
  server/
    index.js, db.js, env.js, security.js, seed.js
    models/     ← REUSE: import dari paket bersama / registry model (tidak duplikasi)
    routes/     ← REUSE auth/barang/penjualan/dll + routes baru POS (kasir-session, dsb)
  src/
    config/menu.js                 ← menu kasir (Dashboard, POS, Master, Laporan)
    pages/{dashboard,pos,barang,kategori,...}  ← halaman kasir + reuse master
    data/                          ← data services (API-first, fallback in-memory)
    router/, main.js, css/

apps/console/                      ← Master Platform (modifikasi, additive)
  server/models/Company.js         ← + businessType, lokasiConfig, jumlahKasir, lisensi
  src/pages/companies/             ← UI konfigurasi POS per perusahaan

platform/
  config/apps.yaml                 ← + entri `pos`
  config/nginx/pos.e-profit.id.conf ← template app-template.conf → certbot
  monitoring/server-info.txt       ← + POS

packages/smart-pos-ui/ (USULAN)    ← paket domain POS (kasir components/engine helper)
                                     atau reuse @smart/inventory-ui — keputusan M1
```

### 3.4 Siklus Kerja per Task (Golden Rule 16)

Setiap task engine mengikuti urutan:

```
Business Rules → Business Engine → Database → API → Workflow → User Interface → User Experience
       ↑              ↑              ↑         ↑        ↑            ↑               ↑
   (dokumen)     (pure function  (model +     (route +  (halaman,   (kasir screen, (responsif,
                 + unit test)    index)       service)  flow)       komponen)      sedikit klik)
```

---

## 4. Milestone & Task Breakdown

Legenda status: ⬜ planned · 🔄 in progress · ✅ done · ❌ blocked

### 4.0 M0 — Analisis & Baseline (sebelum coding)

Tujuan: memastikan baseline Inventory stabil & peta kloning jelas sebelum `apps/pos` dibuat.

| ID | Task | Deskripsi | Acceptance Criteria | Status |
|----|------|-----------|--------------------|--------|
| M0-1 | Audit baseline Inventory | Verifikasi engine inventory sehat: test, lint, build, smoke E2E | `npm test` hijau, build inventory ✓, production health 200 | ✅ |
| M0-2 | Peta reuse vs rewrite | Inventarisasi modul inventory yang di-reuse POS (tabel §3.2) | Dokumen `docs/pos/pos-execution-m0-reuse-map.md` disetujui PO | ✅ |
| M0-3 | [USULAN] Klarifikasi scope bab 4–18 roadmap | PO melengkapi/menyetujui ruang lingkup POS Core | Roadmap §4–18 terisi ATAU persetujuan scope usulan §9 | ⬜ |

**Artifacts:** `docs/pos/pos-execution-m0-reuse-map.md` · audit baseline di `docs/execution_status.md`

### 4.1 M1 — Clone & Branding (EPIC-001 Task 1)

Tujuan: `apps/pos` berdiri di monorepo, branding POS.e-Profit, seluruh fitur Inventory masih jalan.

| ID | Task | Deskripsi | Acceptance Criteria | Status |
|----|------|-----------|--------------------|--------|
| M1-1 | Scaffold `apps/pos` | Clone struktur `apps/inventory` → `apps/pos` (server + src), package.json rename `pos` | `apps/pos` build ✓, dev server jalan | ✅ |
| M1-2 | Branding POS.e-Profit | Workspace, topbar, sidebar, logo, login page → POS.e-Profit; warna/logo baru | Tidak ada teks "SMART Inventory" tersisa di UI `apps/pos` | ✅ |
| M1-3 | Reuse engine & domain | Ganti duplikasi dengan import framework `@smart/*` + domain `@smart/inventory-ui` | Tidak ada duplikasi BARU di luar konvensi platform (per-app server = konvensi console/inventory); test duplikat dihapus; entitlement POS pakai slug `pos` | ✅ |
| M1-4 | Verifikasi regresi | Test + lint + build inventory **tidak berubah** | Suite penuh hijau (test 762/762, build pos+inventory+console ✓, lint pos 0 error) | ✅ |
| M1-5 | [USULAN] Paket domain POS | Keputusan: buat `packages/smart-pos-ui` vs reuse `@smart/inventory-ui` | ADR singkat + keputusan tercatat | ✅ — keputusan: **reuse `@smart/inventory-ui`** (modular, additive; kasir components di `apps/pos`) — tercatat di Gap Report §1 & file impact map |

**Acceptance (roadmap):** project terkloning ✓ · fitur Inventory tetap jalan ✓ · branding POS.e-Profit ✓

### 4.2 M2 — Integrasi Master Platform (EPIC-001 Task 2–7)

Tujuan: POS hanya berjalan untuk perusahaan yang diaktifkan di `master.e-profit.id`; konfigurasi
perusahaan dibaca POS, tanpa menu "Tambah Perusahaan".

| ID | Task | Deskripsi | Acceptance Criteria | Status |
|----|------|-----------|--------------------|--------|
| M2-1 | POS baca Company ID & konfigurasi | POS membaca company dari Master (login → company aktif → sesi) | Login POS hanya untuk company aktif; tanpa menu Tambah Perusahaan (R4) | ✅ |
| M2-2 | Product Activation "POS" | Console: toggle akses aplikasi POS per company (reuse `Company.apps` + gate login/impersonation seperti M4 impersonation) | Company tanpa akses POS → 403 + audit (gate login user + impersonate, defense in depth) | ✅ |
| M2-3 | [USULAN] Business Type | Console `Company.businessType` (Retail/Cafe/Restaurant/Bakery/Pharmacy/...) + seed | Tersimpan & terbaca POS untuk konfigurasi awal | ✅ |
| M2-4 | [USULAN] Single / Multi Lokasi | Console konfigurasi lokasi; POS menyembunyikan Transfer Gudang & Pilih Gudang saat single | Single-lokasi: menu transfer tidak tampil (R17); pemilihan gudang per-halaman menyusul M3 | ✅ |
| M2-5 | [USULAN] Jumlah Kasir & Lisensi | Console: `jumlahKasir`, status lisensi (bisa terhubung ke entitlement M6 `pos`) | Konfigurasi tersimpan & tersedia di response login POS (enforcement kasir di M3, lisensi via entitlement M4) | ✅ |
| M2-6 | Sinkronisasi platform | `apps.yaml` + nginx + monitoring + registry `apps.config.js` diisi `pos` | Config source siap (`pos.e-profit.id.conf`, `apps.yaml`, monitoring entry); **deploy live nginx/certbot menunggu persetujuan** | ✅* |
| M2-7 | Backward compatibility | Semua perubahan di Console additive | Suite console & inventory hijau (test 783/783, build 3 app ✓, lint root tetap baseline) | ✅ |

**Acceptance (roadmap):** Company ID ✓ · License ✓ · konfigurasi perusahaan ✓ · tanpa "Tambah Perusahaan" ✓

**Tambahan (M3-FIX v6 / Console):** menu **Login As** di Console (Companies, master.e-profit.id) kini **generik multi-aplikasi** — bila company terhubung >1 aplikasi aktif (mis. PT-001: `[pos, inventory]`) muncul modal picker (pilih Inventory / SMART Kasir); 1 aplikasi → langsung impersonate; 0 aplikasi aktif → toast penjelasan. `startImpersonation` tidak lagi hardcode `inventory` (redirect ke `getAppEntryUrl(slug)`; pos → pos.e-profit.id). Server tidak berubah (`/impersonation-token` & `/impersonate` POS sudah generik).

### 4.3 M3 — POS Core MVP (Roadmap §6–13, [USULAN] — disetujui via mockup `kasir.html`)

Tujuan: **POS Core stabil** (R11). Urutan kerja mengikuti R16 (Engine → API → UI).
Tampilan kasir mengacu `shared/uploads/kasir.html` (3 kolom: Kategori · Produk · Bill).

| ID | Task | Deskripsi | Acceptance Criteria | Status |
|----|------|-----------|--------------------|--------|
| M3-1 | Workspace & Dashboard POS | Sidebar kasir (Dashboard, POS, Master, Laporan, Settings) — menu Kasir baru | Menu Kasir tampil utk role dgn `pos.kasir.use` | ✅ |
| M3-2 | Master Item POS | Reuse Barang + field `behavior` (`trading`/`service`) additive di `@smart/inventory-ui` + server | Item `behavior: service` tidak mengurangi stok (R9/R18) | ✅ |
| M3-3 | Transaction Engine (core) | Reuse `penjualan` + alur `sumber: "pos"` (langsung paid + KWT); helper pure `pos-transaction.js` + unit test | Penjualan Trading → stok berkurang; Service → stok tetap (teruji 7 test) | ✅ |
| M3-4 | Kasir Interface (UI) | Screen `pages/pos` (mockup kasir.html): kategori, katalog, keranjang, pajak toggle, bayar/kembalian | Kasir selesai transaksi ≤ 4 interaksi utama (R19) | ✅ |
| M3-5 | Checkout & Struk | Simpan via `POST /api/penjualan` (sumber pos); struk printable monospace | Struk tercetak, transaksi masuk DB (KWT-…) & activity log | ✅ |
| M3-6 | Role Kasir | Seed role `kasir` + permission `pos.kasir.use`; menu dibatasi | Role kasir hanya akses kasir (dashboard+baca barang) | ✅ |
| M3-7 | Retur & koreksi | Reuse `retur-penjualan` (sudah tersedia) — workflow kasir menyusul | Retur mengembalikan stok sesuai behavior | ✅ (M3-FIX v11: engine behavior-aware + `sumber=pos` + blokir void; UI kasir = T13 backlog) |

**Tambahan (M3-FIX v7 — PRD V1, semua CONFLICT C1–C5 disetujui PO 2026-08-10):**

- **T1 Barcode** — field `barcode` di Barang (model + form shared `@smart/inventory-ui` + kolom tabel) · search kasir by nama/SKU/barcode · scanner reuse `@smart/ui` BarcodeScanner (hasil scan langsung masuk keranjang)
- **T2 Metode bayar** — `metode_bayar` enum cash/transfer/qris/card (model + route + UI kasir + struk + laporan) — extensible
- **T3 Diskon & catatan** — diskon transaksi (Rp) + catatan transaksi di bill kasir; diskon tidak mengurangi basis pajak (keputusan PO)
- **T4 Void** — `POST /api/penjualan/:id/void` (permission `pos.transaction.void` — hanya Admin/Owner per C4) + reversal stok trading + audit trail; UI tombol Void di halaman Penjualan (injectable `voidPenjualan`, hanya muncul utk sumber=pos & paid)
- **T6 Shift** — model `Shift` baru + routes open/close/list + permission `pos.shift.*`; halaman Shift (buka/tutup, expected/actual/difference) + widget shift inline di layar kasir
- **T7/T8 Dashboard** — dashboard POS baru (`/api/pos/dashboard`): omzet hari ini, jumlah transaksi, produk terlaris, stok menipis, breakdown metode bayar, ringkasan shift, riwayat hari ini
- **T9 Reporting** — `GET /api/laporan/sales-breakdown` (by item/category/cashier/payment) + halaman Laporan Kasir
- **T10/T11 Behavior** — enum `recipe`/`manufactured`/`digital` di Barang; recipe dijual **tanpa kurangi stok** di V1 (C1); form Barang + badge Resep
- **C5 Pajak 11%** — toggle per transaksi `TAX_RATE = 0.11` (kasir page + engine `POS_TAX_RATE`)
- **C3 Role Kasir** — seed kasir + `inventory.customer.read`, `inventory.sales.read`, `pos.shift.open/close`

**Acceptance:** transaksi kasir end-to-end (pilih item → checkout → struk → stok update) ✓
terverifikasi via smoke test: `KWT-09082026-0001` (paid, pajak, bayar/kembalian) + stok
Aquaviva 200 → 199 setelah checkout 1 unit; jasa tidak mengurangi stok.

### 4.4 M4 — Payment & Reporting MVP (Roadmap §12–13, [USULAN])

| ID | Task | Deskripsi | Acceptance Criteria | Status |
|----|------|-----------|--------------------|--------|
| M4-1 | Payment MVP | Metode: Tunai, QRIS (manual), Transfer; catat pembayaran per transaksi | Pembayaran tercatat + laporan per metode | ✅ (T2) |
| M4-2 | Reporting Kasir | Reuse `laporan`: penjualan per shift/kasir/hari; laba kotor | Angka konsisten dengan transaksi DB | ✅ (T9) |
| M4-3 | [USULAN] Entitlement hook (opsional) | Jika diaktifkan, blokir transaksi POS saat entitlement `pos` habis (reuse `entitlement-check.js`) | Enforcement teruji tanpa merusak alur kasir | ⬜ |

### 4.5 M5 — Hardening, Verifikasi & Deploy Produksi

| ID | Task | Deskripsi | Acceptance Criteria | Status |
|----|------|-----------|--------------------|--------|
| M5-1 | Test lengkap | Unit test engine POS + smoke E2E (DB uji terpisah) | Suite penuh hijau + E2E POS lulus (contoh pola: `SP-029-M6-AUDIT.md`) | ⬜ |
| M5-2 | Lint & build | ESLint + build `apps/pos`, `apps/inventory`, `apps/console` | Lint 0 error, build semua ✓ | ⬜ |
| M5-3 | Deploy produksi | Build dist → nginx `pos.e-profit.id` → SSL certbot → PM2 restart → monitoring | `https://pos.e-profit.id` 200, health check POS hijau | ⬜ |
| M5-4 | Audit & laporan | Dokumen audit M1–M5 (pola `docs/SP-027-M5-AUDIT.md`) + update `docs/execution_status.md` | Laporan lengkap + status tercatat | ⬜ |
| M5-5 | Backup & rollback plan | mongodump sebelum deploy + prosedur rollback | Backup tersedia (pola `backups/`) | ⬜ |

---

## 5. Peta Dampak File (File Impact Map)

| Area | File / Folder | Perubahan | Milestone |
|------|---------------|-----------|-----------|
| Aplikasi POS | `apps/pos/**` (baru) | Clone + branding + workflow kasir | M1–M4 |
| Domain UI | `packages/smart-inventory-ui/` (atau `smart-pos-ui` baru) | Additive: kasir components | M1, M3 |
| Console — Company | `apps/console/server/models/Company.js` | + `businessType`, `lokasiConfig`, `jumlahKasir`, `lisensi` (additive) | M2 |
| Console — UI Company | `apps/console/src/pages/companies/index.js` | Form konfigurasi POS per company | M2 |
| Console — Aktivasi | `Company.apps` gate (existing dari impersonation M4) + audit `pos.denied` | Reuse + extend | M2 |
| Entitlement | `packages/smart-data` / inventory `services/entitlement-check.js` | Reuse, opsional hook POS | M4 |
| Registry | `platform/config/apps.yaml` | + `pos` | M2 |
| Nginx | `platform/config/nginx/pos.e-profit.id.conf` (template) | Baru + certbot | M2, M5 |
| Monitoring | `apps/console/server/monitoring/apps.config.js` | + POS (⚠️ registry statis — perlu sinkronisasi manual, temuan M5 console) | M2 |
| Deploy | `platform/deploy/nginx-deploy.sh` | Param domain `pos` | M2, M5 |
| Root scripts | `package.json` (root) | + `build:pos` (masuk `verify`) | M1 |

---

## 6. Sinkronisasi Platform (Rules 4–8)

| Aspek | Aturan | Implementasi |
|-------|--------|--------------|
| Company ID | R5 — satu ID | `x-company-code` + `SMART.Session.companyCode` (sudah ada) |
| Auth | R6 — satu auth | JWT access/refresh (M3 security), superadmin impersonation → POS |
| DB | R7 — satu arsitektur DB | MongoDB sama; tidak ada DB baru untuk POS |
| Konfigurasi | R4 — SSOT di master | Console adalah satu-satunya sumber konfigurasi perusahaan |
| Aktivasi produk | R17 — configuration driven | `Company.apps` + gate server; opsional entitlement `pos` (M6) |

Alur login POS (target):
```
User → login /api/auth/login (company aktif & POS aktif)
     → server cek Company.apps contains "pos" (403 + audit bila tidak)
     → sesi company → kasir screen
```

---

## 7. Definisi Done & Verifikasi

Per milestone wajib lulus (pola konsisten dengan milestone platform sebelumnya):

| Cek | Perintah / Metode | Target |
|-----|-------------------|--------|
| Unit test | `npm test` (vitest) | Suite penuh hijau, tidak ada regresi |
| Lint | `npm run lint` (per app) | 0 error |
| Build | `npm run build` (pos, inventory, console) | Semua ✓ |
| Smoke E2E | Skenario via curl/tmux dgn **DB uji terpisah** | Endpoint kunci 200/401/403 sesuai harapan |
| Produksi live | `health-check.sh` + curl domain | health 200, dist baru termuat |

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Roadmap bab 4–18 belum terisi | Scope ambigu, revisi berulang | M0-3: klarifikasi PO sebelum M3; scope usulan §9 sebagai dasar diskusi |
| Duplikasi engine saat clone | Dua sumber kebenaran, bug ganda | M1-3: wajib reuse framework/domain; review mencegah duplikasi |
| Perubahan shared code merusak Inventory | Backward compat hilang (R10) | Semua perubahan additive; full regression suite tiap milestone |
| Registry monitoring statis | POS tidak terpantau | M2-6 sinkronisasi `apps.config.js` manual + catat backlog otomatisasi |
| Entitlement/aktivasi bypass | Akses tanpa lisensi | Gate server (bukan hanya UI) + audit log (pola impersonation M4) |
| Kasir offline/intermittent | Transaksi gagal | Data service API-first + fallback in-memory (pola existing) |

---

## 9. Ruang Lingkup MVP vs Non-MVP (Usulan — tunggu PO)

### 9.1 MVP V1 (proposed)

1. Clone & branding POS.e-Profit (M1)
2. Integrasi Master Platform: Company ID, aktivasi, business type, single/multi lokasi, jumlah kasir (M2)
3. POS Core: dashboard kasir, master item + `behavior`, transaction engine, kasir interface, struk, role kasir, retur (M3)
4. Payment MVP (tunai/QRIS manual) + reporting kasir (M4)
5. Hardening & deploy produksi (M5)

### 9.2 Non-MVP / Backlog (roadmap §14 & §15)

| Fitur | Catatan |
|-------|---------|
| Recipe Engine | Nasi Goreng → kurangi bahan baku; desain `behavior` sudah siap (R14) |
| Kitchen Display System (KDS) | Roadmap berikutnya |
| Digital Product Engine | PPOB/Digiflazz (R18: digital behavior) |
| Accounting Integration | `acc.e-profit.id` |
| AI Assistant, Marketplace, Mobile POS | Roadmap berikutnya |
| Payment gateway (midtrans/dll) | Perlu riset layanan pihak ketiga saat tiba waktunya |
| Persistence deployment queue, multi-payment | Backlog platform yang sudah tercatat di `execution_status.md` |

---

## 10. Checklist Freebuff (Roadmap §18)

- [x] **M0** Baseline audit & reuse map disetujui
- [x] **M0-3** Scope bab 4–20 roadmap diklarifikasi PO (PRD lengkap + Gap Report + approval CONFLICT 2026-08-10)
- [x] **M1** `apps/pos` terkloning, branding POS.e-Profit, tanpa duplikasi engine
- [x] **M2** Login POS hanya untuk company aktif + terhubung aplikasi POS
- [x] **M2** Konfigurasi perusahaan (business type, lokasi, kasir, lisensi) terbaca dari Console
- [x] **M2** `pos.e-profit.id` live + terpantau monitoring + tampil di Console
- [x] **M3** Transaksi kasir end-to-end (item → checkout → struk → stok) dengan behavior trading/service
- [x] **M3** Role kasir dibatasi, tanpa akses pengaturan sensitif
- [x] **M3-FIX v7** TODO V1: barcode+scanner, metode bayar, diskon/catatan, void (admin), shift (model+routes+UI+widget kasir), dashboard POS, laporan kasir, behavior recipe, pajak 11%
- [x] **M3-7** Retur & koreksi transaksi kasir — reuse `retur-penjualan`: engine behavior-aware stok (hanya trading), dukungan `sumber=pos` (KWT), validasi qty & blokir void, DELETE reversal behavior-aware; definisi Void vs Retur vs Koreksi di PRD §7.8.1 + dokumen `docs/pos/pos-retur-koreksi.md` (Business Rules/UI Flow/DB/API/AC). Workflow tombol Retur di layar kasir = T13 (backlog P3)
- [x] **M4** Payment (cash/transfer/qris/card) & reporting kasir (sales-breakdown by item/category/cashier/payment) konsisten dengan transaksi
- [x] **M5** Suite penuh hijau (841/841), lint 0, build 3 app ✓, smoke E2E lulus
- [x] **M5** Deploy produksi + backup + audit report + update `execution_status.md` (live pos/inv/master 200; audit v0.17)
- [x] Seluruh fitur didokumentasikan (Business Rules, UI Flow, DB Impact, API Impact, AC) — contoh: `pos-retur-koreksi.md`, `pos-gap-report-v1.md`

### 10.2 Template Dokumen per Fitur (Golden Rule 12)

Setiap fitur baru wajib menyertakan bagian berikut (dalam satu dokumen `docs/pos/<fitur>.md`):

```
## Business Rules      — aturan bisnis eksplisit (contoh: service → stok tidak berkurang)
## UI Flow             — alur layar, interaksi, states
## Database Impact     — model/field/index yang berubah (wajib additive)
## API Impact          — route baru/perubahan, kontrak request/response, status code
## Acceptance Criteria — kondisi lulus yang bisa diverifikasi
```

---

## 11. Log Revisi

> **Pemecahan dokumen (v0.45, 2026-08-14):** entry log lengkap v0.1 – v0.43 dipindah
> ke file bagian agar dokumen utama tetap ringkas dan mudah dibaca:
>
> - `docs/pos/pos_execution_1.md` — **Log Revisi — Bagian 1**: entry v0.19 – v0.43
>   (2026-08-10 s.d. 2026-08-13 — M3-FIX v17+ & M6/M6.2-FIX: kuota role-aware, Nota,
>   Member NFC, responsive HP/tablet, Framework First @smart/core, dua model resep,
>   Dijual/Tidak Dijual, Produk VARIAN, VARIAN SKU marketplace)
> - `docs/pos/pos_execution_2.md` — **Log Revisi — Bagian 2**: entry v0.1 – v0.18
>   (2026-08-09 s.d. 2026-08-10 — M0–M5: clone & branding, integrasi Master Platform,
>   POS Core, retur & koreksi, enforcement Company, audit final V1, Hold/Resume)
>
> Entry terbaru (v0.44 ke atas) dicantumkan **penuh** di bawah ini.

| Versi | Tanggal | Penulis | Deskripsi |
|-------|---------|---------|-----------|
| 0.45 | 2026-08-14 | Freebuff | **M6.2 — F&B Recipe/BOM Engine (SP-029 POS V1)** — implementasi engine F&B penuh (status M6.1 + M6.2 DONE di `M6-CAPABILITY-RECIPE.md`). Engine-first (R16): (1) **Dua model resep** — behavior `recipe` (simple: dijual TANPA kurangi stok produk, bahan TIDAK dikonsumsi realtime — penyesuaian via stok opname) vs `recipe-fnb` (terhubung: bahan dikonsumsi REALTIME saat transaksi via engine BOM); enforcement server: `validateRecipePayload` tolak produk `recipe` (simple) 400 + `applyRecipeConsumption` lewati produk simple (konsumsi realtime hanya `recipe-fnb`/ber-recipe) + `NO_STOCK_BEHAVIORS` + `recipe-fnb` (M6.2-FIX v0.25). (2) **Model** — `Recipe` (companyCode, productId, snapshot productKode/productNama, name, description, `harga` varian [0 = fallback harga_jual produk], version, status draft/active/archived, ingredients[{itemId,kode,nama,quantity,unit}], unique index (companyCode, productId, version)) + `RecipeConsumption` (saleId, saleNomor, productId, productKode/Nama, recipeId, quantity, snapshot ingredients, status applied/reversed, unique index (saleId, productId, recipeId) = **idempotency protection** anti konsumsi ganda). (3) **Engine pure** `services/recipe.js` — `calculateRecipeConsumption` (ingredient.quantity × qty, round 4 desimal anti float noise: 2 telur × 3 = 6; 0.2 kg × 3 = 0.6), `calculateRecipeCost` (Σ qty × cost [harga_beli item]; totalCost/costPerServing = null bila ada ingredient tanpa cost reliable — jangan mengarang), `validateRecipeIngredients` (item wajib ada, qty > 0, tanpa duplikat itemId, unit konsisten dgn satuan item, minimal 1 ingredient), `validateRecipePayload` (produk wajib ada + nama wajib). (4) **API** `/api/recipes` — seluruh endpoint di-gate `requireTransactionType("fnb")` (Recipe/BOM tidak boleh dipakai bila F&B nonaktif); GET /, GET /:id, GET /:id/cost, POST /, PUT /:id, POST /:id/duplicate, DELETE /:id, POST /:id/activate, POST /:id/archive — POST/PUT/duplicate/delete/activate/archive wajib permission `pos.recipe.manage` (seed + fallback + katalog permission; **kasir TIDAK** diberi — kasir hanya memakai hasil recipe lewat transaksi); lifecycle langsung aktif (konsep draft dihapus dari UX), edit in-place, duplicate "(copy)" langsung aktif, delete = hard delete (log RecipeConsumption simpan snapshot → reversal void tetap aman). (5) **Produk VARIAN** (M6.2-FIX v0.42) — satu produk boleh punya BANYAK recipe aktif = varian (mis. Kopi Susu Manis "Pake Gula"/"Tanpa Gula"); item transaksi simpan `recipeId` varian; konsumsi memakai ingredient recipe varian tsb (fallback recipe aktif pertama utk data lama); unique index konsumsi per recipeId → 2 varian produk sama dalam 1 transaksi KEDUANYA dikonsumsi; kasir modal **Pilih Varian** (nama + harga masing-masing; nama item "Produk (Varian)" di keranjang/struk). (6) **Integrasi stok** — `POST /api/penjualan` (sumber pos) → `applyRecipeConsumption`: skip produk tanpa recipe aktif (perilaku Retail existing TIDAK berubah), hitung konsumsi, kurangi stok ingredient (pola stock mutation existing: scoped company + gudang transaksi, best effort + log error), tulis RecipeConsumption idempotent; Hold draft TIDAK mengonsumsi; `POST /:id/void` → `revertRecipeConsumption` (kembalikan stok ingredient + status `reversed`; aman karena void hanya dari `paid` — tidak bisa void 2×). Item Penjualan + `productId`/`recipeId` (additive; data lama tanpa field tetap valid — fallback cocokkan productKode). (7) **Client** — halaman **Master → Recipe F&B** (`apps/pos/src/pages/recipe/` + `data/recipe-data.js`): list/detail/cost, form (produk dropdown HANYA `recipe-fnb` + produk ber-recipe — backward compat), action icon Edit/Duplikat/Hapus, field Harga Varian; kasir badge/no-stock utk `recipe-fnb`. (8) **Test** — `recipe.test.js` (32: konsumsi 2×3=6 & 0.2×3=0.6, qty 0/negatif ditolak, cost 7400 = 2×2500 + 0.2×12000, cost null, duplikat ingredient ditolak, item tak ada ditolak, unit tak konsisten ditolak, minimal 1 ingredient, integrasi idempotency/skip/reversal, varian by recipeId, 2 varian 1 transaksi) + `barang-stok.test.js` (5) + `kasir-sku-price.test.js` (4). Verifikasi: **full suite 966/966 (54 files)**, lint 0 error (298 warning baseline pre-existing), build pos+inventory+console ✓. Dokumen: `docs/pos/M6-CAPABILITY-RECIPE.md` (status M6.1 DONE + M6.2 DONE; scope sengaja TIDAK mencakup M6.3 Table/Order, M6.4 KDS, M6.5 QR Ordering — fondasi sudah siap). |
| 0.44 | 2026-08-14 | Freebuff | **M6.1 — Transaction Capability Foundation (SP-029 POS V1)** — admin menentukan **jenis transaksi yang boleh dilakukan kasir** (capability array, BUKAN boolean terpisah); enforcement di backend, bukan hanya hide/show UI. (1) **Framework First** — registry `packages/smart-core/src/transaction-types/transaction-types.js` jadi SATU-SATUNYA sumber kebenaran (dipakai Console admin, POS server validasi & gate, POS client filter menu/route — tidak di-hard-code di banyak file): `TRANSACTION_TYPES` (7 capability: retail/fnb/service/ppob/preorder/reservation/membership, metadata {key,label,description}), `DEFAULT_TRANSACTION_TYPES=["retail"]` (default V1 backward compat), `validateTransactionTypes` (ketat: unknown/duplikat → ditolak, array kosong diperbolehkan), `normalizeTransactionTypes` (toleran read path), `isTransactionTypeEnabled`, `filterMenusByTransactionTypes`; diekspor via `@smart/core` index.js. (2) **Database** — `Company.transactionTypes: [String]` default `["retail"]` di model Console **dan** POS (DB bersama, additive; company lama tanpa field → fallback `["retail"]` di 4 lapisan: schema default, normalizeCompanyConfig server, normalize client, helper). (3) **Console** — `GET /api/companies/transaction-types` (katalog publik), POST/PUT `/api/companies` validasi ketat `validateTransactionTypes` (unknown/duplikat → 400, kosong diizinkan) + `COMPANY_UPDATE_FIELDS` + `transactionTypes` (regression guard pola v14), UI Edit Perusahaan bagian **"Jenis Transaksi Kasir"** (checkbox Switch per capability, label + description dari registry) + badge di detail modal; `normalizeCompanyConfigFields` ikut menormalkan (dedupe+urut bila valid). (4) **POS server** — `services/transaction-capability.js`: `getCompanyTransactionTypes` (fallback default V1), middleware `requireTransactionType(type)` → **403** bila capability nonaktif (dipakai `POST /api/penjualan` → `retail`; seluruh endpoint recipe → `fnb`), `parseTransactionCapabilitiesPayload` (terima DUA bentuk: kanonik `{transactionTypes:[...]}` & object boolean `{retail:true,...}` — keduanya dinormalisasi ke array); routes `pos-config.js`: GET/PUT `/api/pos/config/transaction-types` (kanonik) + alias `/transaction-capabilities` + `/api/pos/settings/transaction-capabilities` (PUT wajib permission `settings.company.edit`); `kasir-data` kirim `transactionTypes`; middleware `companyScope` pastikan admin hanya ubah capability company miliknya. (5) **POS client** — `config/company-config.js` normalize client + `isTransactionTypeEnabled`; menu sidebar filter `filterMenusByTransactionTypes` (item ber-field `capability` hanya tampil bila aktif); router `navigate()` menolak route yang capability-nya nonaktif → pesan "Jenis Transaksi Tidak Aktif" (akses langsung via URL pun diblokir); halaman baru **Settings → Capability Transaksi** (`pages/settings/capability/`, permission `settings.company.edit`, checkbox dari registry, state loading/error/success via API — bukan localStorage). (6) **Test** — `packages/smart-core/__tests__/transaction-types.test.js` (25: katalog ≥7 & unik, default V1, validate ketat, normalize toleran, filter menu), `apps/pos/server/__tests__/transaction-capability.test.js` (24: fallback company lama, normalize dedupe/unknown, requireTransactionType 403/next, parse payload 2 bentuk + invalid), `apps/console/server/__tests__/transaction-capability.test.js` (12: COMPANY_UPDATE_FIELDS + transactionTypes, normalize, katalog, validasi ketat POST/PUT). Verifikasi: **full suite 966/966 (54 files)**, lint 0 error (298 warning baseline pre-existing), build pos+inventory+console ✓. Dokumen: `docs/pos/TRANSACTION-CAPABILITY-V1.md`. Backward compat: selama `retail` tetap diaktifkan tidak ada perubahan perilaku retail existing. |

---

## Lampiran — Ringkasan EPIC-001 (dari roadmap)

| Task | Inti | Milestone |
|------|------|-----------|
| 1. Clone SMART Inventory | `apps/pos` + branding POS.e-Profit | M1 |
| 2. Integrasi Master Platform | POS baca company, tanpa buat company | M2 |
| 3. Company Configuration | Konfigurasi perusahaan di Console | M2 |
| 4. Product Activation | Aktivasi produk terpisah (☑ POS) | M2 |
| 5. Business Type | Enum + pengaruh konfigurasi awal | M2 |
| 6. Single/Multi Lokasi | Sembunyikan/aktifkan transfer & pilih gudang | M2 |
| 7. Product Configuration | Pusat konfigurasi produk | M2 |
