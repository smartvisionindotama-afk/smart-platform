import "../../tokens/index.css";

import "./select.css";


export function Select({

    label = "",

    name = "",

    options = [],

    value = "",

    placeholder = "",

    disabled = false,

    onChange = null

}) {


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "smart-select-wrapper";


    if (label) {

        const labelEl =
            document.createElement("label");


        labelEl.className =
            "smart-select-label";


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


    const select =
        document.createElement("select");


    select.className =
        "smart-select";


    select.name = name;

    select.disabled = disabled;


    if (placeholder) {

        const placeholderOpt =
            document.createElement("option");


        placeholderOpt.value = "";

        placeholderOpt.textContent =
            placeholder;

        placeholderOpt.disabled = true;

        placeholderOpt.selected =
            value === "";


        select.appendChild(
            placeholderOpt
        );

    }


    const items = options || [];


    items.forEach(opt => {

        const optionEl =
            document.createElement("option");


        optionEl.value =
            opt.value || "";

        optionEl.textContent =
            opt.label || opt.value || "";

        optionEl.selected =
            (opt.value || "") === value;


        select.appendChild(
            optionEl
        );

    });


    if (onChange) {

        select.addEventListener(
            "change",
            onChange
        );

    }


    wrapper.appendChild(
        select
    );


    return wrapper;

}
