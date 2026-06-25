// Dataset histórico curado de promedios de gol por Copa del Mundo.
// Fuente: registros públicos oficiales de FIFA (goles / partidos por edición).
// Se usa para contextualizar el promedio del Mundial 2026 contra la historia.

export interface WorldCupEdition {
  year: number;
  host: string;
  matches: number;
  goals: number;
  avg: number; // goles por partido
}

// Ordenadas por año. avg = goals / matches (redondeado a 2 decimales).
export const WORLD_CUP_HISTORY: WorldCupEdition[] = [
  { year: 1930, host: "Uruguay", matches: 18, goals: 70, avg: 3.89 },
  { year: 1934, host: "Italia", matches: 17, goals: 70, avg: 4.12 },
  { year: 1938, host: "Francia", matches: 18, goals: 84, avg: 4.67 },
  { year: 1950, host: "Brasil", matches: 22, goals: 88, avg: 4.0 },
  { year: 1954, host: "Suiza", matches: 26, goals: 140, avg: 5.38 },
  { year: 1958, host: "Suecia", matches: 35, goals: 126, avg: 3.6 },
  { year: 1962, host: "Chile", matches: 32, goals: 89, avg: 2.78 },
  { year: 1966, host: "Inglaterra", matches: 32, goals: 89, avg: 2.78 },
  { year: 1970, host: "México", matches: 32, goals: 95, avg: 2.97 },
  { year: 1974, host: "Alemania", matches: 38, goals: 97, avg: 2.55 },
  { year: 1978, host: "Argentina", matches: 38, goals: 102, avg: 2.68 },
  { year: 1982, host: "España", matches: 52, goals: 146, avg: 2.81 },
  { year: 1986, host: "México", matches: 52, goals: 132, avg: 2.54 },
  { year: 1990, host: "Italia", matches: 52, goals: 115, avg: 2.21 },
  { year: 1994, host: "EE. UU.", matches: 52, goals: 141, avg: 2.71 },
  { year: 1998, host: "Francia", matches: 64, goals: 171, avg: 2.67 },
  { year: 2002, host: "Corea/Japón", matches: 64, goals: 161, avg: 2.52 },
  { year: 2006, host: "Alemania", matches: 64, goals: 147, avg: 2.3 },
  { year: 2010, host: "Sudáfrica", matches: 64, goals: 145, avg: 2.27 },
  { year: 2014, host: "Brasil", matches: 64, goals: 171, avg: 2.67 },
  { year: 2018, host: "Rusia", matches: 64, goals: 169, avg: 2.64 },
  { year: 2022, host: "Catar", matches: 64, goals: 172, avg: 2.69 },
];

// Dado el promedio actual, devuelve el ranking histórico contextual:
// posición que ocuparía, la edición justo por encima y por debajo.
export interface HistoricalContext {
  rankIfHeld: number; // posición (1 = más goleador de la historia)
  totalEditions: number;
  isRecord: boolean;
  above: WorldCupEdition | null; // edición con promedio inmediatamente mayor
  below: WorldCupEdition | null; // edición con promedio inmediatamente menor
  allTimeBest: WorldCupEdition;
  allTimeWorst: WorldCupEdition;
}

export function getHistoricalContext(currentAvg: number): HistoricalContext {
  const sorted = [...WORLD_CUP_HISTORY].sort((a, b) => b.avg - a.avg);
  // Cuántas ediciones tienen un promedio estrictamente mayor
  const higher = sorted.filter((e) => e.avg > currentAvg);
  const rankIfHeld = higher.length + 1;
  const above = higher.length > 0 ? higher[higher.length - 1] : null;
  const below = sorted.find((e) => e.avg < currentAvg) ?? null;
  return {
    rankIfHeld,
    totalEditions: sorted.length + 1, // +1 incluyendo el actual
    isRecord: higher.length === 0,
    above,
    below,
    allTimeBest: sorted[0],
    allTimeWorst: sorted[sorted.length - 1],
  };
}

// El Mundial 2026 es el primero con 104 partidos (48 equipos). Esto casi
// garantiza un récord de goles TOTALES aunque el promedio sea normal.
export const WC2026_MATCHES = 104;

export interface GoalRecordContext {
  // Récord histórico de goles totales en una sola Copa
  recordTotal: WorldCupEdition;
  // Proyección de goles totales de 2026 al ritmo actual
  projectedTotal: number;
  willBreakRecord: boolean;
  // Edición anterior (2022) para comparar el ritmo
  previous: WorldCupEdition;
  // Variación porcentual del promedio vs la edición anterior
  vsPreviousPct: number;
  // Top 3 ediciones por promedio de gol
  topByAvg: WorldCupEdition[];
}

// ===== Records históricos curados (fuente: registros oficiales FIFA) =====
// Datos estáticos verificados, usados para contrastar con el Mundial 2026.

export const ALL_TIME_RECORDS = {
  // Máximo goleador en la historia de los Mundiales (todas las ediciones)
  topScorerAllTime: { name: "Miroslav Klose", country: "Alemania", goals: 16 },
  // Más goles en una sola Copa
  topScorerOneWC: { name: "Just Fontaine", country: "Francia", goals: 13, year: 1958 },
  // Gol más rápido registrado
  fastestGoal: { name: "Hakan Şükür", country: "Turquía", seconds: 10.8, year: 2002 },
  // Partido con más goles
  highestScoringMatch: {
    label: "Austria 7–5 Suiza",
    goals: 12,
    year: 1954,
  },
  // Mayor goleada (diferencia)
  biggestWin: { label: "Hungría 10–1 El Salvador", margin: 9, year: 1982 },
};

// Hitos de reglas y tácticas que explican la curva de goles a lo largo de la
// historia (para anotar en la línea de tiempo).
export const RULE_CHANGES: Array<{ year: number; label: string }> = [
  {
    year: 1925,
    label: "Fuera de juego a 2 defensores → explosión de goles (pico en 1954)",
  },
  { year: 1962, label: "Auge del catenaccio → fútbol más defensivo, caen los goles" },
  { year: 1970, label: "Tarjetas amarilla y roja · primeras sustituciones" },
  { year: 1990, label: "Cambio en el fuera de juego (atacante a la par, habilitado)" },
  { year: 1994, label: "3 puntos por victoria" },
  { year: 1998, label: "Gol de oro" },
  { year: 2018, label: "VAR (videoarbitraje)" },
];

// Expansión del torneo a lo largo de la historia (equipos participantes).
export const FORMAT_TIMELINE: Array<{ from: number; teams: number }> = [
  { from: 1930, teams: 13 },
  { from: 1934, teams: 16 },
  { from: 1982, teams: 24 },
  { from: 1998, teams: 32 },
  { from: 2026, teams: 48 },
];

// Jugadores activos a seguir, con sus goles en Mundiales ANTERIORES a 2026
// (cifras oficiales verificadas). Los goles de 2026 se suman en vivo desde
// openfootball. `matchKeys` ayuda a encontrarlos en la lista de goleadores
// (los nombres varían entre fuentes).
export interface PlayerMilestone {
  name: string;
  teamTla: string;
  priorWcGoals: number; // goles en Mundiales antes de 2026
  priorWcEditions: number; // en cuántos Mundiales distintos anotó
  matchKeys: string[]; // substrings para emparejar en goleadores 2026
  note: string; // hito a seguir
}

export const PLAYER_WATCHLIST: PlayerMilestone[] = [
  {
    name: "Lionel Messi",
    teamTla: "ARG",
    priorWcGoals: 13,
    priorWcEditions: 4,
    matchKeys: ["Messi"],
    note: "Persigue el récord histórico de Klose (16)",
  },
  {
    name: "Cristiano Ronaldo",
    teamTla: "POR",
    priorWcGoals: 8,
    priorWcEditions: 4,
    matchKeys: ["Cristiano Ronaldo", "Ronaldo"],
    note: "Sigue ampliando su marca de Mundiales con gol",
  },
  {
    name: "Kylian Mbappé",
    teamTla: "FRA",
    priorWcGoals: 12,
    priorWcEditions: 2,
    matchKeys: ["Mbappé", "Mbappe"],
    note: "A su edad, ya escala hacia el récord de Klose (16)",
  },
  {
    name: "Neymar",
    teamTla: "BRA",
    priorWcGoals: 8,
    priorWcEditions: 3,
    matchKeys: ["Neymar"],
    note: "Máximo goleador histórico de Brasil en Mundiales en la mira",
  },
];

export function getGoalRecordContext(currentAvg: number): GoalRecordContext {
  const byTotal = [...WORLD_CUP_HISTORY].sort((a, b) => b.goals - a.goals);
  const byAvg = [...WORLD_CUP_HISTORY].sort((a, b) => b.avg - a.avg);
  const previous = WORLD_CUP_HISTORY[WORLD_CUP_HISTORY.length - 1]; // 2022
  const projectedTotal = Math.round(currentAvg * WC2026_MATCHES);
  return {
    recordTotal: byTotal[0],
    projectedTotal,
    willBreakRecord: projectedTotal > byTotal[0].goals,
    previous,
    vsPreviousPct:
      previous.avg > 0
        ? Math.round(((currentAvg - previous.avg) / previous.avg) * 100)
        : 0,
    topByAvg: byAvg.slice(0, 3),
  };
}
