import { describe, it, expect } from "vitest";
import {
    ApiError,
    NetworkError,
    AuthError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    ServerError,
    createErrorFromStatus
} from "../src/error.js";


describe("ApiError", () => {

    it("should create error with defaults", () => {
        const err = new ApiError();
        expect(err.name).toBe("ApiError");
        expect(err.message).toBe("API Error");
        expect(err.status).toBe(0);
        expect(err.code).toBe("API_ERROR");
        expect(err.data).toBeNull();
        expect(err.timestamp).toBeDefined();
    });

    it("should create error with custom values", () => {
        const err = new ApiError("Not found", 404, "NOT_FOUND", { id: 1 });
        expect(err.message).toBe("Not found");
        expect(err.status).toBe(404);
        expect(err.code).toBe("NOT_FOUND");
        expect(err.data.id).toBe(1);
    });

    it("should be instanceof Error", () => {
        const err = new ApiError("test");
        expect(err instanceof Error).toBe(true);
    });

});


describe("NetworkError", () => {

    it("should have correct properties", () => {
        const err = new NetworkError("Timeout");
        expect(err.name).toBe("NetworkError");
        expect(err.status).toBe(0);
        expect(err.code).toBe("NETWORK_ERROR");
        expect(err.message).toBe("Timeout");
    });

    it("should be instanceof ApiError", () => {
        expect(new NetworkError() instanceof ApiError).toBe(true);
    });

});


describe("AuthError", () => {

    it("should have 401 status", () => {
        const err = new AuthError();
        expect(err.status).toBe(401);
        expect(err.code).toBe("AUTH_ERROR");
    });

});


describe("ForbiddenError", () => {

    it("should have 403 status", () => {
        const err = new ForbiddenError();
        expect(err.status).toBe(403);
        expect(err.code).toBe("FORBIDDEN");
    });

});


describe("NotFoundError", () => {

    it("should have 404 status", () => {
        const err = new NotFoundError();
        expect(err.status).toBe(404);
        expect(err.code).toBe("NOT_FOUND");
    });

});


describe("ValidationError", () => {

    it("should have 422 status", () => {
        const err = new ValidationError("Invalid input", {
            errors: { name: ["is required"] }
        });
        expect(err.status).toBe(422);
        expect(err.code).toBe("VALIDATION_ERROR");
    });

    it("should expose fieldErrors", () => {
        const err = new ValidationError("Invalid", {
            errors: { email: ["is invalid"] }
        });
        expect(err.fieldErrors).toEqual({ email: ["is invalid"] });
    });

    it("should return null fieldErrors when no data", () => {
        const err = new ValidationError("Invalid");
        expect(err.fieldErrors).toBeNull();
    });

});


describe("ServerError", () => {

    it("should have 500+ status", () => {
        const err = new ServerError("Internal error", 502);
        expect(err.status).toBe(502);
        expect(err.code).toBe("SERVER_ERROR");
    });

    it("should default to 500", () => {
        const err = new ServerError();
        expect(err.status).toBe(500);
    });

});


describe("createErrorFromStatus()", () => {

    it("should create NetworkError for status 0", () => {
        const err = createErrorFromStatus(0, "No connection");
        expect(err instanceof NetworkError).toBe(true);
    });

    it("should create NetworkError for null status", () => {
        const err = createErrorFromStatus(null, "No response");
        expect(err instanceof NetworkError).toBe(true);
    });

    it("should create AuthError for 401", () => {
        const err = createErrorFromStatus(401, "Unauthorized");
        expect(err instanceof AuthError).toBe(true);
    });

    it("should create ForbiddenError for 403", () => {
        const err = createErrorFromStatus(403, "Forbidden");
        expect(err instanceof ForbiddenError).toBe(true);
    });

    it("should create NotFoundError for 404", () => {
        const err = createErrorFromStatus(404, "Not found");
        expect(err instanceof NotFoundError).toBe(true);
    });

    it("should create ValidationError for 422", () => {
        const err = createErrorFromStatus(422, "Validation failed", {
            errors: { field: ["error"] }
        });
        expect(err instanceof ValidationError).toBe(true);
        expect(err.data.errors.field[0]).toBe("error");
    });

    it("should create ServerError for 500", () => {
        const err = createErrorFromStatus(500, "Internal error");
        expect(err instanceof ServerError).toBe(true);
    });

    it("should create ServerError for 502", () => {
        const err = createErrorFromStatus(502, "Bad gateway");
        expect(err instanceof ServerError).toBe(true);
    });

    it("should create base ApiError for unknown status", () => {
        const err = createErrorFromStatus(418, "Teapot");
        expect(err instanceof ApiError).toBe(true);
        expect(err instanceof NetworkError).toBe(false);
        expect(err.status).toBe(418);
        expect(err.code).toBe("HTTP_ERROR");
    });

});
