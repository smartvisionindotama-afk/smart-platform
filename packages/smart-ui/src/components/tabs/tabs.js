import "../../tokens/index.css";

import "./tabs.css";


export function Tabs({

    tabs = [],

    active = "",

    onChange = null

}) {


    const nav =
        document.createElement("nav");


    nav.className =
        "smart-tabs";


    nav.setAttribute(
        "role",
        "tablist"
    );


    const items = tabs || [];


    items.forEach(tab => {

        const btn =
            document.createElement("button");


        const isActive =
            tab.id === active ||
            (!active && tab.active);


        btn.className =
            `smart-tab
            ${isActive ? "smart-tab-active" : ""}`;


        btn.setAttribute(
            "role",
            "tab"
        );


        btn.setAttribute(
            "aria-selected",
            isActive ? "true" : "false"
        );


        btn.innerText =
            tab.label || tab.id || "";


        if (tab.id && onChange) {

            btn.addEventListener(
                "click",
                () => onChange(tab.id)
            );

        }


        nav.appendChild(btn);

    });


    return nav;

}
