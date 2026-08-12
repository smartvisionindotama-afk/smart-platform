# SP-027 — MILESTONE 4: SMART PLATFORM MONITORING CENTER

> Mode: Implementation — Monitoring & Observability Foundation
> Tanggal: 2026-08-08
> Branch: `epic-002-inventory`
> Executor: Freebuff (AI Agent)

---

## 1. Ringkasan Eksekutif

Monitoring Center dibangun **di dalam SMART Console** (`master.e-profit.id`) sebagai platform control center. Seluruh data health diambil dari **Monitoring API di `apps/console/server`** — Console TIDAK bergantung pada business API Inventory (Golden Rule 3 & 4).

| Capability | Status |
|---|---|
| Application Monitoring (Console + Inventory) | ✅ |
| Service Health (console-api, inventory-api, mongodb) | ✅ |
| API Monitoring (availability, response time, HTTP status) | ✅ |
| Infrastructure Monitoring (CPU, RAM, Disk, Load, Uptime) | ✅ |
| Database Monitoring (MongoDB ping ringan) | ✅ |
| Process Monitoring (PM2 — kondisi aktual server) | ✅ |
| Health Check Contract reusable | ✅ |
| Application Registry extensible (config + env override) | ✅ |
| Alert Severity Foundation (INFO/WARNING/ERROR/CRITICAL) | ✅ |
| Monitoring History (retensi TTL 7 hari) | ✅ |
| Auto Refresh configurable (default 30s) + Last Updated | ✅ |
| Security M3 tetap aktif (401/403, tidak ada endpoint publik) | ✅ |
| Failure handling (Inventory DOWN → Console tetap HEALTHY) | ✅ |

**Hasil validasi:** ✅ Test 621/621 (60 baru) · ✅ Build console & inventory · ✅ Smoke test E2E 29/29 (termasuk failure test) · ✅ Production verification live · ✅ Zero regression.

---

## 2. Monitoring Architecture Diagram

```
SMART CONSOLE (master.e-profit.id) — SPA
        │
        ▼
Monitoring API  (apps/console/server  :3002)   ← GOLDEN RULE 4
        │
        ├── /api/monitoring/overview          (ringkasan platform)
        ├── /api/monitoring/applications      (health aplikasi)
        ├── /api/monitoring/services          (console-api/inventory-api/mongodb)
        ├── /api/monitoring/infrastructure    (CPU/RAM/Disk/Load/Uptime)
        ├── /api/monitoring/database          (MongoDB ping)
        ├── /api/monitoring/processes         (PM2)
        ├── /api/monitoring/history           (event monitoring, retensi)
        └── /api/monitoring/health            (health contract reusable)
              │
              ├── Application Health  → GET http://127.0.0.1:3002/api/health (console)
              │                        GET http://127.0.0.1:3001/api/health (inventory)
              ├── API Health          → sama (health endpoint ringan, bukan business API)
              ├── Infrastructure      → os (CPU/mem/load/uptime) + fs.statfsSync (disk)
              ├── Database Health     → mongoose ping { ping: 1 } (ringan)
              └── Process Health      → pm2 jlist (kondisi aktual server)
                    │
                    ▼
        MongoDB — monitoringevents (history, TTL retention)
```

**Prinsip isolasi (SP-027 M4 §12):** setiap checker independen + timeout. Kegagalan SATU service (mis. Inventory DOWN) tidak menggagalkan yang lain — dibuktikan oleh failure test & unit test.

---

## 3. Health Check Contract

**Per-service** (`GET /api/health` — console & inventory, sekarang menyertakan version/uptime):

```json
{
  "status": "ok",
  "service": "inventory-api",
  "version": "1.0.0",
  "uptime": 6,
  "timestamp": 1786189184287
}
```

**Platform** (`GET /api/monitoring/health` — reusable, dilindungi):

```json
{
  "status": "HEALTHY",
  "timestamp": 1786189226175,
  "services": { "console": "HEALTHY", "inventory": "HEALTHY", "mongodb": "HEALTHY" }
}
```

Implementasi: `apps/console/server/monitoring/health.js` (`platformHealthContract`, `combineStates` — worst-wins, case-insensitive). Status konsisten: **HEALTHY / WARNING / DEGRADED / DOWN / UNKNOWN** (SP-027 M4 §3).

---

## 4. Monitoring API Specification

| Endpoint | Method | Auth | Deskripsi |
|---|---|---|---|
| `/api/monitoring/health` | GET | SA | Health contract platform (reusable) |
| `/api/monitoring/overview` | GET | SA | Ringkasan lengkap dashboard |
| `/api/monitoring/applications` | GET | SA | Health aplikasi (registry) |
| `/api/monitoring/services` | GET | SA | console-api / inventory-api / mongodb |
| `/api/monitoring/infrastructure` | GET | SA | CPU, RAM, Disk, Load, Uptime |
| `/api/monitoring/database` | GET | SA | MongoDB ping ringan |
| `/api/monitoring/processes` | GET | SA | PM2 process list |
| `/api/monitoring/history?limit=` | GET | SA | Event monitoring (retensi TTL) |

Auth: `security.authenticate` (401) + `security.requireSuperAdmin` (403) di `apps/console/server/routes/monitoring.js` — **tidak ada monitoring endpoint publik** (GOLDEN RULE 7 / SP-027 M4 §11).

Response `overview` (ringkas):

```json
{
  "timestamp": 1786189226175,
  "status": "HEALTHY",
  "summary": { "registeredApps": 7, "monitoredApps": 2, "healthy": 2, "warning": 0, "degraded": 0, "down": 0, "unknown": 0 },
  "applications": [ { "id": "console", "name": "SMART Console", "status": "HEALTHY", "responseTime": 3, "version": "1.0.0", ... } ],
  "services": { "console": {...}, "inventory": {...}, "mongodb": {...} },
  "database": { "status": "HEALTHY", "responseTime": 2 },
  "infrastructure": { "cpu": {...}, "memory": {...}, "disk": {...}, "uptime": {...} },
  "processes": { "available": true, "processes": [ { "name": "console-api", "status": "ONLINE", "pid": ..., "cpu": ..., "memory": ..., "restarts": ... } ] }
}
```

---

## 5. Application Registry Specification

Sumber konfigurasi: `apps/console/server/monitoring/apps.config.js` (bukan hardcode di dashboard).

```js
{
  id: "inventory",
  name: "SMART Inventory",
  domain: "https://inv.e-profit.id",
  environment: "production",
  healthEndpoint: "http://127.0.0.1:3001/api/health",
  apiEndpoint: "http://127.0.0.1:3001/api",
  status: "active",
  monitoringEnabled: true
}
```

- **Default:** console + inventory aktif; wms/eprofit/santripintar/sitampan/desainsight terdaftar nonaktif (siap diaktifkan tanpa redesign).
- **Override/perluasan via env** `MONITORING_APPS_JSON` (array JSON — id sama menimpa, id baru menambah): `apps/console/server/monitoring/registry.js` `listRegistry()/listMonitoredApps()`.
- Dibuktikan unit test `registry.test.js` (8 test) dan dipakai di smoke test (health endpoint diarahkan ke port uji via env).

---

## 6. Monitoring Data Model & Alert Severity Model

**Model** (`apps/console/server/models/MonitoringEvent.js`, collection `monitoringevents`):

```
timestamp (ms), service, metric, status, value (Mixed), severity, message, createdAt
+ TTL index createdAt (expireAfterSeconds = MONITORING_RETENTION_DAYS × 86400, default 7 hari)
```

Recorder (`monitoring/history.js`): fail-open (tidak memblokir monitoring), **anti-flood** — event hanya direkam pada TRANSISI state (atau observasi pertama non-HEALTHY); state non-HEALTHY yang bertahan TIDAK direkam ulang tiap siklus polling (satu insiden = satu event; dibuktikan unit test `history.test.js`). Recovery → event INFO. Health normal tidak membanjiri history (anti false-positive).

**Alert severity** (`monitoring/alerts.js`):

| Health State | Severity |
|---|---|
| DOWN | CRITICAL |
| DEGRADED | ERROR |
| WARNING | WARNING |
| UNKNOWN | WARNING (ringan) |
| HEALTHY | INFO (hanya pada transisi/recovery) |

Contoh event: `2026-08-08 17:20 · inventory-api · response_time · WARNING · 1850ms · API response degraded`.

---

## 7. Dashboard Implementation

- Page: `apps/console/src/pages/monitoring/index.js` (renderMonitoring + auto-refresh)
- Service: `apps/console/src/services/monitoring.js` (authorizedFetch ke /api/monitoring/*)
- Menu: `Monitoring Center 📡` di `apps/console/src/config/index.js` (MENU_ITEMS) + routing di `apps/console/src/main.js`
- Fitur: Platform Overview (Applications/Healthy/Warning/Degraded/Down/Unknown) · System Health (CPU/mem/disk bar + Load + Uptime) · Application Health table · API/Service & Database table · Process (PM2) table · Monitoring History table · **Last Updated** + **Auto refresh configurable** (15/30/60/120s, persisted localStorage, default 30s, pause saat tab tersembunyi).

---

## 8. Security Integration Report

- Seluruh endpoint monitoring di belakang global `authenticate()` (M3) + `requireSuperAdmin()` — **bukan whitelist publik** (`apps/console/server/index.js` PUBLIC_RULES TIDAK memuat `/monitoring`).
- 401 tanpa token, 403 untuk token user non-superadmin (dibuktikan smoke test).
- Checker internal hanya memanggil **health endpoint** (bukan business API) — tidak mengekspos data bisnis.
- Tidak ada secret baru; `MONITORING_*` di `.env.example` hanyalah parameter (bukan secret).
- Audit: aktivitas monitoring tidak menambah log security baru (read-only observability).

---

## 9. Failure Test Report

Smoke test E2E (`/tmp/m4-smoke.mjs`, DB uji terpisah `mongod :27018`, port uji 3101–3103):

| Simulasi | Hasil |
|---|---|
| Inventory healthEndpoint → port mati (3999) | ✅ inventory **DOWN** |
| Console tetap dicek | ✅ console **HEALTHY** (isolasi) |
| MongoDB tetap dicek | ✅ status dilaporkan |
| Platform status | ✅ **DOWN** (worst-wins, bukan HEALTHY) |
| Monitoring API sendiri | ✅ tetap **200** (resilien) |
| History mencatat event DOWN | ✅ `inventory-api` DOWN tercatat |
| DB `monitoringevents` + TTL index | ✅ terisi + `expireAfterSeconds` aktif |

Unit test isolasi: `service.test.js` (Inventory DOWN → Console HEALTHY, DB DOWN → platform DOWN, PM2 unavailable → UNKNOWN, infra WARNING → platform WARNING).

---

## 10. Build Report

| Item | Hasil |
|---|---|
| `npm test` | ✅ **621/621** (baseline 561 + 60 test baru M4) |
| `npm run build:console` | ✅ built |
| `npm run build:inventory` | ✅ built |
| `npm run lint` — file M4 | ✅ 0 error |

---

## 11. Regression Test Report

**Zero regression:**
- Business logic Inventory — tidak diubah (hanya `/api/health` ditambah field version/service/uptime — observability, bukan business).
- Schema bisnis — tidak diubah; hanya collection baru `monitoringevents`.
- Console pages/services lain — tidak diubah selain MENU_ITEMS + router (penambahan).
- Security M3 — seluruh test keamanan tetap hijau; monitoring tidak melemahkan apa pun.
- `vitest.config.js` — include bertambah (`apps/*/server/**/*.test.js`), tidak mengubah yang ada.

---

## 12. Production Verification Report

| Item | Hasil |
|---|---|
| `pm2 restart console-api inventory-api` | ✅ online, health 200/200 |
| Health contract produksi | ✅ `{status:"ok",service:"console-api"/"inventory-api",version:"1.0.0",uptime}` |
| `/api/monitoring/overview` tanpa token | ✅ 401 |
| `/api/monitoring/overview` + token superadmin | ✅ 200 |
| Platform status produksi | ✅ **HEALTHY** |
| Services produksi | ✅ console/inventory/mongodb HEALTHY |
| Infrastruktur produksi | ✅ cpu/mem/disk HEALTHY (load1 0.37, mem 53%, disk 17.6%) |
| Proses produksi | ✅ inventory-api ONLINE, console-api ONLINE |
| Akses via domain | ✅ `master.e-profit.id/api/...` (nginx proxy — port internal tidak dibuka ke internet) |

> Verifikasi via token yang ditandatangani dengan `JWT_SECRET` produksi (endpoint private). Frontend page sudah ter-build di `apps/console/dist` (nginx serve).

---

## 13. Final Audit (SP-027 M4 §19)

| # | Pertanyaan | STATUS | BUKTI / PATH FILE |
|---|---|---|---|
| 1 | Apakah Console masih independen dari Inventory? | ✅ PASS | Console tidak mengimpor/memanggil business API Inventory; hanya health endpoint (`apps/console/server/monitoring/apps.config.js`, `checkers.js`) |
| 2 | Apakah Monitoring API benar-benar di `apps/console/server`? | ✅ PASS | `apps/console/server/routes/monitoring.js` + `monitoring/*`; mount `app.use("/api/monitoring", ...)` di `apps/console/server/index.js` |
| 3 | Apakah Monitoring memakai business API Inventory? | ✅ PASS | Checker hanya `GET {healthEndpoint}/api/health` (GOLDEN RULE 3) — `apps/console/server/monitoring/checkers.js` |
| 4 | Apakah seluruh monitoring endpoint terlindungi? | ✅ PASS | `router.use(security.authenticate, security.requireSuperAdmin)` — 401/403 dibuktikan smoke test (`/tmp/m4-smoke.mjs`) |
| 5 | Apakah Application Registry extensible? | ✅ PASS | `apps.config.js` + env `MONITORING_APPS_JSON` override/append — unit test `registry.test.js` |
| 6 | Apakah monitoring tetap bekerja saat Inventory DOWN? | ✅ PASS | Failure test: inventory DOWN → console HEALTHY, API tetap 200 (`/tmp/m4-smoke.mjs`, `service.test.js`) |
| 7 | Apakah ada dependency baru yang melanggar arsitektur? | ✅ PASS | Hanya dependensi: mongoose (ada), os/fs/child_process (builtin), express (ada) — tidak ada package baru |
| 8 | Apakah build berhasil? | ✅ PASS | `build:console` ✓ `build:inventory` ✓ |
| 9 | Apakah seluruh test berhasil? | ✅ PASS | `npm test` 621/621 |
| 10 | Apakah production verification berhasil? | ✅ PASS | `master.e-profit.id/api/monitoring/*` → 401/403/200, platform HEALTHY (lihat §12) |

**FINDING (backlog, bukan dikerjakan di M4):**
- Notification platform penuh (email/telegram/webhook alert) — keluar scope M4 (§14), siap di atas Alert Severity Model.
- Penyimpanan registry via UI/DB (super admin tambah aplikasi tanpa edit config) — saat ini config + env override; DB-backed dapat menjadi M5.
- Health check endpoint Inventory menambahkan field `version/uptime` — observability, bukan perubahan business logic.
- Metrik **swap** (SP-027 M4 §3D "jika tersedia") — belum diimplementasikan (Node `os` tidak mengekspos swap langsung); tercatat sebagai backlog observability.

**Hardening hasil code review (putaran 1):**
- **Anti-flood history** — event non-HEALTHY hanya pada transisi/observasi pertama (`history.js`), bukan tiap siklus polling; test `history.test.js` (8 test).
- **SSRF defense-in-depth** — `checkHttpHealth` memakai `redirect: "manual"`; 3xx diperlakukan DOWN (endpoint health operator tidak boleh mengarahkan server ke alamat internal lain).
- **Listener leak client** — `visibilitychange` memakai handler bernama + `removeEventListener` di `stopAutoRefresh`; dead code (`cleanupMonitoring`/`_rendering`) dihapus.
- **Numeric guard PM2** — `cpu`/`memory`/`restarts` di-coerce dengan `Number()` + `Number.isFinite` (hindari NaN di UI).
- Auth berlapis (global + router `requireSuperAdmin`) dipertahankan sebagai defense-in-depth.

---

## 14. Definition of Done

| Kriteria | Status |
|---|---|
| Monitoring Center tersedia | ✅ |
| Console Health tersedia | ✅ |
| Inventory Health tersedia | ✅ |
| API Health tersedia | ✅ |
| Database Health tersedia | ✅ |
| Infrastructure Health tersedia | ✅ |
| Process Health tersedia | ✅ |
| Health contract tersedia | ✅ |
| Application Registry extensible | ✅ |
| Monitoring API di Console Backend | ✅ |
| Security M3 tetap aktif | ✅ |
| Failure handling berhasil | ✅ |
| Auto refresh berjalan | ✅ |
| Monitoring history foundation tersedia | ✅ |
| Unit test PASS | ✅ 60 test M4 |
| Integration test PASS | ✅ 29/29 E2E |
| Regression test PASS | ✅ 621/621 |
| Production verification PASS | ✅ |
| Tidak ada architecture violation | ✅ |

**MILESTONE 4: PASS ✅**
