# Execution Status

| Roadmap   | Task                                  | Status | Date       | Notes                                                                 |
|-----------|---------------------------------------|--------|------------|-----------------------------------------------------------------------|
| **POS.e-Profit + Inventory** | **Sinkronisasi Laporan & Settings — Kop Cetak Lengkap, Company Profile Server, Sidebar Accordion, Laporan Sub-menu** | ✅ | 2026-08-21 | Perubahan lintas POS & Inventory (pos_execution.md **v0.47**): **(1) Settings Company Inventory** — server `/api/company-profile` (GET/PUT, full data: nama/alamat/telp/email/logo via DB bersama), route baru `apps/inventory/server/routes/company-profile.js` + register di `index.js`, `identityLocked: true` (code/name readonly diatur Console), client `settings-data.js` fetch dari server inventory (bukan Console). **(2) Laporan Sub-menu** — menu Laporan di sidebar jadi group dengan 9 children (Stok/Pembelian/Penjualan/Nilai Inventori/Mutasi/Supplier/Customer/Laba-Rugi/Piutang), setiap child route render `LaporanPage` dengan `setActiveTab()` (no-DOM), tabs disembunyikan (`hideTabs: true`). **(3) Judul Laporan Dinamis** — `TAB_TITLES` mapping (📦 Laporan Stok, 🛒 Laporan Pembelian, 💰 Laporan Penjualan, dst), header update via `renderContent()` + `setActiveTab()`. **(4) Laporan Kasir POS Fix** — fix data kosong (selector `.laporan-page` bukan `.page-container`), default tanggal 1→hari ini, fix double print (hapus `<script>window.print()>`), kop cetak lengkap via `apiCall("GET", "/company-profile")` (server POS, full data). **(5) Semua Laporan POS & Inventory** — `getCompanyInfo()` di 8 file berubah dari `getCompanyByCode()` (Console API, payload ringan) ke `apiCall("GET", "/company-profile")` (server sendiri, data lengkap). **(6) Hapus `<script>window.print()>`** dari `buildPrintHTML` + `printValue` di shared LaporanModule (single print via `printToWindow`). **(7) POS Theme** — logo/color → `#3b4e9f` (indigo) di manifest + meta theme-color. **(8) Inventory Sidebar** — accordion toggle (Master/Transaksi), logout icon SVG Feather. Verifikasi: test **1100/1100**, build pos+inv ✓, deploy live pos.e-profit.id + inv.e-profit.id 200. |
| **POS.e-Profit** | **SP-029 POS V1: F&B Customer Ordering V1 (M6.3 Table/Order + M6.4 KDS + M6.5 QR Ordering)** | ✅ | 2026-08-17 | Implementasi penuh alur customer-to-kitchen di atas fondasi M6.1/M6.2 (pos_execution.md **v0.46**, entry lengkap `docs/pos/pos_execution_3.md`): **(1) M6.3 Table & Order Management** — model `QrTable` (QR meja PERMANEN `https://pos.e-profit.id/m/{qrIdentifier}`, dibuat sekali) + `TableOrder` (orderNumber sequential, orderToken secret customer, paymentStatus pending/paid + confirmationMethod manual, kitchenStatus new→preparing→ready→served/collected/cancelled, refundStatus none/pending/refunded, hasKitchenItems/kitchenItems, itemId per baris utk cancel parsial); routes `/api/qr-tables` (pos.qr.manage) & `/api/table-orders` (list/detail/confirm-pay/kitchen/refund — pos.order.view/pos.order.confirm); halaman admin QR Menu Meja (generate/preview/cetak QR) + Order Meja embedded di layar kasir. **(2) M6.4 KDS** — routes `/api/kitchen` (orders/status/cancel/cancel-items — pos.kitchen.view/update), role **CHEF** baru (hanya kitchen, RBAC server-side), service pure `order-cancel.js` (refund parsial + pajak proporsional), halaman Kitchen grid live (auto-refresh 15s + bell + audio). **(3) M6.5 Customer QR Ordering** — routes PUBLIK `/api/qr` (menu/:identifier, orders, orders/:orderToken, orders/:orderToken/proof) — resolve tenant dari qrIdentifier, **harga dihitung server** (client tidak dipercaya), gate `fnb`; halaman mobile `/m/` tanpa login (menu/cart/payment/status live polling 10s, Web Push "pesanan siap", upload bukti, checkout via WhatsApp). **(4) Payment Proof V1** — model `PaymentProof` + `/api/payment-proofs` (pending/approve/reject — verifikasi MANUAL kasir, order TIDAK otomatis lunas). **(5) Role-Based Notification bell** — model `Notification` (targetRole cashier/kitchen) + `/api/notifications` (role-separated, polling 15s). **(6) Web Push** — `PushSubscription` (per company+order+endpoint — browser bisa terikat banyak order, ensurePushIndexes drop legacy index) + `/api/push` + service `web-push.js` (VAPID cache file, payload ikon PWA statis anti-413, klasifikasi error delete/413/retryable) + sw.js. **(7) WhatsApp Notify** — service `wa-notify.js` (Sidobe gateway, E.164, pesan per event received/preparing/ready/paid/cancelled/items_cancelled/refunded + rekening aktif) + Settings → Konfigurasi WA (GET/PUT `/api/pos/settings/wa` + POST /test; secret tidak dikembalikan). **(8) Company Payment Settings** — `CompanyQris` (1/company) + `BankAccount` (maks 3 aktif) + `/api/company-payment` (settings.company.edit) + halaman Payment Settings. **(9) Company Profile fix** — `/api/company-profile` baca/tulis via server POS (token POS ditolak console — audience isolation; DB sama), code/name tetap diatur Console. **(10) Shift Refund** — `computeShiftRefunds` (refundedBy/refundedUsername scoped per-kasir, refundTunai subset cash); tutup shift: totalPenjualan = bruto − totalRefund, expectedCash = kasAwal + penjualanTunai − refundTunai. **(11) PWA & misc** — manifest kasir/QR-menu/tablet (+ `?tab=1` landscape), icons, sw.js, logout SVG, check-duplicate kode Barang scoped per gudang, menu F&B + Settings baru (capability fnb). Verifikasi: **full suite 1099/1099 (61 files)** (+133 test dari 966/54: notification 17, web-push 21, wa-notify 39, whatsapp 19, payment-proof 12, qr-menu 18, order-cancel 7, dst), lint 0 error (warning baseline), build pos+inventory+console ✓. Backlog tersisa butuh approval PO: **T13 Retur dari layar kasir**. |
| **POS.e-Profit** | **SP-029 POS V1: M6.1 Transaction Capability + M6.2 F&B Recipe/BOM Engine** | ✅ | 2026-08-14 | Implementasi dua milestone (pos_execution.md **v0.45**): **(1) M6.1 Transaction Capability Foundation** — registry `packages/smart-core/src/transaction-types/transaction-types.js` jadi SATU-SATUNYA sumber kebenaran (7 capability: retail/fnb/service/ppob/preorder/reservation/membership, `DEFAULT_TRANSACTION_TYPES=["retail"]`, `validateTransactionTypes` ketat [unknown/duplikat → 400, kosong diizinkan], `normalizeTransactionTypes` toleran, `isTransactionTypeEnabled`, `filterMenusByTransactionTypes` — diekspor `@smart/core`); field `Company.transactionTypes: [String]` default `["retail"]` di model Console & POS (DB bersama, additive; company lama tanpa field → fallback V1 di 4 lapisan); Console: `GET /api/companies/transaction-types` (katalog publik) + validasi ketat POST/PUT `/api/companies` + UI Edit Perusahaan bagian "Jenis Transaksi Kasir" (checkbox Switch per capability) + badge detail; POS server: `services/transaction-capability.js` (`getCompanyTransactionTypes`, middleware `requireTransactionType(type)` → 403, `parseTransactionCapabilitiesPayload` dua bentuk payload) + routes `pos-config.js` (GET/PUT `/api/pos/config/transaction-types` kanonik + alias `/transaction-capabilities` + `/api/pos/settings/transaction-capabilities`, PUT wajib permission `settings.company.edit`); gate `requireTransactionType("retail")` di `POST /api/penjualan` + `requireTransactionType("fnb")` di seluruh endpoint recipe; POS client: filter menu/route by capability (router tolak "Jenis Transaksi Tidak Aktif") + halaman Settings → Capability Transaksi (`pages/settings/capability`). **(2) M6.2 F&B Recipe/BOM Engine** — dua model resep: `recipe` (simple, TANPA konsumsi realtime — stok opname) vs `recipe-fnb` (terhubung, konsumsi REALTIME); model `Recipe` (ingredients[{itemId,kode,nama,quantity,unit}], harga varian, version, status, unique (companyCode,productId,version)) + `RecipeConsumption` (unique (saleId,productId,recipeId) = idempotency anti konsumsi ganda); engine pure `services/recipe.js` (`calculateRecipeConsumption` round 4 desimal, `calculateRecipeCost` null bila cost tak reliable, `validateRecipeIngredients`); API `/api/recipes` (GET /, /:id, /:id/cost, POST, PUT, duplicate, DELETE, activate, archive — permission `pos.recipe.manage` Admin/Owner; kasir TIDAK); Produk VARIAN (M6.2-FIX v0.42): beberapa recipe aktif per produk = varian, item simpan `recipeId`, kasir modal Pilih Varian, konsumsi per varian; integrasi stok: `POST /api/penjualan` → `applyRecipeConsumption` (skip produk tanpa recipe / simple, idempotent, best effort) + void → `revertRecipeConsumption` (kembalikan stok ingredient + status reversed); item Penjualan + `productId`/`recipeId` (additive); client halaman **Master → Recipe F&B** (`pages/recipe`). Verifikasi: **full suite 966/966 (54 files)** — +61 test baru (transaction-types 25, pos transaction-capability 24, console transaction-capability 12; recipe 32, barang-stok 5, kasir-sku-price 4) — lint 0 error (298 warning baseline pre-existing), build pos+inventory+console ✓. Dokumen: `docs/pos/TRANSACTION-CAPABILITY-V1.md` + `docs/pos/M6-CAPABILITY-RECIPE.md` (status M6.1 DONE + M6.2 DONE; M6.3 Table/Order, M6.4 KDS, M6.5 QR Ordering = backlog terpisah). Log revisi pos_execution.md kini dipecah: `pos_execution_1.md` (v0.19–v0.43) & `pos_execution_2.md` (v0.1–v0.18). |
| **POS.e-Profit** | **M6-FIX v7: Refactor Framework First (util global & scanner)** | ✅ | 2026-08-13 | Perbaikan global dipindah ke framework smart platform (prinsip Framework First — fitur lintas aplikasi harus di `@smart/*`, bukan duplikat per-app): (1) **`@smart/core` Utils baru** — `packages/smart-core/src/utils/format.js` (`formatRupiah`/`formatNumber`/`formatDecimal`/`parseIdNumber`) & `utils/escape.js` (`esc`/`escHtml`/`escAttr`), export via index.js core + facade `SMART.Utils`; (2) **`formatRupiah` app → framework** — `barang-data.js` (pos & inv) re-export dari core (17+ pemakai tak berubah); (3) **`esc` disatukan** — ~18 definisi lokal dihapus (halaman app pos/inv/console + framework modules settings/auth/master-crud/smart-inventory-ui) → import dari `@smart/core`; (4) **anti double-read scan kamera pindah ke class `BarcodeScanner`** (`_dedupeMs=1500`) — titik terendah yang dilalui semua pemakai (kasir, member, master barang pos/inv, pembelian, penjualan/SO, transfer); `attachScanner` kembali polos. Verifikasi: test **864/864**, build pos+inventory+console ✓, 0 duplikat tersi Bu disa, lint hanya baseline pre-existing, perilaku identik (refactor struktural). **Batch 2 (deploy + audit lanjutan)**: deploy 3 domain — live `index-BrxL5m4i.js` (pos), `index-rOdn8Wrj.js` (inv), `index-BxKTUFvo.js` (master), bundle byte-identik dengan dist (diff 0), health **200/200/200**; util date/number global baru di `@smart/core` (`formatRupiahID`, `formatThousand`/`unformatThousand`, `formatDate`/`formatDateID`/`formatDateTime`/`timeAgo` via `SMART.Utils`), ~8 definisi duplikat dihapus di penjualan/transfer/pembelian/laporan/inventory page/console `_shared.js` — test **864/864**, build 3 app ✓, 0 definisi lokal tersisa, lint baseline. Dokumen: `docs/pos/pos_execution.md` v0.42, `docs/Roadmap_smartplatform.md` (section Framework First + smart-core Utils). |
| **POS.e-Profit** | **M0: Baseline & Reuse Map** | ✅ | 2026-08-09 | Audit baseline: test **762/762** ✓, build inventory+console ✓, lint root 20 error pre-existing (`packages/smart-ui`, bukan dari perubahan POS). Temuan: `apps/inventory` nested git repo (file tidak ikut dipindai root lint); satu DB `smart_inventory` untuk seluruh platform; konvensi dependency server per-app (`server/node_modules` lokal); registry Console sudah mengenal aplikasi `pos` (logo slug tersedia). Dokumen: `docs/pos/pos-execution-m0-reuse-map.md`. M0-3 (klarifikasi scope roadmap bab 4–18 oleh PO) masih ⬜ — blokir M3. |
| **POS.e-Profit** | **M1: Clone & Branding `apps/pos`** | ✅ | 2026-08-09 | `apps/pos` = clone `apps/inventory` (rsync tanpa `.git`/`node_modules`/`dist`/`.env`) sebagai **bagian root repo** (pola console, bukan nested git). Branding POS.e-Profit via **override lokal** — framework & `@smart/inventory-ui` TIDAK diubah (R3/R10): workspace `pos` additive di `@smart/ui/src/workspaces/`, `POS_INSTITUTION` di main.js, wrapper login (title/subtitle), dashboard `appName`, sidebar hijau emerald, server `pos-api` port 3003, Vite 5175 (proxy `/api`→3003), `server/.env.example`, root script `build:pos` masuk `verify`. Reuse: `@smart/inventory-ui` + framework utuh; test duplikat entitlement dihapus (di-cover inventory); fix lint `window.confirm` (4×) di halaman inventory POS. Verifikasi: build pos ✓ 1.14s, inventory ✓, console ✓; test **762/762**; lint pos **0 errors** (root tetap 20 pre-existing, tanpa tambahan dari pos); deps server pos ter-install lokal (113 pkg, pola console/inventory). |
| **POS.e-Profit** | **M2: Integrasi Master Platform** | ✅ | 2026-08-09 | (1) **Product Activation** — `Company.apps` jadi gate **login user** POS (bukan hanya impersonation): `apps/pos/server/services/company-config.js` (`companyHasAppAccess`, `normalizeCompanyConfig`, `filterMenusByLokasi` — pure), gate 403 + audit `failedLogin(metadata.app_not_connected)` di `routes/auth.js` login; `impersonate` fallback app `pos` + `companyConfig` di response. (2) **Konfigurasi Produk** (Rule 17, additive di `Company` model): `businessType` (katalog `config/business-types.js` 12 tipe + route `GET /api/companies/business-types` + `normalizeCompanyConfigFields` whitelist/clamp di POST/PUT), `lokasiMode` single/multi, `jumlahGudang`, `jumlahKasir`, `lisensiStatus`/`lisensiExpiresAt`; seed `COMPANY_SEED` PT-001 (apps inventory+pos, Jasa, single, 2 kasir) & CMP-002 (multi) + aplikasi `pos` di `APPLICATION_SEED` aktif (workspace `pos`, domain pos.e-profit.id). (3) **UI Companies**: dropdown Business Type + Mode Lokasi + Jumlah Gudang/Kasir + Status Lisensi di modal Edit (server-first via `listBusinessTypes`, fallback `BUSINESS_TYPES` client) + detail modal menampilkan config. (4) **POS client**: `companyConfig` disertakan di response login/impersonate → sessionStorage `smart_company_config` → `filterMenusByLokasi` (single → sembunyikan Transfer Gudang) di renderApp & refreshSidebarMenus. (5) **Registrasi platform**: `apps.yaml` + `platform/config/nginx/pos.e-profit.id.conf` (static dist + bridge platform 3002 + API 3003, HTTP + komentar certbot — **belum di-deploy**, produksi menunggu persetujuan) + monitoring registry `pos` (inactive sampai M5). Verifikasi: test **784/784** (22 baru: pos company-config 14 + console companies-config 8), lint root tetap 20 baseline, build pos+inventory+console ✓. |
| **POS.e-Profit** | **M3-FIX v2: Foto Produk + Rebrand SMART Kasir** | ✅ | 2026-08-09 | Umpan balik user: (1) **Foto Produk** — Master Barang (modul shared `packages/smart-inventory-ui`): field upload gambar di form (pilih file → **kompresi client-side** canvas JPEG maks 500px q0.75 → data URI, latar putih utk PNG transparan, validasi tipe/3MB, preview + tombol Hapus, baseline foto lama dipertahankan agar tidak terhapus saat edit tanpa ubah gambar) + **kolom Gambar** (thumbnail) di tabel desktop, card mobile, & baris Foto di modal Detail; model `Barang` inventory + field `foto` (additive, konsisten POS); foto tampil di **layar kasir** (kart produk `<img>` — kasir-data sudah melewatkan `foto` sejak M3). (2) **Rebranding** — judul app & tab browser **SMART Kasir** (URL tetap pos.e-profit.id): `index.html`, `main.js` (POS_INSTITUTION, document.title), login wrapper, dashboard appName, header struk (SMART KASIR), server log, `.env` APP_NAME, workspace `pos` (label/appTitle/topbarTitle), registry Console (`APPS_REGISTRY` + seed aplikasi/feature) & smart-core; DB live di-rename via mongosh (`applications` & `features` slug=pos → SMART Kasir). Verifikasi: lint 0 error baru (baseline 20 tetap), test **794/794**, build pos+inventory+console ✓; **live**: title `SMART Kasir` ✓, bundle baru ✓, health 200 ✓, foto ter-set di produk Aquaviva & dibaca kasir-data ✓. Catatan: password user demo `kasir` tidak lagi `Kasir@2026!` (diubah pemakai) — tidak di-reset tanpa izin. **M3-FIX v3 (umpan balik user)**: (1) header kasir menampilkan `[nama kasir] - [Nama Perusahaan]` — nama company di-fetch non-blocking via `getCompanyByCode` (SSOT Console, fallback kode) — sub tampil mis. `Kasir - PT. Smart Vision Indotama`; (2) warna kasir disamakan dgn shell admin: panel kategori jadi gradient emerald `#064e3b→#059669` (sama dgn sidebar admin), header pakai `var(--topbar-bg)`/`var(--topbar-text)` (putih+emerald light mode, ikut gelap dark mode), tombol Logout emerald gradient. Verifikasi: lint 0 error baru, test kasir-page 3/3 (full 794/794), build ✓, bundle `index-C-tYeUco.js` live (page 200, health 200, title SMART Kasir). **M3-FIX v4 (3 suggested)**: (1) **Logo perusahaan di header kiri kasir** — fetch `company.logo` via `getCompanyByCode` (non-blocking, fallback emoji 🧾, onerror kembali ke emoji, alt=nama company); (2) **Dark mode penuh halaman kasir** — blok `[data-theme=dark]` overrides area produk/bill/kart/input/pager/badge mengikuti palet admin (content-bg `#0f172a`, card `#1e293b`, input `#334155`, border `#475569`); header sudah tema-aware via `var(--topbar-bg)`, panel kategori tetap gradient emerald (sama dgn sidebar admin); (3) **E2E live login kasir** dgn password aktual: login **200** + token, kasir-data 11 produk/7 kategori/1 foto, permission kasir `[inventory.dashboard.view, pos.kasir.use, inventory.barang.read]`. Bundle `index-uHzis48y.js` live, lint 0 error baru, test kasir-page 3/3 (full 794/794), page 200, health 200. **M3-FIX v5 (umpan balik user)**: (1) topbar kasir **kembali hijau gradient emerald** `#064e3b→#059669` selaras sidebar (bukan putih) — font putih, sub/hint putih transparan, **tombol Logout kontras** (border putih 0.55, bg putih 0.16) agar tidak menyatu latar, logo border putih; (2) judul h1 `Kasir` → **`SMART Kasir`**; (3) **favicon tab browser = logo admin** — `setKasirFavicon` pakai `company.logo` (via getCompanyByCode), fallback `smart_superadmin_logo` (di-hoist ke luar cek company, pola renderApp). Bundle `index-CE3K-l5O.js` live, lint 0 error baru, test kasir-page 3/3, page 200, health 200. |
| **POS.e-Profit** | **M3: POS Core (Kasir) + Deploy staging** | ✅ | 2026-08-09 | Implementasi mengikuti mockup `shared/uploads/kasir.html`. (1) **Behavior trading/service** — `Barang.behavior` + `foto` (additive), item jasa BRG-013/BRG-014 di seed; form Master Barang + badge Jasa + sembunyikan field stok/gudang utk jasa (**additive** di `packages/smart-inventory-ui/src/modules/barang`). (2) **Transaction Engine** — `POST /api/penjualan` menerima `sumber:"pos"` → langsung **paid + noKwitansi (KWT-…)**, `Penjualan` + `sumber/kasir/pajak/bayar/kembalian` (additive), **stok trading berkurang saat checkout, jasa tidak** (`services/pos-transaction.js` pure + 7 unit test); SO lama tidak berubah. (3) **Kasir screen** — `apps/pos/src/pages/pos` (3 kolom: Kategori·Produk·Bill, kart produk + tile foto/placeholder, pajak toggle 10%, bayar→kembalian, pager, checkout + struk printable monospace via `window.print()`); data `GET /api/pos/kasir-data` (satu request) + fallback listBarang. (4) **Role Kasir** — seed role `kasir` + `pos.kasir.use` + `inventory.barang.read`, menu Kasir + route `pos` (permission), user demo `kasir`. (5) **Deploy staging** — `pos-api` **PM2 :3003 online** (`health 200`), `.env` = nilai platform (PORT 3003, APP_BASE_URL pos.e-profit.id), dist rebuilt (title POS.e-Profit), bootstrap DB idempotent (`scripts/demo-bootstrap.js`: PT-001 apps `inventory,pos`, role+user kasir, item jasa). **Smoke test live**: login kasir 200 (companyConfig+entitlement), kasir-data ✓, transaksi `KWT-09082026-0001` paid (pajak 3300, bayar 50000, kembalian 13700), **stok Aquaviva 200→199** (trading), jasa tidak mengurangi stok. **Perbaikan hasil review**: kasir mendapat `inventory.dashboard.view` (landing login — tidak lagi Access Denied); reversal DELETE tidak menambah stok item jasa; validasi server `bayar < grandTotal` → 400; **decrement stok deterministik by `_id` item** (verifikasi live: Cabang Kemasan 40→39 via `KWT-09082026-0003`, Gudang Utama tetap). Verifikasi: test **791/791** (+7), lint root tetap 20 baseline, build 3 app ✓. 🚀 **Deploy live: https://pos.e-profit.id** (SSL Let's Encrypt, valid s.d. 2026-11-07, auto-renew). Nginx proxy: static SPA via /srv/apps/pos/dist, API bridge platform 3002, business API proxied ke pos-api PM2 :3003. **M3-FIX (umpan balik user)**: role `kasir` kini boot langsung ke **halaman kasir fullscreen standalone** (tanpa AppShell admin — tidak ada lagi sidebar/header ganda; header + Logout milik kasir sendiri, pola mockup kasir.html) via `bootApp`/`renderKasirApp`/`configureKasirShell` (konteks company di-set agar apiCall ter-scope; fallback permission offline kasir; register flow konsisten pakai bootApp). Admin/owner tetap memakai AppShell (menu Kasir dirender di dalam shell dengan header halaman). Unit test kasir-page-shell 3/3 → test **794/794**, lint root 20 baseline, build ✓, live bundle baru terverifikasi. |
| **POS.e-Profit** | **V1: PRD Lengkap + Gap Report + Implementasi TODO V1** | ✅ | 2026-08-10 | Sesuai Part I–XX prompt: **tanpa mengulang M0–M2** — audit implementasi existing dulu, pertahankan yang memenuhi acceptance criteria. (1) **PRD lengkap** — `docs/pos/pos_roadmap_v1.md` diperluas jadi Single Source of Truth V1 (bab 4–20: Product Architecture master/pos/inv/acc, Master Platform Configuration, POS Workspace menu Admin/Kasir, Dashboard, POS Core search/select/cart/pricing/transaction/payment/receipt/return, Master Item, Inventory Behavior trading/recipe/service/manufactured/digital, Mixed Transaction, Inventory Integration single/multi lokasi, Cashier & Shift, User & Permission, Reporting, Business Configuration, Non-MVP backlog V2–V4, Database & API Impact, UI/UX, Acceptance Criteria, Freebuff Execution Rule, Final Delivery). Golden Rules 1–20 **dipertahankan utuh**. (2) **Gap Report M0–M3** — `docs/pos/pos-gap-report-v1.md`: DONE/PARTIAL/TODO/CONFLICT. (3) **Keputusan PO** (5): C1 behavior recipe dijual **tanpa kurangi stok** (foundation V1, engine penuh V2); C2 multi harga = **implementasi minimal V1** (harga_khusus per item); C3 role kasir sesuai PRD; C4 void **hanya Admin/Owner**; C5 pajak **11%**. (4) **Implementasi TODO** — server: `Barang` +`barcode`/`harga_khusus`/behavior enum `recipe`, `Penjualan` +`metode_bayar`/`voidAt`/`voidBy`/`alasanVoid` + status `void`, model `Shift` baru, `pos-transaction.js` pajak 11% + recipe/manufactured/digital tanpa kurangi stok, `routes/pos.js` kasir-data +barcode/harga_khusus + **shift open/close/list** + dashboard summary, `routes/penjualan.js` terima metode_bayar + `POST /:id/void` (reversal stok trading, enforce `sumber=pos`, permission `pos.transaction.void`, alasan wajib), `routes/laporan.js` +sales-breakdown (by item/category/cashier/payment), seed/security permissions kasir+admin; client: halaman kasir (pajak 11%, **search barcode**, scanner `@smart/ui`, **metode bayar** Cash/Transfer/QRIS/Card, **diskon transaksi**, catatan, badge behavior recipe, **widget shift inline** open/close), **Dashboard POS baru** (owner: omzet hari ini/transaksi/terlaris/stok menipis/metode pembayaran/penjualan periode/ringkasan kasir+shift; kasir: shift aktif/transaksi/total/shortcut/status kas), form Barang shared `@smart/inventory-ui` +barcode/harga_khusus/behavior recipe, modul Penjualan shared +**tombol Void** (injectable `voidPenjualan`, badge status void), halaman **Shift** + **Laporan Kasir** baru (route+menu, read-only role kasir), data services `voidPenjualan`/`shift-data`/`getSalesBreakdown`. Verifikasi: test **796/796** (pos-transaction 9/9), lint 0 error baru, build pos+inventory+console ✓, **deploy live** — `pm2 restart pos-api`, health 200 ✓ (502 sesaat hanya waktu booting). Dokumentasi: `pos_execution.md` + `pos-gap-report-v1.md` + `execution_status.md` di-update. Backlog V1 lanjutan (gap report): return engine penuh, multi-price engine, hold/resume transaksi, preferensi pajak per toko. |
| **SP-029** | **M6-FIX v2: Payment Settle Chain + Harga Katalog Feature** | ✅ | 2026-08-08 | Lanjutan 2 suggested: (1) **Payment Settle Chain** — `settlePostPayment()` di payment-service: invoice PAID → subscription TRIAL→ACTIVE / PAST_DUE·SUSPENDED→ACTIVE / ACTIVE→renew endDate (sumber tunggal `addBillingCycle` MONTHLY=kalender, YEARLY=+1tahun, dipakai juga route /renew) + `SubscriptionChange` + sync entitlement plan features; company-based invoice → entitlement yang ditagih `effectiveUntil=periodEnd`. `verifyPayment` auto-issue DRAFT→ISSUED→PAID (konsisten dgn webhook), **anti-race** conditional update (2 verify konkuren tidak double-extend), **failure isolation** (settle gagal tidak membatalkan invoice PAID — audit `payment.settle_failed`), status terminal CANCELLED/EXPIRED → flag eksplisit. (2) **Harga Katalog Feature** — `PUT/POST /api/features` terima `price` (integer≥0, audit), `GET /api/features` sertakan `overrideCount` (agregasi Entitlement.price≠null), UI tab Features: kolom Harga Katalog + Override (badge N company) + field price di modal + peringatan override. Verifikasi: unit **44/44** (8 test baru: normalizeFeaturePrice, addBillingCycle), smoke payment **22/22** (TRIAL→ACTIVE+renew+sync, company-based effectiveUntil, verify 2x idempotent, price PUT+overrideCount, 400 negatif/desimal, anon 401), `npm test` **762/762**, enforcement 21/21 + invoice 25/25 regresi, lint 0, build console+inventory ✓, produksi live 8/8 (settle chain nyata) + cleanup (invoice test VOID, subscription CANCELLED, entitlement restore grandfathering). BACKLOG: amount tidak divalidasi vs invoice.total; multi-payment per invoice belum diblokir. |
| **SP-029** | **M6-FIX: Invoice by Company + Harga per Fitur per Perusahaan** | ✅ | 2026-08-08 | Umpan balik user: tidak ada cara menerbitkan invoice untuk company yang memakai aplikasi (tanpa subscription) & tidak ada setting harga per fitur per perusahaan. Implementasi: `Feature.price` (harga katalog) + `Entitlement.price` (override per perusahaan, null=reset, 0=gratis) + `priceReason` (tidak menimpa marker legacy grandfathering); `buildCompanyItems`/`resolveFeaturePrice` (pure, integer minor units); `POST /api/invoices/generate-company` (idempotent per company+periode, item per fitur enabled, audit `invoice.create_company`); `POST /api/entitlements/price` (reason wajib, auto-create entitlement utk company baru, audit `entitlement.price_set`); partial unique index `uniq_sub_company_period` & `uniq_company_period_nosub` (anti double-billing tanpa false-collision antar company); billing-summary kini menampilkan SEMUA entitlement + price; seed harga katalog ($setOnInsert); UI tombol "+ Invoice by Company" + kolom Harga & tombol "Set Harga" di tab Entitlements. Fix review: **BUG counter** `doc.value` undefined di native driver v4+ → nomor invoice selalu 000001 → `doc?.value?.seq ?? doc?.seq`; **HIGH** index lama non-partial di-drop di produksi (2 company periode sama → 201, tidak collide); semantik 0=gratis; E11000 → duplicate:true. Verifikasi: unit **36/36**, smoke invoice **25/25**, smoke enforcement regresi **21/21**, `npm test` **754/754**, lint 0, build console+inventory ✓, produksi live (health 200, 10 fitur berharga katalog, set harga 125000 → invoice 201 → void, 2 company periode sama 201, invoice test semua VOID). |
| **SP-027** | **PRE-M5: Regression Repair**         | ✅     | 2026-08-08 | Round 1: 3 masalah di-root-cause & diperbaiki tanpa ubah arsitektur/DB: (1) `GET /api/companies` di PUBLIC_RULES → `req.auth` tak pernah terisi → payload ringan → semua company tampil SUSPEND & Edit jatuh ke CREATE ("kode sudah digunakan") — fix: soft-auth (`authenticate(...,{soft})`) + `softAuth` rule, payload penuh untuk token valid, ringan untuk publik; (2) UI upload logo aplikasi hilang sejak M1 — fix: section logo di modal Edit Aplikasi + helper `getAppLogo` + render di list + fallback logo login inventory ke origin console; (3) Google Login inventory Client ID tak pernah di-pass — fix: `GET /api/auth/google/config` + `googleConfig.clientId`. Round 2 (hasil verifikasi user): (A) upload/hapus logo 401 → `services/platform.js` pakai `authorizedFetch` (POST/DELETE butuh token sejak M3); (B) modal Edit Perusahaan kosong → komponen form `@smart/ui` (Input/Select/Switch/Checkbox/Textarea) set value sebagai property yang tidak terserialisasi `outerHTML` (Modal pakai `innerHTML`) — fix: set content attribute (value/selected/checked/teks) + 5 test regresi; (C) inventory 401 `/api/permissions/roles` (syncFromServer plain fetch tanpa token) & `/api/companies` (data pindah ke Console sejak M2) — fix: `renderApp` sync permission via `apiCall`+`loadPermissions`, `settings-data` arahkan company ke origin console. Verifikasi: test **636/636** (5 test baru), lint 0, build console+inventory ✓, produksi: health 200/200, app-logo POST/GET/DELETE 200, permissions/roles 200, companies 3/3 active, Google config live. Laporan: `docs/SP-027-PRE-M5-REGRESSION-REPAIR.md`. M5 belum dimulai (Final Rule). |
| **SP-027** | **PRE-M5: Regression Repair — Round 3**  | ✅     | 2026-08-08 | Hasil verifikasi user berikutnya: (D) tombol "Simpan" modal Edit Aplikasi mati → selector lama `#cn-app-name input` (Input tidak punya id) → `null` → TypeError; fix: selector `[name=...]`; (E) Activity Log masih mock statis 05 Agu → route baru `GET /api/audit` (SecurityAuditLog M3, superadmin-only, search+pagination) + `services/activity.js` API-first + halaman non-mock dgn tombol Refresh & auto-refresh 30s; (F) Documentation placeholder → konten nyata (arsitektur, security M3, monitoring M4, developer/deploy guide, indeks dokumen). Verifikasi: test **636/636**, lint 0, build console+inventory ✓, produksi: `/api/audit` 200 (20 entri nyata, login 08 Agu) & anonim 401, dist baru memuat ketiga fix. Hardening hasil review: regex-escape & clamp pagination di `/api/audit` (verified live 200), selector modal di-scope ke `overlay`, error state anti-hang di activity, + 11 test audit (`apps/console/server/__tests__/audit.test.js`). Test final **647/647**, lint 0, build ✓, produksi live. |
| **SP-027** | **PRE-M5: Regression Repair — Round 4**  | ✅     | 2026-08-08 | Hasil verifikasi user: "Registered Apps — Belum ada aplikasi" tapi Login As tetap bisa masuk Inventory. Root cause: mapping company→aplikasi hanya state in-memory browser (@smart/core `_companyApps`, tidak pernah di-load/persist) sementara `POST /api/superadmins/impersonation-token` TIDAK memvalidasi akses → server tidak pernah mengecek. Fix: sumber kebenaran `Company.apps: [String]` (default []) di model Console & Inventory (berbagi DB), gate server di impersonation-token (403 jika belum terhubung + audit `impersonation.denied`) & defense-in-depth di inventory `impersonate` (403), UI baca/toggle dari `company.apps` + kirim `apps` saat save + tombol Login As disabled tanpa akses. Verifikasi: test **653/653** (6 test baru), lint 0, build ✓, E2E 8/8 (403 tanpa akses → 200 setelah enable → impersonate 200), produksi live: 3 company `apps=[]` (data tidak diubah), impersonation-token tanpa akses → 403. Konsekuensi: company existing perlu di-enable akses via Edit Perusahaan → Akses Aplikasi. Hardening review: urutan validasi (404→inactive→access + audit `impersonation.denied` dgn reason), `targetName` audit dari DB, whitelist `normalizeApps` di POST/PUT (slug tak dikenal dibuang). Test final **657/657** (10 test app-access), lint 0, build ✓, produksi live (403 tanpa akses, 404 company tak ada, 401 token invalid). Lanjutan user: tombol "Login As" selalu diklik → toast warning "Tidak ada aplikasi yang terhubung. Silahkan hubungkan terlebih dahulu." jika belum ada app sama sekali; "Perusahaan belum terhubung ke aplikasi Inventory" jika sudah ada app lain; pesan error server diteruskan via `requestImpersonationToken` (throw) → dist baru `index-BfBOr1Sn.js` live. |
| **SP-027** | **PRE-M5: Regression Repair — Round 5**  | ✅     | 2026-08-08 | Menu Applications tidak punya tombol "Tambah Aplikasi" — akar: aplikasi hanya registry mock in-memory (tidak ada model MongoDB, tidak ada API). Fix: **Application CRUD persisten** — model `Application` + route `/api/applications` (list/detail/create/update/delete, superadmin-only, audit `app.create/update/delete`), seed 8 aplikasi (idempotent), service client API-first, UI tombol "+ Tambah Aplikasi" + modal create/edit (slug immutable saat edit, icon+active+logo) + tombol Hapus (409 bila masih terhubung ke company), toggle "Akses Aplikasi" Companies & badge dari server (aplikasi baru otomatis tersedia, nonaktif ditandai "(nonaktif)"), `normalizeApps` menerima knownSlugs dari DB, `impersonation-token` memvalidasi appSlug terdaftar&aktif. Verifikasi: test **669/669** (12 test baru), lint 0, build ✓, E2E **12/12** (create→edit→hubungkan→impersonate→delete-blocked→lepas→delete), produksi live: 8 aplikasi ter-seed, anon 401, dist baru `index-BxKGH9jv.js`. FINDING: aplikasi baru belum otomatis dipantau Monitoring (registry statis apps.config.js). |
| **SP-027** | **PRE-M5: Regression Repair — Round 6 (Login As multi-aplikasi)** | ✅ | 2026-08-10 | Umpan balik user: klik **Login As** di Companies (master.e-profit.id) selalu langsung ke inv.e-profit.id padahal sudah ada 2 aplikasi aktif — seharusnya ada pilihan. Akar: handler `login-as` hardcode `startImpersonation("inventory", ...)` + memblokir company tanpa akses inventory; service `startImpersonation` hanya melayani slug `inventory` (selainnya toast "akan tersedia segera"). Fix (server TIDAK berubah — `POST /impersonation-token` & `/api/auth/impersonate` POS sudah generik): (1) **`services/impersonation.js` generik** — token utk slug apa pun + redirect `getAppEntryUrl(slug)` (pos → pos.e-profit.id, inventory → inv.e-profit.id), toast info bila slug belum punya URL entry, cleanup impersonation/companyContext di semua jalur; (2) **Companies page** — helper `activeConnectedApps(row)` (company.apps ∩ registry server-first yg `active`): 0 terhubung → toast, terhubung tapi tak ada yg aktif → toast, **1 → langsung impersonate, >1 → modal picker aplikasi** (`openLoginAsPicker`: kartu icon+nama+slug+domain, hover primary, klik → impersonate); tombol Login As primary bila ada app aktif (title di-update); (3) **CSS** `.cn-login-as-list/.cn-login-as-item/.cn-login-as-arrow`. Verifikasi: lint 0 error baru, test **794/794** (app-access 10/10), build console ✓, live `index-CBtMMUkH.js` + chunk `companies-CwoX7ckS.js` (marker `cn-login-as-item` ✓), data DB live: PT-001 apps `[pos,inventory]` (→ picker 2 app), PO-001 `[inventory]` (→ langsung), 1 company tanpa apps (→ toast). E2E penuh impersonation menunggu kredensial superadmin. |
| **SP-027** | **M5: SMART Deployment Center** | ✅ | 2026-08-08 | Console jadi **control plane deployment** (`apps/console/server`). Models: `Application` diperluas (repository/branch/buildCommand/testCommand/startCommand/deploymentTarget/healthEndpoint), `DeploymentEnvironment` (dev/staging/prod, seed 24 idempotent), `BuildRecord`, `ReleaseRecord` (semver unik), `DeploymentRecord`. Routes baru superadmin-only + audit: `/api/environments`, `/api/builds`, `/api/releases`, `/api/deployments` (rollback controlled), `/api/database` (Database Explorer **READ-ONLY**: db/collections/documents pagination/indexes/stats, server-side only, traversal diblokir). **Deployment Worker** (queue in-memory, MAX_ACTIVE=1): build install→test→build→package; deploy→verify→health-check (M4 `checkHttpHealth`) — SUCCESS hanya jika health check lolos (§19); **NO arbitrary shell** (allowlist npm/node/git/pm2 + spawn tanpa shell + cwd whitelist `/srv`; simulate default, real hanya development+`DEPLOYMENT_EXECUTION=real`). UI: menu **Deployment Center** (Overview/Builds/Releases/Deployments/Database), modal Build/Release/Deploy/Rollback, modal aplikasi kini punya field deployment config. Verifikasi: test **684/684** (15 unit M5), lint 0, build console+inventory ✓, E2E **25/25** (temp DB: release semver, build simulate, deploy+health, rollback→v1.2.3, db explorer, traversal 400, anon 401), produksi live: health 200, 24 env + 8 app ter-seed, dist `index-D5nr145D.js` + chunk `deployment-*.js`. Laporan: `docs/SP-027-M5-AUDIT.md`. Backlog: queue persistent, CANCELLED endpoint, sinkronisasi registry monitoring, database.write. |
| **SP-027** | **M5-FIX: Database Explorer UI Completion** | ✅ | 2026-08-08 | Gap ditutup: Database Explorer sebelumnya hanya `<pre>` JSON + db pertama; kini **database observation console** lengkap. Modul baru `apps/console/src/pages/deployment/database.js`: sidebar pilih **database** (refresh/loading/empty/error+retry), **collections** + **docCount** (backend: `estimatedDocumentCount` — metadata, tidak scan), **tabel dokumen** preview otomatis (`unionFields`, badge tipe per sel, limit 10 ≤ batas 100), **pagination**, **Search/Filter** key-value sederhana (backend tolak `__proto__`/`constructor`/`prototype`, value hanya string/number/boolean, tanpa arbitrary query), **Document Detail modal** — tree `field/type/value` + **nested object** + **array** expandable (`<details>`), **Index viewer** (nama/key/unique/sparse), **Statistics** (Documents/Size/Storage/Indexes), **breadcrumb** (Database Explorer/db/collection/document). Failure isolation: `Promise.allSettled` — stats/indexes gagal tidak menggagalkan tampilan dokumen. Verifikasi: test **706/706** (22 test: 19 database-view + 3 buildFilterQuery perilaku nyata), lint 0, build ✓, E2E **8/8** (docCount, filter→1 hasil, pagination, indexes, stats), produksi live: health 200, anon 401, dist `index-B1r4kc_D.js` + chunk `database-CxM6nT3M.js`, filter `__proto__` diblokir. Laporan: `docs/SP-027-M5-AUDIT.md` §Database Explorer UI Verification. |
| **SP-029** | **M6: SMART Billing & Subscription Center** | ✅ | 2026-08-08 | Console jadi **commercial control plane** (`apps/console/server`). Domain: 8 model baru (Plan, Feature, Subscription, SubscriptionChange, Entitlement, UsageRecord, Invoice, Payment) — harga integer minor units, currency abstraction, unique index (plan.slug, feature.slug, invoiceNumber, transactionReference, subscription+period). Services: `billing-core` (state machine TRIAL→ACTIVE→PAST_DUE→SUSPENDED→CANCELLED/EXPIRED, `calculateInvoiceTotal` server-side trunc, invoice number reproducible), `entitlement-service` (sync dari subscription idempotent + upsert anti-race, MANUAL override dipertahankan + reason wajib + expiry, `canUse`/`check(companyCode,featureSlug)`/`getUsageStatus`/`computeForCompany`), `invoice-service` (anti double-billing + sequence **ATOMIK** via counter $inc), `payment-service` (**mode SIMULATION default**, idempotent by transactionReference). Routes baru superadmin-only + audit: `/api/plans`, `/api/features`, `/api/subscriptions` (activate/renew/change-plan/suspend/resume/cancel-at-period-end/expire + riwayat SubscriptionChange), `/api/entitlements` (+ check API untuk aplikasi), `/api/usage` (source whitelist APPLICATION/API/WORKER/AI/MANUAL — usage browser 400), `/api/invoices` (generate idempotent/issue/void/transition), `/api/payments` (+ **webhook** diverifikasi `BILLING_WEBHOOK_SECRET`, didaftarkan sebelum auth middleware, idempotent, auto-issue invoice DRAFT→PAID). Seed: 10 feature + 4 plan + **grandfathering legacy** (30 entitlement source PLAN — company existing tidak diblokir, M6 §56). UI: menu **Billing (💳)** → Billing Center 8 tab (Overview+MRR/ARR tanpa data fiktif, Plans, Features, Subscriptions+riwayat, Invoices+detail, Payments, Usage, Entitlements+manual override). Verifikasi: test **727/727** (21 unit billing-core), lint 0, build console+inventory ✓, E2E **15/15** (temp DB: lifecycle, state machine tolak transisi invalid, entitlement sync, usage+snapshot, invoice idempotent + nomor `INV/2026/08/000001`, webhook positif+duplikat idempotent+401 tanpa secret), produksi live: health 200, 4 plans + 10 features + 30 legacy entitlement, anon 9 endpoint 401, webhook anon 401, dist `index-B30L-ADm.js`. Laporan: `docs/SP-029-M6-AUDIT.md`. Backlog: enforcement entitlement di aplikasi (controlled), proration, tax policy, notification, grace period. |
|-----------|---------------------------------------|--------|------------|-----------------------------------------------------------------------|
| **SP-027** | **M3: SMART Security Foundation**     | ✅     | 2026-08-08 | Password plaintext → bcrypt (migrasi idempotent tiap boot); JWT access(15m)+refresh(7d) + rotasi/revoke; middleware `authenticate`/`requireSuperAdmin`/`permission`/`companyScope` server-side; rate limiting (auth 20/15m, api 600/15m); helmet + CORS ENV; audit log `securityauditlogs` (login/logout/failed/password/role/company/superadmin); seed tanpa password hardcoded (ENV/random); impersonation handoff memakai JWT bertanda tangan (`/impersonation-token` → `/impersonate`); secret pindah ke ENV. Validasi: test 545/545 ✓, build console+inventory ✓, smoke test E2E 30/30 ✓ (DB uji terpisah, tanpa sentuh produksi). Laporan: `docs/SP-027-M3-SECURITY-FOUNDATION.md`. |
| **SP-027** | **P1.1 Scaffold apps/console**        | ✅     | 2026-08-04 | `apps/console` dibuat (package.json, vite, index.html, main.js, router, services, layouts, assets). Hanya bergantung ke framework (`@smart/core/ui/api/data`). |
| **SP-027** | **P1.2 Pindah Platform Module → apps/console** | ✅ | 2026-08-04 | `@smart/ui/modules/platform/*` (login + dashboard) dipindah ke `apps/console/src/modules/platform`; export & subpath `./modules/platform` dihapus dari `@smart/ui`. |
| **SP-027** | **P1.3 Strip Platform dari Inventory** | ✅     | 2026-08-04 | `main.js` tanpa mode platform; hapus `apps/inventory/src/pages/platform/` + `data/superadmin-data.js`; impersonasi exit → redirect ke Console. |
| **SP-027** | **P1.4 Infra + Docs**                 | ✅     | 2026-08-04 | nginx `master.e-profit.id` → root `/srv/apps/console/dist`; root script `build:console` (masuk `verify`); laporan migrasi `docs/SP-027-CONSOLE-MIGRATION-REPORT.md`. |
| **SP-027** | **Pra-requisite: restore missing exports @smart/ui** | ✅ | 2026-08-04 | `printToWindow`, `scannerSectionHTML`, `scanButtonHTML`, `attachScanner` diimplementasikan — build inventory sudah rusak sejak commit 65c88d9. |
| **SP-027** | **Validasi Phase 1**                  | ✅     | 2026-08-04 | Build console ✓ (547ms), build inventory ✓ (754ms), test 509/509 ✓. Ops P1.5 (deploy nginx live) manual. |
| **SP-027** | **M4 Monitoring Center — selesai + deploy produksi** | ✅ | 2026-08-08 | Monitoring Center di Console (master.e-profit.id): Monitoring API di `apps/console/server` (overview/applications/services/infrastructure/database/processes/history/health) dilindungi authenticate+requireSuperAdmin (401/403). Health states HEALTHY/WARNING/DEGRADED/DOWN/UNKNOWN; Application Registry extensible (config + `MONITORING_APPS_JSON`); infrastructure os+statfs; process via PM2 (`pm2 jlist`); history `monitoringevents` + TTL 7 hari; alert severity INFO/WARNING/ERROR/CRITICAL. Dashboard halaman Monitoring Center + auto refresh 30s configurable + Last Updated. Isolasi kegagalan dibuktikan (inventory DOWN → console HEALTHY). Test 621/621 ✓ (60 baru), build ✓, smoke E2E 29/29 ✓, produksi live: platform HEALTHY, services HEALTHY, infra HEALTHY, proses ONLINE. Review: anti-flood history (transisi-only), SSRF redirect manual, listener leak client, numeric guard PM2. Laporan `docs/SP-027-M4-MONITORING-CENTER.md`. |
| **SP-027** | **M3 Security — hardening putaran 2 + deploy produksi** | ✅ | 2026-08-08 | Ekstrak Google verify ke `@smart/security` (`google-verify.js` + 7 unit test, credential palsu → 401 tanpa token). Refresh token pindah ke **httpOnly cookie** (`cookies.js`, `COOKIE_NAME/COOKIE_SECURE`; body tetap didukung) — client tidak lagi simpan refresh token di localStorage, seluruh fetch `credentials:include`. **Deploy produksi selesai**: mongodump backup `/srv/backups/m3-pre-deploy-20260808-180955`, `pm2 restart console-api inventory-api`, health 200/200, migrasi plaintext→bcrypt berjalan (0 plaintext tersisa, 11 akun), endpoint privat 401, backward-compat login dibuktikan 3/3 (tes migrasi plaintext→bcrypt). Test 559/559 ✓, build ✓, smoke test E2E **37/37** ✓. |
| Framework | A-01 Sidebar Fix                      | ✅     | Sprint 1   | Removed module-level `sidebarClickAttached` flag.                     |
| Framework | A-02 Export Fix                       | ✅     | Sprint 1   | Full re-export of all 22 components from `@smart/ui`.                 |
| EPIC-001  | **Company Context → smart-core**      | ✅     | 2026-07-15 | `setCompanyContext`, `getCompanyCode`, `tagWithCompany` dll pindah ke framework. |
| EPIC-001  | **BrandingContext → smart-core**      | ✅     | 2026-07-15 | `BrandingManager` — logo, favicon, companyName, workspace, theme.     |
| EPIC-001  | **Company Types → smart-core**        | ✅     | 2026-07-15 | `COMPANY_TYPES` 16 jenis.                                             |
| EPIC-001  | **Persistence → smart-data**          | ✅     | 2026-07-15 | `createStore()` dari Inventory pindah.                                |
| EPIC-001  | **MongoDB Connection → smart-data**   | ✅     | 2026-07-15 | `dbConfig`, `checkConnection`, `createApiRepository`.                 |
| EPIC-001  | **BaseRepository → smart-data**       | ✅     | 2026-07-15 | `BaseRepository` + `InMemoryRepository`.                              |
| EPIC-001  | **API Fallback → smart-api**          | ✅     | 2026-07-15 | 10 API fallback utilities.                                            |
| EPIC-001  | **PageContainer → smart-ui**          | ✅     | 2026-07-15 | `PageContainer()` + `renderBreadcrumb()`.                             |
| EPIC-001  | **Settings Company → smart-ui**       | ✅     | 2026-07-15 | `SettingsCompanyModule` (DI-based).                                   |
| EPIC-001  | **Settings User → smart-ui**          | ✅     | 2026-07-15 | `SettingsUserModule` (DI-based).                                      |
| EPIC-001  | **Settings Role → smart-ui**          | ✅     | 2026-07-15 | `SettingsRoleModule` (DI-based).                                      |
| EPIC-001  | **Settings Permission → smart-ui**    | ✅     | 2026-07-15 | `SettingsPermissionModule` (DI-based).                                |
| EPIC-001  | **FrameworkContext → smart-core**     | ✅     | 2026-07-15 | `framework` singleton — unified state.                                |
| EPIC-001  | **Branding wired to Sidebar/Shell**   | ✅     | 2026-07-15 | Sidebar auto-reads dari BrandingContext.                              |
| EPIC-001  | **Server Models: status + audit**     | ✅     | 2026-07-15 | `status`, `createdBy`, `updatedBy` di semua model.                    |
| **EPIC-004** | **Impersonation Manager → smart-core** | ✅     | 2026-07-15 | `ImpersonationManager` — Login As Company Admin, session with expiry, notify on start/end/expired. |
| **EPIC-004** | **Audit Logger → smart-core**         | ✅     | 2026-07-15 | `AuditLogger` — mencatat impersonation, login, logout. Convenience methods: logImpersonationStart, logImpersonationEnd, logLogin, logLogout. |
| **EPIC-004** | **Platform Manager → smart-core**     | ✅     | 2026-07-15 | `PlatformManager` — registry aplikasi (8 built-in apps), company-app mapping, enable/disable apps per company. |
| **EPIC-004** | **Super Admin user + role**           | ✅     | 2026-07-15 | User `superadmin`/`superadmin123` dengan role `superadmin` (level 200, wildcard permissions). |
| **EPIC-004** | **Topbar Impersonation Badge → smart-ui** | ✅ | 2026-07-15 | Badge merah `LOGIN AS [Company] (Admin Perusahaan) Support Mode Active` + tombol `Kembali ke Super Admin`. |
| **EPIC-004** | **AppShell impersonation support**    | ✅     | 2026-07-15 | `AppShell` menerima `impersonation` + `onExitImpersonation` params, diteruskan ke Topbar. |
| **EPIC-004** | **Framework exports updated**         | ✅     | 2026-07-15 | `smart-core/index.js` dan `package.json` mengekspor impersonation, audit, platform. |
| **EPIC-004** | **Platform Dashboard (Super Admin)**     | ✅     | 2026-07-15 | Halaman dashboard Super Admin dengan apps grid + company management. Login superadmin → dashboard. |
| **EPIC-004** | **Company Management Page**              | ✅     | 2026-07-15 | Tabel perusahaan + 5 action buttons: ✏️ Edit, 🔑 Login As, 👁️ Profile, 📋 Subs, ⛔ Disable. Form modal, detail modal, subscription toggle, confirm disable. |
| **EPIC-004** | **Impersonation Flow**                   | ✅     | 2026-07-15 | Pilih app → pilih company → Login As Admin → sessionStorage → reload → AppShell + impersonation badge. Kembali ke Super Admin. |
| Inventory | Sprint 1 — Authentication             | ✅     | 2026-07-14 | Login page, logout, session, protected routes. Users: admin/admin123, operator/operator123. |
| Inventory | Sprint 1 — Application Shell          | ✅     | 2026-07-14 | AppShell, Sidebar, Topbar, Breadcrumb.                                |
| Inventory | Sprint 1 — Dashboard                  | ✅     | 2026-07-14 | Enhanced dashboard with stat cards, welcome banner.                   |
| Inventory | Sprint 1 — Database Layer             | ✅     | 2026-07-14 | MongoDB abstraction, framework repositories.                          |
| Inventory | Barang CRUD                           | ✅     | 2026-07-14 | Full CRUD with SMART UI components. 12 seed items.                    |
| Inventory | Settings Company CRUD                 | ✅     | 2026-07-14 | Full CRUD via framework `SettingsCompanyModule`.                      |
| Inventory | Settings User CRUD                    | ✅     | 2026-07-14 | Full CRUD with role + company assignment.                             |
| Inventory | Settings Role CRUD                    | ✅     | 2026-07-14 | Full CRUD with level hierarchy.                                       |
| Inventory | Settings Permission                   | ✅     | 2026-07-14 | Role-permission matrix with expandable groups.                        |
| Inventory | Multi-Tenant Data Isolation           | ✅     | 2026-07-14 | All entities scoped by companyCode.                                   |
| Inventory | Supplier CRUD                         | ✅     | 2026-07-15 | Full CRUD with SMART UI components. 8 seed items.                     |
| **Framework** | **Company SDK Refactoring**        | ✅     | 2026-07-16 | Company menjadi SDK: company-manager, company-session, company-storage, company-validator. SMART.Session global singleton. BaseRepository auto-company scoping. SMART namespace (SMART.Session, SMART.Company, SMART.Permission, etc). |
| **Framework** | **Company Types Simplified**        | ✅     | 2026-07-16 | COMPANY_TYPES disederhanakan: PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya. |
| **Framework** | **Branding Decoupled**              | ✅     | 2026-07-16 | BrandingManager tidak lagi bergantung pada company-context. Menerima data via loadFromCompany(). |
| **Framework** | **Inventory Data Layer Cleanup**    | ✅     | 2026-07-16 | Hapus dependency langsung ke filterByCompany/tagWithCompany dari data services. Gunakan BaseRepository auto-scoping. |
| **Framework** | **Architecture Refinement (13 Phases)** | ✅ | 2026-07-16 | SMART Framework jadi Enterprise SDK: SMART.Session (nested), SMART.Company (15 methods), SMART.DB, SMART.API, SMART.UI, SMART.Permission (namespace), SMART.Platform (enhanced), SMART.Audit, SMART.Impersonation. |
| **EPIC-005** | **Architecture Design Document**      | ✅ | 2026-07-16 | `docs/epic-005-architecture-design.md` — Event Bus, DI, Plugin, Lifecycle, Config, CLI, Generators. 5 conflicts identified, solutions designed. |
| **EPIC-005** | **Event Bus**                          | ⬜ | Sprint 5   | Wrapping existing onChange, backward compat. No breaking changes. |
| **EPIC-005** | **Configuration Provider**             | ⬜ | Sprint 5   | Priority chain: ENV → localStorage → workspace.json → defaults. |
| **EPIC-005** | **Lifecycle Hooks**                    | ⬜ | Sprint 5   | State machine: bootstrap → init → ready → running → destroy. |
| **EPIC-005** | **DI Container**                       | ⬜ | Sprint 6   | Optional — facade tetap langsung import. Register/resolve pattern. |
| **EPIC-005** | **Plugin System**                      | ⬜ | Sprint 6   | SMART.use(plugin), SMART.extend(name, module). Plugin lifecycle. |
| **EPIC-005** | **CLI Architecture**                   | ⬜ | Sprint 7   | New package: smart-cli. Commands: init, generate, build, dev. |
| **EPIC-005** | **Module Generator**                   | ⬜ | Sprint 7   | New package: smart-generator. CRUD module from template. |
| **EPIC-005** | **Application Generator**              | ⬜ | Sprint 7   | Full app from template. Depends on Module Generator. |
| Inventory | Pembelian CRUD                        | ⬜ | —          | Placeholder only.                                                     |
| Inventory | Customer CRUD                         | ⬜     | —          | Placeholder only.                                                     |
| **Framework** | **Platform Login Module → smart-ui** | ✅     | 2026-07-19 | `SuperAdminLoginPage` + `initSuperAdminLoginPage` di `packages/smart-ui/src/modules/platform/login.js`. Self-contained, bisa dipakai aplikasi manapun. |
| **Framework** | **Platform Dashboard Module → smart-ui** | ✅ | 2026-07-19 | `PlatformDashboardModule` DI-based di `packages/smart-ui/src/modules/platform/dashboard.js`. Menerima data services via parameter. |
| **Inventory** | **Login Separation (Super Admin vs User)** | ✅ | 2026-07-19 | Superadmin login dipisah dari user login. SuperAdmin login → `/api/superadmins/login`, User login → `/api/auth/login`. Navigasi antar form via link. |
| **Inventory** | **Platform Thin Wrappers** | ✅ | 2026-07-19 | `apps/inventory/src/pages/superadmin-login/` dan `platform/` jadi thin wrapper yang meng-import framework module dan inject data services. |
| **Infra** | **Vite host:true + CORS** | ✅ | 2026-07-19 | Vite dev server bisa diakses via IP publik (host: true). CORS updated untuk IP 101.50.2.10 dan subnet 192.168.* / 10.*.
| **Inventory** | **URL Routing: Path-based Separation** | ✅ | 2026-07-19 | `getAppMode()` di main.js. `/` → Login Inventory, `/platform` → Super Admin. Navigasi antar form pake full page navigation (href). |
| **Inventory** | **Domain Mapping Display** | ✅ | 2026-07-19 | Info domain `inv.e-profit.id` (Inventory) dan `master.e-profit.id` (Super Admin) ditampilkan di login page. |
| **Framework** | **Platform Login: href back link** | ✅ | 2026-07-19 | Back link di `packages/smart-ui/src/modules/platform/login.js` sekarang pake `href="/"` instead of JS callback. |
| **Server** | **Hapus Endpoint /api/auth/unified-login** | ✅ | 2026-07-19 | Endpoint unified-login dihapus dari `apps/inventory/server/routes/auth.js`. Cleanup unused `SuperAdmin` import. Login sekarang terpisah: User → `/api/auth/login`, SuperAdmin → `/api/superadmins/login`. |
| **Inventory** | **Hostname Detection Aktif** | ✅ | 2026-07-19 | `getAppMode()` di main.js sekarang cek `host === 'master.e-profit.id'` untuk mode platform. Fallback ke path-based `/platform` untuk development. Production tinggal DNS resolve. |
| **Infra** | **SSL Permission Fix** | ✅ | 2026-07-19 | `/etc/letsencrypt/live/` permission `700` → `755`. Nginx tidak bisa traverse ke folder sertifikat karena hanya root yang bisa akses. |
| **Infra** | **Nginx Deploy: master.e-profit.id + inv.e-profit.id** | ✅ | 2026-07-19 | Copy config dari `/srv/platform/config/nginx/` ke `/etc/nginx/sites-available/` + symlink di `sites-enabled`. Kedua domain `proxy_pass` ke `127.0.0.1:5173` (Vite). |
| **Infra** | **Vite Dev Server Started via PM2** | ✅ | 2026-07-19 | `pm2 start npm --name "inventory-vite" -- run dev` di `/srv/apps/inventory`. Process name: `inventory-vite`, PID 630610. |
| **Infra** | **Domain 200 OK Verified** | ✅ | 2026-07-19 | `curl -I http://master.e-profit.id/` → `200 OK`. `curl -I http://inv.e-profit.id/` → `200 OK`. Kedua domain sudah aktif. |
| **Infra** | **SSL Certificate via Certbot** | ✅ | 2026-07-19 | `certbot --nginx -d master.e-profit.id -d inv.e-profit.id`. Certificate path: `/etc/letsencrypt/live/master.e-profit.id/`. Expiry: 2026-10-17. |
| **Infra** | **Nginx ACME Challenge Location** | ✅ | 2026-07-19 | Added `location ^~ /.well-known/acme-challenge/` + `/var/www/acme-challenge` directory. Memungkinkan Certbot HTTP-01 validation. |
| **Infra** | **HTTPS 200 OK Verified** | ✅ | 2026-07-19 | `curl -I https://master.e-profit.id/` → `200 OK`. `curl -I https://inv.e-profit.id/` → `200 OK`. HTTP → 301 redirect ke HTTPS. |
| **Infra** | **Nginx Source Config Synced** | ✅ | 2026-07-19 | Config hasil Certbot disinkronkan dari `/etc/nginx/sites-available/` ke `/srv/platform/config/nginx/` agar tidak hilang saat deploy ulang. |
| **Inventory** | **Hapus Demo Credentials dari Login** | ✅ | 2026-07-19 | Dihapus dari `apps/inventory/src/pages/login/index.js`: demo admin/operator, link Login Super Admin, domain info inv.e-profit.id/master.e-profit.id. |
| **Framework** | **Hapus Demo & Back Link dari Super Admin Login** | ✅ | 2026-07-19 | Dihapus dari `packages/smart-ui/src/modules/platform/login.js`: demo superadmin, back link ← Kembali ke Login Inventory. CSS terkait juga dibersihkan. |
| **Inventory** | **Background Login → Warna Sidebar** | ✅ | 2026-07-19 | Inventory login page: `linear-gradient(135deg, #1e293b, #334155)` → `linear-gradient(to bottom, #1e1b4b, #982deb)` (sama dengan sidebar). |
| **Framework** | **Background Super Admin Login → Warna Sidebar** | ✅ | 2026-07-19 | Super Admin login page: `linear-gradient(135deg, #0f172a, #1e293b, #0f172a)` → `linear-gradient(to bottom, #1e1b4b, #982deb)` (sama dengan sidebar). |
| **Infra** | **Production Deployment: Build + Nginx Static Serve** | ✅ | 2026-07-19 | Vite dev server (PM2) di-stop. Nginx config diubah: `proxy_pass` ke Vite → `root /srv/apps/inventory/dist` + `try_files` SPA fallback. `/api/` di-proxy ke Express (127.0.0.1:3001). HTTP 80: `return 404` → `301 redirect` ke HTTPS. CORS Express ditambah regex `*.e-profit.id`. Build sukses (582ms). |
| **Infra** | **Vite Dev Server PM2 Stopped** | ✅ | 2026-07-19 | `inventory-vite` process (PID 630610) di-stop dan di-delete dari PM2. Tidak ada lagi Vite dev server yang rawan restart dan 403 intermittent. |
| **Infra** | **Nginx Config: Static Files + SPA Routing** | ✅ | 2026-07-19 | `location /` sekarang `try_files $uri $uri/ /index.html` dari `/srv/apps/inventory/dist`. `location /api/` proxy ke Express dengan `proxy_buffering off`. |
| **Infra** | **HTTP 301 Redirect** | ✅ | 2026-07-19 | HTTP (port 80) diubah dari `return 404` (Certbot default) menjadi `return 301 https://$host$request_uri`. |
| **Framework** | **Platform Dashboard: Logo di Header** | ✅ | 2026-07-19 | `PlatformDashboardModule` sekarang menerima parameter `logo`. Header dashboard diubah dari emoji 🚀 menjadi logo image (sama dengan login page). CSS `.pd-logo-img` max 120x80. |
| **Inventory** | **Platform Dashboard Logo: Factory + Logo Passthrough** | ✅ | 2026-07-19 | `pages/platform/index.js` di-refactor: export baru `createPlatformDashboard({logo})`. Default backward compat dipertahankan. `main.js` fetch logo dari API dan pass ke dashboard via factory. |

## ═══════════════════════════════════════════════
## REFACTORING & FIXES (2026-07-20)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Enterprise RBAC — Test Validation** | ✅ | 2026-07-20 | Audit 17 test gagal di permission.test.js. Semua karena test masih pakai arsitektur lama (viewer/manager, hardcoded permissions). Refactor test tanpa menyentuh source code framework. 509/509 tests PASS. `docs/platform-architecture-audit.md` |
| **Framework** | **Server Route: /api/platform/logo** | ✅ | 2026-07-20 | Route baru `apps/inventory/server/routes/platform.js` — GET/POST/DELETE untuk menyimpan logo di server (file-based). Bisa diakses seluruh subdomain. |
| **Framework** | **Logo Upload: Direct POST from Dashboard** | ✅ | 2026-07-20 | Dashboard settings (``showSettingsView``) sekarang langsung POST ke `/api/platform/logo` tanpa bergantung DI callback. DI callback tetap dipanggil untuk kompatibilitas. |
| **Framework** | **DI Callback: onLogoUpload/onLogoRemove** | ✅ | 2026-07-20 | `PlatformDashboardModule` ditambah parameter `onLogoUpload`/`onLogoRemove`. Dipanggil saat logo diupload/dihapus. |
| **Inventory** | **Platform Wrapper: Logo Upload API** | ✅ | 2026-07-20 | `pages/platform/index.js` pass `uploadLogoToServer`/`removeLogoFromServer` via DI ke dashboard framework. |
| **Inventory** | **Login: fetchCompanyLogo coba /api/platform/logo** | ✅ | 2026-07-20 | `main.js` — `fetchCompanyLogo()` coba `/api/platform/logo` dulu, fallback ke `/api/companies`. Prioritas: localStorage → server API → company API. |
| **Framework** | **Logo Circular (Lingkaran)** | ✅ | 2026-07-20 | `.login-logo-img`, `.sa-logo-img`, `.pd-settings-logo-preview-img` diubah jadi lingkaran (`border-radius: 50%`, 100x100px, `object-fit: cover`). Konsisten di Inventory login, Super Admin login, dan settings preview. |
| **Inventory** | **Topbar: SMART Inventory** | ✅ | 2026-07-20 | `institution.js` `name` diubah dari `"SMART Warehouse"` → `"SMART Inventory"`. `workspace/warehouse/workspace.json` `topbarTitle` juga diubah. Konsisten dengan form login. |
| **Inventory** | **Cleanup: Hapus superadmin-login wrapper** | ✅ | 2026-07-20 | Hapus `apps/inventory/src/pages/superadmin-login/`. `main.js` langsung import `SuperAdminLoginPage`/`initSuperAdminLoginPage` dari `@smart/ui` dengan object API yang benar. |
| **Infra** | **Express Server PM2 Restart** | ✅ | 2026-07-20 | `pm2 restart inventory-server` — memuat route `/api/platform/logo` yang baru. |
| **Infra** | **Frontend Rebuild (3x)** | ✅ | 2026-07-20 | Build ulang 3 kali: CSS lingkaran, institution name, cleanup wrapper. Semua sukses. |
| **Inventory** | **Cleanup: Hapus 3 unused re-export files** | ✅ | 2026-07-20 | Hapus `data/base-repository.js`, `data/company-context.js`, `data/mongodb.js` — semua re-export dari framework, sudah tidak dipakai. Update `data/index.js`. |

## ═══════════════════════════════════════════════
## SPRINT 2 — MASTER DATA COMPLETION (2026-07-20)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Kategori MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Kategori.js` — companyCode required, compound index. `server/routes/kategori.js` — full CRUD with company scoping via x-company-code. |
| **Inventory** | **Satuan MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Satuan.js` + `server/routes/satuan.js`. Menu renamed from 'Unit' to 'Satuan' (Indonesian). Permission renamed from `inventory.unit.*` to `inventory.satuan.*`. |
| **Inventory** | **Warehouse MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Warehouse.js` + `server/routes/warehouse.js` — includes alamat, kontak, telepon. |
| **Inventory** | **Supplier MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Supplier.js` + `server/routes/supplier.js` — sebelumnya hanya client-side, sekarang ada server backend juga. |
| **Inventory** | **Customer MongoDB Model + Route** | ✅ | 2026-07-20 | `server/models/Customer.js` + `server/routes/customer.js` — full CRUD with company scoping. |
| **Inventory** | **Seed Data: Kategori, Satuan, Warehouse, Customer** | ✅ | 2026-07-20 | KATEGORI_SEED (9 items), SATUAN_SEED (12 items), WAREHOUSE_SEED (3 items), CUSTOMER_SEED (4 items). Semua di-seed saat first connect. |
| **Inventory** | **Client Data Services (4)** | ✅ | 2026-07-20 | `kategori-data.js`, `satuan-data.js`, `warehouse-data.js`, `customer-data.js` — API-first dengan in-memory fallback. Multi-tenant via companyCode. |
| **Inventory** | **Client Pages (4): Kategori, Satuan, Warehouse, Customer** | ✅ | 2026-07-20 | Full CRUD pages dengan SMART UI components. Terdaftar di router + menu. |
| **Inventory** | **Barang: Dropdown Dinamis dari Master Data** | ✅ | 2026-07-20 | Kategori & Satuan dropdown di form Barang sekarang membaca dari master data via API, bukan hardcoded. |
| **Inventory** | **Server Routes Registered** | ✅ | 2026-07-20 | 5 routes baru (kategori, satuan, warehouse, supplier, customer) terdaftar di `server/index.js`. |
| **Infra** | **Frontend Rebuild (Sprint 2)** | ✅ | 2026-07-20 | Build 377ms. 509 tests PASS. |

## ═══════════════════════════════════════════════
## BARCODE SCANNER — DIAGNOSTIK (2026-07-21)
## ═══════════════════════════════════════════════

| Task | Status | Date | Notes |
|------|--------|------|-------|
| **Scanner: Hapus formatsToSupport dari config** | ✅ | 2026-07-21 | `formatsToSupport` di `start()` config tidak diproses library (hanya diterima constructor). Dihapus agar library scan semua format default. |
| **Scanner: Hapus qrbox (full frame scan)** | ✅ | 2026-07-21 | Hapus `qrbox: { width: 200, height: 120 }` — library sekarang scan seluruh frame video. |
| **Scanner: Container height 180px → 280px** | ✅ | 2026-07-21 | Naikkan container camera dari 180px ke 280px untuk canvas ZXing yang lebih besar. |
| **Scanner: deviceId { exact } → non-exact** | ✅ | 2026-07-21 | `deviceId: { exact: cam.id }` too strict untuk beberapa browser mobile. Ganti ke `deviceId: cam.id`. |
| **Scanner: Hapus video CSS !important** | ✅ | 2026-07-21 | Hapus `width: 100% !important; height: 100% !important; object-fit: cover !important;` — biarkan library kontrol sizing. |
| **Scanner: Prioritas kamera diubah** | ✅ | 2026-07-21 | Urutan: deviceId enumerasi → facingMode environment → facingMode user. Sebelumnya: facingMode dulu. |
| **Scanner: verbose:true dihapus** | ✅ | 2026-07-21 | `verbose: true` banjiri console dengan ZXing debug log tiap frame. Dihapus. |
| **Scanner: Decode error log tiap 100 frame** | ✅ | 2026-07-21 | Ganti dari `console.warn` tiap frame (10x/detik) jadi log setiap 100 frame (~10 detik). |
| **Scanner: MediaStream track state check** | ✅ | 2026-07-21 | Tambah `video.srcObject?.getVideoTracks()?.[0]?.readyState` — untuk deteksi apakah stream live/ended. |
| **⚠️ PROBLEM: VIDEO 0x0, readyState=0, no CANVAS** | ❌ | 2026-07-21 | Diagnostic: container cuma berisi 1 VIDEO element. Video: `0x0, readyState=0, paused=false`. Tidak ada CANVAS. Kamera start (getUserMedia sukses) tapi stream TIDAK mengirim frame. Bisa jadi bug library atau masalah browser security policy. **Belum teratasi.** |
| **Scanner: Refactor ke Framework component** | ✅ | 2026-07-22 | Scanner dipindah ke `packages/smart-ui/src/components/scanner/` sebagai `UI.BarcodeScanner` class. Barang page panggil via `new UI.BarcodeScanner()`. Otomatis pilih kamera (HP→belakang, Laptop→depan) + switch camera. |
| **⚠️ Scanner: Front camera tidak berfungsi** | ❌ | 2026-07-22 | Setelah refactor ke framework, scanner gagal start dengan kamera depan (laptop/HP). Toast: "⚠️ Kamera tidak tersedia". Fix import `Html5Qrcode` sudah diterapkan, tapi front camera tetap bermasalah. Kemungkinan bug internal library `html5-qrcode` dengan `facingMode: "user"` pada browser tertentu. **Belum teratasi.** |

## ═══════════════════════════════════════════════
## SPRINT 2.5 — UI HARMONISASI + REFACTOR (2026-07-22)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Barang HP: Card View + Layout** | ✅ | 2026-07-22 | Card view mobile: nama ungu, kode biru/merah/ungu, shadow border, scroll tanpa zoom. Pagination di luar card. Search + button 1 baris. Desktop tetap tabel. |
| **Inventory** | **Master Data HP: Card View seragam** | ✅ | 2026-07-22 | Kategori, Satuan, Warehouse, Customer, Supplier — semua mobile card view konsisten dengan Barang (border biru, shadow, nama ungu, kode biru, tombol edit/hapus). |
| **Inventory** | **Kategori/Satuan: Deskripsi di card** | ✅ | 2026-07-22 | Deskripsi rata kanan, max 50% lebar, line-clamp 3 baris, sejajar dengan nama. |
| **Inventory** | **Page header rata kiri + alamat dihapus dari card** | ✅ | 2026-07-22 | Semua halaman: title di atas, actions di bawah (HP). Alamat dihapus dari card customer/supplier. |
| **Framework** | **UI.CardList component** | ✅ | 2026-07-22 | `packages/smart-ui/src/components/card-list/` — `CardList(items, renderContent)` + `attachCardEvents()`. CSS: border #2563eb, shadow, nama ungu, kode biru, tombol edit/hapus. Diexport via UI.CardList / UI.attachCardEvents. |
| **Framework** | **UI.BarcodeScanner component** | ✅ | 2026-07-22 | `packages/smart-ui/src/components/scanner/` — `BarcodeScanner` class. Auto camera selection (HP→back, laptop→front), switch camera. Diexport via UI.BarcodeScanner. Memiliki scanner CSS (corner frame, scan line, ripple, flash). |
| **Inventory** | **Barang: Refactor card + scanner ke framework** | ✅ | 2026-07-22 | `renderBarangCards` → `UI.CardList()`. Scanner → `new UI.BarcodeScanner()`. Hapus ~200 baris scanner CSS + ~30 baris card CSS (sekarang di framework). |
| **Inventory** | **5 CRUD pages: Refactor card ke framework** | ✅ | 2026-07-22 | Kategori, Satuan, Warehouse, Customer, Supplier — `renderCrudCards` → `UI.CardList()` + `UI.attachCardEvents()`. Duplicate card CSS dihapus dari masing-masing `getStyles()`. |
| **Framework** | **Scanner: Fix Html5Qrcode import missing** | ✅ | 2026-07-22 | `scanner.js` ditambah `import { Html5Qrcode } from "html5-qrcode"`. Sebelumnya `Html5Qrcode` undefined karena pindah dari barang page ke framework tanpa import. `html5-qrcode` ditambah ke smart-ui dependencies. |
| **Framework** | **Test: getScannerConfig → BarcodeScanner.getConfig** | ✅ | 2026-07-22 | `barang/index.test.js` diupdate: import dari `./index.js` (dihapus) → import dari `@smart/ui` dan test `new UI.BarcodeScanner().getConfig()`. |
| **Inventory** | **Sort ascending by nama (6 pages)** | ✅ | 2026-07-22 | `state.items.sort((a, b) => (a.nama || "").localeCompare(...))` ditambahkan di loadData() untuk Barang, Kategori, Satuan, Warehouse, Customer, Supplier. Case-insensitive. Berlaku untuk HP (card) dan Desktop (table). |
| **Inventory** | **Dashboard padding & gap konsisten** | ✅ | 2026-07-22 | Dashboard mobile: padding 0.75rem 0.25rem, gap stat cards 0.75rem, border-radius 10px, shadow sama dg card barang. Welcome card stacked di HP. |

## ═══════════════════════════════════════════════
## ACTIVITY LOG + SEED F&B (2026-07-22)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Server** | **ActivityLog Model** | ✅ | 2026-07-22 | `server/models/ActivityLog.js` — companyCode, action (create/update/delete), resource, resourceName, resourceCode, userName. Indexed. |
| **Server** | **Route /api/activity** | ✅ | 2026-07-22 | `server/routes/activity.js` — GET dengan pagination, company scoping, optional resource filter. |
| **Server** | **Barang: Activity Logging** | ✅ | 2026-07-22 | ActivityLog.create() di setiap create/update/delete barang. Baca x-user-name dari header. |
| **Client** | **listActivity data service** | ✅ | 2026-07-22 | `src/data/activity-data.js` — fetch dari /api/activity. Fallback empty array. |
| **Client** | **API: x-user-name header** | ✅ | 2026-07-22 | Kirim header x-user-name dari SMART.Session untuk activity logging. |
| **Dashboard** | **Aktivitas Terbaru + Stok Menipis** | ✅ | 2026-07-22 | Render 5 aktivitas terbaru (icon + teks + timeago). Stok menipis dihitung dari barang dg stok ≤ stok_minimum. CSS activity list, item, icon, badge. |
| **Seed** | **BARANG_SEED → F&B (12)** | ✅ | 2026-07-22 | Semua barang diubah ke Food & Beverage: Air Mineral, Kopi, Gula Pasir, Tepung, Minyak Goreng, Nugget, Sosis, Kecap, Saus, Keripik, Susu UHT, Roti Tawar. 3 item stok sengaja < minimum utk tes. |
| **Seed** | **KATEGORI_SEED → F&B (9)** | ✅ | 2026-07-22 | Minuman, Makanan Ringan, Bumbu & Saus, Bahan Baku, Frozen Food, Susu & Olahan, Roti & Kue, Kemasan, Lainnya. |
| **Seed** | **SATUAN_SEED → F&B (12)** | ✅ | 2026-07-22 | Gram, Ml, Pack, Botol, Gelas, Karton, Sachet ditambahkan. Sak, Batang, Lembar, Meter, Roll dihapus. |
| **Seed** | **Activity Log dari DB asli** | ✅ | 2026-07-22 | Seed activity log baca dari koleksi Barang asli (jika ada data), bukan dari BARANG_SEED array. Stale seed entries (resourceId /^seed-/) dibersihkan otomatis. |
| **Deploy** | **Build + Restart Server** | ✅ | 2026-07-22 | vite build (781ms). pm2 restart inventory-server — route & model activity log aktif. |

## ═══════════════════════════════════════════════
## DASHBOARD — STOK & LAYOUT (2026-07-22)
## ═══════════════════════════════════════════════

| Task | Status | Date | Notes |
|------|--------|------|-------|
| **Stok Menipis: stok 1-4** | ✅ | 2026-07-22 | Filter diubah dari `stok <= stok_minimum` jadi `stok > 0 && stok < 5`. Stok 0 = habis, bukan menipis. |
| **Stok Habis: stat baru** | ✅ | 2026-07-22 | Kartu stat baru untuk stok = 0 dengan icon 🚫 background merah. Total 5 stat cards di dashboard. |
| **5 Kartu 1 Baris Desktop** | ✅ | 2026-07-22 | `stats-grid` diubah dari `repeat(auto-fit, minmax(220px,1fr))` jadi `repeat(5, 1fr)` — 5 kartu dalam 1 baris. Mobile tetap 2/1 kolom. |

## ═══════════════════════════════════════════════
## COMPANY SDK REFACTORING (2026-07-16)
## ═══════════════════════════════════════════════

### Company SDK — New Architecture

Folder `packages/smart-core/src/company/` diubah menjadi Company SDK dengan struktur berikut:

| Module | File | Description |
|--------|------|-------------|
| Company Context | `company-context.js` | (Dipertahankan) Module-level context dengan backward-compatible function API (setCompanyContext, getCompanyCode, tagWithCompany, filterByCompany). |
| Branding | `branding.js` | `BrandingManager` — decoupled dari company-context. Menerima data via `loadFromCompany()` dan `setOverrides()`. Menyediakan logo, favicon, companyName, workspace, theme, dll. |
| Company Types | `company-types.js` | `COMPANY_TYPES` — Disederhanakan menjadi 8 jenis: PT, CV, Perorangan, BUMDes, Koperasi, Pesantren, Pemerintah, Lainnya. |
| **Company Storage** | `company-storage.js` | **NEW** `SmartStorage` — storage abstraction dengan localStorage fallback ke in-memory Map. Prefix "smart_company_". |
| **Company Validator** | `company-validator.js` | **NEW** Validation helpers: validateCompanyCode(), validateCompanyName(), validateEmail(), validatePhone(), validateCompanyType(), validateCompanyData(). |
| **Company Session** | `company-session.js` | **NEW** `CompanySession` — mengelola session perusahaan. Fields: userId, companyId, companyCode, companyName, companyType, applicationId, workspace, role, permissions, logo, theme. Methods: create(), get(), update(), save(), load(), restore(), destroy(), isActive(). |
| **Company Manager** | `company-manager.js` | **NEW** `CompanyManager` — orchestrator. Methods: setCompany(), getCompany(), clear(), switchCompany(), loadBranding(), loadWorkspace(). Memiliki onChange() subscribers. |

### SMART.Session — Global Session Singleton

**File:** `packages/smart-core/src/session/index.js` (NEW)

Global singleton `SMART.Session` yang dapat dipanggil dari seluruh aplikasi:

```js
SMART.Session.userId        // Current user ID
SMART.Session.companyId     // Current company database ID
SMART.Session.companyCode   // Current company code
SMART.Session.companyName   // Current company display name
SMART.Session.companyType   // Company type (PT, CV, etc.)
SMART.Session.workspace     // Active workspace
SMART.Session.role          // Current user role
SMART.Session.permissions   // Current user permissions
SMART.Session.logo          // Company logo URL
SMART.Session.theme         // Active theme
```

Methods: `init()`, `getState()`, `save()`, `restore()`, `destroy()`, `update()`

### SMART Namespace — Unified Public API

**File:** `packages/smart-core/src/index.js` (UPDATED)

```js
SMART.Session.companyCode       // Session
SMART.Company.get()              // Company Manager
SMART.Company.branding()         // Branding
SMART.Company.switch()           // Switch Company
SMART.Permission.can()           // Permission check
SMART.Platform.currentApplication()  // Platform
SMART.Audit.log()                // Audit
SMART.Impersonation.loginAs()    // Impersonation
```

`SMART` juga di-attach ke `globalThis` untuk akses dari console.

### BaseRepository — Auto Company Scoping

**File:** `packages/smart-data/src/base-repository.js` (UPDATED)

`BaseRepository` sekarang otomatis membaca companyCode dari `SMART.Session`:

```js
// Methods baru:
_getCompanyCode()  // Reads from SMART.Session
_tagWithCompany()  // Auto-tags data with companyCode
_filterByCompany() // Auto-filters items by companyCode
```

Programmer tidak perlu lagi memanggil `getCompanyCode()`, `tagWithCompany()`, atau `filterByCompany()` secara manual.

### Inventory Data Layer — Cleanup

| File | Change |
|------|--------|
| `settings-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper `_filterData()` / `_tagData()` yang membaca dari SMART.Session. |
| `barang-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper. |
| `supplier-data.js` | Hapus import `filterByCompany`, `tagWithCompany` dari framework. Gunakan local helper. |
| `api.js` | Mempertahankan `getCompanyCode()` untuk header `x-company-code` pada API calls. |

### FrameworkContext — Updated

**File:** `packages/smart-core/src/context/index.js` (UPDATED)

Sekarang subscribe ke:
- `Auth.onChange()` — auth state
- `companySession.onChange()` — session changes
- `companyManager.onChange()` — company manager changes
- `branding.onChange()` — branding changes
- `Permission.onChange()` — permission changes

### Backward Compatibility

Semua export lama tetap berfungsi:
- `setCompanyContext()`, `getCompanyCode()`, `getCompanyName()`, `clearCompanyContext()`, `hasCompanyContext()`, `tagWithCompany()`, `filterByCompany()`
- `branding`, `companyManager`
- `COMPANY_TYPES`, `getCompanyTypeOptions()`
- `framework`, `impersonation`, `audit`, `platform`

### Architecture Diagram (Updated)

```
@smart/core                             Inventory (thin)
──────────                             ────────────────
  ├── auth/                            apps/inventory
  ├── permission/                        ├── data/
  │   └── roles.js ← Namespace perms    │   ├── settings-data.js
  ├── company/     ← COMPANY SDK        │   ├── barang-data.js
  │   ├── company-manager.js             │   ├── supplier-data.js
  │   ├── company-session.js             │   ├── api.js
  │   ├── company-storage.js             │   ├── superadmin-data.js
  │   ├── company-validator.js           │   └── [framework re-exports]
  │   ├── branding.js                    ├── pages/ (7 pages)
  │   ├── company-context.js  ← @deprecated  ├── config/
  │   └── company-types.js               └── router/
  ├── session/       ← SMART.Session (nested)
  ├── context/       ← FrameworkContext
  ├── impersonation/
  ├── audit/
  └── platform/     ← Enhanced (workspace, subscription)

@smart/data
  ├── base-repository.js  ← Auto company + audit fields
  ├── DB SDK               ← SMART.DB namespace
  └── ...

@smart/api
  ├── fallback utilities   ← API-first with local fallback
  └── API SDK              ← SMART.API namespace

@smart/ui
  ├── components/          ← 22 UI components
  ├── layouts/             ← Sidebar, Topbar, Shell
  ├── module/settings/     ← Company, User, Role, Permission
  └── UI SDK               ← SMART.UI namespace
```

## ═══════════════════════════════════════════════
## ARCHITECTURE REFINEMENT (2026-07-16)
## ═══════════════════════════════════════════════

### Ringkasan Perubahan

Framework SMART telah ditransformasi menjadi **Enterprise SDK** dengan 9 namespace publik:

| SDK | Namespace | Package | Status |
|-----|-----------|---------|--------|
| Session | `SMART.Session` | @smart/core | ✅ Nested object structure |
| Company | `SMART.Company` | @smart/core | ✅ 15 methods |
| Database | `SMART.DB` | @smart/data | ✅ 10 methods |
| API | `SMART.API` | @smart/api | ✅ 7 methods |
| UI | `SMART.UI` | @smart/ui | ✅ 11 components |
| Permission | `SMART.Permission` | @smart/core | ✅ Namespace-based |
| Platform | `SMART.Platform` | @smart/core | ✅ Enhanced |
| Audit | `SMART.Audit` | @smart/core | ✅ Global service |
| Impersonation | `SMART.Impersonation` | @smart/core | ✅ Global service |

### ═══════════════════════════════════════════════
### FACADE ARCHITECTURE — PUBLIC SDK (2026-07-16)
### ═══════════════════════════════════════════════

Setelah Architecture Refinement, framework ditingkatkan dengan **Facade Pattern**:

**ONE PACKAGE = ONE PUBLIC FACADE**

Programmer aplikasi TIDAK BOLEH mengetahui implementasi internal framework.
Programmer cukup mengenal `SMART.*` dan setiap package hanya mengekspos SATU Facade.

#### Architecture

| Package | Facade File | Public API | Internal Implementation |
|---------|-------------|------------|------------------------|
| @smart/core | `facade.js` | `SMART` (9 namespaces) | auth, permission, company/*, session, context, impersonation, audit, platform |
| @smart/data | `db-facade.js` | `DB` | base-repository, mongodb, persistence, cache, state |
| @smart/api | `api-facade.js` | `API` | client, error, interceptors, fallback |
| @smart/ui | `ui-facade.js` | `UI` | components/*, layouts/*, modules/* |

#### Cara Penggunaan

```js
// ✅ BENAR — Facade
import { SMART } from "@smart/core";
import { DB } from "@smart/data";
import { API } from "@smart/api";
import { UI } from "@smart/ui";

SMART.Session.company()
SMART.Company.switch()
DB.collection("barang").find({ page: 1 })
API.get("/api/barang")
UI.Modal({ open: true, title: "Hello" })

// ⚠️ @deprecated — masih berfungsi, akan dihapus
import { Auth, Permission, branding } from "@smart/core";
import { BaseRepository } from "@smart/data";
import { createClient } from "@smart/api";
import { Modal, Toast } from "@smart/ui";
```

#### SMART Facade — Full API Reference

```js
SMART.Session.create(data)      // Buat session baru
SMART.Session.restore()          // Restore dari storage
SMART.Session.save()             // Simpan ke storage
SMART.Session.destroy()          // Hapus session
SMART.Session.refresh()          // Refresh dari storage
SMART.Session.user()             // { id, name, email, role, permissions }
SMART.Session.company()          // { id, code, name, type, logo, branding, workspace }
SMART.Session.application()      // { id, code, name, version }
SMART.Session.workspace()        // String
SMART.Session.theme()            // "light" | "dark"

SMART.Company.get()              // Current company info
SMART.Company.set(code, name)    // Set company context
SMART.Company.clear()            // Clear company
SMART.Company.switch(code)       // Switch company
SMART.Company.branding()         // { logo, favicon, companyName, theme, workspace }
SMART.Company.validate(data)     // { valid, errors }
SMART.Company.types()            // ["PT", "CV", ...]
SMART.Company.exists()           // Boolean
SMART.Company.logo()             // String|null
SMART.Company.theme()            // String

SMART.DB.collection(name)        // Collection proxy
SMART.DB.find(collection, p)     // Shorthand
SMART.DB.findOne(c, id)          // Shorthand
SMART.DB.insert(c, d)            // Shorthand

SMART.API.get(url, params)       // HTTP GET
SMART.API.post(url, body)        // HTTP POST
SMART.API.put(url, body)         // HTTP PUT
SMART.API.delete(url)            // HTTP DELETE
SMART.API.upload(url, fd)        // File upload
SMART.API.download(url)          // File download

SMART.Permission.can(perm)       // Check permission
SMART.Permission.cannot(perm)    // Inverse check
SMART.Permission.hasRole(role)   // Check role
SMART.Permission.assign(r, p)    // Grant permission
SMART.Permission.revoke(r, p)    // Revoke permission

SMART.Platform.currentApp()      // Current application
SMART.Platform.currentCompany()  // Current company
SMART.Platform.loginAsCompany()  // Impersonate
SMART.Platform.subscription()    // Check subscription

SMART.Audit.log(entry)           // Record audit entry
SMART.Audit.history(filters)     // Get audit history

SMART.Impersonation.loginAs(s)   // Start impersonation
SMART.Impersonation.isImpersonating()  // Check
SMART.Impersonation.end()        // End impersonation

SMART.UI.Modal(opts)             // Open modal
SMART.UI.Toast(opts)             // Show toast
SMART.UI.PageContainer(opts)     // Page layout
```

#### Package Exports (Clean)

**@smart/core (index.js):**
```js
export { SMART, default } from "./facade.js";                // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/data (index.js):**
```js
export { DB } from "./db-facade.js";                           // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/api (index.js):**
```js
export { API } from "./api-facade.js";                         // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

**@smart/ui (index.js):**
```js
export { UI, loadUI } from "./ui-facade.js";                  // ✅ PRIMARY
// @deprecated backward compat exports berikutnya
```

#### New Files Created (4)

| File | Purpose |
|------|---------|
| `packages/smart-core/src/facade.js` | SMART namespace — 9 sub-namespaces, globalThis.SMART |
| `packages/smart-data/src/db-facade.js` | DB namespace — collection CRUD + auto companyCode scoping |
| `packages/smart-api/src/api-facade.js` | API namespace — HTTP methods + auto company headers |
| `packages/smart-ui/src/ui-facade.js` | UI namespace — 12 components + globalThis.SMART.UI |

#### Files Modified (4)

| File | Change |
|------|--------|
| `smart-core/src/index.js` | Hanya export SMART facade + @deprecated backward compat |
| `smart-data/src/index.js` | Hanya export DB facade + @deprecated backward compat |
| `smart-api/src/index.js` | Hanya export API facade + @deprecated backward compat |
| `smart-ui/src/index.js` | Hanya export UI facade + @deprecated backward compat |

#### DB Enhancement: Auto Multi-Tenant

`DB.collection().find()` sekarang otomatis menambahkan `companyCode` filter:
```js
// Sebelum
DB.collection("barang").find({ page: 1 })
// → GET /api/barang?page=1 (SEMUA company)

// Sesudah
DB.collection("barang").find({ page: 1 })
// → GET /api/barang?page=1&companyCode=XXX (HANYA company saat ini)
```

#### Test Results
- ✅ **508 tests passing** — semua test suite sukses
- ✅ Syntax check pada semua file Facade
- ✅ Code review approved

### Perubahan Detail per Phase

#### PHASE 1: Deprecated API
Fungsi berikut ditandai `@deprecated` di `company-context.js`:
- `setCompanyContext()` → ganti dengan `SMART.Company.set()`
- `getCompanyCode()` → ganti dengan `SMART.Session.get("company.code")`
- `getCompanyName()` → ganti dengan `SMART.Session.get("company.name")`
- `clearCompanyContext()` → ganti dengan `SMART.Company.clear()`
- `hasCompanyContext()` → ganti dengan `SMART.Session.get("company.code")` (bukan `isAuthenticated()`, karena company context ≠ user login)
- `tagWithCompany()` → ganti dengan `BaseRepository._tagWithCompany()`
- `filterByCompany()` → ganti dengan `BaseRepository._filterByCompany()`

#### PHASE 2: SMART.Session — Nested Object Structure
```js
SMART.Session.user.id
SMART.Session.user.name
SMART.Session.user.email
SMART.Session.user.role
SMART.Session.company.id
SMART.Session.company.code
SMART.Session.company.name
SMART.Session.company.type
SMART.Session.company.logo
SMART.Session.company.branding
SMART.Session.company.workspace
SMART.Session.application.id
SMART.Session.application.code
SMART.Session.application.name
SMART.Session.application.version
SMART.Session.theme
SMART.Session.locale
SMART.Session.authenticated
```

Methods: `create()`, `restore()`, `save()`, `refresh()`, `destroy()`, `get(path)`

#### PHASE 3: SMART.Company — Full API
```
get(), set(), clear(), switchTo(), switch(),
branding(), validate(), types(), typeOptions(),
logo(), theme(), workspace(), tag(), filter(),
getCode(), getName(), loadBranding(), loadWorkspace()
```

#### PHASE 4-5: SMART.DB — Database SDK
```
DB.collection(name).find(params)
DB.collection(name).findOne(id)
DB.collection(name).insert(data)
DB.collection(name).update(id, data)
DB.collection(name).delete(id)
DB.collection(name).aggregate(pipeline)
DB.collection(name).transaction(operations)
DB.collection(name).batch(docs)
DB.collection(name).watch(pipeline)

// Shorthands:
DB.find(collection, params)
DB.findOne(collection, id)
DB.insert(collection, data)
DB.aggregate(collection, pipeline)
DB.batch(collection, docs)
```

`InMemoryRepository.create()` otomatis menambahkan:
- `companyCode` (dari SMART.Session)
- `createdBy`, `updatedBy` (dari SMART.Session.user.id)
- `createdAt`, `updatedAt` (timestamp)

#### PHASE 6: SMART.API — API SDK
```
API.get(url, params, opts)
API.post(url, body, opts)
API.put(url, body, opts)
API.patch(url, body, opts)
API.delete(url, opts)
API.upload(url, formData, opts)
API.download(url, opts)
```

Aplikasi tidak boleh memakai fetch() secara langsung.

#### PHASE 7: SMART.UI — UI SDK
```
UI.PageContainer(opts)
UI.Modal(opts)
UI.Table(opts)
UI.Form(opts)
UI.Button(opts)
UI.Sidebar(opts)
UI.Topbar(opts)
UI.Notification(opts)  // Toast alias
UI.Loading(opts)       // Skeleton alias
UI.Dialog(opts)
UI.Toast(opts)
UI.load()              // Initialize UI
```

#### PHASE 8: Platform Enhancement
- `getWorkspace(companyId, appSlug)` — workspace per company-app
- `getCurrentApplication()` — app dari session
- `getCurrentCompany()` — company dari session
- `version` field pada Application
- `tier` field pada CompanyApp (subscription tier)

#### PHASE 9: Namespace-based Permissions
```
// Format: {application}.{resource}.{action}
inventory.dashboard.view
inventory.barang.read
inventory.barang.create
inventory.stock.adjust
settings.company.edit
settings.user.manage
settings.permission.manage
```

#### PHASE 10-12: Public SDK
Semua namespace terdaftar di `globalThis.SMART`:
```
SMART.Session
SMART.Company
SMART.DB
SMART.API
SMART.UI
SMART.Permission
SMART.Platform
SMART.Audit
SMART.Impersonation
```

### Migration Guide

**Untuk aplikasi yang sudah ada (Inventory):**

1. Ganti `getCompanyCode()` → `SMART.Session.get("company.code")`
2. Ganti `tagWithCompany(data)` → `BaseRepository._tagWithCompany(data)`
3. Ganti `filterByCompany(items)` → `BaseRepository._filterByCompany(items)`
4. Ganti `setCompanyContext()` → `SMART.Company.set()`
5. Ganti permission `barang.view` → `inventory.barang.read`
6. Ganti permission `settings-user.view` → `settings.user.manage`
7. Inisialisasi: `SMART.DB.init(DB)` dan `SMART.API.init(API)` di main.js

### Deprecated API
| Function | Replacement |
|----------|-------------|
| `setCompanyContext()` | `SMART.Company.set()` |
| `getCompanyCode()` | `SMART.Session.get("company.code")` |
| `getCompanyName()` | `SMART.Session.get("company.name")` |
| `clearCompanyContext()` | `SMART.Company.clear()` |
| `hasCompanyContext()` | `SMART.Session.get("company.code")` |
| `tagWithCompany()` | `BaseRepository._tagWithCompany()` |
| `filterByCompany()` | `BaseRepository._filterByCompany()` |
| Permission `*.view` | Permission `{app}.{resource}.read` |

### Test Results
- ✅ **508 tests passing** — semua test suite sukses
- ✅ Permission tests updated untuk namespace format
- ✅ Menu config updated untuk namespace permissions
- ✅ Permission catalog updated di settings-data

## ═══════════════════════════════════════════════
## FRAMEWORK CLEANUP (2026-07-16)
## ═══════════════════════════════════════════════

### Ringkasan

Membersihkan framework dan memastikan konsistensi arsitektur setelah Facade Architecture:
1. Company-context.js menjadi pure wrapper ke SMART.Company/SMART.Session
2. Export internal dipindahkan ke @deprecated
3. Tidak ada duplicate class/export/circular import
4. Setiap package memiliki SATU public entry point

### Perubahan

| File | Perubahan |
|------|-----------|
| `packages/smart-core/src/company/company-context.js` | Semua fungsi jadi WRAPPER — delegate ke SMART.Company/SMART.Session. Fallback minimal hanya jika SMART belum siap. Hapus duplicate CompanyManager class. |
| `packages/smart-core/src/company/index.js` | LEGACY COMPATIBILITY LAYER header. @deprecated di setiap export legacy. |
| `packages/smart-api/src/index.js` | `apiGetCompanyCode`, `apiHeaders` dipindah dari PRIMARY API ke @deprecated. |
| `docs/execution_status.md` | Ditambahkan section FRAMEWORK CLEANUP. |
| `apps/inventory/src/main.js` | Migrasi `setCompanyContext`/`clearCompanyContext`/`getCompanyCode` ke `SMART.Company.set()`/`SMART.Company.clear()`/`SMART.Session.get("company.code")`. |

### Architecture (Final)

```
Application (Reference: Inventory)
        │
        ▼
SMART Facade  ←  import { SMART } from "@smart/core"
  ├── SMART.Session      — Session SDK
  ├── SMART.Company      — Company SDK
  ├── SMART.DB           — Database SDK (init required)
  ├── SMART.API          — API SDK (init required)
  ├── SMART.UI           — UI SDK (via globalThis)
  ├── SMART.Permission   — Permission SDK
  ├── SMART.Platform     — Platform SDK
  ├── SMART.Audit        — Audit SDK
  └── SMART.Impersonation — Impersonation SDK
        │
        ▼
Internal SDK (tersembunyi)
  ├── auth/, permission/, company/*, session/
  ├── platform/, audit/, impersonation/, context/
  └── @smart/data, @smart/api, @smart/ui
        │
        ▼
Infrastructure (MongoDB, localStorage, fetch, etc.)
```

### Public Entry Points

| Package | Import | Status |
|---------|--------|--------|
| @smart/core | `import { SMART } from "@smart/core"` | ✅ Stable |
| @smart/data | `import { DB } from "@smart/data"` | ✅ Stable |
| @smart/api | `import { API } from "@smart/api"` | ✅ Stable |
| @smart/ui | `import { UI } from "@smart/ui"` | ✅ Stable |

### Legacy yang Dipertahankan (Backward Compatibility)

| File | Alasan |
|------|--------|
| `company-context.js` | Aplikasi lama (Inventory) masih menggunakan `setCompanyContext()`, `getCompanyCode()` |
| `@smart/core` deprecated exports | Aplikasi lama import `Auth`, `Permission`, `branding`, dll |
| `@smart/data` deprecated exports | Aplikasi lama import `BaseRepository`, `InMemoryRepository` |
| `@smart/api` deprecated exports | Aplikasi lama import `apiListFallback`, `apiFetch`, dll |
| `@smart/ui` deprecated exports | Aplikasi lama import `Modal`, `Toast`, `Table` langsung |

### Technical Debt (Remaining)

| Item | Priority | Notes |
|------|----------|-------|
| `SMART.DB.init()` & `SMART.API.init()` belum di-wire | Low | Untuk akses SMART.DB/API langsung |
| `UI.Form` belum ada di library | Low | Buat komponen jika dibutuhkan |
| `hasRole()` compare display name bukan role key | Low | `hasRole("superadmin")` vs "Super Admin" |
| Inventory import `@smart/ui/layouts`, `@smart/ui/modules` | Low | Bypass facade, tapi backward compat |
| Deprecated API masih diexport | Low | Untuk backward compatibility, akan dihapus setelah migrasi penuh |

## ═══════════════════════════════════════════════
## SUPER ADMIN DASHBOARD — HEADER & UI FIXES (2026-07-22)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Header: User login info** | ✅ | 2026-07-22 | `pd-user-name` span ditambahkan di header, diisi dari `Auth.user()` via `initPlatformDashboard()`. |
| **Framework** | **Header: Background biru keunguan** | ✅ | 2026-07-22 | `.pd-header` background diubah dari `linear-gradient(135deg, #1e293b, #334155)` → `linear-gradient(135deg, #1e1b4b, #7c3aed)`. |
| **Framework** | **Header HP: User name + Logout di kanan** | ✅ | 2026-07-22 | Mobile: `.pd-user-info` jadi `flex-end`, user name (tanpa badge) + logout berjejer di sisi kanan. Badge Super Admin tetap hidden di HP. |
| **Framework** | **Header Desktop: Badge pindah ke kanan dekat logout** | ✅ | 2026-07-22 | Badge dipindah dari dalam `.pd-user-detail` ke `.pd-user-actions` wrapper agar duduk di kanan dekat tombol Logout. |
| **Framework** | **User Tab: Card view default** | ✅ | 2026-07-22 | `showSuperAdminManagement()` ditambah `pd-user-cards-area`. `renderUserCards()` selalu tampilkan cards (table hidden). Menggunakan `UI.CardList()`. |
| **Framework** | **Apps Tab: Hapus tombol Hapus Logo (✕)** | ✅ | 2026-07-22 | Tombol `✕` merah dihapus dari app card template beserta event handler (server sync, callback, localStorage) dan CSS. |
| **Framework** | **Apps Tab: Hapus lingkaran abu-abu logo** | ✅ | 2026-07-22 | `.pd-app-logo-section` — hapus `border-radius:50%`, `background:#f1f5f9`, `border:3px solid`, `width/height` fixed. Ikon tetap center. |
| **Framework** | **Apps Tab: Logo custom di heading company view** | ✅ | 2026-07-22 | `showCompaniesView()` sekarang tampilkan uploaded app logo (`getAppLogo(appSlug)`) sebagai `<img>` di heading, bukan default icon. CSS `.pd-view-app-logo` 28x28px. |
| **Inventory** | **Login: Pesan error perusahaan non-aktif** | ✅ | 2026-07-22 | Client-side login (`initLoginPage`) diperbaiki: jika server return error (401/403), baca `errData.error` dari response dan tampilkan langsung, bukan fallback ke "Username atau password salah". |

## ═══════════════════════════════════════════════
## RAK ETALASE — MASTER DATA (2026-07-22)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Sidebar: Menu Rak Etalase** | ✅ | 2026-07-22 | Sub-menu "Rak Etalase" 🏪 ditambahkan di Master setelah Warehouse. Permission: `inventory.rak.read`. |
| **Server** | **Rak MongoDB Model + Route** | ✅ | 2026-07-22 | `server/models/Rak.js` — kode, nama, lokasi, deskripsi, companyCode. `server/routes/rak.js` — full CRUD with company scoping. |
| **Client** | **Rak Data Service** | ✅ | 2026-07-22 | `src/data/rak-data.js` — API-first with in-memory fallback. 5 seed items (Rak A1, A2, B1, E1, E2). |
| **Client** | **Rak CRUD Page** | ✅ | 2026-07-22 | `src/pages/rak/index.js` — duplikasi dari satuan. Kolom tabel: kode, nama rak/etalase, lokasi, deskripsi. Card HP & form modal. |
| **Inventory** | **Barang: Rak dropdown dinamis** | ✅ | 2026-07-22 | Input `rak` di form Barang diubah dari free-text menjadi dropdown yang membaca dari `listRak()`. Konsisten dengan dropdown Kategori & Satuan. |
| **Infra** | **Server Routes Registered** | ✅ | 2026-07-22 | `/api/rak` terdaftar di `server/index.js`. Router client terdaftar di `routes.js`. |
| **Infra** | **Frontend Rebuild** | ✅ | 2026-07-22 | Build sukses. |

## ═══════════════════════════════════════════════
## COMPANY TYPES + WILAYAH SELECTOR (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **COMPANY_TYPES diselaraskan dengan Register form** | ✅ | 2026-07-23 | `company-types.js` diupdate: tambah Yayasan, Firma, Pemdes; hapus Pesantren, Pemerintah. Sekarang 9 jenis: PT, CV, Yayasan, Koperasi, Firma, Perorangan, BUMDes, Pemdes, Lainnya. Super Admin & Register pakai daftar sama. |
| **Server** | **Route /api/wilayah (hierarchical)** | ✅ | 2026-07-23 | `server/routes/wilayah.js` — GET /provinces, /:prov/regencies, /:prov/:kab/districts, /:prov/:kab/:kec/villages. Membaca dari `shared/data/wilayah.json`. |
| **Inventory** | **Register: Wilayah selector BUMDes/Pemdes** | ✅ | 2026-07-23 | Jika pilih BUMDes/Pemdes, muncul 4 dropdown cascading: Provinsi→Kab→Kec→Desa. Kode otomatis: `{jenis}-{kode_desa}`. Validasi desa wajib. |
| **Framework** | **Dashboard: Wilayah selector BUMDes/Pemdes** | ✅ | 2026-07-23 | Modal Tambah Perusahaan di Super Admin: dropdown jenis diupdate (sama dengan Register). Jika BUMDes/Pemdes: cascading wilayah + kode auto `{jenis}-{kode_desa}`. |
| **Server** | **Register route: BUMDes/Pemdes code** | ✅ | 2026-07-23 | `generateCompanyCode()` sekarang terima `desaCode`. Jika BUMDes/Pemdes + desaCode: return `${jenis}-${desaCode}` langsung. Juga terima `code` dari body. |
| **Infra** | **509 tests PASS + Build sukses** | ✅ | 2026-07-23 | Semua test lulus (509/509). Vite build sukses (1.20s). |
| **Framework** | **SearchableSelect component** | ✅ | 2026-07-23 | `packages/smart-ui/src/components/searchable-select/` — dropdown dengan filter pencarian. `UI.SearchableSelect(el, opts)`. Keyboard nav, click-outside-close, destroy() cleanup. |
| **Framework** | **SearchableSelect dipakai di Register + Dashboard** | ✅ | 2026-07-23 | Wilayah dropdown di Register form dan Dashboard Super Admin pakai `UI.SearchableSelect` agar pencarian provinsi/kabupaten/kecamatan/desa mudah. |

## ═══════════════════════════════════════════════
## GOOGLE AUTH — AUTO-LOGIN FIX (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Server** | **Google auto-login untuk user existing** | ✅ | 2026-07-23 | `server/routes/auth-google.js` — jika email sudah terdaftar, balikkan 200 + data user (auto-login langsung ke dashboard), bukan 409 error. Flow: pertama → 404 → register. Kedua → 200 → dashboard. |

## ═══════════════════════════════════════════════
## BARANG — RAK FIX + GUDANG FIELD (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Server** | **Barang Model: rak field ditambahkan** | ✅ | 2026-07-23 | `rak` ditambahkan ke Mongoose schema Barang. Sebelumnya tidak ada di schema → Mongoose `strict: true` menghapus field saat save → dropdown rak kosong saat edit. Root cause fix. |
| **Server** | **Barang Model: gudang field baru** | ✅ | 2026-07-23 | `gudang: { type: String, default: "" }` ditambahkan ke schema Barang. |
| **Inventory** | **Barang: data service + gudang** | ✅ | 2026-07-23 | `rak` dan `gudang` ditambahkan di `createBarangLocal()` dan `updateBarangLocal()` di `barang-data.js`. |
| **Inventory** | **Barang: Form Gudang dropdown** | ✅ | 2026-07-23 | Dropdown Gudang di form Barang, membaca dari `listWarehouse()`. Kolom Gudang di tabel desktop. Baris Gudang di detail modal. |
| **Inventory** | **Barang: Gudang required + validasi** | ✅ | 2026-07-23 | Label Gudang diberi `*` merah. Validasi: jika gudang kosong saat submit → toast warning + fokus ke dropdown gudang. Wajib diisi. |
| **Infra** | **Build + Server Restart** | ✅ | 2026-07-23 | Vite build sukses. PM2 restart inventory-server. 509/509 tests PASS. |

## ═══════════════════════════════════════════════
## REFACTOR — LOGIN & REGISTER KE FRAMEWORK (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Login Module → smart-ui/modules/auth** | ✅ | 2026-07-23 | `packages/smart-ui/src/modules/auth/login.js` — `LoginPageComponent` + `initLoginPageComponent` dengan DI. Support Google Sign-In, custom `loginFn`, `onRegisterClick`, `onForgotPassword`. |
| **Framework** | **Register Module → smart-ui/modules/auth** | ✅ | 2026-07-23 | `packages/smart-ui/src/modules/auth/register.js` — `RegisterPageComponent` + `initRegisterPageComponent` dengan DI. Support BUMDes/Pemdes wilayah selector, Google auto-fill, custom `registerFn`/`generateCodeFn`/`wilayahBaseUrl`. |
| **Framework** | **Auth Module index updated** | ✅ | 2026-07-23 | `packages/smart-ui/src/modules/auth/index.js` — export `LoginPageComponent`, `initLoginPageComponent`, `RegisterPageComponent`, `initRegisterPageComponent`. |
| **Inventory** | **Login page jadi thin wrapper** | ✅ | 2026-07-23 | `apps/inventory/src/pages/login/index.js` — re-export dari `@smart/ui`. |
| **Inventory** | **Register page jadi thin wrapper** | ✅ | 2026-07-23 | `apps/inventory/src/pages/register/index.js` — re-export dari `@smart/ui`. |
| **Inventory** | **main.js: API options object** | ✅ | 2026-07-23 | `initLoginPage({onSuccess, onRegisterClick})` dan `initRegisterPage({onSuccess, onBackToLogin, prefill})`. |
| **Framework** | **Fix: Error login tampil pesan server** | ✅ | 2026-07-23 | catch block `showError(err.message || ...)` — server error message tampil, bukan generic. |
| **Framework** | **Fix: SearchableSelect static import** | ✅ | 2026-07-23 | Ganti `import("@smart/ui")` dinamis jadi `import { UI }` statis di register.js. |
| **Infra** | **509 tests PASS + Build sukses** | ✅ | 2026-07-23 | Semua test lulus (509/509). Vite build sukses.


## ═══════════════════════════════════════════════
## DASHBOARD FRAMEWORK MODULE (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **DashboardModule → smart-ui** | ✅ | 2026-07-23 | `DashboardModule({ listBarang, listSupplier, listActivity, ... })` — DI-based. Semua HTML, CSS, init, & activity loading pindah ke framework. |
| **Inventory** | **Dashboard thin wrapper (15 baris)** | ✅ | 2026-07-23 | `apps/inventory/src/pages/dashboard/index.js` turun dari 397 baris jadi 15 baris — import DashboardModule, inject data services. |
| **Framework** | **Dashboard export di package.json** | ✅ | 2026-07-23 | `@smart/ui/package.json` ditambah `./modules/dashboard` export. `packages/smart-ui/src/index.js` re-export. |

## ═══════════════════════════════════════════════
## EMAIL SERVICE — SMTP OPTIMASI + RESEND INTEGRASI (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Server** | **SMTP: Connection pooling** | ✅ | 2026-07-23 | `pool:true`, maxConnections:3, maxMessages:20, rateLimit:5. Connection timeout 10s. |
| **Server** | **SMTP: Auto-retry 3x + backoff** | ✅ | 2026-07-23 | Retry exponential backoff 2s/4s/8s untuk transient SMTP failures. |
| **Server** | **SMTP: Connection verify startup** | ✅ | 2026-07-23 | `transporter.verify()` dipanggil non-blocking saat server start. |
| **Server** | **Fire-and-forget email sending** | ✅ | 2026-07-23 | `sendResetPasswordEmailAsync()` — kirim email di background, response API tidak blocking. |
| **Server** | **Resend API integration** | ✅ | 2026-07-23 | `npm install resend`. API key di `.env`. `sendViaResend()` sebagai primary email sender. |
| **Server** | **Fallback chain: Resend → SMTP → Dev** | ✅ | 2026-07-23 | Priority: 1) Resend API (cepat, reliable), 2) SMTP hosting (retry 3x), 3) Dev mode log. |
| **Server** | **GenerateToken: crypto.randomBytes** | ✅ | 2026-07-23 | Fix `import crypto` + hapus dead code `Uint32Array`. Token sekarang pake Node.js crypto. |


## ═══════════════════════════════════════════════
## GENERIC CRUD MODULE — FRAMEWORK REFACTOR (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **CrudModule factory → smart-ui** | ✅ | 2026-07-23 | `CrudModule(config)` di `packages/smart-ui/src/modules/master-crud/index.js`. Menangani semua boilerplate: loadData, renderModal, confirmDelete, pagination, search, card view, form submission, delete confirmation. Semua CSS (crud-page, form-grid) pindah ke framework. |
| **Framework** | **CrudModule exports** | ✅ | 2026-07-23 | `package.json` ditambah `./modules/master-crud` export. `index.js` re-export `CrudModule`. |
| **Inventory** | **Kategori → thin wrapper** | ✅ | 2026-07-23 | 257 → 61 baris. Import CrudModule dari @smart/ui. |
| **Inventory** | **Satuan → thin wrapper** | ✅ | 2026-07-23 | 257 → 61 baris. |
| **Inventory** | **Warehouse → thin wrapper** | ✅ | 2026-07-23 | 275 → 82 baris. |
| **Inventory** | **Rak → thin wrapper** | ✅ | 2026-07-23 | 272 → 73 baris. |
| **Inventory** | **Customer → thin wrapper** | ✅ | 2026-07-23 | 279 → 87 baris. |
| **Inventory** | **Supplier → thin wrapper** | ✅ | 2026-07-23 | 277 → 87 baris. |
| **Infra** | **Build + Test** | ✅ | 2026-07-23 | Build 766ms. 509 tests PASS. |


## ═══════════════════════════════════════════════
## RESET PASSWORD — NGINX X-FRAME-OPTIONS & FAVICON (2026-07-23)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Infra** | **Nginx: X-Frame-Options + CSP frame-ancestors** | ✅ | 2026-07-23 | `inv.e-profit.id.conf` & `master.e-profit.id.conf` ditambah `X-Frame-Options: SAMEORIGIN` dan `Content-Security-Policy: frame-ancestors 'self';` di `location /`. Mencegah halaman dimuat di cross-origin sandboxed iframe (seperti Gmail desktop link preview). |
| **Infra** | **Nginx: Deploy & Reload** | ✅ | 2026-07-23 | Manual copy config ke `/etc/nginx/sites-available/`. Config test OK, reload sukses. |
| **Infra** | **Nginx: Cleanup app-template.conf symlink** | ✅ | 2026-07-23 | Hapus symlink `app-template.conf` yang broken (placeholder `PORT`) dari `/etc/nginx/sites-enabled/` yang blocking nginx reload. |
| **Inventory** | **Reset Password: Favicon** | ✅ | 2026-07-23 | `main.js` — route handler `/reset-password` sekarang set favicon dengan prioritas: localStorage → `/api/platform/app-logo/inventory` → `fetchCompanyLogo()`. Sama dengan halaman login & superadmin. |


## ═══════════════════════════════════════════════
## DUPLIKAT KODE — VALIDASI + ALERT RED + CASE-INSENSITIVE (2026-07-26)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Barang: Duplikat kode → Alert merah + disable nama** | ✅ | 2026-07-26 | `validateKode()` di `barang/index.js`. Jika kode duplikat: Alert merah muncul ✕, field Nama & tombol Submit di-disable. Ganti kode → Nama & Submit aktif lagi. |
| **Framework** | **Barang: Case-insensitive kode** | ✅ | 2026-07-26 | `Kopi-001` == `kopi-001` == `KOPI-001` dianggap duplikat. `.toLowerCase()` di client + `$regex` case-insensitive di server `check-kode/:kode`. |
| **Framework** | **Barang: Auto-focus ke field kode** | ✅ | 2026-07-26 | Saat modal buka, kursor langsung ke `#f-kode`, bukan ke `#f-nama`. |
| **Framework** | **CrudModule: Alert merah + disable nama (6 master)** | ✅ | 2026-07-26 | `validateKode()` + `clearKodeError()` di `packages/smart-ui/src/modules/master-crud/index.js`. Sama persis dengan Barang: Alert merah, Nama disabled, Submit disabled. `grid-column:1/-1` pakai inline JS karena CSS scoped gak kena di modal. |
| **Framework** | **CrudModule: Case-insensitive + auto-focus kode** | ✅ | 2026-07-26 | 6 master sub-menu (Kategori, Satuan, Rak, Supplier, Customer, Warehouse) — case-insensitive `.toLowerCase()`, focus ke `#f-kode`. |
| **Framework** | **Alert position: appendChild ke dalam form-group** | ✅ | 2026-07-26 | Error div di-appendChild ke DALAM `.form-group` (#f-kode parent), bukan sebagai sibling grid. Persis seperti Barang module. Tidak perlu `grid-column`. |
| **Server** | **6 routes: /check-kode/:kode** | ✅ | 2026-07-26 | Kategori, Satuan, Rak, Supplier, Customer, Warehouse — endpoint GET case-insensitive regex. Ditaruh SEBELUM `/:id` biar gak conflict. |
| **Client** | **6 data services: checkKodeExists + duplicate** | ✅ | 2026-07-26 | kategoridata, satuan, rak, supplier, customer, warehouse — fungsi `checkKodeExists()`, validasi duplikat di `createLocal()`/`updateLocal()`. |
| **Build** | **Build + Test** | ✅ | 2026-07-26 | Build ~920ms. 509 tests PASS. |

## ═══════════════════════════════════════════════
## SHARED HELPERS — EKSTRAKSI DUPLIKAT KODE (2026-07-26)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **helpers.js: checkKodeExists + findDuplicateKode** | ✅ | 2026-07-26 | `apps/inventory/src/data/helpers.js` — 2 fungsi shared: `checkKodeExists(endpoint, items, kode)` (API-first), `findDuplicateKode(items, kode, excludeId)` (local only). Case-insensitive, company-scoped. |
| **Client** | **6 data services → pake helper** | ✅ | 2026-07-26 | Kategori, Satuan, Rak, Supplier, Customer, Warehouse — semua import `checkKodeExists as checkKodeExistsHelper` + `findDuplicateKode` dari helpers. Hemat ~140 baris duplikasi kode. |
| **Build** | **Build + Test** | ✅ | 2026-07-26 | Build sukses. 509 tests PASS. |

## ═══════════════════════════════════════════════
## PEMBELIAN — STATE RESET REFACTOR (2026-07-26)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Pembelian: State reset di initPembelianPage()** | ✅ | 2026-07-26 | `packages/smart-ui/src/modules/pembelian/index.js` — state di-reset di awal `initPembelianPage()`: items `[]`, pagination default, search kosong, loading `false`, editingId `null`. Memastikan tiap init state fresh. |
| **Build** | **Build + Test** | ✅ | 2026-07-26 | Build 878ms. 509 tests PASS. |


## Legend
## Legend
- ✅ Completed — Fitur selesai dan stabil
- 🔄 Transition — Masih ada, tapi diganti dengan API baru
- ⬜ Planned — Belum dikerjakan
- ❌ Blocked — Ada kendala

## ═══════════════════════════════════════════════
## PENJUALAN — SALES ORDER MODULE (2026-07-27)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Penjualan: SO/SJ/Invoice/Nota/Kwitansi Print** | ✅ | 2026-07-27 | Modul Penjualan dengan lifecycle: SO → Surat Jalan → Invoice → Nota → Kwitansi. Cetak langsung ke dialog print via `printToWindow()`. QR code di SO, SJ, Invoice, Nota. |
| **Inventory** | **Penjualan: Surat Jalan format khusus** | ✅ | 2026-07-27 | SJ tanpa nominal, hanya kode+nama+qty+satuan+keterangan. TTD Penerima & Pengirim dengan placeholder. |
| **Inventory** | **Penjualan: Invoice & Nota Penjualan** | ✅ | 2026-07-27 | Invoice (normal) + Nota Penjualan (normal + thermal/struk). QR code, TTD 1 orang (Dibuat oleh). |
| **Inventory** | **Penjualan: Kwitansi** | ✅ | 2026-07-27 | Kwitansi dengan total pembayaran, terbilang, TTD bendahara. Nama kota dari alamat perusahaan. |
| **Inventory** | **Penjualan: Stock otomatis berkurang saat SJ** | ✅ | 2026-07-27 | Status delivered → generate noSuratJalan + kurangi stock. Delete SO → reversal stock. |
| **Inventory** | **Penjualan: Nomor urut per tahun** | ✅ | 2026-07-27 | SO, SJ, INV, KWT masing-masing punya counter terpisah. Reset tiap tahun. |
| **Inventory** | **Penjualan: Sales Master Data** | ✅ | 2026-07-27 | Sub-menu Sales di Master. Duplikasi dari Customer. Dropdown Sales di form SO + TTD "Dibuat oleh" nama sales. |
| **Inventory** | **Penjualan: Kirim Dari (Gudang)** | ✅ | 2026-07-27 | Field dropdown gudang di form SO. Tampil sebagai "Kirim Dari" di cetakan. |
| **Inventory** | **Penjualan: Auto-print dialog** | ✅ | 2026-07-27 | Semua cetakan langsung trigger dialog print via `printToWindow()` — tanpa Ctrl+P. |
| **Framework** | **Shared printToWindow utility** | ✅ | 2026-07-27 | `printToWindow(html, label, triggerParentPrint)` ditambahkan ke `@smart/ui/ui-facade.js` sebagai shared utility. Pembelian & Penjualan pakai fungsi yang sama. |
| **Inventory** | **Penjualan: Delete all status** | ✅ | 2026-07-27 | DELETE route izinkan hapus semua status dengan reversal stock. Tombol 🗑️ di semua baris, pindah ke akhir kolom aksi. |
| **Inventory** | **Penjualan: Sales dihapus dari info grid SO** | ✅ | 2026-07-27 | Kolom Sales di info grid cetakan SO dihapus karena sudah ada di signature "Dibuat oleh" di bagian bawah. |
| **Inventory** | **Build & Deploy** | ✅ | 2026-07-27 | Build sukses. Server restart. Semua perubahan aktif. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## PEMBELIAN — Toolbar HP & Retur Manual (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Pembelian: Toolbar HP 1 baris** | ✅ | 2026-08-03 | Search-wrapper flex:1 + min-width:0, page-actions flex-wrap:nowrap, button flex-shrink:0. Pencarian & tombol '+Buat PO Baru' jadi 1 baris di HP. |
| **Inventory** | **Retur Pembelian: Input Manual** | ✅ | 2026-08-03 | Mode select (PO/Manual) di modal retur. Manual: input kode editable+scanner, +Tambah Item Barang, nama/harga/qty editable, tombol Tutup. Datalist auto-fill. Submit tanpa PO. |
| **Inventory** | **Retur Pembelian: Qty Stok (manual)** | ✅ | 2026-08-03 | Mode manual: kolom Qty PO → Qty Stok, terisi otomatis dari field `stok` master barang via datalist. Validasi qty retur max = stok (PO tetap max = qty PO). |
| **Bugfix** | **attachScanner import + server restart** | ✅ | 2026-08-03 | Fix `ReferenceError: attachScanner is not defined` (import hilang di pembelian). Restart pm2 `inventory-api` → route `/api/retur-pembelian` aktif (sebelumnya 404, server 5 hari belum restart). |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## SPRINT 7 — TRANSFER, OPNAME & MONITORING (2026-07-27 s.d. 07-30)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Transfer: MongoDB Model + Route** | ✅ | 2026-07-27 | `server/models/Transfer.js` — nomor `TRF-DDMMYYYY-XXXX` reset per tahun, status draft → transferred. `server/routes/transfer.js` — full CRUD + `PUT /:id/status` (eksekusi transfer memindahkan stok antar gudang). Company-scoped via `x-company-code`. |
| **Inventory** | **Transfer: Data Service** | ✅ | 2026-07-27 | `src/data/transfer-data.js` — API-first fallback: listTransfer/getTransfer/createTransfer/updateTransfer/updateTransferStatus/deleteTransfer/resetTransferData. |
| **Framework** | **TransferModule → smart-ui** | ✅ | 2026-07-29 | `packages/smart-ui/src/modules/transfer/` — tabel desktop + card mobile, form dengan scanner barcode, filter barang per gudang asal, validasi stok, cetak **Tiket Transfer** normal + thermal via `printToWindow()`. DI-based. |
| **Inventory** | **Transfer: Page + Menu + Router** | ✅ | 2026-07-27 | `src/pages/transfer/index.js` thin wrapper. Menu "Transfer" 🚚 di Transaksi. Route `/transfer` permission `inventory.transfer.read`. |
| **Inventory** | **Stock Opname: MongoDB Model + Route** | ✅ | 2026-07-30 | `server/models/StockOpname.js` — lifecycle draft → in_progress → completed (+cancelled), selisih stok. `server/routes/stock-opname.js` — CRUD + `PATCH /:id/status` + `POST /:id/reconcile` (stok sistem disesuaikan dengan stok fisik) + `GET /barang-stock`. |
| **Inventory** | **Stock Opname: Data Service + Page** | ✅ | 2026-07-30 | `src/data/stock-opname-data.js` (list/get/create/update/delete/status/reconcile/getBarangForOpname). Tab 📋 **Stock Opname** di halaman Inventory (`pages/inventory/index.js`) — CRUD, card view, status flow, reconcile. |
| **Inventory** | **Inventory Monitoring: Route + Data + Page** | ✅ | 2026-07-30 | `server/routes/inventory-monitoring.js` — stats, by-warehouse, low-stock, out-of-stock, recent-movement, stock-value. `src/data/inventory-data.js` + Tab 📊 **Stock Monitoring** di halaman Inventory. |
| **Inventory** | **BarangGudang: Model + Route** | ✅ | 2026-07-27 | `server/models/BarangGudang.js` — stok per gudang (source of truth multi-warehouse). `server/routes/barang-gudang.js` — `GET /` + `POST /init`. |
| **Infra** | **MongoDB Migration → Community Server** | ✅ | 2026-07-28 | Migrasi `mongodb-memory-server` → **MongoDB Community Server 8.0.28** (`mongod.service`, `/var/lib/mongodb`). Data 169 dokumen dipindah. Backup di `/srv/backup/inventory-migration/`. Detail: `docs/mongodb-migration-report.md`. |
| **Framework** | **Scanner: Shared helpers** | ✅ | 2026-07-28 | `scannerSectionHTML()`, `scanButtonHTML()`, `attachScanner()` di `components/scanner/scanner.js` — dipakai bersama Barang, Pembelian, Penjualan, Transfer. Flash effect + beep + switch camera + destroy cleanup. |
| **Framework** | **Dashboard: Stat Penjualan (6 kartu)** | ✅ | 2026-07-27 | Kartu stat 💰 **Penjualan** ditambahkan (total 6 kartu 1 baris desktop, 2 kolom HP). DI `listPembelian`/`listPenjualan`. |
| **Framework** | **Barang: Auto-fill gudang dari rak + kode per gudang** | ✅ | 2026-07-29 | Pilih Rak → Gudang otomatis terisi. Validasi kode unik **per gudang** (kode sama di gudang beda dianggap valid). Card barang menampilkan gudang. |
| **Framework** | **CrudModule: loadFormDependencies + validateForm** | ✅ | 2026-07-27 | Opsi baru di CrudModule: `loadFormDependencies()` (dropdown dinamis async) & `validateForm()` (custom validation sebelum submit). |
| **Framework** | **API: Auto x-user-name header** | ✅ | 2026-07-27 | `fallback.js` auto-attach header `x-user-name` — prioritas SMART.Session → Auth.user → fallback, untuk activity logging. |
| **Framework** | **PenjualanModule & TransferModule exports** | ✅ | 2026-07-29 | `@smart/ui` re-export `PenjualanModule` + `TransferModule` + `printToWindow`. |
| **Inventory** | **Pembelian: Scanner barcode di form** | ✅ | 2026-07-29 | Form item Pembelian memakai shared scanner (📷 per baris) + cetak PO via `printToWindow()`. |

## ═══════════════════════════════════════════════
## PEMBELIAN — LAYOUT ITEM FORM MOBILE FIX (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Pembelian: Ikon kamera di kanan-atas kolom Kode (mobile)** | ✅ | 2026-08-03 | `packages/smart-ui/src/modules/pembelian/index.js` — CSS `@media (max-width:768px)`. Ikon 📷 dipindah dari inline dalam input kode → `position:absolute` `right:0` di KANAN-ATAS kolom isian kode (scope `:has(.btn-scan)`). Input kode full-width, sejajar & sama ukuran dengan Nama Barang. |
| **Framework** | **Pembelian: Subtotal SAMA PERSIS dengan field lain (mobile)** | ✅ | 2026-08-03 | Nilai subtotal diubah dari `<span>` → **`<input type="text" readonly>`** (PO + Retur) sehingga otomatis memakai rule `.po-item-row input` yang identik dengan Nama Barang/Harga/Diskon — label `::before` (min-width 70px, x=0) + input, tanpa padding ekstra di baris subtotal. Tombol **"Tutup"** (pengganti `[X]`) anchor pindah dari `.po-col-subtotal` ke card (`.po-item-row:has(.po-item-remove) { padding-bottom: 2.3rem }`), posisi tetap kanan-bawah di bawah field subtotal. `recalcRow`/`recalcReturRow` `textContent` → `.value`. `value` di-escape `esc()`. |
| **Framework** | **Pembelian: Kolom Subtotal desktop 90px → 120px** | ✅ | 2026-08-03 | `grid-template-columns` di `.po-items-header`, `.po-item-row`, `.pr-items-header` diubah kolom terakhir 90px → 120px agar chip "Tutup" tidak menutupi digit nilai subtotal di desktop. Mobile tidak terpengaruh (flex layout). |
| **Framework** | **Pembelian: Retur tidak terpengaruh** | ✅ | 2026-08-03 | Scope `:has()` memastikan baris Retur Pembelian (tanpa kamera/tombol X) tidak kena padding baru — layout retur ikut bersih tanpa `padding-right:1.5rem` yang lama. |
| **Build** | **Build + Test** | ✅ | 2026-08-03 | Build inventory sukses. 509 tests PASS. ESLint: 0 issue baru (1 error + 11 warning sudah ada sebelum perubahan). |
| **Framework** | **Pembelian: Format ribuan qty/harga/diskon** | ✅ | 2026-08-03 | Input qty, harga, diskon (PO + Retur) diubah `type=number` → `type=text inputmode=numeric` dengan helper `formatThousand()` (→ `15.000`) & `unformatThousand()` (→ 15000). Handler focus (angka mentah) + blur (format ulang), sanksi digit-only di `input` (anti desimal), `findAndFillBarang` format harga, semua pembaca nilai (recalcRow, calcTotals, handleSubmit, retur) pakai `unformatThousand`. Konsisten dengan format Subtotal. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## PEMBELIAN — Toolbar HP & Retur Manual (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Pembelian: Toolbar HP 1 baris** | ✅ | 2026-08-03 | Search-wrapper flex:1 + min-width:0, page-actions flex-wrap:nowrap, button flex-shrink:0. Pencarian & tombol '+Buat PO Baru' jadi 1 baris di HP. |
| **Inventory** | **Retur Pembelian: Input Manual** | ✅ | 2026-08-03 | Mode select (PO/Manual) di modal retur. Manual: input kode editable+scanner, +Tambah Item Barang, nama/harga/qty editable, tombol Tutup. Datalist auto-fill. Submit tanpa PO. |
| **Inventory** | **Retur Pembelian: Qty Stok (manual)** | ✅ | 2026-08-03 | Mode manual: kolom Qty PO → Qty Stok, terisi otomatis dari field `stok` master barang via datalist. Validasi qty retur max = stok (PO tetap max = qty PO). |
| **Bugfix** | **attachScanner import + server restart** | ✅ | 2026-08-03 | Fix `ReferenceError: attachScanner is not defined` (import hilang di pembelian). Restart pm2 `inventory-api` → route `/api/retur-pembelian` aktif (sebelumnya 404, server 5 hari belum restart). |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## RETUR PEMBELIAN — SUPPLIER DROPDOWN (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Retur Pembelian: Supplier (Kode) & (Nama) jadi dropdown master** | ✅ | 2026-08-03 | Kedua field diubah dari `<input readonly>` → `<select>` di-populate dari `listSupplier`. Cross-fill: pilih kode → nama auto-terisi, pilih nama → kode auto-terisi. Mode PO: select disabled, nilai otomatis dari PO (prefer nama master jika kode cocok). Mode Manual: select enabled. Fallback option otomatis ditambahkan jika supplier lama tidak ada di master (tidak hilang saat edit). |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## RETUR PEMBELIAN — TOMBOL TUTUP DESKTOP & SUPPLIER PO (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Retur: tombol Tutup setelah kolom Subtotal (desktop)** | ✅ | 2026-08-03 | Tombol dipindah keluar dari span subtotal → grid item ke-8. `.pr-item-row:has(.po-item-remove)` + `.pr-items-header` jadi 8 kolom (`...120px auto`), tombol `position:static; justify-self:start` → tepat setelah field Subtotal (sebelumnya berada di tengah antara Harga & Qty Retur). Mobile tidak berubah (media query tetap menang). |
| **Inventory** | **Retur: supplier disembunyikan di mode PO** | ✅ | 2026-08-03 | Baris Supplier (Kode) & (Nama) dibungkus `#pr-supplier-section` (display:none default). Mode PO: tersembunyi (PO sudah include supplier). Mode Manual: ditampilkan + enabled. Nilai tetap diset/dikirim saat tersembunyi. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## RETUR PEMBELIAN — FIX 400 MANUAL MODE (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Bugfix** | **Retur manual: POST 400 → 201** | ✅ | 2026-08-03 | Server `validateItemsAgainstPo` mengembalikan `"Referensi PO wajib diisi"` (400) saat `idPO` kosong — retur manual (tanpa PO) selalu ditolak. Fix: `if (!idPO) return null` (lewati validasi PO di mode manual, berlaku untuk POST & PUT). Toast "berhasil" semu muncul karena `apiFetch` menelan 4xx → fallback lokal. Setelah fix, data tersimpan ke MongoDB. Restart pm2 + verifikasi curl: POST manual → 201, DELETE → 200. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## PEMBELIAN (PO) — TOMBOL TUTUP DESKTOP (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **PO: tombol Tutup setelah kolom Subtotal (desktop)** | ✅ | 2026-08-03 | Tombol dipindah keluar dari span subtotal → grid item ke-8 (sama seperti Retur). Aturan CSS di-generalisasi: `.po-item-row:has(.po-item-remove)` + `.po-item-row .po-item-remove { position:static; justify-self:start }` → berlaku untuk PO & Retur. `.po-items-header` dapat kolom `auto` ke-8. Mobile tidak berubah (media query tetap menang). |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## PENJUALAN & TRANSFER — PARITAS UX DENGAN PEMBELIAN (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Penjualan: format ribuan qty/harga/diskon** | ✅ | 2026-08-03 | Helper `formatThousand`/`unformatThousand` + input `text inputmode=numeric` (focus→mentah, blur→format, digit-only). Semua pembaca nilai (recalc/calcTotals/submit/fill/f-diskon) pakai `unformatThousand`. Subtotal jadi `<input readonly>` identik field lain. |
| **Framework** | **Penjualan: tombol Tutup setelah Subtotal (desktop)** | ✅ | 2026-08-03 | Grid 8 kolom (`100px 180px 50px 60px 80px 70px 90px auto`) utk `.ps-items-header`/`.ps-item-row`/`.prj-items-header`; tombol `[X]` → chip "Tutup"; mobile tombol di kanan-bawah card (`padding-bottom:2.3rem`). |
| **Framework** | **Penjualan: ikon kamera kanan-atas + toolbar HP 1 baris** | ✅ | 2026-08-03 | `:has(.btn-scan) .ps-col-code { padding-top:1.7rem }` + tombol 📷 absolute kanan-atas. Toolbar mobile: `page-header` column, `page-actions` justify-end, search flex:1 → pencarian + tombol "Buat SO Baru" 1 baris di bawah judul. |
| **Inventory** | **Retur Penjualan: opsi Input Manual** | ✅ | 2026-08-03 | Mode select (SO/Manual) di modal retur. Manual: kode editable+scanner, +Tambah Item Barang, nama/harga editable, Qty Stok (dari barang.stok), tombol Tutup, pelanggan dropdown master (cross-fill kode↔nama, tersembunyi di mode SO). Submit tanpa SO (`idSO:""`, `nomorSO:"(Manual)"`). Edit retur manual didukung. Scanner re-attach setelah tambah item. |
| **Framework** | **Transfer: format qty + tombol Tutup + kamera + toolbar** | ✅ | 2026-08-03 | Qty format ribuan; grid 5 kolom (`...auto`); tombol `[X]` → "Tutup"; kamera kanan-atas; toolbar HP 1 baris. |
| **Bugfix** | **Server: retur-penjualan mode manual** | ✅ | 2026-08-03 | `validateItemsAgainstSo`: `if (!idSO) return null` (lewati validasi SO di mode manual, POST & PUT). Verifikasi curl: POST manual → 201, DELETE → 200. Restart pm2. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## SPRINT 8 — LAPORAN MODULE (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Laporan: Server route** | ✅ | 2026-08-03 | `server/routes/laporan.js` — 7 endpoint: `/stock` (per barang + nilaiBeli/nilaiJual + statusStok aman/menipis/habis), `/purchase` & `/sales` (filter tanggal startDate/endDate + search + summary), `/inventory-value` (total + by gudang/kategori), `/mutation` (gabung Pembelian received, Penjualan delivered/invoiced/paid, Transfer transferred, Retur Pembelian/Penjualan returned, Opname completed), `/supplier` & `/customer` (group PO/SO per partner + merge master kontak). Semua company-scoped via `x-company-code`. Validasi tanggal invalid → 400. |
| **Inventory** | **Laporan: Data service** | ✅ | 2026-08-03 | `src/data/laporan-data.js` — API-first via `apiCall`, fallback komputasi lokal dari data service existing (listBarang/listPembelian/dll). Export di `data/index.js`. |
| **Framework** | **LaporanModule → smart-ui** | ✅ | 2026-08-03 | `packages/smart-ui/src/modules/laporan/` — 7 tab laporan, toolbar search + filter tanggal, summary cards, tabel desktop + scroll horizontal, pagination, cetak via `printToWindow()` + `buildPrintHTML()` (header company + TTD). Race-condition guard antar tab, printValue 1 dokumen dengan page-break. DI-based. |
| **Inventory** | **Laporan: Page + Route** | ✅ | 2026-08-03 | `src/pages/report/index.js` thin wrapper. Route `/report` (sebelumnya placeholder) pakai LaporanPage, permission `inventory.report.view` (sudah ada di seed). |
| **Build & Deploy** | **Validasi** | ✅ | 2026-08-03 | 509/509 tests PASS, build sukses, server restart. Curl live: semua 7 endpoint → 200, data nyata (PO-03082026-0003, Aquaviva dll). Invalid date → 400. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## LAPORAN — MENU RENAME + LABA-RUGI + PIUTANG (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Inventory** | **Menu sidebar: Inventory→Persediaan, Report→Laporan** | ✅ | 2026-08-03 | `config/menu.js` — title diubah, page key & permission tidak berubah (tidak ada break pada route/breadcrumb). |
| **Inventory** | **Laporan Laba-Rugi (detail & rekap)** | ✅ | 2026-08-03 | Tab 💹 Laba-Rugi. Server `GET /laporan/labarugi` — SO status delivered/invoiced/paid; **HPP = qty × harga_beli** (map dari master Barang by kode); **Laba Kotor = Penjualan − HPP**; mode `detail` (per SO, paginated) & `rekap` (per bulan + margin %); summary margin otomatis. Fallback lokal di `laporan-data.js`. UI: sub-view Detail/Rekap, search + filter tanggal, kartu summary, cetak via `printToWindow`. Catatan: item yang kodenya tidak ada di master Barang dihitung HPP 0 (laba kotor ter-inflasi) — limitasi diketahui. |
| **Inventory** | **Laporan Piutang (belum lunas + overdue)** | ✅ | 2026-08-03 | Tab 📋 Piutang. Server `GET /laporan/piutang` — SO status delivered/invoiced (belum lunas); **jatuh tempo = tanggalInvoice (atau tanggalSJ/tanggal) + termDays** (default 30, bisa diubah di UI); badge 🟢 Belum tempo / ⚠️ Overdue / 🗓️ Hari ini; summary total piutang, belum jatuh tempo, total overdue, jumlah overdue; filter tanggal + search; cetak. |
| **Framework** | **Bugfix: search/date/pagination laporan tidak re-render** | ✅ | 2026-08-03 | Semua `loadX().then` hanya set state tanpa `renderContent()` → search/filter/pagination di SEMUA tab laporan tidak pernah update tabel. Fix: `renderContent()` + guard `state.activeTab` di setiap loader; `loadLabarugi` tambah guard view (detail/rekap) anti response basi; toggle view render instan. |
| **Framework** | **Laba negatif tampil merah** | ✅ | 2026-08-03 | `.lpr-laba-cell.neg { color:#dc2626 }` — rugi tampil merah, untung hijau. |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |

## ═══════════════════════════════════════════════
## SETTING — PERMISSION & ROLE COMPLETE OVERHAUL (2026-08-03)
## ═══════════════════════════════════════════════

| Roadmap | Task | Status | Date | Notes |
|---------|------|--------|------|-------|
| **Framework** | **Catalog permission lengkap: inventory.rak.*** | ✅ | 2026-08-03 | `PERMISSION_CATALOG` di settings-data.js ditambah `inventory.rak.read/create/update/delete` — sebelumnya menu & route Rak Etalase pakai `inventory.rak.read` tapi tidak ada di catalog → tidak bisa dicentang di halaman Permission. |
| **Framework** | **Checkbox grant/revoke sinkron ke sesi aktif** | ✅ | 2026-08-03 | `grantPermissionToRole`/`revokePermissionFromRole` kini memanggil `Permission.grant()/revoke()` dari @smart/core (hanya jika persist sukses, guard `if (ok)`) → `Permission.can()` langsung akurat tanpa login ulang; route guard & menu langsung terpengaruh. |
| **Framework** | **Role kustom tampil di form User** | ✅ | 2026-08-03 | `getRoleOptions()` jadi async: gabungan role bawaan + role kustom dari `listRoles()`; `SettingsUserModule.openForm` kini `await getRoleOptions()` — role yang dibuat di Setting→Role bisa dipilih saat membuat/editing user. |
| **Framework** | **Sidebar refresh otomatis setelah permission berubah** | ✅ | 2026-08-03 | DI baru `onPermissionsChanged` di `SettingsPermissionModule` → page wrapper resync `Permission.syncFromServer()` + `window.__app.refreshSidebarMenus()` (re-filter menu + re-render `.sidebar-menu` tanpa kehilangan halaman aktif). |
| **Framework** | **Checkbox handler cek return value** | ✅ | 2026-08-03 | Gagal grant/revoke (return falsy) → checkbox di-revert + toast danger (sebelumnya selalu tampil sukses). |
| **Inventory** | **Server: proteksi role bawaan** | ✅ | 2026-08-03 | DELETE role supervisor/operator/admin/owner/superadmin → 400. PUT tidak bisa ganti `name` role bawaan (memutus linkage user→permission). Label/level tetap bisa diedit. |
| **Inventory** | **Server: cleanup & linkage role↔permission** | ✅ | 2026-08-03 | DELETE role → hapus dokumen `Permission` miliknya. POST create role → auto-buat dokumen Permission kosong (`ensurePermissionDoc`). |
| **Inventory** | **Seed: format permission baru + migrasi idempotent** | ✅ | 2026-08-03 | `PERMISSION_TEMPLATES` seed diganti ke namespace baru (`inventory.barang.read` dst). `repairRolePermissions()` (idempotent, tiap boot): map format lama→baru (`barang.view`→`inventory.barang.read`, `purchase.approve`→`inventory.pembelian.approve`, `unit.*`→`satuan.*`, dst), buang garbage 1–2 segmen, pertahankan SEMUA permission namespace ≥3 segmen (future-proof, `audit.view` dll tidak ikut terbuang), pastikan doc role bawaan ada. Verifikasi live: 3 dokumen ter-normalisasi, tidak ada format lama tersisa. |
| **Console** | **SP-027 Phase 1: Production deploy** | ✅ | 2026-08-04 | `master.e-profit.id` kini dilayani oleh `apps/console/dist` (SMART Console mandiri, title `<title>SMART Console</title>`); `inv.e-profit.id` tetap dilayani `apps/inventory/dist`. Build production kedua app sukses, config nginx baru di-copy ke `/etc/nginx/sites-available/`, `nginx -t` pass, `systemctl reload nginx` sukses. Verifikasi live: kedua domain 200 OK, API Express (127.0.0.1:3001) ter-proxy benar, HTTP→301 HTTPS. |
| **Console** | **SP-027 Phase 1: Fix impersonation 'Login As' cross-origin** | ✅ | 2026-08-04 | Pasca pemisahan origin, `sessionStorage` tidak lagi dibagikan master↔inv. `startImpersonation` (console) kini redirect ke `inv.e-profit.id/?smart_imp=<encodeURIComponent(JSON)>` (helper `getAppEntryUrl`, override `window.__APP_URLS__` untuk dev). `main.js` inventory saat boot membaca `smart_imp`, validasi `session`, simpan ke sessionStorage agar flow restore existing bekerja, lalu `history.replaceState` membersihkan URL. Build+test 509/509 hijau, bundle baru live. Catatan Phase 2: payload lewat URL masuk nginx access log — pertimbangkan one-time token via API. |
| **Inventory** | **Fix: sidebar menyusut saat buka menu Laporan** | ✅ | 2026-08-04 | Akar masalah: `.app { display:flex }` dengan `.sidebar` tanpa `flex-shrink:0` — tabel Laporan 10 kolom (`th { white-space:nowrap }`) memaksa min-width `.main` besar sehingga flex menekan sidebar (default flex-shrink:1). Fix di `main.css`: `.sidebar { flex-shrink:0 }` (selalu 260px) + `.main { min-width:0 }` (konten lebar di-scroll dalam `.lpr-table-wrap { overflow-x:auto }`). Collapse manual tetap jalan (pakai `.sidebar.collapsed { width:72px }`, bukan flex-shrink). Build 1.14s + test 509/509 hijau, CSS live (`index-BojJg6sl.css`). |
| **Inventory** | **Fix: sidebar bergeser ±15px saat buka menu Master/Settings** | ✅ | 2026-08-05 | Gejala: klik group menu panjang (Master 8 children, Settings 4) → sidebar menyusut sedikit; menu pendek (Transaksi 3) tidak. Akar masalah: `.sidebar { overflow-y:auto }` → scrollbar vertikal muncul saat konten sidebar melebihi viewport → memakan ±15px → konten menu bergeser. Fix di `main.css`: `scrollbar-gutter: stable` pada `.sidebar` & `.content` (ruang scrollbar dipesan permanen → lebar efektif konsisten di semua halaman, tidak bergeser saat scrollbar muncul/hilang). Build 803ms + test 509/509 hijau, CSS live (`index-DFzy7DOL.css`). |

---
## Legend
| Status | Meaning |
|--------|---------|
| ✅ | Done |
| ⬜ | Pending |
| ❌ | Blocked / Problem |
