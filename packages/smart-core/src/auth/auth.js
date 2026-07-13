const users = {

    admin: {

        id: "USR001",

        name: "Administrator",

        email: "admin@smart.id",

        institution: "INV001",

        role: "owner"

    },


    operator: {

        id: "USR002",

        name: "Operator Gudang",

        email: "operator@smart.id",

        institution: "INV001",

        role: "operator"

    }

};



class Auth {


    constructor() {

        this.currentUser =
            null;

    }



    login(username) {


        const user =
            users[username];



        if (!user) {

            return false;

        }



        this.currentUser =
            user;



        return true;

    }



    logout() {


        this.currentUser =
            null;


    }



    isLoggedIn() {


        return this.currentUser
            !== null;


    }



    user() {


        return this.currentUser;


    }



}



export default new Auth();
