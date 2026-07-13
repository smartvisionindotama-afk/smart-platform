import "../../tokens/index.css";

import "./alert.css";


export function Alert({

    message = "",

    variant = "info",

    dismissible = false,

    onDismiss = null

}) {


    const el =
        document.createElement("div");


    el.className =
        `smart-alert smart-alert-${variant}`;


    el.setAttribute(
        "role",
        "alert"
    );


    // Icon based on variant
    const icons = {
        info: "ℹ",
        success: "✓",
        warning: "⚠",
        danger: "✕"
    };


    const iconEl =
        document.createElement("span");


    iconEl.className =
        "smart-alert-icon";


    iconEl.innerText =
        icons[variant] || icons.info;


    el.appendChild(iconEl);


    const messageEl =
        document.createElement("span");


    messageEl.className =
        "smart-alert-message";


    messageEl.innerText =
        message;


    el.appendChild(messageEl);


    if (dismissible) {

        const closeBtn =
            document.createElement("button");


        closeBtn.className =
            "smart-alert-close";


        closeBtn.innerText = "×";

        closeBtn.setAttribute(
            "aria-label",
            "Close alert"
        );


        if (onDismiss) {

            closeBtn.addEventListener(
                "click",
                onDismiss
            );

        }


        el.appendChild(closeBtn);

    }


    return el;

}
