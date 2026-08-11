import { routes } from "./routes";

import { Permission } from "@smart/core";



/**
 * Navigate to a page.
 *
 * Supports lifecycle:
 *   route.component()  → returns HTML string for innerHTML
 *   route.init()       → called after mount for post-render initialization
 *
 * @param {string} page
 */
export function navigate(page) {


    console.log("Page :", page);



    const app =
        document.getElementById("content");



    const route =
        routes[page];



    console.log(
        "Route :",
        route
    );



    if (!route) {


        app.innerHTML =
            "<h2>404 Page Not Found</h2>";


        return;

    }



    const allowed =
        Permission.can(
            route.permission
        );



    console.log(
        "Permission :",
        route.permission
    );


    console.log(
        "Allowed :",
        allowed
    );



    if (!allowed) {


        app.innerHTML = `

            <div>

                <h2>
                    Access Denied
                </h2>

                <p>
                    Anda tidak memiliki hak akses ke halaman ini.
                </p>

            </div>

        `;


        return;

    }



    const render =
        route.component;



    console.log(
        "Render :",
        render
    );



    app.innerHTML =
        render();


    // Post-mount lifecycle
    if (typeof route.init === "function") {

        route.init();

    }

}