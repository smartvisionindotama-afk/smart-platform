import "../../tokens/index.css";

import "./switch.css";


export function Switch({

    label = "",

    name = "",

    checked = false,

    disabled = false,

    onChange = null

}) {


    const wrapper =
        document.createElement("label");


    wrapper.className =
        "smart-switch-wrapper";


    const input =
        document.createElement("input");


    input.type = "checkbox";

    input.className =
        "smart-switch-input";


    input.name = name;

    input.checked = checked;

    // Serialisasi: set CONTENT ATTRIBUTE `checked` agar status tidak hilang
    // saat outerHTML di-parse ulang (mis. dalam Modal via body.innerHTML).
    if (checked) {

        input.setAttribute("checked", "");

    }

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


    const slider =
        document.createElement("span");


    slider.className =
        "smart-switch-slider";


    wrapper.appendChild(
        slider
    );


    if (label) {

        const labelText =
            document.createElement("span");


        labelText.className =
            "smart-switch-text";


        labelText.innerText =
            label;


        wrapper.appendChild(
            labelText
        );

    }


    return wrapper;

}
