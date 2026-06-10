"use client";

// Contexto de "polla activa": qué grupo está viendo el usuario.
// La elección persiste en localStorage. Si el usuario pertenece a una sola
// polla se selecciona automáticamente.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyPollas, usePollaMemberUids } from "@/hooks/usePollas";
import { joinPollaByCode } from "@/lib/pollas/actions";
import type { Polla } from "@/types/domain";

const PENDING_INVITE_KEY = "pmp.pendingInviteCode";

interface ActivePollaContextValue {
  pollas: Polla[];
  activePolla: Polla | null;
  setActivePollaId: (id: string) => void;
  /** UIDs de los miembros de la polla activa (para filtrar ranking/chisme). */
  memberUids: string[];
  loading: boolean;
}

const ActivePollaContext = createContext<ActivePollaContextValue>({
  pollas: [],
  activePolla: null,
  setActivePollaId: () => {},
  memberUids: [],
  loading: true,
});

const STORAGE_KEY = "pmp.activePollaId";

export function ActivePollaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pollas, loading } = useMyPollas(user?.uid);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Restaurar selección guardada
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveId(stored);
  }, []);

  // Canjear invitación pendiente (guardada cuando el usuario abrió un link
  // /unirse/{code} sin sesión). Se ejecuta una sola vez al tener usuario.
  useEffect(() => {
    if (!user) return;
    const code = localStorage.getItem(PENDING_INVITE_KEY);
    if (!code) return;
    localStorage.removeItem(PENDING_INVITE_KEY);
    joinPollaByCode(user.uid, code)
      .then((polla) => {
        setActiveId(polla.id);
        localStorage.setItem(STORAGE_KEY, polla.id);
      })
      .catch((e) => console.error("[pendingInvite]", e));
  }, [user]);

  // Resolver la polla activa: la guardada si sigue siendo válida, si no la primera
  const activePolla = useMemo(() => {
    if (pollas.length === 0) return null;
    return pollas.find((p) => p.id === activeId) ?? pollas[0];
  }, [pollas, activeId]);

  const { uids: memberUids } = usePollaMemberUids(activePolla?.id ?? null);

  function setActivePollaId(id: string) {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const value = useMemo(
    () => ({ pollas, activePolla, setActivePollaId, memberUids, loading }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pollas, activePolla, memberUids, loading],
  );

  return (
    <ActivePollaContext.Provider value={value}>
      {children}
    </ActivePollaContext.Provider>
  );
}

export function useActivePolla() {
  return useContext(ActivePollaContext);
}
