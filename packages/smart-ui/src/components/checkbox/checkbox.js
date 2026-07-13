import "../../tokens/index.css";

import "./checkbox.css";


export function Checkbox({

    label = "",

    name = "",

    checked = false,

    disabled = false,

    onChange = null

}) {


    const wrapper =
        document.createElement("label");


    wrapper.className =
        "smart-checkbox-wrapper";


    const input =
        document.createElement("input");


    input.type = "checkbox";

    input.className =
        "smart-checkbox-input";


    input.name = name;

    input.checked = checked;

    input.disabled = disabled;


    if (onChange) {

        input.addEventListener(
            "change",
            onChange
        );

    }


    wrapper.appendChild(
        input
    );


    const checkmark =
        document.createElement("span");


    checkmark.className =
        "smart-checkbox-checkmark";


    wrapper.appendChild(
        checkmark
    );


    if (label) {

        const labelText =
            document.createElement("span");


        labelText.className =
            "smart-checkbox-text";


        labelText.innerText =
            label;


        wrapper.appendChild(
            labelText
        );

    }


    return wrapper;

}
