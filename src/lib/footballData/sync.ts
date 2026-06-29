import { adminDb } from "@/lib/firebase/admin";
import { fetchWorldCupMatches } from "./client";
import { scoreMatches } from "@/lib/scoring/match-scoring";
import { scoreAllStructure } from "@/lib/scoring/structure-scoring";
import type { FDMatch, FDStage, FDStatus } from "./types";
import type { Match, MatchStage, MatchStatus, Team } from "@/types/domain";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import {
  BRACKET_BY_MATCH_NUMBER,
  BRACKET_R32,
  BRACKET_BRONZE,
  BRACKET_FINAL,
} from "@/lib/constants/wc2026-bracket";

function mapStage(stage: FDStage): MatchStage {
  switch (stage) {
    case "GROUP_STAGE":
    case "PLAYOFFS":
      return "GROUP";
    case "ROUND_OF_32":
    case "LAST_32":
      return "ROUND_OF_32";
    case "LAST_16":
      return "ROUND_OF_16";
    case "QUARTER_FINALS":
      return "QUARTER_FINAL";
    case "SEMI_FINALS":
      return "SEMI_FINAL";
    case "3RD_PLACE":
    case "THIRD_PLACE":
      return "THIRD_PLACE";
    case "FINAL":
      return "FINAL";
  }
}

function mapStatus(s: FDStatus): MatchStatus {
  switch (s) {
    case "SCHEDULED":
    case "TIMED":
      return "SCHEDULED";
    case "IN_PLAY":
    case "PAUSED":
      return "LIVE";
    case "FINISHED":
      return "FINISHED";
    case "POSTPONED":
      return "POSTPONED";
    case "SUSPENDED":
    case "CANCELLED":
      return "CANCELLED";
  }
}

function mapTeam(t: FDMatch["homeTeam"]): Team | null {
  const rawTla = (t?.tla ?? "").toUpperCase();
  if (!rawTla || !t?.id) return null;
  const known = TEAMS_BY_TLA[rawTla];
  // Guardar SIEMPRE el TLA canónico FIFA (URU, no URY), para que las tablas y
  // los cruces emparejen los partidos con WC2026_GROUPS.
  const tla = known?.tla ?? rawTla;
  return {
    id: String(t.id),
    name: known?.name ?? t.name,
    shortName: t.shortName ?? t.name,
    tla,
    crest: t.crest ?? "",
  };
}

function parseGroup(g: string | null | undefined): string | undefined {
  if (!g) return undefined;
  const m1 = g.match(/^GROUP_([A-L])$/i);
  if (m1) return m1[1].toUpperCase();
  const m2 = g.match(/Group\s+([A-L])/i);
  if (m2) return m2[1].toUpperCase();
  if (/^[A-L]$/.test(g)) return g.toUpperCase();
  return undefined;
}

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  bracketSeeded: number;
  finalizedNow: string[];
  stagesFromApi: Record<string, number>;
  labelsAssigned: number;
  sample: Array<{
    id: string;
    matchNumber?: number;
    stage: string;
    group?: string;
    homeName: string;
    homeLabel?: string;
    awayName: string;
    awayLabel?: string;
    utcDate: string;
  }>;
  rawStagesSeen: string[];
  scoredMatches: number;
  totalPointsAwarded: number;
  structureAwarded: number;
}

// Calendario OFICIAL FIFA de las eliminatorias: número de partido -> kickoff
// (UTC). Verificado contra fifa.com/match-centre. La numeración oficial NO es
// cronológica, por eso emparejamos cada partido de Football-Data con su número
// por la hora exacta de inicio (en vez de un contador por orden de fecha).
const KO_OFFICIAL_TIMES: Record<number, string> = {
  // Dieciseisavos (R32)
  73: "2026-06-28T19:00:00Z",
  74: "2026-06-29T20:30:00Z",
  75: "2026-06-30T01:00:00Z",
  76: "2026-06-29T17:00:00Z",
  77: "2026-06-30T21:00:00Z",
  78: "2026-06-30T17:00:00Z",
  79: "2026-07-01T01:00:00Z",
  80: "2026-07-01T16:00:00Z",
  81: "2026-07-02T00:00:00Z",
  82: "2026-07-01T20:00:00Z",
  83: "2026-07-02T23:00:00Z",
  84: "2026-07-02T19:00:00Z",
  85: "2026-07-03T03:00:00Z",
  86: "2026-07-03T22:00:00Z",
  87: "2026-07-04T01:30:00Z", // Colombia vs Ghana — Arrowhead, 9:30pm ET
  88: "2026-07-03T18:00:00Z",
  // Octavos (R16)
  89: "2026-07-04T21:00:00Z",
  90: "2026-07-04T17:00:00Z",
  91: "2026-07-05T20:00:00Z",
  92: "2026-07-06T00:00:00Z",
  93: "2026-07-06T19:00:00Z",
  94: "2026-07-07T00:00:00Z",
  95: "2026-07-07T16:00:00Z",
  96: "2026-07-07T20:00:00Z",
  // Cuartos
  97: "2026-07-09T20:00:00Z",
  98: "2026-07-10T19:00:00Z",
  99: "2026-07-11T21:00:00Z",
  100: "2026-07-12T01:00:00Z",
  // Semifinales
  101: "2026-07-14T19:00:00Z",
  102: "2026-07-15T19:00:00Z",
  // Tercer puesto y Final
  103: "2026-07-18T21:00:00Z",
  104: "2026-07-19T19:00:00Z",
};

export async function syncFixture(): Promise<SyncResult> {
  const data = await fetchWorldCupMatches();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let labelsAssigned = 0;
  const finalizedNow: string[] = [];
  // Partidos ya puntuados cuyo marcador cambió (corrección) → re-puntuar.
  const rescoreForce: string[] = [];
  const stagesFromApi: Record<string, number> = {};
  const rawStagesSeen = new Set<string>();
  const sample: SyncResult["sample"] = [];

  // 1) Asignar matchNumber FIFA (1-104).
  // Fase de grupos (1-72): orden cronológico, que sí equivale a la numeración.
  // Eliminatorias (73-104): el número oficial FIFA NO es cronológico (p.ej.
  // Colombia vs Ghana es el #87 y se juega 9:30pm ET, pero por hora caería en
  // otra posición). Football-Data tampoco numera oficialmente, así que
  // asignamos el número emparejando el kickoff con la tabla oficial FIFA.
  const sorted = [...data.matches].sort(
    (a, b) =>
      new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime() ||
      a.id - b.id,
  );
  const koNumberByTime = new Map<string, number>();
  for (const [num, t] of Object.entries(KO_OFFICIAL_TIMES)) {
    koNumberByTime.set(t, Number(num));
  }
  const matchNumbers = new Map<number, number>();
  let groupCounter = 1;
  // Contadores de respaldo por fase: solo se usan si el kickoff de un partido
  // de eliminatoria no coincide con la tabla oficial (cambio de horario, etc.).
  const koFallback: Record<string, number> = {
    ROUND_OF_32: 73,
    ROUND_OF_16: 89,
    QUARTER_FINAL: 97,
    SEMI_FINAL: 101,
    THIRD_PLACE: 103,
    FINAL: 104,
  };
  for (const m of sorted) {
    const stage = mapStage(m.stage);
    if (stage === "GROUP") {
      matchNumbers.set(m.id, groupCounter++);
    } else if (stage) {
      const official = koNumberByTime.get(m.utcDate);
      matchNumbers.set(m.id, official ?? koFallback[stage]++);
    }
  }

  // 2) Detectar partidos recién finalizados antes de sobrescribir.
  const matches = data.matches;
  const prevSnap = await adminDb.collection("matches").get();
  const prevById = new Map<string, Match>();
  prevSnap.forEach((d) => prevById.set(d.id, d.data() as Match));

  // 3) Escribir TODOS los partidos del API (sin optimización de change-detection).
  // Esto asegura que los nuevos campos (homeLabel, matchNumber, city, group
  // normalizado) se persistan correctamente.
  for (let i = 0; i < matches.length; i += 400) {
    const slice = matches.slice(i, i + 400);
    const batch = adminDb.batch();
    for (const m of slice) {
      const id = String(m.id);
      const ref = adminDb.collection("matches").doc(id);
      const newStatus = mapStatus(m.status);
      const matchNumber = matchNumbers.get(m.id);
      const bracket =
        matchNumber !== undefined
          ? BRACKET_BY_MATCH_NUMBER[matchNumber]
          : undefined;
      const homeTeam = mapTeam(m.homeTeam);
      const awayTeam = mapTeam(m.awayTeam);
      // Las sedes se resuelven 100% en el cliente vía venueForMatch(matchNumber),
      // así que no escribimos venue/city/country a Firestore — ahorra writes.

      const prev = prevById.get(id) as
        | (Match & { pointsCalculated?: boolean })
        | undefined;
      // Disparar scoring cuando el partido está FINISHED con marcador real y
      // aún no se han calculado puntos. Cubre el caso de Football-Data que
      // marca FINISHED con score null y publica el marcador después.
      const hasScoreNow =
        m.score.fullTime?.home != null && m.score.fullTime?.away != null;
      if (
        newStatus === "FINISHED" &&
        hasScoreNow &&
        (!prev || prev.status !== "FINISHED" || !prev.pointsCalculated)
      ) {
        finalizedNow.push(id);
      }

      rawStagesSeen.add(String(m.stage));
      const mappedStage = mapStage(m.stage);
      stagesFromApi[mappedStage ?? "UNKNOWN"] =
        (stagesFromApi[mappedStage ?? "UNKNOWN"] ?? 0) + 1;

      // Football-Data a veces "adivina" los equipos de una eliminatoria ANTES
      // de que se jueguen (cruces provisionales y frecuentemente errados, p.ej.
      // colocar al 1° de un grupo en el slot de otro). Para partidos de
      // eliminatoria aún NO jugados conservamos las etiquetas oficiales del
      // bracket ("1° Grupo E", "3° de A/B/C/D/F") e ignoramos esos equipos: la
      // proyección real (tabla de grupos + Anexo C de la FIFA) los resuelve en
      // el cliente. En cuanto el partido va LIVE/FINISHED usamos el equipo real.
      const playedKnockout =
        newStatus === "LIVE" || newStatus === "FINISHED";
      const keepBracketLabels =
        mappedStage !== "GROUP" && !playedKnockout && !!bracket;
      const effHome = keepBracketLabels ? null : homeTeam;
      const effAway = keepBracketLabels ? null : awayTeam;
      if (!effHome && bracket?.homeLabel) labelsAssigned++;

      // Marcador del PARTIDO vs tanda de penales (separados). Cuando hubo
      // definición por penales, Football-Data mete la tanda DENTRO de fullTime
      // (ej. 5-6 = 1-1 + tanda). El marcador real del partido es
      // regularTime + extraTime; la tanda la derivamos de fullTime − marcador
      // (su campo `penalties` no es fiable, ej. 5-5).
      const sc = m.score;
      const isShootout = sc.duration === "PENALTY_SHOOTOUT";
      const reg = sc.regularTime;
      let playHome: number | null;
      let playAway: number | null;
      if (isShootout && reg && reg.home != null && reg.away != null) {
        playHome = reg.home + (sc.extraTime?.home ?? 0);
        playAway = reg.away + (sc.extraTime?.away ?? 0);
      } else {
        playHome = sc.fullTime?.home ?? null;
        playAway = sc.fullTime?.away ?? null;
      }
      let penHome = sc.penalties?.home ?? null;
      let penAway = sc.penalties?.away ?? null;
      if (
        isShootout &&
        playHome !== null &&
        playAway !== null &&
        sc.fullTime?.home != null &&
        sc.fullTime?.away != null
      ) {
        const dh = sc.fullTime.home - playHome;
        const da = sc.fullTime.away - playAway;
        // Solo si la diferencia es una tanda válida (no negativa y con ganador).
        if (dh >= 0 && da >= 0 && dh !== da) {
          penHome = dh;
          penAway = da;
        }
      }

      // Auto-sanación: si el partido ya estaba FINISHED y puntuado pero el
      // marcador del PARTIDO cambió (p.ej. antes guardábamos la tanda dentro
      // del marcador), re-puntuar con force para corregir los puntos.
      if (
        newStatus === "FINISHED" &&
        prev?.status === "FINISHED" &&
        prev.pointsCalculated &&
        (prev.score.homeFullTime !== playHome ||
          prev.score.awayFullTime !== playAway)
      ) {
        rescoreForce.push(id);
      }

      const next: Match = {
        id,
        footballDataId: m.id,
        matchNumber,
        stage: mappedStage,
        group: parseGroup(m.group),
        matchday: m.matchday ?? undefined,
        utcDate: m.utcDate,
        status: newStatus,
        homeTeam: effHome ?? {
          id: "TBD",
          name: bracket?.homeLabel ?? "Por definir",
          shortName: bracket?.homeLabel ?? "TBD",
          tla: "",
          crest: "",
        },
        awayTeam: effAway ?? {
          id: "TBD",
          name: bracket?.awayLabel ?? "Por definir",
          shortName: bracket?.awayLabel ?? "TBD",
          tla: "",
          crest: "",
        },
        homeLabel: effHome ? undefined : bracket?.homeLabel,
        awayLabel: effAway ? undefined : bracket?.awayLabel,
        score: {
          homeFullTime: playHome,
          awayFullTime: playAway,
          homeExtraTime: sc.extraTime?.home ?? null,
          awayExtraTime: sc.extraTime?.away ?? null,
          homePenalties: penHome,
          awayPenalties: penAway,
          winner: sc.winner ?? null,
        },
        liveMinute: newStatus === 'LIVE' ? (m.minute ?? null) : null,
        updatedAt: now,
      };

      // No pisar datos en vivo más frescos del overlay (FIFA/API-Football):
      // si Football-Data trae score null pero el doc ya tiene marcador (y
      // estado LIVE/FINISHED), conservamos lo existente. Football-Data free
      // tier llega tarde — el overlay es la fuente fresca de score/estado.
      if (
        prev &&
        next.score.homeFullTime === null &&
        prev.score.homeFullTime !== null &&
        (prev.status === "LIVE" || prev.status === "FINISHED")
      ) {
        next.score = prev.score;
        next.status = prev.status;
        next.liveMinute = prev.liveMinute ?? null;
      }

      // Preservar la marca de puntos calculados (set() reemplaza el doc)
      batch.set(ref, {
        ...next,
        pointsCalculated: prev?.pointsCalculated ?? false,
      });
      if (prev) updated++;
      else created++;

      // Capturamos sample de un par de partidos representativos
      if (sample.length < 3 || (next.stage !== "GROUP" && sample.length < 6)) {
        sample.push({
          id: next.id,
          matchNumber: next.matchNumber,
          stage: next.stage,
          group: next.group,
          homeName: next.homeTeam.name,
          homeLabel: next.homeLabel,
          awayName: next.awayTeam.name,
          awayLabel: next.awayLabel,
          utcDate: next.utcDate,
        });
      }
    }
    await batch.commit();
  }

  // matchNumbers ya cubiertos por un doc REAL de Football-Data: no sembrar
  // placeholders para esos (el doc real trae el horario y los datos correctos;
  // los seeds usan fechas aproximadas que desincronizan los horarios).
  const coveredByReal = new Set(matchNumbers.values());

  // 4) Sembrar R32 + Bronce + Final SOLO si Football-Data no los provee.
  // Football-Data no siempre los provee con stages reconocibles.
  const bracketSeeded =
    (await seedR32(now, coveredByReal)) +
    (await seedBronzeAndFinal(now, coveredByReal));

  // 5) Calcular puntos por marcador para partidos que recién terminaron.
  let scoringResults: Array<{
    matchId: string;
    predictions: number;
    uniqueUsers: number;
    totalPointsAwarded: number;
    skipped?: boolean;
  }> = [];
  if (finalizedNow.length > 0) {
    try {
      scoringResults = await scoreMatches(finalizedNow);
    } catch (e) {
      console.error("[sync] scoring error:", e);
    }
  }
  // Re-puntuar (force) los partidos cuyo marcador se corrigió.
  if (rescoreForce.length > 0) {
    try {
      const forced = await scoreMatches(rescoreForce, { force: true });
      scoringResults = scoringResults.concat(forced);
    } catch (e) {
      console.error("[sync] re-scoring (force) error:", e);
    }
  }
  const totalPointsAwarded = scoringResults.reduce(
    (s, r) => s + r.totalPointsAwarded,
    0,
  );

  // 6) Scoring de estructura del bracket — corre siempre (idempotente).
  // Detecta rondas cuyos equipos ya están definidos y otorga puntos por
  // Clasificado/Slot/Duelo Exacto.
  let structureAwarded = 0;
  try {
    const structureResult = await scoreAllStructure();
    structureAwarded = structureResult.totalAwarded;
  } catch (e) {
    console.error("[sync] structure scoring error:", e);
  }

  await adminDb.collection("meta").doc("fixtureSync").set({
    lastRunAt: now,
    total: matches.length,
    created,
    updated,
    bracketSeeded,
    labelsAssigned,
    stagesFromApi,
    rawStagesSeen: [...rawStagesSeen],
    scoredMatches: scoringResults.length,
    totalPointsAwarded,
    structureAwarded,
  });

  return {
    total: matches.length,
    created,
    updated,
    bracketSeeded,
    finalizedNow,
    labelsAssigned,
    stagesFromApi,
    rawStagesSeen: [...rawStagesSeen],
    sample,
    scoredMatches: scoringResults.length,
    totalPointsAwarded,
    structureAwarded,
  };
}

// Fechas/horas aproximadas de R32 distribuidas en 6 días (28 jun - 3 jul 2026).
const R32_DATES: Record<number, string> = {
  73: "2026-06-28T19:00:00Z",
  74: "2026-06-28T22:00:00Z",
  75: "2026-06-29T19:00:00Z",
  76: "2026-06-29T22:00:00Z",
  77: "2026-06-30T19:00:00Z",
  78: "2026-06-30T22:00:00Z",
  79: "2026-06-30T00:00:00Z",
  80: "2026-07-01T19:00:00Z",
  81: "2026-07-01T22:00:00Z",
  82: "2026-07-01T16:00:00Z",
  83: "2026-07-01T00:00:00Z",
  84: "2026-07-02T19:00:00Z",
  85: "2026-07-02T22:00:00Z",
  86: "2026-07-02T16:00:00Z",
  87: "2026-07-03T19:00:00Z",
  88: "2026-07-03T22:00:00Z",
};

async function seedBronzeAndFinal(
  now: string,
  coveredByReal: Set<number>,
): Promise<number> {
  const batch = adminDb.batch();
  let count = 0;
  const seeds: Array<{
    docId: string;
    matchNumber: number;
    stage: MatchStage;
    utcDate: string;
    homeLabel: string;
    awayLabel: string;
  }> = [
    {
      docId: `BRACKET-BRONZE-${BRACKET_BRONZE.matchNumber}`,
      matchNumber: BRACKET_BRONZE.matchNumber,
      stage: "THIRD_PLACE",
      utcDate: KO_OFFICIAL_TIMES[BRACKET_BRONZE.matchNumber],
      homeLabel: BRACKET_BRONZE.homeLabel,
      awayLabel: BRACKET_BRONZE.awayLabel,
    },
    {
      docId: `BRACKET-FINAL-${BRACKET_FINAL.matchNumber}`,
      matchNumber: BRACKET_FINAL.matchNumber,
      stage: "FINAL",
      utcDate: KO_OFFICIAL_TIMES[BRACKET_FINAL.matchNumber],
      homeLabel: BRACKET_FINAL.homeLabel,
      awayLabel: BRACKET_FINAL.awayLabel,
    },
  ];
  for (const s of seeds) {
    if (coveredByReal.has(s.matchNumber)) continue;
    const ref = adminDb.collection("matches").doc(s.docId);
    const snap = await ref.get();
    if (snap.exists) continue;
    const m: Match = {
      id: s.docId,
      footballDataId: -s.matchNumber,
      matchNumber: s.matchNumber,
      stage: s.stage,
      utcDate: s.utcDate,
      status: "SCHEDULED",
      homeTeam: {
        id: "TBD",
        name: s.homeLabel,
        shortName: s.homeLabel,
        tla: "",
        crest: "",
      },
      awayTeam: {
        id: "TBD",
        name: s.awayLabel,
        shortName: s.awayLabel,
        tla: "",
        crest: "",
      },
      homeLabel: s.homeLabel,
      awayLabel: s.awayLabel,
      score: {
        homeFullTime: null,
        awayFullTime: null,
        winner: null,
      },
      updatedAt: now,
    };
    batch.set(ref, m);
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}

async function seedR32(
  now: string,
  coveredByReal: Set<number>,
): Promise<number> {
  const batch = adminDb.batch();
  let count = 0;
  for (const slot of BRACKET_R32) {
    if (coveredByReal.has(slot.matchNumber)) continue;
    const docId = `BRACKET-R32-${slot.matchNumber}`;
    const ref = adminDb.collection("matches").doc(docId);
    const snap = await ref.get();
    if (snap.exists) continue;
    const m: Match = {
      id: docId,
      footballDataId: -slot.matchNumber, // sentinel negativo
      matchNumber: slot.matchNumber,
      stage: "ROUND_OF_32",
      utcDate:
        KO_OFFICIAL_TIMES[slot.matchNumber] ??
        R32_DATES[slot.matchNumber] ??
        "2026-06-28T19:00:00Z",
      status: "SCHEDULED",
      homeTeam: {
        id: "TBD",
        name: slot.homeLabel,
        shortName: slot.homeLabel,
        tla: "",
        crest: "",
      },
      awayTeam: {
        id: "TBD",
        name: slot.awayLabel,
        shortName: slot.awayLabel,
        tla: "",
        crest: "",
      },
      homeLabel: slot.homeLabel,
      awayLabel: slot.awayLabel,
      score: {
        homeFullTime: null,
        awayFullTime: null,
        winner: null,
      },
      updatedAt: now,
    };
    batch.set(ref, m);
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}
