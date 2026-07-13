import "../../tokens/index.css";

import "./toast.css";


export function Toast({

    message = "",

    variant = "info",

    duration = 3000,

    onDismiss = null

}) {


    const el =
        document.createElement("div");


    el.className =
        `smart-toast smart-toast-${variant}`;


    el.setAttribute(
        "role",
        "status"
    );


    el.setAttribute(
        "aria-live",
        "polite"
    );


    const icons = {
        info: "ℹ",
        success: "✓",
        warning: "⚠",
        danger: "✕"
    };


    const iconEl =
        document.createElement("span");


    iconEl.className =
        "smart-toast-icon";


    iconEl.innerText =
        icons[variant] || icons.info;


    el.appendChild(iconEl);


    const messageEl =
        document.createElement("span");


    messageEl.className =
        "smart-toast-message";


    messageEl.innerText =
        message;


    el.appendChild(messageEl);


    const closeBtn =
        document.createElement("button");


    closeBtn.className =
        "smart-toast-close";


    closeBtn.innerText = "×";

    closeBtn.setAttribute(
        "aria-label",
        "Close notification"
    );


    if (onDismiss) {

        closeBtn.addEventListener(
            "click",
            onDismiss
        );

    }


    el.appendChild(closeBtn);


    // Auto-dismiss
    if (duration > 0 && onDismiss) {

        setTimeout(
            onDismiss,
            duration
        );

    }


    return el;

}
