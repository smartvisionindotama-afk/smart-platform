import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Badge } from "../src/components/badge/badge.js";
import { Avatar } from "../src/components/avatar/avatar.js";


const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;


describe("Badge", () => {

    it("should create a span element", () => {
        const el = Badge({ text: "New" });
        expect(el.tagName).toBe("SPAN");
    });

    it("should have smart-badge class", () => {
        const el = Badge({ text: "New" });
        expect(el.className).toContain("smart-badge");
    });

    it("should render text", () => {
        const el = Badge({ text: "Active" });
        const textEl = el.querySelector(".smart-badge-text");
        expect(textEl.textContent).toBe("Active");
    });

    it("should apply default variant when not specified", () => {
        const el = Badge({ text: "New" });
        expect(el.className).toContain("smart-badge-default");
    });

    it("should apply primary variant", () => {
        const el = Badge({ text: "New", variant: "primary" });
        expect(el.className).toContain("smart-badge-primary");
    });

    it("should apply success variant", () => {
        const el = Badge({ text: "Done", variant: "success" });
        expect(el.className).toContain("smart-badge-success");
    });

    it("should apply size class when provided", () => {
        const el = Badge({ text: "New", size: "sm" });
        expect(el.className).toContain("smart-badge-sm");
    });

    it("should render count element when count is provided", () => {
        const el = Badge({ text: "Notifications", count: 5 });
        const countEl = el.querySelector(".smart-badge-count");
        expect(countEl).not.toBeNull();
        expect(countEl.textContent).toBe("5");
    });

    it("should cap count at 99+", () => {
        const el = Badge({ text: "Notifications", count: 150 });
        const countEl = el.querySelector(".smart-badge-count");
        expect(countEl.textContent).toBe("99+");
    });

    it("should render both text and count when both provided", () => {
        const el = Badge({ text: "Messages", count: 12 });
        const textEl = el.querySelector(".smart-badge-text");
        const countEl = el.querySelector(".smart-badge-count");
        expect(textEl.textContent).toBe("Messages");
        expect(countEl.textContent).toBe("12");
    });

});


describe("Avatar", () => {

    it("should create a div element", () => {
        const el = Avatar({ name: "John Doe" });
        expect(el.tagName).toBe("DIV");
    });

    it("should have smart-avatar class", () => {
        const el = Avatar({ name: "John" });
        expect(el.className).toContain("smart-avatar");
    });

    it("should have role=img", () => {
        const el = Avatar({ name: "John" });
        expect(el.getAttribute("role")).toBe("img");
    });

    it("should show initials when no src provided", () => {
        const el = Avatar({ name: "John Doe" });
        const initials = el.querySelector(".smart-avatar-initials");
        expect(initials).not.toBeNull();
        expect(initials.innerText).toBe("JD");
    });

    it("should show single initial for single name", () => {
        const el = Avatar({ name: "Admin" });
        const initials = el.querySelector(".smart-avatar-initials");
        expect(initials.innerText).toBe("A");
    });

    it("should show ? for empty name", () => {
        const el = Avatar({ name: "" });
        const initials = el.querySelector(".smart-avatar-initials");
        expect(initials.innerText).toBe("?");
    });

    it("should render img when src provided", () => {
        const el = Avatar({ src: "https://example.com/avatar.jpg", name: "John" });
        const img = el.querySelector(".smart-avatar-img");
        expect(img).not.toBeNull();
        expect(img.src).toBe("https://example.com/avatar.jpg");
    });

    it("should set img alt from alt prop", () => {
        const el = Avatar({
            src: "https://example.com/avatar.jpg",
            alt: "User photo",
            name: "John"
        });
        const img = el.querySelector(".smart-avatar-img");
        expect(img.alt).toBe("User photo");
    });

    it("should fallback alt to name", () => {
        const el = Avatar({
            src: "https://example.com/avatar.jpg",
            name: "John"
        });
        const img = el.querySelector(".smart-avatar-img");
        expect(img.alt).toBe("John");
    });

    it("should apply size class", () => {
        const el = Avatar({ name: "John", size: "lg" });
        expect(el.className).toContain("smart-avatar-lg");
    });

    it("should default to md size", () => {
        const el = Avatar({ name: "John" });
        expect(el.className).toContain("smart-avatar-md");
    });

    it("should apply circle variant by default", () => {
        const el = Avatar({ name: "John" });
        expect(el.className).toContain("smart-avatar-circle");
    });

    it("should apply square variant", () => {
        const el = Avatar({ name: "John", variant: "square" });
        expect(el.className).toContain("smart-avatar-square");
    });

});
