import defaultConfig from "./default/workspace.json";
import corporateConfig from "./corporate/workspace.json";
import warehouseConfig from "./warehouse/workspace.json";
import posConfig from "./pos/workspace.json";

import { validateWorkspaceConfig } from "./schema.js";


const workspaces = {

    default: {
        config: defaultConfig,
        css: () =>
            import("./default/variables.css")
    },

    corporate: {
        config: corporateConfig,
        css: () =>
            import("./corporate/variables.css")
    },

    warehouse: {
        config: warehouseConfig,
        css: () =>
            import("./warehouse/variables.css")
    },

    // SMART Kasir (M1) — workspace baru, additive (backward compatible)
    pos: {
        config: posConfig,
        css: () =>
            import("./pos/variables.css")
    }

};


export async function loadWorkspace(workspaceName) {

    const workspace =
        workspaces[workspaceName] ||
        workspaces.default;


    // Validate workspace config before loading CSS
    const valid =
        validateWorkspaceConfig(
            workspace.config
        );


    if (!valid) {

        console.warn(
            `Workspace config validation failed for "${workspaceName}", falling back to default`
        );

    }


    // Load workspace CSS
    await workspace.css();


    console.log(
        `Workspace loaded: ${workspaceName}`
    );


    // Return workspace config for app consumption
    return workspace.config;

}
