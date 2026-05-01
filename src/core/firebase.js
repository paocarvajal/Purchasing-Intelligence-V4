import { initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    getAuth,
    getRedirectResult,
    GoogleAuthProvider,
    setPersistence,
    signInWithPopup,
    signInWithRedirect,
    signOut,
} from "firebase/auth";
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
googleProvider.setCustomParameters({ prompt: "select_account" });

export const firebaseProject = {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
};

setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Error setting Firebase persistence:", error);
});

export const readRedirectLoginResult = async () => {
    try {
        return await getRedirectResult(auth);
    } catch (error) {
        console.error("Error completing Google redirect:", error);
        throw error;
    }
};

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        if ([
            "auth/popup-blocked",
            "auth/cancelled-popup-request",
            "auth/popup-closed-by-user",
            "auth/operation-not-supported-in-this-environment",
        ].includes(error.code)) {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }
        console.error("Error logging in with Google:", error);
        throw error;
    }
};

export const logout = () => signOut(auth);

export default app;
