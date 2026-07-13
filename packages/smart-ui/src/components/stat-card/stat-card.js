import "../../tokens/index.css";

import "./stat-card.css";


export function StatCard({

    title = "",

    value = ""

}) {


    const card =
        document.createElement("div");


    card.className =
        "smart-stat-card";



    const titleElement =
        document.createElement("div");


    titleElement.className =
        "smart-stat-title";


    titleElement.innerText =
        title;



    const valueElement =
        document.createElement("div");


    valueElement.className =
        "smart-stat-value";


    valueElement.innerText =
        value;



    card.appendChild(
        titleElement
    );


    card.appendChild(
        valueElement
    );



    return card;

}
