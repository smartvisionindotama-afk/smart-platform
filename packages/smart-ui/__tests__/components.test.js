import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Button } from "../src/components/button/button.js";
import { Card } from "../src/components/card/card.js";
import { StatCard } from "../src/components/stat-card/stat-card.js";


// Setup minimal DOM for component tests
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;


describe("Button component", () => {

    it("should create a button element", () => {
        const btn = Button({ text: "Click" });
        expect(btn.tagName).toBe("BUTTON");
    });


    it("should set the button text", () => {
        const btn = Button({ text: "Simpan" });
        expect(btn.innerText).toBe("Simpan");
    });


    it("should have default class smart-btn", () => {
        const btn = Button({ text: "OK" });
        expect(btn.className).toContain("smart-btn");
    });


    it("should apply primary type class", () => {
        const btn = Button({ text: "OK", type: "primary" });
        expect(btn.className).toContain("smart-btn-primary");
    });


    it("should apply secondary type class", () => {
        const btn = Button({ text: "OK", type: "secondary" });
        expect(btn.className).toContain("smart-btn-secondary");
    });


    it("should apply size class when provided", () => {
        const btn = Button({ text: "OK", size: "lg" });
        expect(btn.className).toContain("smart-btn-lg");
    });


    it("should set disabled attribute", () => {
        const btn = Button({ text: "OK", disabled: true });
        expect(btn.disabled).toBe(true);
    });


    it("should not be disabled by default", () => {
        const btn = Button({ text: "OK" });
        expect(btn.disabled).toBe(false);
    });


    it("should attach click event listener when onClick provided", () => {
        let clicked = false;
        const btn = Button({
            text: "Click",
            onClick: () => { clicked = true; }
        });
        btn.click();
        expect(clicked).toBe(true);
    });

});


describe("Card component", () => {

    it("should create a div element", () => {
        const card = Card({ title: "Test", content: "Content" });
        expect(card.tagName).toBe("DIV");
    });


    it("should have smart-card class", () => {
        const card = Card({ title: "Test", content: "Content" });
        expect(card.className).toBe("smart-card");
    });


    it("should render title when provided", () => {
        const card = Card({ title: "Judul Card", content: "Isi" });
        const titleEl = card.querySelector(".smart-card-title");
        expect(titleEl).not.toBeNull();
        expect(titleEl.innerText).toBe("Judul Card");
    });


    it("should render content", () => {
        const card = Card({ title: "Test", content: "Isi Konten" });
        const contentEl = card.querySelector(".smart-card-content");
        expect(contentEl).not.toBeNull();
        expect(contentEl.innerText).toBe("Isi Konten");
    });


    it("should not render title when not provided", () => {
        const card = Card({ content: "Only content" });
        const titleEl = card.querySelector(".smart-card-title");
        expect(titleEl).toBeNull();
    });

});


describe("StatCard component", () => {

    it("should create a div element", () => {
        const stat = StatCard({ title: "Total", value: "100" });
        expect(stat.tagName).toBe("DIV");
    });


    it("should have smart-stat-card class", () => {
        const stat = StatCard({ title: "Total", value: "100" });
        expect(stat.className).toBe("smart-stat-card");
    });


    it("should render title", () => {
        const stat = StatCard({ title: "Jumlah Barang", value: "50" });
        const titleEl = stat.querySelector(".smart-stat-title");
        expect(titleEl.innerText).toBe("Jumlah Barang");
    });


    it("should render value", () => {
        const stat = StatCard({ title: "Total", value: "1.234" });
        const valueEl = stat.querySelector(".smart-stat-value");
        expect(valueEl.innerText).toBe("1.234");
    });

});
