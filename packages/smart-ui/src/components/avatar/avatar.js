import "../../tokens/index.css";

import "./avatar.css";


export function Avatar({

    src = "",

    alt = "",

    name = "",

    size = "md",

    variant = "circle"

}) {


    const el =
        document.createElement("div");


    el.className =
        `smart-avatar smart-avatar-${size} smart-avatar-${variant}`;


    el.setAttribute(
        "role",
        "img"
    );


    if (src) {

        const img =
            document.createElement("img");


        img.className =
            "smart-avatar-img";


        img.src = src;

        img.alt = alt || name || "Avatar";


        el.appendChild(img);

    } else {

        // Show initials
        const initials =
            document.createElement("span");


        initials.className =
            "smart-avatar-initials";


        initials.innerText =
            getInitials(name);


        el.appendChild(initials);

    }


    return el;

}


function getInitials(name) {

    if (!name) return "?";


    const parts =
        name.trim().split(/\s+/);


    if (parts.length === 1) {

        return parts[0]
            .charAt(0)
            .toUpperCase();

    }


    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();

}
