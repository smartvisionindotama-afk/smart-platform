import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../src/client.js";


// Mock fetch globally
const mockFetch = vi.fn();

global.fetch = mockFetch;


function createMockResponse(data, options = {}) {

    const status = options.status || 200;

    const statusText = options.statusText || "OK";

    const headers = options.headers || {

        "content-type": "application/json"

    };


    return {

        ok: status >= 200 && status < 300,

        status,

        statusText,

        headers: {

            get: (name) => headers[name] || null

        },

        json: () => Promise.resolve(data),

        text: () => Promise.resolve(

            typeof data === "string" ? data : JSON.stringify(data)

        )

    };

}


describe("createClient()", () => {

    beforeEach(() => {
        mockFetch.mockReset();
    });


    describe("client creation", () => {

        it("should create a client object with HTTP methods", () => {
            const client = createClient({ baseURL: "http://test.com/api" });
            expect(client).toHaveProperty("get");
            expect(client).toHaveProperty("post");
            expect(client).toHaveProperty("put");
            expect(client).toHaveProperty("patch");
            expect(client).toHaveProperty("delete");
            expect(client).toHaveProperty("use");
            expect(client).toHaveProperty("config");
        });

        it("should set default headers", () => {
            const client = createClient({
                baseURL: "http://test.com/api",
                headers: { "X-Custom": "test" }
            });
            expect(client.config.headers["Content-Type"]).toBe("application/json");
            expect(client.config.headers["X-Custom"]).toBe("test");
        });

        it("should set default timeout", () => {
            const client = createClient({ baseURL: "http://test.com/api" });
            expect(client.config.timeout).toBe(15000);
        });

    });


    describe("GET requests", () => {

        it("should make a GET request", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({ data: "ok" })
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            const result = await client.get("/users");

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch.mock.calls[0][0]).toBe(
                "http://test.com/api/users"
            );
            expect(result.data).toBe("ok");
        });

        it("should append query parameters", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse([])
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            await client.get("/users", {
                params: { page: 1, limit: 10 }
            });

            const url = mockFetch.mock.calls[0][0];
            expect(url).toContain("page=1");
            expect(url).toContain("limit=10");
        });

    });


    describe("POST requests", () => {

        it("should make a POST request with JSON body", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({ id: 1 })
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            const result = await client.post("/users", {
                name: "Test"
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const options = mockFetch.mock.calls[0][1];
            expect(options.method).toBe("POST");
            expect(options.headers["Content-Type"]).toBe(
                "application/json"
            );
            expect(result.id).toBe(1);
        });

    });


    describe("error handling", () => {

        it("should throw AuthError on 401", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse(
                    { message: "Unauthorized" },
                    { status: 401 }
                )
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            await expect(
                client.get("/users")
            ).rejects.toThrow("Unauthorized");
        });

        it("should throw NotFoundError on 404", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse(
                    { message: "Not found" },
                    { status: 404 }
                )
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            await expect(
                client.get("/users/999")
            ).rejects.toThrow("Not found");
        });

        it("should throw ServerError on 500", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse(
                    { error: "Server error" },
                    { status: 500 }
                )
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            await expect(
                client.get("/error")
            ).rejects.toThrow("Server error");
        });

    });


    describe("request interceptors", () => {

        it("should run request interceptors before fetch", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({ ok: true })
            );

            let intercepted = false;

            const client = createClient({
                baseURL: "http://test.com/api",
                requestInterceptors: [
                    (config) => {
                        intercepted = true;
                        config.headers["X-Test"] = "yes";
                        return config;
                    }
                ]
            });

            await client.get("/test");

            expect(intercepted).toBe(true);
            const options = mockFetch.mock.calls[0][1];
            expect(options.headers["X-Test"]).toBe("yes");
        });

    });


    describe("response interceptors", () => {

        it("should run response interceptors after fetch", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({ value: 42 })
            );

            let intercepted = false;

            const client = createClient({
                baseURL: "http://test.com/api",
                responseInterceptors: [
                    (data) => {
                        intercepted = true;
                        return data;
                    }
                ]
            });

            const result = await client.get("/test");

            expect(intercepted).toBe(true);
            expect(result.value).toBe(42);
        });

    });


    describe("use()", () => {

        it("should register interceptor via use()", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({ ok: true })
            );

            const client = createClient({
                baseURL: "http://test.com/api"
            });

            let intercepted = false;

            client.use((config) => {
                intercepted = true;
                return config;
            });

            await client.get("/test");

            expect(intercepted).toBe(true);
        });

    });


    describe("URL normalization", () => {

        it("should handle baseURL without trailing slash", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({})
            );

            const client = createClient({
                baseURL: "http://test.com"
            });

            await client.get("/users");

            expect(mockFetch.mock.calls[0][0]).toBe(
                "http://test.com/users"
            );
        });

        it("should handle baseURL with trailing slash", async () => {
            mockFetch.mockResolvedValue(
                createMockResponse({})
            );

            const client = createClient({
                baseURL: "http://test.com/"
            });

            await client.get("/users");

            expect(mockFetch.mock.calls[0][0]).toBe(
                "http://test.com/users"
            );
        });

    });

});
