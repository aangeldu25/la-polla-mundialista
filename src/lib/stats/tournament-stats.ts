// Estadísticas REALES del torneo, derivadas de los resultados de los partidos
// que ya guardamos en Firestore (no de predicciones de usuarios).
//
// Todo lo de aquí es 100% confiable porque se calcula desde los marcadores
// finales que sincronizamos (Football-Data + overlay FIFA en vivo). No depende
// de endpoints de "stats" de pago ni de datos demo.

import { WC2026_GROUPS } from "@/lib/constants/wc2026-groups";
import {
  compareStandings,
  type TeamStanding,
} from "@/lib/standings/group-standings";
import type { Match } from "@/types/domain";

// Devuelve solo los partidos REALES del fixture (104), descartando los
// placeholders de bracket sembrados (id "BRACKET-*", footballDataId < 0) que
// se crearon cuando Football-Data aún no publicaba las eliminatorias.
//
// Football-Data ya entrega los 104 partidos completos, así que los placeholders
// son siempre redundantes. Filtrar por footballDataId > 0 es robusto e
// INDEPENDIENTE del stage/matchNumber (algunos R32 reales llegan con stage
// no reconocido y sin matchNumber hasta que el sync los reescribe).
//
// Como salvaguarda, deduplicamos también por matchNumber entre los reales.
export function dedupeMatches(allMatches: Match[]): Match[] {
  const real = allMatches.filter((m) => m.footballDataId > 0);
  const byNumber = new Map<number, Match>();
  const noNumber: Match[] = [];
  for (const m of real) {
    if (m.matchNumber === undefined) {
      noNumber.push(m);
      continue;
    }
    const existing = byNumber.get(m.matchNumber);
    byNumber.set(
      m.matchNumber,
      existing ? preferMatch(existing, m) : m,
    );
  }
  return [...byNumber.values(), ...noNumber];
}

function preferMatch(a: Match, b: Match): Match {
  // Entre dos reales con el mismo matchNumber, preferir el que tenga equipos
  // resueltos (TLA no vacío), luego el de marcador final.
  const teamsA = !!(a.homeTeam.tla && a.awayTeam.tla);
  const teamsB = !!(b.homeTeam.tla && b.awayTeam.tla);
  if (teamsA !== teamsB) return teamsA ? a : b;
  return a;
}

// ¿El partido tiene un marcador final utilizable? (solo partidos terminados)
function hasFinalScore(m: Match): boolean {
  return (
    m.status === "FINISHED" &&
    m.score.homeFullTime !== null &&
    m.score.awayFullTime !== null
  );
}

// ¿Tiene un marcador contabilizable AHORA? Incluye partidos EN VIVO con su
// marcador provisional — usado por las tablas de grupos para reflejar los
// resultados en tiempo real mientras se juegan.
function hasLiveOrFinalScore(m: Match): boolean {
  return (
    (m.status === "FINISHED" || m.status === "LIVE") &&
    m.score.homeFullTime !== null &&
    m.score.awayFullTime !== null
  );
}

function emptyStanding(tla: string): TeamStanding {
  return {
    teamTla: tla,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalsDiff: 0,
    points: 0,
    allMatchesPredicted: true, // no aplica aquí; lo dejamos en true
  };
}

function apply(t: TeamStanding, gf: number, ga: number): void {
  t.played++;
  t.goalsFor += gf;
  t.goalsAgainst += ga;
  t.goalsDiff = t.goalsFor - t.goalsAgainst;
  if (gf > ga) {
    t.wins++;
    t.points += 3;
  } else if (gf < ga) {
    t.losses++;
  } else {
    t.draws++;
    t.points += 1;
  }
}

// Tabla real de un grupo. Incluye partidos EN VIVO con su marcador provisional
// para que la tabla se actualice en tiempo real mientras se juega.
export function computeRealGroupStandings(
  group: string,
  allMatches: Match[],
): { standings: TeamStanding[]; hasLive: boolean } {
  const teamTlas = WC2026_GROUPS[group] ?? [];
  const standings: Record<string, TeamStanding> = {};
  for (const tla of teamTlas) standings[tla] = emptyStanding(tla);
  let hasLive = false;

  for (const m of allMatches) {
    if (m.stage !== "GROUP" || m.group !== group) continue;
    if (!hasLiveOrFinalScore(m)) continue;
    if (m.status === "LIVE") hasLive = true;
    const h = m.homeTeam.tla;
    const a = m.awayTeam.tla;
    if (standings[h]) apply(standings[h], m.score.homeFullTime!, m.score.awayFullTime!);
    if (standings[a]) apply(standings[a], m.score.awayFullTime!, m.score.homeFullTime!);
  }

  return { standings: Object.values(standings).sort(compareStandings), hasLive };
}

export function computeAllRealStandings(
  allMatches: Match[],
): Record<string, { standings: TeamStanding[]; hasLive: boolean }> {
  const out: Record<string, { standings: TeamStanding[]; hasLive: boolean }> =
    {};
  for (const g of Object.keys(WC2026_GROUPS)) {
    out[g] = computeRealGroupStandings(g, allMatches);
  }
  return out;
}

export interface TournamentSummary {
  matchesPlayed: number;
  matchesTotal: number;
  totalGoals: number;
  avgGoalsPerMatch: number; // 2 decimales
  cleanSheets: number; // partidos con al menos un equipo en cero
  biggestWin: {
    match: Match;
    diff: number;
  } | null;
  highestScoring: {
    match: Match;
    goals: number;
  } | null;
}

export function computeTournamentSummary(allMatches: Match[]): TournamentSummary {
  const played = allMatches.filter(hasFinalScore);
  let totalGoals = 0;
  let cleanSheets = 0;
  let biggestWin: TournamentSummary["biggestWin"] = null;
  let highestScoring: TournamentSummary["highestScoring"] = null;

  for (const m of played) {
    const h = m.score.homeFullTime!;
    const a = m.score.awayFullTime!;
    const goals = h + a;
    totalGoals += goals;
    if (h === 0 || a === 0) cleanSheets++;
    const diff = Math.abs(h - a);
    if (!biggestWin || diff > biggestWin.diff) biggestWin = { match: m, diff };
    if (!highestScoring || goals > highestScoring.goals)
      highestScoring = { match: m, goals };
  }

  return {
    matchesPlayed: played.length,
    matchesTotal: allMatches.length,
    totalGoals,
    avgGoalsPerMatch:
      played.length > 0
        ? Math.round((totalGoals / played.length) * 100) / 100
        : 0,
    cleanSheets,
    biggestWin,
    highestScoring,
  };
}

export interface TeamTotals {
  teamTla: string;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
}

// Totales por equipo across TODO el torneo (grupos + eliminatorias).
export function computeTeamTotals(allMatches: Match[]): TeamTotals[] {
  const map = new Map<string, TeamTotals>();
  const ensure = (tla: string) => {
    if (!map.has(tla))
      map.set(tla, {
        teamTla: tla,
        played: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
      });
    return map.get(tla)!;
  };

  for (const m of allMatches) {
    if (!hasFinalScore(m)) continue;
    const hTla = m.homeTeam.tla;
    const aTla = m.awayTeam.tla;
    if (!hTla || !aTla) continue; // saltar TBD de eliminatorias sin definir
    const h = m.score.homeFullTime!;
    const a = m.score.awayFullTime!;
    const ht = ensure(hTla);
    const at = ensure(aTla);
    ht.played++;
    at.played++;
    ht.goalsFor += h;
    ht.goalsAgainst += a;
    at.goalsFor += a;
    at.goalsAgainst += h;
    if (a === 0) ht.cleanSheets++;
    if (h === 0) at.cleanSheets++;
  }

  return [...map.values()];
}

// Top equipos por goles a favor (ataque)
export function topAttack(totals: TeamTotals[], n = 8): TeamTotals[] {
  return [...totals]
    .filter((t) => t.played > 0)
    .sort((a, b) => b.goalsFor - a.goalsFor || a.goalsAgainst - b.goalsAgainst)
    .slice(0, n);
}

// Top equipos por menos goles recibidos (defensa / valla menos vencida).
// Desempate: más vallas invictas, luego menos partidos jugados (más eficiente).
export function topDefense(totals: TeamTotals[], n = 8): TeamTotals[] {
  return [...totals]
    .filter((t) => t.played > 0)
    .sort(
      (a, b) =>
        a.goalsAgainst - b.goalsAgainst ||
        b.cleanSheets - a.cleanSheets ||
        b.goalsFor - a.goalsFor,
    )
    .slice(0, n);
}

export interface TeamForm {
  teamTla: string;
  played: number;
  results: Array<"W" | "D" | "L">; // en orden cronológico
  longestUnbeaten: number; // racha invicta más larga (W/D)
  currentUnbeaten: number; // racha invicta actual
  isUnbeaten: boolean; // sin derrotas en todo el torneo
}

// Forma y rachas por equipo a partir de resultados reales (cronológico).
// allMatches ya viene ordenado por utcDate ascendente.
export function computeTeamForms(allMatches: Match[]): TeamForm[] {
  const map = new Map<string, TeamForm>();
  const ensure = (tla: string) => {
    if (!map.has(tla))
      map.set(tla, {
        teamTla: tla,
        played: 0,
        results: [],
        longestUnbeaten: 0,
        currentUnbeaten: 0,
        isUnbeaten: true,
      });
    return map.get(tla)!;
  };

  for (const m of allMatches) {
    if (!hasFinalScore(m)) continue;
    const hTla = m.homeTeam.tla;
    const aTla = m.awayTeam.tla;
    if (!hTla || !aTla) continue;
    const h = m.score.homeFullTime!;
    const a = m.score.awayFullTime!;
    const ht = ensure(hTla);
    const at = ensure(aTla);
    const push = (t: TeamForm, r: "W" | "D" | "L") => {
      t.played++;
      t.results.push(r);
      if (r === "L") {
        t.currentUnbeaten = 0;
        t.isUnbeaten = false;
      } else {
        t.currentUnbeaten++;
        t.longestUnbeaten = Math.max(t.longestUnbeaten, t.currentUnbeaten);
      }
    };
    if (h > a) {
      push(ht, "W");
      push(at, "L");
    } else if (h < a) {
      push(ht, "L");
      push(at, "W");
    } else {
      push(ht, "D");
      push(at, "D");
    }
  }

  return [...map.values()];
}

// Equipos invictos (sin derrotas), ordenados por más partidos jugados y mejor
// diferencia implícita (más victorias dentro de la racha).
export function unbeatenTeams(forms: TeamForm[], n = 6): TeamForm[] {
  return forms
    .filter((f) => f.isUnbeaten && f.played > 0)
    .sort(
      (a, b) =>
        b.played - a.played ||
        b.results.filter((r) => r === "W").length -
          a.results.filter((r) => r === "W").length,
    )
    .slice(0, n);
}
