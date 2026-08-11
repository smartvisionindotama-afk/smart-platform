/**
 * Activity Log Data Service.
 *
 * Fetches activity logs from the server API.
 * No local fallback — activity logs are server-only.
 *
 * @module inventory/data/activity-data
 */

import { apiCall } from "./api.js";

/**
 * Fetch activity logs with pagination.
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @returns {Promise<{data: Array, pagination: object}>}
 */
export async function listActivity({ page = 1, limit = 10 } = {}) {
    const result = await apiCall("GET", `/activity?page=${page}&limit=${limit}`);
    if (result) return result;
    return { data: [], pagination: { page: 1, limit, total: 0, totalPages: 1 } };
}
