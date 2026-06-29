// Estadísticas DETALLADAS del Mundial 2026 (posesión, tarjetas, faltas,
// disparos, córners, offsides, atajadas, xG, árbitros, jugador del partido).
//
// Fuente PRIMARIA: dataset comunitario de dominio público en GitHub
//   https://github.com/mominullptr/FIFA-World-Cup-2026-Dataset
// (CSVs vía CDN de GitHub, gratis, sin API key; data scrapeada de fifa.com,
//  se actualiza a diario). Es la única fuente gratuita en tiempo real que
//  tenemos para estas métricas — el feed FIFA que ya usamos NO las puebla.
//
// Diseñado para tolerar fallos: si el dataset no responde, devolvemos null y
// la UI simplemente oculta estas secciones (como con openfootball).
//
// NOTA: estructurado para poder enchufar API-Football como fuente secundaria
// más adelante (requiere API_FOOTBALL_KEY), sin tocar la UI.

const RAW =
  "https://raw.githubusercontent.com/mominullptr/FIFA-World-Cup-2026-Dataset/main";

// ───────────────────────── Parser CSV mínimo (con comillas) ─────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, idx) => (o[h] = r[idx] ?? ""));
    return o;
  });
}

const num = (s: string | undefined): number => {
  const n = parseFloat((s ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

// ───────────────────────────── Tipos de salida ─────────────────────────────
export interface TeamDetailedStats {
  tla: string;
  matches: number; // partidos con stats disponibles
  possessionAvg: number; // %
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  corners: number;
  offsides: number;
  saves: number;
  yellow: number;
  red: number;
  xg: number; // expected goals acumulado
  goals: number; // goles reales (del dataset)
  shotAccuracy: number; // al arco ÷ disparos (%)
}

export interface DetailedStatsLeader {
  tla: string;
  value: number;
}

export interface DetailedStats {
  updatedAt: string | null; // último last_updated del dataset
  matchesWithStats: number;
  teams: TeamDetailedStats[];
  totals: {
    yellow: number;
    red: number;
    fouls: number;
    shots: number;
    xg: number;
  };
  // Rankings listos para mostrar
  possession: DetailedStatsLeader[]; // más posesión
  fairPlay: DetailedStatsLeader[]; // menos tarjetas ponderadas (asc)
  cards: DetailedStatsLeader[]; // más tarjetas ponderadas (desc)
  shooting: DetailedStatsLeader[]; // más disparos al arco
  fouling: DetailedStatsLeader[]; // más faltas
  xgRanking: DetailedStatsLeader[]; // mayor xG
  overperformers: DetailedStatsLeader[]; // goles − xG (suerte/eficacia)
}

// Peso de tarjetas para el ranking Fair Play (criterio FIFA: amarilla 1, roja 3)
const CARD_WEIGHT = (yellow: number, red: number) => yellow + red * 3;

async function fetchCsv(file: string): Promise<Record<string, string>[]> {
  const res = await fetch(`${RAW}/${file}`, {
    // Cache de 30 min: el dataset se actualiza ~diario.
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

export async function fetchDetailedStats(): Promise<DetailedStats | null> {
  try {
    const [teams, matchStats, events, detailed] = await Promise.all([
      fetchCsv("teams.csv"),
      fetchCsv("match_team_stats.csv"),
      fetchCsv("match_events.csv"),
      fetchCsv("matches_detailed.csv"),
    ]);

    // team_id → TLA
    const idToTla = new Map<string, string>();
    for (const t of teams) {
      if (t.team_id && t.fifa_code) idToTla.set(t.team_id, t.fifa_code.toUpperCase());
    }

    const acc = new Map<string, TeamDetailedStats>();
    const ensure = (tla: string): TeamDetailedStats => {
      let t = acc.get(tla);
      if (!t) {
        t = {
          tla,
          matches: 0,
          possessionAvg: 0,
          shots: 0,
          shotsOnTarget: 0,
          fouls: 0,
          corners: 0,
          offsides: 0,
          saves: 0,
          yellow: 0,
          red: 0,
          xg: 0,
          goals: 0,
          shotAccuracy: 0,
        };
        acc.set(tla, t);
      }
      return t;
    };

    // Posesión/disparos/faltas/etc. por equipo-partido
    const possSum = new Map<string, number>();
    const possCnt = new Map<string, number>();
    let updatedAt: string | null = null;
    const matchIds = new Set<string>();
    for (const r of matchStats) {
      const tla = idToTla.get(r.team_id);
      if (!tla) continue;
      const t = ensure(tla);
      t.matches++;
      matchIds.add(r.match_id);
      t.shots += num(r.total_shots);
      t.shotsOnTarget += num(r.shots_on_target);
      t.fouls += num(r.fouls);
      t.corners += num(r.corners);
      t.offsides += num(r.offsides);
      t.saves += num(r.saves);
      possSum.set(tla, (possSum.get(tla) ?? 0) + num(r.possession_pct));
      possCnt.set(tla, (possCnt.get(tla) ?? 0) + 1);
      if (r.last_updated && (!updatedAt || r.last_updated > updatedAt)) {
        updatedAt = r.last_updated;
      }
    }
    for (const [tla, t] of acc) {
      const c = possCnt.get(tla) ?? 0;
      t.possessionAvg = c > 0 ? Math.round((possSum.get(tla) ?? 0) / c) : 0;
      t.shotAccuracy =
        t.shots > 0 ? Math.round((t.shotsOnTarget / t.shots) * 100) : 0;
    }

    // Tarjetas desde eventos
    for (const e of events) {
      const tla = idToTla.get(e.team_id);
      if (!tla) continue;
      if (e.event_type === "Yellow Card") ensure(tla).yellow++;
      else if (e.event_type === "Red Card") ensure(tla).red++;
    }

    // xG + goles reales desde matches_detailed
    for (const m of detailed) {
      const h = (m.home_fifa_code || "").toUpperCase();
      const a = (m.away_fifa_code || "").toUpperCase();
      if (h) {
        const t = ensure(h);
        t.xg += num(m.home_xg);
        t.goals += num(m.home_score);
      }
      if (a) {
        const t = ensure(a);
        t.xg += num(m.away_xg);
        t.goals += num(m.away_score);
      }
    }

    const teamsArr = [...acc.values()].filter((t) => t.matches > 0);
    if (teamsArr.length === 0) return null;

    const top = (
      arr: TeamDetailedStats[],
      val: (t: TeamDetailedStats) => number,
      dir: "asc" | "desc",
      n = 8,
    ): DetailedStatsLeader[] =>
      [...arr]
        .sort((x, y) => (dir === "desc" ? val(y) - val(x) : val(x) - val(y)))
        .slice(0, n)
        .map((t) => ({ tla: t.tla, value: Math.round(val(t) * 100) / 100 }));

    const totals = teamsArr.reduce(
      (s, t) => ({
        yellow: s.yellow + t.yellow,
        red: s.red + t.red,
        fouls: s.fouls + t.fouls,
        shots: s.shots + t.shots,
        xg: s.xg + t.xg,
      }),
      { yellow: 0, red: 0, fouls: 0, shots: 0, xg: 0 },
    );

    return {
      updatedAt,
      matchesWithStats: matchIds.size,
      teams: teamsArr.sort((a, b) => a.tla.localeCompare(b.tla)),
      totals: { ...totals, xg: Math.round(totals.xg * 10) / 10 },
      possession: top(teamsArr, (t) => t.possessionAvg, "desc"),
      fairPlay: top(teamsArr, (t) => CARD_WEIGHT(t.yellow, t.red), "asc"),
      cards: top(teamsArr, (t) => CARD_WEIGHT(t.yellow, t.red), "desc"),
      shooting: top(teamsArr, (t) => t.shotsOnTarget, "desc"),
      fouling: top(teamsArr, (t) => t.fouls, "desc"),
      xgRanking: top(teamsArr, (t) => t.xg, "desc"),
      overperformers: top(teamsArr, (t) => t.goals - t.xg, "desc"),
    };
  } catch {
    return null;
  }
}
