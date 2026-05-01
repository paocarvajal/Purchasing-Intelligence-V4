import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAa57ppjWFUcEdniw9WScABHssyACP3x3k",
  authDomain: "compras-herramax.firebaseapp.com",
  projectId: "compras-herramax",
  storageBucket: "compras-herramax.firebasestorage.app",
  messagingSenderId: "558573642669",
  appId: "1:558573642669:web:b73b4cd1ef5917d416b724",
  measurementId: "G-BWYGHT24ZY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }
        console.error("Error logging in with Google:", error);
        return null;
    }
};

export const logout = () => signOut(auth);

export default app;
