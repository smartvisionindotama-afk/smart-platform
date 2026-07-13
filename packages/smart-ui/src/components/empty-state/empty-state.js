import "../../tokens/index.css";

import "./empty-state.css";


export function EmptyState({

    title = "",

    description = "",

    icon = "",

    actionText = "",

    onAction = null

}) {


    const el =
        document.createElement("div");


    el.className =
        "smart-empty-state";


    // Icon

    if (icon) {

        const iconEl =
            document.createElement("div");


        iconEl.className =
            "smart-empty-state-icon";


        iconEl.innerText = icon;


        el.appendChild(iconEl);

    }


    // Title

    if (title) {

        const titleEl =
            document.createElement("h3");


        titleEl.className =
            "smart-empty-state-title";


        titleEl.innerText = title;


        el.appendChild(titleEl);

    }


    // Description

    if (description) {

        const descEl =
            document.createElement("p");


        descEl.className =
            "smart-empty-state-description";


        descEl.innerText = description;


        el.appendChild(descEl);

    }


    // Action button

    if (actionText) {

        const actionBtn =
            document.createElement("button");


        actionBtn.className =
            "smart-empty-state-action";


        actionBtn.innerText =
            actionText;


        if (onAction) {

            actionBtn.addEventListener(
                "click",
                onAction
            );

        }


        el.appendChild(actionBtn);

    }


    return el;

}
