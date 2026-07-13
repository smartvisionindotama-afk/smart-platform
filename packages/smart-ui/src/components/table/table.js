import "../../tokens/index.css";

import "./table.css";


export function Table({

    columns = [],

    rows = [],

    variant = "",

    striped = false,

    bordered = false,

    hoverable = false,

    emptyMessage = "No data available"

}) {


    const wrapper =
        document.createElement("div");


    wrapper.className =
        "smart-table-wrapper";


    const table =
        document.createElement("table");


    table.className =
        `smart-table
        ${variant ? `smart-table-${variant}` : ""}
        ${striped ? "smart-table-striped" : ""}
        ${bordered ? "smart-table-bordered" : ""}
        ${hoverable ? "smart-table-hoverable" : ""}`;


    // Header

    const thead =
        document.createElement("thead");


    const headerRow =
        document.createElement("tr");


    const cols = columns || [];


    cols.forEach(col => {

        const th =
            document.createElement("th");


        th.className =
            "smart-table-th";


        th.innerText =
            col.label || col.key || "";


        if (col.align) {

            th.style.textAlign = col.align;

        }


        if (col.width) {

            th.style.width = col.width;

        }


        headerRow.appendChild(th);

    });


    thead.appendChild(headerRow);

    table.appendChild(thead);


    // Body

    const tbody =
        document.createElement("tbody");


    const items = rows || [];


    if (items.length === 0) {

        const emptyRow =
            document.createElement("tr");


        const emptyCell =
            document.createElement("td");


        emptyCell.className =
            "smart-table-empty";


        emptyCell.colSpan =
            Math.max(cols.length, 1);


        emptyCell.innerText =
            emptyMessage;


        emptyRow.appendChild(emptyCell);

        tbody.appendChild(emptyRow);

    } else {

        items.forEach(row => {

            const tr =
                document.createElement("tr");


            tr.className =
                "smart-table-tr";


            cols.forEach(col => {

                const td =
                    document.createElement("td");


                td.className =
                    "smart-table-td";


                if (col.align) {

                    td.style.textAlign = col.align;

                }


                const value =
                    row[col.key];


                if (col.render) {

                    const rendered =
                        col.render(value, row);


                    if (typeof rendered === "string") {

                        td.innerHTML = rendered;

                    } else                if (
                    rendered &&
                    typeof rendered === "object" &&
                    "tagName" in rendered
                ) {

                    td.appendChild(rendered);

                }

                } else {

                    td.innerText =
                    value !== null &&
                        value !== undefined
                        ? String(value)
                        : "";

                }


                tr.appendChild(td);

            });


            tbody.appendChild(tr);

        });

    }


    table.appendChild(tbody);

    wrapper.appendChild(table);


    return wrapper;

}
