// Dada la tabla de posiciones predichas por el usuario, asigna los 32
// equipos clasificados a los 16 partidos de Dieciseisavos (R32).
//
// Algoritmo:
// 1. Top 2 de cada grupo (24 equipos) — asignados a slots etiquetados
//    "1° Grupo X" o "2° Grupo X"
// 2. Mejores 8 terceros (8 equipos) — asignados greedy a slots etiquetados
//    "3° de X/Y/Z..." en orden de mejor a peor tercero, eligiendo el primer
//    slot compatible que aún no esté asignado.

import { BRACKET_R32 } from "@/lib/constants/wc2026-bracket";
import {
  compareStandings,
  type TeamStanding,
} from "./group-standings";

export interface ResolvedSlot {
  matchNumber: number;
  homeTla: string | null;
  awayTla: string | null;
  homeLabel: string; // siempre el label original para fallback
  awayLabel: string;
}

// Extrae el dueño del slot a partir del label, e.g. "1° Grupo A" → {pos:1, group:"A"}
function parseDirectLabel(
  label: string,
): { pos: 1 | 2; group: string } | null {
  const m = label.match(/^(\d)°\s+Grupo\s+([A-L])$/);
  if (!m) return null;
  const pos = parseInt(m[1], 10);
  if (pos !== 1 && pos !== 2) return null;
  return { pos: pos as 1 | 2, group: m[2] };
}

// Extrae los grupos compatibles de un label de tercero, e.g.
// "3° de A/B/C/D/F" → ["A","B","C","D","F"]
function parseThirdLabel(label: string): string[] | null {
  const m = label.match(/^3°\s+de\s+([A-L\/]+)$/);
  if (!m) return null;
  return m[1].split("/");
}

export function assignR32Slots(
  standingsByGroup: Record<string, TeamStanding[]>,
): ResolvedSlot[] {
  // Calcular mejores 8 terceros
  const allThirds: TeamStanding[] = [];
  for (const list of Object.values(standingsByGroup)) {
    if (list[2]) allThirds.push(list[2]);
  }
  // Solo considerar terceros con estadísticas (partidos predichos)
  const validThirds = allThirds.filter((t) => t.played > 0);
  validThirds.sort(compareStandings);
  const best8Thirds = validThirds.slice(0, 8);
  const best8Set = new Set(best8Thirds.map((t) => t.teamTla));
  const thirdByGroup = new Map<string, TeamStanding>();
  for (const t of best8Thirds) {
    // Encuentra el grupo de este tercer puesto
    for (const [g, list] of Object.entries(standingsByGroup)) {
      if (list[2] && list[2].teamTla === t.teamTla) {
        thirdByGroup.set(g, t);
        break;
      }
    }
  }

  // Primer pase: resolver labels directos ("1° Grupo X" y "2° Grupo X")
  // y recopilar las posiciones de slots de terceros para matching
  const slotData = BRACKET_R32.map((slot) => {
    const home = resolveDirect(slot.homeLabel, standingsByGroup);
    const away = resolveDirect(slot.awayLabel, standingsByGroup);
    return {
      slot,
      home,
      away,
      homeThirdGroups: home === null ? parseThirdLabel(slot.homeLabel) : null,
      awayThirdGroups: away === null ? parseThirdLabel(slot.awayLabel) : null,
    };
  });

  // Recopilar las 8 posiciones de "3° de ..." en un array indexado
  type ThirdSlot = {
    idx: number; // índice en slotData
    side: "home" | "away";
    groups: string[];
  };
  const thirdSlots: ThirdSlot[] = [];
  slotData.forEach((item, idx) => {
    if (item.homeThirdGroups) {
      thirdSlots.push({ idx, side: "home", groups: item.homeThirdGroups });
    }
    if (item.awayThirdGroups) {
      thirdSlots.push({ idx, side: "away", groups: item.awayThirdGroups });
    }
  });

  // Lista de grupos con tercero válido entre los mejores 8
  const availableGroups = Array.from(thirdByGroup.keys());

  // Matching bipartito por backtracking: asignar grupos → slots de tercero.
  // Prioriza llenar el máximo de slots; entre asignaciones máximas, prefiere
  // dar al "mejor tercero" un slot temprano (orden de slot).
  // Ordenamos slots por su orden natural; los terceros se prueban en orden de
  // mejor → peor (compareStandings ya está computado en best8Thirds).
  const orderedThirdsByRank = best8Thirds.map((t) => {
    for (const [g, list] of Object.entries(standingsByGroup)) {
      if (list[2] && list[2].teamTla === t.teamTla) return g;
    }
    return null;
  }).filter((g): g is string => g !== null);

  // assignment[slotIndex] = groupLetter
  const assignment = new Array<string | null>(thirdSlots.length).fill(null);
  const bestAssignment = { count: 0, arr: [...assignment] };

  function backtrack(slotIdx: number, usedGroups: Set<string>) {
    if (slotIdx === thirdSlots.length) {
      const count = assignment.filter((a) => a !== null).length;
      if (count > bestAssignment.count) {
        bestAssignment.count = count;
        bestAssignment.arr = [...assignment];
      }
      return;
    }
    // Poda: si ni siquiera asignando todo lo restante superamos el mejor, salir
    const remaining = thirdSlots.length - slotIdx;
    const current = assignment.filter((a) => a !== null).length;
    if (current + remaining <= bestAssignment.count) return;

    const slot = thirdSlots[slotIdx];
    // Probar candidatos en orden de mejor → peor tercero
    for (const g of orderedThirdsByRank) {
      if (usedGroups.has(g)) continue;
      if (!slot.groups.includes(g)) continue;
      assignment[slotIdx] = g;
      usedGroups.add(g);
      backtrack(slotIdx + 1, usedGroups);
      usedGroups.delete(g);
      assignment[slotIdx] = null;
    }
    // También probar dejar este slot sin asignar (por si no hay candidato)
    backtrack(slotIdx + 1, usedGroups);
  }

  if (availableGroups.length > 0 && thirdSlots.length > 0) {
    backtrack(0, new Set<string>());
  }

  // Aplicar el matching encontrado
  bestAssignment.arr.forEach((groupLetter, i) => {
    if (!groupLetter) return;
    const third = thirdByGroup.get(groupLetter);
    if (!third) return;
    const ts = thirdSlots[i];
    if (ts.side === "home") slotData[ts.idx].home = third.teamTla;
    else slotData[ts.idx].away = third.teamTla;
  });

  const result: ResolvedSlot[] = slotData.map(({ slot, home, away }) => ({
    matchNumber: slot.matchNumber,
    homeTla: home,
    awayTla: away,
    homeLabel: slot.homeLabel,
    awayLabel: slot.awayLabel,
  }));

  void best8Set; // suppress unused
  return result;
}

function resolveDirect(
  label: string,
  standingsByGroup: Record<string, TeamStanding[]>,
): string | null {
  const parsed = parseDirectLabel(label);
  if (!parsed) return null;
  const list = standingsByGroup[parsed.group];
  if (!list) return null;
  const team = list[parsed.pos - 1];
  // Solo si el equipo tiene predicciones (no es 0-0-0)
  if (!team || team.played === 0) return null;
  return team.teamTla;
}

