// Generador de archivos .ics (iCalendar RFC 5545).
// Compatible con Google Calendar, Apple Calendar, Outlook, etc.
// Si el usuario se suscribe a la URL, el calendario se mantiene actualizado
// automáticamente cada vez que cambian fechas, sedes o resultados.

import type { Match } from "@/types/domain";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { venueForMatch } from "@/lib/constants/wc2026-fixture-venues";
import { STAGE_LABEL_ES } from "@/lib/constants/stages";
import { BRACKET_BY_MATCH_NUMBER } from "@/lib/constants/wc2026-bracket";

const APP_URL = "https://la-polla-mundialista-2026-seven.vercel.app";

function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// iCal folding: líneas de más de 75 octetos se parten con CRLF + space
function fold(line: string): string {
  const limit = 73;
  if (line.length <= limit) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += limit) {
    chunks.push(line.slice(i, i + limit));
  }
  return chunks.join("\r\n ");
}

function teamDisplay(match: Match, side: "home" | "away"): string {
  const team =
    side === "home"
      ? TEAMS_BY_TLA[match.homeTeam.tla]
      : TEAMS_BY_TLA[match.awayTeam.tla];
  if (team) return team.name;
  const bracket =
    match.matchNumber !== undefined
      ? BRACKET_BY_MATCH_NUMBER[match.matchNumber]
      : undefined;
  return side === "home"
    ? match.homeLabel ?? bracket?.homeLabel ?? match.homeTeam.name
    : match.awayLabel ?? bracket?.awayLabel ?? match.awayTeam.name;
}

export function matchToIcsEvent(match: Match, sequence = 0): string {
  const start = new Date(match.utcDate);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const homeName = teamDisplay(match, "home");
  const awayName = teamDisplay(match, "away");
  const venue = venueForMatch(match.matchNumber);

  const summary = `⚽ ${homeName} vs ${awayName}`;
  const location = venue
    ? `${venue.stadium}, ${venue.city}, ${venue.country}`
    : "";
  const descriptionParts = [
    STAGE_LABEL_ES[match.stage],
    match.group ? `Grupo ${match.group}` : null,
    match.matchNumber ? `Partido #${match.matchNumber}` : null,
    "",
    `Predice en: ${APP_URL}/partidos`,
  ].filter(Boolean) as string[];

  // Score si terminó
  if (
    match.status === "FINISHED" &&
    match.score.homeFullTime !== null &&
    match.score.awayFullTime !== null
  ) {
    descriptionParts.unshift(
      `Resultado: ${match.score.homeFullTime} - ${match.score.awayFullTime}`,
    );
  }

  const description = descriptionParts.join("\n");

  const lines: (string | null)[] = [
    "BEGIN:VEVENT",
    `UID:pmfu-match-${match.id}@la-polla-mundialista-2026-seven.vercel.app`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${esc(summary)}`,
    location ? `LOCATION:${esc(location)}` : null,
    `DESCRIPTION:${esc(description)}`,
    `URL:${APP_URL}/partidos`,
    `SEQUENCE:${sequence}`,
    `STATUS:${match.status === "FINISHED" ? "CONFIRMED" : "TENTATIVE"}`,
    "TRANSP:OPAQUE",
    // Recordatorio 1h antes
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`⚡ ${homeName} vs ${awayName} en 1 hora — ¡predice!`)}`,
    "END:VALARM",
    "END:VEVENT",
  ];

  return lines.filter(Boolean).map((l) => fold(l!)).join("\r\n");
}

export function matchesToIcs(matches: Match[]): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polla Mundialista 2026//Mundial 2026//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Polla Mundialista 2026",
    "X-WR-CALDESC:Calendario de partidos del Mundial 2026 — Polla Mundialista 2026",
    "X-WR-TIMEZONE:America/Bogota",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const events = matches.map((m, i) => matchToIcsEvent(m, i));

  const footer = ["END:VCALENDAR"];

  return [...header, ...events, ...footer].join("\r\n") + "\r\n";
}
