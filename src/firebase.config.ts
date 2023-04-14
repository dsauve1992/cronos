// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC-GB4pBCv4Tj1qUlZb0C80376nLiGCeRY",
    authDomain: "cronos-12sew34d454fg5.firebaseapp.com",
    databaseURL: "https://cronos-12sew34d454fg5-default-rtdb.firebaseio.com",
    projectId: "cronos-12sew34d454fg5",
    storageBucket: "cronos-12sew34d454fg5.appspot.com",
    messagingSenderId: "616477074244",
    appId: "1:616477074244:web:25b2ee719c200db04ced11"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app)
