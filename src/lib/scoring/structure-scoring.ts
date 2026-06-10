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
import type { Match, MatchPrediction, MatchStage } from "@/types/domain";

const STAGE_MULTIPLIER: Partial<Record<MatchStage, number>> = {
  ROUND_OF_32: 2,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  THIRD_PLACE: 4,
  FINAL: 5,
};
const BASE_CLASSIFIED = 2;
const BASE_SLOT = 3;
const BASE_EXACT = 5;

function pointsForRound(round: MatchStage) {
  const mult = STAGE_MULTIPLIER[round] ?? 0;
  return {
    classified: BASE_CLASSIFIED * mult,
    slot: BASE_SLOT * mult,
    exact: BASE_EXACT * mult,
  };
}

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
  const allTeamsKnown = roundMatches.every(
    (m) => !!m.homeTeam.tla && !!m.awayTeam.tla,
  );
  if (!allTeamsKnown) {
    return {
      round,
      processedUsers: 0,
      pointsAwardedDelta: 0,
      ready: false,
      reason: "teams-not-yet-set",
    };
  }

  const teamsInRound = new Set<string>();
  for (const m of roundMatches) {
    teamsInRound.add(m.homeTeam.tla);
    teamsInRound.add(m.awayTeam.tla);
  }

  const usersSnap = await adminDb.collection("users").get();
  const pts = pointsForRound(round);
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

    // Calcular puntos de la ronda para este usuario
    let userRoundPoints = 0;
    for (const actualMatch of roundMatches) {
      const matchNum = actualMatch.matchNumber;
      if (matchNum === undefined) continue;
      const userSlot = derived.get(matchNum);
      if (!userSlot) continue;
      const hPred = userSlot.homeTla;
      const aPred = userSlot.awayTla;
      const hActual = actualMatch.homeTeam.tla;
      const aActual = actualMatch.awayTeam.tla;

      // Duelo Exacto (absorbe todo)
      if (hPred && aPred && hPred === hActual && aPred === aActual) {
        userRoundPoints += pts.exact;
        continue;
      }

      // Per-equipo: Slot absorbe Clasificado
      if (hPred) {
        if (hPred === hActual) userRoundPoints += pts.slot;
        else if (teamsInRound.has(hPred)) userRoundPoints += pts.classified;
      }
      if (aPred) {
        if (aPred === aActual) userRoundPoints += pts.slot;
        else if (teamsInRound.has(aPred)) userRoundPoints += pts.classified;
      }
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
