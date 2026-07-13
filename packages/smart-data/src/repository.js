/**
 * Repository — combines API resource, state management, caching, and pagination.
 *
 * Provides a unified API for data access with automatic state transitions,
 * cache integration, and pagination support.
 *
 * @example
 *   const barangResource = new BarangResource(apiClient);
 *   const repo = new Repository(barangResource, {
 *       cache: createCache("barang"),
 *       pagination: createPagination({ limit: 10 })
 *   });
 *
 *   await repo.fetchAll({ page: 1 });
 *   repo.state.data       // loaded items
 *   repo.state.loading    // false
 *   repo.state.error      // null if ok
 *   repo.state.pagination // { page, limit, total, ... }
 */

import { createDataState } from "./state.js";


export class Repository {


    /**
     * @param {object} resource BaseResource instance
     * @param {object} options
     * @param {object} options.cache       Cache instance (optional)
     * @param {object} options.pagination  Pagination instance (optional)
     * @param {number} options.cacheTtl    Cache TTL in ms (default: 60000)
     */
    constructor(resource, options = {}) {

        this.resource = resource;

        this.state = createDataState();

        this.cache = options.cache || null;

        this.pagination = options.pagination || null;

        this.cacheTtl = options.cacheTtl || 60000;

    }



    // ── Queries ──


    /**
     * Fetch a list of resources.
     *
     * Supports caching and pagination.
     *
     * @param {object} params Query parameters
     * @returns {Promise<object>} Current state snapshot
     */
    async fetchAll(params = {}) {

        const cacheKey = buildCacheKey(
            this.resource.endpoint,
            params
        );


        // Check cache first
        if (this.cache) {

            const cached = this.cache.get(cacheKey);

            if (cached) {

                const pagination = this.pagination
                    ? this.pagination.getMeta()
                    : null;


                this.state.setData(
                    cached,
                    pagination
                );


                return this.state.getState();

            }

        }


        this.state.startLoading(
            this.state.getState().data !== null
        );


        try {

            // Only pass page and limit from pagination (not calculated fields)
            const paginationMeta = this.pagination
                ? this.pagination.getMeta()
                : null;

            const paginationParams = paginationMeta
                ? { page: paginationMeta.page, limit: paginationMeta.limit }
                : {};

            const mergedParams = {
                ...paginationParams,
                ...params
            };


            const result = await this.resource.list(
                mergedParams
            );


            const pagination = this.pagination
                ? this.pagination.getMeta()
                : null;


            // Cache the result
            if (this.cache) {

                this.cache.set(
                    cacheKey,
                    result,
                    this.cacheTtl
                );

            }


            this.state.setData(result, pagination);


            return this.state.getState();

        } catch (error) {

            this.state.setError(
                error,
                this.state.getState().data !== null
            );


            return this.state.getState();

        }

    }


    /**
     * Fetch a single resource by ID.
     *
     * @param {string|number} id
     * @returns {Promise<object>} Current state snapshot
     */
    async fetchById(id) {

        const cacheKey = `${this.resource.endpoint}/${id}`;


        // Check cache
        if (this.cache) {

            const cached = this.cache.get(cacheKey);

            if (cached) {

                this.state.setData(cached);

                return this.state.getState();

            }

        }


        this.state.startLoading();


        try {

            const result = await this.resource.get(id);


            if (this.cache) {

                this.cache.set(
                    cacheKey,
                    result,
                    this.cacheTtl
                );

            }


            this.state.setData(result);


            return this.state.getState();

        } catch (error) {

            this.state.setError(error);

            return this.state.getState();

        }

    }


    /**
     * Create a new resource.
     *
     * Invalidates list cache on success.
     *
     * @param {object} data
     * @returns {Promise<object>} Current state snapshot
     */
    async create(data) {

        this.state.startLoading();


        try {

            const result = await this.resource.create(data);


            this.invalidateListCache();


            if (this.pagination) {

                this.pagination.updateMeta({ total: 0 });

                this.pagination.reset();

            }


            this.state.setData(result);


            return this.state.getState();

        } catch (error) {

            this.state.setError(error);

            return this.state.getState();

        }

    }


    /**
     * Update an existing resource.
     *
     * Invalidates both get and list caches on success.
     *
     * @param {string|number} id
     * @param {object} data
     * @returns {Promise<object>} Current state snapshot
     */
    async update(id, data) {

        this.state.startLoading(
            this.state.getState().data !== null
        );


        try {

            const result = await this.resource.update(
                id,
                data
            );


            // Invalidate caches
            this.invalidateSingleCache(id);

            this.invalidateListCache();


            this.state.setData(result);


            return this.state.getState();

        } catch (error) {

            this.state.setError(
                error,
                this.state.getState().data !== null
            );


            return this.state.getState();

        }

    }


    /**
     * Delete a resource.
     *
     * Invalidates both get and list caches on success.
     *
     * @param {string|number} id
     * @returns {Promise<object>} Current state snapshot
     */
    async delete(id) {

        this.state.startLoading(
            this.state.getState().data !== null
        );


        try {

            await this.resource.delete(id);


            // Invalidate caches
            this.invalidateSingleCache(id);

            this.invalidateListCache();


            if (this.pagination) {

                this.pagination.updateMeta({ total: 0 });

            }


            this.state.setData(null);


            return this.state.getState();

        } catch (error) {

            this.state.setError(
                error,
                this.state.getState().data !== null
            );


            return this.state.getState();

        }

    }



    // ── Cache Invalidation ──


    /**
     * Invalidate all list caches for this resource.
     *
     * Clears the entire cache store to ensure stale list data
     * is not served after mutations.
     */
    invalidateListCache() {

        if (!this.cache) return;


        this.cache.clear();

    }


    /**
     * Invalidate a single-item cache.
     *
     * @param {string|number} id
     */
    invalidateSingleCache(id) {

        if (!this.cache) return;


        this.cache.remove(
            `${this.resource.endpoint}/${id}`
        );

    }


    /**
     * Reset the repository state.
     */
    reset() {

        this.state.reset();

        if (this.pagination) {

            this.pagination.reset();

        }

    }

}


/**
 * Build a cache key from an endpoint and params.
 *
 * @param {string} endpoint
 * @param {object} params
 * @returns {string}
 */
function buildCacheKey(endpoint, params = {}) {

    const paramKeys = Object.keys(params).sort();

    const paramStr = paramKeys

        .map(k => `${k}=${params[k]}`)

        .join("&");


    return paramStr

        ? `${endpoint}?${paramStr}`

        : endpoint;

}
