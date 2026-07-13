/**
 * Session Manager — in-memory session store.
 *
 * Manages authentication sessions with simple token-based identity.
 * Sessions are stored in memory (cleared on page refresh).
 */

const sessions = new Map();


let sessionIdCounter = 0;


/**
 * Create a new session for a user.
 *
 * Strips sensitive fields (password) from stored user data.
 *
 * @param {object} userData User object to store in session
 * @param {number} ttlMs Time-to-live in milliseconds (default: 24 hours)
 * @returns {object} Session object { id, token, user, loginTime, expiresAt }
 */
export function createSession(userData, ttlMs = 24 * 60 * 60 * 1000) {

    const id = ++sessionIdCounter;

    const token = generateToken();

    const loginTime = Date.now();

    const expiresAt = loginTime + ttlMs;


    // Strip sensitive data before storing
    const { password, ...safeUser } =
        userData || {};


    const session = {

        id,
        token,
        user: { ...safeUser },
        loginTime,
        expiresAt

    };


    sessions.set(id, session);

    sessions.set(token, session);


    return cloneSession(session);

}


/**
 * Get a session by token.
 *
 * @param {string} token
 * @returns {object|null} Session object or null if not found/expired
 */
export function getSession(token) {

    if (!token) return null;


    const session = sessions.get(token);

    if (!session) return null;


    // Check expiry
    if (Date.now() > session.expiresAt) {

        removeSession(token);

        return null;

    }


    return cloneSession(session);

}


/**
 * Remove a session by token.
 *
 * @param {string} token
 * @returns {boolean}
 */
export function removeSession(token) {

    if (!token) return false;


    const session = sessions.get(token);

    if (!session) return false;


    sessions.delete(session.id);

    sessions.delete(token);

    return true;

}


/**
 * Remove all sessions.
 */
export function clearAllSessions() {

    sessions.clear();

}


/**
 * Get the number of active sessions.
 *
 * @returns {number}
 */
export function sessionCount() {

    return sessions.size / 2; // Each session stored twice (id + token)

}


/**
 * Deep-clone a session object to prevent external mutation.
 *
 * @param {object} session
 * @returns {object}
 */
function cloneSession(session) {

    return {

        ...session,
        user: { ...session.user }

    };

}


/**
 * Generate a simple unique token.
 *
 * Format: "smt_" + random hex string
 * Not cryptographically secure — sufficient for internal SPA.
 *
 * @returns {string}
 */
function generateToken() {

    const hex = Array.from(

        { length: 32 },

        () => Math.floor(

            Math.random() * 16

        ).toString(16)

    ).join("");


    return `smt_${hex}`;

}
