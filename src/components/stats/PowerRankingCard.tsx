"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import type { PowerRankRow } from "@/lib/stats/powerRanking";
import { cn } from "@/lib/utils";

const BARS: { key: keyof PowerRankRow["components"]; label: string; color: string }[] = [
  { key: "results", label: "Resultados", color: "var(--pmfu-cobalt)" },
  { key: "goals", label: "Dif. gol", color: "var(--pmfu-lime)" },
  { key: "form", label: "Forma", color: "var(--pmfu-mint)" },
  { key: "quality", label: "Calidad (xG)", color: "var(--pmfu-orange)" },
  { key: "fairPlay", label: "Fair Play", color: "var(--pmfu-magenta)" },
];

function scoreColor(score: number): string {
  if (score >= 70) return "var(--pmfu-lime)";
  if (score >= 50) return "var(--pmfu-cobalt)";
  if (score >= 30) return "var(--pmfu-orange)";
  return "var(--pmfu-magenta)";
}

export function PowerRankingCard({ rows }: { rows: PowerRankRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const [openTla, setOpenTla] = useState<string | null>(null);
  if (rows.length === 0) return null;
  const shown = expanded ? rows : rows.slice(0, 8);
  const anyQuality = rows.some((r) => r.hasQuality);

  return (
    <Card>
      <CardHeader
        title="⚡ Power Ranking"
        subtitle="Índice propio 0–100: resultados, gol, forma y calidad de juego"
      />
      <ul className="space-y-1.5">
        {shown.map((r, i) => {
          const t = TEAMS_BY_TLA[r.tla];
          const open = openTla === r.tla;
          return (
            <li key={r.tla}>
              <button
                onClick={() => setOpenTla(open ? null : r.tla)}
                className="w-full flex items-center gap-2 text-sm py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="w-5 text-xs font-bold text-gray-400 tabular-nums text-right">
                  {i + 1}
                </span>
                {t?.iso2 ? (
                  <Flag iso2={t.iso2} size={18} alt={t.name} />
                ) : (
                  <span className="w-4 h-3 bg-gray-200 rounded" />
                )}
                <span className="flex-1 min-w-0 text-left font-medium text-gray-900 truncate">
                  {t?.name ?? r.tla}
                </span>
                {/* barra de índice */}
                <span className="hidden sm:block w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${r.score}%`,
                      backgroundColor: scoreColor(r.score),
                    }}
                  />
                </span>
                <span
                  className="w-10 text-right font-bold tabular-nums"
                  style={{ color: scoreColor(r.score) }}
                >
                  {r.score}
                </span>
                <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div className="pl-8 pr-1 pb-2 pt-1 space-y-1">
                  {BARS.filter((b) => anyQuality || b.key === "results" || b.key === "goals" || b.key === "form").map(
                    (b) => (
                      <div key={b.key} className="flex items-center gap-2 text-[11px]">
                        <span className="w-20 text-gray-500">{b.label}</span>
                        <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${r.components[b.key]}%`,
                              backgroundColor: b.color,
                            }}
                          />
                        </span>
                        <span className="w-7 text-right tabular-nums font-semibold text-gray-700">
                          {r.components[b.key]}
                        </span>
                      </div>
                    ),
                  )}
                  {!r.hasQuality && (
                    <p className="text-[10px] text-gray-400">
                      Sin datos de calidad (xG/posesión) aún para este equipo.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 8 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "w-full mt-2 text-xs font-bold text-[var(--pmfu-cobalt)] py-2 rounded-xl",
            "hover:bg-[var(--pmfu-cobalt)]/5 transition-colors",
          )}
        >
          {expanded ? "Ver menos ▲" : `Ver los ${rows.length} equipos ▼`}
        </button>
      )}
      <p className="text-[11px] text-gray-500 mt-2">
        Toca un equipo para ver su desglose. Índice propio de la app (no el de
        FIFA): pondera resultados (40%), diferencia de gol (18%), forma reciente
        (20%){anyQuality ? ", calidad de juego con xG (17%) y fair play (5%)" : ""}.
      </p>
    </Card>
  );
}
