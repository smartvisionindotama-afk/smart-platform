import "../../tokens/index.css";

import "./skeleton.css";


export function Skeleton({

    variant = "text",

    width = "",

    height = "",

    count = 1

}) {


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "smart-skeleton-wrapper";


    const items =
        Math.max(1, count || 1);


    for (
        let i = 0;
        i < items;
        i++
    ) {

        const el =
            document.createElement("div");


        el.className =
            `smart-skeleton smart-skeleton-${variant}`;


        el.setAttribute(
            "aria-hidden",
            "true"
        );


        if (width) {

            el.style.width =
                typeof width === "number"
                    ? `${width}px`
                    : width;

        }


        if (height) {

            el.style.height =
                typeof height === "number"
                    ? `${height}px`
                    : height;

        }


        // Sub-elements for complex variants

        if (variant === "card") {

            const imageBlock =
                document.createElement("div");


            imageBlock.className =
                "smart-skeleton-card-image";


            el.appendChild(imageBlock);


            const textBlock =
                document.createElement("div");


            textBlock.className =
                "smart-skeleton-card-text";


            const titleLine =
                document.createElement("div");


            titleLine.className =
                "smart-skeleton";


            titleLine.style.width = "70%";


            textBlock.appendChild(titleLine);


            const descLine =
                document.createElement("div");


            descLine.className =
                "smart-skeleton";


            descLine.style.width = "90%";


            textBlock.appendChild(descLine);


            el.appendChild(textBlock);

        }


        if (variant === "table-row") {

            const cells = 4;

            for (
                let c = 0;
                c < cells;
                c++
            ) {

                const cell =
                    document.createElement("div");


                cell.className =
                    "smart-skeleton-table-cell";


                cell.style.width =
                    `${20 + Math.random() * 40}%`;


                el.appendChild(cell);

            }

        }


        wrapper.appendChild(el);

    }


    return wrapper;

}
