/**
 * Cache — in-memory TTL-based cache.
 *
 * Each entry has a configurable TTL (time-to-live).
 * Expired entries are treated as cache misses on read.
 * Manual invalidation via remove() and clear().
 */


const stores = new Map();


/**
 * Create or retrieve a named cache store.
 *
 * @param {string} name Optional store name (default: "default")
 * @returns {object} Cache API
 */
export function createCache(name = "default") {

    if (stores.has(name)) {

        return stores.get(name);

    }


    const entries = new Map();


    const api = {

        /**
         * Get a cached value.
         *
         * @param {string} key
         * @returns {*|null} Cached data or null if missing/expired
         */
        get(key) {

            const entry = entries.get(key);

            if (!entry) return null;


            if (isExpired(entry)) {

                entries.delete(key);

                return null;

            }


            return entry.data;

        },


        /**
         * Set a cached value with TTL.
         *
         * @param {string} key
         * @param {*} data
         * @param {number} ttlMs TTL in ms (default: 60000)
         */
        set(key, data, ttlMs = 60000) {

            entries.set(key, {

                data,

                createdAt: Date.now(),

                ttl: ttlMs

            });

        },


        /**
         * Check if a key exists and is not expired.
         *
         * @param {string} key
         * @returns {boolean}
         */
        has(key) {

            const entry = entries.get(key);

            if (!entry) return false;


            if (isExpired(entry)) {

                entries.delete(key);

                return false;

            }


            return true;

        },


        /**
         * Remove a single entry.
         *
         * @param {string} key
         */
        remove(key) {

            entries.delete(key);

        },


        /**
         * Remove all entries from this store.
         */
        clear() {

            entries.clear();

        },


        /**
         * Get the number of entries in this store.
         *
         * @returns {number}
         */
        size() {

            return entries.size;

        }

    };


    stores.set(name, api);


    return api;

}


/**
 * Check if a cache entry is expired.
 *
 * @param {object} entry
 * @returns {boolean}
 */
function isExpired(entry) {

    return Date.now() > entry.createdAt + entry.ttl;

}


/**
 * Clear all cache stores.
 */
export function clearAllCaches() {

    stores.clear();

}
