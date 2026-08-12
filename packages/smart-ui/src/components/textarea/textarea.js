import "../../tokens/index.css";

import "./textarea.css";


export function Textarea({

    label = "",

    name = "",

    placeholder = "",

    value = "",

    rows = 3,

    disabled = false,

    required = false,

    error = "",

    onChange = null

}) {


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "smart-textarea-wrapper";


    if (label) {

        const labelEl =
            document.createElement("label");


        labelEl.className =
            "smart-textarea-label";


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


    const textarea =
        document.createElement("textarea");


    textarea.className =
        `smart-textarea ${error ? "smart-textarea-error" : ""}`;


    textarea.name = name;

    textarea.placeholder =
        placeholder;

    textarea.value = value;

    // Serialisasi: nilai textarea di-serialisasi sebagai CHILD TEXT node.
    // Property .value tidak mengubah child node → outerHTML kehilangan isi
    // saat di-parse ulang (mis. dalam Modal via body.innerHTML).
    if (value !== "" && value !== undefined && value !== null) {

        textarea.textContent = value;

    }

    textarea.rows = rows;

    textarea.disabled = disabled;

    textarea.required = required;


    if (onChange) {

        textarea.addEventListener(
            "input",
            onChange
        );

    }


    wrapper.appendChild(
        textarea
    );


    if (error) {

        const errorEl =
            document.createElement("span");


        errorEl.className =
            "smart-textarea-error-text";


        errorEl.innerText =
            error;


        wrapper.appendChild(
            errorEl
        );

    }


    return wrapper;

}
