import "../../tokens/index.css";

import "./container.css";


export function Container({

    size = "md",

    padding = true,

    children = null

}) {


    const el =
        document.createElement("div");


    el.className =
        `smart-container smart-container-${size}
        ${padding ? "" : "smart-container-no-padding"}`;


    if (children) {

        if (typeof children === "string") {

            el.innerHTML = children;

        } else if (

            children &&
                typeof children === "object" &&
                "tagName" in children

        ) {

            el.appendChild(children);

        }

    }


    return el;

}
