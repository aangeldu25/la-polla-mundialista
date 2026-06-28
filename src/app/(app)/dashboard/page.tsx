"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/components/auth/AuthProvider";
import { useProfilesForUids, useMyPredictions } from "@/hooks/usePredictions";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";
import { db } from "@/lib/firebase/client";
import { Card } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { MatchCard } from "@/components/partidos/MatchCard";
import { PredictionModal } from "@/components/predictions/PredictionModal";
import { computeRealR32Projection } from "@/lib/stats/r32-projection";
import { useDerivedBracket } from "@/hooks/useDerivedBracket";
import {
  evalStructureMatch,
  teamsInRoundFrom,
} from "@/lib/scoring/structure-calc";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import type { Match, UserProfile } from "@/types/domain";
import { SCORING } from "@/types/domain";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { memberUids } = useActivePolla();
  const profiles = useProfilesForUids(memberUids);
  const { predictions } = useMyPredictions(user?.uid);
  const { bracket: derivedBracket } = useDerivedBracket(user?.uid);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => d.data() as Match));
    });
    return () => unsub();
  }, []);

  const ranked = useMemo(() => {
    const byEmail = new Map<string, UserProfile>();
    for (const p of profiles.values()) {
      const email = (p.email ?? "").toLowerCase().trim() || p.uid;
      const ex = byEmail.get(email);
      if (!ex || (p.totalPoints ?? 0) > (ex.totalPoints ?? 0)) {
        byEmail.set(email, p);
      }
    }
    return [...byEmail.values()].sort((a, b) => {
      if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0))
        return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
      if ((b.exactScoreHits ?? 0) !== (a.exactScoreHits ?? 0))
        return (b.exactScoreHits ?? 0) - (a.exactScoreHits ?? 0);
      if ((b.winnerHits ?? 0) !== (a.winnerHits ?? 0))
        return (b.winnerHits ?? 0) - (a.winnerHits ?? 0);
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });
  }, [profiles]);

  const myRank = useMemo(
    () => ranked.findIndex((p) => p.uid === user?.uid) + 1,
    [ranked, user?.uid],
  );

  // Estadísticas: puntos acumulados vs puntos en juego (de partidos predichos)
  const stats = useMemo(() => {
    let earnedPoints = 0;
    let possiblePoints = 0;
    let earnedExacts = 0;
    let possibleExacts = 0;
    let earnedWinners = 0;
    let possibleWinners = 0;

    for (const m of matches) {
      if (m.status !== "FINISHED") continue;
      const pred = predictions.get(m.id);
      if (!pred) continue; // solo cuentan partidos que predijo
      const mult = SCORING.STAGE_MULTIPLIER[m.stage] ?? 1;
      const maxPoints = SCORING.EXACT_SCORE * mult;
      possiblePoints += maxPoints;
      possibleExacts += 1;
      possibleWinners += 1;
      earnedPoints += pred.pointsAwarded ?? 0;
      if (pred.isExact) earnedExacts += 1;
      // Inclusivo: acertar el marcador exacto implica acertar el ganador
      if (pred.isExact || pred.isWinnerCorrect) earnedWinners += 1;
    }

    return {
      earnedPoints,
      possiblePoints,
      pointsPct:
        possiblePoints > 0
          ? Math.round((earnedPoints / possiblePoints) * 100)
          : 0,
      earnedExacts,
      possibleExacts,
      exactsPct:
        possibleExacts > 0
          ? Math.round((earnedExacts / possibleExacts) * 100)
          : 0,
      earnedWinners,
      possibleWinners,
      winnersPct:
        possibleWinners > 0
          ? Math.round((earnedWinners / possibleWinners) * 100)
          : 0,
    };
  }, [matches, predictions]);

  const todayMatches = useMemo(() => {
    const today = new Date();
    return matches.filter((m) => {
      if (!m.homeTeam.tla && !m.awayTeam.tla && m.matchNumber === undefined)
        return false;
      return isSameDay(new Date(m.utcDate), today);
    });
  }, [matches]);

  // Proyección real de clasificados a R32 (para mostrar equipos en vez de
  // etiquetas en los partidos de hoy, igual que en la sección Partidos).
  const r32Projection = useMemo(
    () => computeRealR32Projection(matches),
    [matches],
  );

  const favTeam = profile?.favoriteTeamTla
    ? TEAMS_BY_TLA[profile.favoriteTeamTla]
    : null;

  return (
    <main className="px-4 md:px-6 py-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm uppercase tracking-widest text-[var(--pmfu-cobalt)] font-bold">
          Hola
        </p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-gray-900">
          {profile?.displayName ?? "Mundialista"}
        </h1>
        {favTeam && (
          <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            Hincha de <Flag iso2={favTeam.iso2} size={20} /> {favTeam.name}
          </div>
        )}
      </div>

      {/* Top 3 + mi posición */}
      <Card className="!p-4 md:!p-5 mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm uppercase tracking-widest text-[var(--pmfu-cobalt)] font-bold">
            Podio
          </h2>
          <Link
            href="/ranking"
            className="text-xs font-bold text-[var(--pmfu-cobalt)] hover:underline"
          >
            Ver ranking completo →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[1, 2, 3].map((rank) => {
            const p = ranked[rank - 1];
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            return (
              <div
                key={rank}
                className={cn(
                  "rounded-2xl p-3 text-center border",
                  rank === 1
                    ? "bg-yellow-50 border-yellow-200"
                    : rank === 2
                      ? "bg-gray-50 border-gray-200"
                      : "bg-orange-50 border-orange-200",
                )}
              >
                <div className="text-2xl mb-1">{medal}</div>
                {p ? (
                  <>
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 mx-auto mb-1">
                      {p.photoURL ? (
                        <Image
                          src={p.photoURL}
                          alt={p.displayName}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-700">
                          {p.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {p.displayName}
                    </p>
                    <p className="text-base font-bold text-[var(--pmfu-cobalt)] tabular-nums">
                      {p.totalPoints ?? 0}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500 italic">—</p>
                )}
              </div>
            );
          })}
        </div>
        {myRank > 0 && (
          <div
            className={cn(
              "rounded-xl p-3 flex items-center justify-between text-sm",
              myRank <= 3
                ? "bg-[var(--pmfu-cobalt)]/10 border border-[var(--pmfu-cobalt)]/20"
                : "bg-gray-50 border border-gray-200",
            )}
          >
            <span className="font-semibold text-gray-900">
              Tu posición:{" "}
              <strong className="text-[var(--pmfu-cobalt)]">
                #{myRank} de {ranked.length}
              </strong>
            </span>
            <span className="font-bold text-gray-900 tabular-nums">
              {profile?.totalPoints ?? 0} pts
            </span>
          </div>
        )}
      </Card>

      {/* Stats con porcentajes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Puntos"
          earned={stats.earnedPoints}
          possible={stats.possiblePoints}
          pct={stats.pointsPct}
          color="cobalt"
        />
        <StatCard
          label="Marcadores exactos"
          earned={stats.earnedExacts}
          possible={stats.possibleExacts}
          pct={stats.exactsPct}
          color="mint"
        />
        <StatCard
          label="Ganadores acertados"
          earned={stats.earnedWinners}
          possible={stats.possibleWinners}
          pct={stats.winnersPct}
          color="orange"
        />
      </div>

      {/* Partidos hoy */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Partidos hoy</h2>
          <Link
            href="/partidos"
            className="text-xs font-bold text-[var(--pmfu-cobalt)] hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        {todayMatches.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-gray-700 font-medium">
              No hay partidos programados para hoy.
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {todayMatches.map((m) => {
              const proj =
                m.stage === "ROUND_OF_32" &&
                m.matchNumber !== undefined &&
                !(m.homeTeam.tla && m.awayTeam.tla)
                  ? r32Projection.get(m.matchNumber)
                  : undefined;
              const userSlot =
                m.stage !== "GROUP" && m.matchNumber !== undefined
                  ? derivedBracket.get(m.matchNumber)
                  : undefined;
              const structure =
                userSlot && m.homeTeam.tla && m.awayTeam.tla
                  ? evalStructureMatch(
                      m.stage,
                      userSlot.homeTla,
                      userSlot.awayTla,
                      m.homeTeam.tla,
                      m.awayTeam.tla,
                      teamsInRoundFrom(
                        matches.filter(
                          (x) =>
                            x.stage === m.stage &&
                            x.homeTeam.tla &&
                            x.awayTeam.tla,
                        ),
                      ),
                    )
                  : null;
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  prediction={predictions.get(m.id)}
                  onClick={() => setSelected(m)}
                  structure={structure}
                  projectedHome={
                    proj?.homeTla
                      ? { tla: proj.homeTla, confirmed: proj.homeConfirmed }
                      : null
                  }
                  projectedAway={
                    proj?.awayTla
                      ? { tla: proj.awayTla, confirmed: proj.awayConfirmed }
                      : null
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <PredictionModal
        match={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}

function StatCard({
  label,
  earned,
  possible,
  pct,
  color,
}: {
  label: string;
  earned: number;
  possible: number;
  pct: number;
  color: "cobalt" | "mint" | "orange";
}) {
  const colorMap = {
    cobalt: "bg-[var(--pmfu-cobalt)]",
    mint: "bg-[var(--pmfu-mint)]",
    orange: "bg-[var(--pmfu-orange)]",
  };
  const textMap = {
    cobalt: "text-[var(--pmfu-cobalt)]",
    mint: "text-[var(--pmfu-mint)]",
    orange: "text-[var(--pmfu-orange)]",
  };
  return (
    <div className="pmfu-glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-widest text-gray-700 font-semibold">
        {label}
      </p>
      <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
        {earned}{" "}
        <span className="text-base text-gray-500 font-medium">/ {possible}</span>
      </p>
      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", colorMap[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn("text-xs font-bold mt-1.5 tabular-nums", textMap[color])}>
        {pct}% de éxito
      </p>
    </div>
  );
}
