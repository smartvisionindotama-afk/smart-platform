/**
 * Institution / Tenant Context Manager.
 *
 * Manages multi-tenant institution switching and context.
 * Backward compatible with the original API.
 */

const institutions = {

    inventory: {

        id: "INV001",

        name: "SMART Warehouse",

        type: "inventory",

        workspace: "warehouse"

    },


    company: {

        id: "CMP001",

        name: "PT Smart Vision Indotama",

        type: "company",

        workspace: "corporate"

    },


    default: {

        id: "DEF001",

        name: "Default Institution",

        type: "default",

        workspace: "default"

    }

};



class Institution {


    constructor() {

        this.active = "inventory";

        this._listeners = [];

    }



    // ── Current Institution ──


    /**
     * Get the current active institution.
     *
     * @returns {object} Current institution or default fallback
     */
    current() {

        const inst = institutions[this.active]

            || institutions.default;


        return inst ? { ...inst } : null;

    }


    /**
     * Set the active institution by key.
     *
     * @param {string} name Institution key
     * @returns {boolean} Whether the institution was found and set
     */
    set(name) {

        if (!institutions[name]) {

            return false;

        }


        this.active = name;


        this._notify();


        return true;

    }



    // ── Institution Queries ──


    /**
     * List all available institutions.
     *
     * @returns {object[]}
     */
    list() {

        return Object.values(institutions).map(

            inst => ({ ...inst })

        );

    }


    /**
     * Find institutions by type.
     *
     * @param {string} type e.g. "inventory", "company", "default"
     * @returns {object[]}
     */
    byType(type) {

        return Object.values(institutions)

            .filter(inst => inst.type === type)

            .map(inst => ({ ...inst }));

    }


    /**
     * Check if an institution key exists.
     *
     * @param {string} name Institution key
     * @returns {boolean}
     */
    exists(name) {

        return name in institutions;

    }


    /**
     * Get institution by key.
     *
     * @param {string} name
     * @returns {object|null}
     */
    get(name) {

        const inst = institutions[name];

        return inst ? { ...inst } : null;

    }


    /**
     * Get the active institution's workspace name.
     *
     * @returns {string|null}
     */
    workspace() {

        const current = this.current();

        return current ? current.workspace : null;

    }


    /**
     * Check if the current institution is of a given type.
     *
     * @param {string} type
     * @returns {boolean}
     */
    isType(type) {

        const current = this.current();

        return current ? current.type === type : false;

    }



    // ── Subscriptions ──


    /**
     * Subscribe to institution changes.
     *
     * @param {function} callback
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
     * Notify subscribers of institution changes.
     */
    _notify() {

        const current = this.current();


        this._listeners.forEach(fn => {

            try {

                fn(current);

            } catch (e) {

                console.warn(

                    "Institution subscriber error:",

                    e

                );

            }

        });

    }

}


export default new Institution();
