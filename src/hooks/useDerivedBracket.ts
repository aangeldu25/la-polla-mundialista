"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { computeAllGroupStandings } from "@/lib/standings/group-standings";
import {
  computeDerivedBracket,
  type DerivedBracket,
} from "@/lib/standings/knockout-cascade";
import type { Match, MatchPrediction } from "@/types/domain";
import { useMyPredictions } from "./usePredictions";

// Hook que retorna el bracket DERIVADO del usuario (R32 → R16 → QF → SF →
// Bronce → Final) basado en sus predicciones de fase de grupos y eliminatorias.
//
// Reactive: si el usuario actualiza una predicción, todo el cascade se
// re-deriva automáticamente.
export function useDerivedBracket(uid: string | null | undefined): {
  bracket: DerivedBracket;
  matches: Match[];
} {
  const { predictions } = useMyPredictions(uid);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => d.data() as Match));
    });
    return () => unsub();
  }, []);

  const bracket = useMemo<DerivedBracket>(() => {
    if (matches.length === 0) return new Map();
    const standings = computeAllGroupStandings(matches, predictions);
    return computeDerivedBracket(matches, predictions, standings);
  }, [matches, predictions]);

  return { bracket, matches };
}
