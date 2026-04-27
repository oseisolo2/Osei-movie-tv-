import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC-8FW7yoB6z3igpwleNxUjU1thMLuX0Mk",
  authDomain: "osei-movie-tv.firebaseapp.com",
  databaseURL: "https://osei-movie-tv-default-rtdb.firebaseio.com",
  projectId: "osei-movie-tv",
  storageBucket: "osei-movie-tv.firebasestorage.app",
  messagingSenderId: "420461350561",
  appId: "1:420461350561:web:85100a8aa0acaafa2ceae0",
  measurementId: "G-G19L98QDZE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// Initialize Analytics only in client-side environments
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
