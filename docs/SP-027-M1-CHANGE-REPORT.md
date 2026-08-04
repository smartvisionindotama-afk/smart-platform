# SP-027 — MILESTONE 1 — SMART CONSOLE FOUNDATION
## Change Report

- **Status:** SELESAI — Architecture Only
- **Scope:** `apps/console/**` (Inventory & framework packages TIDAK diubah)

---

## 1. RINGKASAN

SMART Console (master.e-profit.id) berubah dari aplikasi single-screen
(login ↔ monolith dashboard 2058 baris) menjadi **Platform Console
multi-halaman** dengan sidebar 8 menu dan halaman-halaman berbasis
komponen SMART UI. Inventory (inv.e-profit.id) tidak tersentuh.

---

## 2. FILE BARU (created)

| File | Fungsi |
|---|---|
| `apps/console/src/config/index.js` | Config terpusat: menu, apps registry (8), APP_URLS, session key |
| `apps/console/src/services/applications.js` | Mock repository 8 aplikasi (list/get/update/toggle/count) |
| `apps/console/src/services/activity.js` | Mock activity log + search/pagination + format |
| `apps/console/src/services/system.js` | System info (version/build/env/apiUrl + placeholder probe) |
| `apps/console/src/services/impersonation.js` | Handoff "Login As" cross-origin (dipindah dari monolith) |
| `apps/console/src/assets/console.css` | CSS shell (sidebar/topbar/content) + halaman (prefix `.cn-`) |
| `apps/console/src/pages/_shared.js` | Helper bersama: pageHeader, loadingHTML, statusBadge, esc, format |
| `apps/console/src/pages/dashboard/index.js` | Dashboard — 8 widget (StatCard) |
| `apps/console/src/pages/applications/index.js` | Applications — CRUD mock + toggle + open + search/filter/pagination |
| `apps/console/src/pages/companies/index.js` | Companies — API + search/pagination/filter/detail/edit/wilayah/impersonation |
| `apps/console/src/pages/superadmins/index.js` | Super Admin — search/pagination/reset pw/enable/disable/add/delete |
| `apps/console/src/pages/settings/index.js` | Platform Settings — upload/hapus logo platform (server-side) |
| `apps/console/src/pages/system/index.js` | System Information — 7 info cards (3 placeholder) |
| `apps/console/src/pages/activity/index.js` | Activity Log — mock, search + pagination |
| `apps/console/src/pages/documentation/index.js` | Documentation — 4 kartu placeholder |
| `docs/SP-027-M1-IMPLEMENTATION-PLAN.md` | Implementation Plan (disetujui sebelum coding) |

## 3. FILE DIREWRITE

| File | Perubahan |
|---|---|
| `apps/console/src/main.js` | Bootstrap lengkap: session restore (localStorage), login gate, shell mount, router, logout |
| `apps/console/src/layouts/index.js` | ConsoleShell berbasis AppShell + attachConsoleShell (hamburger/collapse/logout/active) |
| `apps/console/src/router/index.js` | resolveScreen + resolvePage |
| `apps/console/src/router/routes.js` | Route registry 8 halaman |
| `apps/console/src/modules/platform/index.js` | Hanya export login (monolith dihapus) |

## 4. FILE DIHAPUS

| File | Alasan |
|---|---|
| `apps/console/src/modules/platform/dashboard.js` (2058 baris) | Monolith single-view — digantikan halaman-halaman M1 |
| `apps/console/src/pages/platform/index.js` | Wrapper createPlatformDashboard — tidak dipakai lagi |
| `apps/console/src/pages/platform/` (dir) | Kosong setelah wrapper dihapus |

Logika bernilai dari monolith DIPINDAHKAN (bukan dihilangkan):
impersonation → `services/impersonation.js`; wilayah cascading →
halaman Companies (`/api/wilayah/*`); logo platform → reuse
`services/platform.js`.

## 5. FITUR PER HALAMAN (sesuai spec M1)

| Halaman | Status | Detail |
|---|---|---|
| Dashboard | ✅ | 8 widget: Total Apps, Total Companies, Total Super Admin, Platform Version, Server Status (placeholder), Database Status (placeholder), Active Companies, Registered Companies |
| Applications | ✅ | 8 aplikasi (Inventory..AI); Nama/Kode/Logo/Status/Domain/Version/Description; Edit (Modal), Enable/Disable, Open (domain) |
| Companies | ✅ | API existing; Search, Pagination, Filter Active/Suspended, Detail (logo+registered apps+status), Edit (Modal + wilayah + akses apps), Login As (impersonation), Delete |
| Super Admin | ✅ | Search, Pagination, Reset Password, Enable/Disable, Role, Add, Delete. Last Login → "—" (model tidak punya field) |
| Platform Settings | ✅ | Upload/hapus logo platform (server file-based) + info platform |
| System Information | ✅ | Platform/Build Version, Environment, API URL + 3 placeholder (Mongo/Server/Node) |
| Activity Log | ✅ | Mock — Time/User/Activity/Target/Result + Search + Pagination |
| Documentation | ✅ | 4 kartu placeholder (Architecture, SP Docs, Dev Guide, Deploy Guide) |

## 6. NON-FUNCTIONAL (SP-027 M1)

- ✅ **Tidak ada inline style** — semua style via `console.css` / komponen framework
- ✅ **Tidak ada komponen duplikat** — reuse SMART UI + helper `_shared.js`
- ✅ **Tidak ada hardcoded URL** — semua di `config/index.js` (`APP_URLS`, `getAppEntryUrl`)
- ✅ **Dead code** — monolith dihapus, import tak terpakai dibersihkan
- ✅ **Session** — persist ke localStorage (`smart_console_session`), logout membersihkan

## 7. VERIFIKASI

| Check | Hasil |
|---|---|
| Console build | ✅ 503ms |
| Inventory build | ✅ 1.31s |
| Test (vitest) | ✅ 21 files / **509 tests PASS** |
| Lint console | ✅ 0 error |
| Lint repo | ⚠️ 40 error `no-undef` (pra-eksisting, browser globals) — tidak ada error baru |

## 8. CATATAN & LIMITASI

1. **Last Login** — model SuperAdmin tidak punya field `lastLogin`
   (hanya createdAt/updatedAt/resetToken); kolom menampilkan "—".
   (Server `apps/inventory/server` tidak diubah per Golden Rule M1.)
2. **Placeholder** — Server/Database/Node status (System Info) masih "—",
   sesuai spec M1 (probe menyusul di milestone Observability).
3. **Activity Log & Documentation** masih mock/placeholder (sesuai spec).
4. **Applications** mock repository (sesuai spec: "Data masih boleh
   menggunakan mock repository").
5. Warning build `INEFFECTIVE_DYNAMIC_IMPORT` (login.js dynamic-import
   @smart/core) — pra-eksisting, tidak memengaruhi runtime.

## 9. RENCANA SELANJUTNYA (di luar M1)

- Deploy `apps/console/dist` ke server + reload nginx (ops manual)
- Milestone berikutnya: security hardening (bcrypt + token server),
  pemisahan backend, probe monitoring
