import "../../tokens/index.css";

import "./card.css";


export function Card({

    title = "",

    content = ""

}) {


    const card =
        document.createElement("div");


    card.className =
        "smart-card";



    if (title) {

        const heading =
            document.createElement("div");


        heading.className =
            "smart-card-title";


        heading.innerText =
            title;


        card.appendChild(
            heading
        );

    }



    const body =
        document.createElement("div");


    body.className =
        "smart-card-content";


    body.innerText =
        content;


    card.appendChild(
        body
    );



    return card;

}
