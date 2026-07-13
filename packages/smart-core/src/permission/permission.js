import Auth from "../auth/auth.js";

const roles = {

    owner: {

        name: "Owner",

        permissions: [

            "dashboard.view",

            "barang.view",

            "barang.create",

            "barang.update",

            "barang.delete",

            "supplier.view",

            "supplier.create",

            "pembelian.view",

            "pembelian.create",

            "report.view",

            "setting.manage"

        ]

    },


    manager: {

        name: "Manager",

        permissions: [

            "dashboard.view",

            "barang.view",

            "barang.create",

            "barang.update",

            "supplier.view",

            "pembelian.view",

            "pembelian.create",

            "report.view"

        ]

    },


    operator: {

        name: "Operator Gudang",

        permissions: [

            "dashboard.view",

            "barang.view",

            "pembelian.view"

        ]

    }

};



class Permission {


    constructor() {

        this.role = null;

    }



    currentRole() {

        const user =
            Auth.user();


        if (!user) {

            return null;

        }


        return roles[user.role];

    }



    can(permission) {


        const current =
            this.currentRole();



        if (!current) {

            return false;

        }



        return current.permissions.includes(
            permission
        );


    }



    setRole(role) {

        if (roles[role]) {

            this.role = role;

        }

    }



    menu() {


        const permissions =
            this.currentRole()
                .permissions;



        return permissions;

    }


}


export default new Permission();
