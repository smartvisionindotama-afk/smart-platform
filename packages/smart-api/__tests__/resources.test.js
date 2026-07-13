import { describe, it, expect, vi } from "vitest";
import { BaseResource } from "../src/resources/base.js";


describe("BaseResource", () => {

    function createMockClient() {

        return {

            get: vi.fn(() => Promise.resolve({})),

            post: vi.fn(() => Promise.resolve({})),

            put: vi.fn(() => Promise.resolve({})),

            patch: vi.fn(() => Promise.resolve({})),

            delete: vi.fn(() => Promise.resolve({}))

        };

    }


    it("should create instance with client and endpoint", () => {
        const client = createMockClient();
        const resource = new BaseResource(client, "/items");
        expect(resource.client).toBe(client);
        expect(resource.endpoint).toBe("/items");
    });


    describe("list()", () => {

        it("should call client.get with endpoint", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            await resource.list();
            expect(client.get).toHaveBeenCalledWith("/items", { params: {} });
        });

        it("should pass query params", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            await resource.list({ page: 1, limit: 10 });
            expect(client.get).toHaveBeenCalledWith(
                "/items",
                { params: { page: 1, limit: 10 } }
            );
        });

    });


    describe("get()", () => {

        it("should call client.get with endpoint + id", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            await resource.get(42);
            expect(client.get).toHaveBeenCalledWith("/items/42");
        });

    });


    describe("create()", () => {

        it("should call client.post with data", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            const data = { name: "New Item" };
            await resource.create(data);
            expect(client.post).toHaveBeenCalledWith("/items", data);
        });

    });


    describe("update()", () => {

        it("should call client.put with id and data", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            const data = { name: "Updated" };
            await resource.update(1, data);
            expect(client.put).toHaveBeenCalledWith("/items/1", data);
        });

    });


    describe("patch()", () => {

        it("should call client.patch with id and data", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            const data = { name: "Patched" };
            await resource.patch(1, data);
            expect(client.patch).toHaveBeenCalledWith("/items/1", data);
        });

    });


    describe("delete()", () => {

        it("should call client.delete with id", async () => {
            const client = createMockClient();
            const resource = new BaseResource(client, "/items");
            await resource.delete(1);
            expect(client.delete).toHaveBeenCalledWith("/items/1");
        });

    });

});
