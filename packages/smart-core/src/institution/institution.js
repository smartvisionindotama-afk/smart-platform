const institutions = {

    inventory: {

        id: "INV001",

        name: "SMART Warehouse",

        type: "inventory",

        workspace: "warehouse"

    },


    company: {

        id: "CMP001",

        name: "PT Smart Vision Indotama",

        type: "company",

        workspace: "corporate"

    },


    default: {

        id: "DEF001",

        name: "Default Institution",

        type: "default",

        workspace: "default"

    }

};



class Institution {


    constructor() {

        this.active =
            "inventory";

    }



    current() {

        return institutions[this.active]
            ||
            institutions.default;

    }



    set(name) {

        this.active = name;

    }


}



export default new Institution();
