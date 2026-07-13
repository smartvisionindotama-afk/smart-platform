import "../../tokens/index.css";

import "./stack.css";


export function Stack({

    direction = "vertical",

    gap = "md",

    align = "",

    justify = "",

    wrap = false,

    children = null

}) {


    const el =
        document.createElement("div");


    const gapMap = {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)"
    };


    el.className =
        `smart-stack smart-stack-${direction}
        ${wrap ? "smart-stack-wrap" : ""}`;


    el.style.gap =
        gapMap[gap] || gap || "var(--space-md)";


    if (align) {

        el.style.alignItems = align;

    }


    if (justify) {

        el.style.justifyContent = justify;

    }


    if (children) {

        if (typeof children === "string") {

            el.innerHTML = children;

        } else if (

            children &&
                typeof children === "object" &&
                "tagName" in children

        ) {

            el.appendChild(children);

        } else if (Array.isArray(children)) {

            children.forEach(child => {

                if (typeof child === "string") {

                    el.appendChild(
                        document.createTextNode(child)
                    );

                } else if (

                    child &&
                        typeof child === "object" &&
                        "tagName" in child

                ) {

                    el.appendChild(child);

                }

            });

        }

    }


    return el;

}
