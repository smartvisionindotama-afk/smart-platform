/**
 * Context Interceptor.
 *
 * Attaches tenant/institution, auth/role, and correlation context
 * to every outgoing request.
 *
 * Headers added:
 *   X-Institution-Id  — Current institution ID
 *   X-User-Role       — Current user's role (permission context)
 *   X-Request-Id      — Unique request correlation ID
 *   X-App-Code        — Application identity code
 */


let institutionModule = null;

let appConfigModule = null;

let authModule = null;

let requestIdCounter = 0;


/**
 * Initialize the context interceptor with required modules.
 *
 * @param {object} deps
 * @param {object} deps.institution  @smart/core Institution instance
 * @param {object} deps.appConfig    @smart/core AppConfig instance
 * @param {object} deps.auth         @smart/core Auth instance (for role context)
 */
export function initContextInterceptor({
    institution,
    appConfig,
    auth
} = {}) {

    institutionModule = institution || null;

    appConfigModule = appConfig || null;

    authModule = auth || null;

}


function generateRequestId() {

    requestIdCounter++;

    const timestamp = Date.now().toString(36);

    const counter = requestIdCounter.toString(36);

    return `req_${timestamp}_${counter}`;

}


/**
 * Request interceptor — attach context headers.
 *
 * @param {object} reqConfig
 * @returns {object}
 */
export function contextRequestInterceptor(reqConfig) {

    // Institution ID
    try {

        if (institutionModule) {

            const current = institutionModule.current();

            if (current && current.id) {

                reqConfig.headers["X-Institution-Id"] = current.id;

            }

        }

    } catch {
        // Institution not available
    }


    // App Code
    try {

        if (appConfigModule) {

            const code = appConfigModule.appCode;

            if (code) {

                reqConfig.headers["X-App-Code"] = code;

            }

        }

    } catch {
        // AppConfig not available
    }


    // User role (permission context propagation)
    try {

        if (authModule) {

            const user = authModule.user();

            if (user && user.role) {

                reqConfig.headers["X-User-Role"] = user.role;

            }

        }

    } catch {
        // Auth not available
    }


    // Request ID (always added)
    reqConfig.headers["X-Request-Id"] = generateRequestId();


    return reqConfig;

}
