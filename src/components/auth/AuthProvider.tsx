"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { consumeRedirectResult } from "@/lib/auth/actions";
import type { UserProfile } from "@/types/domain";

interface AuthContextValue {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  needsOnboarding: false,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Procesar resultado de signInWithRedirect si venimos de un fallback OAuth
    // (Safari iOS, in-app browsers, etc.). Silenciamos los errores de
    // "missing initial state" que pasan por storage partitioning.
    void consumeRedirectResult();

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        if (!u) {
          setProfile(null);
          setLoading(false);
        }
      },
      (e) => {
        console.error("[AuthProvider] auth error:", e);
        setError(e.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setLoading(false);
      },
      (e) => {
        // Crítico: si Firestore deniega la lectura (rules no desplegadas),
        // no podemos quedarnos en loading=true para siempre.
        console.error("[AuthProvider] profile snapshot error:", e);
        setError(
          e.code === "permission-denied"
            ? "Permisos insuficientes en Firestore. Las reglas de seguridad no están desplegadas. Ver consola para más detalle."
            : e.message,
        );
        setProfile(null);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const needsOnboarding = !!user && !loading && !profile && !error;

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, needsOnboarding, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
