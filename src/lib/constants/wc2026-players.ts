// Convocatorias oficiales del Mundial 2026 — derivadas del PDF de FIFA.
// 1248 jugadores (26 por selección).

import squadsRaw from "./wc2026-squads.json";

interface RawPlayer {
  pos: string;
  name: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  dob: string;
  club: string;
  height: number | null;
}

interface RawSquad {
  tla: string;
  iso2: string;
  name: string;
  nameEn: string;
  confederation: string;
  players: RawPlayer[];
  coach: unknown;
}

export type PlayerPos = "PO" | "DF" | "MC" | "DC";

export interface WCPlayer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  pos: PlayerPos;
  posLabel: string;
  club: string;
  teamTla: string;
  teamIso2: string;
  teamName: string;
}

const POS_LABEL: Record<PlayerPos, string> = {
  PO: "Portero",
  DF: "Defensa",
  MC: "Mediocentro",
  DC: "Delantero",
};

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");
}

const SQUADS = squadsRaw as RawSquad[];

export const ALL_PLAYERS: WCPlayer[] = SQUADS.flatMap((t) =>
  t.players
    .filter((p): p is RawPlayer & { pos: PlayerPos } =>
      ["PO", "DF", "MC", "DC"].includes(p.pos),
    )
    .map((p, idx) => ({
      id: `${t.tla}-${slug(p.firstName + "-" + p.lastName)}-${idx}`,
      name: `${p.firstName} ${p.lastName}`.trim() || p.name,
      firstName: p.firstName,
      lastName: p.lastName,
      pos: p.pos,
      posLabel: POS_LABEL[p.pos],
      club: p.club,
      teamTla: t.tla,
      teamIso2: t.iso2,
      teamName: t.name,
    })),
);

export const PLAYERS_BY_ID: Record<string, WCPlayer> = Object.fromEntries(
  ALL_PLAYERS.map((p) => [p.id, p]),
);

export const GOALKEEPERS: WCPlayer[] = ALL_PLAYERS.filter((p) => p.pos === "PO");

export function findPlayer(id: string | null | undefined): WCPlayer | undefined {
  if (!id) return undefined;
  return PLAYERS_BY_ID[id];
}

// Búsqueda por texto (nombre, apellido, club, selección)
export function searchPlayers(
  query: string,
  pool: WCPlayer[] = ALL_PLAYERS,
): WCPlayer[] {
  const q = slug(query);
  if (!q) return pool.slice(0, 100);
  return pool
    .filter((p) => {
      return (
        slug(p.firstName).includes(q) ||
        slug(p.lastName).includes(q) ||
        slug(p.club).includes(q) ||
        slug(p.teamName).includes(q) ||
        p.teamTla.toLowerCase().includes(q.toLowerCase())
      );
    })
    .slice(0, 200);
}
