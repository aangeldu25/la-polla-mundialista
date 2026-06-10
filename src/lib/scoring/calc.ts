// Cálculo puro de puntos por predicción de partido.
// No depende de Firebase — pura función matemática.

import type { Match } from "@/types/domain";
import { SCORING } from "@/types/domain";

export interface PointsResult {
  points: number;
  isExact: boolean;
  isWinnerCorrect: boolean;
}

export function calcPredictionPoints(
  prediction: { homeScore: number; awayScore: number },
  match: Match,
): PointsResult {
  const empty: PointsResult = {
    points: 0,
    isExact: false,
    isWinnerCorrect: false,
  };
  if (match.status !== "FINISHED") return empty;
  const homeFullTime = match.score.homeFullTime;
  const awayFullTime = match.score.awayFullTime;
  if (homeFullTime === null || awayFullTime === null) return empty;

  const { homeScore, awayScore } = prediction;

  const isExact = homeScore === homeFullTime && awayScore === awayFullTime;

  const actualWinner =
    homeFullTime > awayFullTime
      ? "HOME"
      : homeFullTime < awayFullTime
        ? "AWAY"
        : "DRAW";
  const predictedWinner =
    homeScore > awayScore ? "HOME" : homeScore < awayScore ? "AWAY" : "DRAW";
  const isWinnerCorrect = actualWinner === predictedWinner;

  const multiplier = SCORING.STAGE_MULTIPLIER[match.stage] ?? 1;
  let points = 0;
  if (isExact) points = SCORING.EXACT_SCORE * multiplier;
  else if (isWinnerCorrect) points = SCORING.CORRECT_WINNER * multiplier;

  return { points, isExact, isWinnerCorrect };
}
