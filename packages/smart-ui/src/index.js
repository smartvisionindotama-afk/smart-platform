import "./tokens/index.css";

// All 22 SMART UI components — accessible directly from @smart/ui
export * from "./components/index.js";

// Workspace engine
export { loadWorkspace } from "./workspaces/engine.js";


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
