// Composición oficial de los 12 grupos del Mundial 2026 (sorteo del 5 dic 2025).

export const WC2026_GROUPS: Record<string, string[]> = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COD", "UZB", "COL"],
  L: ["ENG", "CRO", "GHA", "PAN"],
};

export const GROUP_LETTERS = Object.keys(WC2026_GROUPS) as Array<
  keyof typeof WC2026_GROUPS
>;

// Para una TLA dada, retorna su grupo ("A".."L") o undefined.
const TLA_TO_GROUP: Record<string, string> = {};
for (const [group, tlas] of Object.entries(WC2026_GROUPS)) {
  for (const tla of tlas) TLA_TO_GROUP[tla] = group;
}
export function groupOf(tla: string): string | undefined {
  return TLA_TO_GROUP[tla];
}
