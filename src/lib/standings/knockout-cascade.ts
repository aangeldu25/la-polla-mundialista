// Dado el bracket de R32 resuelto y las predicciones del usuario, deriva los
// equipos en R16, Cuartos, Semis, Final y Tercer puesto en cascada.
//
// Lógica: para cada partido de eliminatoria, si el usuario predijo un ganador
// (homeScore != awayScore), ese equipo avanza. Si predijo empate, queda TBD
// (el usuario tendría que decidir un ganador de penales, no soportado por
// ahora — mostraremos placeholder).

import {
  BRACKET_BRONZE,
  BRACKET_FINAL,
  BRACKET_QF,
  BRACKET_R16,
  BRACKET_SF,
} from "@/lib/constants/wc2026-bracket";
import type { Match, MatchPrediction } from "@/types/domain";
import { assignR32Slots, type ResolvedSlot } from "./r32-cascade";
import type { TeamStanding } from "./group-standings";

export type DerivedBracket = Map<number, ResolvedSlot>;

// Para un partido eliminatorio determinado por matchNumber, encuentra la
// predicción del usuario y retorna el TLA ganador (o null si predijo empate
// o no hay predicción).
// Busca la predicción de un partido por su matchNumber, tolerando documentos
// duplicados (el real de Football-Data y el placeholder sembrado comparten
// matchNumber; la predicción del usuario puede estar en cualquiera de los dos).
function findPredictionByMatchNumber(
  matchNumber: number,
  allMatches: Match[],
  predictions: Map<string, MatchPrediction>,
): MatchPrediction | undefined {
  for (const m of allMatches) {
    if (m.matchNumber !== matchNumber) continue;
    const p = predictions.get(m.id);
    if (p) return p;
  }
  return undefined;
}

function pickWinner(
  matchNumber: number,
  allMatches: Match[],
  predictions: Map<string, MatchPrediction>,
  derivedHomeTla: string | null,
  derivedAwayTla: string | null,
): string | null {
  const pred = findPredictionByMatchNumber(matchNumber, allMatches, predictions);
  if (!pred) return null;
  if (pred.homeScore > pred.awayScore) return derivedHomeTla;
  if (pred.awayScore > pred.homeScore) return derivedAwayTla;
  // Empate: usar el equipo que el usuario eligió que avanza (por penales)
  if (pred.advancingTeamTla) return pred.advancingTeamTla;
  return null;
}

// Para Bronce: necesitamos el PERDEDOR de las SF
function pickLoser(
  matchNumber: number,
  allMatches: Match[],
  predictions: Map<string, MatchPrediction>,
  derivedHomeTla: string | null,
  derivedAwayTla: string | null,
): string | null {
  const pred = findPredictionByMatchNumber(matchNumber, allMatches, predictions);
  if (!pred) return null;
  if (pred.homeScore > pred.awayScore) return derivedAwayTla;
  if (pred.awayScore > pred.homeScore) return derivedHomeTla;
  // Empate con avance por penales: el que NO avanzó es el perdedor
  if (pred.advancingTeamTla) {
    if (pred.advancingTeamTla === derivedHomeTla) return derivedAwayTla;
    if (pred.advancingTeamTla === derivedAwayTla) return derivedHomeTla;
  }
  return null;
}

// Extrae el número de partido del label "Ganador N" o "Perdedor N"
function parseRefLabel(
  label: string,
): { type: "W" | "L"; matchNumber: number } | null {
  const m = label.match(/^(Ganador|Perdedor)\s+(\d+)$/);
  if (!m) return null;
  return { type: m[1] === "Ganador" ? "W" : "L", matchNumber: parseInt(m[2], 10) };
}

export function computeDerivedBracket(
  allMatches: Match[],
  predictions: Map<string, MatchPrediction>,
  standingsByGroup: Record<string, TeamStanding[]>,
): DerivedBracket {
  const result: DerivedBracket = new Map();

  // R32 — asignado desde standings
  const r32 = assignR32Slots(standingsByGroup);
  for (const slot of r32) result.set(slot.matchNumber, slot);

  // Helper para resolver un label "Ganador N" / "Perdedor N"
  function resolveRef(label: string): string | null {
    const parsed = parseRefLabel(label);
    if (!parsed) return null;
    const refSlot = result.get(parsed.matchNumber);
    if (!refSlot) return null;
    if (parsed.type === "W") {
      return pickWinner(
        parsed.matchNumber,
        allMatches,
        predictions,
        refSlot.homeTla,
        refSlot.awayTla,
      );
    } else {
      return pickLoser(
        parsed.matchNumber,
        allMatches,
        predictions,
        refSlot.homeTla,
        refSlot.awayTla,
      );
    }
  }

  // R16 → QF → SF → Bronce / Final
  const allKnockoutAfterR32 = [
    ...BRACKET_R16,
    ...BRACKET_QF,
    ...BRACKET_SF,
    BRACKET_BRONZE,
    BRACKET_FINAL,
  ];
  for (const slot of allKnockoutAfterR32) {
    const homeTla = resolveRef(slot.homeLabel);
    const awayTla = resolveRef(slot.awayLabel);
    result.set(slot.matchNumber, {
      matchNumber: slot.matchNumber,
      homeTla,
      awayTla,
      homeLabel: slot.homeLabel,
      awayLabel: slot.awayLabel,
    });
  }

  return result;
}
