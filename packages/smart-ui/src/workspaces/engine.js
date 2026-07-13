const workspaces = {

    default: () =>
        import("./default/variables.css"),

    corporate: () =>
        import("./corporate/variables.css"),

    warehouse: () =>
        import("./warehouse/variables.css")

};


export async function loadWorkspace(workspaceName) {

    const workspace =
        workspaces[workspaceName] || workspaces.default;


    await workspace();


    console.log(
        `Workspace loaded : ${workspaceName}`
    );

}
