# TASK T-019 — Redirect UI Imports ke @smart/ui
## Resume Hasil

**Sprint:** Sprint 3 — SMART UI Extraction
**Status:** ✅ Selesai

## File Diubah
- `apps/inventory/src/core/app/bootstrap.js`

## Perubahan
```js
// SEBELUM
import { loadUI } from "../../ui/index.js";
// SESUDAH
import { loadUI } from "@smart/ui";
```

`loadWorkspace` tetap import lokal (belum dipindahkan ke @smart/ui).
