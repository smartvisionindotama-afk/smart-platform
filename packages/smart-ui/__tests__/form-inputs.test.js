import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Input } from "../src/components/input/input.js";
import { Select } from "../src/components/select/select.js";
import { Textarea } from "../src/components/textarea/textarea.js";
import { Checkbox } from "../src/components/checkbox/checkbox.js";
import { Switch } from "../src/components/switch/switch.js";


const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;


describe("Input", () => {

    it("should create a wrapper div", () => {
        const el = Input({ label: "Name" });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-input-wrapper");
    });

    it("should render label when provided", () => {
        const el = Input({ label: "Username" });
        const labelEl = el.querySelector(".smart-input-label");
        expect(labelEl).not.toBeNull();
        expect(labelEl.innerText).toBe("Username");
    });

    it("should not render label when not provided", () => {
        const el = Input({});
        const labelEl = el.querySelector(".smart-input-label");
        expect(labelEl).toBeNull();
    });

    it("should create an input element", () => {
        const el = Input({});
        const input = el.querySelector(".smart-input");
        expect(input).not.toBeNull();
        expect(input.tagName).toBe("INPUT");
    });

    it("should set input type", () => {
        const el = Input({ type: "email" });
        const input = el.querySelector(".smart-input");
        expect(input.type).toBe("email");
    });

    it("should set placeholder", () => {
        const el = Input({ placeholder: "Enter text" });
        const input = el.querySelector(".smart-input");
        expect(input.placeholder).toBe("Enter text");
    });

    it("should set value", () => {
        const el = Input({ value: "test" });
        const input = el.querySelector(".smart-input");
        expect(input.value).toBe("test");
    });

    it("outerHTML mempertahankan value (regresi: Modal pakai innerHTML)", () => {
        const el = Input({ value: "PT-001" });
        const html = el.outerHTML;
        expect(html).toContain('value="PT-001"');
        // Simulasikan Modal(body.innerHTML = content): parse ulang → nilai tetap
        const container = dom.window.document.createElement("div");
        container.innerHTML = html;
        expect(container.querySelector(".smart-input").value).toBe("PT-001");
    });

    it("outerHTML tanpa value tidak menambah attribute kosong", () => {
        const el = Input({ placeholder: "x" });
        expect(el.outerHTML).not.toContain('value=""');
    });

    it("should disable input", () => {
        const el = Input({ disabled: true });
        const input = el.querySelector(".smart-input");
        expect(input.disabled).toBe(true);
    });

    it("should apply error class when error provided", () => {
        const el = Input({ error: "Required" });
        const input = el.querySelector(".smart-input");
        expect(input.className).toContain("smart-input-error");
    });

    it("should render error text", () => {
        const el = Input({ error: "Field is required" });
        const errorEl = el.querySelector(".smart-input-error-text");
        expect(errorEl).not.toBeNull();
        expect(errorEl.innerText).toBe("Field is required");
    });

    it("should trigger onChange on input event", () => {
        let value = "";
        const el = Input({
            onChange: (e) => { value = e.target.value; }
        });
        const input = el.querySelector(".smart-input");
        input.value = "hello";
        input.dispatchEvent(new dom.window.Event("input"));
        expect(value).toBe("hello");
    });

});


describe("Select", () => {

    const options = [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
        { value: "c", label: "Option C" }
    ];

    it("should create a wrapper div", () => {
        const el = Select({ label: "Pilih", options });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-select-wrapper");
    });

    it("should render label", () => {
        const el = Select({ label: "Category", options });
        const labelEl = el.querySelector(".smart-select-label");
        expect(labelEl.innerText).toBe("Category");
    });

    it("should create a select element", () => {
        const el = Select({ options });
        const select = el.querySelector(".smart-select");
        expect(select.tagName).toBe("SELECT");
    });

    it("should render options", () => {
        const el = Select({ options });
        const select = el.querySelector(".smart-select");
        expect(select.options.length).toBe(3);
        expect(select.options[0].text).toBe("Option A");
    });

    it("should render placeholder option", () => {
        const el = Select({ options, placeholder: "Choose..." });
        const select = el.querySelector(".smart-select");
        expect(select.options.length).toBe(4);
        expect(select.options[0].text).toBe("Choose...");
        expect(select.options[0].disabled).toBe(true);
    });

    it("should select the correct value", () => {
        const el = Select({ options, value: "b" });
        const select = el.querySelector(".smart-select");
        expect(select.value).toBe("b");
    });

    it("outerHTML mempertahankan selected (regresi: Modal pakai innerHTML)", () => {
        const el = Select({ options, value: "b" });
        const html = el.outerHTML;
        const container = dom.window.document.createElement("div");
        container.innerHTML = html;
        expect(container.querySelector(".smart-select").value).toBe("b");
    });

    it("should disable select", () => {
        const el = Select({ options, disabled: true });
        const select = el.querySelector(".smart-select");
        expect(select.disabled).toBe(true);
    });

    it("should trigger onChange on change event", () => {
        let val = "";
        const el = Select({
            options,
            onChange: (e) => { val = e.target.value; }
        });
        const select = el.querySelector(".smart-select");
        select.value = "c";
        select.dispatchEvent(new dom.window.Event("change"));
        expect(val).toBe("c");
    });

});


describe("Textarea", () => {

    it("should create a wrapper div", () => {
        const el = Textarea({ label: "Bio" });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-textarea-wrapper");
    });

    it("should render label", () => {
        const el = Textarea({ label: "Description" });
        const labelEl = el.querySelector(".smart-textarea-label");
        expect(labelEl.innerText).toBe("Description");
    });

    it("should create a textarea element", () => {
        const el = Textarea({});
        const textarea = el.querySelector(".smart-textarea");
        expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("should set placeholder", () => {
        const el = Textarea({ placeholder: "Write here..." });
        const textarea = el.querySelector(".smart-textarea");
        expect(textarea.placeholder).toBe("Write here...");
    });

    it("should set rows", () => {
        const el = Textarea({ rows: 5 });
        const textarea = el.querySelector(".smart-textarea");
        expect(textarea.rows).toBe(5);
    });

    it("should set value", () => {
        const el = Textarea({ value: "content" });
        const textarea = el.querySelector(".smart-textarea");
        expect(textarea.value).toBe("content");
    });

    it("outerHTML mempertahankan isi textarea (regresi: Modal pakai innerHTML)", () => {
        const el = Textarea({ value: "isi panjang" });
        const html = el.outerHTML;
        const container = dom.window.document.createElement("div");
        container.innerHTML = html;
        expect(container.querySelector(".smart-textarea").value).toBe("isi panjang");
    });

    it("should disable textarea", () => {
        const el = Textarea({ disabled: true });
        const textarea = el.querySelector(".smart-textarea");
        expect(textarea.disabled).toBe(true);
    });

    it("should apply error class", () => {
        const el = Textarea({ error: "Required" });
        const textarea = el.querySelector(".smart-textarea");
        expect(textarea.className).toContain("smart-textarea-error");
    });

    it("should render error text", () => {
        const el = Textarea({ error: "Too short" });
        const errorEl = el.querySelector(".smart-textarea-error-text");
        expect(errorEl.innerText).toBe("Too short");
    });

    it("should trigger onChange on input event", () => {
        let val = "";
        const el = Textarea({
            onChange: (e) => { val = e.target.value; }
        });
        const textarea = el.querySelector(".smart-textarea");
        textarea.value = "updated";
        textarea.dispatchEvent(new dom.window.Event("input"));
        expect(val).toBe("updated");
    });

});


describe("Checkbox", () => {

    it("should create a label wrapper", () => {
        const el = Checkbox({ label: "Agree" });
        expect(el.tagName).toBe("LABEL");
        expect(el.className).toContain("smart-checkbox-wrapper");
    });

    it("should create a checkbox input", () => {
        const el = Checkbox({ label: "Agree" });
        const input = el.querySelector(".smart-checkbox-input");
        expect(input.type).toBe("checkbox");
    });

    it("should render label text", () => {
        const el = Checkbox({ label: "Accept terms" });
        const text = el.querySelector(".smart-checkbox-text");
        expect(text.innerText).toBe("Accept terms");
    });

    it("should not render label text when not provided", () => {
        const el = Checkbox({});
        const text = el.querySelector(".smart-checkbox-text");
        expect(text).toBeNull();
    });

    it("should set checked state", () => {
        const el = Checkbox({ checked: true });
        const input = el.querySelector(".smart-checkbox-input");
        expect(input.checked).toBe(true);
    });

    it("outerHTML mempertahankan checked (regresi: Modal pakai innerHTML)", () => {
        const el = Checkbox({ checked: true });
        const html = el.outerHTML;
        const container = dom.window.document.createElement("div");
        container.innerHTML = html;
        expect(container.querySelector(".smart-checkbox-input").checked).toBe(true);
    });

    it("should default to unchecked", () => {
        const el = Checkbox({});
        const input = el.querySelector(".smart-checkbox-input");
        expect(input.checked).toBe(false);
    });

    it("should disable checkbox", () => {
        const el = Checkbox({ disabled: true });
        const input = el.querySelector(".smart-checkbox-input");
        expect(input.disabled).toBe(true);
    });

    it("should render checkmark span", () => {
        const el = Checkbox({ label: "Yes" });
        const checkmark = el.querySelector(".smart-checkbox-checkmark");
        expect(checkmark).not.toBeNull();
    });

    it("should trigger onChange on change event", () => {
        let fired = false;
        const el = Checkbox({
            label: "Test",
            onChange: () => { fired = true; }
        });
        const input = el.querySelector(".smart-checkbox-input");
        input.dispatchEvent(new dom.window.Event("change"));
        expect(fired).toBe(true);
    });

});


describe("Switch", () => {

    it("should create a label wrapper", () => {
        const el = Switch({ label: "Enable" });
        expect(el.tagName).toBe("LABEL");
        expect(el.className).toContain("smart-switch-wrapper");
    });

    it("should create a checkbox input", () => {
        const el = Switch({ label: "On" });
        const input = el.querySelector(".smart-switch-input");
        expect(input.type).toBe("checkbox");
    });

    it("should render label text", () => {
        const el = Switch({ label: "Notifications" });
        const text = el.querySelector(".smart-switch-text");
        expect(text.innerText).toBe("Notifications");
    });

    it("should not render label text when not provided", () => {
        const el = Switch({});
        const text = el.querySelector(".smart-switch-text");
        expect(text).toBeNull();
    });

    it("should set checked state", () => {
        const el = Switch({ checked: true });
        const input = el.querySelector(".smart-switch-input");
        expect(input.checked).toBe(true);
    });

    it("outerHTML mempertahankan checked (regresi: Modal pakai innerHTML)", () => {
        const el = Switch({ checked: true });
        const html = el.outerHTML;
        const container = dom.window.document.createElement("div");
        container.innerHTML = html;
        expect(container.querySelector(".smart-switch-input").checked).toBe(true);
    });

    it("should disable switch", () => {
        const el = Switch({ disabled: true });
        const input = el.querySelector(".smart-switch-input");
        expect(input.disabled).toBe(true);
    });

    it("should render slider span", () => {
        const el = Switch({ label: "Toggle" });
        const slider = el.querySelector(".smart-switch-slider");
        expect(slider).not.toBeNull();
    });

    it("should trigger onChange on change event", () => {
        let fired = false;
        const el = Switch({
            label: "Test",
            onChange: () => { fired = true; }
        });
        const input = el.querySelector(".smart-switch-input");
        input.dispatchEvent(new dom.window.Event("change"));
        expect(fired).toBe(true);
    });

});
