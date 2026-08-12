import { describe, it, expect } from "vitest";
import {
    hashPassword,
    verifyPassword,
    isBcryptHash,
    isPlainPassword,
    hashPasswordIfPlain
} from "../src/password.js";

describe("password (bcrypt)", () => {
    it("hash menghasilkan string bcrypt", async () => {
        const hash = await hashPassword("secret123", 4);
        expect(typeof hash).toBe("string");
        expect(isBcryptHash(hash)).toBe(true);
    });

    it("verifyPassword cocok untuk password benar", async () => {
        const hash = await hashPassword("admin123", 4);
        expect(await verifyPassword("admin123", hash)).toBe(true);
    });

    it("verifyPassword menolak password salah", async () => {
        const hash = await hashPassword("admin123", 4);
        expect(await verifyPassword("wrong", hash)).toBe(false);
    });

    it("verifyPassword aman untuk hash non-bcrypt / kosong (tidak crash)", async () => {
        expect(await verifyPassword("x", "plaintext")).toBe(false);
        expect(await verifyPassword("x", "")).toBe(false);
        expect(await verifyPassword("", "")).toBe(false);
        expect(await verifyPassword(null, null)).toBe(false);
    });

    it("isPlainPassword mendeteksi plaintext & isBcryptHash mendeteksi hash", () => {
        expect(isPlainPassword("admin123")).toBe(true);
        expect(isPlainPassword("$2b$10$abcdefghijklmnopqrstuv")).toBe(false);
        expect(isBcryptHash("$2a$10$xyz")).toBe(true);
        expect(isBcryptHash("$2b$10$xyz")).toBe(true);
        expect(isBcryptHash("plain")).toBe(false);
    });

    it("hashPasswordIfPlain memigrasikan plaintext dan membiarkan hash", async () => {
        const migrated = await hashPasswordIfPlain("admin123", 4);
        expect(isBcryptHash(migrated)).toBe(true);
        expect(await verifyPassword("admin123", migrated)).toBe(true);

        const unchanged = await hashPasswordIfPlain("$2b$10$abc", 4);
        expect(unchanged).toBe("$2b$10$abc");
    });
});
