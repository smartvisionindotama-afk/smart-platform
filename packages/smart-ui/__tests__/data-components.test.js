import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { Table } from "../src/components/table/table.js";
import { Pagination } from "../src/components/pagination/pagination.js";
import { EmptyState } from "../src/components/empty-state/empty-state.js";
import { Skeleton } from "../src/components/skeleton/skeleton.js";


const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window;


describe("Table", () => {

    const columns = [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "email", label: "Email" }
    ];

    const rows = [
        { name: "Alice", role: "Admin", email: "alice@test.com" },
        { name: "Bob", role: "User", email: "bob@test.com" }
    ];

    it("should create a wrapper div", () => {
        const el = Table({ columns, rows });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-table-wrapper");
    });

    it("should render table element", () => {
        const el = Table({ columns, rows });
        const table = el.querySelector(".smart-table");
        expect(table).not.toBeNull();
        expect(table.tagName).toBe("TABLE");
    });

    it("should render header row", () => {
        const el = Table({ columns, rows });
        const headers = el.querySelectorAll(".smart-table-th");
        expect(headers.length).toBe(3);
        expect(headers[0].innerText).toBe("Name");
        expect(headers[1].innerText).toBe("Role");
    });

    it("should render data rows", () => {
        const el = Table({ columns, rows });
        const cells = el.querySelectorAll(".smart-table-td");
        expect(cells.length).toBe(6);
        expect(cells[0].innerText).toBe("Alice");
        expect(cells[3].innerText).toBe("Bob");
    });

    it("should show empty message when no rows", () => {
        const el = Table({ columns, rows: [] });
        const empty = el.querySelector(".smart-table-empty");
        expect(empty).not.toBeNull();
        expect(empty.innerText).toBe("No data available");
    });

    it("should apply striped class", () => {
        const el = Table({ columns, rows, striped: true });
        const table = el.querySelector(".smart-table");
        expect(table.className).toContain("smart-table-striped");
    });

    it("should apply bordered class", () => {
        const el = Table({ columns, rows, bordered: true });
        const table = el.querySelector(".smart-table");
        expect(table.className).toContain("smart-table-bordered");
    });

    it("should apply hoverable class", () => {
        const el = Table({ columns, rows, hoverable: true });
        const table = el.querySelector(".smart-table");
        expect(table.className).toContain("smart-table-hoverable");
    });

    it("should apply compact variant", () => {
        const el = Table({ columns, rows, variant: "compact" });
        const table = el.querySelector(".smart-table");
        expect(table.className).toContain("smart-table-compact");
    });

    it("should handle custom column render function", () => {
        const cols = [
            { key: "name", label: "Name" },
            {
                key: "active",
                label: "Status",
                render: (val) => val ? "Active" : "Inactive"
            }
        ];
        const data = [
            { name: "Test", active: true }
        ];
        const el = Table({ columns: cols, rows: data });
        const cells = el.querySelectorAll(".smart-table-td");
        expect(cells.length).toBe(2);
        expect(cells[1].textContent).toBe("Active");
    });

    it("should handle column align", () => {
        const cols = [
            { key: "name", label: "Name" },
            { key: "count", label: "Count", align: "right" }
        ];
        const data = [{ name: "Test", count: 5 }];
        const el = Table({ columns: cols, rows: data });
        const cells = el.querySelectorAll(".smart-table-td");
        expect(cells[1].style.textAlign).toBe("right");
    });

    it("should handle empty columns gracefully", () => {
        const el = Table({ columns: [], rows: [{ a: 1 }] });
        const table = el.querySelector(".smart-table");
        expect(table).not.toBeNull();
    });

});


describe("Pagination", () => {

    it("should create a nav element", () => {
        const el = Pagination({ total: 50 });
        expect(el.tagName).toBe("NAV");
        expect(el.className).toContain("smart-pagination");
    });

    it("should have role=navigation", () => {
        const el = Pagination({ total: 50 });
        expect(el.getAttribute("role")).toBe("navigation");
    });

    it("should render page buttons", () => {
        const el = Pagination({ current: 1, total: 50 });
        const btns = el.querySelectorAll(".smart-pagination-btn");
        expect(btns.length).toBeGreaterThan(2);
    });

    it("should have prev/next buttons", () => {
        const el = Pagination({ current: 5, total: 100 });
        const btns = el.querySelectorAll(".smart-pagination-btn");
        const first = btns[0];
        const last = btns[btns.length - 1];
        expect(first.innerText).toBe("‹");
        expect(last.innerText).toBe("›");
    });

    it("should disable prev on first page", () => {
        const el = Pagination({ current: 1, total: 50 });
        const btns = el.querySelectorAll(".smart-pagination-btn");
        expect(btns[0].disabled).toBe(true);
    });

    it("should disable next on last page", () => {
        const el = Pagination({ current: 5, total: 50, pageSize: 10 });
        const btns = el.querySelectorAll(".smart-pagination-btn");
        const nextBtn = btns[btns.length - 1];
        expect(nextBtn.disabled).toBe(true);
    });

    it("should mark active page", () => {
        const el = Pagination({ current: 3, total: 50 });
        const active = el.querySelector(".smart-pagination-active");
        expect(active).not.toBeNull();
        expect(active.innerText).toBe("3");
    });

    it("should set aria-current on active page", () => {
        const el = Pagination({ current: 2, total: 50 });
        const active = el.querySelector(".smart-pagination-active");
        expect(active.getAttribute("aria-current")).toBe("page");
    });

    it("should show ellipsis for large page counts", () => {
        const el = Pagination({ current: 10, total: 500 });
        // With current=10 and total=50 pages (500/10), should show ellipsis
        const ellipsis = el.querySelectorAll(".smart-pagination-ellipsis");
        expect(ellipsis.length).toBeGreaterThan(0);
    });

    it("should show info text", () => {
        const el = Pagination({ current: 2, total: 50 });
        const info = el.querySelector(".smart-pagination-info");
        expect(info).not.toBeNull();
        expect(info.innerText).toContain("of 50");
    });

    it("should trigger onChange on page click", () => {
        let page = 0;
        const el = Pagination({
            current: 1,
            total: 50,
            onChange: (p) => { page = p; }
        });
        const btns = el.querySelectorAll(".smart-pagination-btn");
        // Click page 2
        for (const btn of btns) {
            if (btn.innerText === "2") {
                btn.click();
                break;
            }
        }
        expect(page).toBe(2);
    });

    it("should show 0-0 of 0 info when total is 0", () => {
        const el = Pagination({ current: 1, total: 0 });
        const info = el.querySelector(".smart-pagination-info");
        expect(info.innerText).toBe("0–0 of 0");
    });

    it("should handle total=1", () => {
        const el = Pagination({ current: 1, total: 1 });
        const btns = el.querySelectorAll(".smart-pagination-btn");
        // Should have prev + 1 page + next = 3 buttons
        expect(btns.length).toBe(3);
    });

});


describe("EmptyState", () => {

    it("should create a div element", () => {
        const el = EmptyState({ title: "No items" });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-empty-state");
    });

    it("should render title", () => {
        const el = EmptyState({ title: "No data found" });
        const titleEl = el.querySelector(".smart-empty-state-title");
        expect(titleEl.innerText).toBe("No data found");
    });

    it("should render description", () => {
        const el = EmptyState({
            title: "Empty",
            description: "There are no items to display"
        });
        const descEl = el.querySelector(".smart-empty-state-description");
        expect(descEl.innerText).toBe("There are no items to display");
    });

    it("should render icon", () => {
        const el = EmptyState({ title: "Empty", icon: "📦" });
        const iconEl = el.querySelector(".smart-empty-state-icon");
        expect(iconEl.innerText).toBe("📦");
    });

    it("should render action button", () => {
        const el = EmptyState({
            title: "Empty",
            actionText: "Add Item"
        });
        const action = el.querySelector(".smart-empty-state-action");
        expect(action).not.toBeNull();
        expect(action.innerText).toBe("Add Item");
    });

    it("should trigger onAction on click", () => {
        let clicked = false;
        const el = EmptyState({
            title: "Empty",
            actionText: "Retry",
            onAction: () => { clicked = true; }
        });
        const action = el.querySelector(".smart-empty-state-action");
        action.click();
        expect(clicked).toBe(true);
    });

    it("should not render description when not provided", () => {
        const el = EmptyState({ title: "Empty" });
        const descEl = el.querySelector(".smart-empty-state-description");
        expect(descEl).toBeNull();
    });

    it("should not render action button when no actionText", () => {
        const el = EmptyState({ title: "Empty" });
        const action = el.querySelector(".smart-empty-state-action");
        expect(action).toBeNull();
    });

});


describe("Skeleton", () => {

    it("should create a wrapper div", () => {
        const el = Skeleton({ variant: "text" });
        expect(el.tagName).toBe("DIV");
        expect(el.className).toContain("smart-skeleton-wrapper");
    });

    it("should render skeleton elements with correct variant class", () => {
        const el = Skeleton({ variant: "title" });
        const skeleton = el.querySelector(".smart-skeleton");
        expect(skeleton).not.toBeNull();
        expect(skeleton.className).toContain("smart-skeleton-title");
    });

    it("should have aria-hidden=true", () => {
        const el = Skeleton({ variant: "text" });
        const skeleton = el.querySelector(".smart-skeleton");
        expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    });

    it("should render multiple items with count prop", () => {
        const el = Skeleton({ variant: "text", count: 3 });
        const items = el.querySelectorAll(".smart-skeleton");
        expect(items.length).toBe(3);
    });

    it("should default count to 1", () => {
        const el = Skeleton({ variant: "text" });
        const items = el.querySelectorAll(".smart-skeleton");
        expect(items.length).toBe(1);
    });

    it("should render avatar variant", () => {
        const el = Skeleton({ variant: "avatar" });
        const skeleton = el.querySelector(".smart-skeleton");
        expect(skeleton.className).toContain("smart-skeleton-avatar");
    });

    it("should render card variant with sub-elements", () => {
        const el = Skeleton({ variant: "card" });
        const imageBlock = el.querySelector(".smart-skeleton-card-image");
        const textBlock = el.querySelector(".smart-skeleton-card-text");
        expect(imageBlock).not.toBeNull();
        expect(textBlock).not.toBeNull();
    });

    it("should render table-row variant with cells", () => {
        const el = Skeleton({ variant: "table-row" });
        const cells = el.querySelectorAll(".smart-skeleton-table-cell");
        expect(cells.length).toBe(4);
    });

    it("should apply custom width via prop", () => {
        const el = Skeleton({ variant: "text", width: "200px" });
        const skeleton = el.querySelector(".smart-skeleton");
        expect(skeleton.style.width).toBe("200px");
    });

    it("should apply custom height via prop", () => {
        const el = Skeleton({ variant: "text", height: 40 });
        const skeleton = el.querySelector(".smart-skeleton");
        expect(skeleton.style.height).toBe("40px");
    });

    it("should render text variant by default", () => {
        const el = Skeleton({});
        const skeleton = el.querySelector(".smart-skeleton");
        expect(skeleton.className).toContain("smart-skeleton-text");
    });

});
