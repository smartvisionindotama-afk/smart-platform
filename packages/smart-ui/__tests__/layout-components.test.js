import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Container } from "../src/components/container/container.js";
import { Stack } from "../src/components/stack/stack.js";
import { Divider } from "../src/components/divider/divider.js";


const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;


describe("Container", () => {

    it("should create a div element", () => {
        const el = Container({});
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-container");
    });

    it("should apply default md size class", () => {
        const el = Container({});
        expect(el.className).toContain("smart-container-md");
    });

    it("should apply size class", () => {
        const el = Container({ size: "lg" });
        expect(el.className).toContain("smart-container-lg");
    });

    it("should apply xs size class", () => {
        const el = Container({ size: "xs" });
        expect(el.className).toContain("smart-container-xs");
    });

    it("should apply full size class", () => {
        const el = Container({ size: "full" });
        expect(el.className).toContain("smart-container-full");
    });

    it("should have padding by default", () => {
        const el = Container({});
        expect(el.className).not.toContain("smart-container-no-padding");
    });

    it("should remove padding when padding=false", () => {
        const el = Container({ padding: false });
        expect(el.className).toContain("smart-container-no-padding");
    });

    it("should render string children", () => {
        const el = Container({ children: "<p>Hello</p>" });
        expect(el.innerHTML).toContain("Hello");
    });

    it("should render Node children", () => {
        const child = document.createElement("span");
        child.innerText = "test";
        const el = Container({ children: child });
        const span = el.querySelector("span");
        expect(span.innerText).toBe("test");
    });

    it("should handle no children", () => {
        const el = Container({});
        expect(el.innerHTML).toBe("");
    });

});


describe("Stack", () => {

    it("should create a div element", () => {
        const el = Stack({});
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-stack");
    });

    it("should default to vertical direction", () => {
        const el = Stack({});
        expect(el.className).toContain("smart-stack-vertical");
    });

    it("should apply horizontal direction", () => {
        const el = Stack({ direction: "horizontal" });
        expect(el.className).toContain("smart-stack-horizontal");
    });

    it("should apply wrap class", () => {
        const el = Stack({ wrap: true });
        expect(el.className).toContain("smart-stack-wrap");
    });

    it("should set gap via style", () => {
        const el = Stack({ gap: "lg" });
        expect(el.style.gap).toBeTruthy();
    });

    it("should set alignItems when align provided", () => {
        const el = Stack({ align: "center" });
        expect(el.style.alignItems).toBe("center");
    });

    it("should set justifyContent when justify provided", () => {
        const el = Stack({ justify: "space-between" });
        expect(el.style.justifyContent).toBe("space-between");
    });

    it("should not set align when not provided", () => {
        const el = Stack({});
        expect(el.style.alignItems).toBe("");
    });

    it("should render string children", () => {
        const el = Stack({ children: "<p>Content</p>" });
        expect(el.innerHTML).toContain("Content");
    });

    it("should render Node children", () => {
        const child = document.createElement("span");
        child.innerText = "child";
        const el = Stack({ children: child });
        const span = el.querySelector("span");
        expect(span.innerText).toBe("child");
    });

    it("should render array of children", () => {
        const child1 = document.createElement("span");
        child1.innerText = "A";
        const child2 = document.createElement("span");
        child2.innerText = "B";
        const el = Stack({ children: [child1, child2] });
        const spans = el.querySelectorAll("span");
        expect(spans.length).toBe(2);
        expect(spans[0].innerText).toBe("A");
        expect(spans[1].innerText).toBe("B");
    });

    it("should handle no children", () => {
        const el = Stack({});
        expect(el.innerHTML).toBe("");
    });

});


describe("Divider", () => {

    it("should create a div element", () => {
        const el = Divider({});
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-divider");
    });

    it("should have role=separator", () => {
        const el = Divider({});
        expect(el.getAttribute("role")).toBe("separator");
    });

    it("should have aria-orientation", () => {
        const el = Divider({});
        expect(el.getAttribute("aria-orientation")).toBe("horizontal");
    });

    it("should default to horizontal orientation", () => {
        const el = Divider({});
        expect(el.className).toContain("smart-divider-horizontal");
    });

    it("should apply vertical orientation", () => {
        const el = Divider({ orientation: "vertical" });
        expect(el.className).toContain("smart-divider-vertical");
    });

    it("should set aria-orientation to vertical", () => {
        const el = Divider({ orientation: "vertical" });
        expect(el.getAttribute("aria-orientation")).toBe("vertical");
    });

    it("should not render label element when no label", () => {
        const el = Divider({});
        const label = el.querySelector(".smart-divider-label");
        expect(label).toBeNull();
    });

    it("should render label when provided for horizontal", () => {
        const el = Divider({ label: "Section" });
        const label = el.querySelector(".smart-divider-label");
        expect(label).not.toBeNull();
        expect(label.innerText).toBe("Section");
    });

    it("should default to center label position", () => {
        const el = Divider({ label: "Section" });
        const label = el.querySelector(".smart-divider-label");
        expect(label.className).toContain("smart-divider-label-center");
    });

    it("should apply label position class", () => {
        const el = Divider({ label: "Section", labelPosition: "left" });
        const label = el.querySelector(".smart-divider-label");
        expect(label.className).toContain("smart-divider-label-left");
    });

    it("should render line elements when label provided", () => {
        const el = Divider({ label: "Section" });
        const lines = el.querySelectorAll(".smart-divider-line");
        expect(lines.length).toBe(2);
    });

    it("should render label for vertical divider", () => {
        const el = Divider({
            orientation: "vertical",
            label: "OR"
        });
        const label = el.querySelector(".smart-divider-label");
        expect(label).not.toBeNull();
        expect(label.innerText).toBe("OR");
    });

});
