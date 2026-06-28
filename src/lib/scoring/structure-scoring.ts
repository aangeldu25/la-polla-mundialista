// Sistema de puntos por ESTRUCTURA del bracket (separado de los puntos por
// marcador de partidos). Para cada ronda eliminatoria, evalúa si los equipos
// que el usuario predijo en su bracket coinciden con los que efectivamente
// llegaron a esa ronda.
//
// Por partido predicho del usuario en una ronda dada:
// - Duelo Exacto: H_pred == H_actual AND A_pred == A_actual  (absorbe Slot+Clasificado)
// - Slot: equipo predicho == equipo actual EN EL MISMO LADO (home/away)
// - Clasificado: equipo predicho está en la ronda actual pero en otro lugar
//
// Jerarquía por equipo: Slot absorbe Clasificado.
// Jerarquía por partido: Duelo Exacto absorbe Slot+Clasificado de ambos equipos.

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { computeAllGroupStandings } from "@/lib/standings/group-standings";
import { computeDerivedBracket } from "@/lib/standings/knockout-cascade";
import { evalStructureMatch } from "@/lib/scoring/structure-calc";
import type { Match, MatchPrediction, MatchStage } from "@/types/domain";

export interface RoundScoringResult {
  round: MatchStage;
  processedUsers: number;
  pointsAwardedDelta: number;
  ready: boolean;
  reason?: string;
}

// Computa y otorga puntos de estructura para UNA ronda. Idempotente: usa
// `structurePointsByRound[round]` en el user doc para calcular deltas.
export async function scoreStructureForRound(
  round: MatchStage,
): Promise<RoundScoringResult> {
  if (round === "GROUP") {
    return {
      round,
      processedUsers: 0,
      pointsAwardedDelta: 0,
      ready: false,
      reason: "group-stage-not-applicable",
    };
  }

  const matchesSnap = await adminDb.collection("matches").get();
  const allMatches = matchesSnap.docs.map((d) => d.data() as Match);
  const roundMatches = allMatches.filter((m) => m.stage === round);

  if (roundMatches.length === 0) {
    return {
      round,
      processedUsers: 0,
      pointsAwardedDelta: 0,
      ready: false,
      reason: "no-matches-in-round",
    };
  }
  // Progresivo: solo puntuamos los cruces cuyos equipos REALES ya quedaron
  // fijos (al jugarse / definirse). Los que aún son etiquetas se omiten y se
  // acreditarán en un sync posterior. Idempotente vía structurePointsByRound.
  const resolvedMatches = roundMatches.filter(
    (m) => !!m.homeTeam.tla && !!m.awayTeam.tla,
  );
  if (resolvedMatches.length === 0) {
    return {
      round,
      processedUsers: 0,
      pointsAwardedDelta: 0,
      ready: false,
      reason: "teams-not-yet-set",
    };
  }

  const teamsInRound = new Set<string>();
  for (const m of resolvedMatches) {
    teamsInRound.add(m.homeTeam.tla);
    teamsInRound.add(m.awayTeam.tla);
  }

  const usersSnap = await adminDb.collection("users").get();
  const batch = adminDb.batch();
  let totalDelta = 0;
  let processedUsers = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data() as {
      uid: string;
      structurePointsByRound?: Record<string, number>;
    };
    const uid = userData.uid;

    // Cargar predicciones del usuario
    const predsSnap = await adminDb
      .collection("predictions")
      .where("uid", "==", uid)
      .get();
    const predictionsMap = new Map<string, MatchPrediction>();
    predsSnap.docs.forEach((d) => {
      const p = d.data() as MatchPrediction;
      predictionsMap.set(p.matchId, p);
    });

    // Bracket derivado del usuario
    const standings = computeAllGroupStandings(allMatches, predictionsMap);
    const derived = computeDerivedBracket(allMatches, predictionsMap, standings);

    // Calcular puntos de la ronda para este usuario (solo cruces resueltos)
    let userRoundPoints = 0;
    for (const actualMatch of resolvedMatches) {
      const matchNum = actualMatch.matchNumber;
      if (matchNum === undefined) continue;
      const userSlot = derived.get(matchNum);
      if (!userSlot) continue;
      const res = evalStructureMatch(
        userSlot.homeTla,
        userSlot.awayTla,
        actualMatch.homeTeam.tla,
        actualMatch.awayTeam.tla,
        teamsInRound,
      );
      userRoundPoints += res.points;
    }

    const previously = userData.structurePointsByRound?.[round] ?? 0;
    const delta = userRoundPoints - previously;
    if (delta !== 0) {
      batch.update(adminDb.collection("users").doc(uid), {
        [`structurePointsByRound.${round}`]: userRoundPoints,
        totalPoints: FieldValue.increment(delta),
      });
      totalDelta += delta;
    }
    processedUsers++;
  }

  await batch.commit();

  return {
    round,
    processedUsers,
    pointsAwardedDelta: totalDelta,
    ready: true,
  };
}

// Corre el scoring de estructura para todas las rondas posibles.
// Idempotente — se puede llamar después de cada sync sin problemas.
export async function scoreAllStructure(): Promise<{
  totalAwarded: number;
  byRound: Record<string, RoundScoringResult>;
}> {
  const rounds: MatchStage[] = [
    "ROUND_OF_32",
    "ROUND_OF_16",
    "QUARTER_FINAL",
    "SEMI_FINAL",
    "THIRD_PLACE",
    "FINAL",
  ];
  const byRound: Record<string, RoundScoringResult> = {};
  let totalAwarded = 0;
  for (const round of rounds) {
    const r = await scoreStructureForRound(round);
    byRound[round] = r;
    totalAwarded += r.pointsAwardedDelta;
  }
  return { totalAwarded, byRound };
}
