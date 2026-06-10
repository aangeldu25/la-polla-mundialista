import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// authDomain debe coincidir con el dominio donde corre la app (no el default
// de firebaseapp.com), para que el OAuth de Google se complete sin cambiar
// de dominio y evite el storage partitioning de Safari iOS.
// En SSR usamos un fallback (no se ejecuta auth durante SSR).
function resolveAuthDomain(): string {
  if (typeof window !== "undefined") return window.location.host;
  return (
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "la-polla-mundialista-2026-seven.vercel.app"
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

// Persistencia robusta para navegadores con storage partitioning (Safari iOS,
// Brave, Firefox strict). IndexedDB sobrevive a la partición de cookies
// y al borrado de sessionStorage de terceros que pasa con el OAuth de Google.
// Fallback a localStorage si IndexedDB no está disponible (modo incógnito).
if (typeof window !== "undefined") {
  setPersistence(auth, indexedDBLocalPersistence).catch(() => {
    return setPersistence(auth, browserLocalPersistence).catch(() => {
      // último fallback: in-memory (sesión se pierde al cerrar pestaña)
    });
  });
}
