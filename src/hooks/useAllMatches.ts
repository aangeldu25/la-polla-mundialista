"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Match } from "@/types/domain";

// Suscripción reactiva a todos los partidos, ordenados por fecha.
// Se recalcula solo cuando Firestore notifica cambios (marcadores, estados),
// así las estadísticas derivadas quedan en vivo sin costo extra.
export function useAllMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMatches(snap.docs.map((d) => d.data() as Match));
        setLoading(false);
      },
      (e) => {
        console.error("[useAllMatches]", e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { matches, loading };
}
