import "./tokens/index.css";

// All 22 SMART UI components — accessible directly from @smart/ui
export * from "./components/index.js";

// Workspace engine
export { loadWorkspace } from "./workspaces/engine.js";

// Settings modules
export { SettingsCompanyModule } from "./modules/settings/company.js";


/**
 * Load the SMART UI framework.
 *
 * Initializes global UI tokens and logs confirmation.
 */
export function loadUI() {

    console.log(
        "SMART UI Loaded"
    );

}
