// Cálculo PURO de puntos de estructura (sin Firebase) — reutilizable en
// servidor (scoring) y cliente (mostrar el desglose por partido).
//
// Por cada cruce eliminatorio, compara el slot que el usuario predijo en su
// bracket contra los equipos REALES que llegaron a ese cruce:
//   - Duelo exacto: ambos equipos correctos en el mismo lado (absorbe todo).
//   - Slot: un equipo correcto en el mismo lado (home/away).
//   - Clasificado: tu equipo llegó a la ronda, pero en otro cruce.
// Jerarquía por equipo: Slot absorbe Clasificado.

import type { MatchStage } from "@/types/domain";

export const STRUCTURE_MULTIPLIER: Partial<Record<MatchStage, number>> = {
  ROUND_OF_32: 2,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  THIRD_PLACE: 4,
  FINAL: 5,
};
export const STRUCTURE_BASE = { classified: 2, slot: 3, exact: 5 };

export function structurePointsForRound(round: MatchStage) {
  const mult = STRUCTURE_MULTIPLIER[round] ?? 0;
  return {
    classified: STRUCTURE_BASE.classified * mult,
    slot: STRUCTURE_BASE.slot * mult,
    exact: STRUCTURE_BASE.exact * mult,
  };
}

export type StructureKind = "exact" | "slot" | "classified" | null;

export interface StructureResult {
  homeKind: StructureKind;
  awayKind: StructureKind;
  exact: boolean;
  points: number;
}

// Evalúa una predicción de slot contra los equipos reales de ese cruce.
// `teamsInRound` = todos los equipos (TLA) que efectivamente llegaron a la ronda.
export function evalStructureMatch(
  round: MatchStage,
  hPred: string | null | undefined,
  aPred: string | null | undefined,
  hActual: string | null | undefined,
  aActual: string | null | undefined,
  teamsInRound: Set<string>,
): StructureResult {
  const pts = structurePointsForRound(round);

  // Duelo exacto (absorbe Slot + Clasificado de ambos equipos).
  if (hPred && aPred && hPred === hActual && aPred === aActual) {
    return { homeKind: "exact", awayKind: "exact", exact: true, points: pts.exact };
  }

  let points = 0;
  let homeKind: StructureKind = null;
  let awayKind: StructureKind = null;
  if (hPred) {
    if (hPred === hActual) {
      homeKind = "slot";
      points += pts.slot;
    } else if (teamsInRound.has(hPred)) {
      homeKind = "classified";
      points += pts.classified;
    }
  }
  if (aPred) {
    if (aPred === aActual) {
      awayKind = "slot";
      points += pts.slot;
    } else if (teamsInRound.has(aPred)) {
      awayKind = "classified";
      points += pts.classified;
    }
  }
  return { homeKind, awayKind, exact: false, points };
}

// Etiqueta corta para mostrar el resultado de estructura de un cruce.
export function structureLabel(r: StructureResult): string | null {
  if (r.points <= 0) return null;
  if (r.exact) return "Duelo exacto";
  const kinds = [r.homeKind, r.awayKind].filter(Boolean) as StructureKind[];
  const hasSlot = kinds.includes("slot");
  const hasClass = kinds.includes("classified");
  if (hasSlot && hasClass) return "Slot + Clasificado";
  if (hasSlot) return kinds.length === 2 ? "Doble slot" : "Slot";
  if (hasClass) return kinds.length === 2 ? "Doble clasificado" : "Clasificado";
  return null;
}

// Conjunto de equipos (TLA) que llegaron a una ronda, a partir de los partidos
// de esa ronda que ya tienen equipos reales definidos.
export function teamsInRoundFrom(
  roundMatches: Array<{ homeTeam: { tla: string }; awayTeam: { tla: string } }>,
): Set<string> {
  const s = new Set<string>();
  for (const m of roundMatches) {
    if (m.homeTeam.tla) s.add(m.homeTeam.tla);
    if (m.awayTeam.tla) s.add(m.awayTeam.tla);
  }
  return s;
}
