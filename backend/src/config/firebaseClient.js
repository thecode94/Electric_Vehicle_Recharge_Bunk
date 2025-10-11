const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");

const firebaseConfig = {
    apiKey: "AIzaSyASUpSvPF-k-NO1tDDLmB8iwLu8vzidO_w",
    authDomain: "evcharge-ff33f.firebaseapp.com",
    databaseURL: "https://evcharge-ff33f-default-rtdb.firebaseio.com",
    projectId: "evcharge-ff33f",
    storageBucket: "evcharge-ff33f.firebasestorage.app",
    messagingSenderId: "934838304598",
    appId: "1:934838304598:web:084976608817240925e0f7",
    measurementId: "G-Z75H4Q5NFQ"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

module.exports = auth;
