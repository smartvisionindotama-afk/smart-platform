/**
 * @smart/api — API SDK.
 *
 * ████████████████████████████████████████████████████████████
 * PUBLIC SDK — FACADE ARCHITECTURE
 * ████████████████████████████████████████████████████████████
 *
 * ✅ BENAR:
 *   import { API } from "@smart/api";
 *   API.get("/api/barang")
 *   API.post("/api/users", { name: "John" })
 *
 * ⚠️ @deprecated (masih berfungsi, tapi akan dihapus):
 *   import { createClient, apiFetch, normalizeItem } from "@smart/api";
 *
 * @module @smart/api
 */

// ═══════════════════════════════════════════════════════════════
//  PRIMARY API: API Facade
// ═══════════════════════════════════════════════════════════════

export { API } from "./api-facade.js";

// ═══════════════════════════════════════════════════════════════
//  @deprecated — Backward Compatible Exports
//  Aplikasi baru HARUS menggunakan API.* atau SMART.API.*
// ═══════════════════════════════════════════════════════════════

/** @deprecated Gunakan SMART.Session.get("company.code") */
export { apiGetCompanyCode, apiHeaders } from "./api-facade.js";

/** @deprecated Gunakan API */
export { createClient } from "./client.js";

/** @deprecated Gunakan API.error handling */
export {
    ApiError,
    NetworkError,
    AuthError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    ServerError,
    createErrorFromStatus
} from "./error.js";

/** @deprecated Gunakan API */
export {
    initAuthInterceptor,
    authRequestInterceptor,
    authResponseInterceptor,
    initContextInterceptor,
    contextRequestInterceptor
} from "./interceptors/index.js";

/** @deprecated Gunakan API */
export { BaseResource } from "./resources/base.js";

/** @deprecated Gunakan API */
export {
    buildQuery,
    normalizeItem,
    normalizeList,
    apiFetch,
    withFallback,
    apiListFallback,
    apiCreateFallback,
    apiUpdateFallback,
    apiDeleteFallback,
    apiGetFallback
} from "./fallback.js";

// ═══════════════════════════════════════════════════════════════
//  SP-027 M3 — Auth Token Store (JWT client-side)
// ═══════════════════════════════════════════════════════════════

export {
    configureAuthTokens,
    getAccessToken,
    getRefreshToken,
    setAuthTokens,
    clearAuthTokens,
    refreshAccessToken,
    authorizedFetch
} from "./token-store.js";
