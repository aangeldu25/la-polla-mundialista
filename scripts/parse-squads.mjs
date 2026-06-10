import fs from "node:fs";
import path from "node:path";

const txt = fs.readFileSync("scripts/squadlists.txt", "utf8");

// Mapeo de nombre en inglés (como aparece en el PDF) a español
const NAME_ES = {
  "Bosnia And Herzegovina": "Bosnia y Herzegovina",
  "Congo DR": "República Democrática del Congo",
  Czechia: "Chequia",
  Sweden: "Suecia",
  Algeria: "Argelia",
  Argentina: "Argentina",
  Australia: "Australia",
  Austria: "Austria",
  Belgium: "Bélgica",
  Brazil: "Brasil",
  "Cabo Verde": "Cabo Verde",
  Canada: "Canadá",
  Colombia: "Colombia",
  Croatia: "Croacia",
  Curaçao: "Curazao",
  Curacao: "Curazao",
  Denmark: "Dinamarca",
  Ecuador: "Ecuador",
  Egypt: "Egipto",
  England: "Inglaterra",
  France: "Francia",
  Germany: "Alemania",
  Ghana: "Ghana",
  Haiti: "Haití",
  "IR Iran": "Irán",
  Iran: "Irán",
  Iraq: "Iraq",
  Italy: "Italia",
  "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil",
  Japan: "Japón",
  Jordan: "Jordania",
  "Korea Republic": "Corea del Sur",
  Mexico: "México",
  Morocco: "Marruecos",
  Netherlands: "Países Bajos",
  "New Zealand": "Nueva Zelanda",
  Nigeria: "Nigeria",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguay",
  Portugal: "Portugal",
  Qatar: "Qatar",
  "Saudi Arabia": "Arabia Saudita",
  Scotland: "Escocia",
  Senegal: "Senegal",
  "South Africa": "Sudáfrica",
  Spain: "España",
  Switzerland: "Suiza",
  Tunisia: "Túnez",
  Türkiye: "Turquía",
  Turkey: "Turquía",
  "United States": "Estados Unidos",
  USA: "Estados Unidos",
  Uruguay: "Uruguay",
  Uzbekistan: "Uzbekistán",
};

const TLA_TO_ISO2 = {
  BIH: "ba",
  COD: "cd",
  CZE: "cz",
  SWE: "se",
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BRA: "br",
  CPV: "cv",
  CAN: "ca",
  COL: "co",
  CRO: "hr",
  CUW: "cw",
  DEN: "dk",
  ECU: "ec",
  EGY: "eg",
  ENG: "gb-eng",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  IRN: "ir",
  IRQ: "iq",
  ITA: "it",
  CIV: "ci",
  JPN: "jp",
  JOR: "jo",
  KOR: "kr",
  MEX: "mx",
  MAR: "ma",
  NED: "nl",
  NZL: "nz",
  NGA: "ng",
  NOR: "no",
  PAN: "pa",
  PAR: "py",
  POR: "pt",
  QAT: "qa",
  KSA: "sa",
  SCO: "gb-sct",
  SEN: "sn",
  RSA: "za",
  ESP: "es",
  SUI: "ch",
  TUN: "tn",
  TUR: "tr",
  USA: "us",
  URU: "uy",
  UZB: "uz",
};

const CONFEDERATION = {
  BIH: "UEFA",
  COD: "CAF",
  CZE: "UEFA",
  SWE: "UEFA",
  ALG: "CAF",
  ARG: "CONMEBOL",
  AUS: "AFC",
  AUT: "UEFA",
  BEL: "UEFA",
  BRA: "CONMEBOL",
  CPV: "CAF",
  CAN: "CONCACAF",
  COL: "CONMEBOL",
  CRO: "UEFA",
  CUW: "CONCACAF",
  DEN: "UEFA",
  ECU: "CONMEBOL",
  EGY: "CAF",
  ENG: "UEFA",
  FRA: "UEFA",
  GER: "UEFA",
  GHA: "CAF",
  HAI: "CONCACAF",
  IRN: "AFC",
  IRQ: "AFC",
  ITA: "UEFA",
  CIV: "CAF",
  JPN: "AFC",
  JOR: "AFC",
  KOR: "AFC",
  MEX: "CONCACAF",
  MAR: "CAF",
  NED: "UEFA",
  NZL: "OFC",
  NGA: "CAF",
  NOR: "UEFA",
  PAN: "CONCACAF",
  PAR: "CONMEBOL",
  POR: "UEFA",
  QAT: "AFC",
  KSA: "AFC",
  SCO: "UEFA",
  SEN: "CAF",
  RSA: "CAF",
  ESP: "UEFA",
  SUI: "UEFA",
  TUN: "CAF",
  TUR: "UEFA",
  USA: "CONCACAF",
  URU: "CONMEBOL",
  UZB: "AFC",
};

// Parseamos por "Page X / 48"
const pageBlocks = txt.split(/Page \d+ \/ 48/);

const teams = [];

for (const block of pageBlocks) {
  // Buscar header de equipo: "Nombre (TLA)" en una línea
  const headerMatch = block.match(/([A-ZÁÉÍÓÚÜÑa-záéíóúüñ' ]+?)\s*\(([A-Z]{3})\)/);
  if (!headerMatch) continue;
  const [, rawName, tla] = headerMatch;
  const englishName = rawName.trim();
  const nameEs = NAME_ES[englishName] ?? englishName;

  const players = [];
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    // Línea de jugador empieza con código de posición (PO/DF/MC/DC) + nombre
    const m = line.match(/^(PO|DF|MC|DC)\s+(.+)$/);
    if (!m) continue;
    const [, pos, rest] = m;
    // Separar por tab o múltiples espacios
    const cols = rest.split(/\t/).map((s) => s.trim()).filter(Boolean);
    if (cols.length < 5) continue;
    // cols: [nameDisplay, firstName, lastName, shirtName, dob, club, height]
    players.push({
      pos,
      name: cols[0],
      firstName: cols[1] ?? "",
      lastName: cols[2] ?? "",
      shirtName: cols[3] ?? "",
      dob: cols[4] ?? "",
      club: cols[5] ?? "",
      height: cols[6] ? parseInt(cols[6], 10) : null,
    });
  }

  // Entrenador
  let coach = null;
  for (const line of lines) {
    const m = line.match(/^Entrenador\s+(.+)$/);
    if (m) {
      const cols = m[1].split(/\t/).map((s) => s.trim()).filter(Boolean);
      coach = {
        name: cols[0] ?? "",
        firstName: cols[1] ?? "",
        lastName: cols[2] ?? "",
        nationality: cols[3] ?? "",
      };
      break;
    }
  }

  teams.push({
    tla,
    iso2: TLA_TO_ISO2[tla] ?? "xx",
    name: nameEs,
    nameEn: englishName,
    confederation: CONFEDERATION[tla] ?? "UNKNOWN",
    players,
    coach,
  });
}

// Dedup por TLA (mantener el primero)
const dedup = [];
const seen = new Set();
for (const t of teams) {
  if (!seen.has(t.tla)) {
    seen.add(t.tla);
    dedup.push(t);
  }
}

// 1) Lista compacta para selector
const compactTeams = dedup.map((t) => ({
  tla: t.tla,
  iso2: t.iso2,
  name: t.name,
  confederation: t.confederation,
}));

// 2) Squads completos
fs.writeFileSync(
  "src/lib/constants/wc2026-squads.json",
  JSON.stringify(dedup, null, 2),
  "utf8",
);

// 3) Generar wc2026-teams.ts directo
const tsHeader = `// Selecciones del Mundial 2026 (48 equipos).
// Generado automáticamente desde SquadLists-Spanish.pdf de FIFA.
// No editar a mano — re-ejecutar scripts/parse-squads.mjs si hay cambios.

export interface WCTeam {
  tla: string;
  iso2: string;
  name: string;
  confederation: "UEFA" | "CONMEBOL" | "CONCACAF" | "AFC" | "CAF" | "OFC";
}

export const WC2026_TEAMS: WCTeam[] = `;

const sorted = [...compactTeams].sort((a, b) =>
  a.name.localeCompare(b.name, "es"),
);

const tsContent =
  tsHeader +
  JSON.stringify(sorted, null, 2) +
  ";\n\nexport const TEAMS_BY_TLA: Record<string, WCTeam> = Object.fromEntries(\n  WC2026_TEAMS.map((t) => [t.tla, t]),\n);\n\nexport const TEAMS_SORTED = WC2026_TEAMS;\n";

fs.writeFileSync("src/lib/constants/wc2026-teams.ts", tsContent, "utf8");

console.log(`Parsed ${dedup.length} teams`);
console.log("TLAs:", dedup.map((t) => t.tla).sort().join(", "));
const totalPlayers = dedup.reduce((sum, t) => sum + t.players.length, 0);
console.log(`Total players: ${totalPlayers}`);
const missingIso = dedup.filter((t) => t.iso2 === "xx");
if (missingIso.length) {
  console.log("Missing iso2:", missingIso.map((t) => `${t.tla} (${t.nameEn})`));
}
