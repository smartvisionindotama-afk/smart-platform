import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Tabs } from "../src/components/tabs/tabs.js";
import { Dropdown } from "../src/components/dropdown/dropdown.js";
import { Breadcrumb } from "../src/components/breadcrumb/breadcrumb.js";


const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;


describe("Tabs", () => {

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "details", label: "Details" },
        { id: "settings", label: "Settings" }
    ];

    it("should create a nav element", () => {
        const el = Tabs({ tabs });
        expect(el.tagName).toBe("NAV");
        expect(el.className).toContain("smart-tabs");
    });

    it("should have role=tablist", () => {
        const el = Tabs({ tabs });
        expect(el.getAttribute("role")).toBe("tablist");
    });

    it("should render tab buttons", () => {
        const el = Tabs({ tabs });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons.length).toBe(3);
    });

    it("should render tab labels", () => {
        const el = Tabs({ tabs });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons[0].innerText).toBe("Overview");
        expect(buttons[1].innerText).toBe("Details");
    });

    it("should mark active tab with class", () => {
        const el = Tabs({ tabs, active: "details" });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons[0].className).not.toContain("smart-tab-active");
        expect(buttons[1].className).toContain("smart-tab-active");
    });

    it("should set aria-selected on tabs", () => {
        const el = Tabs({ tabs, active: "settings" });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons[0].getAttribute("aria-selected")).toBe("false");
        expect(buttons[2].getAttribute("aria-selected")).toBe("true");
    });

    it("should set role=tab on each button", () => {
        const el = Tabs({ tabs });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons[0].getAttribute("role")).toBe("tab");
    });

    it("should trigger onChange with tab id on click", () => {
        let selected = "";
        const el = Tabs({
            tabs,
            onChange: (id) => { selected = id; }
        });
        const buttons = el.querySelectorAll(".smart-tab");
        buttons[1].click();
        expect(selected).toBe("details");
    });

    it("should handle empty tabs gracefully", () => {
        const el = Tabs({ tabs: [] });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons.length).toBe(0);
    });

    it("should use tab.id as fallback label", () => {
        const el = Tabs({ tabs: [{ id: "home" }] });
        const buttons = el.querySelectorAll(".smart-tab");
        expect(buttons[0].innerText).toBe("home");
    });

});


describe("Dropdown", () => {

    const items = [
        { label: "Edit", value: "edit" },
        { label: "Duplicate", value: "duplicate" },
        { label: "Delete", value: "delete", disabled: true }
    ];

    it("should create a wrapper div", () => {
        const el = Dropdown({ label: "Actions", items });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-dropdown");
    });

    it("should render trigger button", () => {
        const el = Dropdown({ label: "Actions", items });
        const trigger = el.querySelector(".smart-dropdown-trigger");
        expect(trigger).not.toBeNull();
        expect(trigger.innerText).toBe("Actions");
    });

    it("should have aria-haspopup on trigger", () => {
        const el = Dropdown({ label: "Menu", items });
        const trigger = el.querySelector(".smart-dropdown-trigger");
        expect(trigger.getAttribute("aria-haspopup")).toBe("true");
    });

    it("should have aria-expanded on trigger", () => {
        const el = Dropdown({ label: "Menu", items });
        const trigger = el.querySelector(".smart-dropdown-trigger");
        expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });

    it("should render menu items", () => {
        const el = Dropdown({ label: "Menu", items });
        const menuItems = el.querySelectorAll(".smart-dropdown-item");
        expect(menuItems.length).toBe(3);
    });

    it("should render menu item labels", () => {
        const el = Dropdown({ label: "Menu", items });
        const menuItems = el.querySelectorAll(".smart-dropdown-item");
        expect(menuItems[0].innerText).toBe("Edit");
        expect(menuItems[1].innerText).toBe("Duplicate");
        expect(menuItems[2].innerText).toBe("Delete");
    });

    it("should have role=menu on menu", () => {
        const el = Dropdown({ label: "Menu", items });
        const menu = el.querySelector(".smart-dropdown-menu");
        expect(menu.getAttribute("role")).toBe("menu");
    });

    it("should have role=menuitem on items", () => {
        const el = Dropdown({ label: "Menu", items });
        const menuItems = el.querySelectorAll(".smart-dropdown-item");
        expect(menuItems[0].getAttribute("role")).toBe("menuitem");
    });

    it("should disable disabled items", () => {
        const el = Dropdown({ label: "Menu", items });
        const menuItems = el.querySelectorAll(".smart-dropdown-item");
        expect(menuItems[0].disabled).toBe(false);
        expect(menuItems[2].disabled).toBe(true);
    });

    it("should be hidden by default", () => {
        const el = Dropdown({ label: "Menu", items });
        const menu = el.querySelector(".smart-dropdown-menu");
        expect(menu.style.display).toBe("none");
    });

    it("should toggle menu on trigger click", () => {
        const el = Dropdown({ label: "Menu", items });
        const trigger = el.querySelector(".smart-dropdown-trigger");
        const menu = el.querySelector(".smart-dropdown-menu");

        trigger.click();
        expect(menu.style.display).toBe("block");

        trigger.click();
        expect(menu.style.display).toBe("none");
    });

    it("should disable trigger when disabled prop is true", () => {
        const el = Dropdown({ label: "Menu", items, disabled: true });
        const trigger = el.querySelector(".smart-dropdown-trigger");
        expect(trigger.disabled).toBe(true);
    });

    it("should handle item onClick callback", () => {
        let selected = "";
        const customItems = [
            {
                label: "Open",
                value: "open",
                onClick: (val) => { selected = val; }
            }
        ];
        const el = Dropdown({ label: "Menu", items: customItems });
        const menu = el.querySelector(".smart-dropdown-menu");
        menu.style.display = "block";

        const item = el.querySelector(".smart-dropdown-item");
        item.click();
        expect(selected).toBe("open");
    });

    it("should handle divider items", () => {
        const withDivider = [
            { label: "Item 1", value: "1" },
            { divider: true },
            { label: "Item 2", value: "2" }
        ];
        const el = Dropdown({ label: "Menu", items: withDivider });
        const dividers = el.querySelectorAll(".smart-dropdown-divider");
        expect(dividers.length).toBe(1);
    });

    it("should handle empty items gracefully", () => {
        const el = Dropdown({ label: "Menu", items: [] });
        const menuItems = el.querySelectorAll(".smart-dropdown-item");
        expect(menuItems.length).toBe(0);
    });

    it("should apply placement class", () => {
        const el = Dropdown({
            label: "Menu",
            items,
            placement: "bottom-right"
        });
        const menu = el.querySelector(".smart-dropdown-menu");
        expect(menu.className).toContain("smart-dropdown-bottom-right");
    });

});


describe("Breadcrumb", () => {

    const items = [
        { label: "Home", href: "/" },
        { label: "Documents" },
        { label: "Current Page" }
    ];

    it("should create a nav element", () => {
        const el = Breadcrumb({ items });
        expect(el.tagName).toBe("NAV");
        expect(el.className).toContain("smart-breadcrumb");
    });

    it("should have aria-label", () => {
        const el = Breadcrumb({ items });
        expect(el.getAttribute("aria-label")).toBe("Breadcrumb");
    });

    it("should render list", () => {
        const el = Breadcrumb({ items });
        const ol = el.querySelector(".smart-breadcrumb-list");
        expect(ol).not.toBeNull();
        expect(ol.tagName).toBe("OL");
    });

    it("should render breadcrumb items", () => {
        const el = Breadcrumb({ items });
        const listItems = el.querySelectorAll(".smart-breadcrumb-item");
        expect(listItems.length).toBe(3);
    });

    it("should render links for items with href", () => {
        const el = Breadcrumb({ items });
        const links = el.querySelectorAll(".smart-breadcrumb-link");
        expect(links.length).toBe(1);
        expect(links[0].href).toContain("/");
        expect(links[0].innerText).toBe("Home");
    });

    it("should render text for items without href", () => {
        const el = Breadcrumb({ items });
        const texts = el.querySelectorAll(".smart-breadcrumb-text");
        expect(texts.length).toBe(1);
        expect(texts[0].innerText).toBe("Documents");
    });

    it("should mark last item as current", () => {
        const el = Breadcrumb({ items });
        const listItems = el.querySelectorAll(".smart-breadcrumb-item");
        const last = listItems[2];
        expect(last.getAttribute("aria-current")).toBe("page");
    });

    it("should render current page span", () => {
        const el = Breadcrumb({ items });
        const current = el.querySelector(".smart-breadcrumb-current");
        expect(current).not.toBeNull();
        expect(current.innerText).toBe("Current Page");
    });

    it("should render separators between items", () => {
        const el = Breadcrumb({ items });
        const separators = el.querySelectorAll(".smart-breadcrumb-separator");
        expect(separators.length).toBe(2);
    });

    it("should have aria-hidden on separators", () => {
        const el = Breadcrumb({ items });
        const separators = el.querySelectorAll(".smart-breadcrumb-separator");
        expect(separators[0].getAttribute("aria-hidden")).toBe("true");
    });

    it("should handle single item", () => {
        const el = Breadcrumb({ items: [{ label: "Home" }] });
        const listItems = el.querySelectorAll(".smart-breadcrumb-item");
        expect(listItems.length).toBe(1);
        const current = el.querySelector(".smart-breadcrumb-current");
        expect(current.innerText).toBe("Home");
    });

    it("should handle empty items gracefully", () => {
        const el = Breadcrumb({ items: [] });
        const listItems = el.querySelectorAll(".smart-breadcrumb-item");
        expect(listItems.length).toBe(0);
    });

});
