// SMART Workspace Schema
// Mendefinisikan properti yang dapat diatur oleh setiap workspace

export const WorkspaceSchema = {
    name: "string",        // Identifier unik (default, warehouse, corporate)
    label: "string",       // Nama tampilan (Gudang, Perusahaan, dll)
    appTitle: "string",    // Judul aplikasi di sidebar
    topbarTitle: "string", // Judul di topbar
    variables: "string",   // Path ke file CSS variables
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
    const missing = required.filter(field => !config[field]);
    if (missing.length > 0) {
        console.warn(
            `Workspace missing required fields: ${missing.join(", ")}`
        );
        return false;
    }
    return true;
}
