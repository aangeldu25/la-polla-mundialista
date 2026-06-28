"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  Match,
  MatchPrediction,
  UserProfile,
} from "@/types/domain";
import {
  useAllPredictionsForUsers,
  useProfilesForUids,
} from "@/hooks/usePredictions";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { Flag } from "@/components/ui/Flag";
import {
  computeAllGroupStandings,
} from "@/lib/standings/group-standings";
import { computeDerivedBracket } from "@/lib/standings/knockout-cascade";
import { computeRealR32Projection } from "@/lib/stats/r32-projection";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";
import { cn } from "@/lib/utils";

export function ChismeList({
  predictions,
  match,
  currentUid,
}: {
  predictions: MatchPrediction[];
  match: Match;
  currentUid: string | null;
}) {
  const { memberUids } = useActivePolla();
  const profiles = useProfilesForUids(memberUids);
  const memberSet = new Set(memberUids);
  const others = predictions.filter(
    (p) => p.uid !== currentUid && memberSet.has(p.uid),
  );

  // Para partidos de eliminatorias mostramos también los EQUIPOS que cada
  // usuario predijo (porque cada bracket es distinto).
  const isKnockout = match.stage !== "GROUP";
  const officialHomeTla =
    match.homeTeam.tla && match.homeTeam.tla.length > 0
      ? match.homeTeam.tla
      : null;
  const officialAwayTla =
    match.awayTeam.tla && match.awayTeam.tla.length > 0
      ? match.awayTeam.tla
      : null;
  // En eliminatorias derivamos siempre el pick de cada usuario:
  //  • pre-sorteo para mostrar QUÉ equipos predijeron (slot vacío oficial)
  //  • post-sorteo para mostrar lo que predijeron como referencia tachada
  //    cuando NO coincide con el oficial.
  const needsDerivation = isKnockout;

  // Cargar partidos y predicciones de todos los usuarios del chisme,
  // solo si necesitamos derivación
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  useEffect(() => {
    if (!needsDerivation) return;
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setAllMatches(snap.docs.map((d) => d.data() as Match));
    });
    return () => unsub();
  }, [needsDerivation]);

  const otherUids = useMemo(
    () => (needsDerivation ? others.map((p) => p.uid) : []),
    [needsDerivation, others],
  );
  const allUserPreds = useAllPredictionsForUsers(otherUids);

  // Pre-calculamos el bracket derivado de cada usuario para evitar repetir
  // el cómputo por cada render.
  const derivedTeamsByUid = useMemo(() => {
    const result = new Map<string, { homeTla: string | null; awayTla: string | null }>();
    if (!needsDerivation || allMatches.length === 0 || match.matchNumber === undefined) {
      return result;
    }
    for (const [uid, userPreds] of allUserPreds.entries()) {
      const standings = computeAllGroupStandings(allMatches, userPreds);
      const derived = computeDerivedBracket(allMatches, userPreds, standings);
      const slot = derived.get(match.matchNumber);
      if (slot) {
        result.set(uid, {
          homeTla: slot.homeTla,
          awayTla: slot.awayTla,
        });
      }
    }
    return result;
  }, [needsDerivation, allMatches, allUserPreds, match.matchNumber]);

  // Equipo REAL (confirmado) que quedó en cada posición del cruce, contra el
  // que evaluamos el acierto de cada usuario: el oficial si el partido ya tiene
  // equipos, o la proyección real cuando los grupos ya cerraron (confirmada).
  const realProjection = useMemo(
    () => (needsDerivation ? computeRealR32Projection(allMatches) : null),
    [needsDerivation, allMatches],
  );
  const realSlot =
    match.matchNumber !== undefined
      ? realProjection?.get(match.matchNumber)
      : undefined;
  const actualHomeTla =
    officialHomeTla ?? (realSlot?.homeConfirmed ? realSlot.homeTla : null);
  const actualAwayTla =
    officialAwayTla ?? (realSlot?.awayConfirmed ? realSlot.awayTla : null);

  return (
    <section className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">
          Predicciones de la familia
        </h3>
        <span className="text-xs text-gray-600 font-semibold">
          {others.length} {others.length === 1 ? "predicción" : "predicciones"}
        </span>
      </div>

      {others.length === 0 ? (
        <p className="text-sm text-gray-600 italic text-center py-3">
          Aún nadie más ha predicho este partido.
        </p>
      ) : (
        <ul className="space-y-2">
          {others
            .sort((a, b) =>
              (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""),
            )
            .map((p) => (
              <PredictionRow
                key={p.uid}
                p={p}
                profile={profiles.get(p.uid)}
                match={match}
                derivedTeams={derivedTeamsByUid.get(p.uid)}
                showDerivedTeams={needsDerivation}
                actualHomeTla={actualHomeTla}
                actualAwayTla={actualAwayTla}
              />
            ))}
        </ul>
      )}
    </section>
  );
}

function PredictionRow({
  p,
  profile,
  match,
  derivedTeams,
  showDerivedTeams,
  actualHomeTla,
  actualAwayTla,
}: {
  p: MatchPrediction;
  profile?: UserProfile;
  match: Match;
  derivedTeams?: { homeTla: string | null; awayTla: string | null };
  showDerivedTeams: boolean;
  // Equipo real (confirmado) que quedó en cada posición; null si aún no se define.
  actualHomeTla: string | null;
  actualAwayTla: string | null;
}) {
  const name = profile?.displayName ?? "Anónimo";
  const isExact =
    match.status === "FINISHED" &&
    match.score.homeFullTime === p.homeScore &&
    match.score.awayFullTime === p.awayScore;

  // Lo que el usuario predijo para cada posición (de su bracket cascade)
  const predictedHome = derivedTeams?.homeTla
    ? TEAMS_BY_TLA[derivedTeams.homeTla]
    : null;
  const predictedAway = derivedTeams?.awayTla
    ? TEAMS_BY_TLA[derivedTeams.awayTla]
    : null;

  // Mostramos el pick del usuario. Cuando el equipo real de esa posición ya
  // está definido, evaluamos el acierto: full color si coincide, bandera
  // semitransparente si no.
  const homeEvaluated = !!actualHomeTla;
  const awayEvaluated = !!actualAwayTla;
  const homeCorrect =
    homeEvaluated && !!predictedHome && predictedHome.tla === actualHomeTla;
  const awayCorrect =
    awayEvaluated && !!predictedAway && predictedAway.tla === actualAwayTla;

  return (
    <li
      className={cn(
        "flex flex-col gap-1 p-2 rounded-xl",
        isExact && "bg-[var(--pmfu-lime)]/20 ring-1 ring-[var(--pmfu-lime)]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
          {profile?.photoURL ? (
            <Image
              src={profile.photoURL}
              alt={name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-700">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
          {name}
        </span>
        <span className="text-base font-bold tabular-nums text-gray-900">
          {p.homeScore} <span className="text-gray-400">–</span> {p.awayScore}
        </span>
        {p.pointsAwarded !== null && p.pointsAwarded !== undefined && (
          <span className="text-xs font-bold text-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10 px-2 py-0.5 rounded-full">
            +{p.pointsAwarded} pts
          </span>
        )}
        {isExact && <span title="Marcador exacto">🎯</span>}
      </div>

      {/* Para eliminatorias: los equipos que ESTE usuario predijo en el cruce.
          Bandera full color si acertó la posición; semitransparente si no. */}
      {showDerivedTeams && (predictedHome || predictedAway) && (
        <div className="pl-11">
          <div className="flex items-center gap-2 text-xs text-gray-700 flex-wrap">
            <TeamChip
              team={predictedHome}
              evaluated={homeEvaluated}
              correct={homeCorrect}
            />
            <span className="text-gray-400">vs</span>
            <TeamChip
              team={predictedAway}
              evaluated={awayEvaluated}
              correct={awayCorrect}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function TeamChip({
  team,
  evaluated,
  correct,
}: {
  team: { iso2: string; name: string; tla: string } | null;
  // evaluated = el equipo real de la posición ya se definió.
  evaluated: boolean;
  // correct = el pick del usuario coincide con ese equipo real.
  correct: boolean;
}) {
  if (!team) {
    return <span className="italic text-gray-500">— por definir</span>;
  }
  // Semitransparente cuando ya se sabe el equipo real y el usuario NO acertó.
  const dim = evaluated && !correct;
  return (
    <span
      className={cn(
        "flex items-center gap-1 transition-opacity",
        dim && "opacity-40",
      )}
    >
      <Flag iso2={team.iso2} size={14} alt={team.name} />
      <span className={cn("font-medium", dim && "text-gray-500")}>
        {team.name}
      </span>
      {evaluated && correct && (
        <span
          className="text-[9px] font-bold text-[var(--pmfu-mint)] bg-[var(--pmfu-mint)]/15 px-1 py-0.5 rounded-full"
          title="Acertó el equipo en esta posición"
        >
          ✓
        </span>
      )}
    </span>
  );
}

// Calcula tiempo restante hasta el kickoff
export function kickoffCountdown(utcDate: string): string {
  const ms = new Date(utcDate).getTime() - Date.now();
  if (ms <= 0) return "Bloqueado";
  return `Cierra ${formatDistanceToNow(new Date(utcDate), {
    locale: es,
    addSuffix: true,
  })}`;
}
