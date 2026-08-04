# SP-027 — MILESTONE 1 — SMART CONSOLE FOUNDATION
## Implementation Plan

- **Status:** DRAFT → APPROVED (architect-approved sebelum coding)
- **Mode:** Architecture Only — membangun FOUNDATION Console
- **Referensi:** SP-026, SP-027, Hasil Audit Milestone 0 (GO, skor 7.25/10)

---

## 1. TUJUAN

Mengubah SMART Console (apps/console) dari aplikasi single-screen
(login ↔ satu monolith dashboard 2058 baris) menjadi **Platform Console
multi-halaman** dengan:

- Sidebar 8 menu: Dashboard, Applications, Companies, Super Admin,
  Platform Settings, System Information, Activity Log, Documentation
- Dashboard 8 widget
- Applications (mock repository, CRUD)
- Companies (API existing + search/pagination/filter/detail)
- Super Admin (search/pagination/reset password/enable/disable)
- System Information (halaman baru)
- Activity Log (halaman baru, mock)
- Documentation (halaman baru, placeholder)
- Platform Settings (logo upload, reuse service existing)

Semua UI memakai komponen SMART UI (Card, StatCard, Table, Badge, Button,
Modal, Pagination, Switch, Input, Select, SearchableSelect). **TANPA inline
style** (CSS via file assets/console.css + CSS komponen framework).

---

## 2. BATASAN (GOLDEN RULE M1)

| Area | Status |
|---|---|
| `apps/inventory/**` | 🔒 TIDAK diubah |
| `packages/smart-inventory-ui/**` | 🔒 TIDAK diubah |
| `@smart/core` | 🔒 TIDAK diubah (PlatformManager dipakai read-only) |
| `@smart/ui` | 🔒 TIDAK diubah (komponen dipakai apa adanya) |
| `@smart/api` / `@smart/data` | 🔒 TIDAK diubah |
| `apps/console/**` | ✅ BOLEH diubah (ini scope M1) |

Catatan: Server API (`apps/inventory/server`) TIDAK diubah. Konsol tetap
memakai endpoint existing (`/api/companies`, `/api/superadmins`,
`/api/platform/*`, `/api/wilayah/*`).

---

## 3. STRUKTUR TARGET

```
apps/console/src/
├── main.js                    # Bootstrap: loadUI, restore session, shell mount, logout
├── assets/
│   ├── favicon.svg            # existing
│   └── console.css            # BARU — CSS shell (sidebar/topbar/content) + halaman
├── config/
│   └── index.js               # BARU — CONSOLE_CONFIG: menu, apps registry, urls, version
├── layouts/
│   └── index.js               # REWRITE — ConsoleShell (AppShell) + attachConsoleShell
├── router/
│   ├── index.js               # REWRITE — Router: navigate(page), active menu, title
│   └── routes.js              # REWRITE — route registry (8 halaman)
├── services/
│   ├── companies.js           # existing (reuse)
│   ├── superadmins.js         # existing (reuse)
│   ├── platform.js            # existing (reuse)
│   ├── applications.js        # BARU — mock repo 8 aplikasi
│   ├── activity.js            # BARU — mock activity log
│   ├── system.js              # BARU — info system (AppConfig + placeholder)
│   └── impersonation.js       # BARU — handoff impersonation (dipindah dari dashboard.js)
├── pages/
│   ├── login/index.js         # existing (reuse, login page)
│   ├── dashboard/index.js     # BARU — 8 widget
│   ├── applications/index.js  # BARU — CRUD mock + toggle + open
│   ├── companies/index.js     # BARU — API + search/pagination/filter/detail + wilayah
│   ├── superadmins/index.js   # BARU — search/pagination/reset pw/enable/disable
│   ├── settings/index.js      # BARU — logo platform + info
│   ├── system/index.js        # BARU — system information
│   ├── activity/index.js      # BARU — activity log mock
│   └── documentation/index.js # BARU — placeholder docs
└── modules/platform/
    ├── login.js               # existing (reuse)
    ├── index.js               # REWRITE — hanya export login
    └── dashboard.js           # 🗑️ HAPUS — monolith digantikan halaman baru
```

---

## 4. YANG DIPINDAHKAN / DIHAPUS / DIBUAT

### 4.1 Dihapus
- `apps/console/src/modules/platform/dashboard.js` (monolith 2058 baris)
- `apps/console/src/pages/platform/index.js` (wrapper createPlatformDashboard)

### 4.2 Dipindahkan (logika bernilai dari monolith)
- `startImpersonation` + `getAppEntryUrl` → `services/impersonation.js`
- Logo platform upload/remove → reuse `services/platform.js`
- Wilayah cascading (prov/kab/kec/desa) → halaman Companies
- App logo per-aplikasi → halaman Applications + Settings

### 4.3 Dibuat (baru)
- `config/index.js`, `services/applications.js`, `services/activity.js`,
  `services/system.js`, `services/impersonation.js`, `assets/console.css`,
  8 halaman di `pages/*`, router baru

### 4.4 Dipertahankan
- `modules/platform/login.js` (login page), `pages/login/index.js`,
  `services/companies.js`, `services/superadmins.js`, `services/platform.js`

---

## 5. DEPENDENCY GRAPH (SESUDAH)

```
apps/console (main.js)
  ├── @smart/core        (AppConfig, Auth, platform, impersonation, audit)
  ├── @smart/ui          (loadUI, AppShell, Card, StatCard, Table, Badge,
  │                       Button, Modal, Pagination, Switch, Input, Select,
  │                       SearchableSelect, showToast)
  ├── @smart/api         (fallback helpers via services)
  ├── services/*         (companies, superadmins, platform, applications,
  │                       activity, system, impersonation)
  └── pages/* → router → layouts (ConsoleShell)

apps/console TIDAK bergantung pada apps/inventory / @smart/inventory-ui.
```

---

## 6. DETAIL HALAMAN

### 6.1 Dashboard (`pages/dashboard`)
8 StatCard:
1. Total Applications (mock repo)
2. Total Companies (API)
3. Total Super Admin (API)
4. Platform Version (AppConfig.version)
5. Server Status (placeholder "—")
6. Database Status (placeholder "—")
7. Active Companies (API filter active)
8. Registered Companies (API total)

### 6.2 Applications (`pages/applications`)
- Mock repo 8 apps: Inventory, Accounting, POS, Payroll, HRM, CRM, WMS, AI
  (field: id, code/slug, name, icon, status, domain, version, description)
- Kolom: Icon+Name, Code, Status (Badge), Domain, Version, Description, Action
- Action: Edit (Modal form), Enable/Disable (Switch/Button), Open (window.open domain)
- Search + status filter + Pagination

### 6.3 Companies (`pages/companies`)
- Reuse `listCompanies` (API, fallback in-memory)
- Search (name/code/email), Pagination, Filter (Semua / Aktif / Suspended)
- Kolom: Code, Nama, Jenis, Email, Status (Badge), Apps (badges), Action
- Action: Detail (Modal: info + logo + registered apps + status),
  Edit (Modal form + wilayah cascading + apps access), Login As (impersonation),
  Toggle Status, Delete

### 6.4 Super Admin (`pages/superadmins`)
- Reuse `listSuperadmins` + `updateSuperadmin`
- Search + Pagination
- Kolom: Username, Nama, Email, Role (Badge), Status, Last Login, Action
- Action: Reset Password (Modal), Enable/Disable, Edit, Delete, Add
- Catatan: model SuperAdmin tidak punya field `lastLogin` (hanya createdAt/
  updatedAt/resetToken). Kolom "Last Login" menampilkan "—" (tidak dilacak).

### 6.5 Platform Settings (`pages/settings`)
- Upload/Remove logo platform (reuse `uploadLogoToServer` / `removeLogoFromServer`)
- Upload logo per aplikasi (reuse `uploadAppLogoToServer`)
- Info platform (nama, version, env)

### 6.6 System Information (`pages/system`)
- Platform Version, Build Version, Environment, API URL (dari config)
- MongoDB Status (placeholder), Server Status (placeholder), Node Version (placeholder)

### 6.7 Activity Log (`pages/activity`)
- Mock service: Time, User, Activity, Target, Result
- Search + Pagination

### 6.8 Documentation (`pages/documentation`)
- Placeholder cards: Platform Architecture, SP Documents, Developer Guide,
  Deployment Guide

---

## 7. UI / KOMPONEN

- Shell: `AppShell` dari `@smart/ui/layouts` (Sidebar + Topbar) + `console.css`
  (framework TIDAK punya CSS shell → CSS disediakan app-level, pattern dari
  inventory main.css tetapi ditulis ulang khusus console, tanpa import inventory)
- Komponen: StatCard, Card, Table, Badge, Button, Modal, Pagination, Switch,
  Input, Select, SearchableSelect, EmptyState, showToast
- **Tidak ada inline style di kode baru. Tidak ada komponen duplikat.**
- Hardcoded URL → dihindari; semua URL di `config/index.js`
  (`APP_URLS`, `getAppEntryUrl`).

---

## 8. SESSION & AUTH

- Login: reuse `modules/platform/login.js` (POST /api/superadmins/login,
  set `Auth.currentUser`).
- Persist session ke localStorage (`smart_console_session`) di main.js agar
  refresh tidak logout (console-only, tidak menyentuh framework/inventory).
- Logout: `Auth.logout()` + hapus localStorage → tampilkan login.
- Gate: `Auth.isLoggedIn() && Auth.user()?.role === "superadmin"`.

---

## 9. RISIKO & MITIGASI

| Risiko | Mitigasi |
|---|---|
| Kehilangan fitur monolith (wilayah, impersonation, logo) | Logika dipindah ke service/halaman baru sebelum monolith dihapus |
| AppShell tanpa CSS | console.css menulis ulang layout shell (self-contained) |
| Komponen DOM-based (bukan string) | Halaman memakai pola append element / outerHTML helper |
| Session hilang saat refresh | Persist ke localStorage (console-only) |
| Regression inventory | Inventory TIDAK disentuh; build+test diverifikasi |

---

## 10. CHECKLIST IMPLEMENTASI

- [ ] Implementation Plan selesai
- [ ] config + services baru
- [ ] console.css
- [ ] layouts + router
- [ ] 8 halaman
- [ ] main.js rewrite + hapus monolith
- [ ] Build console PASS, Build inventory PASS
- [ ] Test 509/509 PASS
- [ ] Lint tanpa error baru (hanya no-undef browser-globals pra-eksisting)
- [ ] Change Report
- [ ] Commit: `feat(console): implement SP-027 milestone 1 smart console foundation`

---

## 11. ESTIMASI EFFORT

| Tahap | Effort |
|---|---|
| Config + services | S |
| CSS shell + halaman | M |
| Router + layouts | S |
| 8 halaman | L |
| main.js + cleanup | S |
| Build/test/lint/fix | M |
| Change Report + commit | S |
| **Total** | **~1 iterasi penuh** |
