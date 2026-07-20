/**
 * Authentication Manager.
 *
 * Manages user login/logout with session support.
 * Backward compatible with the original API.
 *
 * Changes from original:
 * - Added session support (token, expiry)
 * - Added password validation
 * - Added onChange subscribers
 * - Added login with user/password object
 */

import {
    createSession,
    getSession,
    removeSession
} from "./session.js";


const users = {

    admin: {

        id: "USR001",

        name: "Administrator",

        email: "admin@smart.id",

        institution: "PT-001",

        role: "owner",

        password: "admin123"

    },


    operator: {

        id: "USR002",

        name: "Operator Gudang",

        email: "operator@smart.id",

        institution: "PT-001",

        role: "operator",

        password: "operator123"

    },


};



class Auth {


    constructor() {

        this.currentUser = null;

        this._token = null;

        this._listeners = [];

    }



    // ── Authentication ──


    /**
     * Log in a user.
     *
     * Supports both original API (username only) and enhanced API
     * with password validation.
     *
     * @param {string} username
     * @param {string} [password]
     * @returns {boolean}
     */
    login(username, password) {

        const user = users[username];


        if (!user) {

            return false;

        }


        // Original API: login("admin") skips password check
        // Enhanced API: login("admin", "wrong") requires matching password
        if (arguments.length > 1) {

            if (password !== user.password) {

                return false;

            }

        }


        // Create session

        const session = createSession(user);


        this.currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            institution: user.institution,
            role: user.role
        };

        this._token = session.token;


        this._notify("login");


        return true;

    }


    /**
     * Log out the current user.
     */
    logout() {

        if (this._token) {

            removeSession(this._token);

        }


        this.currentUser = null;

        this._token = null;


        this._notify("logout");

    }


    /**
     * Check if a user is currently logged in.
     *
     * @returns {boolean}
     */
    isLoggedIn() {

        return this.currentUser !== null;

    }


    /**
     * Get the current user object.
     *
     * @returns {object|null}
     */
    user() {

        return this.currentUser;

    }


    /**
     * Get the current session token.
     *
     * @returns {string|null}
     */
    token() {

        return this._token;

    }


    /**
     * Get the current session info.
     *
     * @returns {object|null} { token, loginTime, expiresAt } or null
     */
    session() {

        if (!this._token) return null;


        const session = getSession(this._token);

        if (!session) return null;


        return {
            token: session.token,
            loginTime: session.loginTime,
            expiresAt: session.expiresAt
        };

    }


    /**
     * Validate a session token without logging in.
     *
     * @param {string} token
     * @returns {object|null} User object if valid, null otherwise
     */
    validateToken(token) {

        const session = getSession(token);

        if (!session) return null;


        return { ...session.user };

    }



    // ── User Management ──


    /**
     * List all registered users (without passwords).
     *
     * @returns {object[]}
     */
    listUsers() {

        return Object.entries(users).map(

            ([username, u]) => ({

                username,
                id: u.id,
                name: u.name,
                email: u.email,
                institution: u.institution,
                role: u.role

            })

        );

    }


    /**
     * Get user by username.
     *
     * @param {string} username
     * @returns {object|null} User without password
     */
    getUser(username) {

        const user = users[username];

        if (!user) return null;


        return {
            username,
            id: user.id,
            name: user.name,
            email: user.email,
            institution: user.institution,
            role: user.role
        };

    }






    // ── Subscriptions ──


    /**
     * Subscribe to auth state changes.
     *
     * @param {function} callback Receives event type: "login" | "logout"
     * @returns {function} Unsubscribe function
     */
    onChange(callback) {

        this._listeners.push(callback);


        return () => {

            const index =
                this._listeners.indexOf(callback);


            if (index !== -1) {

                this._listeners.splice(index, 1);

            }

        };

    }





    // ── Internal ──


    /**
     * Notify subscribers of auth state changes.
     *
     * @param {string} event "login" | "logout"
     */
    _notify(event) {

        this._listeners.forEach(fn => {

            try {

                fn(event);

            } catch (e) {

                console.warn(
                    "Auth subscriber error:",
                    e
                );

            }

        });

    }

}


export default new Auth();
