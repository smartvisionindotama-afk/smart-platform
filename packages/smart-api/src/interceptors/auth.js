/**
 * Authentication Interceptor.
 *
 * Request interceptor: Attaches Authorization header from Auth module.
 * Response interceptor: Handles 401 by clearing auth session.
 *
 * This interceptor depends on @smart/core Auth module.
 * If Auth is not available, it silently skips token injection.
 */


let authModule = null;


/**
 * Initialize the auth interceptor with the Auth module.
 *
 * @param {object} auth The @smart/core Auth instance
 */
export function initAuthInterceptor(auth) {

    authModule = auth;

}


/**
 * Request interceptor — attach Bearer token if available.
 *
 * @param {object} reqConfig
 * @returns {object}
 */
export function authRequestInterceptor(reqConfig) {

    if (!authModule) return reqConfig;


    try {

        const token = authModule.token();

        if (token) {

            reqConfig.headers["Authorization"] =

                `Bearer ${token}`;

        }

    } catch {

        // Auth module not available or not initialized

    }


    return reqConfig;

}


/**
 * Response interceptor — handle 401 unauthorized.
 *
 * @param {*} response
 * @returns {*} Response if successful
 */
export function authResponseInterceptor(response) {

    // This is a no-op for successful responses.
    // Error handling is done in client.js via handleResponse().
    return response;

}
