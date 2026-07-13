import { describe, it, expect } from "vitest";
import AppConfig from "../src/app/app.js";


describe("AppConfig (Enhanced)", () => {

    describe("Core Identity", () => {

        it("should have app name", () => {
            expect(AppConfig.name).toBe("Smart Inventory");
        });

        it("should have app code", () => {
            expect(AppConfig.appCode).toBe("INV");
        });

        it("should have version", () => {
            expect(AppConfig.version).toBe("1.0.0");
        });

        it("should have company name", () => {
            expect(AppConfig.company).toBe("PT Smart Vision Indotama");
        });

        it("should have environment", () => {
            expect(AppConfig.environment).toBe("development");
        });

        it("should have apiUrl", () => {
            expect(AppConfig.apiUrl).toContain("localhost");
        });

    });


    describe("isDevelopment()", () => {

        it("should return true in development environment", () => {
            expect(AppConfig.isDevelopment()).toBe(true);
        });

        it("should return false in non-development", () => {
            const orig = AppConfig.environment;
            AppConfig.environment = "production";
            expect(AppConfig.isDevelopment()).toBe(false);
            AppConfig.environment = orig;
        });

    });


    describe("isStaging()", () => {

        it("should return false in development", () => {
            expect(AppConfig.isStaging()).toBe(false);
        });

    });


    describe("isProduction()", () => {

        it("should return false in development", () => {
            expect(AppConfig.isProduction()).toBe(false);
        });

    });


    describe("Feature Flags", () => {

        it("should have feature flags object", () => {
            expect(AppConfig.features).toBeDefined();
            expect(AppConfig.features.reports).toBe(true);
        });

        it("should check if feature is enabled", () => {
            expect(AppConfig.isEnabled("reports")).toBe(true);
            expect(AppConfig.isEnabled("darkMode")).toBe(false);
            expect(AppConfig.isEnabled("nonexistent")).toBe(false);
        });

        it("should enable a feature", () => {
            AppConfig.setFeature("darkMode", true);
            expect(AppConfig.isEnabled("darkMode")).toBe(true);
        });

        it("should disable a feature", () => {
            AppConfig.setFeature("export", false);
            expect(AppConfig.isEnabled("export")).toBe(false);
            // Reset
            AppConfig.setFeature("export", true);
        });

    });


    describe("identity()", () => {

        it("should return full identity object", () => {
            const id = AppConfig.identity();
            expect(id.name).toBe("Smart Inventory");
            expect(id.appCode).toBe("INV");
            expect(id.version).toBe("1.0.0");
            expect(id.company).toBe("PT Smart Vision Indotama");
            expect(id.environment).toBe("development");
        });

    });

});
