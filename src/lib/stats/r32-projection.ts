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
