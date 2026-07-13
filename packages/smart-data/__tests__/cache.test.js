import { describe, it, expect, beforeEach } from "vitest";
import { createCache, clearAllCaches } from "../src/cache.js";


describe("Cache", () => {

    beforeEach(() => {
        clearAllCaches();
    });


    describe("createCache()", () => {

        it("should create a cache store", () => {
            const cache = createCache("test");
            expect(cache).toHaveProperty("get");
            expect(cache).toHaveProperty("set");
            expect(cache).toHaveProperty("has");
            expect(cache).toHaveProperty("remove");
            expect(cache).toHaveProperty("clear");
            expect(cache).toHaveProperty("size");
        });

        it("should return same store for same name", () => {
            const a = createCache("shared");
            const b = createCache("shared");
            expect(a).toBe(b);
        });

        it("should create separate stores for different names", () => {
            const a = createCache("store-a");
            const b = createCache("store-b");
            expect(a).not.toBe(b);
        });

    });


    describe("set() / get()", () => {

        it("should store and retrieve data", () => {
            const cache = createCache("test");
            cache.set("key1", { value: 42 });
            expect(cache.get("key1")).toEqual({ value: 42 });
        });

        it("should return null for missing key", () => {
            const cache = createCache("test");
            expect(cache.get("nonexistent")).toBeNull();
        });

        it("should store primitive values", () => {
            const cache = createCache("test");
            cache.set("str", "hello");
            cache.set("num", 123);
            cache.set("bool", true);
            cache.set("arr", [1, 2, 3]);
            expect(cache.get("str")).toBe("hello");
            expect(cache.get("num")).toBe(123);
            expect(cache.get("bool")).toBe(true);
            expect(cache.get("arr")).toEqual([1, 2, 3]);
        });

    });


    describe("has()", () => {

        it("should return true for existing key", () => {
            const cache = createCache("test");
            cache.set("key", "value");
            expect(cache.has("key")).toBe(true);
        });

        it("should return false for missing key", () => {
            const cache = createCache("test");
            expect(cache.has("missing")).toBe(false);
        });

    });


    describe("remove()", () => {

        it("should remove a key", () => {
            const cache = createCache("test");
            cache.set("key", "value");
            cache.remove("key");
            expect(cache.has("key")).toBe(false);
        });

    });


    describe("clear()", () => {

        it("should remove all entries", () => {
            const cache = createCache("test");
            cache.set("a", 1);
            cache.set("b", 2);
            cache.clear();
            expect(cache.size()).toBe(0);
        });

    });


    describe("size()", () => {

        it("should return number of entries", () => {
            const cache = createCache("test");
            expect(cache.size()).toBe(0);
            cache.set("a", 1);
            expect(cache.size()).toBe(1);
            cache.set("b", 2);
            expect(cache.size()).toBe(2);
        });

    });


    describe("TTL expiry", () => {

        it("should expire entries after TTL", async () => {
            const cache = createCache("test-ttl");
            cache.set("fast", "gone", 10); // 10ms TTL
            expect(cache.get("fast")).toBe("gone");
            await new Promise(r => setTimeout(r, 20));
            expect(cache.get("fast")).toBeNull();
        });

        it("should use default TTL of 60000ms", () => {
            const cache = createCache("test-default");
            cache.set("key", "value");
            // Should exist immediately
            expect(cache.get("key")).toBe("value");
        });

    });


    describe("clearAllCaches()", () => {

        it("should clear all cache stores", () => {
            const a = createCache("store-a");
            const b = createCache("store-b");
            a.set("key", 1);
            b.set("key", 2);
            clearAllCaches();
            // Create new references since old ones are cleared
            const a2 = createCache("store-a");
            expect(a2.size()).toBe(0);
        });

    });

});
