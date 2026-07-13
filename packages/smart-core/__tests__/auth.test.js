import { describe, it, expect, beforeEach } from "vitest";
import Auth from "../src/auth/auth.js";


describe("Auth", () => {

    beforeEach(() => {
        Auth.logout();
    });


    describe("login()", () => {

        it("should return true for valid admin user", () => {
            const result = Auth.login("admin");
            expect(result).toBe(true);
        });


        it("should return true for valid operator user", () => {
            const result = Auth.login("operator");
            expect(result).toBe(true);
        });


        it("should return false for invalid username", () => {
            const result = Auth.login("nonexistent");
            expect(result).toBe(false);
        });


        it("should set currentUser on successful login", () => {
            Auth.login("admin");
            const user = Auth.user();
            expect(user).not.toBeNull();
            expect(user.id).toBe("USR001");
            expect(user.name).toBe("Administrator");
            expect(user.email).toBe("admin@smart.id");
            expect(user.role).toBe("owner");
        });

    });


    describe("user()", () => {

        it("should return null when not logged in", () => {
            expect(Auth.user()).toBeNull();
        });


        it("should return user object after login", () => {
            Auth.login("operator");
            const user = Auth.user();
            expect(user).toBeDefined();
            expect(user.name).toBe("Operator Gudang");
        });

    });


    describe("isLoggedIn()", () => {

        it("should return false when not logged in", () => {
            expect(Auth.isLoggedIn()).toBe(false);
        });


        it("should return true after login", () => {
            Auth.login("admin");
            expect(Auth.isLoggedIn()).toBe(true);
        });


        it("should return false after logout", () => {
            Auth.login("admin");
            Auth.logout();
            expect(Auth.isLoggedIn()).toBe(false);
        });

    });


    describe("logout()", () => {

        it("should clear currentUser", () => {
            Auth.login("admin");
            Auth.logout();
            expect(Auth.user()).toBeNull();
        });

    });

});
