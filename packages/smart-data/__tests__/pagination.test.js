import { describe, it, expect } from "vitest";
import { createPagination } from "../src/pagination.js";


describe("Pagination", () => {

    describe("initial state", () => {

        it("should default to page 1, limit 10, total 0", () => {
            const p = createPagination();
            const meta = p.getMeta();
            expect(meta.page).toBe(1);
            expect(meta.limit).toBe(10);
            expect(meta.total).toBe(0);
            expect(meta.totalPages).toBe(1);
            expect(meta.hasNext).toBe(false);
            expect(meta.hasPrev).toBe(false);
        });

        it("should accept custom options", () => {
            const p = createPagination({ page: 3, limit: 20, total: 100 });
            const meta = p.getMeta();
            expect(meta.page).toBe(3);
            expect(meta.limit).toBe(20);
            expect(meta.total).toBe(100);
            expect(meta.totalPages).toBe(5);
        });

    });


    describe("getMeta()", () => {

        it("should calculate totalPages", () => {
            const p = createPagination({ total: 50, limit: 10 });
            expect(p.getMeta().totalPages).toBe(5);
        });

        it("should calculate hasNext", () => {
            const p = createPagination({ page: 1, total: 50, limit: 10 });
            expect(p.getMeta().hasNext).toBe(true);
            const p2 = createPagination({ page: 5, total: 50, limit: 10 });
            expect(p2.getMeta().hasNext).toBe(false);
        });

        it("should calculate hasPrev", () => {
            const p = createPagination({ page: 1, total: 50 });
            expect(p.getMeta().hasPrev).toBe(false);
            const p2 = createPagination({ page: 3, total: 50 });
            expect(p2.getMeta().hasPrev).toBe(true);
        });

    });


    describe("goTo()", () => {

        it("should go to a specific page", () => {
            const p = createPagination({ total: 100 });
            p.goTo(3);
            expect(p.getMeta().page).toBe(3);
        });

        it("should not go below page 1", () => {
            const p = createPagination({ total: 100 });
            p.goTo(0);
            expect(p.getMeta().page).toBe(1);
        });

        it("should not go beyond totalPages", () => {
            const p = createPagination({ total: 30, limit: 10 });
            p.goTo(100);
            expect(p.getMeta().page).toBe(3);
        });

    });


    describe("next()", () => {

        it("should go to next page", () => {
            const p = createPagination({ page: 1, total: 50 });
            p.next();
            expect(p.getMeta().page).toBe(2);
        });

        it("should not go beyond last page", () => {
            const p = createPagination({ page: 5, total: 50, limit: 10 });
            p.next();
            expect(p.getMeta().page).toBe(5);
        });

    });


    describe("prev()", () => {

        it("should go to previous page", () => {
            const p = createPagination({ page: 3, total: 50 });
            p.prev();
            expect(p.getMeta().page).toBe(2);
        });

        it("should not go below page 1", () => {
            const p = createPagination({ page: 1, total: 50 });
            p.prev();
            expect(p.getMeta().page).toBe(1);
        });

    });


    describe("updateMeta()", () => {

        it("should update total count", () => {
            const p = createPagination({ page: 1, total: 10, limit: 10 });
            p.updateMeta({ total: 100 });
            expect(p.getMeta().total).toBe(100);
            expect(p.getMeta().totalPages).toBe(10);
        });

        it("should update limit", () => {
            const p = createPagination({ total: 100, limit: 10 });
            p.updateMeta({ limit: 20 });
            expect(p.getMeta().limit).toBe(20);
            expect(p.getMeta().totalPages).toBe(5);
        });

    });


    describe("reset()", () => {

        it("should reset to page 1 with total 0", () => {
            const p = createPagination({ page: 5, total: 100 });
            p.reset();
            const meta = p.getMeta();
            expect(meta.page).toBe(1);
            expect(meta.total).toBe(0);
            expect(meta.totalPages).toBe(1);
        });

    });


    describe("onChange()", () => {

        it("should notify on page change", () => {
            const p = createPagination({ total: 100 });
            let meta = null;
            p.onChange((m) => { meta = m; });
            p.goTo(3);
            expect(meta).not.toBeNull();
            expect(meta.page).toBe(3);
        });

        it("should notify on next", () => {
            const p = createPagination({ page: 1, total: 100 });
            let changed = false;
            p.onChange(() => { changed = true; });
            p.next();
            expect(changed).toBe(true);
        });

        it("should notify on updateMeta", () => {
            const p = createPagination({ total: 10 });
            let changed = false;
            p.onChange(() => { changed = true; });
            p.updateMeta({ total: 50 });
            expect(changed).toBe(true);
        });

        it("should return unsubscribe function", () => {
            const p = createPagination({ total: 100 });
            let count = 0;
            const unsub = p.onChange(() => { count++; });
            p.next();
            expect(count).toBe(1);
            unsub();
            p.next();
            expect(count).toBe(1);
        });

        it("should not notify if page doesn't change", () => {
            const p = createPagination({ page: 1, total: 10, limit: 10 });
            let count = 0;
            p.onChange(() => { count++; });
            p.prev(); // can't go below 1
            expect(count).toBe(0);
        });

    });

});
