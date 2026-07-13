/**
 * Application Identity & Configuration.
 *
 * Centralized identity for the SMART application.
 * Backward compatible with the original AppConfig object.
 */

const AppConfig = {

    // Core identity
    name: "Smart Inventory",
    appCode: "INV",
    version: "1.0.0",
    company: "PT Smart Vision Indotama",

    // Environment
    environment: "development",
    apiUrl: "http://localhost:3000/api",

    // Feature flags
    features: {
        reports: true,
        export: true,
        notifications: true,
        darkMode: false,
        betaFeatures: false
    },


    // ── Environment Checks ──


    /**
     * Check if running in development mode.
     *
     * @returns {boolean}
     */
    isDevelopment() {
        return this.environment === "development";
    },


    /**
     * Check if running in staging mode.
     *
     * @returns {boolean}
     */
    isStaging() {
        return this.environment === "staging";
    },


    /**
     * Check if running in production mode.
     *
     * @returns {boolean}
     */
    isProduction() {
        return this.environment === "production";
    },


    // ── Feature Flags ──


    /**
     * Check if a feature is enabled.
     *
     * @param {string} featureName
     * @returns {boolean}
     */
    isEnabled(featureName) {
        return this.features[featureName] === true;
    },


    /**
     * Enable or disable a feature.
     *
     * @param {string} featureName
     * @param {boolean} enabled
     */
    setFeature(featureName, enabled) {
        this.features[featureName] = enabled;
    },


    // ── Identity ──


    /**
     * Get full app identity as an object.
     *
     * @returns {object}
     */
    identity() {
        return {
            name: this.name,
            appCode: this.appCode,
            version: this.version,
            company: this.company,
            environment: this.environment
        };
    }

};


export default AppConfig;
