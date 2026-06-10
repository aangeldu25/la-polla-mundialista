// Bracket oficial del Mundial 2026 (104 partidos: 72 grupos + 16 R32 + 8 R16 + 4 QF + 2 SF + Bronce + Final).
// Para partidos donde los equipos aún no están definidos, mostramos el label
// del bracket en lugar de "Por definir".
//
// Fuente: FWC26 Match Schedule v17 (FIFA, 10 abril 2026)

export interface BracketSlot {
  matchNumber: number; // Número FIFA del partido (1-104)
  homeLabel: string; // Ej: "1° Grupo A", "3° de C/E/F/H/I"
  awayLabel: string;
}

// Dieciseisavos (Round of 32) — partidos 73 a 88
export const BRACKET_R32: BracketSlot[] = [
  { matchNumber: 73, homeLabel: "2° Grupo A", awayLabel: "2° Grupo B" },
  { matchNumber: 74, homeLabel: "1° Grupo E", awayLabel: "3° de A/B/C/D/F" },
  { matchNumber: 75, homeLabel: "1° Grupo F", awayLabel: "2° Grupo C" },
  { matchNumber: 76, homeLabel: "1° Grupo C", awayLabel: "2° Grupo F" },
  { matchNumber: 77, homeLabel: "1° Grupo I", awayLabel: "3° de C/D/F/G/H" },
  { matchNumber: 78, homeLabel: "2° Grupo E", awayLabel: "2° Grupo I" },
  { matchNumber: 79, homeLabel: "1° Grupo A", awayLabel: "3° de C/E/F/H/I" },
  { matchNumber: 80, homeLabel: "1° Grupo L", awayLabel: "3° de E/H/I/J/K" },
  { matchNumber: 81, homeLabel: "1° Grupo D", awayLabel: "3° de B/E/F/I/J" },
  { matchNumber: 82, homeLabel: "1° Grupo G", awayLabel: "3° de A/E/H/I/J" },
  { matchNumber: 83, homeLabel: "2° Grupo K", awayLabel: "2° Grupo L" },
  { matchNumber: 84, homeLabel: "1° Grupo H", awayLabel: "2° Grupo J" },
  { matchNumber: 85, homeLabel: "1° Grupo B", awayLabel: "3° de E/F/G/I/J" },
  { matchNumber: 86, homeLabel: "1° Grupo J", awayLabel: "2° Grupo H" },
  { matchNumber: 87, homeLabel: "1° Grupo K", awayLabel: "3° de D/E/I/J/L" },
  { matchNumber: 88, homeLabel: "2° Grupo D", awayLabel: "2° Grupo G" },
];

// Octavos (Round of 16) — partidos 89 a 96
export const BRACKET_R16: BracketSlot[] = [
  { matchNumber: 89, homeLabel: "Ganador 74", awayLabel: "Ganador 77" },
  { matchNumber: 90, homeLabel: "Ganador 73", awayLabel: "Ganador 75" },
  { matchNumber: 91, homeLabel: "Ganador 76", awayLabel: "Ganador 78" },
  { matchNumber: 92, homeLabel: "Ganador 79", awayLabel: "Ganador 80" },
  { matchNumber: 93, homeLabel: "Ganador 83", awayLabel: "Ganador 84" },
  { matchNumber: 94, homeLabel: "Ganador 81", awayLabel: "Ganador 82" },
  { matchNumber: 95, homeLabel: "Ganador 86", awayLabel: "Ganador 88" },
  { matchNumber: 96, homeLabel: "Ganador 85", awayLabel: "Ganador 87" },
];

// Cuartos — partidos 97 a 100
export const BRACKET_QF: BracketSlot[] = [
  { matchNumber: 97, homeLabel: "Ganador 89", awayLabel: "Ganador 90" },
  { matchNumber: 98, homeLabel: "Ganador 93", awayLabel: "Ganador 94" },
  { matchNumber: 99, homeLabel: "Ganador 91", awayLabel: "Ganador 92" },
  { matchNumber: 100, homeLabel: "Ganador 95", awayLabel: "Ganador 96" },
];

// Semifinales — partidos 101 a 102
export const BRACKET_SF: BracketSlot[] = [
  { matchNumber: 101, homeLabel: "Ganador 97", awayLabel: "Ganador 98" },
  { matchNumber: 102, homeLabel: "Ganador 99", awayLabel: "Ganador 100" },
];

// Tercer lugar — partido 103
export const BRACKET_BRONZE: BracketSlot = {
  matchNumber: 103,
  homeLabel: "Perdedor 101",
  awayLabel: "Perdedor 102",
};

// Final — partido 104
export const BRACKET_FINAL: BracketSlot = {
  matchNumber: 104,
  homeLabel: "Ganador 101",
  awayLabel: "Ganador 102",
};

// Lookup combinado para acceder por número de partido
const ALL_SLOTS: BracketSlot[] = [
  ...BRACKET_R32,
  ...BRACKET_R16,
  ...BRACKET_QF,
  ...BRACKET_SF,
  BRACKET_BRONZE,
  BRACKET_FINAL,
];

export const BRACKET_BY_MATCH_NUMBER: Record<number, BracketSlot> =
  Object.fromEntries(ALL_SLOTS.map((s) => [s.matchNumber, s]));
