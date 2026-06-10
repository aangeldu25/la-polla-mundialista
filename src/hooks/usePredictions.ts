"use client";

import { useEffect, useState } from "react";
import {
  collection,
  documentId,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { MatchPrediction, UserProfile } from "@/types/domain";

// Predicciones del usuario actual, indexadas por matchId.
export function useMyPredictions(uid: string | null | undefined) {
  const [map, setMap] = useState<Map<string, MatchPrediction>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setMap(new Map());
      setLoading(false);
      return;
    }
    const q = query(collection(db, "predictions"), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = new Map<string, MatchPrediction>();
        snap.forEach((d) => {
          const p = d.data() as MatchPrediction;
          next.set(p.matchId, p);
        });
        setMap(next);
        setLoading(false);
      },
      (e) => {
        console.error("[usePredictions]", e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid]);

  return { predictions: map, loading };
}

// Todas las predicciones de un set de partidos, agrupadas por uid->matchId.
// Útil para derivar info desde los matches 103/104 a través de todos los usuarios.
export function useAllPredictionsForMatches(matchIds: string[]) {
  const [data, setData] = useState<Map<string, Map<string, MatchPrediction>>>(
    new Map(),
  );

  const key = [...matchIds].sort().join(",");

  useEffect(() => {
    if (matchIds.length === 0) {
      setData(new Map());
      return;
    }
    const q = query(
      collection(db, "predictions"),
      where("matchId", "in", matchIds.slice(0, 30)),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const m = new Map<string, Map<string, MatchPrediction>>();
        snap.forEach((d) => {
          const p = d.data() as MatchPrediction;
          const inner = m.get(p.uid) ?? new Map<string, MatchPrediction>();
          inner.set(p.matchId, p);
          m.set(p.uid, inner);
        });
        setData(m);
      },
      (e) => console.error("[useAllPredictionsForMatches]", e),
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}

// Carga TODAS las predicciones de un conjunto de usuarios, agrupadas por
// uid → matchId. Útil para derivar el bracket de cada usuario en el chisme
// de eliminatorias (donde cada usuario tiene equipos distintos en cada slot).
export function useAllPredictionsForUsers(uids: string[]) {
  const [data, setData] = useState<Map<string, Map<string, MatchPrediction>>>(
    new Map(),
  );

  const key = [...uids].sort().join(",");

  useEffect(() => {
    if (uids.length === 0) {
      setData(new Map());
      return;
    }
    // Firestore "in" tiene límite de 30 valores → chunks paralelos
    const sorted = [...uids].sort();
    const chunks: string[][] = [];
    for (let i = 0; i < sorted.length; i += 30) {
      chunks.push(sorted.slice(i, i + 30));
    }
    // Acumulamos por chunk y combinamos en cada snapshot
    const byChunk = new Map<number, Map<string, Map<string, MatchPrediction>>>();
    const recombine = () => {
      const m = new Map<string, Map<string, MatchPrediction>>();
      for (const part of byChunk.values()) {
        for (const [uid, inner] of part.entries()) m.set(uid, inner);
      }
      setData(m);
    };
    const unsubs = chunks.map((chunk, idx) =>
      onSnapshot(
        query(collection(db, "predictions"), where("uid", "in", chunk)),
        (snap) => {
          const part = new Map<string, Map<string, MatchPrediction>>();
          snap.forEach((d) => {
            const p = d.data() as MatchPrediction;
            const inner = part.get(p.uid) ?? new Map<string, MatchPrediction>();
            inner.set(p.matchId, p);
            part.set(p.uid, inner);
          });
          byChunk.set(idx, part);
          recombine();
        },
        (e) => console.error("[useAllPredictionsForUsers]", e),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}

// Todas las predicciones de un partido específico (chisme).
export function useMatchPredictions(matchId: string | null) {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "predictions"),
      where("matchId", "==", matchId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPredictions(snap.docs.map((d) => d.data() as MatchPrediction));
        setLoading(false);
      },
      (e) => {
        console.error("[useMatchPredictions]", e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [matchId]);

  return { predictions, loading };
}

// Perfiles de un conjunto de usuarios (miembros de la polla activa).
// Usa chunks de 30 por el límite del operador "in" de Firestore.
// NUNCA lee la colección completa de usuarios — clave para escalar barato.
export function useProfilesForUids(uids: string[]) {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());

  const key = [...uids].sort().join(",");

  useEffect(() => {
    if (uids.length === 0) {
      setProfiles(new Map());
      return;
    }
    const chunks: string[][] = [];
    const sorted = [...uids].sort();
    for (let i = 0; i < sorted.length; i += 30) {
      chunks.push(sorted.slice(i, i + 30));
    }
    const accumulated = new Map<string, UserProfile>();
    const unsubs = chunks.map((chunk) =>
      onSnapshot(
        query(collection(db, "users"), where(documentId(), "in", chunk)),
        (snap) => {
          snap.forEach((d) => accumulated.set(d.id, d.data() as UserProfile));
          setProfiles(new Map(accumulated));
        },
        (e) => console.error("[useProfilesForUids]", e),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return profiles;
}
