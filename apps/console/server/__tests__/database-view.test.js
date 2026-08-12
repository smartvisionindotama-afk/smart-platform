import { describe, it, expect } from "vitest";
import {
    detectType,
    formatValue,
    unionFields,
    buildNode,
    renderDocTree,
    formatNumber,
    buildFilterQuery
} from "../../src/pages/deployment/database.js";

/**
 * SP-027 M5-FIX — Database Explorer UI unit test.
 *
 * Menguji pure functions (tanpa DOM/network):
 *  - detectType / formatValue (tipe & preview nilai)
 *  - unionFields (kolom preview dokumen)
 *  - buildNode / renderDocTree (tree nested object + array)
 *  - formatNumber
 *  - buildFilterQuery (filter key-value sederhana — tanpa arbitrary query)
 */

describe("detectType — deteksi tipe nilai MongoDB", () => {
    it("ObjectId dari string 24-hex", () => {
        expect(detectType("67a8123456789abcdef01234")).toBe("ObjectId");
        expect(detectType("67A8123456789ABCDEF01234")).toBe("ObjectId");
        // bukan ObjectId: panjang ≠ 24 atau bukan hex
        expect(detectType("67a8123456789abcdef0123")).toBe("String");
        expect(detectType("67a8123456789abcdef0123g")).toBe("String");
    });

    it("Date dari string ISO", () => {
        expect(detectType("2026-08-08T17:20:00.000Z")).toBe("Date");
        expect(detectType("2026-08-08T17:20:00")).toBe("Date");
    });

    it("primitif", () => {
        expect(detectType(15000)).toBe("Number");
        expect(detectType(true)).toBe("Boolean");
        expect(detectType("Produk A")).toBe("String");
        expect(detectType(null)).toBe("Null");
    });

    it("komposit", () => {
        expect(detectType([1, 2, 3])).toBe("Array");
        expect(detectType({ a: 1 })).toBe("Object");
        expect(detectType([])).toBe("Array");
    });
});

describe("formatValue — preview nilai", () => {
    it("menjaga tipe terlihat (array/object diberi label)", () => {
        expect(formatValue([1, 2, 3])).toBe("Array[3]");
        expect(formatValue({ a: 1 })).toBe("Object");
    });

    it("truncate string panjang", () => {
        const long = "x".repeat(200);
        expect(formatValue(long).length).toBeLessThanOrEqual(70);
        expect(formatValue(long)).toContain("…");
    });

    it("null/undefined", () => {
        expect(formatValue(null)).toBe("null");
        expect(formatValue(undefined)).toBe("undefined");
    });
});

describe("unionFields — kolom preview dokumen", () => {
    it("_id selalu didahulukan, urut frekuensi", () => {
        const docs = [
            { _id: 1, name: "A", price: 10 },
            { _id: 2, name: "B", price: 20, stock: 5 }
        ];
        const fields = unionFields(docs, 6);
        expect(fields[0]).toBe("_id");
        expect(fields).toContain("name");
        expect(fields).toContain("price");
    });

    it("dibatasi max kolom", () => {
        const docs = [{ _id: 1, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }];
        expect(unionFields(docs, 4).length).toBe(4);
    });

    it("dokumen kosong → [_id] (fallback aman)", () => {
        expect(unionFields([])).toEqual(["_id"]);
        expect(unionFields(null)).toEqual(["_id"]);
    });
});

describe("buildNode / renderDocTree — nested object & array", () => {
    it("primitive → leaf node tanpa children", () => {
        const node = buildNode("name", "Produk A");
        expect(node.type).toBe("String");
        expect(node.children).toBeNull();
    });

    it("object → children dari tiap field", () => {
        const node = buildNode("metadata", { sku: "PRD-001", unit: "pcs", stock: 120 });
        expect(node.type).toBe("Object");
        expect(node.children).toHaveLength(3);
        expect(node.children[0].key).toBe("sku");
        expect(node.children[0].value).toBe("PRD-001");
    });

    it("array of primitives → children ber-index [0], [1]...", () => {
        const node = buildNode("permissions", ["admin", "manager", "user"]);
        expect(node.type).toBe("Array");
        expect(node.children.map(c => c.key)).toEqual(["[0]", "[1]", "[2]"]);
        expect(node.children[1].value).toBe("manager");
    });

    it("array of objects → children object tersarang (struktur dipertahankan)", () => {
        const node = buildNode("items", [
            { productId: "P1", quantity: 2 },
            { productId: "P2", quantity: 1 }
        ]);
        expect(node.children).toHaveLength(2);
        expect(node.children[0].type).toBe("Object");
        expect(node.children[0].children.find(c => c.key === "quantity").value).toBe("2");
    });

    it("renderDocTree menghasilkan HTML details/summary tanpa flattening", () => {
        const doc = {
            _id: "67a8123456789abcdef01234",
            name: "Produk A",
            metadata: { sku: "PRD-001", stock: 120 },
            tags: ["fresh", "import"]
        };
        const html = renderDocTree(doc);
        expect(html).toContain("details");
        expect(html).toContain("metadata");
        expect(html).toContain("PRD-001");
        expect(html).toContain("[0]");
        expect(html).toContain("ObjectId");
    });

    it("nilai user-controlled di-escape (anti XSS)", () => {
        const doc = { name: "<script>alert(1)</script>", meta: { x: "\"><img src=x onerror=alert(1)>" } };
        const html = renderDocTree(doc);
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;script&gt;");
    });
});

describe("formatNumber — angka besar", () => {
    it("ribuan/jutaan/miliaran", () => {
        expect(formatNumber(12431)).toBe("12.4K");
        expect(formatNumber(2000000)).toBe("2.0M");
        expect(formatNumber(1500000000)).toBe("1.5B");
        expect(formatNumber(42)).toBe("42");
    });

    it("null/undefined/NaN → —", () => {
        expect(formatNumber(null)).toBe("—");
        expect(formatNumber(undefined)).toBe("—");
    });
});

describe("buildFilterQuery — filter key-value sederhana", () => {
    it("membangun JSON query dari field+value", () => {
        expect(buildFilterQuery("status", "active")).toBe('{"status":"active"}');
    });

    it("trim whitespace di field & value", () => {
        expect(buildFilterQuery("  status ", "  active ")).toBe('{"status":"active"}');
    });

    it("field atau value kosong → '' (tanpa query)", () => {
        expect(buildFilterQuery("", "active")).toBe("");
        expect(buildFilterQuery("status", "")).toBe("");
        expect(buildFilterQuery(undefined, undefined)).toBe("");
    });

    it("field berisi karakter berbahaya tetap dikirim sebagai key biasa — backend yang memvalidasi", () => {
        // UI hanya membentuk JSON; keamanan operator query ($where dll) ditangani backend.
        expect(buildFilterQuery("$where", "1")).toBe('{"$where":"1"}');
    });
});
