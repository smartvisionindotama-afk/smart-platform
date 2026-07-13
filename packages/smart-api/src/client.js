import {
    NetworkError,
    createErrorFromStatus
} from "./error.js";


/**
 * HTTP Client — fetch wrapper with interceptor support.
 *
 * createClient(options) returns an object with:
 *   get, post, put, patch, delete  → async methods
 *   use(fn)                        → register request interceptor
 *   config                         → current client configuration
 */


/**
 * Create a new API client instance.
 *
 * @param {object} options
 * @param {string} options.baseURL  Base URL for all requests
 * @param {object} options.headers  Default headers
 * @param {number} options.timeout  Request timeout in ms (default: 15000)
 * @param {function[]} options.requestInterceptors
 * @param {function[]} options.responseInterceptors
 * @returns {object} Client instance
 */
export function createClient(options = {}) {

    const config = {

        baseURL: options.baseURL || "",

        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.headers || {})
        },

        timeout: options.timeout || 15000,

        requestInterceptors: [
            ...(options.requestInterceptors || [])
        ],

        responseInterceptors: [
            ...(options.responseInterceptors || [])
        ]

    };


    /**
     * Register a request interceptor.
     *
     * @param {function} fn Receives and must return RequestConfig
     */
    function use(fn) {

        config.requestInterceptors.push(fn);

    }



    // ── HTTP Methods ──


    async function get(path, reqOpts = {}) {
        return request("GET", path, null, reqOpts);
    }

    async function post(path, body = null, reqOpts = {}) {
        return request("POST", path, body, reqOpts);
    }

    async function put(path, body = null, reqOpts = {}) {
        return request("PUT", path, body, reqOpts);
    }

    async function patch(path, body = null, reqOpts = {}) {
        return request("PATCH", path, body, reqOpts);
    }

    async function del(path, reqOpts = {}) {
        return request("DELETE", path, null, reqOpts);
    }



    // ── Core Request ──


    async function request(method, path, body, reqOpts = {}) {

        // Build request config
        let reqConfig = {

            method,

            url: normalizeURL(config.baseURL, path),

            headers: {
                ...config.headers,
                ...(reqOpts.headers || {})
            },

            body:
                body !== null && body !== undefined
                    ? JSON.stringify(body)
                    : undefined,

            params: reqOpts.params || {},

            signal: reqOpts.signal || null

        };


        // Run request interceptors
        for (const interceptor of config.requestInterceptors) {

            reqConfig = await interceptor(reqConfig);

        }


        // Build fetch URL with query params
        const fetchURL = buildURL(reqConfig);


        // Build fetch options
        const fetchOptions = {

            method: reqConfig.method,

            headers: reqConfig.headers,

            body: reqConfig.body

        };


        // Timeout handling — only create AbortController if needed
        let timeoutId;

        if (config.timeout > 0) {

            if (reqConfig.signal) {

                // User provided signal — use it
                fetchOptions.signal = reqConfig.signal;

            } else {

                // Create our own timeout
                const controller = new AbortController();

                timeoutId = setTimeout(

                    () => controller.abort(),

                    config.timeout

                );

                fetchOptions.signal = controller.signal;

            }

        } else if (reqConfig.signal) {

            fetchOptions.signal = reqConfig.signal;

        }


        try {

            const response = await fetch(fetchURL, fetchOptions);

            clearTimeout(timeoutId);


            // Parse and handle response
            const result = await handleResponse(response);


            // Run response interceptors
            let output = result;

            for (const interceptor of config.responseInterceptors) {

                output = await interceptor(output);

            }

            return output;

        } catch (error) {

            clearTimeout(timeoutId);

            throw transformFetchError(error);

        }

    }


    return {
        get,
        post,
        put,
        patch,
        delete: del,
        use,
        config
    };

}



// ── Internal Helpers ──


function normalizeURL(base, path) {

    if (!base) return path;

    const baseClean = base.replace(/\/+$/, "");

    const pathClean = path.replace(/^\/+/, "");

    return `${baseClean}/${pathClean}`;

}


function buildURL(reqConfig) {

    const params = reqConfig.params;

    if (!params || Object.keys(params).length === 0) {

        return reqConfig.url;

    }


    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {

        if (value !== null && value !== undefined) {

            searchParams.append(key, String(value));

        }

    }


    const qs = searchParams.toString();

    return qs ? `${reqConfig.url}?${qs}` : reqConfig.url;

}


async function handleResponse(response) {

    let data = null;

    const contentType =
        response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {

        try {
            data = await response.json();
        } catch {
            // Ignore parse errors for empty bodies
        }

    } else {

        try {
            data = await response.text();
        } catch {
            // Ignore
        }

    }


    if (response.ok) {
        return data;
    }


    throw createErrorFromStatus(

        response.status,

        data?.message || data?.error || response.statusText,

        data

    );

}


function transformFetchError(error) {

    if (error.name === "AbortError") {

        return new NetworkError("Request timed out");

    }

    if (

        error instanceof TypeError &&

        error.message.includes("fetch")

    ) {

        return new NetworkError("Network request failed");

    }

    return error;

}
