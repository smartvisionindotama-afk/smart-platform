// SMART Workspace Schema
// Mendefinisikan properti yang dapat diatur oleh setiap workspace

export const WorkspaceSchema = {
    name: "string",
    label: "string",
    appTitle: "string",
    topbarTitle: "string",
    variables: "string",
    layout: {
        type: "object",
        properties: {
            sidebarPosition: { type: "string", default: "left" },
            topbarFixed: { type: "boolean", default: true }
        }
    },
    branding: {
        type: "object",
        properties: {
            primaryColor: { type: "string", default: "--blue-500" },
            logo: { type: "string", default: null }
        }
    }
};


export function validateWorkspaceConfig(config) {

    const required = ["name", "label"];

    const missing = required.filter(
        field => !config[field]
    );


    if (missing.length > 0) {

        console.warn(
            `Workspace missing required fields: ${missing.join(", ")}`
        );

        return false;

    }


    return true;

}
