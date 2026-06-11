// Proveedor PRIMARIO de marcadores en vivo: API pública (no oficial) de FIFA.
// Es la misma que alimenta fifa.com — datos en tiempo real, gratis y sin key.
// Al ser no oficial puede cambiar sin aviso; por eso existe el backup
// (api-football) y la base de Football-Data nunca se reemplaza.
//
// Estados conocidos de MatchStatus:
//   0 = Finalizado · 1 = Programado · 3 = En vivo
//   (otros valores se ignoran de forma segura)

import type { LiveProviderResult, LiveScore } from "./types";

const FIFA_BASE = "https://api.fifa.com/api/v3";
const WC_COMPETITION_ID = "17";

interface FifaTeam {
  Abbreviation?: string | null;
  Score?: number | null;
  TeamName?: Array<{ Description?: string }>;
}

interface FifaMatch {
  Date: string;
  MatchStatus: number;
  MatchTime?: string | null;
  Home?: FifaTeam | null;
  Away?: FifaTeam | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
}

function mapStatus(s: number): LiveScore["status"] {
  if (s === 0) return "FINISHED";
  if (s === 3) return "LIVE";
  if (s === 1 || s === 12) return "SCHEDULED";
  return "UNKNOWN";
}

export async function fetchFifaLiveScores(params: {
  fromIso: string;
  toIso: string;
}): Promise<LiveProviderResult> {
  try {
    const url =
      `${FIFA_BASE}/calendar/matches?from=${encodeURIComponent(params.fromIso)}` +
      `&to=${encodeURIComponent(params.toIso)}` +
      `&idCompetition=${WC_COMPETITION_ID}&language=en&count=50`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (polla-mundialista)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        provider: "fifa",
        ok: false,
        scores: [],
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { Results?: FifaMatch[] };
    const scores: LiveScore[] = (data.Results ?? []).map((m) => ({
      utcDate: normalizeIso(m.Date),
      homeTla: m.Home?.Abbreviation ?? null,
      awayTla: m.Away?.Abbreviation ?? null,
      homeName: m.Home?.TeamName?.[0]?.Description ?? "",
      awayName: m.Away?.TeamName?.[0]?.Description ?? "",
      homeScore: m.Home?.Score ?? null,
      awayScore: m.Away?.Score ?? null,
      status: mapStatus(m.MatchStatus),
      minute: m.MatchTime || null,
      homePenalties: m.HomeTeamPenaltyScore ?? null,
      awayPenalties: m.AwayTeamPenaltyScore ?? null,
    }));
    return { provider: "fifa", ok: true, scores };
  } catch (e) {
    return {
      provider: "fifa",
      ok: false,
      scores: [],
      error: (e as Error).message,
    };
  }
}

// FIFA devuelve fechas tipo "2026-06-11T19:00:00Z" — normalizamos por si
// vienen con milisegundos para que coincidan con las de Football-Data.
function normalizeIso(iso: string): string {
  try {
    return new Date(iso).toISOString().replace(".000Z", "Z");
  } catch {
    return iso;
  }
}
