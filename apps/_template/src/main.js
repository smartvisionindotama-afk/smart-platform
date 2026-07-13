import { Auth, AppConfig } from "@smart/core";
import { loadUI, loadWorkspace } from "@smart/ui";
import { AppShell } from "@smart/ui/layouts";

import menus from "./config/menu.js";
import { AppShell } from "@smart/ui/layouts";

import menus from "./config/menu";
import { navigate } from "./router";


async function start() {

    loadUI();

    console.log(
        `${AppConfig.name} started`
    );

    Auth.login("admin");


    const institution = "default";

    await loadWorkspace(institution);

    const app = document.querySelector("#app");

    app.innerHTML = AppShell({
        appTitle: "My App",
        topbarTitle: "My SMART App",
        userName: Auth.user()?.name || "User",
        menuItems: menus,
        onNavigate: navigate,
        contentId: "content"
    });

    navigate("dashboard");

}


start();
