/**
 * Base Resource — CRUD pattern wrapper for API endpoints.
 *
 * Provides standard list, get, create, update, delete methods
 * that can be extended by concrete resources.
 *
 * @example
 *   class BarangResource extends BaseResource {
 *       constructor(client) {
 *           super(client, "/barang");
 *       }
 *       async search(q) {
 *           return this.client.get("/barang/search", { params: { q } });
 *       }
 *   }
 */


export class BaseResource {


    /**
     * @param {object} client   API client instance (from createClient)
     * @param {string} endpoint Base endpoint path, e.g. "/users"
     */
    constructor(client, endpoint) {

        this.client = client;

        this.endpoint = endpoint;

    }


    /**
     * List resources with optional query params.
     *
     * @param {object} params Query parameters (page, limit, filters, etc.)
     * @returns {Promise<*>}
     */
    async list(params = {}) {

        return this.client.get(
            this.endpoint,
            { params }
        );

    }


    /**
     * Get a single resource by ID.
     *
     * @param {string|number} id
     * @returns {Promise<*>}
     */
    async get(id) {

        return this.client.get(
            `${this.endpoint}/${id}`
        );

    }


    /**
     * Create a new resource.
     *
     * @param {object} data
     * @returns {Promise<*>}
     */
    async create(data) {

        return this.client.post(
            this.endpoint,
            data
        );

    }


    /**
     * Update an existing resource (full replacement).
     *
     * @param {string|number} id
     * @param {object} data
     * @returns {Promise<*>}
     */
    async update(id, data) {

        return this.client.put(
            `${this.endpoint}/${id}`,
            data
        );

    }


    /**
     * Partially update a resource.
     *
     * @param {string|number} id
     * @param {object} data
     * @returns {Promise<*>}
     */
    async patch(id, data) {

        return this.client.patch(
            `${this.endpoint}/${id}`,
            data
        );

    }


    /**
     * Delete a resource.
     *
     * @param {string|number} id
     * @returns {Promise<*>}
     */
    async delete(id) {

        return this.client.delete(
            `${this.endpoint}/${id}`
        );

    }

}
