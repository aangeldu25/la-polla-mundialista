import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { calcPredictionPoints } from "./calc";
import type { Match, MatchPrediction } from "@/types/domain";

export interface ScoreMatchResult {
  matchId: string;
  predictions: number;
  uniqueUsers: number;
  totalPointsAwarded: number;
  orphansSkipped?: number;
  skipped?: boolean;
  reason?: string;
}

// Calcula puntos para un partido terminado. Idempotente: si el partido ya tiene
// `pointsCalculated: true`, se salta. Para recalcular, usar `force = true`
// (este modo revierte primero los puntos previos antes de aplicar nuevos).
export async function scoreMatch(
  matchId: string,
  options: { force?: boolean } = {},
): Promise<ScoreMatchResult> {
  const matchRef = adminDb.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    return {
      matchId,
      predictions: 0,
      uniqueUsers: 0,
      totalPointsAwarded: 0,
      skipped: true,
      reason: "match-not-found",
    };
  }
  const match = matchSnap.data() as Match & { pointsCalculated?: boolean };
  if (match.status !== "FINISHED") {
    return {
      matchId,
      predictions: 0,
      uniqueUsers: 0,
      totalPointsAwarded: 0,
      skipped: true,
      reason: "not-finished",
    };
  }
  // Football-Data a veces marca FINISHED antes de publicar el marcador.
  // Sin marcador no se puede puntuar — saltamos SIN marcar pointsCalculated
  // para que el siguiente sync lo reintente cuando el score llegue.
  if (
    match.score.homeFullTime === null ||
    match.score.awayFullTime === null
  ) {
    return {
      matchId,
      predictions: 0,
      uniqueUsers: 0,
      totalPointsAwarded: 0,
      skipped: true,
      reason: 'no-score-yet',
    };
  }
  if (match.pointsCalculated && !options.force) {
    return {
      matchId,
      predictions: 0,
      uniqueUsers: 0,
      totalPointsAwarded: 0,
      skipped: true,
      reason: "already-calculated",
    };
  }

  const predsSnap = await adminDb
    .collection("predictions")
    .where("matchId", "==", matchId)
    .get();

  // Conjunto de UIDs con perfil válido en /users. Predicciones de UIDs que
  // ya no existen (cuentas duplicadas borradas) son huérfanas y se ignoran.
  const usersSnap = await adminDb.collection("users").get();
  const validUids = new Set(usersSnap.docs.map((d) => d.id));

  const batch = adminDb.batch();
  const byUser = new Map<
    string,
    { addPoints: number; addExacts: number; addWinners: number }
  >();
  let totalPointsAwarded = 0;
  let orphansSkipped = 0;

  for (const doc of predsSnap.docs) {
    const pred = doc.data() as MatchPrediction;

    // Saltar predicciones huérfanas (cuentas que ya no existen)
    if (!validUids.has(pred.uid)) {
      orphansSkipped++;
      continue;
    }

    const calc = calcPredictionPoints(pred, match);

    // Si force=true y la predicción ya tenía puntos, revertimos primero.
    const prevPoints = pred.pointsAwarded ?? 0;
    const prevWasExact = pred.isExact === true;
    const prevWasWinner = pred.isWinnerCorrect === true && !prevWasExact;

    batch.update(doc.ref, {
      pointsAwarded: calc.points,
      isExact: calc.isExact,
      isWinnerCorrect: calc.isWinnerCorrect,
    });

    const delta = {
      addPoints: calc.points - prevPoints,
      addExacts: (calc.isExact ? 1 : 0) - (prevWasExact ? 1 : 0),
      addWinners:
        (!calc.isExact && calc.isWinnerCorrect ? 1 : 0) -
        (prevWasWinner ? 1 : 0),
    };

    const u =
      byUser.get(pred.uid) ?? {
        addPoints: 0,
        addExacts: 0,
        addWinners: 0,
      };
    u.addPoints += delta.addPoints;
    u.addExacts += delta.addExacts;
    u.addWinners += delta.addWinners;
    byUser.set(pred.uid, u);
    totalPointsAwarded += calc.points;
  }

  for (const [uid, delta] of byUser.entries()) {
    if (delta.addPoints === 0 && delta.addExacts === 0 && delta.addWinners === 0) continue;
    const userRef = adminDb.collection("users").doc(uid);
    batch.update(userRef, {
      totalPoints: FieldValue.increment(delta.addPoints),
      exactScoreHits: FieldValue.increment(delta.addExacts),
      winnerHits: FieldValue.increment(delta.addWinners),
    });
  }

  batch.update(matchRef, { pointsCalculated: true });

  await batch.commit();

  return {
    matchId,
    predictions: predsSnap.size,
    uniqueUsers: byUser.size,
    totalPointsAwarded,
    orphansSkipped,
  };
}

// Score múltiples partidos
export async function scoreMatches(
  matchIds: string[],
  options: { force?: boolean } = {},
): Promise<ScoreMatchResult[]> {
  const out: ScoreMatchResult[] = [];
  for (const id of matchIds) {
    try {
      out.push(await scoreMatch(id, options));
    } catch (e) {
      const err = e as Error;
      out.push({
        matchId: id,
        predictions: 0,
        uniqueUsers: 0,
        totalPointsAwarded: 0,
        skipped: true,
        reason: `error: ${err.message}`,
      });
    }
  }
  return out;
}

// Procesa TODOS los partidos FINISHED (útil como recalc total).
export async function scoreAllFinishedMatches(
  options: { force?: boolean } = {},
): Promise<{
  matchesProcessed: number;
  totalPointsAwarded: number;
  details: ScoreMatchResult[];
}> {
  const snap = await adminDb
    .collection("matches")
    .where("status", "==", "FINISHED")
    .get();
  const ids = snap.docs.map((d) => d.id);
  const details = await scoreMatches(ids, options);
  const matchesProcessed = details.filter((d) => !d.skipped).length;
  const totalPointsAwarded = details.reduce(
    (s, d) => s + d.totalPointsAwarded,
    0,
  );
  return { matchesProcessed, totalPointsAwarded, details };
}
