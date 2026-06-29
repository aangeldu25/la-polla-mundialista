// Proyección REAL de los clasificados a Dieciseisavos (R32), basada en los
// resultados oficiales de la fase de grupos (no en predicciones).
//
// Para cada slot del R32 ("1° Grupo A", "3° de C/E/F/H/I", ...) resuelve qué
// selección lo va ocupando según la tabla real, y marca si ya está CONFIRMADO:
//   - Slot directo (N° de un grupo): confirmado si ese grupo terminó sus 6
//     partidos (la posición ya no puede cambiar).
//   - Slot de mejor tercero: confirmado solo cuando TODOS los grupos terminaron
//     (el ranking de mejores 8 terceros queda fijo).

import { WC2026_GROUPS } from "@/lib/constants/wc2026-groups";
import {
  BRACKET_BRONZE,
  BRACKET_FINAL,
  BRACKET_QF,
  BRACKET_R16,
  BRACKET_SF,
} from "@/lib/constants/wc2026-bracket";
import { assignR32Slots } from "@/lib/standings/r32-cascade";
import { computeRealGroupStandings } from "./tournament-stats";
import type { Match } from "@/types/domain";
import type { TeamStanding } from "@/lib/standings/group-standings";

export interface ProjectedTeam {
  tla: string;
  confirmed: boolean; // true = clasificación oficial; false = provisional
}

export interface R32SlotProjection {
  homeTla: string | null;
  awayTla: string | null;
  homeConfirmed: boolean;
  awayConfirmed: boolean;
}

// Cada grupo tiene 6 partidos (4 equipos, todos contra todos).
const GROUP_MATCHES = 6;

function isGroupComplete(group: string, allMatches: Match[]): boolean {
  let finished = 0;
  for (const m of allMatches) {
    if (m.stage === "GROUP" && m.group === group && m.status === "FINISHED") {
      finished++;
    }
  }
  return finished >= GROUP_MATCHES;
}

// Determina los grupos referenciados por un label de slot.
function groupsInLabel(label: string): {
  direct: string | null;
  thirds: string[] | null;
} {
  const direct = label.match(/^\d°\s+Grupo\s+([A-L])$/);
  if (direct) return { direct: direct[1], thirds: null };
  const third = label.match(/^3°\s+de\s+([A-L/]+)$/);
  if (third) return { direct: null, thirds: third[1].split("/") };
  return { direct: null, thirds: null };
}

export function computeRealR32Projection(
  allMatches: Match[],
): Map<number, R32SlotProjection> {
  // Standings reales por grupo (solo partidos terminados, para proyección firme)
  const standingsByGroup: Record<string, TeamStanding[]> = {};
  const groupComplete: Record<string, boolean> = {};
  for (const g of Object.keys(WC2026_GROUPS)) {
    standingsByGroup[g] = computeRealGroupStandings(g, allMatches).standings;
    groupComplete[g] = isGroupComplete(g, allMatches);
  }
  const allGroupsComplete = Object.values(groupComplete).every(Boolean);

  // Reutilizamos el asignador de slots (mismo que el bracket de predicción)
  const slots = assignR32Slots(standingsByGroup);

  const result = new Map<number, R32SlotProjection>();
  for (const slot of slots) {
    const homeInfo = groupsInLabel(slot.homeLabel);
    const awayInfo = groupsInLabel(slot.awayLabel);
    const confirmed = (info: ReturnType<typeof groupsInLabel>): boolean => {
      if (info.direct) return groupComplete[info.direct] ?? false;
      if (info.thirds) return allGroupsComplete; // terceros: requiere todo cerrado
      return false;
    };
    result.set(slot.matchNumber, {
      homeTla: slot.homeTla,
      awayTla: slot.awayTla,
      homeConfirmed: slot.homeTla ? confirmed(homeInfo) : false,
      awayConfirmed: slot.awayTla ? confirmed(awayInfo) : false,
    });
  }
  return result;
}

// ───────────────────── Cascada REAL de toda la eliminatoria ─────────────────
// Proyecta los equipos de TODAS las rondas (R32 → Octavos → Cuartos → Semis →
// Bronce → Final) según los resultados reales, propagando los ganadores:
//   • Confirmado (full color): el equipo ya ganó su partido (FINISHED) o el
//     grupo cerró (para R32). No puede cambiar.
//   • Provisional (transparente): proyección por grupos aún abiertos, o el
//     líder de un partido EN VIVO que alimenta la siguiente ronda.
// Cuando el partido ya tiene equipos reales en el doc (porque se está jugando o
// terminó), esos mandan; si no, se deriva de los ganadores/perdedores previos.

interface KnockoutResult {
  tla: string | null;
  confirmed: boolean;
}

function parseRef(
  label: string,
): { type: "W" | "L"; matchNumber: number } | null {
  const m = label.match(/^(Ganador|Perdedor)\s+(\d+)$/);
  if (!m) return null;
  return { type: m[1] === "Ganador" ? "W" : "L", matchNumber: parseInt(m[2], 10) };
}

// Ganador/perdedor reales de un partido eliminatorio según su marcador.
function realResultOf(doc: Match | undefined): {
  winner: KnockoutResult;
  loser: KnockoutResult;
} {
  const none = {
    winner: { tla: null, confirmed: false },
    loser: { tla: null, confirmed: false },
  };
  if (!doc) return none;
  const h = doc.homeTeam.tla || null;
  const a = doc.awayTeam.tla || null;
  if (!h || !a) return none;
  const s = doc.score;
  const finished =
    doc.status === "FINISHED" &&
    s.homeFullTime !== null &&
    s.awayFullTime !== null;
  const live =
    doc.status === "LIVE" &&
    s.homeFullTime !== null &&
    s.awayFullTime !== null;
  if (!finished && !live) return none;

  let homeWins: boolean | null;
  if (s.homeFullTime! > s.awayFullTime!) homeWins = true;
  else if (s.homeFullTime! < s.awayFullTime!) homeWins = false;
  else if (
    s.homePenalties !== null &&
    s.homePenalties !== undefined &&
    s.awayPenalties !== null &&
    s.awayPenalties !== undefined
  ) {
    homeWins =
      s.homePenalties > s.awayPenalties
        ? true
        : s.homePenalties < s.awayPenalties
          ? false
          : null;
  } else homeWins = null; // empate sin penales (en vivo) → aún indefinido

  if (homeWins === null) return none;
  const winTla = homeWins ? h : a;
  const loseTla = homeWins ? a : h;
  return {
    winner: { tla: winTla, confirmed: finished },
    loser: { tla: loseTla, confirmed: finished },
  };
}

export function computeRealKnockoutProjection(
  allMatches: Match[],
): Map<number, R32SlotProjection> {
  const result = new Map<number, R32SlotProjection>(
    computeRealR32Projection(allMatches),
  );

  // Doc real por matchNumber (prefiere el de Football-Data con equipos).
  const docByNum = new Map<number, Match>();
  for (const m of allMatches) {
    if (m.matchNumber === undefined) continue;
    const ex = docByNum.get(m.matchNumber);
    if (!ex || (!ex.homeTeam.tla && m.homeTeam.tla)) {
      docByNum.set(m.matchNumber, m);
    }
  }

  const winnerOf = new Map<number, KnockoutResult>();
  const loserOf = new Map<number, KnockoutResult>();

  const resolveRef = (label: string): KnockoutResult => {
    const ref = parseRef(label);
    if (!ref) return { tla: null, confirmed: false };
    const src = ref.type === "W" ? winnerOf : loserOf;
    return src.get(ref.matchNumber) ?? { tla: null, confirmed: false };
  };

  // Procesar en orden de número (los refs siempre apuntan a números menores).
  // R32 ya está en `result`; calculamos sus ganadores y luego cascada R16→Final.
  for (let n = 73; n <= 88; n++) {
    const res = realResultOf(docByNum.get(n));
    winnerOf.set(n, res.winner);
    loserOf.set(n, res.loser);
  }

  const laterRounds = [
    ...BRACKET_R16,
    ...BRACKET_QF,
    ...BRACKET_SF,
    BRACKET_BRONZE,
    BRACKET_FINAL,
  ];
  for (const slot of laterRounds) {
    const n = slot.matchNumber;
    const doc = docByNum.get(n);
    const offHome = doc?.homeTeam.tla || null;
    const offAway = doc?.awayTeam.tla || null;
    // Si el partido ya tiene equipos reales (jugándose/terminado), mandan ellos
    // (confirmados: ya clasificaron a esta ronda). Si no, cascada de previos.
    const home: KnockoutResult = offHome
      ? { tla: offHome, confirmed: true }
      : resolveRef(slot.homeLabel);
    const away: KnockoutResult = offAway
      ? { tla: offAway, confirmed: true }
      : resolveRef(slot.awayLabel);

    result.set(n, {
      homeTla: home.tla,
      awayTla: away.tla,
      homeConfirmed: home.confirmed,
      awayConfirmed: away.confirmed,
    });

    // Resultado de este partido para alimentar la siguiente ronda. Si vino de
    // cascada (no doc), no puede haberse jugado, así que solo cuenta el doc.
    const res = realResultOf(doc);
    winnerOf.set(n, res.winner);
    loserOf.set(n, res.loser);
  }

  return result;
}
