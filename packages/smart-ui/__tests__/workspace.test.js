import { describe, it, expect } from "vitest";
import { validateWorkspaceConfig } from "../src/workspaces/schema.js";


describe("validateWorkspaceConfig", () => {

    it("should return true for a valid config with name and label", () => {
        const config = {
            name: "default",
            label: "Default"
        };
        expect(validateWorkspaceConfig(config)).toBe(true);
    });


    it("should return false when name is missing", () => {
        const config = {
            label: "Test"
        };
        expect(validateWorkspaceConfig(config)).toBe(false);
    });


    it("should return false when label is missing", () => {
        const config = {
            name: "test"
        };
        expect(validateWorkspaceConfig(config)).toBe(false);
    });


    it("should return false when both name and label are missing", () => {
        const config = {};
        expect(validateWorkspaceConfig(config)).toBe(false);
    });


    it("should return true for full workspace config", () => {
        const config = {
            name: "warehouse",
            label: "Gudang",
            appTitle: "Warehouse",
            topbarTitle: "SMART Warehouse",
            variables: "warehouse/variables.css",
            layout: {
                sidebarPosition: "left",
                topbarFixed: true
            },
            branding: {
                primaryColor: "--orange-600",
                logo: null
            }
        };
        expect(validateWorkspaceConfig(config)).toBe(true);
    });

});
