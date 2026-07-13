/**
 * Standardized API Error classes.
 *
 * Hierarchy:
 *   ApiError (base)
 *   ├── NetworkError
 *   ├── AuthError
 *   ├── ForbiddenError
 *   ├── NotFoundError
 *   ├── ValidationError
 *   └── ServerError
 */


/**
 * Base API Error.
 */
export class ApiError extends Error {

    /**
     * @param {string} message Human-readable error message
     * @param {number} status   HTTP status code
     * @param {string} code     Machine-readable error code
     * @param {*}      data     Response body payload
     */
    constructor(
        message = "API Error",
        status = 0,
        code = "API_ERROR",
        data = null
    ) {

        super(message);

        this.name = "ApiError";

        this.status = status;

        this.code = code;

        this.data = data;

        this.timestamp = new Date().toISOString();

    }

}


/**
 * Network error — no connection, timeout, DNS failure.
 */
export class NetworkError extends ApiError {

    constructor(
        message = "Network error",
        data = null
    ) {

        super(message, 0, "NETWORK_ERROR", data);

        this.name = "NetworkError";

    }

}


/**
 * Authentication error — 401 Unauthorized.
 */
export class AuthError extends ApiError {

    constructor(
        message = "Authentication required",
        data = null
    ) {

        super(message, 401, "AUTH_ERROR", data);

        this.name = "AuthError";

    }

}


/**
 * Authorization error — 403 Forbidden.
 */
export class ForbiddenError extends ApiError {

    constructor(
        message = "Access denied",
        data = null
    ) {

        super(message, 403, "FORBIDDEN", data);

        this.name = "ForbiddenError";

    }

}


/**
 * Not found error — 404.
 */
export class NotFoundError extends ApiError {

    constructor(
        message = "Resource not found",
        data = null
    ) {

        super(message, 404, "NOT_FOUND", data);

        this.name = "NotFoundError";

    }

}


/**
 * Validation error — 422 Unprocessable Entity.
 */
export class ValidationError extends ApiError {

    constructor(
        message = "Validation failed",
        data = null
    ) {

        super(message, 422, "VALIDATION_ERROR", data);

        this.name = "ValidationError";

    }


    /**
     * Get validation field errors.
     *
     * @returns {object|null} e.g. { name: ["is required"], email: ["is invalid"] }
     */
    get fieldErrors() {

        return this.data?.errors || null;

    }

}


/**
 * Server error — 500+ Internal Server Error.
 */
export class ServerError extends ApiError {

    constructor(
        message = "Internal server error",
        status = 500,
        data = null
    ) {

        super(message, status, "SERVER_ERROR", data);

        this.name = "ServerError";

    }

}


/**
 * Map an HTTP status code to the appropriate error class.
 *
 * @param {number} status
 * @param {string} message
 * @param {*} data
 * @returns {ApiError}
 */
export function createErrorFromStatus(status, message, data) {

    if (status === 0 || status == null) {

        return new NetworkError(message, data);

    }


    if (status === 401) {

        return new AuthError(message, data);

    }


    if (status === 403) {

        return new ForbiddenError(message, data);

    }


    if (status === 404) {

        return new NotFoundError(message, data);

    }


    if (status === 422) {

        return new ValidationError(message, data);

    }


    if (status >= 500) {

        return new ServerError(message, status, data);

    }


    return new ApiError(

        message,

        status,

        "HTTP_ERROR",

        data

    );

}
