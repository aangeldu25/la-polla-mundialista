"use client";

import Image from "next/image";
import { Flag } from "@/components/ui/Flag";
import { findPlayer } from "@/lib/constants/wc2026-players";
import { useProfilesForUids } from "@/hooks/usePredictions";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";
import { useSpecialPredictionsForUids } from "@/hooks/useSpecialPredictions";

export function QuinielaChisme({ currentUid }: { currentUid: string | null }) {
  const { memberUids } = useActivePolla();
  const { list } = useSpecialPredictionsForUids(memberUids);
  const profiles = useProfilesForUids(memberUids);
  const others = list.filter((p) => p.uid !== currentUid);

  if (others.length === 0) {
    return (
      <section className="pmfu-glass rounded-2xl p-6 mt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Premios individuales de la familia
        </h2>
        <p className="text-sm text-gray-700 italic">
          Aún nadie más ha registrado sus premios.
        </p>
      </section>
    );
  }

  return (
    <section className="pmfu-glass rounded-2xl p-6 mt-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Premios individuales de la familia
      </h2>
      <p className="text-xs text-gray-700 mb-4">
        {others.length}{" "}
        {others.length === 1 ? "familiar" : "familiares"} ya registraron sus
        premios.
      </p>
      <div className="space-y-4">
        {others.map((p) => {
          const prof = profiles.get(p.uid);
          const name = prof?.displayName ?? "Anónimo";
          return (
            <div
              key={p.uid}
              className="border border-gray-200 rounded-xl p-3 bg-white"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="relative w-7 h-7 rounded-full overflow-hidden bg-gray-200">
                  {prof?.photoURL ? (
                    <Image
                      src={prof.photoURL}
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
                <span className="font-bold text-sm text-gray-900">{name}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <PlayerRow label="⚽ Goleador" id={p.topScorerName} />
                <PlayerRow label="🌟 Balón de Oro" id={p.goldenBallName} />
                <PlayerRow label="🧤 Guante de Oro" id={p.goldenGloveName} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayerRow({ label, id }: { label: string; id: string | null }) {
  const player = findPlayer(id);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-semibold text-gray-700 shrink-0">{label}:</span>
      {player ? (
        <>
          <Flag iso2={player.teamIso2} size={16} alt={player.teamName} />
          <span className="text-gray-900 font-medium truncate">
            {player.name}
          </span>
        </>
      ) : (
        <span className="text-gray-500 italic">—</span>
      )}
    </div>
  );
}
