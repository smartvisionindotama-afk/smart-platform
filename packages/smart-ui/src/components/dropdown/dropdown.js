import "../../tokens/index.css";

import "./dropdown.css";


export function Dropdown({

    label = "Menu",

    items = [],

    placement = "bottom-left",

    disabled = false,

    onChange = null

}) {


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "smart-dropdown";


    // Trigger button

    const trigger =
        document.createElement("button");


    trigger.className =
        "smart-dropdown-trigger";


    trigger.innerText = label;


    trigger.disabled = disabled;


    trigger.setAttribute(
        "aria-haspopup",
        "true"
    );


    trigger.setAttribute(
        "aria-expanded",
        "false"
    );


    wrapper.appendChild(trigger);


    // Menu

    const menu =
        document.createElement("div");


    menu.className =
        `smart-dropdown-menu smart-dropdown-${placement}`;


    menu.setAttribute(
        "role",
        "menu"
    );


    menu.style.display = "none";


    const menuItems = items || [];


    menuItems.forEach(item => {

        if (item.divider) {

            const divider =
                document.createElement("div");


            divider.className =
                "smart-dropdown-divider";


            menu.appendChild(divider);

        } else {

            const menuItem =
                document.createElement("button");


            menuItem.className =
                "smart-dropdown-item";


            menuItem.setAttribute(
                "role",
                "menuitem"
            );


            menuItem.innerText =
                item.label || "";


            menuItem.disabled =
                item.disabled || false;


            if (item.onClick) {

                menuItem.addEventListener(
                    "click",
                    () => {
                        item.onClick(item.value);
                        closeMenu();
                    }
                );

            } else if (onChange && item.value) {

                menuItem.addEventListener(
                    "click",
                    () => {
                        onChange(item.value);
                        closeMenu();
                    }
                );

            }


            menu.appendChild(menuItem);

        }

    });


    wrapper.appendChild(menu);


    // Toggle open/close

    let isOpen = false;


    function toggleMenu() {

        isOpen = !isOpen;

        menu.style.display =
            isOpen ? "block" : "none";


        trigger.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

    }


    function closeMenu() {

        isOpen = false;

        menu.style.display = "none";

        trigger.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    trigger.addEventListener(
        "click",
        (e) => {
            e.stopPropagation();
            toggleMenu();
        }
    );


    // Close on click outside

    function handleOutsideClick(e) {

        if (
            isOpen &&
            !wrapper.contains(e.target)
        ) {

            closeMenu();

        }

    }


    document.addEventListener(
        "click",
        handleOutsideClick
    );


    return wrapper;

}
