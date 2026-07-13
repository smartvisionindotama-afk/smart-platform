import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Alert } from "../src/components/alert/alert.js";
import { Toast } from "../src/components/toast/toast.js";
import { Modal } from "../src/components/modal/modal.js";


const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;



describe("Alert", () => {

    it("should create a div element", () => {
        const el = Alert({ message: "Info message" });
        expect(el.tagName).toBe("DIV");
    });

    it("should have smart-alert class", () => {
        const el = Alert({ message: "Test" });
        expect(el.className).toContain("smart-alert");
    });

    it("should have role=alert", () => {
        const el = Alert({ message: "Test" });
        expect(el.getAttribute("role")).toBe("alert");
    });

    it("should render message", () => {
        const el = Alert({ message: "Operation successful" });
        const msg = el.querySelector(".smart-alert-message");
        expect(msg.innerText).toBe("Operation successful");
    });

    it("should apply variant class", () => {
        const el = Alert({ message: "Test", variant: "danger" });
        expect(el.className).toContain("smart-alert-danger");
    });

    it("should default to info variant", () => {
        const el = Alert({ message: "Test" });
        expect(el.className).toContain("smart-alert-info");
    });

    it("should have icon element", () => {
        const el = Alert({ message: "Test" });
        const icon = el.querySelector(".smart-alert-icon");
        expect(icon).not.toBeNull();
    });

    it("should not render close button by default", () => {
        const el = Alert({ message: "Test" });
        const close = el.querySelector(".smart-alert-close");
        expect(close).toBeNull();
    });

    it("should render close button when dismissible", () => {
        const el = Alert({ message: "Test", dismissible: true });
        const close = el.querySelector(".smart-alert-close");
        expect(close).not.toBeNull();
    });

    it("should trigger onDismiss on close click", () => {
        let dismissed = false;
        const el = Alert({
            message: "Test",
            dismissible: true,
            onDismiss: () => { dismissed = true; }
        });
        const close = el.querySelector(".smart-alert-close");
        close.click();
        expect(dismissed).toBe(true);
    });

});


describe("Toast", () => {

    it("should create a div element", () => {
        const el = Toast({ message: "Saved" });
        expect(el.tagName).toBe("DIV");
    });

    it("should have smart-toast class", () => {
        const el = Toast({ message: "Test" });
        expect(el.className).toContain("smart-toast");
    });

    it("should have role=status", () => {
        const el = Toast({ message: "Test" });
        expect(el.getAttribute("role")).toBe("status");
    });

    it("should render message", () => {
        const el = Toast({ message: "Data saved successfully" });
        const msg = el.querySelector(".smart-toast-message");
        expect(msg.innerText).toBe("Data saved successfully");
    });

    it("should apply variant class", () => {
        const el = Toast({ message: "Test", variant: "success" });
        expect(el.className).toContain("smart-toast-success");
    });

    it("should have icon element", () => {
        const el = Toast({ message: "Test" });
        const icon = el.querySelector(".smart-toast-icon");
        expect(icon).not.toBeNull();
    });

    it("should have close button", () => {
        const el = Toast({ message: "Test" });
        const close = el.querySelector(".smart-toast-close");
        expect(close).not.toBeNull();
    });

    it("should trigger onDismiss on close click", () => {
        let dismissed = false;
        const el = Toast({
            message: "Test",
            onDismiss: () => { dismissed = true; }
        });
        const close = el.querySelector(".smart-toast-close");
        close.click();
        expect(dismissed).toBe(true);
    });

    it("should call onDismiss after duration", () => new Promise(done => {
        let dismissed = false;
        const el = Toast({
            message: "Test",
            duration: 10,
            onDismiss: () => { dismissed = true; }
        });
        setTimeout(() => {
            expect(dismissed).toBe(true);
            done();
        }, 50);
    }));

});


describe("Modal", () => {

    it("should create an overlay div", () => {
        const el = Modal({ title: "Dialog" });
        expect(el.tagName).toBe("DIV");
    });

    it("should have smart-modal-overlay class", () => {
        const el = Modal({ title: "Test" });
        expect(el.className).toContain("smart-modal-overlay");
    });

    it("should not have open class by default", () => {
        const el = Modal({ title: "Test" });
        expect(el.className).not.toContain("smart-modal-open");
    });

    it("should have open class when open=true", () => {
        const el = Modal({ open: true, title: "Test" });
        expect(el.className).toContain("smart-modal-open");
    });

    it("should render dialog element", () => {
        const el = Modal({ title: "Test" });
        const dialog = el.querySelector(".smart-modal-dialog");
        expect(dialog).not.toBeNull();
    });

    it("should have role=dialog on dialog", () => {
        const el = Modal({ title: "Test" });
        const dialog = el.querySelector(".smart-modal-dialog");
        expect(dialog.getAttribute("role")).toBe("dialog");
    });

    it("should render title", () => {
        const el = Modal({ title: "Confirm Delete" });
        const titleEl = el.querySelector(".smart-modal-title");
        expect(titleEl.innerText).toBe("Confirm Delete");
    });

    it("should not render title when not provided", () => {
        const el = Modal({ content: "Body content" });
        const titleEl = el.querySelector(".smart-modal-title");
        expect(titleEl).toBeNull();
    });

    it("should render body content", () => {
        const el = Modal({ content: "<p>Are you sure?</p>" });
        const body = el.querySelector(".smart-modal-body");
        expect(body.innerHTML).toContain("Are you sure?");
    });

    it("should have close button by default", () => {
        const el = Modal({ title: "Test" });
        const close = el.querySelector(".smart-modal-close");
        expect(close).not.toBeNull();
    });

    it("should not render close button when closable=false", () => {
        const el = Modal({ title: "Test", closable: false });
        const close = el.querySelector(".smart-modal-close");
        expect(close).toBeNull();
    });

    it("should trigger onClose on close button click", () => {
        let closed = false;
        const el = Modal({
            title: "Test",
            onClose: () => { closed = true; }
        });
        const close = el.querySelector(".smart-modal-close");
        close.click();
        expect(closed).toBe(true);
    });

    it("should render footer when provided", () => {
        const el = Modal({
            title: "Test",
            footer: "<button>OK</button>"
        });
        const footer = el.querySelector(".smart-modal-footer");
        expect(footer).not.toBeNull();
        expect(footer.innerHTML).toContain("OK");
    });

    it("should not render footer when not provided", () => {
        const el = Modal({ title: "Test" });
        const footer = el.querySelector(".smart-modal-footer");
        expect(footer).toBeNull();
    });

});
