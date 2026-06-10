"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface StoredSpecialPrediction {
  uid: string;
  topScorerName: string | null;
  goldenBallName: string | null;
  goldenGloveName: string | null;
  pointsAwarded?: number;
  updatedAt?: string;
  lockedTop3?: {
    championTla: string | null;
    runnerUpTla: string | null;
    thirdTla: string | null;
    lockedAt: string;
  } | null;
}

export function useMySpecialPrediction(uid: string | null | undefined) {
  const [data, setData] = useState<StoredSpecialPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setData(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, "specialPredictions", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as StoredSpecialPrediction) : null);
        setLoading(false);
      },
      (e) => {
        console.error("[useMySpecialPrediction]", e);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid]);

  return { data, loading };
}

// Quinielas especiales de un conjunto de usuarios (miembros de la polla
// activa). El docId es el uid, así que usamos documentId() in chunks de 30.
// Nunca lee la colección completa — clave para escalar barato.
export function useSpecialPredictionsForUids(uids: string[]) {
  const [list, setList] = useState<StoredSpecialPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  const key = [...uids].sort().join(",");

  useEffect(() => {
    if (uids.length === 0) {
      setList([]);
      setLoading(false);
      return;
    }
    const sorted = [...uids].sort();
    const chunks: string[][] = [];
    for (let i = 0; i < sorted.length; i += 30) {
      chunks.push(sorted.slice(i, i + 30));
    }
    const byChunk = new Map<number, StoredSpecialPrediction[]>();
    const recombine = () => {
      setList(Array.from(byChunk.values()).flat());
      setLoading(false);
    };
    const unsubs = chunks.map((chunk, idx) =>
      onSnapshot(
        query(
          collection(db, "specialPredictions"),
          where(documentId(), "in", chunk),
        ),
        (snap) => {
          byChunk.set(
            idx,
            snap.docs.map((d) => d.data() as StoredSpecialPrediction),
          );
          recombine();
        },
        (e) => {
          console.error("[useSpecialPredictionsForUids]", e);
          setLoading(false);
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { list, loading };
}
