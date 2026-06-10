"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/client";
import { isAdmin } from "@/lib/utils";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await fbUpdateProfile(cred.user, { displayName });
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Códigos de error de popup que indican que el navegador NO puede manejar
// popup OAuth (Safari iOS, in-app webviews, browsers con bloqueo estricto).
// En esos casos hacemos fallback a redirect.
const POPUP_FAIL_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (e) {
    const err = e as { code?: string };
    if (err.code && POPUP_FAIL_CODES.has(err.code)) {
      // Fallback a redirect — la página se recarga y getRedirectResult
      // procesa el resultado al volver. Retornamos null porque el usuario
      // termina de loguearse después del redirect (no en esta función).
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw e;
  }
}

// Procesa el resultado de un signInWithRedirect previo.
// Llamar en el AuthProvider al montar.
export async function consumeRedirectResult(): Promise<FirebaseUser | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    // "missing initial state" — el sessionStorage se perdió por partitioning.
    // Es normal en Safari iOS o tras refresh. No es un fallo crítico: el user
    // simplemente tiene que reintentar el login. Lo log con warn, no error.
    if (
      err.message?.includes("missing initial state") ||
      err.code === "auth/no-auth-event"
    ) {
      if (typeof window !== "undefined" && window.console) {
        window.console.warn("[auth] redirect state missing (storage partition)");
      }
      return null;
    }
    throw e;
  }
}

export async function signOut() {
  await fbSignOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  favoriteTeamTla?: string | null;
}) {
  const ref = doc(db, "users", params.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const profile = {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
    photoURL: params.photoURL,
    favoriteTeamTla: params.favoriteTeamTla ?? null,
    createdAt: new Date().toISOString(),
    isAdmin: isAdmin(params.email),
    totalPoints: 0,
    exactScoreHits: 0,
    winnerHits: 0,
    _createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ref = storageRef(storage, `avatars/${uid}.${ext}`);
  await uploadBytes(ref, file, { contentType: file.type });
  return getDownloadURL(ref);
}

export async function updateUserProfile(
  uid: string,
  data: Partial<{
    displayName: string;
    photoURL: string | null;
    favoriteTeamTla: string | null;
  }>,
) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, data, { merge: true });
}
