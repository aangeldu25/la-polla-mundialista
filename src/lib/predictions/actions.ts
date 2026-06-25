"use client";

import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { MatchPrediction } from "@/types/domain";

// ID compuesto: {uid}_{matchId} — garantiza una predicción por usuario-partido.
export const predictionId = (uid: string, matchId: string) =>
  `${uid}_${matchId}`;

export async function savePrediction(params: {
  uid: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  advancingTeamTla?: string | null;
  realAdvancingTla?: string | null;
}): Promise<void> {
  const {
    uid,
    matchId,
    homeScore,
    awayScore,
    advancingTeamTla,
    realAdvancingTla,
  } = params;
  if (
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0 ||
    homeScore > 20 ||
    awayScore > 20
  ) {
    throw new Error("Marcador inválido");
  }
  const id = predictionId(uid, matchId);
  const ref = doc(db, "predictions", id);
  const now = new Date().toISOString();

  const data: Omit<MatchPrediction, "pointsAwarded" | "isExact" | "isWinnerCorrect"> & {
    pointsAwarded: null;
    isExact: null;
    isWinnerCorrect: null;
    _updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    uid,
    matchId,
    homeScore,
    awayScore,
    advancingTeamTla: advancingTeamTla ?? null,
    realAdvancingTla: realAdvancingTla ?? null,
    pointsAwarded: null,
    isExact: null,
    isWinnerCorrect: null,
    createdAt: now,
    updatedAt: now,
    _updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data, { merge: true });
}

export async function fetchUserPredictions(
  uid: string,
): Promise<MatchPrediction[]> {
  const q = query(collection(db, "predictions"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as MatchPrediction);
}
