import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ข้อมูล Firebase Config ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyC2LO8ZwG94bJ-EOveiFOdlMFnv2wJ_ixM",
  authDomain: "pp5sh-7c41b.firebaseapp.com",
  projectId: "pp5sh-7c41b",
  storageBucket: "pp5sh-7c41b.firebasestorage.app",
  messagingSenderId: "846527421476",
  appId: "1:846527421476:web:61f3c97f5ebd6764458cb1",
  measurementId: "G-BE87XY81TK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
