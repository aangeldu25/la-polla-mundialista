// "Power Ranking" PROPIO (no el de FIFA, que está tras una API bloqueada).
// Índice 0–100 transparente que combina:
//   • Resultados: puntos por partido (G=3, E=1)            [peso 40 / 50]
//   • Diferencia de gol por partido                         [peso 18 / 25]
//   • Forma reciente (últimos 3 partidos)                   [peso 20 / 25]
//   • Calidad de juego: xG, posesión y disparos al arco     [peso 17]  (si hay dataset)
//   • Fair Play: menos tarjetas                             [peso 5]   (si hay dataset)
//
// Cuando no hay datos del dataset (calidad/disciplina), se reparten los pesos
// entre resultados/gol/forma para que el índice siga siendo válido.

import type { TeamTotals, TeamForm } from "./tournament-stats";
import type { TeamDetailedStats } from "./wcDataset";

export interface PowerRankComponents {
  results: number; // 0–100
  goals: number;
  form: number;
  quality: number; // 0–100 (0 si no hay dataset)
  fairPlay: number; // 0–100 (100 = más limpio)
}

export interface PowerRankRow {
  tla: string;
  score: number; // 0–100
  played: number;
  components: PowerRankComponents;
  hasQuality: boolean;
}

// Normaliza un valor crudo al rango 0–100 según min/max de la muestra.
function makeNormalizer(values: number[]): (v: number) => number {
  const valid = values.filter((v) => Number.isFinite(v));
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;
  return (v: number) => {
    if (!Number.isFinite(v) || range <= 0) return 50;
    return ((v - min) / range) * 100;
  };
}

export function computePowerRanking(
  totals: TeamTotals[],
  forms: TeamForm[],
  detailedTeams?: TeamDetailedStats[],
): PowerRankRow[] {
  const totalsByTla = new Map(totals.map((t) => [t.teamTla, t]));
  const formByTla = new Map(forms.map((f) => [f.teamTla, f]));
  const detByTla = new Map(
    (detailedTeams ?? []).map((d) => [d.tla, d]),
  );

  // Equipos con al menos un partido jugado.
  const tlas = [...new Set([...totalsByTla.keys(), ...formByTla.keys()])].filter(
    (tla) => (formByTla.get(tla)?.played ?? totalsByTla.get(tla)?.played ?? 0) > 0,
  );

  interface Raw {
    tla: string;
    played: number;
    ppg: number;
    gdpg: number;
    form: number; // 0–1
    xgpg: number;
    sotpg: number;
    possession: number;
    cardsPg: number;
    hasQuality: boolean;
  }

  const raws: Raw[] = tlas.map((tla) => {
    const f = formByTla.get(tla);
    const t = totalsByTla.get(tla);
    const played = f?.played ?? t?.played ?? 0;
    const results = f?.results ?? [];
    const pts = results.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
    const gd = (t?.goalsFor ?? 0) - (t?.goalsAgainst ?? 0);
    const last = results.slice(-3);
    const formVal =
      last.length > 0
        ? last.reduce((s, r) => s + (r === "W" ? 1 : r === "D" ? 0.5 : 0), 0) /
          last.length
        : 0.5;
    const d = detByTla.get(tla);
    const dm = d?.matches ?? 0;
    return {
      tla,
      played,
      ppg: played > 0 ? pts / played : 0,
      gdpg: played > 0 ? gd / played : 0,
      form: formVal,
      xgpg: d && dm > 0 ? d.xg / dm : 0,
      sotpg: d && dm > 0 ? d.shotsOnTarget / dm : 0,
      possession: d?.possessionAvg ?? 0,
      cardsPg: d && dm > 0 ? (d.yellow + d.red * 3) / dm : 0,
      hasQuality: !!d && dm > 0,
    };
  });

  const nPpg = makeNormalizer(raws.map((r) => r.ppg));
  const nGd = makeNormalizer(raws.map((r) => r.gdpg));
  const qualityRaws = raws.filter((r) => r.hasQuality);
  const nXg = makeNormalizer(qualityRaws.map((r) => r.xgpg));
  const nSot = makeNormalizer(qualityRaws.map((r) => r.sotpg));
  const nPoss = makeNormalizer(qualityRaws.map((r) => r.possession));
  const nCards = makeNormalizer(qualityRaws.map((r) => r.cardsPg));

  const rows: PowerRankRow[] = raws.map((r) => {
    const results = nPpg(r.ppg);
    const goals = nGd(r.gdpg);
    const form = r.form * 100;
    const quality = r.hasQuality
      ? 0.5 * nXg(r.xgpg) + 0.3 * nSot(r.sotpg) + 0.2 * nPoss(r.possession)
      : 0;
    const fairPlay = r.hasQuality ? 100 - nCards(r.cardsPg) : 0;

    // Pesos: con calidad disponible vs sin ella (se reparten).
    const w = r.hasQuality
      ? { results: 40, goals: 18, form: 20, quality: 17, fairPlay: 5 }
      : { results: 50, goals: 25, form: 25, quality: 0, fairPlay: 0 };
    const score =
      (results * w.results +
        goals * w.goals +
        form * w.form +
        quality * w.quality +
        fairPlay * w.fairPlay) /
      100;

    return {
      tla: r.tla,
      score: Math.round(score * 10) / 10,
      played: r.played,
      components: {
        results: Math.round(results),
        goals: Math.round(goals),
        form: Math.round(form),
        quality: Math.round(quality),
        fairPlay: Math.round(fairPlay),
      },
      hasQuality: r.hasQuality,
    };
  });

  return rows.sort((a, b) => b.score - a.score || a.tla.localeCompare(b.tla));
}
