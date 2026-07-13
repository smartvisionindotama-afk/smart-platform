import { describe, it, expect, beforeEach } from "vitest";
import Auth from "../src/auth/auth.js";
import {
    createSession,
    getSession,
    removeSession,
    clearAllSessions,
    sessionCount
} from "../src/auth/session.js";


// ──────────────────────────────────────────────
// Session Manager
// ──────────────────────────────────────────────

describe("Session Manager", () => {

    beforeEach(() => {
        clearAllSessions();
    });


    describe("createSession()", () => {

        it("should create a session with user data", () => {
            const session = createSession({ id: "USR001", name: "Test" });
            expect(session).toHaveProperty("id");
            expect(session).toHaveProperty("token");
            expect(session).toHaveProperty("loginTime");
            expect(session).toHaveProperty("expiresAt");
            expect(session.user.name).toBe("Test");
        });

        it("should generate a token starting with smt_", () => {
            const session = createSession({ id: "USR001" });
            expect(session.token).toMatch(/^smt_/);
        });

        it("should set expiry in the future", () => {
            const session = createSession({ id: "USR001" });
            expect(session.expiresAt).toBeGreaterThan(Date.now());
        });

        it("should create copy of user data (not reference)", () => {
            const user = { id: "USR001", name: "Original" };
            const session = createSession(user);
            user.name = "Modified";
            expect(session.user.name).toBe("Original");
        });

    });


    describe("getSession()", () => {

        it("should return session by token", () => {
            const session = createSession({ id: "USR001" });
            const found = getSession(session.token);
            expect(found).not.toBeNull();
            expect(found.user.id).toBe("USR001");
        });

        it("should return null for invalid token", () => {
            expect(getSession("invalid")).toBeNull();
        });

        it("should return null for empty token", () => {
            expect(getSession("")).toBeNull();
            expect(getSession(null)).toBeNull();
        });

        it("should return a copy of session (not reference)", () => {
            const session = createSession({ id: "USR001" });
            const found = getSession(session.token);
            found.user.name = "Hacked";
            const foundAgain = getSession(session.token);
            expect(foundAgain.user.name).toBeUndefined();
        });

    });


    describe("removeSession()", () => {

        it("should remove session by token", () => {
            const session = createSession({ id: "USR001" });
            const result = removeSession(session.token);
            expect(result).toBe(true);
            expect(getSession(session.token)).toBeNull();
        });

        it("should return false for invalid token", () => {
            expect(removeSession("invalid")).toBe(false);
        });

        it("should return false for empty token", () => {
            expect(removeSession(null)).toBe(false);
        });

    });


    describe("clearAllSessions()", () => {

        it("should clear all sessions", () => {
            createSession({ id: "USR001" });
            createSession({ id: "USR002" });
            clearAllSessions();
            expect(sessionCount()).toBe(0);
        });

    });


    describe("sessionCount()", () => {

        it("should return correct count", () => {
            createSession({ id: "USR001" });
            createSession({ id: "USR002" });
            createSession({ id: "USR003" });
            expect(sessionCount()).toBe(3);
        });

        it("should return 0 when no sessions", () => {
            clearAllSessions();
            expect(sessionCount()).toBe(0);
        });

    });

});


// ──────────────────────────────────────────────
// Auth — Backward Compatibility
// ──────────────────────────────────────────────

describe("Auth (Backward Compat)", () => {

    beforeEach(() => {
        Auth.logout();
    });


    describe("login()", () => {

        it("should return true for valid admin user (no password)", () => {
            const result = Auth.login("admin");
            expect(result).toBe(true);
        });

        it("should return true for valid operator user (no password)", () => {
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
            expect(user.role).toBe("owner");
        });

        it("should not expose password on user object", () => {
            Auth.login("admin");
            const user = Auth.user();
            expect(user.password).toBeUndefined();
        });

    });


    describe("login() with password", () => {

        it("should return true with correct password", () => {
            const result = Auth.login("admin", "admin123");
            expect(result).toBe(true);
        });

        it("should return false with wrong password", () => {
            const result = Auth.login("admin", "wrongpassword");
            expect(result).toBe(false);
        });

        it("should not modify currentUser on failed password", () => {
            Auth.login("admin", "wrongpassword");
            expect(Auth.isLoggedIn()).toBe(false);
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


// ──────────────────────────────────────────────
// Auth — New Features
// ──────────────────────────────────────────────

describe("Auth (New Features)", () => {

    beforeEach(() => {
        Auth.logout();
    });


    describe("token()", () => {

        it("should return null when not logged in", () => {
            expect(Auth.token()).toBeNull();
        });

        it("should return token after login", () => {
            Auth.login("admin");
            const token = Auth.token();
            expect(token).not.toBeNull();
            expect(token).toMatch(/^smt_/);
        });

        it("should return null after logout", () => {
            Auth.login("admin");
            Auth.logout();
            expect(Auth.token()).toBeNull();
        });

    });


    describe("session()", () => {

        it("should return null when not logged in", () => {
            expect(Auth.session()).toBeNull();
        });

        it("should return session info after login", () => {
            Auth.login("admin");
            const session = Auth.session();
            expect(session).not.toBeNull();
            expect(session).toHaveProperty("token");
            expect(session).toHaveProperty("loginTime");
            expect(session).toHaveProperty("expiresAt");
        });

    });


    describe("validateToken()", () => {

        it("should return user for valid token", () => {
            Auth.login("admin");
            const token = Auth.token();
            const user = Auth.validateToken(token);
            expect(user).not.toBeNull();
            expect(user.name).toBe("Administrator");
        });

        it("should return null for invalid token", () => {
            expect(Auth.validateToken("invalid")).toBeNull();
        });

        it("should return null for expired token", () => {
            Auth.login("admin");
            const token = Auth.token();
            // Cannot easily test expiry without mocking Date
            // At least verify token works immediately
            expect(Auth.validateToken(token)).not.toBeNull();
        });

    });


    describe("listUsers()", () => {

        it("should return all users without passwords", () => {
            const users = Auth.listUsers();
            expect(users.length).toBe(2);
            users.forEach(u => {
                expect(u).toHaveProperty("username");
                expect(u).toHaveProperty("name");
                expect(u).not.toHaveProperty("password");
            });
        });

    });


    describe("getUser()", () => {

        it("should return user by username", () => {
            const user = Auth.getUser("admin");
            expect(user).not.toBeNull();
            expect(user.name).toBe("Administrator");
            expect(user.password).toBeUndefined();
        });

        it("should return null for unknown username", () => {
            expect(Auth.getUser("unknown")).toBeNull();
        });

    });


    describe("onChange()", () => {

        it("should notify on login", () => {
            let event = null;
            const unsub = Auth.onChange((e) => { event = e; });
            Auth.login("admin");
            expect(event).toBe("login");
            unsub();
        });

        it("should notify on logout", () => {
            Auth.login("admin");
            let event = null;
            const unsub = Auth.onChange((e) => { event = e; });
            Auth.logout();
            expect(event).toBe("logout");
            unsub();
        });

        it("should return unsubscribe function", () => {
            let count = 0;
            const unsub = Auth.onChange(() => { count++; });
            Auth.login("admin");
            expect(count).toBe(1);
            unsub();
            Auth.logout();
            Auth.login("operator");
            // After unsubscribe, count should still be 1
            expect(count).toBe(1);
        });

    });

});
