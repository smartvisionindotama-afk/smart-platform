import "../../tokens/index.css";

import "./breadcrumb.css";


export function Breadcrumb({

    items = []

}) {


    const nav =
        document.createElement("nav");


    nav.className =
        "smart-breadcrumb";


    nav.setAttribute(
        "aria-label",
        "Breadcrumb"
    );


    const ol =
        document.createElement("ol");


    ol.className =
        "smart-breadcrumb-list";


    const crumbs = items || [];


    crumbs.forEach((item, index) => {

        const li =
            document.createElement("li");


        li.className =
            "smart-breadcrumb-item";


        const isLast =
            index === crumbs.length - 1;


        if (isLast) {

            li.setAttribute(
                "aria-current",
                "page"
            );


            const span =
                document.createElement("span");


            span.className =
                "smart-breadcrumb-current";


            span.innerText =
                item.label || "";


            li.appendChild(span);

        } else {

            if (item.href) {

                const a =
                    document.createElement("a");


                a.className =
                    "smart-breadcrumb-link";


                a.href = item.href;

                a.innerText =
                    item.label || "";


                li.appendChild(a);

            } else {

                const span =
                    document.createElement("span");


                span.className =
                    "smart-breadcrumb-text";


                span.innerText =
                    item.label || "";


                li.appendChild(span);

            }


            // Separator

            const sep =
                document.createElement("span");


            sep.className =
                "smart-breadcrumb-separator";


            sep.innerText = "/";

            sep.setAttribute(
                "aria-hidden",
                "true"
            );


            li.appendChild(sep);

        }


        ol.appendChild(li);

    });


    nav.appendChild(ol);


    return nav;

}
