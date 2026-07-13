import "../../tokens/index.css";

import "./input.css";


export function Input({

    label = "",

    name = "",

    type = "text",

    placeholder = "",

    value = "",

    disabled = false,

    required = false,

    error = "",

    onChange = null

}) {


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "smart-input-wrapper";


    if (label) {

        const labelEl =
            document.createElement("label");


        labelEl.className =
            "smart-input-label";


        labelEl.innerText =
            label;


        if (name) {

            labelEl.setAttribute(
                "for",
                name
            );

        }


        wrapper.appendChild(
            labelEl
        );

    }


    const input =
        document.createElement("input");


    input.className =
        `smart-input ${error ? "smart-input-error" : ""}`;


    input.type = type;

    input.name = name;

    input.placeholder = placeholder;

    input.value = value;

    input.disabled = disabled;

    input.required = required;


    if (onChange) {

        input.addEventListener(
            "input",
            onChange
        );

    }


    wrapper.appendChild(
        input
    );


    if (error) {

        const errorEl =
            document.createElement("span");


        errorEl.className =
            "smart-input-error-text";


        errorEl.innerText =
            error;


        wrapper.appendChild(
            errorEl
        );

    }


    return wrapper;

}
