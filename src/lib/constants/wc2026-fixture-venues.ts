// Mapeo matchNumber (1-104) → sede oficial del Mundial 2026.
// Fuente: Calendario oficial FIFA (fixture publicado 6 dic 2025).
// Genera la sede para CUALQUIER partido sin depender de Football-Data API.

export interface FixtureVenue {
  stadium: string;
  city: string;
  country: string;
  iso2: string;
}

const MEX = (stadium: string, city: string): FixtureVenue => ({
  stadium,
  city,
  country: "México",
  iso2: "mx",
});
const USA = (stadium: string, city: string): FixtureVenue => ({
  stadium,
  city,
  country: "Estados Unidos",
  iso2: "us",
});
const CAN = (stadium: string, city: string): FixtureVenue => ({
  stadium,
  city,
  country: "Canadá",
  iso2: "ca",
});

// 16 sedes oficiales
const AZTECA = MEX("Estadio Azteca", "Ciudad de México");
const AKRON = MEX("Estadio Akron", "Guadalajara");
const BBVA = MEX("Estadio BBVA", "Monterrey");
const BMO = CAN("BMO Field", "Toronto");
const BCPLACE = CAN("BC Place", "Vancouver");
const SOFI = USA("SoFi Stadium", "Los Ángeles");
const LEVIS = USA("Levi's Stadium", "Bahía de San Francisco");
const METLIFE = USA("MetLife Stadium", "Nueva York / Nueva Jersey");
const GILLETTE = USA("Gillette Stadium", "Boston");
const NRG = USA("NRG Stadium", "Houston");
const ATT = USA("AT&T Stadium", "Dallas");
const LINCOLN = USA("Lincoln Financial Field", "Filadelfia");
const MERCEDES = USA("Mercedes-Benz Stadium", "Atlanta");
const LUMEN = USA("Lumen Field", "Seattle");
const HARDROCK = USA("Hard Rock Stadium", "Miami");
const ARROWHEAD = USA("Arrowhead Stadium", "Kansas City");

export const FIXTURE_VENUES: Record<number, FixtureVenue> = {
  // === Fase de grupos (1-72) ===
  1: AZTECA, // 11 jun MEX v RSA
  2: AKRON, // 11 jun KOR v CZE
  3: BMO, // 12 jun CAN v BIH
  4: SOFI, // 12 jun USA v PAR
  5: LEVIS, // 13 jun QAT v SUI
  6: METLIFE, // 13 jun BRA v MAR
  7: GILLETTE, // 13 jun HAI v SCO
  8: BCPLACE, // 13 jun AUS v TUR
  9: NRG, // 14 jun GER v CUW
  10: ATT, // 14 jun NED v JPN
  11: LINCOLN, // 14 jun CIV v ECU
  12: BBVA, // 14 jun SWE v TUN
  13: MERCEDES, // 15 jun ESP v CPV
  14: LUMEN, // 15 jun BEL v EGY
  15: HARDROCK, // 15 jun KSA v URU
  16: SOFI, // 15 jun IRN v NZL
  17: METLIFE, // 16 jun FRA v SEN
  18: GILLETTE, // 16 jun IRQ v NOR
  19: ARROWHEAD, // 16 jun ARG v ALG
  20: LEVIS, // 16 jun AUT v JOR
  21: NRG, // 17 jun POR v COD
  22: ATT, // 17 jun ENG v CRO
  23: BMO, // 17 jun GHA v PAN
  24: AZTECA, // 17 jun UZB v COL
  25: MERCEDES, // 18 jun CZE v RSA
  26: SOFI, // 18 jun SUI v BIH
  27: BCPLACE, // 18 jun CAN v QAT
  28: AKRON, // 18 jun MEX v KOR
  29: LUMEN, // 19 jun USA v AUS
  30: GILLETTE, // 19 jun SCO v MAR
  31: LINCOLN, // 19 jun BRA v HAI
  32: LEVIS, // 19 jun TUR v PAR
  33: NRG, // 20 jun NED v SWE
  34: BMO, // 20 jun GER v CIV
  35: ARROWHEAD, // 20 jun ECU v CUW
  36: BBVA, // 20 jun TUN v JPN
  37: MERCEDES, // 21 jun ESP v KSA
  38: SOFI, // 21 jun BEL v IRN
  39: HARDROCK, // 21 jun URU v CPV
  40: BCPLACE, // 21 jun NZL v EGY
  41: ATT, // 22 jun ARG v AUT
  42: LINCOLN, // 22 jun FRA v IRQ
  43: METLIFE, // 22 jun NOR v SEN
  44: LEVIS, // 22 jun JOR v ALG
  45: NRG, // 23 jun POR v UZB
  46: GILLETTE, // 23 jun ENG v GHA
  47: BMO, // 23 jun PAN v CRO
  48: AKRON, // 23 jun COL v COD
  49: BCPLACE, // 24 jun SUI v CAN
  50: LUMEN, // 24 jun BIH v QAT
  51: HARDROCK, // 24 jun SCO v BRA
  52: MERCEDES, // 24 jun MAR v HAI
  53: AZTECA, // 24 jun CZE v MEX
  54: BBVA, // 24 jun RSA v KOR
  55: LINCOLN, // 25 jun CUW v CIV
  56: METLIFE, // 25 jun ECU v GER
  57: ATT, // 25 jun JPN v SWE
  58: ARROWHEAD, // 25 jun TUN v NED
  59: SOFI, // 25 jun TUR v USA
  60: LEVIS, // 25 jun PAR v AUS
  61: GILLETTE, // 26 jun NOR v FRA
  62: BMO, // 26 jun SEN v IRQ
  63: NRG, // 26 jun CPV v KSA
  64: AKRON, // 26 jun URU v ESP
  65: LUMEN, // 26 jun EGY v IRN
  66: BCPLACE, // 26 jun NZL v BEL
  67: METLIFE, // 27 jun PAN v ENG
  68: LINCOLN, // 27 jun CRO v GHA
  69: HARDROCK, // 27 jun COL v POR
  70: MERCEDES, // 27 jun COD v UZB
  71: ARROWHEAD, // 27 jun ALG v AUT
  72: ATT, // 27 jun JOR v ARG

  // === Dieciseisavos (R32) — 28 jun a 3 jul ===
  73: SOFI, // 28 jun
  74: GILLETTE, // 29 jun
  75: BBVA, // 29 jun
  76: NRG, // 29 jun
  77: METLIFE, // 30 jun
  78: ATT, // 30 jun
  79: AZTECA, // 30 jun
  80: MERCEDES, // 1 jul
  81: LEVIS, // 1 jul
  82: LUMEN, // 1 jul
  83: BMO, // 2 jul
  84: SOFI, // 2 jul
  85: BCPLACE, // 2 jul
  86: HARDROCK, // 3 jul
  87: ARROWHEAD, // 3 jul
  88: ATT, // 3 jul

  // === Octavos (R16) — 4 a 7 jul ===
  89: LINCOLN, // 4 jul
  90: NRG, // 4 jul
  91: METLIFE, // 5 jul
  92: AZTECA, // 5 jul
  93: ATT, // 6 jul
  94: LUMEN, // 6 jul
  95: MERCEDES, // 7 jul
  96: BCPLACE, // 7 jul

  // === Cuartos — 9 a 11 jul ===
  97: GILLETTE, // 9 jul
  98: SOFI, // 10 jul
  99: HARDROCK, // 11 jul
  100: ARROWHEAD, // 11 jul

  // === Semifinales — 14 y 15 jul ===
  101: ATT, // 14 jul
  102: MERCEDES, // 15 jul

  // === Tercer puesto — 18 jul ===
  103: HARDROCK,

  // === Final — 19 jul ===
  104: METLIFE,
};

export function venueForMatch(
  matchNumber: number | undefined,
): FixtureVenue | null {
  if (matchNumber === undefined) return null;
  return FIXTURE_VENUES[matchNumber] ?? null;
}
