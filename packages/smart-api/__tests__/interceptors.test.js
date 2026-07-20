import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    initAuthInterceptor,
    authRequestInterceptor,
    authResponseInterceptor
} from "../src/interceptors/auth.js";
import {
    initContextInterceptor,
    contextRequestInterceptor
} from "../src/interceptors/context.js";


describe("Auth Interceptor", () => {

    beforeEach(() => {
        // Reset by initializing with null
        initAuthInterceptor(null);
    });


    describe("authRequestInterceptor()", () => {

        it("should add Bearer token when auth has token", () => {
            const mockAuth = {
                token: () => "smt_test123"
            };

            initAuthInterceptor(mockAuth);

            const config = {
                headers: {}
            };

            const result = authRequestInterceptor(config);

            expect(result.headers["Authorization"]).toBe(
                "Bearer smt_test123"
            );
        });

        it("should not add header when no token", () => {
            const mockAuth = {
                token: () => null
            };

            initAuthInterceptor(mockAuth);

            const config = { headers: {} };

            const result = authRequestInterceptor(config);

            expect(result.headers["Authorization"]).toBeUndefined();
        });

        it("should not add header when auth is not initialized", () => {
            const config = { headers: {} };

            const result = authRequestInterceptor(config);

            expect(result.headers["Authorization"]).toBeUndefined();
        });

        it("should return config unchanged", () => {
            const config = { headers: { "X-Custom": "val" } };

            const result = authRequestInterceptor(config);

            expect(result.headers["X-Custom"]).toBe("val");
        });

    });


    describe("authResponseInterceptor()", () => {

        it("should pass response through unchanged", () => {
            const data = { id: 1, name: "test" };

            const result = authResponseInterceptor(data);

            expect(result).toBe(data);
        });

    });

});


describe("Context Interceptor", () => {

    beforeEach(() => {
        initContextInterceptor({
            institution: null,
            appConfig: null,
            auth: null
        });
    });


    describe("contextRequestInterceptor()", () => {

        it("should always add X-Request-Id", () => {
            const config = { headers: {} };

            const result = contextRequestInterceptor(config);

            expect(result.headers["X-Request-Id"]).toMatch(/^req_/);
        });

        it("should add X-Institution-Id when available", () => {
            const mockInstitution = {
                current: () => ({ id: "PT-001" })
            };

            initContextInterceptor({
                institution: mockInstitution
            });

            const config = { headers: {} };

            const result = contextRequestInterceptor(config);

            expect(result.headers["X-Institution-Id"]).toBe("PT-001");
        });

        it("should add X-App-Code when available", () => {
            const mockAppConfig = {
                appCode: "INV"
            };

            initContextInterceptor({
                appConfig: mockAppConfig
            });

            const config = { headers: {} };

            const result = contextRequestInterceptor(config);

            expect(result.headers["X-App-Code"]).toBe("INV");
        });

        it("should add X-User-Role when auth has user", () => {
            const mockAuth = {
                user: () => ({ role: "owner" })
            };

            initContextInterceptor({
                auth: mockAuth
            });

            const config = { headers: {} };

            const result = contextRequestInterceptor(config);

            expect(result.headers["X-User-Role"]).toBe("owner");
        });

        it("should not add X-User-Role when no user", () => {
            const mockAuth = {
                user: () => null
            };

            initContextInterceptor({
                auth: mockAuth
            });

            const config = { headers: {} };

            const result = contextRequestInterceptor(config);

            expect(result.headers["X-User-Role"]).toBeUndefined();
        });

        it("should preserve existing headers", () => {
            const config = {
                headers: { "X-Custom": "value" }
            };

            const result = contextRequestInterceptor(config);

            expect(result.headers["X-Custom"]).toBe("value");
        });

    });

});
