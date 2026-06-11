// ===== Modelo de dominio Polla Mundialista (multi-grupo) =====

// Una "polla" es un grupo privado de usuarios que compiten entre sí.
// Las predicciones y puntos del usuario son GLOBALES (se calculan una vez);
// la polla solo define quién aparece en tu ranking y tu chisme.
export interface Polla {
  id: string;
  name: string;
  // Código corto de invitación, único, usado en el link /unirse/{code}
  inviteCode: string;
  ownerUid: string;
  emoji: string; // avatar simple del grupo, ej. "🏆"
  memberCount: number;
  createdAt: string;
}

export interface PollaMember {
  uid: string;
  pollaId: string;
  role: "owner" | "member";
  joinedAt: string;
}

export type MatchStage =
  | "GROUP"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "FINAL";

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  tla: string; // 3-letter code (ARG, COL, ...)
  crest: string; // URL
  group?: string; // "A".."L"
}

export interface Match {
  id: string;
  footballDataId: number; // ID externo
  matchNumber?: number; // Número FIFA (1-104)
  stage: MatchStage;
  group?: string;
  matchday?: number;
  utcDate: string; // ISO
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  // Cuando el equipo no está definido aún (eliminatorias antes del sorteo),
  // mostramos un label tipo "1° Grupo A" o "Ganador 74".
  homeLabel?: string;
  awayLabel?: string;
  score: {
    homeFullTime: number | null;
    awayFullTime: number | null;
    homeExtraTime?: number | null;
    awayExtraTime?: number | null;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  };
  // Minuto de juego cuando el partido esta LIVE (si la API lo provee)
  liveMinute?: number | string | null;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  favoriteTeamTla: string | null;
  tutorialCompleted?: boolean;
  createdAt: string;
  isAdmin: boolean;
  totalPoints: number;
  exactScoreHits: number;
  winnerHits: number;
  // Puntos de ESTRUCTURA del bracket, separados por ronda. Suma del total
  // ya está incluido en totalPoints.
  structurePointsByRound?: Record<string, number>;
}

export interface MatchPrediction {
  uid: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  // Para eliminatorias: si predicen empate en 90', necesitamos quién pasa
  advancingTeamTla?: string | null;
  pointsAwarded: number | null; // null hasta que termine el partido
  isExact: boolean | null;
  isWinnerCorrect: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialPrediction {
  uid: string;
  // Top 3: pre-lock se deriva en vivo del bracket cascade del usuario.
  // Al momento del cierre (TOURNAMENT_START_UTC) se snapshotea aquí y queda
  // congelado para el scoring final.
  lockedTop3?: {
    championTla: string | null;
    runnerUpTla: string | null;
    thirdTla: string | null;
    lockedAt: string;
  } | null;
  topScorerName: string | null;
  goldenBallName: string | null;
  goldenGloveName: string | null;
  pointsAwarded: number;
  updatedAt: string;
}

export interface TournamentResults {
  championTla: string | null;
  runnerUpTla: string | null;
  thirdPlaceTla: string | null;
  topScorerName: string | null;
  goldenBallName: string | null;
  goldenGloveName: string | null;
  isFinalized: boolean;
}

// ===== Puntuación =====
export const SCORING = {
  EXACT_SCORE: 3,
  CORRECT_WINNER: 1,
  STAGE_MULTIPLIER: {
    GROUP: 1,
    ROUND_OF_32: 2,
    ROUND_OF_16: 2,
    QUARTER_FINAL: 3,
    SEMI_FINAL: 4,
    THIRD_PLACE: 4,
    FINAL: 5,
  } satisfies Record<MatchStage, number>,
  SPECIALS: {
    CHAMPION: 15,
    RUNNER_UP: 10,
    THIRD_PLACE: 8,
    TOP_SCORER: 10,
    GOLDEN_BALL: 8,
    GOLDEN_GLOVE: 6,
  },
} as const;
