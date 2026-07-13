import { describe, it, expect } from "vitest";
import { createDataState } from "../src/state.js";


describe("DataState", () => {

    describe("initial state", () => {

        it("should have initial default state", () => {
            const state = createDataState();
            const s = state.getState();
            expect(s.data).toBeNull();
            expect(s.loading).toBe(false);
            expect(s.error).toBeNull();
            expect(s.pagination).toBeNull();
            expect(s.timestamp).toBeNull();
        });

    });


    describe("startLoading()", () => {

        it("should set loading to true", () => {
            const state = createDataState();
            state.startLoading();
            const s = state.getState();
            expect(s.loading).toBe(true);
            expect(s.data).toBeNull();
            expect(s.error).toBeNull();
        });

        it("should preserve data when preserveData is true", () => {
            const state = createDataState();
            state.setData([1, 2, 3]);
            state.startLoading(true);
            const s = state.getState();
            expect(s.loading).toBe(true);
            expect(s.data).toEqual([1, 2, 3]);
        });

    });


    describe("setData()", () => {

        it("should set data and clear loading/error", () => {
            const state = createDataState();
            state.startLoading();
            state.setData({ id: 1, name: "Test" });
            const s = state.getState();
            expect(s.data).toEqual({ id: 1, name: "Test" });
            expect(s.loading).toBe(false);
            expect(s.error).toBeNull();
            expect(s.timestamp).not.toBeNull();
        });

        it("should set pagination meta", () => {
            const state = createDataState();
            const pagination = { page: 1, limit: 10, total: 50 };
            state.setData([], pagination);
            const s = state.getState();
            expect(s.pagination).toEqual(pagination);
        });

        it("should return a copy of pagination", () => {
            const state = createDataState();
            const pagination = { page: 1, limit: 10, total: 50 };
            state.setData([], pagination);
            pagination.page = 2;
            const s = state.getState();
            expect(s.pagination.page).toBe(1);
        });

    });


    describe("setError()", () => {

        it("should set error and clear loading", () => {
            const state = createDataState();
            state.startLoading();
            const error = new Error("Failed");
            state.setError(error);
            const s = state.getState();
            expect(s.error).toBe(error);
            expect(s.loading).toBe(false);
            expect(s.data).toBeNull();
        });

        it("should preserve data when preserveData is true", () => {
            const state = createDataState();
            state.setData([1, 2, 3]);
            state.startLoading(true);
            const error = new Error("Failed");
            state.setError(error, true);
            const s = state.getState();
            expect(s.error).toBe(error);
            expect(s.data).toEqual([1, 2, 3]);
        });

    });


    describe("reset()", () => {

        it("should reset to initial state", () => {
            const state = createDataState();
            state.setData([1, 2, 3]);
            state.setError(new Error("fail"));
            state.reset();
            const s = state.getState();
            expect(s.data).toBeNull();
            expect(s.loading).toBe(false);
            expect(s.error).toBeNull();
        });

    });


    describe("onChange()", () => {

        it("should notify on startLoading", () => {
            const state = createDataState();
            let notified = false;
            state.onChange(() => { notified = true; });
            state.startLoading();
            expect(notified).toBe(true);
        });

        it("should notify on setData", () => {
            const state = createDataState();
            let notified = false;
            state.onChange(() => { notified = true; });
            state.setData("ok");
            expect(notified).toBe(true);
        });

        it("should notify on setError", () => {
            const state = createDataState();
            let notified = false;
            state.onChange(() => { notified = true; });
            state.setError(new Error("fail"));
            expect(notified).toBe(true);
        });

        it("should pass state snapshot to subscriber", () => {
            const state = createDataState();
            let snapshot = null;
            state.onChange((s) => { snapshot = s; });
            state.setData("hello");
            expect(snapshot.data).toBe("hello");
        });

        it("should return unsubscribe function", () => {
            const state = createDataState();
            let count = 0;
            const unsub = state.onChange(() => { count++; });
            state.setData("a");
            expect(count).toBe(1);
            unsub();
            state.setData("b");
            expect(count).toBe(1);
        });

    });

});
