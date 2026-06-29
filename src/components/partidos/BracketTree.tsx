"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "@/components/ui/Flag";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { computeRealKnockoutProjection } from "@/lib/stats/r32-projection";
import type { Match } from "@/types/domain";
import { cn } from "@/lib/utils";

// Estructura oficial del bracket WC2026 (dos mitades convergiendo a la Final).
// Cada número es un matchNumber FIFA. El orden top→bottom alinea el árbol.
const LEFT = {
  r32: [74, 77, 73, 75, 83, 84, 81, 82], // 8 llaves
  r16: [89, 90, 93, 94], // 4
  qf: [97, 98], // 2
  sf: [101], // 1
};
const RIGHT = {
  r32: [76, 78, 79, 80, 86, 88, 85, 87],
  r16: [91, 92, 95, 96],
  qf: [99, 100],
  sf: [102],
};
const FINAL = 104;
const BRONZE = 103;

interface SlotTeams {
  homeTla: string | null;
  awayTla: string | null;
  homeConfirmed: boolean;
  awayConfirmed: boolean;
}

export function BracketTree({ matches }: { matches: Match[] }) {
  const [open, setOpen] = useState(false);
  // Pista de scroll: se muestra al abrir el bracket y se oculta al deslizar
  // o tras unos segundos.
  const [showHint, setShowHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setShowHint(false);
      return;
    }
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, [open]);

  const byNumber = useMemo(() => {
    const m = new Map<number, Match>();
    for (const mt of matches) {
      if (mt.matchNumber !== undefined && !m.has(mt.matchNumber)) {
        m.set(mt.matchNumber, mt);
      }
    }
    return m;
  }, [matches]);

  // Proyección REAL de TODA la eliminatoria (R32 → Final), propagando los
  // ganadores: confirmados (full color) los ya clasificados, provisionales
  // (transparentes) los líderes de partidos en vivo o proyecciones por grupos.
  const koProj = useMemo(
    () => computeRealKnockoutProjection(matches),
    [matches],
  );

  // Resuelve los equipos REALES de una llave: equipo oficial del doc > cascada.
  const resolve = useMemo(() => {
    return (matchNumber: number): SlotTeams => {
      const doc = byNumber.get(matchNumber);
      const offHome = doc?.homeTeam.tla && doc.homeTeam.tla.length > 0
        ? doc.homeTeam.tla
        : null;
      const offAway = doc?.awayTeam.tla && doc.awayTeam.tla.length > 0
        ? doc.awayTeam.tla
        : null;
      const p = koProj.get(matchNumber);
      return {
        homeTla: offHome ?? p?.homeTla ?? null,
        awayTla: offAway ?? p?.awayTla ?? null,
        homeConfirmed: offHome ? true : (p?.homeConfirmed ?? false),
        awayConfirmed: offAway ? true : (p?.awayConfirmed ?? false),
      };
    };
  }, [byNumber, koProj]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-sm text-gray-900 flex items-center gap-2">
          🏆 Bracket de eliminatorias
        </span>
        <span className="text-xs text-gray-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-2 pb-3">
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={() => setShowHint(false)}
              className="overflow-x-auto pb-2"
            >
            <div className="min-w-[640px]">
              {/* Encabezados de ronda */}
              <div className="flex text-[8px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                {["16vos", "8vos", "4tos", "Semi", "Final", "Semi", "4tos", "8vos", "16vos"].map(
                  (l, i) => (
                    <div key={i} className="flex-1 text-center">
                      {l}
                    </div>
                  ),
                )}
              </div>

              {/* Cuerpo del árbol */}
              <div className="flex h-[340px]">
                {/* Mitad izquierda */}
                <Col items={LEFT.r32} resolve={resolve} />
                <Col items={LEFT.r16} resolve={resolve} />
                <Col items={LEFT.qf} resolve={resolve} />
                <Col items={LEFT.sf} resolve={resolve} />
                {/* Centro: Final + 3er puesto */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <span className="text-[8px] font-bold text-[var(--pmfu-orange)]">
                    🏆 FINAL
                  </span>
                  <MatchNode teams={resolve(FINAL)} highlight />
                  <span className="text-[8px] text-gray-400 mt-1">
                    3er puesto
                  </span>
                  <MatchNode teams={resolve(BRONZE)} small />
                </div>
                {/* Mitad derecha (espejo) */}
                <Col items={RIGHT.sf} resolve={resolve} />
                <Col items={RIGHT.qf} resolve={resolve} />
                <Col items={RIGHT.r16} resolve={resolve} />
                <Col items={RIGHT.r32} resolve={resolve} />
              </div>
            </div>
            </div>

            {/* Pista animada de scroll horizontal */}
            {showHint && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bracket-hint flex items-center gap-2 bg-gray-900/85 text-white rounded-full px-4 py-2 shadow-lg">
                  <span className="bracket-hint-arrow text-sm">←</span>
                  <span className="bracket-hint-finger text-xl">👆</span>
                  <span className="bracket-hint-arrow text-sm">→</span>
                  <span className="text-[11px] font-semibold">
                    Desliza para ver todo el bracket
                  </span>
                </div>
              </div>
            )}
            <style jsx>{`
              .bracket-hint {
                animation: hint-fade-in 0.3s ease-out;
              }
              .bracket-hint-finger {
                display: inline-block;
                animation: hint-swipe 1.3s ease-in-out infinite;
              }
              .bracket-hint-arrow {
                animation: hint-pulse 1.3s ease-in-out infinite;
              }
              @keyframes hint-swipe {
                0%,
                100% {
                  transform: translateX(-6px);
                }
                50% {
                  transform: translateX(6px);
                }
              }
              @keyframes hint-pulse {
                0%,
                100% {
                  opacity: 0.4;
                }
                50% {
                  opacity: 1;
                }
              }
              @keyframes hint-fade-in {
                from {
                  opacity: 0;
                  transform: scale(0.9);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }
            `}</style>
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500 mt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--pmfu-mint)]" />
              Clasificado
            </span>
            <span className="flex items-center gap-1 opacity-50">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Provisional
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Col({
  items,
  resolve,
}: {
  items: number[];
  resolve: (n: number) => SlotTeams;
}) {
  return (
    <div className="flex-1 flex flex-col justify-around items-center">
      {items.map((n) => (
        <MatchNode key={n} teams={resolve(n)} />
      ))}
    </div>
  );
}

function MatchNode({
  teams,
  highlight,
  small,
}: {
  teams: SlotTeams;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded border bg-white overflow-hidden",
        small ? "w-[52px]" : "w-[58px]",
        highlight
          ? "border-[var(--pmfu-orange)]/50 ring-1 ring-[var(--pmfu-orange)]/30"
          : "border-gray-200",
      )}
    >
      <TeamRow tla={teams.homeTla} confirmed={teams.homeConfirmed} />
      <div className="border-t border-gray-100" />
      <TeamRow tla={teams.awayTla} confirmed={teams.awayConfirmed} />
    </div>
  );
}

function TeamRow({
  tla,
  confirmed,
}: {
  tla: string | null;
  confirmed: boolean;
}) {
  const team = tla ? TEAMS_BY_TLA[tla] : null;
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1 py-0.5 h-[16px]",
        team && !confirmed && "opacity-45",
      )}
    >
      {team ? (
        <Flag iso2={team.iso2} size={10} alt={team.name} />
      ) : (
        <span className="w-[10px] h-[7px] bg-gray-200 rounded-[1px]" />
      )}
      <span className="text-[9px] font-bold text-gray-800 leading-none">
        {tla ?? "—"}
      </span>
    </div>
  );
}
