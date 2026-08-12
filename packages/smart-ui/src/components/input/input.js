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

    // Serialisasi: set juga CONTENT ATTRIBUTE agar nilai tidak hilang saat
    // komponen di-serialisasi lewat outerHTML lalu di-parse ulang (mis. dalam
    // Modal yang memakai body.innerHTML). Property .value tidak di-serialisasi
    // oleh outerHTML (lihat test form-inputs).
    // KECUALI type=password: jangan pernah serialisasi password ke attribute
    // HTML (terlihat di devtools DOM).
    if (type !== "password" && value !== "" && value !== undefined && value !== null) {

        input.setAttribute("value", value);

    }

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
