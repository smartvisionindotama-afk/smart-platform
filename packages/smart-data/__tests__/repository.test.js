import { describe, it, expect, vi, beforeEach } from "vitest";
import { Repository } from "../src/repository.js";
import { createCache } from "../src/cache.js";
import { createPagination } from "../src/pagination.js";


function createMockResource() {

    return {

        endpoint: "/items",

        list: vi.fn(() =>
            Promise.resolve([{ id: 1, name: "Item 1" }])
        ),

        get: vi.fn((id) =>
            Promise.resolve({ id, name: `Item ${id}` })
        ),

        create: vi.fn((data) =>
            Promise.resolve({ id: 3, ...data })
        ),

        update: vi.fn((id, data) =>
            Promise.resolve({ id, ...data })
        ),

        delete: vi.fn(() =>
            Promise.resolve()
        )

    };

}


describe("Repository", () => {

    let resource;
    let repo;

    beforeEach(() => {
        resource = createMockResource();
        repo = new Repository(resource);
    });


    describe("constructor", () => {

        it("should create with resource", () => {
            expect(repo.resource).toBe(resource);
        });

        it("should create internal state", () => {
            expect(repo.state).toBeDefined();
            expect(repo.state.getState).toBeDefined();
        });

        it("should accept cache option", () => {
            const cache = createCache("test");
            const r = new Repository(resource, { cache });
            expect(r.cache).toBe(cache);
        });

        it("should accept pagination option", () => {
            const pagination = createPagination({ limit: 10 });
            const r = new Repository(resource, { pagination });
            expect(r.pagination).toBe(pagination);
        });

    });


    describe("fetchAll()", () => {

        it("should call resource.list", async () => {
            await repo.fetchAll();
            expect(resource.list).toHaveBeenCalledTimes(1);
        });

        it("should set data on success", async () => {
            const state = await repo.fetchAll();
            expect(state.data).toEqual([{ id: 1, name: "Item 1" }]);
            expect(state.loading).toBe(false);
            expect(state.error).toBeNull();
        });

        it("should set loading during fetch", async () => {
            // Create a promise that doesn't resolve immediately
            const slowResource = createMockResource();
            slowResource.list = vi.fn(
                () => new Promise(r => setTimeout(r, 50))
            );
            const slowRepo = new Repository(slowResource);
            const fetchPromise = slowRepo.fetchAll();
            const loadingState = slowRepo.state.getState();
            expect(loadingState.loading).toBe(true);
            await fetchPromise;
        });

        it("should set error on failure", async () => {
            resource.list = vi.fn(() =>
                Promise.reject(new Error("API Error"))
            );
            const state = await repo.fetchAll();
            expect(state.error).toBeDefined();
            expect(state.error.message).toBe("API Error");
            expect(state.loading).toBe(false);
        });

    });


    describe("fetchById()", () => {

        it("should call resource.get with id", async () => {
            await repo.fetchById(5);
            expect(resource.get).toHaveBeenCalledWith(5);
        });

        it("should set data on success", async () => {
            const state = await repo.fetchById(1);
            expect(state.data).toEqual({ id: 1, name: "Item 1" });
        });

        it("should set error on failure", async () => {
            resource.get = vi.fn(() =>
                Promise.reject(new Error("Not found"))
            );
            const state = await repo.fetchById(999);
            expect(state.error).toBeDefined();
            expect(state.loading).toBe(false);
        });

    });


    describe("create()", () => {

        it("should call resource.create with data", async () => {
            const data = { name: "New Item" };
            await repo.create(data);
            expect(resource.create).toHaveBeenCalledWith(data);
        });

        it("should set created data on success", async () => {
            const state = await repo.create({ name: "New" });
            expect(state.data).toEqual({ id: 3, name: "New" });
            expect(state.loading).toBe(false);
        });

    });


    describe("update()", () => {

        it("should call resource.update with id and data", async () => {
            const data = { name: "Updated" };
            await repo.update(1, data);
            expect(resource.update).toHaveBeenCalledWith(1, data);
        });

        it("should set updated data on success", async () => {
            const state = await repo.update(1, { name: "Updated" });
            expect(state.data).toEqual({ id: 1, name: "Updated" });
        });

    });


    describe("delete()", () => {

        it("should call resource.delete with id", async () => {
            await repo.delete(1);
            expect(resource.delete).toHaveBeenCalledWith(1);
        });

        it("should clear data on success", async () => {
            const state = await repo.delete(1);
            expect(state.data).toBeNull();
        });

    });


    describe("cache integration", () => {

        it("should cache fetchAll results", async () => {
            const cache = createCache("test-repo");
            const r = new Repository(resource, { cache });
            await r.fetchAll();
            expect(cache.has("/items")).toBe(true);
        });

        it("should return cached data without API call", async () => {
            const cache = createCache("test-cached");
            const r = new Repository(resource, { cache });
            await r.fetchAll();
            expect(resource.list).toHaveBeenCalledTimes(1);
            // Second call should use cache
            await r.fetchAll();
            expect(resource.list).toHaveBeenCalledTimes(1);
        });

        it("should invalidate get cache on update", async () => {
            const cache = createCache("test-inval");
            const r = new Repository(resource, { cache });
            // Cache a single item
            resource.get.mockResolvedValue({ id: 1, name: "Old" });
            await r.fetchById(1);
            expect(cache.has("/items/1")).toBe(true);
            // Update the item (should invalidate cache)
            await r.update(1, { name: "New" });
            expect(cache.has("/items/1")).toBe(false);
        });

    });


    describe("pagination integration", () => {

        it("should pass pagination params to fetchAll", async () => {
            const pagination = createPagination({ page: 2, limit: 10, total: 50 });
            const r = new Repository(resource, { pagination });
            await r.fetchAll();
            expect(resource.list).toHaveBeenCalledWith(
                expect.objectContaining({ page: 2, limit: 10 })
            );
        });

        it("should reset pagination on create", async () => {
            const pagination = createPagination({ page: 3, total: 100 });
            const r = new Repository(resource, { pagination });
            await r.create({ name: "New" });
            expect(pagination.getMeta().page).toBe(1);
        });

    });


    describe("reset()", () => {

        it("should reset state", () => {
            repo.state.setData([1, 2, 3]);
            repo.reset();
            const s = repo.state.getState();
            expect(s.data).toBeNull();
            expect(s.loading).toBe(false);
        });

        it("should reset pagination if present", () => {
            const pagination = createPagination({ page: 5, total: 100 });
            const r = new Repository(resource, { pagination });
            r.reset();
            expect(pagination.getMeta().page).toBe(1);
        });

    });

});
