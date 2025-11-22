// js/firebaseConfig.js

// Firebase App (the core library)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
// Firebase Realtime Database
import { getDatabase, ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA3SLxFOgHihiZ-PPt-_BWWRYa3wMNDPXs",
  authDomain: "queue8-e4ba6.firebaseapp.com",
  databaseURL: "https://queue8-e4ba6-default-rtdb.firebaseio.com",
  projectId: "queue8-e4ba6",
  storageBucket: "queue8-e4ba6.firebasestorage.app",
  messagingSenderId: "957739657206",
  appId: "1:957739657206:web:33d52aea84d9f6b920c9d7",
  measurementId: "G-6W02DB5GNC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue, push, remove };
