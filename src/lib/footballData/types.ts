// Tipos de respuesta de Football-Data.org v4 (subset que usamos).

export interface FDTeam {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface FDScore {
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  fullTime: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
  extraTime?: { home: number | null; away: number | null };
  penalties?: { home: number | null; away: number | null };
}

export type FDStage =
  | "GROUP_STAGE"
  | "PLAYOFFS"
  | "ROUND_OF_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "3RD_PLACE"
  | "FINAL";

export type FDStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

export interface FDMatch {
  id: number;
  utcDate: string;
  status: FDStatus;
  stage: FDStage;
  group?: string | null;
  matchday?: number | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: FDScore;
  venue?: string | null;
  lastUpdated?: string;
}

export interface FDMatchesResponse {
  count: number;
  competition: { id: number; name: string; code: string };
  matches: FDMatch[];
}
