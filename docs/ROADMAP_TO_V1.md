# SMART PLATFORM — Master Roadmap menuju v1.0

**Author:** Chief Software Architect, PT SMART VISION INDOTAMA  
**Date:** July 14, 2026  
**Reference:** Platform Stabilization Mission — Phase 1–6 Reports  
**Status:** Final

---

## Daftar Isi

1. [Filosofi Prioritas](#1-filosofi-prioritas)
2. [Ringkasan Visual Roadmap](#2-ringkasan-visual-roadmap)
3. [Kelompok A: Immediate Fix](#3-kelompok-a-immediate-fix-1-2-hari)
4. [Kelompok B: Framework Validation](#4-kelompok-b-framework-validation-sprint-1-2)
5. [Kelompok C: Documentation](#5-kelompok-c-documentation-sprint-2)
6. [Kelompok D: Second Application Validation](#6-kelompok-d-second-application-validation-sprint-3-4)
7. [Kelompok E: Future Enhancements](#7-kelompok-e-future-enhancements-sprint-5)
8. [Dependency Graph](#8-dependency-graph)
9. [Risk Register](#9-risk-register)
10. [Definition of Done — v1.0](#10-definition-of-done--v10)

---

## 1. Filosofi Prioritas

Roadmap ini **TIDAK** bertujuan menutup seluruh 40 gap yang teridentifikasi di Framework Gap Analysis. Sebaliknya, prioritas ditentukan oleh **dampak terhadap stabilitas framework** dan **validasi penggunaan nyata**.

### Hirarki Prioritas

```
P1 — BLOCKER: Framework tidak bisa digunakan sama sekali
P2 — CRITICAL: Framework bisa digunakan tapi dengan risiko tinggi
P3 — IMPORTANT: Framework bisa digunakan, pengalaman terganggu
P4 — ENHANCEMENT: Framework berfungsi penuh, polish diperlukan
```

### Prinsip Penyusunan

1. **Fix dulu yang rusak** — Immediate Fix memperbaiki bug HIGH yang mengancam stabilitas
2. **Validasi yang belum teruji** — Framework Validation memastikan @smart/data dan @smart/api benar-benar bekerja
3. **Dokumentasi yang memungkinkan adopsi** — Documentation agar developer baru bisa produktif
4. **Bukti nyata dengan aplikasi kedua** — Second App Validation membuktikan framework reusable
5. **Baru kemudian polish** — Future Enhancements untuk v1.x

---

## 2. Ringkasan Visual Roadmap

```
Sprint 1    Sprint 2    Sprint 3    Sprint 4    Sprint 5    Sprint 6
──────────  ──────────  ──────────  ──────────  ──────────  ──────────
                           
IMMEDIATE   FRAMEWORK   FRAMEWORK   SECOND APP  SECOND APP  FUTURE
FIX         VALIDATION  DOCS        VALIDATION  VALIDATION  ENHANCE
(1-2 hari)  (S1)        (S2)        (S3)        (S4)        (S5)
             
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│F-13 Fix  │ │Extract  │ │Getting  │ │TaskMgr  │ │TaskMgr  │ │Form     │
│Sidebar   │ │Seed Data│ │Started  │ │Skeleton │ │Data+API │ │Valdn    │
├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤
│F-04 Fix  │ │Auth     │ │API Ref  │ │UI Comps │ │E2E Flow │ │Router   │
│Exports   │ │Real API │ │(JSDoc)  │ │Polish   │ │Validtn  │ │System   │
├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤
│Lint      │ │Data     │ │Comp     │ │Pages B  │ │Bug Fix  │ │TS Defs  │
│Cleanup   │ │Validtn  │ │Catalog  │ │uilt     │ │from Val │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
                                    │                        ┌─────────┐
                                    │                        │Icon     │
                                    │                        │System   │
                                    │                        └─────────┘
                                    
Legend: [Immediate] [Validation] [Docs] [Second App] [Enhancements]
```

---

## 3. Kelompok A: Immediate Fix (1–2 Hari)

### Rasional

Empat temuan HIGH dari Architecture Audit harus diperbaiki **sebelum** pekerjaan lain dimulai. Ini adalah "low-hanging fruit" yang dampaknya besar terhadap stabilitas dan kualitas kode.

---

### A-01: Fix Sidebar Module-Level State (F-13 🔴 HIGH)

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER |
| **Alasan** | Module-level `sidebarClickAttached = false` mencegah Sidebar di-render ulang dengan menu dinamis. Jika navigasi berubah setelah render pertama, event listener baru tidak akan terdaftar. |
| **Estimasi** | ✦ 0.5 hari |
| **Risiko** | Sangat rendah — perubahan terlokalisasi di satu fungsi |
| **Dependency** | None |
| **Definition of Done** | ✅ Module-level variable dihapus ✅ Event delegation menggunakan closure per-instance ✅ Semua test tetap passing ✅ Tidak ada sidebarClickAttached di module scope |

**Pendekatan:** Hapus `sidebarClickAttached` dari module scope. Gunakan pattern closure atau WeakRef untuk mencatat apakah event delegation sudah terdaftar secara global. Alternatif: simpan flag di dataset element.

**File affected:** `packages/smart-ui/src/layouts/sidebar/Sidebar.js`

---

### A-02: Fix Incomplete @smart/ui Main Entry Exports (F-04 🔴 HIGH)

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P2 — CRITICAL |
| **Alasan** | Hanya 3 dari 22 komponen yang di-export dari entry point utama (`@smart/ui`). Sisanya hanya bisa diakses via `@smart/ui/components`. Ini membingungkan developer baru dan melanggar prinsip konsistensi API. |
| **Estimasi** | ✦ 0.5 hari |
| **Risiko** | Rendah — perubahan ekspor saja, tidak mengubah logika komponen |
| **Dependency** | None |
| **Definition of Done** | ✅ `@smart/ui/src/index.js` mengekspor SEMUA 22 komponen dari `./components/index.js` ✅ Tidak ada komponen yang hanya bisa diakses via sub-path ✅ `loadUI()` tetap diekspor ✅ Semua test tetap passing ✅ Inventory app tetap berfungsi |

**Pendekatan:** Ubah `smart-ui/src/index.js` dari hanya mengekspor `Button, Card, StatCard` menjadi mengekspor seluruh komponen dengan `export * from "./components/index.js"`.

**File affected:** `packages/smart-ui/src/index.js`

---

### A-03: Lint Warning Cleanup

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | 8 lint warnings (0 errors) menunjukkan kebersihan kode yang kurang. Meskipun tidak memblokir, warning yang dibiarkan menumpuk menurunkan standar kualitas. |
| **Estimasi** | ✦ 0.5 hari |
| **Risiko** | Sangat rendah |
| **Dependency** | None |
| **Definition of Done** | ✅ `npm run lint` menghasilkan 0 warnings dan 0 errors ✅ Unused imports dihapus ✅ `==` diganti `===` ✅ Import duplikat dihapus |

**Warnings to fix:**
- `interceptors.test.js:1` — `vi` imported but unused
- `error.js:187` — `==` should be `===`
- `permission.test.js:12` — duplicate import
- `session.js:35` — `password` assigned but unused
- `roles.js:121` — `name` assigned but unused
- `feedback-components.test.js:133` — `el` assigned but unused
- `Sidebar.js:13` — function expression instead of arrow function
- `inventory/src/main.js:59` — arrow-body-style

---

### A-04: Add Root package.json "type": "module"

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Saat `npm run lint`, ESLint menampilkan warning `MODULE_TYPELESS_PACKAGE_JSON`. Root package.json tidak memiliki `"type": "module"` walau semua kode menggunakan ESM. |
| **Estimasi** | ✦ <0.5 hari |
| **Risiko** | Sangat rendah |
| **Dependency** | None |
| **Definition of Done** | ✅ Warning MODULE_TYPELESS_PACKAGE_JSON hilang ✅ Semua test tetap passing |

**Pendekatan:** Tambahkan `"type": "module"` ke root `package.json`.

---

### A-05: Add Root-Level Dev Scripts

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Developer harus tahu flag `--workspace=inventory` untuk menjalankan app. Root-level convenience scripts memperbaiki Developer Experience. |
| **Estimasi** | ✦ <0.5 hari |
| **Risiko** | Sangat rendah |
| **Dependency** | None |
| **Definition of Done** | ✅ `npm run dev:inventory` berfungsi ✅ `npm run dev:template` berfungsi ✅ `npm run build:all` ada untuk build semua aplikasi |

---

## 4. Kelompok B: Framework Validation (Sprint 1 — 2 Minggu)

### Rasional

Ini adalah **kelompok pekerjaan PALING KRITIS** untuk v1.0. `@smart/api` dan `@smart/data` **tidak pernah digunakan** di aplikasi produksi. Kita harus memvalidasi bahwa seluruh rantai dependency benar-benar berfungsi sebelum mengklaim framework siap produksi.

---

### B-01: Extract Hardcoded Data from Production Code

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER |
| **Alasan** | Auth berisi 2 user dengan password plaintext. Institution berisi 3 tenant hardcoded. Data ini TIDAK boleh ada di kode framework produksi. Harus dipisahkan ke seed data atau mock data. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | SEDANG — perlu memastikan backward compatibility untuk Inventory app |
| **Dependency** | None (bisa jalan paralel dengan A-01) |
| **Definition of Done** | ✅ Hardcoded users dihapus dari `auth.js` ✅ Hardcoded institutions dihapus dari `institution.js` ✅ Seed data dipindahkan ke `packages/smart-core/src/seed/` atau `apps/inventory/src/seed/` ✅ Inventory app dapat seed data dari file seed ✅ Semua test diperbarui untuk menggunakan seed data ✅ Tidak ada password/credentials di kode framework |

**Pendekatan:**
1. Buat `packages/smart-core/src/seed/default-users.js` berisi data user
2. Buat `packages/smart-core/src/seed/default-institutions.js` berisi data institution
3. Ubah `Auth` dan `Institution` untuk menerima data via constructor atau method `load()`
4. Inventory app memanggil `Auth.load(seedData)` di `main.js`
5. Test menggunakan factory function untuk membuat instance dengan data test

**Files affected:**
- `packages/smart-core/src/auth/auth.js`
- `packages/smart-core/src/institution/institution.js`
- `apps/inventory/src/main.js`
- All test files that reference Auth/Institution

---

### B-02: Real Auth via API (Foundation)

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER |
| **Alasan** | Framework TIDAK BISA mengklaim "siap produksi" tanpa kemampuan autentikasi via API. Auth interceptor di @smart/api sudah ada tapi tidak terhubung. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | TINGGI — perubahan fundamental pada Auth module |
| **Dependency** | B-01 (seed data harus dipisah dulu) |
| **Definition of Done** | ✅ Auth dapat dikonfigurasi dengan API endpoint ✅ `Auth.login(username, password)` melakukan fetch ke API ✅ Token disimpan dan dikelola oleh session ✅ Auth interceptor di @smart/api menggunakan token dari Auth ✅ Mode "demo" tetap didukung dengan seed data ✅ Semua test existing tetap passing |

**Pendekatan:**
1. Tambahkan opsi `apiUrl` ke Auth constructor
2. Jika `apiUrl` diberikan, `login()` melakukan POST ke `${apiUrl}/auth/login`
3. Jika `apiUrl` tidak diberikan (mode demo), gunakan seed data
4. Token dari response API disimpan di session manager
5. Auth interceptor membaca token dari session

**Files affected:**
- `packages/smart-core/src/auth/auth.js`
- `packages/smart-core/src/auth/session.js`
- `packages/smart-api/src/interceptors/auth.js`

---

### B-03: Framework Validation — @smart/data + @smart/api End-to-End

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER |
| **Alasan** | Kedua package ini BELUM PERNAH digunakan di aplikasi nyata. Kita harus memvalidasi bahwa Repository, cache, pagination, state management, dan interceptor berfungsi dalam skenario end-to-end. |
| **Estimasi** | ✦✦ 1.5 minggu |
| **Risiko** | TINGGI — mungkin ditemukan bug desain yang memerlukan refactor |
| **Dependency** | B-02 (real auth diperlukan untuk interceptor) |
| **Definition of Done** | ✅ Integration test dibuat yang menguji: client → interceptor → resource → repository → state ✅ Cache invalidation bekerja setelah create/update/delete ✅ Pagination state sinkron dengan data ✅ Loading/error state transisi bekerja ✅ Semua test unit existing tetap passing ✅ Test mencakup skenario: sukses, error network, 401, 404, timeout |

**Pendekatan:**
1. Buat file `packages/smart-data/__tests__/integration.test.js`
2. Gunakan MSW (Mock Service Worker) atau fetch mocking untuk mensimulasikan API
3. Test flow: createClient → initInterceptors → BaseResource → Repository → createDataState
4. Verifikasi cache invalidation: create → list → should not return stale cache
5. Verifikasi pagination: list with page → updateMeta → goTo

---

### B-04: Fix @smart/core Singleton Pattern untuk Testability

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Singleton instances (Auth, Institution, Permission) menyebabkan state leakage antar test. Meskipun vitest mengisolasi module, pattern ini membatasi testability dan mencegah penggunaan di server-side. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | SEDANG — perubahan struktur ekspor, perlu koordinasi dengan konsumen |
| **Dependency** | B-01 (restrukturisasi Auth/Institution) |
| **Definition of Done** | ✅ Kelas Auth, Institution, Permission tetap di-export (bukan hanya instance) ✅ Factory function `createAuth()`, `createInstitution()`, `createPermission()` tersedia ✅ Singleton default tetap di-export sebagai `auth`, `institution`, `permission` ✅ Semua konsumen yang ada tetap berfungsi ✅ Test dapat membuat instance terisolasi |

**Pendekatan:**
```js
// Sebelum
export default new Auth();

// Sesudah
export class Auth { ... }
export const auth = new Auth();
export default auth;
export function createAuth() { return new Auth(); }
```

---

## 5. Kelompok C: Documentation (Sprint 2 — 2 Minggu)

### Rasional

Tanpa dokumentasi, framework tidak bisa diadopsi oleh developer lain. Sprint 2 berfokus pada dokumentasi yang memungkinkan developer baru membangun aplikasi SMART tanpa membaca source code.

> **Catatan:** Dokumentasi bisa berjalan PARALEL dengan Sprint 1 (Framework Validation) karena tidak memiliki dependency kode.

---

### C-01: Getting Started Guide

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER |
| **Alasan** | Ini adalah dokumen PALING PENTING untuk adopsi framework. Tanpa ini, developer baru tidak tahu harus mulai dari mana. |
| **Estimasi** | ✦ 0.5 minggu |
| **Risiko** | Rendah — hanya dokumentasi |
| **Dependency** | A-04 (root dev scripts) — agar guide bisa bilang "npm run dev:template" |
| **Definition of Done** | ✅ File `GETTING_STARTED.md` di root ✅ Isi: Prasyarat → Clone → Install → Run template → Buat halaman pertama ✅ Menjelaskan struktur monorepo ✅ Link ke API Reference dan Component Catalog ✅ Dapat diikuti dari awal sampai akhir tanpa bertanya |

**Dokumen:** `GETTING_STARTED.md`

---

### C-02: Component Catalog dengan Live Examples

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER |
| **Alasan** | Developer perlu melihat komponen apa saja yang tersedia, props-nya, dan contoh penggunaannya. Tanpa ini, setiap developer harus membaca source code komponen. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | Rendah |
| **Dependency** | A-02 (exports fix) — agar semua komponen bisa diakses dari entry utama |
| **Definition of Done** | ✅ Setiap komponen memiliki halaman dokumentasi ✅ Halaman berisi: deskripsi, props table, contoh kode, contoh render ✅ Dapat diakses via browser (static site atau markdown) ✅ Minimal mencakup: Button, Input, Select, Modal, Toast, Table, Tabs, Badge, Avatar, Pagination |

**Dokumen:** `docs/component-catalog.md`

---

### C-03: API Reference (Auto-generated dari JSDoc)

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P2 — CRITICAL |
| **Alasan** | @smart/core, @smart/api, @smart/data, dan @smart-ui tidak memiliki API reference. Developer harus membaca source code untuk memahami parameter dan return value. |
| **Estimasi** | ✦ 0.5 minggu |
| **Risiko** | Rendah — bisa auto-generated |
| **Dependency** | None (berdasarkan JSDoc yang sudah ada) |
| **Definition of Done** | ✅ Dokumentasi API dihasilkan untuk semua 4 packages ✅ Mencakup: fungsi, parameter, return type, contoh ✅ Bisa dihasilkan dengan script (npm run docs) ✅ Disimpan di `docs/api/` ✅ JSDoc yang kurang lengkap ditambahkan |

**Pendekatan:** Gunakan `jsdoc` atau `documentation.js` untuk generate dari JSDoc.

**Script:** Tambahkan `"docs": "jsdoc -c jsdoc.conf.json"` ke root package.json

**Dokumen:** `docs/api/smart-core.md`, `docs/api/smart-api.md`, `docs/api/smart-data.md`, `docs/api/smart-ui.md`

---

### C-04: Integration Patterns Guide

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P2 — CRITICAL |
| **Alasan** | Developer perlu tahu bagaimana menghubungkan Auth → API → Data → UI. Pattern integrasi tidak terdokumentasi. |
| **Estimasi** | ✦ 0.5 minggu |
| **Risiko** | Rendah |
| **Dependency** | B-02, B-03 (real auth + data validation harus selesai agar guide akurat) |
| **Definition of Done** | ✅ Auth + API integration pattern ✅ Permission-based UI rendering ✅ Data fetching dengan Repository ✅ Form submission dengan state management ✅ Error handling pattern ✅ Workspace customization |

**Dokumen:** `docs/integration-patterns.md`

---

## 6. Kelompok D: Second Application Validation (Sprint 3–4 — 4 Minggu)

### Rasional

Ini adalah **SATU-SATUNYA CARA** untuk membuktikan bahwa SMART Platform benar-benar reusable. Inventory alone tidak cukup. Aplikasi Task Manager dipilih karena mencakup seluruh framework.

---

### D-01: Task Manager — Scaffold + UI Components Only

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER (untuk bukti reuse) |
| **Alasan** | Membangun aplikasi kedua menggunakan seluruh komponen @smart/ui untuk membuktikan komponen benar-benar reusable di domain yang berbeda. |
| **Estimasi** | ✦✦ 2 minggu (Sprint 3) |
| **Risiko** | SEDANG — mungkin ditemukan komponen yang terlalu spesifik untuk Inventory |
| **Dependency** | A-01 (sidebar fix), A-02 (exports fix) |
| **Definition of Done** | ✅ Aplikasi task-manager berfungsi dengan AppShell + Sidebar + Topbar ✅ Halaman: Dashboard, Task List, Task Detail, User Management ✅ Menggunakan komponen: Table, Tabs, Card, Badge, Avatar, Button, Input, Select, Textarea, Modal, Toast, Alert, EmptyState, Skeleton, Pagination, Breadcrumb, Container, Stack, Divider ✅ Minimal 20 dari 22 komponen digunakan ✅ Berjalan di `npm run dev --workspace=task-manager` |

**Pendekatan:** Fase ini hanya UI. Data masih hardcoded/mock. Fokus membuktikan komponen reusable.

---

### D-02: Task Manager — Data + API Integration

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P1 — BLOCKER (untuk validasi @smart/data + @smart/api) |
| **Alasan** | Ini adalah VALIDASI UTAMA. Mengintegrasikan @smart/api dan @smart/data dalam aplikasi nyata untuk pertama kalinya. |
| **Estimasi** | ✦✦ 2 minggu (Sprint 4) |
| **Risiko** | TINGGI — pertama kalinya data layer digunakan di aplikasi nyata |
| **Dependency** | D-01 (UI harus selesai), B-02 (real auth), B-03 (data validation) |
| **Definition of Done** | ✅ API client dibuat dengan `createClient()` ✅ Auth interceptor dan context interceptor aktif ✅ BaseResource diperluas untuk Task, User ✅ Repository digunakan untuk setiap resource ✅ createDataState untuk state management per halaman ✅ Cache bekerja untuk list dan detail ✅ Pagination berfungsi ✅ Error dari API ditampilkan via Toast/Alert ✅ Mutation (create/update/delete) meng-invalidate cache ✅ Semua state transition (loading → data/error) berfungsi |

**Pendekatan:**
1. Buat `apps/task-manager/src/api/client.js` — konfigurasi createClient
2. Buat `apps/task-manager/src/api/resources/task-resource.js` — extends BaseResource
3. Buat `apps/task-manager/src/data/task-repository.js` — new Repository(resource, { cache, pagination })
4. Integrasikan dengan halaman Task List, Task Detail, Task Form

---

### D-03: Task Manager — E2E Flow Validation

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P2 — CRITICAL |
| **Alasan** | Validasi bahwa seluruh flow end-to-end berfungsi: login → lihat daftar → buat baru → edit → hapus. Tanpa ini, kita tidak tahu apakah data layer benar-benar siap produksi. |
| **Estimasi** | ✦✦ 1 minggu (paralel dengan D-02) |
| **Risiko** | TINGGI — mungkin menemukan bug pada Repository atau interceptor |
| **Dependency** | B-02, B-03 (framework validation harus selesai) |
| **Definition of Done** | ✅ Flow E2E: Login → Dashboard → Task List → Create Task → Task appears ✅ Flow E2E: Edit Task → Data updates ✅ Flow E2E: Delete Task → Task disappears ✅ Flow E2E: Pagination works with 20+ items ✅ Flow E2E: Error from API shows user-friendly message ✅ Integration test untuk flow di atas |

---

## 7. Kelompok E: Future Enhancements (Sprint 5+)

### Rasional

Setelah framework tervalidasi dan aplikasi kedua terbukti, barulah kita menambahkan fitur yang membuat framework benar-benar mature. Items di sini adalah untuk v1.0 **final** atau v1.1.

---

### E-01: Form Validation Library

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Setiap aplikasi dengan form (semua aplikasi) perlu validasi. Saat ini harus implementasi manual. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | SEDANG — harus desain API yang intuitif |
| **Dependency** | Best done setelah D-01 (Task Manager UI selesai — untuk melihat kebutuhan riil) |
| **Definition of Done** | ✅ API: `createValidator(schema)` yang mengembalikan errors object ✅ Mendukung: required, minLength, maxLength, pattern, custom validator ✅ Integrasi dengan Input, Select, Textarea components ✅ Menampilkan error message di UI ✅ Type-aware: string, number, email, boolean |

---

### E-02: Framework Routing System

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Setiap app mengimplementasikan routing sendiri. Framework perlu routing system bawaan. |
| **Estimasi** | ✦✦ 2 minggu |
| **Risiko** | TINGGI — routing adalah keputusan arsitektural yang berdampak luas |
| **Dependency** | E-01 atau lebih awal jika Task Manager membutuhkannya |
| **Definition of Done** | ✅ API: `createRouter(routes)` dengan hash-based routing ✅ Route guard: `beforeEnter` dengan permission check ✅ Lazy loading: komponen di-load per route ✅ Parameter: route params seperti `/task/:id` ✅ Link component: `<a data-nav="...">` untuk mencegah page reload ✅ Back/forward browser buttons berfungsi ✅ Terintegrasi dengan Permission |

---

### E-03: TypeScript Definitions (.d.ts)

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Developer TypeScript tidak bisa menggunakan framework tanpa type definitions. JSDoc sudah ada, tinggal di-generate. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | Rendah — generate dari JSDoc |
| **Dependency** | Best done setelah API stabil (setelah Sprint 4) |
| **Definition of Done** | ✅ Semua packages memiliki `index.d.ts` ✅ TypeScript project bisa import semua API dengan type checking ✅ `npm run build:types` menghasilkan type definitions ✅ Didokumentasikan di Getting Started |

---

### E-04: Icon System (SVG-based)

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P4 — ENHANCEMENT |
| **Alasan** | Emoji sebagai icon tidak konsisten antar OS/browser. Framework perlu icon system profesional. |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | Rendah |
| **Dependency** | None |
| **Definition of Done** | ✅ Component `Icon({ name, size })` ✅ Minimal 30 icons umum (home, user, settings, plus, edit, delete, search, dll) ✅ SVG-based ✅ Tree-shakeable ✅ Documented in Component Catalog |

---

### E-05: Release Process & Versioning

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P2 — CRITICAL (untuk rilis) |
| **Alasan** | Framework tidak bisa dirilis tanpa proses versioning, changelog, dan release checklist. |
| **Estimasi** | ✦ 0.5 minggu |
| **Risiko** | Rendah |
| **Dependency** | Best done setelah semua item P1 dan P2 selesai |
| **Definition of Done** | ✅ Versioning strategy: SemVer ✅ `CHANGELOG.md` berisi semua perubahan ✅ Release script: `npm run release:patch/minor/major` ✅ GitHub release template ✅ Release checklist document ✅ `npm run verify` sebagai pre-publish gate ✅ Tags dan release di GitHub |

---

### E-06: E2E Testing Setup

| Atribut | Detail |
|---------|--------|
| **Prioritas** | P3 — IMPORTANT |
| **Alasan** | Unit test saja tidak cukup untuk memvalidasi aplikasi multidomain |
| **Estimasi** | ✦✦ 1 minggu |
| **Risiko** | SEDANG — perlu setup tool seperti Playwright/Cypress |
| **Dependency** | D-02 (Task Manager harus sudah punya data layer) |
| **Definition of Done** | ✅ Playwright atau Cypress terinstal ✅ E2E test untuk: login flow, CRUD task, navigation ✅ Berjalan di CI ✅ Test coverage meliputi Inventory dan Task Manager |

---

## 8. Dependency Graph

```
A-01 Sidebar Fix
    └── Tidak ada dependency
A-02 Exports Fix
    └── Tidak ada dependency
A-03 Lint Cleanup
    └── Tidak ada dependency
A-04 Root type:module
    └── Tidak ada dependency
A-05 Root Dev Scripts
    └── Tidak ada dependency

B-01 Extract Seed Data
    └── Tidak ada dependency (paralel dengan A)
B-02 Real Auth API
    └── Bergantung pada: B-01
B-03 Data Layer Validation
    └── Bergantung pada: B-02
B-04 Fix Singleton Pattern
    └── Bergantung pada: B-01

C-01 Getting Started
    └── Bergantung pada: A-04 (dev scripts)
C-02 Component Catalog
    └── Bergantung pada: A-02 (exports fix)
C-03 API Reference
    └── Tidak ada dependency (paralel)
C-04 Integration Patterns
    └── Bergantung pada: B-02, B-03

D-01 Task Manager UI
    └── Bergantung pada: A-01, A-02
D-02 Task Manager Data+API
    └── Bergantung pada: D-01, B-02, B-03
D-03 E2E Flow Validation
    └── Bergantung pada: D-02

E-01 Form Validation
    └── Bergantung pada: D-01 (best practice)
E-02 Routing System
    └── Tidak ada dependency kritis
E-03 TypeScript Definitions
    └── Bergantung pada: Semua API stabil
E-04 Icon System
    └── Tidak ada dependency
E-05 Release Process
    └── Bergantung pada: Semua P1/P2 selesai
E-06 E2E Testing
    └── Bergantung pada: D-02
```

### Critical Path

```
A-01 ──────────────────────────────────────────┐
A-02 ──────────────────────────────────────────┤
                                              ├─→ D-01 → D-02 → D-03 → E-05 → v1.0
B-01 → B-02 → B-03 ──────────────────────────┘
                                              ┌─→ C-04
B-02 → B-03 ─────────────────────────────────┘
```

**Critical path length:** B-01 → B-02 → B-03 → D-01 → D-02 → D-03 → E-05 = **~6 sprints = 12 minggu**

**Paralel work:** C-01, C-02, C-03, C-04 bisa berjalan paralel dengan B dan D

---

## 9. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-01 | @smart/data Repository pattern tidak cukup fleksibel untuk domain Task Manager | SEDANG | TINGGI | Buat prototype Repository untuk Task domain sebelum Sprint 4 full |
| R-02 | Sidebar fix merusak event delegation existing | RENDAH | TINGGI | Coverage test untuk sidebar navigation |
| R-03 | Auth refactor (B-01 + B-02) merusak Inventory app | SEDANG | TINGGI | Regression test: Inventory harus tetap berfungsi |
| R-04 | Developer tidak bisa mengikuti Getting Started karena step yang hilang | RENDAH | SEDANG | Dogfooding: minta developer lain mengikuti guide |
| R-05 | Real Auth API membutuhkan backend yang belum ada | TINGGI | TINGGI | Buat mock server dengan MSW untuk development |
| R-06 | Routing system (E-02) memakan waktu lebih dari estimasi | SEDANG | SEDANG | Pertimbangkan routing sederhana dulu (hash-based) |
| R-07 | Task Manager membutuhkan komponen yang belum ada (DatePicker, dll) | TINGGI | RENDAH | Gunakan native HTML input, tambah komponen nanti |

---

## 10. Definition of Done — v1.0

Framework dinyatakan **LAYAK DIRILIS sebagai v1.0** jika DAN HANYA JIKA semua kondisi berikut terpenuhi:

### Blocking Conditions (ALL MUST BE TRUE)

| # | Condition | Terpenuhi Oleh |
|---|-----------|----------------|
| 1 | ✅ Bug HIGH (F-13, F-04) telah diperbaiki | Kelompok A |
| 2 | ✅ @smart/data dan @smart/api tervalidasi end-to-end dalam aplikasi nyata | Kelompok B, D |
| 3 | ✅ auth.js TIDAK mengandung hardcoded credentials di kode produksi | B-01 |
| 4 | ✅ Auth dapat berkomunikasi dengan API eksternal | B-02 |
| 5 | ✅ Developer baru dapat membangun aplikasi SMART mengikuti Getting Started Guide | C-01 |
| 6 | ✅ Minimal 2 aplikasi (Inventory + Task Manager) menggunakan framework | A, D |
| 7 | ✅ Task Manager menggunakan @smart/api, @smart/data, dan @smart/ui secara nyata | D-02 |
| 8 | ✅ Semua 508 test + test baru passing | Semua |
| 9 | ✅ `npm run lint` menghasilkan 0 errors dan 0 warnings | A-03 |
| 10 | ✅ Versioning strategy dan release process terdokumentasi | E-05 |

### Quality Gates (ALL MUST PASS)

| Gate | Check |
|------|-------|
| `npm run verify` | ✅ Lint pass, 508+ test pass, build sukses |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm test` | ✅ 100% test pass |
| Manual review | ✅ Code review untuk setiap PR |
| CI | ✅ GitHub Actions pass di Node 18, 20, 22 |

---

## Lampiran: Mapping Gap Analysis → Roadmap

| Gap ID | Deskripsi | Kelompok | Prioritas |
|--------|-----------|----------|-----------|
| F-13 | Sidebar module-level state | A-01 | P1 |
| F-04 | Incomplete @smart/ui exports | A-02 | P2 |
| F-11 | Lint warnings | A-03 | P3 |
| — | Root type:module | A-04 | P3 |
| — | Root dev scripts | A-05 | P3 |
| F-08, G-44, G-43 | Extract hardcoded data + real auth | B-01, B-02 | P1 |
| F-03, F-06, G-45 | Data layer validation | B-03 | P1 |
| F-08 | Fix singleton pattern | B-04 | P3 |
| G-01 | Getting Started Guide | C-01 | P1 |
| G-18 | Component Catalog | C-02 | P1 |
| G-17 | API Reference | C-03 | P2 |
| G-19 | Integration Patterns | C-04 | P2 |
| — | Task Manager UI | D-01 | P1 |
| — | Task Manager Data+API | D-02 | P1 |
| — | Task Manager E2E | D-03 | P2 |
| G-40 | Form Validation | E-01 | P3 |
| G-41 | Routing System | E-02 | P3 |
| G-33 | TypeScript Definitions | E-03 | P3 |
| G-14 | Icon System | E-04 | P4 |
| G-24, G-25 | Release Process | E-05 | P2 |
| G-35 | E2E Testing | E-06 | P3 |

---

*End of Master Roadmap to v1.0 — Dokumen acuan untuk implementasi EPIC berikutnya.*
