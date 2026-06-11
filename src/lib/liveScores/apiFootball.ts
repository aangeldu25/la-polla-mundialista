// Proveedor BACKUP de marcadores en vivo: API-Football (api-sports.io).
// Free tier: 100 requests/día — suficiente porque solo se consulta cuando
// FIFA falla, una vez por corrida de sync.
// Requiere env API_FOOTBALL_KEY; si no está configurada, el backup se
// deshabilita silenciosamente.

import type { LiveProviderResult, LiveScore } from "./types";

const BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1; // FIFA World Cup
const SEASON = 2026;

// Estados de API-Football → nuestros estados
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

interface AFFixture {
  fixture: {
    date: string;
    status: { short: string; elapsed: number | null };
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    penalty: { home: number | null; away: number | null };
  };
}

function mapStatus(short: string): LiveScore["status"] {
  if (FINISHED_STATUSES.has(short)) return "FINISHED";
  if (LIVE_STATUSES.has(short)) return "LIVE";
  if (short === "NS" || short === "TBD") return "SCHEDULED";
  return "UNKNOWN";
}

export async function fetchApiFootballLiveScores(params: {
  dates: string[]; // ["2026-06-11", "2026-06-12"]
}): Promise<LiveProviderResult> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return {
      provider: "api-football",
      ok: false,
      scores: [],
      error: "API_FOOTBALL_KEY no configurada",
    };
  }
  try {
    const scores: LiveScore[] = [];
    for (const date of params.dates) {
      const res = await fetch(
        `${BASE}/fixtures?league=${WC_LEAGUE_ID}&season=${SEASON}&date=${date}`,
        {
          cache: "no-store",
          headers: { "x-apisports-key": apiKey },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        return {
          provider: "api-football",
          ok: false,
          scores: [],
          error: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as { response?: AFFixture[] };
      for (const f of data.response ?? []) {
        scores.push({
          utcDate: new Date(f.fixture.date).toISOString().replace(".000Z", "Z"),
          homeTla: null, // API-Football no expone TLA — matcheamos por nombre
          awayTla: null,
          homeName: f.teams.home.name,
          awayName: f.teams.away.name,
          homeScore: f.goals.home,
          awayScore: f.goals.away,
          status: mapStatus(f.fixture.status.short),
          minute:
            f.fixture.status.elapsed != null
              ? `${f.fixture.status.elapsed}'`
              : null,
          homePenalties: f.score.penalty.home,
          awayPenalties: f.score.penalty.away,
        });
      }
    }
    return { provider: "api-football", ok: true, scores };
  } catch (e) {
    return {
      provider: "api-football",
      ok: false,
      scores: [],
      error: (e as Error).message,
    };
  }
}
