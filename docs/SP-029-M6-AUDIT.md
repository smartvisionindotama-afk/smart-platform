# SP-029-M6 — SMART Billing & Subscription Center — AUDIT REPORT

**Tanggal:** 2026-08-08
**Branch:** epic-002-inventory
**Executor:** Freebuff
**Status:** ✅ COMPLETE & LIVE

---

## 1. Executive Summary

SMART Console kini memiliki **commercial control plane** (M6) di samping technical control plane (M0–M5): Company → Plan → Feature → Subscription → Entitlement → Usage → Invoice → Payment → Access. Seluruh domain komersial berada di `apps/console/server` (Platform Domain), aman dengan Security M3, server-side calculation (integer minor units), idempotency, dan audit. **Tidak ada mutasi finansial nyata** — payment default mode SIMULATION.

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | 4 plans (free/starter/pro/enterprise) + 10 features ter-seed di produksi | `apps/console/server/seed.js` |
| ✅ | 30 entitlement legacy (grandfathering M6 §56) — company existing tidak diblokir | `apps/console/server/seed.js` |
| ✅ | 727/727 test, lint 0, build console + inventory | `apps/console/server/__tests__/billing.test.js` |
| ✅ | E2E smoke 15/15 (temp DB) + produksi live | — |

---

## 2. Current State Audit

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Tidak ada kode billing/payment existing → M6 foundation dari nol | `grep -rln 'billing\|invoice\|payment\|subscription' apps/console/server` |
| ✅ | Company model reusable (`code` unique, `active`, `apps`) | `apps/console/server/models/Company.js` |
| ✅ | Security M3 siap (`authenticate` + `requireSuperAdmin` + `audit.superadminActivity`) | `apps/console/server/security.js` |
| ✅ | Tidak ada conflict dengan M0–M5 | — |

---

## 3. Company/Tenant Integration

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Subscription.ref companyId → Company | `apps/console/server/models/Subscription.js` |
| ✅ | Grandfathering: company existing tanpa subscription mendapat entitlement (tidak diblokir) | `apps/console/server/seed.js` |
| ✅ | Produksi: 3 company × 10 feature = 30 entitlement source PLAN | MongoDB `entitlements` |

---

## 4. Plan Management

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model Plan (slug unique, price integer minor units, billingCycle, features, limits) | `apps/console/server/models/Plan.js` |
| ✅ | CRUD + validasi slug/harga + unique slug | `apps/console/server/routes/plans.js` |
| ✅ | Seed 4 plan idempotent | `apps/console/server/seed.js` |
| ✅ | Produksi: 4 plans terverifikasi | MongoDB `plans` |

---

## 5. Feature Catalog

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model Feature (slug unique, category, unit) | `apps/console/server/models/Feature.js` |
| ✅ | CRUD + unique slug | `apps/console/server/routes/features.js` |
| ✅ | Seed 10 feature (ep_profit, inventory, pos, smartwms, santripintar, sitampan, desa_insight, advanced_reporting, ai_accounting, api_access) | `apps/console/server/seed.js` |
| ✅ | FEATURE ≠ APPLICATION (abstraction) | `docs/SP-022` referensi model |

---

## 6. Pricing

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Harga integer minor units di Plan + snapshot `price` di Subscription (perubahan harga tidak mengubah histori) | `apps/console/server/models/Subscription.js` |
| ✅ | Currency abstraction (IDR default, bukan hardcode di logic) | semua model |

---

## 7. Subscription

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model (status enum lengkap, trial, cancellation fields, autoRenew) | `apps/console/server/models/Subscription.js` |
| ✅ | Lifecycle tervalidasi state machine (`canTransition`) — bukan arbitrary update | `apps/console/server/billing/billing-core.js` + `routes/subscriptions.js` |

---

## 8. Subscription Lifecycle

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED/EXPIRED (terminal) | `apps/console/server/billing/billing-core.js` |
| ✅ | Action: create/activate/renew/change-plan/suspend/resume/cancel (immediate + at period end)/expire | `apps/console/server/routes/subscriptions.js` |
| ✅ | Setiap perubahan → SubscriptionChange + sync entitlement + audit | `apps/console/server/routes/subscriptions.js` (`recordChange`) |
| ✅ | E2E: transisi invalid ditolak (TRIAL→SUSPENDED 400) | smoke test |

---

## 9. Entitlement

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model (source PLAN/ADDON/PROMOTION/MANUAL, limit, used, period, effective) | `apps/console/server/models/Entitlement.js` |
| ✅ | Sync dari subscription (idempotent, MANUAL override dipertahankan, upsert anti-race) | `apps/console/server/billing/entitlement-service.js` |
| ✅ | Manual override: reason wajib + audit + expiry | `apps/console/server/routes/entitlements.js` |
| ✅ | Entitlement check API untuk aplikasi (`/api/entitlements/check/:companyCode/:featureSlug`) | `apps/console/server/routes/entitlements.js` |

---

## 10. Usage Metering

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model UsageRecord (metric, quantity, period, source whitelist, ref) | `apps/console/server/models/UsageRecord.js` |
| ✅ | Record + aggregate + status (limit/used/remaining) | `apps/console/server/routes/usage.js` |
| ✅ | Source HANYA APPLICATION/API/WORKER/AI/MANUAL — usage browser ditolak (400) | `apps/console/server/routes/usage.js` |
| ✅ | Snapshot `used` di entitlement ikut ter-update (via service) | `apps/console/server/billing/entitlement-service.js` |

---

## 11. Billing Engine

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Perhitungan SERVER-SIDE integer minor units (trunc, tanpa float) | `apps/console/server/billing/billing-core.js` |
| ✅ | calculateInvoiceTotal: subtotal + addon − discount + tax | unit test 21/21 |
| ✅ | Frontend tidak menentukan total | UI hanya menampilkan |

---

## 12. Invoice

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model (items, subtotal/discount/tax/total, status enum, issuedAt/paidAt) | `apps/console/server/models/Invoice.js` |
| ✅ | invoiceNumber unique + reproducible `INV/YYYY/MM/seq` | `apps/console/server/billing/billing-core.js` |
| ✅ | **Sequence ATOMIK** (counter `findOneAndUpdate $inc` — anti race) | `apps/console/server/billing/counter.js` |
| ✅ | Anti double-billing: unique index (subscriptionId, periodStart, periodEnd) + cek eksplisit | `apps/console/server/billing/invoice-service.js` |
| ✅ | Status transition divalidasi (DRAFT→ISSUED→PENDING→PAID/OVERDUE...) | `apps/console/server/billing/invoice-service.js` |

---

## 13. Payment

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Model (transactionReference unique → idempotency) | `apps/console/server/models/Payment.js` |
| ✅ | Record + verify (server-side) + refund foundation | `apps/console/server/routes/payments.js` + `billing/payment-service.js` |
| ✅ | **Mode SIMULATION default** (`BILLING_PAYMENT_MODE !== "live"`) — tanpa mutasi finansial nyata | `apps/console/server/billing/payment-service.js` |

---

## 14. Payment Provider / Webhook

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Webhook didaftarkan SEBELUM `router.use(authenticate)` — provider tanpa JWT bisa memanggil | `apps/console/server/routes/payments.js` |
| ✅ | Diverifikasi `BILLING_WEBHOOK_SECRET` (fail-closed) | `apps/console/server/routes/payments.js` |
| ✅ | Idempotent by transactionReference (duplikat → duplicate:true) | `apps/console/server/routes/payments.js` |
| ✅ | Webhook otomatis issue invoice DRAFT → PAID (state machine dihormati) | `apps/console/server/routes/payments.js` |
| ✅ | PUBLIC_RULES di index.js memuat `/payments/webhook` POST | `apps/console/server/index.js` |
| ✅ | Produksi: webhook anonim tanpa secret → 401 | live verification |

---

## 15. Security

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Semua endpoint billing: `authenticate` + `requireSuperAdmin` (M3) | semua route |
| ✅ | Anonim → 401 (9 endpoint diverifikasi live) | — |
| ✅ | Tidak ada financial calculation trusted dari frontend | semua di service |
| ✅ | Payment verification server-side (mode simulation) | `payment-service.js` |
| ✅ | No secrets di frontend (MongoDB URI tidak pernah ke browser) | — |

---

## 16. RBAC

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Menggunakan Security M3 (`requireSuperAdmin`) — tidak ada bypass | semua route |
| ✅ | Permission khusus per area (`billing.*`) siap sebagai abstraction di masa depan | docs SP-029 §40 |

---

## 17. Audit Trail

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | plan.create/update, feature.create/update, subscription.* (create/activate/renew/upgrade/downgrade/suspend/resume/cancel/expire), invoice.create/issue/void/transition, payment.record/verify/refund/webhook_rejected/webhook_processed, entitlement.override, usage.record | semua route memanggil `audit.superadminActivity` |
| ✅ | Actor + target + metadata + IP + userAgent | pola konsisten |

---

## 18. Application Integration

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Entitlement check API (`/check/:companyCode/:featureSlug`) — controlled, tidak memaksa Inventory berubah | `apps/console/server/routes/entitlements.js` |
| ✅ | Aplikasi tidak perlu tahu detail billing DB | — |
| ✅ | **Tidak ada perubahan Business Logic Inventory** (Golden Rule) | git status |

---

## 19. Console UI

| STATUS | BUKTI | PATH |
|---|---|---|
| ✅ | Menu Billing (💳) → Billing Center dengan 8 tab: Overview/Plans/Features/Subscriptions/Invoices/Payments/Usage/Entitlements | `apps/console/src/config/index.js` + `apps/console/src/pages/billing/index.js` |
| ✅ | MRR/ARR hanya dari subscription ACTIVE — tanpa data fiktif | `apps/console/src/services/billing.js` |
| ✅ | Semua nilai di-esc (anti-XSS), formatIDR, status chips | `apps/console/src/pages/billing/index.js` |
| ✅ | Bundle produksi memuat "Billing Center" | live verification |

---

## 20. Test Results

| Item | Hasil |
|---|---|
| `npm test` | ✅ **727/727** (21 test baru billing-core: state machine, invoice calc, invoice number, period helpers) |
| Lint | ✅ 0 error |
| Build console | ✅ |
| Build inventory | ✅ |
| E2E smoke (temp DB, full server) | ✅ **15/15**: login, anonim 401 ×3, webhook tanpa/salah secret 401, subscription lifecycle, entitlement sync, usage record + snapshot, invoice generate + nomor + total + idempotent, webhook positif + idempotent, invoice PAID |

---

## 21. Production Verification

| Item | Hasil |
|---|---|
| Health | ✅ 200 |
| Seed | ✅ 4 plans + 10 features + 30 legacy entitlements (source PLAN) |
| Anonim 9 endpoint billing | ✅ 401 |
| Webhook anonim | ✅ 401 |
| Bundle | ✅ `index-B30L-ADm.js` memuat "Billing Center" |
| Auto-deploy produksi | ⛔ TIDAK (M6 §52 — tanpa mutasi finansial nyata) |

---

## 22. Technical Debt

1. **Invoice counter** sudah atomic; namun invoice `paidAt` saat webhook tidak menset `dueAt`/grace period — backlog policy bisnis.
2. **Proration** upgrade/downgrade = `none` (policy sederhana, terdokumentasi di `SubscriptionChange.proration`).
3. **Tax policy** hanya abstraction (`taxRate`) — implementasi pajak mengikuti kebijakan legal/bisnis (belum ditetapkan).
4. **Notification engine** belum ada — event foundation saja (M6 §47).
5. **Grace period** belum otomatis — backlog.
6. **Entitlement enforcement** pada aplikasi (Inventory) belum diaktifkan — sengaja controlled (M6 §55: jangan memutus aplikasi existing).

## 23. Risks

- Jika `BILLING_PAYMENT_MODE=live` diset tanpa provider terverifikasi, payment simulation tidak lagi otomatis — perlu integrasi provider sungguhan (di luar scope M6).
- Invoice count per bulan di-counter terpisah dari histori invoice lama (counter mulai dari 1 untuk bulan berjalan) — acceptable untuk foundation.

## 24. M6-FIX — Invoice by Company + Harga per Fitur per Perusahaan

Laporan tambahan (post-audit) setelah umpan balik user: tidak ada cara menerbitkan invoice
untuk perusahaan yang memakai aplikasi tanpa subscription, dan tidak ada pengaturan harga
per fitur per perusahaan.

### Fitur

| Item | Implementasi | PATH |
|---|---|---|
| Harga katalog per fitur | `Feature.price` (integer minor units, default 0) | `apps/console/server/models/Feature.js` |
| Harga override per perusahaan | `Entitlement.price` (null = pakai katalog) + `priceReason` (tidak menimpa marker legacy grandfathering) | `apps/console/server/models/Entitlement.js` |
| Resolusi harga pure | `resolveFeaturePrice()` (override ?? katalog) + `buildCompanyItems()` (fitur enabled + harga > 0) | `apps/console/server/billing/billing-core.js` |
| Invoice by Company | `createCompanyInvoiceForPeriod()` — item per fitur, server-side, idempotent per (company, periode) | `apps/console/server/billing/invoice-service.js` |
| Endpoint | `POST /api/invoices/generate-company` (audit `invoice.create_company`, E11000 → duplicate) | `apps/console/server/routes/invoices.js` |
| Set harga | `POST /api/entitlements/price` (reason wajib, 0 = gratis, null = reset, auto-create entitlement company baru, audit `entitlement.price_set`) | `apps/console/server/routes/entitlements.js` |
| Partial unique index | `uniq_sub_company_period` (ber-subscription) + `uniq_company_period_nosub` (company-based) — anti double-billing tanpa false-collision antar company | `apps/console/server/models/Invoice.js` |
| Seed harga katalog | Upsert `$setOnInsert` (tidak menimpa harga existing) | `apps/console/server/seed.js` |
| Billing summary | Menampilkan SEMUA entitlement (bukan hanya plan.features) + price/defaultPrice/inPlan | `apps/console/server/routes/billing-summary.js` |
| UI | Tombol `+ Invoice by Company` (pilih company + periode) + kolom Harga & tombol `Set Harga` di tab Entitlements | `apps/console/src/pages/billing/index.js`, `apps/console/src/services/billing.js` |

### Perbaikan dari code review

| Temuan | Fix |
|---|---|
| **HIGH** — index lama non-partial `subscriptionId_1_periodStart_1_periodEnd_1` masih di produksi → invoice company-based (subscriptionId null) untuk 2 company periode sama collide E11000 | Index baru diberi nama eksplisit; index lama **di-drop di produksi** (`db.invoices.dropIndex`); diverifikasi partial index baru aktif + 2 company periode sama → 201 |
| **MEDIUM** — `price: 0` diartikan reset ke katalog (tidak bisa set gratis eksplisit) | Semantik baru: `null/""` = reset katalog, `0` = eksplisit gratis (disimpan 0, `buildCompanyItems` skip ≤0) |
| **MEDIUM** — `POST /price` menimpa `ent.reason` (menghancurkan marker legacy grandfathering) | Alasan disimpan di field terpisah `priceReason` |
| **LOW** — race E11000 → error mentah | Catch code 11000 → kembalikan `duplicate:true` |
| **LOW** — company baru tanpa subscription tidak bisa set harga | `/price` auto-create entitlement (`enabled: true, source: PLAN`) |
| **BUG** — `nextSequence` selalu return 1 (`doc.value` undefined pada native driver v4+) → nomor invoice duplikat | `doc?.value?.seq ?? doc?.seq ?? 1` + `Number.isFinite` guard |

### Verifikasi M6-FIX

| Item | Hasil |
|---|---|
| Unit test billing-core (`resolveFeaturePrice`/`buildCompanyItems`) | ✅ **36/36** |
| E2E smoke Invoice by Company (temp DB) | ✅ **25/25** — set harga override/katalog/gratis/reset, item per fitur, idempotent, fitur disabled tidak ditagih, 2 company periode sama tidak collide, anon 401, issue invoice, billing summary |
| E2E smoke Enforcement (regresi) | ✅ **21/21** — setup 12/12, flag 4/4, block 2/2, grandfather 3/3 |
| `npm test` | ✅ **754/754** (40 file) |
| Lint / Build | ✅ 0 error · console + inventory ✓ |
| Produksi live | ✅ health 200 · 10 fitur terisi harga katalog · bundle `billing-CtSxX61y.js` · set harga 125000 → invoice 201 → void (cleanup) · 2 company periode sama 201 · index partial aktif · invoice test semua VOID |
| Arsitektur | ✅ Console mandiri (tanpa dependency Inventory); RBAC M3 + audit aktif; tidak ada mutasi finansial produksi permanen (semua invoice test di-void) |

## 25. M6-FIX v2 — Payment Settle Chain + Harga Katalog Feature

Laporan lanjutan setelah umpan balik user: (1) alur invoice → payment → subscription
harus otomatis konsisten, (2) harga katalog (Feature.price) harus bisa diedit dari UI
plus indikator override per perusahaan.

### Task 1 — Payment Settle Chain (invoice → payment → subscription → entitlement)

| Item | Implementasi | PATH |
|---|---|---|
| Settle pasca-payment | `settlePostPayment()`: invoice PAID → subscription TRIAL→ACTIVE / PAST_DUE,SUSPENDED→ACTIVE / ACTIVE→renew endDate (sumber tunggal `addBillingCycle`) + record `SubscriptionChange` + `syncEntitlementsFromSubscription`; company-based → entitlement yang ditagih `effectiveUntil = periodEnd` | `apps/console/server/billing/payment-service.js` |
| Auto-issue DRAFT | `verifyPayment` (dan webhook) auto-issue DRAFT→ISSUED→PAID — state machine konsisten | `apps/console/server/billing/payment-service.js`, `apps/console/server/routes/payments.js` |
| Anti-race verify | Transisi PENDING→PAID via conditional update (`_id` + status) — dua request konkuren tidak double-settle | `apps/console/server/billing/payment-service.js` |
| Failure isolation | Settle gagal TIDAK membatalkan invoice PAID — dicatat audit `payment.settle_failed`, response tetap sukses dengan `settle` info | `apps/console/server/billing/payment-service.js` |
| Status terminal | CANCELLED/EXPIRED → flag eksplisit (`invoicePaid: true`, akses tidak dipulihkan) | `apps/console/server/billing/payment-service.js` |
| Renew konsisten | `addBillingCycle()` (MONTHLY = kalender, YEARLY = +1 tahun) dipakai settle DAN route `/renew` — anti drift | `apps/console/server/billing/billing-core.js`, `apps/console/server/routes/subscriptions.js` |

### Task 2 — Harga Katalog Feature + indikator override

| Item | Implementasi | PATH |
|---|---|---|
| Edit harga katalog | `PUT /api/features/:id` menerima `price` (validasi integer ≥ 0, audit `feature.update`); POST juga | `apps/console/server/routes/features.js` |
| Indikator override | `GET /api/features` agregasi `Entitlement.price != null` → `overrideCount` per slug | `apps/console/server/routes/features.js` |
| UI Features tab | Kolom **Harga Katalog** (Rp/Gratis) + **Override** (badge `N company override`); modal Edit/Tambah punya field Harga + peringatan bila ada override | `apps/console/src/pages/billing/index.js` |

### Verifikasi M6-FIX v2

| Item | Hasil |
|---|---|
| Unit test | ✅ **44/44** (+4 `normalizeFeaturePrice`, +4 `addBillingCycle`) |
| E2E smoke Payment Settle | ✅ **22/22** — TRIAL→ACTIVE + endDate renew + entitlement sync, company-based effectiveUntil = periodEnd, verify 2x idempotent (endDate tidak berubah), harga katalog PUT + overrideCount, negatif/desimal → 400, anon 401 |
| `npm test` | ✅ **762/762** (40 file) |
| Smoke regresi | ✅ Enforcement 21/21 · Invoice by Company 25/25 |
| Lint / Build | ✅ 0 error · console + inventory ✓ |
| Produksi live | ✅ health 200 · bundle `billing-BaYJ-QiS.js` (Harga Katalog UI) · settle chain 8/8 (subscription TRIAL→ACTIVE, entitlement sync plan starter) · invoice test di-void + subscription test di-cancel + entitlement di-restore ke grandfathering · anon 401 |
| Arsitektur | ✅ Console mandiri; RBAC M3 + audit aktif; mode SIMULATION (tanpa mutasi finansial nyata); tidak ada data test menggantung |

### FINDING / BACKLOG (M6-FIX v2)

1. `recordPayment` tidak memvalidasi `amount` terhadap `invoice.total` — under/overpayment tetap menandai invoice PAID. Backlog: strict amount check + warning.
2. Multiple payments untuk invoice yang sama diperbolehkan (tidak diblokir) — backlog: guard satu payment per invoice (atau partial payment model).
3. Perubahan harga katalog tidak mengubah invoice/entitlement lama (by design, M6 §21) — hanya berlaku invoice berikutnya.

## 26. GO / NO-GO

| STATUS | Kesimpulan |
|---|---|
| ✅ **GO** | M6 — SMART Billing & Subscription Center **COMPLETE** + **M6-FIX v1** (Invoice by Company + Harga per Fitur per Perusahaan) + **M6-FIX v2** (Payment Settle Chain + Harga Katalog Feature) — commercial domain + lifecycle + entitlement + usage + invoice + payment + settle automation + security M3 + RBAC + audit + UI + tests + production verification, **tanpa merusak M0–M5 dan tanpa mutasi finansial nyata**. |
