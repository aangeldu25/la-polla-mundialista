"use client";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// El torneo arranca el 11 jun 2026 a las 21:00 UTC = 16:00 Bogotá (UTC-5).
// Esa es la hora de cierre de quinielas: a partir de aquí el Top 3 queda
// congelado en specialPredictions/{uid}.lockedTop3.
export const TOURNAMENT_START_UTC = "2026-06-11T21:00:00Z";

export function isQuinielaLocked(): boolean {
  return Date.now() >= new Date(TOURNAMENT_START_UTC).getTime();
}

// Las quinielas extras ahora solo guardan los 3 premios individuales.
// El Top 3 (Campeón, Subcampeón, Tercer puesto) se deriva automáticamente
// de las predicciones del partido 104 (Final) y 103 (Tercer puesto).
export interface SpecialPredictionDraft {
  topScorerName: string | null;
  goldenBallName: string | null;
  goldenGloveName: string | null;
}

export async function saveSpecialPrediction(
  uid: string,
  draft: SpecialPredictionDraft,
): Promise<void> {
  if (isQuinielaLocked()) {
    throw new Error("Las quinielas ya están bloqueadas");
  }
  const ref = doc(db, "specialPredictions", uid);
  const data = {
    uid,
    topScorerName: draft.topScorerName,
    goldenBallName: draft.goldenBallName,
    goldenGloveName: draft.goldenGloveName,
    pointsAwarded: 0,
    updatedAt: new Date().toISOString(),
    _updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data, { merge: true });
}

// Persiste el snapshot del Top 3 derivado en el momento del cierre.
// Es idempotente: si ya existe no lo sobreescribe.
export async function persistLockedTop3(
  uid: string,
  top3: {
    championTla: string | null;
    runnerUpTla: string | null;
    thirdTla: string | null;
  },
): Promise<void> {
  if (!isQuinielaLocked()) return;
  const ref = doc(db, "specialPredictions", uid);
  await setDoc(
    ref,
    {
      uid,
      lockedTop3: {
        championTla: top3.championTla,
        runnerUpTla: top3.runnerUpTla,
        thirdTla: top3.thirdTla,
        lockedAt: new Date().toISOString(),
      },
      _updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
