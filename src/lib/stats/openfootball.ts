// Parser de openfootball/worldcup.json (2026) para estadísticas a nivel de
// gol que las APIs gratuitas no proveen: goleadores individuales, penales,
// autogoles y minutos.
//
// Fuente: https://github.com/openfootball/worldcup.json (CDN de GitHub, gratis,
// auto-actualizado varias veces al día durante el torneo).
//
// IMPORTANTE: openfootball solo se usa para el detalle por gol. Los marcadores,
// estados en vivo y tablas siguen saliendo de nuestra propia sincronización
// (Football-Data + overlay FIFA), que es más fresca al minuto.

// Mapa nombre (openfootball) → TLA (= fifa_code, coincide 1:1 con nuestros TLA)
export const OPENFOOTBALL_NAME_TO_TLA: Record<string, string> = {
  Mexico: "MEX",
  "South Africa": "RSA",
  "South Korea": "KOR",
  "Czech Republic": "CZE",
  Canada: "CAN",
  "Bosnia & Herzegovina": "BIH",
  Qatar: "QAT",
  Switzerland: "SUI",
  Brazil: "BRA",
  Morocco: "MAR",
  Haiti: "HAI",
  Scotland: "SCO",
  USA: "USA",
  Paraguay: "PAR",
  Australia: "AUS",
  Turkey: "TUR",
  Germany: "GER",
  "Curaçao": "CUW",
  "Ivory Coast": "CIV",
  Ecuador: "ECU",
  Netherlands: "NED",
  Japan: "JPN",
  Sweden: "SWE",
  Tunisia: "TUN",
  Belgium: "BEL",
  Egypt: "EGY",
  Iran: "IRN",
  "New Zealand": "NZL",
  Spain: "ESP",
  "Cape Verde": "CPV",
  "Saudi Arabia": "KSA",
  Uruguay: "URU",
  France: "FRA",
  Senegal: "SEN",
  Iraq: "IRQ",
  Norway: "NOR",
  Argentina: "ARG",
  Algeria: "ALG",
  Austria: "AUT",
  Jordan: "JOR",
  Portugal: "POR",
  "DR Congo": "COD",
  Uzbekistan: "UZB",
  Colombia: "COL",
  England: "ENG",
  Croatia: "CRO",
  Ghana: "GHA",
  Panama: "PAN",
};

const SOURCE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

interface OFGoal {
  name: string;
  minute?: number | string;
  penalty?: boolean;
  owngoal?: boolean;
}
interface OFMatch {
  team1: string;
  team2: string;
  score?: { ft?: [number, number]; ht?: [number, number] };
  goals1?: OFGoal[];
  goals2?: OFGoal[];
}
interface OFData {
  matches?: OFMatch[];
}

export interface Scorer {
  name: string;
  teamTla: string;
  goals: number; // sin contar autogoles
  penalties: number;
}

export interface HatTrick {
  name: string;
  teamTla: string;
  goals: number; // 3+
  rivalTla: string;
}

export interface GoalGems {
  totalGoals: number;
  penaltyGoals: number;
  ownGoals: number;
  openPlayGoals: number; // jugada (total - penal - autogol)
  stoppageGoals: number; // goles en tiempo de descuento (minuto con "+")
  earliest: { name: string; minute: number; teamTla: string } | null;
  latest: { name: string; minute: number; teamTla: string } | null;
  firstHalfGoals: number;
  secondHalfGoals: number;
  // Distribución por franjas: [0-15,16-30,31-45,46-60,61-75,76-90,90+]
  minuteBuckets: number[];
  hatTricks: HatTrick[];
  avgMinute: number; // minuto promedio de gol
}

export interface OpenfootballStats {
  scorers: Scorer[];
  gems: GoalGems;
  matchesWithGoals: number;
  playedMatches: number; // partidos con marcador (para comparar frescura)
  source: string; // "openfootball" | "upbound" — fuente usada
  updatedAt: string;
}

// Convierte "90+4" → 94, "67" → 67. Devuelve null si no parsea.
function parseMinute(min: number | string | undefined): number | null {
  if (min === undefined || min === null) return null;
  if (typeof min === "number") return min;
  const m = String(min).match(/^(\d+)(?:\+(\d+))?/);
  if (!m) return null;
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0);
}

// Backup: fork auto-alimentado desde ESPN (commits por resultado). Misma
// estructura que openfootball pero sin flags de penal/autogol. Útil cuando
// openfootball va rezagado en los últimos resultados.
const BACKUP_URL =
  "https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json";

// Descarga y parsea una de las fuentes (openfootball o el backup upbound).
// Estrategia: openfootball es primaria (trae penal/autogol). El backup solo
// se usa si openfootball falla o si va MÁS adelantado (más partidos jugados),
// en cuyo caso priorizamos frescura sobre los flags de penal/autogol.
export async function fetchOpenfootballStats(): Promise<OpenfootballStats> {
  const [primary, backup] = await Promise.allSettled([
    fetchAndParse(SOURCE_URL, "openfootball"),
    fetchAndParse(BACKUP_URL, "upbound"),
  ]);

  const ofStats = primary.status === "fulfilled" ? primary.value : null;
  const ubStats = backup.status === "fulfilled" ? backup.value : null;

  if (!ofStats && !ubStats) {
    throw new Error("openfootball y backup no disponibles");
  }
  if (!ofStats) return ubStats!;
  if (!ubStats) return ofStats;

  // Ambas disponibles: usar la más fresca (más partidos jugados). En empate,
  // openfootball gana por su mayor riqueza (penal/autogol).
  return ubStats.playedMatches > ofStats.playedMatches ? ubStats : ofStats;
}

async function fetchAndParse(
  url: string,
  source: string,
): Promise<OpenfootballStats> {
  const res = await fetch(url, {
    next: { revalidate: 900 }, // 15 min
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
  const data = (await res.json()) as OFData;
  return parseWorldcup(data, source);
}

// Parser común para cualquier worldcup.json (openfootball o fork upbound).
function parseWorldcup(data: OFData, source: string): OpenfootballStats {
  let playedMatches = 0;
  const scorerMap = new Map<string, Scorer>();
  let totalGoals = 0;
  let penaltyGoals = 0;
  let ownGoals = 0;
  let firstHalfGoals = 0;
  let secondHalfGoals = 0;
  let stoppageGoals = 0;
  let minuteSum = 0;
  let minuteCount = 0;
  let earliest: GoalGems["earliest"] = null;
  let latest: GoalGems["latest"] = null;
  let matchesWithGoals = 0;
  const minuteBuckets = [0, 0, 0, 0, 0, 0, 0]; // 7 franjas
  const hatTricks: HatTrick[] = [];

  const bucketOf = (min: number): number => {
    if (min > 90) return 6; // tiempo de descuento / prórroga
    if (min <= 15) return 0;
    if (min <= 30) return 1;
    if (min <= 45) return 2;
    if (min <= 60) return 3;
    if (min <= 75) return 4;
    return 5; // 76-90
  };

  for (const m of data.matches ?? []) {
    const t1 = OPENFOOTBALL_NAME_TO_TLA[m.team1] ?? "";
    const t2 = OPENFOOTBALL_NAME_TO_TLA[m.team2] ?? "";
    const g1 = m.goals1 ?? [];
    const g2 = m.goals2 ?? [];
    if (Array.isArray(m.score?.ft)) playedMatches++;
    if (g1.length || g2.length) matchesWithGoals++;

    // Conteo por jugador DENTRO de este partido (para detectar hat-tricks)
    const perMatch = new Map<string, number>();

    const handle = (g: OFGoal, scorerTla: string, rivalTla: string) => {
      totalGoals++;
      if (g.penalty) penaltyGoals++;
      if (g.owngoal) {
        ownGoals++; // los autogoles NO cuentan para el goleador
      } else {
        const key = `${g.name}__${scorerTla}`;
        const cur =
          scorerMap.get(key) ??
          { name: g.name, teamTla: scorerTla, goals: 0, penalties: 0 };
        cur.goals++;
        if (g.penalty) cur.penalties++;
        scorerMap.set(key, cur);
        perMatch.set(
          `${g.name}__${scorerTla}__${rivalTla}`,
          (perMatch.get(`${g.name}__${scorerTla}__${rivalTla}`) ?? 0) + 1,
        );
      }
      const min = parseMinute(g.minute);
      if (min !== null) {
        minuteSum += min;
        minuteCount++;
        minuteBuckets[bucketOf(min)]++;
        if (min <= 45) firstHalfGoals++;
        else secondHalfGoals++;
        if (String(g.minute).includes("+")) stoppageGoals++;
        if (!earliest || min < earliest.minute)
          earliest = { name: g.name, minute: min, teamTla: scorerTla };
        if (!latest || min > latest.minute)
          latest = { name: g.name, minute: min, teamTla: scorerTla };
      }
    };

    for (const g of g1) handle(g, t1, t2);
    for (const g of g2) handle(g, t2, t1);

    // Detectar hat-tricks (3+ goles de un jugador en este partido)
    for (const [key, count] of perMatch) {
      if (count >= 3) {
        const [name, teamTla, rivalTla] = key.split("__");
        hatTricks.push({ name, teamTla, goals: count, rivalTla });
      }
    }
  }

  const scorers = [...scorerMap.values()].sort(
    (a, b) => b.goals - a.goals || a.penalties - b.penalties,
  );
  hatTricks.sort((a, b) => b.goals - a.goals);

  return {
    scorers,
    gems: {
      totalGoals,
      penaltyGoals,
      ownGoals,
      openPlayGoals: totalGoals - penaltyGoals - ownGoals,
      stoppageGoals,
      earliest,
      latest,
      firstHalfGoals,
      secondHalfGoals,
      minuteBuckets,
      hatTricks,
      avgMinute: minuteCount > 0 ? Math.round(minuteSum / minuteCount) : 0,
    },
    matchesWithGoals,
    playedMatches,
    source,
    updatedAt: new Date().toISOString(),
  };
}
