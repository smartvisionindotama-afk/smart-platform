/**
 * Persistence Helper — localStorage-backed in-memory store.
 *
 * Ensures data survives page refresh by saving to localStorage
 * after every mutation. Seed data is only used on first-ever load.
 *
 * Usage:
 *   const store = createStore("my-key", () => seedData);
 *   store.data     // get current data (mutable array)
 *   store.save()   // persist to localStorage
 *   store.reset()  // reset to seed data
 *
 * @module @smart/data/persistence
 */

const STORAGE_PREFIX = "smart_";

/**
 * Create a persisted store backed by localStorage.
 *
 * @param {string} key        Unique storage key (e.g. "companies")
 * @param {Function} seedFn   Factory function returning default seed data
 * @param {object} [options]
 * @param {string} [options.prefix] Storage key prefix (default: "smart_")
 * @returns {{ data: any[], save: Function, reset: Function }}
 */
export function createStore(key, seedFn, options = {}) {
    const prefix = options.prefix || STORAGE_PREFIX;
    const storageKey = prefix + key;
    let data;

    function load() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                data = JSON.parse(raw);
                return;
            }
        } catch {
            // Corrupted data — fall through to seed
            console.warn(`Persistence: corrupted data for "${key}", resetting to seed`);
        }
        // First load or corrupted — use seed
        data = seedFn();
        save();
    }

    function save() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn(`Persistence: failed to save "${key}"`, e);
        }
    }

    function reset() {
        data = seedFn();
        save();
    }

    // Initialize
    load();

    return { data, save, reset };
}
