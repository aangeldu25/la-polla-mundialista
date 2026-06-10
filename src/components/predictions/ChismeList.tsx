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
                officialHomeTla={officialHomeTla}
                officialAwayTla={officialAwayTla}
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
  officialHomeTla,
  officialAwayTla,
}: {
  p: MatchPrediction;
  profile?: UserProfile;
  match: Match;
  derivedTeams?: { homeTla: string | null; awayTla: string | null };
  showDerivedTeams: boolean;
  officialHomeTla: string | null;
  officialAwayTla: string | null;
}) {
  const name = profile?.displayName ?? "Anónimo";
  const isExact =
    match.status === "FINISHED" &&
    match.score.homeFullTime === p.homeScore &&
    match.score.awayFullTime === p.awayScore;

  // Lo que el usuario predijo (de su bracket cascade)
  const predictedHome = derivedTeams?.homeTla
    ? TEAMS_BY_TLA[derivedTeams.homeTla]
    : null;
  const predictedAway = derivedTeams?.awayTla
    ? TEAMS_BY_TLA[derivedTeams.awayTla]
    : null;
  // El equipo oficial (cuando ya hubo sorteo / cascade FIFA real)
  const officialHome = officialHomeTla ? TEAMS_BY_TLA[officialHomeTla] : null;
  const officialAway = officialAwayTla ? TEAMS_BY_TLA[officialAwayTla] : null;

  // Cuál mostrar como principal y qué pick es "fallido" referencia.
  // Si hay oficial → mostrar oficial; si la predicción difiere → tacharla pequeña.
  // Si hay oficial y coinciden → solo un ✓ pequeño.
  // Si no hay oficial → mostrar predicción normal.
  const homeMain = officialHome ?? predictedHome;
  const awayMain = officialAway ?? predictedAway;
  const homeHit =
    !!officialHome && !!predictedHome && officialHome.tla === predictedHome.tla;
  const awayHit =
    !!officialAway && !!predictedAway && officialAway.tla === predictedAway.tla;
  const homeMissPick =
    !!officialHome && !!predictedHome && officialHome.tla !== predictedHome.tla
      ? predictedHome
      : null;
  const awayMissPick =
    !!officialAway && !!predictedAway && officialAway.tla !== predictedAway.tla
      ? predictedAway
      : null;

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

      {/* Para eliminatorias: mostrar los equipos del bracket de este usuario */}
      {showDerivedTeams && (homeMain || awayMain || homeMissPick || awayMissPick) && (
        <div className="pl-11">
          <div className="flex items-center gap-2 text-xs text-gray-700 flex-wrap">
            <TeamChip team={homeMain} hit={homeHit} />
            <span className="text-gray-400">vs</span>
            <TeamChip team={awayMain} hit={awayHit} />
          </div>
          {(homeMissPick || awayMissPick) && (
            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5 opacity-70">
              <span className="font-semibold">Su pick:</span>
              <span className="line-through flex items-center gap-1">
                {homeMissPick ? (
                  <>
                    <Flag iso2={homeMissPick.iso2} size={10} alt={homeMissPick.name} />
                    {homeMissPick.tla}
                  </>
                ) : (
                  <span>—</span>
                )}
              </span>
              <span className="opacity-50">vs</span>
              <span className="line-through flex items-center gap-1">
                {awayMissPick ? (
                  <>
                    <Flag iso2={awayMissPick.iso2} size={10} alt={awayMissPick.name} />
                    {awayMissPick.tla}
                  </>
                ) : (
                  <span>—</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function TeamChip({
  team,
  hit,
}: {
  team: { iso2: string; name: string; tla: string } | null;
  hit: boolean;
}) {
  if (!team) {
    return <span className="italic text-gray-500">— por definir</span>;
  }
  return (
    <span className="flex items-center gap-1">
      <Flag iso2={team.iso2} size={14} alt={team.name} />
      <span className="font-medium">{team.name}</span>
      {hit && (
        <span
          className="text-[9px] font-bold text-[var(--pmfu-mint)] bg-[var(--pmfu-mint)]/15 px-1 py-0.5 rounded-full"
          title="Su bracket acertó este equipo"
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
