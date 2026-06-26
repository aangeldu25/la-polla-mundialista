// Dada la tabla de posiciones predichas por el usuario, asigna los 32
// equipos clasificados a los 16 partidos de Dieciseisavos (R32).
//
// Algoritmo:
// 1. Top 2 de cada grupo (24 equipos) — asignados a slots etiquetados
//    "1° Grupo X" o "2° Grupo X"
// 2. Mejores 8 terceros (8 equipos) — asignados a sus slots según la TABLA
//    OFICIAL de la FIFA (Anexo C del Reglamento), que predetermina qué grupo
//    ocupa cada slot según la combinación exacta de 8 terceros que clasifican.

import { BRACKET_R32 } from "@/lib/constants/wc2026-bracket";
import { lookupThirdPlaceAssignment } from "@/lib/constants/wc2026-third-place-table";
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
  // 1) Resolver slots directos ("1° Grupo X" / "2° Grupo X")
  const slotData = BRACKET_R32.map((slot) => ({
    slot,
    home: resolveDirect(slot.homeLabel, standingsByGroup),
    away: resolveDirect(slot.awayLabel, standingsByGroup),
  }));

  // 2) Mejores 8 terceros por criterios FIFA, con su grupo
  const thirds: Array<{ group: string; standing: TeamStanding }> = [];
  for (const [g, list] of Object.entries(standingsByGroup)) {
    if (list[2] && list[2].played > 0) {
      thirds.push({ group: g, standing: list[2] });
    }
  }
  thirds.sort((a, b) => compareStandings(a.standing, b.standing));
  const best8 = thirds.slice(0, 8);

  // 3) Asignar terceros a sus slots usando la TABLA OFICIAL (Anexo C del
  //    Reglamento FIFA). Solo es posible cuando hay exactamente 8 terceros
  //    determinados (combinación válida); si no, los slots de tercero quedan
  //    sin definir (provisional) hasta que se completen los grupos.
  if (best8.length === 8) {
    const assignment = lookupThirdPlaceAssignment(best8.map((t) => t.group));
    if (assignment) {
      const byNumber = new Map(slotData.map((s) => [s.slot.matchNumber, s]));
      const standingByGroup = new Map(
        best8.map((t) => [t.group, t.standing]),
      );
      for (const [matchNumber, group] of Object.entries(assignment)) {
        const sd = byNumber.get(Number(matchNumber));
        const third = standingByGroup.get(group);
        if (!sd || !third) continue;
        // El slot de tercero es el lado cuyo label es "3° de ..."
        if (parseThirdLabel(sd.slot.awayLabel)) sd.away = third.teamTla;
        else if (parseThirdLabel(sd.slot.homeLabel)) sd.home = third.teamTla;
      }
    }
  }

  return slotData.map(({ slot, home, away }) => ({
    matchNumber: slot.matchNumber,
    homeTla: home,
    awayTla: away,
    homeLabel: slot.homeLabel,
    awayLabel: slot.awayLabel,
  }));
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

