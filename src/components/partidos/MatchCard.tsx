"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Flag } from "@/components/ui/Flag";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { BRACKET_BY_MATCH_NUMBER } from "@/lib/constants/wc2026-bracket";
import { venueForMatch } from "@/lib/constants/wc2026-fixture-venues";
import type { Match, MatchPrediction } from "@/types/domain";
import { cn } from "@/lib/utils";

export function MatchCard({
  match,
  prediction,
  onClick,
}: {
  match: Match;
  prediction?: MatchPrediction;
  onClick?: () => void;
}) {
  const date = new Date(match.utcDate);
  const dateLine = format(date, "EEE d MMM", { locale: es });
  const timeLine = format(date, "h:mm a", { locale: es });
  const home = TEAMS_BY_TLA[match.homeTeam.tla];
  const away = TEAMS_BY_TLA[match.awayTeam.tla];
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const locked = Date.now() >= date.getTime();
  const hasScore =
    match.score.homeFullTime !== null && match.score.awayFullTime !== null;
  const groupLabel = normalizeGroup(match.group);
  const bracket =
    match.matchNumber !== undefined
      ? BRACKET_BY_MATCH_NUMBER[match.matchNumber]
      : undefined;
  const venueFromMatchNumber = venueForMatch(match.matchNumber);
  const city = venueFromMatchNumber?.city;
  const stadium = venueFromMatchNumber?.stadium;
  const country = venueFromMatchNumber?.country;
  const venueLine = [city, stadium].filter(Boolean).join(" · ");

  // Color de fondo según resultado de la predicción cuando el partido terminó.
  // - Verde: marcador exacto (mejor caso)
  // - Amarillo: ganador correcto pero marcador equivocado
  // - Rojo: ni el ganador ni el marcador
  let resultClass = "";
  if (
    finished &&
    prediction &&
    prediction.pointsAwarded !== null &&
    prediction.pointsAwarded !== undefined
  ) {
    if (prediction.isExact) {
      resultClass =
        "!bg-green-100/80 ring-1 ring-green-300/60 hover:!bg-green-100";
    } else if (prediction.isWinnerCorrect) {
      resultClass =
        "!bg-yellow-100/80 ring-1 ring-yellow-300/60 hover:!bg-yellow-100";
    } else {
      resultClass = "!bg-red-100/80 ring-1 ring-red-300/60 hover:!bg-red-100";
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pmfu-glass rounded-2xl p-4 md:p-5 flex flex-col gap-3 shadow-sm text-left w-full",
        "hover:shadow-lg hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer",
        live && "ring-2 ring-[var(--pmfu-magenta)] animate-pulse-slow",
        resultClass,
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-gray-700">
          {groupLabel && `Grupo ${groupLabel}`}
          {match.matchNumber && (
            <span className="text-gray-500 ml-2">#{match.matchNumber}</span>
          )}
        </span>
        <span
          className={cn(
            "font-semibold text-right",
            live
              ? "text-[var(--pmfu-magenta)]"
              : finished
                ? "text-gray-700"
                : "text-[var(--pmfu-cobalt)]",
          )}
        >
          {live ? (
            "🔴 EN VIVO"
          ) : finished ? (
            "Terminado"
          ) : (
            <span>
              {dateLine} · <strong>{timeLine}</strong>
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide
          tla={match.homeTeam.tla}
          name={home?.name ?? match.homeTeam.name}
          label={match.homeLabel ?? bracket?.homeLabel}
          iso2={home?.iso2}
          side="home"
        />
        <div className="flex flex-col items-center min-w-[60px]">
          {hasScore ? (
            <div className="text-2xl md:text-3xl font-bold tabular-nums text-gray-900">
              {match.score.homeFullTime}{" "}
              <span className="text-gray-400">–</span>{" "}
              {match.score.awayFullTime}
            </div>
          ) : (
            <div className="text-sm text-gray-500 font-semibold">vs</div>
          )}
          {match.score.homePenalties !== null &&
            match.score.homePenalties !== undefined &&
            match.score.awayPenalties !== null &&
            match.score.awayPenalties !== undefined && (
              <div className="text-xs text-gray-600 font-medium">
                ({match.score.homePenalties} - {match.score.awayPenalties} pen)
              </div>
            )}
        </div>
        <TeamSide
          tla={match.awayTeam.tla}
          name={away?.name ?? match.awayTeam.name}
          label={match.awayLabel ?? bracket?.awayLabel}
          iso2={away?.iso2}
          side="away"
        />
      </div>

      <PredictionBadge prediction={prediction} locked={locked} />

      {venueLine && (
        <div className="text-xs text-gray-700 text-center font-medium border-t border-gray-200/60 pt-2">
          📍 {venueLine}
          {country && <span className="text-gray-500"> · {country}</span>}
        </div>
      )}
    </button>
  );
}

function PredictionBadge({
  prediction,
  locked,
}: {
  prediction?: MatchPrediction;
  locked: boolean;
}) {
  if (prediction) {
    const points =
      prediction.pointsAwarded !== null && prediction.pointsAwarded !== undefined
        ? prediction.pointsAwarded
        : null;
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold",
          locked
            ? "bg-gray-100 text-gray-800"
            : "bg-[var(--pmfu-cobalt)]/10 text-[var(--pmfu-cobalt)]",
        )}
      >
        <span>{locked ? "🔒" : "✓"}</span>
        <span>
          Tu predicción:{" "}
          <span className="tabular-nums font-bold">
            {prediction.homeScore} – {prediction.awayScore}
          </span>
        </span>
        {points !== null && (
          <span className="text-[var(--pmfu-cobalt)] font-bold">
            +{points} pts
          </span>
        )}
      </div>
    );
  }
  if (locked) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold bg-gray-100 text-gray-700">
        🔒 No predijiste
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold bg-[var(--pmfu-orange)]/15 text-[var(--pmfu-orange)] border border-[var(--pmfu-orange)]/30">
      ⚡ Predicción pendiente — toca para predecir
    </div>
  );
}

function normalizeGroup(g: string | undefined): string | undefined {
  if (!g) return undefined;
  const m1 = g.match(/^GROUP_([A-L])$/i);
  if (m1) return m1[1].toUpperCase();
  const m2 = g.match(/Group\s+([A-L])/i);
  if (m2) return m2[1].toUpperCase();
  if (/^[A-L]$/i.test(g)) return g.toUpperCase();
  return g;
}

function TeamSide({
  tla,
  name,
  label,
  iso2,
  side,
}: {
  tla: string;
  name: string;
  label?: string;
  iso2?: string;
  side: "home" | "away";
}) {
  const isTBD = !tla || !iso2;
  const displayLabel =
    label ??
    (name && !name.toLowerCase().includes("por definir") ? name : undefined);
  return (
    <div
      className={cn(
        "flex items-center gap-2 min-w-0",
        side === "away" && "flex-row-reverse",
      )}
    >
      {!isTBD ? (
        <Flag iso2={iso2} size={32} alt={name} />
      ) : (
        <div className="w-8 h-6 bg-gray-200 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">
          ?
        </div>
      )}
      <div className={cn("min-w-0", side === "away" && "text-right")}>
        {isTBD ? (
          <p className="font-semibold text-sm text-gray-800 italic leading-tight">
            {displayLabel ?? "Por definir"}
          </p>
        ) : (
          <>
            <p className="font-bold text-sm md:text-base text-gray-900 truncate">
              {name}
            </p>
            <p className="text-xs text-gray-600 font-semibold">{tla}</p>
          </>
        )}
      </div>
    </div>
  );
}
