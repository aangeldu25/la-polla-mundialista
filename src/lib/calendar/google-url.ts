// Genera URL "Add to Google Calendar" sin requerir OAuth ni API.
// El usuario verá un editor pre-llenado donde solo da click en "Guardar".

import type { Match } from "@/types/domain";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { venueForMatch } from "@/lib/constants/wc2026-fixture-venues";
import { STAGE_LABEL_ES } from "@/lib/constants/stages";
import { BRACKET_BY_MATCH_NUMBER } from "@/lib/constants/wc2026-bracket";

const APP_URL = "https://polla-mundialista-familia-unida.vercel.app";

function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function teamDisplay(match: Match, side: "home" | "away"): string {
  const team = side === "home"
    ? TEAMS_BY_TLA[match.homeTeam.tla]
    : TEAMS_BY_TLA[match.awayTeam.tla];
  if (team) return team.name;
  const bracket =
    match.matchNumber !== undefined
      ? BRACKET_BY_MATCH_NUMBER[match.matchNumber]
      : undefined;
  return side === "home"
    ? (match.homeLabel ?? bracket?.homeLabel ?? match.homeTeam.name)
    : (match.awayLabel ?? bracket?.awayLabel ?? match.awayTeam.name);
}

export function googleCalendarUrl(match: Match): string {
  const start = new Date(match.utcDate);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2h de evento
  const homeName = teamDisplay(match, "home");
  const awayName = teamDisplay(match, "away");
  const venue = venueForMatch(match.matchNumber);

  const title = `⚽ ${homeName} vs ${awayName} · Mundial 2026`;
  const location = venue
    ? `${venue.stadium}, ${venue.city}, ${venue.country}`
    : "";
  const detailsLines = [
    STAGE_LABEL_ES[match.stage],
    match.group ? `Grupo ${match.group}` : null,
    match.matchNumber ? `Partido #${match.matchNumber}` : null,
    "",
    `Predice este partido en:`,
    `${APP_URL}/partidos`,
  ].filter(Boolean) as string[];

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmtUtc(start)}/${fmtUtc(end)}`,
    details: detailsLines.join("\n"),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
