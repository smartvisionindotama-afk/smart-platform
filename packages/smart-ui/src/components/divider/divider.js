import "../../tokens/index.css";

import "./divider.css";


export function Divider({

    orientation = "horizontal",

    label = "",

    labelPosition = "center"

}) {


    const el =
        document.createElement("div");


    el.className =
        `smart-divider smart-divider-${orientation}`;


    el.setAttribute(
        "role",
        "separator"
    );


    el.setAttribute(
        "aria-orientation",
        orientation
    );


    if (orientation === "vertical") {

        if (label) {

            const labelEl =
                document.createElement("span");


            labelEl.className =
                "smart-divider-label";


            labelEl.innerText = label;


            el.appendChild(labelEl);

        }


        return el;

    }


    if (label) {

        const leftLine =
            document.createElement("span");


        leftLine.className =
            "smart-divider-line";


        el.appendChild(leftLine);


        const labelEl =
            document.createElement("span");


        labelEl.className =
            `smart-divider-label smart-divider-label-${labelPosition}`;


        labelEl.innerText = label;


        el.appendChild(labelEl);


        const rightLine =
            document.createElement("span");


        rightLine.className =
            "smart-divider-line";


        el.appendChild(rightLine);

    }


    return el;

}
