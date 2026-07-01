// Overlay de marcadores en vivo sobre los docs de Firestore.
//
// Estrategia:
//   1. Football-Data sigue siendo la fuente del FIXTURE (equipos, fechas,
//      brackets) — indispensable, no se toca.
//   2. Para los partidos "de hoy" consultamos FIFA (primario) y, si falla,
//      API-Football (backup). Estos proveedores son mucho más frescos para
//      marcador/estado/minuto.
//   3. Si el overlay deja un partido FINISHED con marcador y sin puntos
//      calculados, dispara el scoring (idempotente).
//
// El matching FIFA→Firestore es por kickoff (utcDate) + TLA de al menos un
// equipo. Para API-Football (sin TLA) es por kickoff + nombre normalizado.

import { adminDb } from "@/lib/firebase/admin";
import { scoreMatches } from "@/lib/scoring/match-scoring";
import type { Match } from "@/types/domain";
import { fetchFifaLiveScores } from "./fifa";
import { fetchApiFootballLiveScores } from "./apiFootball";
import type { LiveScore } from "./types";

// Alias entre TLAs/nombres de proveedores y los de Football-Data
const TLA_ALIASES: Record<string, string> = {
  CUW: "CUR", // Curaçao: FIFA usa CUW, Football-Data usa CUR
};

function canonTla(tla: string | null): string | null {
  if (!tla) return null;
  const up = tla.toUpperCase();
  return TLA_ALIASES[up] ?? up;
}

function normName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

// Aliases de nombres (API-Football vs Football-Data)
const NAME_ALIASES: Record<string, string> = {
  southkorea: "korearepublic",
  ivorycoast: "cotedivoire",
  usa: "unitedstates",
};

function canonName(name: string): string {
  const n = normName(name);
  return NAME_ALIASES[n] ?? n;
}

export interface OverlayResult {
  provider: string;
  candidates: number;
  matched: number;
  updated: number;
  finishedScored: string[];
  providerError?: string;
}

export async function overlayLiveScores(): Promise<OverlayResult> {
  const now = Date.now();
  // Ventana: partidos cuyo kickoff fue hace <9h o es en <30min. El margen
  // holgado hacia atrás cubre aplazamientos (un partido corrido por clima que
  // aún se está jugando varias horas después de su hora original).
  const fromMs = now - 9 * 3600_000;
  const toMs = now + 30 * 60_000;

  // 1) Candidatos en Firestore: partidos en ventana que aún necesitan datos
  const snap = await adminDb
    .collection("matches")
    .where("utcDate", ">=", new Date(fromMs).toISOString())
    .where("utcDate", "<=", new Date(toMs).toISOString())
    .get();

  const candidates = snap.docs
    .map((d) => d.data() as Match & { pointsCalculated?: boolean })
    .filter(
      (m) =>
        // Necesita overlay si no está finalizado-y-puntuado
        !(
          m.status === "FINISHED" &&
          m.score.homeFullTime !== null &&
          m.pointsCalculated
        ),
    );

  if (candidates.length === 0) {
    return {
      provider: "none",
      candidates: 0,
      matched: 0,
      updated: 0,
      finishedScored: [],
    };
  }

  // 2) Pedir datos: FIFA primero, API-Football si falla.
  // FIFA solo acepta fechas redondas — usamos YYYY-MM-DD (día completo).
  const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const fromIso = dateOnly(fromMs - 24 * 3600_000);
  const toIso = dateOnly(toMs + 24 * 3600_000);
  let result = await fetchFifaLiveScores({ fromIso, toIso });
  if (!result.ok || result.scores.length === 0) {
    const dates = Array.from(
      new Set(
        candidates.map((m) => m.utcDate.slice(0, 10)),
      ),
    );
    const backup = await fetchApiFootballLiveScores({ dates });
    if (backup.ok && backup.scores.length > 0) {
      result = backup;
    }
  }
  if (!result.ok || result.scores.length === 0) {
    return {
      provider: result.provider,
      candidates: candidates.length,
      matched: 0,
      updated: 0,
      finishedScored: [],
      providerError: result.error ?? "sin datos",
    };
  }

  // 3) Matchear y escribir
  const batch = adminDb.batch();
  let matched = 0;
  let updated = 0;
  const newlyFinished: string[] = [];

  for (const m of candidates) {
    const live = findLiveScore(m, result.scores);
    if (!live) continue;
    matched++;

    // Solo escribir si el proveedor aporta algo más fresco
    const changes: Record<string, unknown> = {};
    if (
      live.homeScore !== null &&
      live.awayScore !== null &&
      (live.homeScore !== m.score.homeFullTime ||
        live.awayScore !== m.score.awayFullTime)
    ) {
      changes["score.homeFullTime"] = live.homeScore;
      changes["score.awayFullTime"] = live.awayScore;
    }
    if (
      live.homePenalties !== null &&
      live.awayPenalties !== null &&
      live.homePenalties !== (m.score.homePenalties ?? null)
    ) {
      changes["score.homePenalties"] = live.homePenalties;
      changes["score.awayPenalties"] = live.awayPenalties;
    }
    if (
      (live.status === "LIVE" || live.status === "FINISHED") &&
      live.status !== m.status
    ) {
      changes["status"] = live.status;
    }
    const wantMinute = live.status === "LIVE" ? live.minute : null;
    if (wantMinute !== (m.liveMinute ?? null)) {
      changes["liveMinute"] = wantMinute;
    }

    if (Object.keys(changes).length === 0) continue;
    changes["updatedAt"] = new Date().toISOString();
    batch.update(adminDb.collection("matches").doc(m.id), changes);
    updated++;

    // ¿Quedó FINISHED con marcador y sin puntos? → puntuar después del commit
    const finalStatus = (changes["status"] as string) ?? m.status;
    const finalHome =
      (changes["score.homeFullTime"] as number | undefined) ??
      m.score.homeFullTime;
    if (
      finalStatus === "FINISHED" &&
      finalHome !== null &&
      !m.pointsCalculated
    ) {
      newlyFinished.push(m.id);
    }
  }

  if (updated > 0) await batch.commit();

  // 4) Scoring de los recién terminados (idempotente; guarda no-score-yet)
  if (newlyFinished.length > 0) {
    try {
      await scoreMatches(newlyFinished);
    } catch (e) {
      console.error("[overlay] scoring error:", e);
    }
  }

  return {
    provider: result.provider,
    candidates: candidates.length,
    matched,
    updated,
    finishedScored: newlyFinished,
  };
}

function findLiveScore(m: Match, scores: LiveScore[]): LiveScore | null {
  const mHome = canonTla(m.homeTeam.tla || null);
  const mAway = canonTla(m.awayTeam.tla || null);
  const mHomeName = canonName(m.homeTeam.name);
  const mAwayName = canonName(m.awayTeam.name);
  const mTime = new Date(m.utcDate).getTime();
  // Ventana amplia (±12h) en vez de exigir kickoff EXACTO: así toleramos
  // aplazamientos (p.ej. un partido corrido una hora por mal tiempo). Un mismo
  // equipo no juega dos veces en ~12h, así que emparejar por equipos dentro de
  // la ventana es seguro y evita perder el seguimiento en vivo.
  const WINDOW_MS = 12 * 3600_000;

  let best: LiveScore | null = null;
  let bestRank = -1;
  for (const s of scores) {
    const diff = Math.abs(new Date(s.utcDate).getTime() - mTime);
    if (!Number.isFinite(diff) || diff > WINDOW_MS) continue;
    const sHome = canonTla(s.homeTla);
    const sAway = canonTla(s.awayTla);
    const homeHit =
      (!!mHome && !!sHome && mHome === sHome) ||
      (!!mHomeName && canonName(s.homeName) === mHomeName);
    const awayHit =
      (!!mAway && !!sAway && mAway === sAway) ||
      (!!mAwayName && canonName(s.awayName) === mAwayName);
    if (!homeHit && !awayHit) continue;
    // Preferir coincidencia de AMBOS lados; a igualdad, el más cercano en tiempo.
    const strength = (homeHit ? 1 : 0) + (awayHit ? 1 : 0);
    const rank = strength * 1e13 - diff;
    if (rank > bestRank) {
      bestRank = rank;
      best = s;
    }
  }
  return best;
}
