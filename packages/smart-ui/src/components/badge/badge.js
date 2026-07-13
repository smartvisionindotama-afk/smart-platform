import "../../tokens/index.css";

import "./badge.css";


export function Badge({

    text = "",

    variant = "default",

    size = "",

    count = null

}) {


    const el =
        document.createElement("span");


    el.className =
        `smart-badge smart-badge-${variant} ${size ? `smart-badge-${size}` : ""}`;


    if (text) {

        const textEl =
            document.createElement("span");


        textEl.className =
            "smart-badge-text";


        textEl.textContent = text;


        el.appendChild(textEl);

    }


    if (count !== null && count !== undefined) {

        const countEl =
            document.createElement("span");


        countEl.className =
            "smart-badge-count";


        countEl.textContent =
            count > 99 ? "99+" : String(count);


        el.appendChild(countEl);

    }


    if (!text && count === null) {

        el.textContent = "...";

    }


    return el;

}
