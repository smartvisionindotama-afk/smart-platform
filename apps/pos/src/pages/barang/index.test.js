import { describe, expect, it } from "vitest";
import { UI } from "@smart/ui";

describe("BarcodeScanner.getConfig", () => {
    it("returns a scanner config", () => {
        const scanner = new UI.BarcodeScanner("test", { autoStart: false });
        const config = scanner.getConfig();

        expect(config.fps).toBe(15);
        expect(config.disableFlip).toBe(false);
        expect(config.formatsToSupport?.length).toBeGreaterThan(0);
        expect(config.qrbox.width).toBe(280);
        expect(config.qrbox.height).toBe(180);
    });
});
