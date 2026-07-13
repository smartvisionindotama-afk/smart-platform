const routes = {
    dashboard: {
        component: () => "<h1>Dashboard</h1><p>Welcome to your SMART App!</p>",
        permission: "dashboard.view"
    },
    module: {
        component: () => "<h1>Module</h1><p>Your module page here.</p>",
        permission: "module.view"
    }
};

export function navigate(page) {
    const app = document.getElementById("content");
    const route = routes[page];
    if (!route) {
        app.innerHTML = "<h2>404 Page Not Found</h2>";
        return;
    }
    app.innerHTML = route.component();
}
