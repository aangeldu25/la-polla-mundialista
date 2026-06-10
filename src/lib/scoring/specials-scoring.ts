import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { SCORING } from "@/types/domain";
import type { Match, MatchPrediction } from "@/types/domain";

export interface TournamentResults {
  topScorerName: string | null;
  goldenBallName: string | null;
  goldenGloveName: string | null;
  isFinalized: boolean;
}

interface StoredSpecial {
  uid: string;
  topScorerName: string | null;
  goldenBallName: string | null;
  goldenGloveName: string | null;
  pointsAwarded?: number;
  lockedTop3?: {
    championTla: string | null;
    runnerUpTla: string | null;
    thirdTla: string | null;
    lockedAt: string;
  } | null;
}

interface UserBreakdown {
  uid: string;
  points: number;
  breakdown: {
    champion?: number;
    runnerUp?: number;
    third?: number;
    topScorer?: number;
    goldenBall?: number;
    goldenGlove?: number;
  };
}

// Determina ganador de un partido considerando 90' + penales
function winnerOf(match: Match): "HOME" | "AWAY" | "DRAW" | null {
  const home = match.score.homeFullTime;
  const away = match.score.awayFullTime;
  if (home === null || away === null) return null;
  const homePen = match.score.homePenalties;
  const awayPen = match.score.awayPenalties;
  if (home === away && homePen != null && awayPen != null) {
    if (homePen > awayPen) return "HOME";
    if (awayPen > homePen) return "AWAY";
  }
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

function predictedWinnerFromMarker(p: MatchPrediction): "HOME" | "AWAY" | "DRAW" {
  if (p.homeScore > p.awayScore) return "HOME";
  if (p.awayScore > p.homeScore) return "AWAY";
  return "DRAW";
}

export interface SpecialsScoringResult {
  processedUsers: number;
  totalPointsAwarded: number;
  details: UserBreakdown[];
  actualResults: {
    champion: string | null;
    runnerUp: string | null;
    third: string | null;
    topScorerName: string | null;
    goldenBallName: string | null;
    goldenGloveName: string | null;
  };
}

// Calcula y otorga puntos de quinielas especiales:
// - Campeón, Subcampeón, 3er lugar: derivados de los marcadores reales de los
//   partidos 104 (Final) y 103 (Tercer puesto) contra las predicciones de
//   esos partidos de cada usuario.
// - Goleador, Balón de Oro, Guante de Oro: comparados contra los IDs de
//   jugador almacenados en tournament/results (ingresados por admin).
//
// Es idempotente: aplica deltas usando pointsAwarded previo de specialPredictions.
export async function scoreSpecials(): Promise<SpecialsScoringResult> {
  const resultsSnap = await adminDb
    .collection("tournament")
    .doc("results")
    .get();
  if (!resultsSnap.exists) {
    throw new Error(
      "tournament/results no existe — primero ingresa los premios finales",
    );
  }
  const results = resultsSnap.data() as TournamentResults;

  // Cargar partidos 103 y 104 (por matchNumber)
  const matchesSnap = await adminDb
    .collection("matches")
    .where("matchNumber", "in", [103, 104])
    .get();
  const matches103104 = matchesSnap.docs.map((d) => d.data() as Match);
  const finalMatch = matches103104.find((m) => m.matchNumber === 104);
  const bronzeMatch = matches103104.find((m) => m.matchNumber === 103);

  // Resultados reales
  let actualChampion: string | null = null;
  let actualRunnerUp: string | null = null;
  let actualThird: string | null = null;
  if (finalMatch && finalMatch.status === "FINISHED") {
    const w = winnerOf(finalMatch);
    if (w === "HOME") {
      actualChampion = finalMatch.homeTeam.tla;
      actualRunnerUp = finalMatch.awayTeam.tla;
    } else if (w === "AWAY") {
      actualChampion = finalMatch.awayTeam.tla;
      actualRunnerUp = finalMatch.homeTeam.tla;
    }
  }
  if (bronzeMatch && bronzeMatch.status === "FINISHED") {
    const w = winnerOf(bronzeMatch);
    if (w === "HOME") actualThird = bronzeMatch.homeTeam.tla;
    else if (w === "AWAY") actualThird = bronzeMatch.awayTeam.tla;
  }

  // Cargar predicciones de los partidos 103, 104
  const matchIdsForTop3: string[] = [];
  if (finalMatch) matchIdsForTop3.push(finalMatch.id);
  if (bronzeMatch) matchIdsForTop3.push(bronzeMatch.id);
  const userPreds = new Map<
    string,
    { final?: MatchPrediction; bronze?: MatchPrediction }
  >();
  if (matchIdsForTop3.length > 0) {
    const predsSnap = await adminDb
      .collection("predictions")
      .where("matchId", "in", matchIdsForTop3)
      .get();
    predsSnap.docs.forEach((d) => {
      const p = d.data() as MatchPrediction;
      const ex = userPreds.get(p.uid) ?? {};
      if (finalMatch && p.matchId === finalMatch.id) ex.final = p;
      if (bronzeMatch && p.matchId === bronzeMatch.id) ex.bronze = p;
      userPreds.set(p.uid, ex);
    });
  }

  // Cargar quinielas especiales de todos
  const specialsSnap = await adminDb.collection("specialPredictions").get();

  const batch = adminDb.batch();
  const details: UserBreakdown[] = [];
  let totalPointsAwarded = 0;
  let processedUsers = 0;

  for (const doc of specialsSnap.docs) {
    const sp = doc.data() as StoredSpecial;
    const uid = sp.uid;
    let points = 0;
    const breakdown: UserBreakdown["breakdown"] = {};

    // Derivar predicción de Top 3 del usuario.
    // 1) Prioridad al snapshot bloqueado al cierre de quinielas
    //    (specialPredictions.lockedTop3). Eso es lo que el usuario "se llevó"
    //    al momento del cierre y es lo que debe puntuar.
    // 2) Fallback a derivar de las predicciones live de #103/#104 (compatibilidad
    //    con usuarios que no tienen snapshot aún).
    const preds = userPreds.get(uid);
    let predChampion: string | null = null;
    let predRunnerUp: string | null = null;
    let predThird: string | null = null;

    if (sp.lockedTop3) {
      predChampion = sp.lockedTop3.championTla;
      predRunnerUp = sp.lockedTop3.runnerUpTla;
      predThird = sp.lockedTop3.thirdTla;
    } else {
      if (
        preds?.final &&
        finalMatch?.homeTeam.tla &&
        finalMatch.homeTeam.tla.length > 0 &&
        finalMatch?.awayTeam.tla &&
        finalMatch.awayTeam.tla.length > 0
      ) {
        const w = predictedWinnerFromMarker(preds.final);
        if (w === "HOME") {
          predChampion = finalMatch.homeTeam.tla;
          predRunnerUp = finalMatch.awayTeam.tla;
        } else if (w === "AWAY") {
          predChampion = finalMatch.awayTeam.tla;
          predRunnerUp = finalMatch.homeTeam.tla;
        }
      }
      if (
        preds?.bronze &&
        bronzeMatch?.homeTeam.tla &&
        bronzeMatch.homeTeam.tla.length > 0 &&
        bronzeMatch?.awayTeam.tla &&
        bronzeMatch.awayTeam.tla.length > 0
      ) {
        const w = predictedWinnerFromMarker(preds.bronze);
        if (w === "HOME") predThird = bronzeMatch.homeTeam.tla;
        else if (w === "AWAY") predThird = bronzeMatch.awayTeam.tla;
      }
    }

    if (actualChampion && predChampion === actualChampion) {
      points += SCORING.SPECIALS.CHAMPION;
      breakdown.champion = SCORING.SPECIALS.CHAMPION;
    }
    if (actualRunnerUp && predRunnerUp === actualRunnerUp) {
      points += SCORING.SPECIALS.RUNNER_UP;
      breakdown.runnerUp = SCORING.SPECIALS.RUNNER_UP;
    }
    if (actualThird && predThird === actualThird) {
      points += SCORING.SPECIALS.THIRD_PLACE;
      breakdown.third = SCORING.SPECIALS.THIRD_PLACE;
    }
    if (
      results.topScorerName &&
      sp.topScorerName === results.topScorerName
    ) {
      points += SCORING.SPECIALS.TOP_SCORER;
      breakdown.topScorer = SCORING.SPECIALS.TOP_SCORER;
    }
    if (
      results.goldenBallName &&
      sp.goldenBallName === results.goldenBallName
    ) {
      points += SCORING.SPECIALS.GOLDEN_BALL;
      breakdown.goldenBall = SCORING.SPECIALS.GOLDEN_BALL;
    }
    if (
      results.goldenGloveName &&
      sp.goldenGloveName === results.goldenGloveName
    ) {
      points += SCORING.SPECIALS.GOLDEN_GLOVE;
      breakdown.goldenGlove = SCORING.SPECIALS.GOLDEN_GLOVE;
    }

    const prevPoints = sp.pointsAwarded ?? 0;
    const delta = points - prevPoints;
    batch.update(doc.ref, { pointsAwarded: points });
    if (delta !== 0) {
      const userRef = adminDb.collection("users").doc(uid);
      batch.update(userRef, {
        totalPoints: FieldValue.increment(delta),
      });
    }
    totalPointsAwarded += points;
    processedUsers++;
    details.push({ uid, points, breakdown });
  }

  // Marcar resultados como finalizados
  batch.update(resultsSnap.ref, { isFinalized: true });

  await batch.commit();

  return {
    processedUsers,
    totalPointsAwarded,
    details,
    actualResults: {
      champion: actualChampion,
      runnerUp: actualRunnerUp,
      third: actualThird,
      topScorerName: results.topScorerName,
      goldenBallName: results.goldenBallName,
      goldenGloveName: results.goldenGloveName,
    },
  };
}
