// Calcula tabla de posiciones por grupo, basada en las predicciones del usuario.
// Aplica los criterios de desempate FIFA simplificados (sin head-to-head ni
// conducta — no tenemos esa data del API gratis. Fallback a orden alfabético
// de TLA cuando todo lo demás empata).

import { WC2026_GROUPS } from "@/lib/constants/wc2026-groups";
import type { Match, MatchPrediction } from "@/types/domain";

export interface TeamStanding {
  teamTla: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  points: number;
  // Marca si todos los partidos de este equipo en el grupo tienen predicción.
  // Si no, la tabla es "parcial" y la posición puede cambiar.
  allMatchesPredicted: boolean;
}

// Aplica el resultado de una predicción a las estadísticas de un equipo
function applyToTeam(
  team: TeamStanding,
  scoredFor: number,
  scoredAgainst: number,
): void {
  team.played++;
  team.goalsFor += scoredFor;
  team.goalsAgainst += scoredAgainst;
  team.goalsDiff = team.goalsFor - team.goalsAgainst;
  if (scoredFor > scoredAgainst) {
    team.wins++;
    team.points += 3;
  } else if (scoredFor < scoredAgainst) {
    team.losses++;
  } else {
    team.draws++;
    team.points += 1;
  }
}

// Construye standings para un solo grupo
export function computeGroupStandings(
  group: string,
  allMatches: Match[],
  myPredictions: Map<string, MatchPrediction>,
): TeamStanding[] {
  const teamTlas = WC2026_GROUPS[group] ?? [];
  const standings: Record<string, TeamStanding> = {};
  for (const tla of teamTlas) {
    standings[tla] = {
      teamTla: tla,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalsDiff: 0,
      points: 0,
      allMatchesPredicted: true,
    };
  }

  const groupMatches = allMatches.filter(
    (m) =>
      m.stage === "GROUP" &&
      m.group === group &&
      m.homeTeam.tla &&
      m.awayTeam.tla,
  );
  // Cada equipo juega 3 partidos en su grupo
  const expectedPerTeam = 3;

  for (const match of groupMatches) {
    const pred = myPredictions.get(match.id);
    if (!pred) continue;
    const homeTla = match.homeTeam.tla;
    const awayTla = match.awayTeam.tla;
    if (standings[homeTla])
      applyToTeam(standings[homeTla], pred.homeScore, pred.awayScore);
    if (standings[awayTla])
      applyToTeam(standings[awayTla], pred.awayScore, pred.homeScore);
  }

  // Marca de completitud (¿todos los partidos del equipo fueron predichos?)
  for (const tla of teamTlas) {
    if (standings[tla].played < expectedPerTeam) {
      standings[tla].allMatchesPredicted = false;
    }
  }

  return Object.values(standings).sort(compareStandings);
}

// Ordenamiento por: puntos → DG → goles a favor → TLA alfabético
// (head-to-head y conducta omitidos por simplicidad)
export function compareStandings(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.teamTla.localeCompare(b.teamTla);
}

// Computa standings para los 12 grupos
export function computeAllGroupStandings(
  allMatches: Match[],
  myPredictions: Map<string, MatchPrediction>,
): Record<string, TeamStanding[]> {
  const result: Record<string, TeamStanding[]> = {};
  for (const group of Object.keys(WC2026_GROUPS)) {
    result[group] = computeGroupStandings(group, allMatches, myPredictions);
  }
  return result;
}
