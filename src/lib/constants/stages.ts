import type { MatchStage } from "@/types/domain";

export const STAGE_LABEL_ES: Record<MatchStage, string> = {
  GROUP: "Fase de grupos",
  ROUND_OF_32: "Dieciseisavos",
  ROUND_OF_16: "Octavos de final",
  QUARTER_FINAL: "Cuartos de final",
  SEMI_FINAL: "Semifinales",
  THIRD_PLACE: "Tercer lugar",
  FINAL: "Final",
};

export const STAGE_ORDER: Record<MatchStage, number> = {
  GROUP: 0,
  ROUND_OF_32: 1,
  ROUND_OF_16: 2,
  QUARTER_FINAL: 3,
  SEMI_FINAL: 4,
  THIRD_PLACE: 5,
  FINAL: 6,
};
