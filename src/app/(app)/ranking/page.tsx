"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { useProfilesForUids } from "@/hooks/usePredictions";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";
import { PollaSwitcher } from "@/components/polla/PollaSwitcher";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { Flag } from "@/components/ui/Flag";
import { ShareRankingButton } from "@/components/share/ShareRankingButton";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/domain";

export default function RankingPage() {
  const { user } = useAuth();
  const { activePolla, memberUids } = useActivePolla();
  const profiles = useProfilesForUids(memberUids);

  const ranked = useMemo(() => {
    // Dedupe por email: si el mismo usuario se registró con varios métodos
    // (email/password + Google + etc), Firebase Auth crea UIDs distintos.
    // Aquí los consolidamos en una sola fila por email, prefiriendo el perfil
    // con más puntos o (si están empatados) el más reciente.
    const byEmail = new Map<string, UserProfile>();
    for (const p of profiles.values()) {
      const email = (p.email ?? "").toLowerCase().trim() || p.uid;
      const existing = byEmail.get(email);
      if (!existing) {
        byEmail.set(email, p);
        continue;
      }
      const existingScore = existing.totalPoints ?? 0;
      const newScore = p.totalPoints ?? 0;
      if (newScore > existingScore) {
        byEmail.set(email, p);
      } else if (newScore === existingScore) {
        // Preferir el más reciente
        if ((p.createdAt ?? "") > (existing.createdAt ?? "")) {
          byEmail.set(email, p);
        }
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

  return (
    <main className="px-4 md:px-6 py-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Ranking
        </h1>
        <div className="mt-2">
          <PollaSwitcher />
        </div>
        <p className="text-gray-800 mt-2">
          {activePolla
            ? `Tabla de "${activePolla.name}"`
            : "Tabla de posiciones"}{" "}
          · {ranked.length}{" "}
          {ranked.length === 1 ? "participante" : "participantes"}
        </p>
        <div className="text-xs text-gray-700 mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
          <p>
            <strong className="text-gray-900">Exactos:</strong> partidos donde
            acertaste el marcador completo (vale más puntos).
          </p>
          <p>
            <strong className="text-gray-900">Sólo ganador:</strong> partidos
            donde acertaste solo quién ganó (sin el marcador exacto).
          </p>
          <p className="pt-1 text-[10px] text-gray-600 border-t border-gray-200 mt-2">
            Desempates: 1) puntos · 2) exactos · 3) sólo ganador · 4) fecha de
            registro
          </p>
        </div>
        <div className="mt-4">
          <ShareRankingButton ranked={ranked} myUid={user?.uid ?? null} />
        </div>
      </div>

      <div className="pmfu-glass rounded-2xl overflow-hidden">
        {ranked.length === 0 ? (
          <p className="p-8 text-center text-gray-700 font-medium">
            {activePolla
              ? "Aún no hay participantes en esta polla."
              : "Únete o crea una polla para ver tu ranking."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {ranked.map((p, i) => (
              <RankRow
                key={p.uid}
                profile={p}
                rank={i + 1}
                isCurrent={p.uid === user?.uid}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-700 mt-4 text-center">
        Los puntos se actualizan automáticamente cuando un partido termina.
      </p>
    </main>
  );
}

function RankRow({
  profile,
  rank,
  isCurrent,
}: {
  profile: UserProfile;
  rank: number;
  isCurrent: boolean;
}) {
  // Stagger sutil al cargar
  const delay = Math.min(rank * 40, 600);
  const team = profile.favoriteTeamTla
    ? TEAMS_BY_TLA[profile.favoriteTeamTla]
    : null;
  const medal =
    rank === 1 ? "🏆" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <li
      className={cn(
        "flex items-center gap-3 p-3 md:p-4 transition-colors animate-bounce-in",
        isCurrent && "bg-[var(--pmfu-cobalt)]/10",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={cn(
          "w-10 text-center font-bold tabular-nums shrink-0",
          medal ? "text-2xl leading-none" : "text-base text-gray-700",
        )}
      >
        {medal ?? `#${rank}`}
      </span>
      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
        {profile.photoURL ? (
          <Image
            src={profile.photoURL}
            alt={profile.displayName}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-gray-700">
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 truncate">
          {profile.displayName}
          {isCurrent && (
            <span className="ml-2 text-xs text-[var(--pmfu-cobalt)] font-semibold">
              (tú)
            </span>
          )}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-700 font-medium mt-0.5 flex-wrap">
          <span>
            <span className="text-gray-600">Exactos </span>
            <strong className="text-gray-900 tabular-nums">
              {profile.exactScoreHits ?? 0}
            </strong>
          </span>
          <span>
            <span className="text-gray-600">Sólo ganador </span>
            <strong className="text-gray-900 tabular-nums">
              {profile.winnerHits ?? 0}
            </strong>
          </span>
          {team && (
            <span className="flex items-center gap-1">
              <Flag iso2={team.iso2} size={14} alt={team.name} />
              {team.tla}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl md:text-2xl font-bold text-gray-900 tabular-nums leading-none">
          {profile.totalPoints ?? 0}
        </p>
        <p className="text-xs text-gray-700 font-semibold mt-0.5">pts</p>
      </div>
    </li>
  );
}
