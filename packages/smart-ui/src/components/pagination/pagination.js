import "../../tokens/index.css";

import "./pagination.css";


export function Pagination({

    current = 1,

    total = 1,

    pageSize = 10,

    onChange = null

}) {


    const totalPages =
        Math.max(1, Math.ceil(total / Math.max(1, pageSize)));


    const nav =
        document.createElement("nav");


    nav.className =
        "smart-pagination";


    nav.setAttribute(
        "role",
        "navigation"
    );


    nav.setAttribute(
        "aria-label",
        "Pagination"
    );


    // Previous button

    const prevBtn =
        createPageButton(
            "‹",
            current > 1,
            () => {
                if (onChange && current > 1) {
                    onChange(current - 1);
                }
            }
        );


    prevBtn.className =
        `smart-pagination-btn
        ${current <= 1 ? "smart-pagination-disabled" : ""}`;


    prevBtn.setAttribute(
        "aria-label",
        "Previous page"
    );


    nav.appendChild(prevBtn);


    // Page numbers

    const pageNumbers =
        getPageNumbers(current, totalPages);


    pageNumbers.forEach(page => {

        if (page === "...") {

            const ellipsis =
                document.createElement("span");


            ellipsis.className =
                "smart-pagination-ellipsis";


            ellipsis.innerText = "…";


            nav.appendChild(ellipsis);

        } else {

            const pageBtn =
                createPageButton(
                    String(page),
                    true,
                    () => {
                        if (
                            onChange &&
                            page !== current
                        ) {
                            onChange(page);
                        }
                    }
                );


            pageBtn.className =
                `smart-pagination-btn
                ${page === current
                    ? "smart-pagination-active"
                    : ""}`;


            pageBtn.setAttribute(
                "aria-label",
                `Page ${page}`
            );


            if (page === current) {

                pageBtn.setAttribute(
                    "aria-current",
                    "page"
                );

            }


            nav.appendChild(pageBtn);

        }

    });


    // Next button

    const nextBtn =
        createPageButton(
            "›",
            current < totalPages,
            () => {
                if (
                    onChange &&
                    current < totalPages
                ) {
                    onChange(current + 1);
                }
            }
        );


    nextBtn.className =
        `smart-pagination-btn
        ${current >= totalPages
            ? "smart-pagination-disabled"
            : ""}`;


    nextBtn.setAttribute(
        "aria-label",
        "Next page"
    );


    nav.appendChild(nextBtn);


    // Info text

    const info =
        document.createElement("span");


    info.className =
        "smart-pagination-info";


    const start =
        total === 0
            ? 0
            : (current - 1) * pageSize + 1;


    const end =
        Math.min(current * pageSize, total);


    info.innerText =
        `${start}–${end} of ${total}`;


    nav.appendChild(info);


    return nav;

}


function createPageButton(
    text,
    enabled,
    onClick
) {

    const btn =
        document.createElement("button");


    btn.innerText = text;


    btn.disabled = !enabled;


    if (enabled && onClick) {

        btn.addEventListener(
            "click",
            onClick
        );

    }


    return btn;

}


function getPageNumbers(
    current,
    total
) {

    if (total <= 7) {

        return Array.from(
            { length: total },
            (_, i) => i + 1
        );

    }


    const pages = [];

    const showEllipsisLeft =
        current > 3;

    const showEllipsisRight =
        current < total - 2;


    pages.push(1);


    if (showEllipsisLeft) {

        pages.push("...");

    }


    const start =
        Math.max(2, current - 1);

    const end =
        Math.min(total - 1, current + 1);


    for (
        let i = start;
        i <= end;
        i++
    ) {

        pages.push(i);

    }


    if (showEllipsisRight) {

        pages.push("...");

    }


    pages.push(total);


    return pages;

}
