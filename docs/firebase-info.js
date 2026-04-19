
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB4ND92IdQYE2sL1-oollJB1VHqbQko5FI",
  authDomain: "claw-hq-altovation.firebaseapp.com",
  projectId: "claw-hq-altovation",
  storageBucket: "claw-hq-altovation.firebasestorage.app",
  messagingSenderId: "165082918368",
  appId: "1:165082918368:web:11e561f37cd9a93e730f85",
  measurementId: "G-DNMLS5SP32"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);