import "../../tokens/index.css";

import "./modal.css";


export function Modal({

    open = false,

    title = "",

    content = "",

    footer = "",

    closable = true,

    onClose = null

}) {


    const overlay =
        document.createElement("div");


    overlay.className =
        `smart-modal-overlay ${open ? "smart-modal-open" : ""}`;


    const dialog =
        document.createElement("div");


    dialog.className =
        "smart-modal-dialog";


    dialog.setAttribute(
        "role",
        "dialog"
    );


    dialog.setAttribute(
        "aria-modal",
        "true"
    );


    // Header

    const header =
        document.createElement("div");


    header.className =
        "smart-modal-header";


    if (title) {

        const titleEl =
            document.createElement("h3");


        titleEl.className =
            "smart-modal-title";


        titleEl.innerText =
            title;


        header.appendChild(titleEl);

    }


    if (closable) {

        const closeBtn =
            document.createElement("button");


        closeBtn.className =
            "smart-modal-close";


        closeBtn.innerText = "×";

        closeBtn.setAttribute(
            "aria-label",
            "Close dialog"
        );


        if (onClose) {

            closeBtn.addEventListener(
                "click",
                onClose
            );

        }


        header.appendChild(closeBtn);

    }


    dialog.appendChild(header);


    // Body

    const body =
        document.createElement("div");


    body.className =
        "smart-modal-body";


    if (content) {

        body.innerHTML = content;

    }


    dialog.appendChild(body);


    // Footer

    if (footer) {

        const footerEl =
            document.createElement("div");


        footerEl.className =
            "smart-modal-footer";


        footerEl.innerHTML = footer;


        dialog.appendChild(footerEl);

    }


    overlay.appendChild(dialog);


    // Click overlay to close

    if (closable && onClose) {

        overlay.addEventListener(
            "click",
            (e) => {

                if (
                    e.target === overlay
                ) {

                    onClose();

                }

            }

        );

    }


    return overlay;

}
