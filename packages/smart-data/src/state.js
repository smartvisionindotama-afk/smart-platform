/**
 * DataState — reactive data state container.
 *
 * Manages loading, error, and data states for async data fetching.
 * Supports subscription-based reactivity for UI updates.
 *
 * State shape:
 *   { data, loading, error, pagination, timestamp }
 */


/**
 * Create a new DataState instance.
 *
 * @returns {object} DataState API
 */
export function createDataState() {

    let state = {

        data: null,

        loading: false,

        error: null,

        pagination: null,

        timestamp: null

    };


    const listeners = [];


    /**
     * Get a snapshot of the current state.
     *
     * @returns {object}
     */
    function getState() {

        return { ...state };

    }


    /**
     * Set the state to loading.
     *
     * Optionally preserves existing data (for refresh scenarios).
     *
     * @param {boolean} preserveData Keep existing data during reload
     */
    function startLoading(preserveData = false) {

        state = {

            data: preserveData
                ? state.data
                : null,

            loading: true,

            error: null,

            pagination: preserveData
                ? state.pagination
                : null,

            timestamp: state.timestamp

        };


        notify();

    }


    /**
     * Set data after successful fetch.
     *
     * @param {*} data     The loaded data
     * @param {object} pagination Optional pagination meta
     */
    function setData(data, pagination = null) {

        state = {

            data,

            loading: false,

            error: null,

            pagination: pagination
                ? { ...pagination }
                : null,

            timestamp: Date.now()

        };


        notify();

    }


    /**
     * Set error after failed fetch.
     *
     * Optionally preserves existing data (for background refresh errors).
     *
     * @param {Error} error
     * @param {boolean} preserveData Keep existing data on error
     */
    function setError(error, preserveData = false) {

        state = {

            data: preserveData
                ? state.data
                : null,

            loading: false,

            error,

            pagination: state.pagination,

            timestamp: state.timestamp

        };


        notify();

    }


    /**
     * Reset state to initial values.
     */
    function reset() {

        state = {

            data: null,

            loading: false,

            error: null,

            pagination: null,

            timestamp: null

        };


        notify();

    }


    /**
     * Subscribe to state changes.
     *
     * @param {function} callback Receives the new state
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


    /**
     * Notify all subscribers.
     */
    function notify() {

        const snapshot = { ...state };

        listeners.forEach(fn => {

            try {

                fn(snapshot);

            } catch (e) {

                console.warn(

                    "DataState subscriber error:",

                    e

                );

            }

        });

    }


    return {
        getState,
        startLoading,
        setData,
        setError,
        reset,
        onChange
    };

}
