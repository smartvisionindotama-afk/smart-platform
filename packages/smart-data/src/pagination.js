/**
 * Pagination — page-based pagination handler.
 *
 * Manages page state, calculates meta (totalPages, hasNext, hasPrev),
 * and supports onChange subscription.
 *
 * State shape:
 *   { page, limit, total, totalPages, hasNext, hasPrev }
 */


/**
 * Create a new Pagination instance.
 *
 * @param {object} options
 * @param {number} options.page  Current page (default: 1)
 * @param {number} options.limit Items per page (default: 10)
 * @param {number} options.total Total items (default: 0)
 * @returns {object} Pagination API
 */
export function createPagination(options = {}) {

    let page = options.page || 1;

    let limit = options.limit || 10;

    let total = options.total || 0;


    const listeners = [];


    /**
     * Get pagination meta.
     *
     * @returns {object}
     */
    function getMeta() {

        const totalPages = Math.max(
            1,
            Math.ceil(total / Math.max(1, limit))
        );


        return {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        };

    }


    /**
     * Go to a specific page.
     *
     * @param {number} p
     */
    function goTo(p) {

        const totalPages = Math.max(
            1,
            Math.ceil(total / Math.max(1, limit))
        );


        const newPage = Math.max(
            1,
            Math.min(p, totalPages)
        );


        if (newPage !== page) {

            page = newPage;

            notify();

        }

    }


    /**
     * Go to the next page.
     */
    function next() {

        const meta = getMeta();

        if (meta.hasNext) {

            goTo(page + 1);

        }

    }


    /**
     * Go to the previous page.
     */
    function prev() {

        const meta = getMeta();

        if (meta.hasPrev) {

            goTo(page - 1);

        }

    }


    /**
     * Update pagination metadata (total count).
     *
     * @param {object} meta
     * @param {number} meta.total
     * @param {number} meta.limit
     */
    function updateMeta(meta = {}) {

        if (meta.total !== undefined) {

            total = meta.total;

        }


        if (meta.limit !== undefined) {

            limit = meta.limit;

        }


        notify();

    }


    /**
     * Reset to page 1.
     */
    function reset() {

        page = 1;

        total = 0;

        notify();

    }


    /**
     * Subscribe to pagination changes.
     *
     * @param {function} callback
     * @returns {function} Unsubscribe function
     */
    function onChange(callback) {

        listeners.push(callback);


        return () => {

            const index = listeners.indexOf(callback);

            if (index !== -1) {

                listeners.splice(index, 1);

            }

        };

    }


    function notify() {

        const meta = getMeta();

        listeners.forEach(fn => {

            try {

                fn(meta);

            } catch (e) {

                console.warn(

                    "Pagination subscriber error:",

                    e

                );

            }

        });

    }


    return {
        getMeta,
        goTo,
        next,
        prev,
        updateMeta,
        reset,
        onChange
    };

}
