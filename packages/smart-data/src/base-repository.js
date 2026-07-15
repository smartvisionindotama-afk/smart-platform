/**
 * Base Repository — CRUD abstraction layer.
 *
 * Framework-level base class for repository pattern.
 * Provides a consistent interface for data access.
 * Each application repository extends BaseRepository with entity-specific logic.
 *
 * Designed to be swappable between in-memory, MongoDB, or REST API backends.
 *
 * @module @smart/data/base-repository
 */

/**
 * @typedef {object} PaginationParams
 * @property {number} [page=1]
 * @property {number} [limit=10]
 * @property {string} [search]
 */

/**
 * @typedef {object} PaginatedResult
 * @property {object[]} data
 * @property {object} pagination
 * @property {number} pagination.page
 * @property {number} pagination.limit
 * @property {number} pagination.total
 * @property {number} pagination.totalPages
 */

/**
 * Base Repository class.
 *
 * @template T
 */
export class BaseRepository {

    /**
     * @param {string} entityName Name for logging/error messages
     * @param {object} [options]
     * @param {boolean} [options.useCache=true] Enable in-memory cache
     */
    constructor(entityName, options = {}) {
        this.entityName = entityName;
        this.useCache = options.useCache !== false;
        this._cache = new Map();
    }

    /**
     * List entities with optional search and pagination.
     * Must be implemented by subclass.
     *
     * @param {PaginationParams} _params
     * @returns {Promise<PaginatedResult>}
     */
    async list(_params = {}) {
        throw new Error(`${this.entityName}Repository.list() not implemented`);
    }

    /**
     * Get a single entity by ID.
     * Must be implemented by subclass.
     *
     * @param {number|string} _id
     * @returns {Promise<T|null>}
     */
    async getById(_id) {
        throw new Error(`${this.entityName}Repository.getById() not implemented`);
    }

    /**
     * Create a new entity.
     * Must be implemented by subclass.
     *
     * @param {object} _data
     * @returns {Promise<T>}
     */
    async create(_data) {
        throw new Error(`${this.entityName}Repository.create() not implemented`);
    }

    /**
     * Update an existing entity.
     * Must be implemented by subclass.
     *
     * @param {number|string} _id
     * @param {object} _data
     * @returns {Promise<T|null>}
     */
    async update(_id, _data) {
        throw new Error(`${this.entityName}Repository.update() not implemented`);
    }

    /**
     * Delete an entity by ID.
     * Must be implemented by subclass.
     *
     * @param {number|string} _id
     * @returns {Promise<boolean>}
     */
    async delete(_id) {
        throw new Error(`${this.entityName}Repository.delete() not implemented`);
    }

    /**
     * Count entities.
     * Must be implemented by subclass.
     *
     * @returns {Promise<number>}
     */
    async count() {
        throw new Error(`${this.entityName}Repository.count() not implemented`);
    }

    /**
     * Invalidate cache for this repository.
     */
    invalidateCache() {
        this._cache.clear();
    }

    /**
     * Set a cache value.
     * @param {string} key
     * @param {*} value
     */
    _setCache(key, value) {
        if (this.useCache) {
            this._cache.set(key, value);
        }
    }

    /**
     * Get a cache value.
     * @param {string} key
     * @returns {*|undefined}
     */
    _getCache(key) {
        return this.useCache ? this._cache.get(key) : undefined;
    }
}


/**
 * In-memory Repository — stores data in memory.
 * Useful for development, testing, and demo mode.
 *
 * @template T
 * @extends BaseRepository
 */
export class InMemoryRepository extends BaseRepository {

    /**
     * @param {string} entityName
     * @param {object[]} [seedData=[]]
     * @param {object} [options]
     */
    constructor(entityName, seedData = [], options = {}) {
        super(entityName, options);
        this._items = [];
        this._nextId = 1;
        this._idField = options.idField || "id";

        if (seedData.length > 0) {
            this._items = seedData.map(item => ({ ...item }));
            this._nextId = this._items.reduce((max, item) => {
                const id = item[this._idField];
                return Math.max(max, typeof id === "number" ? id : 0);
            }, 0) + 1;
        }
    }

    /**
     * Simulate async delay.
     * @param {number} ms
     */
    async _delay(ms = 150) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate a unique ID.
     * @returns {number}
     */
    _generateId() {
        return this._nextId++;
    }

    /**
     * @inheritdoc
     */
    async list(params = {}) {
        await this._delay(200);

        const page = params.page || 1;
        const limit = params.limit || 10;
        const search = (params.search || "").toLowerCase().trim();

        let filtered = [...this._items];

        if (search) {
            filtered = filtered.filter(item =>
                Object.values(item).some(val =>
                    String(val).toLowerCase().includes(search)
                )
            );
        }

        // Sort by ID descending
        filtered.sort((a, b) => (b[this._idField] || 0) - (a[this._idField] || 0));

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        const paged = filtered.slice(start, start + limit);

        return {
            data: paged,
            pagination: { page, limit, total, totalPages }
        };
    }

    /**
     * @inheritdoc
     */
    async getById(id) {
        await this._delay(100);
        const item = this._items.find(i => i[this._idField] === id);
        return item ? { ...item } : null;
    }

    /**
     * @inheritdoc
     */
    async create(data) {
        await this._delay(150);
        const now = Date.now();
        const newItem = {
            [this._idField]: this._generateId(),
            ...data,
            active: data.active !== false,
            createdAt: now,
            updatedAt: now
        };
        this._items.push(newItem);
        this.invalidateCache();
        return { ...newItem };
    }

    /**
     * @inheritdoc
     */
    async update(id, data) {
        await this._delay(150);
        const index = this._items.findIndex(i => i[this._idField] === id);
        if (index === -1) return null;

        const updated = {
            ...this._items[index],
            ...data,
            [this._idField]: id, // prevent ID override
            updatedAt: Date.now()
        };
        this._items[index] = updated;
        this.invalidateCache();
        return { ...updated };
    }

    /**
     * @inheritdoc
     */
    async delete(id) {
        await this._delay(100);
        const index = this._items.findIndex(i => i[this._idField] === id);
        if (index === -1) return false;
        this._items.splice(index, 1);
        this.invalidateCache();
        return true;
    }

    /**
     * @inheritdoc
     */
    async count() {
        return this._items.length;
    }

    /**
     * Get all items (no pagination).
     * @returns {object[]}
     */
    async getAll() {
        return [...this._items];
    }
}
