// Import functions from Firebase SDK (using CDN for direct browser use)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCmIxGRR68liiah1r9bzJMT_RGIuX_iRRo",
    authDomain: "porto-32040.firebaseapp.com",
    projectId: "porto-32040",
    storageBucket: "porto-32040.firebasestorage.app",
    messagingSenderId: "577144012078",
    appId: "1:577144012078:web:81131d2963f021a61a4ebf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export for other scripts
export { auth, db, storage };
