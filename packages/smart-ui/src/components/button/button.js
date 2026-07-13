import "../../tokens/index.css";

import "./button.css";

export function Button({

    text = "",

    type = "primary",

    size = "",

    disabled = false,

    onClick = null

}) {


    const button =
        document.createElement("button");



    button.innerText =
        text;



    button.className =
        `
        smart-btn
        smart-btn-${type}
        ${size ? `smart-btn-${size}` : ""}
        `;



    button.disabled =
        disabled;



    if (onClick) {

        button.addEventListener(
            "click",
            onClick
        );

    }



    return button;

}
