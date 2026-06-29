"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { useAllMatches } from "@/hooks/useAllMatches";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { GROUP_LETTERS } from "@/lib/constants/wc2026-groups";
import {
  dedupeMatches,
  computeAllRealStandings,
  computeBestThirds,
  computeTournamentSummary,
  computeTeamTotals,
  computeTeamForms,
  topAttack,
  topDefense,
  unbeatenTeams,
  type TeamTotals,
  type TeamForm,
  type ThirdPlaceRow,
} from "@/lib/stats/tournament-stats";
import {
  getHistoricalContext,
  getGoalRecordContext,
  WORLD_CUP_HISTORY,
  ALL_TIME_RECORDS,
  FORMAT_TIMELINE,
  PLAYER_WATCHLIST,
  RULE_CHANGES,
} from "@/lib/stats/world-cup-history";
import { useOpenfootballStats } from "@/hooks/useOpenfootballStats";
import { useDetailedStats } from "@/hooks/useDetailedStats";
import { DetailedStatsSections } from "@/components/stats/DetailedStatsSections";
import { PowerRankingCard } from "@/components/stats/PowerRankingCard";
import { computePowerRanking } from "@/lib/stats/powerRanking";
import type { Scorer, GoalGems } from "@/lib/stats/openfootball";
import type { TeamStanding } from "@/lib/standings/group-standings";
import { cn } from "@/lib/utils";

export default function EstadisticasPage() {
  const { matches: rawMatches, loading } = useAllMatches();

  // Dedup: la colección puede tener placeholders de bracket que duplican los
  // partidos reales de Football-Data. Trabajamos siempre con los 104 únicos.
  const matches = useMemo(() => dedupeMatches(rawMatches), [rawMatches]);

  const summary = useMemo(
    () => computeTournamentSummary(matches),
    [matches],
  );
  const standings = useMemo(
    () => computeAllRealStandings(matches),
    [matches],
  );
  const bestThirds = useMemo(() => computeBestThirds(matches), [matches]);
  const totals = useMemo(() => computeTeamTotals(matches), [matches]);
  const attack = useMemo(() => topAttack(totals, 99), [totals]);
  const defense = useMemo(() => topDefense(totals, 99), [totals]);
  const forms = useMemo(() => computeTeamForms(matches), [matches]);
  const unbeaten = useMemo(() => unbeatenTeams(forms, 99), [forms]);
  const history = useMemo(
    () => getHistoricalContext(summary.avgGoalsPerMatch),
    [summary.avgGoalsPerMatch],
  );
  const goalRecord = useMemo(
    () => getGoalRecordContext(summary.avgGoalsPerMatch),
    [summary.avgGoalsPerMatch],
  );
  // Goleadores + joyas de goles (openfootball, vía API cacheada)
  const { scorers, gems, loading: ofLoading } = useOpenfootballStats();
  // Estadísticas detalladas (posesión, tarjetas, faltas, disparos, xG) vía
  // dataset abierto. Fire-and-forget: si no hay datos, las secciones se ocultan.
  const { data: detailed, loading: detailedLoading } = useDetailedStats();
  // Power Ranking propio: combina resultados/gol/forma (datos internos) con
  // calidad de juego (xG/posesión del dataset, si está disponible).
  const powerRanking = useMemo(
    () => computePowerRanking(totals, forms, detailed?.teams),
    [totals, forms, detailed],
  );

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const noData = summary.matchesPlayed === 0;

  return (
    <main className="px-4 md:px-6 py-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Estadísticas
        </h1>
        <p className="mt-1 text-gray-800 font-medium">
          Los números clave del Mundial 2026, en vivo.
        </p>
      </div>

      {noData ? (
        <Card className="text-center py-10">
          <p className="text-4xl mb-2">📊</p>
          <p className="font-bold text-gray-900">Aún no hay partidos jugados</p>
          <p className="text-sm text-gray-700 mt-1">
            Las estadísticas aparecerán en cuanto arranque el torneo.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1. Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatChip
              label="Goles"
              value={summary.totalGoals}
              accent="cobalt"
            />
            <StatChip
              label="Gol / partido"
              value={summary.avgGoalsPerMatch.toFixed(2)}
              accent="magenta"
            />
            <StatChip
              label="Jugados"
              value={`${summary.matchesPlayed}/${summary.matchesTotal}`}
              accent="lime"
            />
            <StatChip
              label="Vallas en 0"
              value={summary.cleanSheets}
              accent="orange"
            />
          </div>

          {/* 2. Récord histórico */}
          <Card>
            <CardHeader
              title="📜 En la historia de los Mundiales"
              subtitle="Promedio de gol del torneo vs. todas las ediciones"
            />
            <HistoryBlock
              currentAvg={summary.avgGoalsPerMatch}
              history={history}
              record={goalRecord}
            />
            <HistorySparkline currentAvg={summary.avgGoalsPerMatch} />
            <FormatTimeline />
          </Card>

          {/* 2b. Records de la historia vs 2026 */}
          <Card>
            <CardHeader
              title="🏟️ Records de la historia"
              subtitle="Las marcas históricas, contrastadas con 2026"
            />
            <HistoricalRecords
              scorers={scorers}
              highest2026={summary.highestScoring?.goals ?? null}
              biggestWin2026={summary.biggestWin?.diff ?? null}
            />
          </Card>

          {/* 2c. Individualidades a seguir */}
          <Card>
            <CardHeader
              title="👑 Individualidades a seguir"
              subtitle="Estrellas activas persiguiendo records históricos"
            />
            <Individualidades scorers={scorers} loading={ofLoading} />
          </Card>

          {/* 3. Goleadores (openfootball) */}
          <Card>
            <CardHeader
              title="🥇 Goleadores"
              subtitle="Máximos artilleros del torneo"
            />
            <ScorersList scorers={scorers} loading={ofLoading} />
          </Card>

          {/* 4. Joyas de goles (openfootball) */}
          {gems && gems.totalGoals > 0 && <GoalGemsBlock gems={gems} />}

          {/* Estadísticas detalladas (posesión, tarjetas, disparos, xG) */}
          <PowerRankingCard rows={powerRanking} />

          <DetailedStatsSections data={detailed} loading={detailedLoading} />

          {/* 5. Ataque y defensa */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="🔥 Ataque" subtitle="Goles a favor por equipo" />
              <TeamRankList rows={attack} metric="goalsFor" accent="orange" />
            </Card>
            <Card>
              <CardHeader
                title="🛡️ Vallas menos vencidas"
                subtitle="Menos goles recibidos"
              />
              <TeamRankList
                rows={defense}
                metric="goalsAgainst"
                accent="cobalt"
              />
            </Card>
          </div>
          {/* el ShowMore va dentro de TeamRankList */}

          {/* 6. Rachas */}
          {unbeaten.length > 0 && (
            <Card>
              <CardHeader
                title="💪 Invictos del torneo"
                subtitle={`${unbeaten.length} equipos sin derrotas (G-E)`}
              />
              <ul>
                <ShowMore
                  collapsed={6}
                  totalLabel={(n) => `Ver los ${n} invictos`}
                >
                  {unbeaten.map((f) => (
                    <UnbeatenRow key={f.teamTla} f={f} />
                  ))}
                </ShowMore>
              </ul>
            </Card>
          )}

          {/* 5. Tabla de grupos */}
          <Card>
            <CardHeader
              title="📋 Tabla de grupos"
              subtitle="Posiciones reales según resultados"
            />
            <GroupTables standings={standings} />

            {/* Mejores terceros — los 8 primeros clasifican a R32 */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <CardHeader
                title="🥉 Los mejores terceros"
                subtitle="Los 8 primeros avanzan a Dieciseisavos (criterios FIFA)"
              />
              <BestThirdsTable rows={bestThirds} />
            </div>
          </Card>

          {/* Fuentes */}
          <p className="text-[11px] text-gray-500 text-center px-4">
            Marcadores y tablas en vivo vía Football-Data + FIFA. Goleadores y
            detalle de goles vía openfootball. Posesión, tarjetas, faltas,
            disparos y xG vía dataset abierto de la comunidad (datos de fifa.com,
            actualizados a diario).
          </p>
        </div>
      )}
    </main>
  );
}

const ACCENTS = {
  cobalt: "var(--pmfu-cobalt)",
  magenta: "var(--pmfu-magenta)",
  lime: "var(--pmfu-lime)",
  orange: "var(--pmfu-orange)",
} as const;

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: keyof typeof ACCENTS;
}) {
  return (
    <div
      className="rounded-2xl p-3 text-center border"
      style={{
        backgroundColor: `color-mix(in srgb, ${ACCENTS[accent]} 8%, white)`,
        borderColor: `color-mix(in srgb, ${ACCENTS[accent]} 25%, white)`,
      }}
    >
      <p
        className="text-2xl font-bold tabular-nums leading-none"
        style={{ color: ACCENTS[accent] }}
      >
        {value}
      </p>
      <p className="text-[11px] font-semibold text-gray-700 mt-1">{label}</p>
    </div>
  );
}

// Mini-gráfico de líneas: promedio de gol de las 23 ediciones + 2026 resaltado.
function HistorySparkline({ currentAvg }: { currentAvg: number }) {
  const W = 300;
  const H = 70;
  const pad = 6;
  const points = [
    ...WORLD_CUP_HISTORY.map((e) => ({ year: e.year, avg: e.avg })),
    { year: 2026, avg: currentAvg },
  ];
  const minAvg = Math.min(...points.map((p) => p.avg));
  const maxAvg = Math.max(...points.map((p) => p.avg));
  const range = maxAvg - minAvg || 1;
  const x = (i: number) =>
    pad + (i / (points.length - 1)) * (W - 2 * pad);
  const y = (avg: number) =>
    H - pad - ((avg - minAvg) / range) * (H - 2 * pad);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`)
    .join(" ");
  const last = points.length - 1;

  // Posición x de cada cambio de regla (interpolada por año)
  const years = points.map((p) => p.year);
  const xForYear = (yr: number) => {
    // encuentra el índice fraccional del año en la serie
    let i = years.findIndex((y2) => y2 >= yr);
    if (i < 0) i = years.length - 1;
    if (i === 0) return x(0);
    const prevY = years[i - 1];
    const nextY = years[i];
    const frac = (yr - prevY) / (nextY - prevY || 1);
    return x(i - 1) + frac * (x(i) - x(i - 1));
  };

  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
        Promedio de gol por edición · 1930 → 2026
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {/* líneas verticales de cambios de regla (solo dentro del gráfico) */}
        {RULE_CHANGES.filter((rc) => rc.year >= years[0]).map((rc) => {
          const rx = xForYear(rc.year);
          return (
            <line
              key={rc.year}
              x1={rx}
              y1={pad}
              x2={rx}
              y2={H - pad}
              stroke="var(--pmfu-orange)"
              strokeWidth={0.8}
              strokeDasharray="2 2"
              opacity={0.5}
            />
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="var(--pmfu-cobalt)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* punto 2026 */}
        <circle cx={x(last)} cy={y(currentAvg)} r={3.5} fill="var(--pmfu-magenta)" />
      </svg>
      {/* Etiquetas de año alineadas al punto real de cada edición */}
      <div className="relative h-3 mt-0.5">
        {points
          .map((p, i) => ({ p, i }))
          .filter(({ i }) => i % 4 === 0 || i === points.length - 1)
          .map(({ p, i }) => {
            const leftPct = (x(i) / W) * 100;
            const isLast = i === points.length - 1;
            return (
              <span
                key={p.year}
                className={cn(
                  "absolute top-0 text-[9px] -translate-x-1/2",
                  isLast
                    ? "text-[var(--pmfu-magenta)] font-bold"
                    : "text-gray-400",
                )}
                style={{ left: `${leftPct}%` }}
              >
                {p.year}
              </span>
            );
          })}
      </div>
      {/* leyenda de cambios de regla */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {RULE_CHANGES.map((rc) => (
          <span
            key={rc.year}
            className="text-[10px] text-gray-600 flex items-center gap-1"
            title={rc.label}
          >
            <span className="w-2 border-t border-dashed border-[var(--pmfu-orange)]" />
            <strong className="text-gray-700">{rc.year}</strong> {rc.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Línea de la expansión del torneo (equipos por época).
function FormatTimeline() {
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
        La expansión del Mundial
      </p>
      <div className="flex items-center gap-1">
        {FORMAT_TIMELINE.map((f, i) => (
          <div key={f.from} className="flex items-center gap-1 flex-1">
            <div
              className={cn(
                "flex-1 text-center rounded-lg py-1.5",
                f.teams === 48
                  ? "bg-[var(--pmfu-magenta)]/10 border border-[var(--pmfu-magenta)]/30"
                  : "bg-gray-50",
              )}
            >
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  f.teams === 48
                    ? "text-[var(--pmfu-magenta)]"
                    : "text-gray-900",
                )}
              >
                {f.teams}
              </p>
              <p className="text-[9px] text-gray-500">{f.from}</p>
            </div>
            {i < FORMAT_TIMELINE.length - 1 && (
              <span className="text-gray-300 text-xs">→</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 mt-2 text-center">
        2026 es el primero con <strong>48 equipos</strong> y{" "}
        <strong>104 partidos</strong>.
      </p>
    </div>
  );
}

function HistoricalRecords({
  scorers,
  highest2026,
  biggestWin2026,
}: {
  scorers: Scorer[];
  highest2026: number | null;
  biggestWin2026: number | null;
}) {
  const r = ALL_TIME_RECORDS;

  // Goleador histórico de todas las Copas: se actualiza si una estrella activa
  // supera la marca de Klose (16) sumando sus goles de 2026.
  const allTime = (() => {
    let best = {
      name: r.topScorerAllTime.name,
      goals: r.topScorerAllTime.goals,
      live: false,
    };
    for (const p of PLAYER_WATCHLIST) {
      const g2026 = scorers
        .filter((s) =>
          p.matchKeys.some((k) =>
            s.name.toLowerCase().includes(k.toLowerCase()),
          ),
        )
        .reduce((sum, s) => sum + s.goals, 0);
      const combined = p.priorWcGoals + g2026;
      if (combined > best.goals) {
        best = { name: p.name, goals: combined, live: true };
      }
    }
    return best;
  })();

  // Más goles en un solo Mundial: Fontaine (13) o el líder de 2026 si lo supera.
  const topNow = scorers[0];
  const oneWC =
    topNow && topNow.goals > r.topScorerOneWC.goals
      ? { name: topNow.name, value: `${topNow.goals}`, live: true }
      : {
          name: r.topScorerOneWC.name,
          value: `${r.topScorerOneWC.goals} (${r.topScorerOneWC.year})`,
          live: false,
        };

  // Partido con más goles y mayor goleada: histórico o 2026 si lo supera.
  const highMatch =
    highest2026 != null && highest2026 > r.highestScoringMatch.goals
      ? { value: `${highest2026} goles (2026)`, live: true }
      : {
          value: `${r.highestScoringMatch.label} · ${r.highestScoringMatch.goals} (${r.highestScoringMatch.year})`,
          live: false,
        };
  const bigWin =
    biggestWin2026 != null && biggestWin2026 > r.biggestWin.margin
      ? { value: `+${biggestWin2026} (2026)`, live: true }
      : { value: `${r.biggestWin.label} (${r.biggestWin.year})`, live: false };

  const rows: Array<{ icon: string; label: string; value: string; live: boolean }> = [
    {
      icon: "🥅",
      label: "Goleador histórico (todas las Copas)",
      value: `${allTime.name} · ${allTime.goals}`,
      live: allTime.live,
    },
    {
      icon: "🎯",
      label: "Más goles en un solo Mundial",
      value: `${oneWC.name} · ${oneWC.value}`,
      live: oneWC.live,
    },
    {
      icon: "⚡",
      label: "Gol más rápido",
      value: `${r.fastestGoal.name} · ${r.fastestGoal.seconds}s (${r.fastestGoal.year})`,
      live: false,
    },
    {
      icon: "🔥",
      label: "Partido con más goles",
      value: highMatch.value,
      live: highMatch.live,
    },
    {
      icon: "💥",
      label: "Mayor goleada",
      value: bigWin.value,
      live: bigWin.live,
    },
  ];
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex items-start gap-2.5 bg-gray-50 rounded-xl p-2.5"
        >
          <span className="text-lg leading-none mt-0.5">{row.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {row.label}
            </p>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              {row.value}
              {row.live && (
                <span className="text-[9px] font-bold text-[var(--pmfu-magenta)] bg-[var(--pmfu-magenta)]/10 px-1.5 py-0.5 rounded-full">
                  ¡2026!
                </span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Individualidades({
  scorers,
  loading,
}: {
  scorers: Scorer[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const klose = ALL_TIME_RECORDS.topScorerAllTime.goals; // 16

  // Goles de 2026 de cada jugador de la watchlist (match por substrings)
  const rows = PLAYER_WATCHLIST.map((p) => {
    const goals2026 = scorers
      .filter((s) =>
        p.matchKeys.some((k) => s.name.toLowerCase().includes(k.toLowerCase())),
      )
      .reduce((sum, s) => sum + s.goals, 0);
    const combined = p.priorWcGoals + goals2026;
    return { ...p, goals2026, combined };
  }).sort((a, b) => b.combined - a.combined);

  return (
    <ul className="space-y-2.5">
      {rows.map((p) => {
        const team = TEAMS_BY_TLA[p.teamTla];
        const pct = Math.min((p.combined / klose) * 100, 100);
        const isRecord = p.combined > klose;
        const reached = p.combined === klose;
        return (
          <li key={p.name} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              {team && <Flag iso2={team.iso2} size={18} alt={team.name} />}
              <span className="font-bold text-sm text-gray-900 flex-1">
                {p.name}
              </span>
              <span className="text-sm font-bold tabular-nums text-gray-900">
                {p.combined}
                <span className="text-[10px] text-gray-500 font-normal">
                  {" "}
                  en Mundiales
                </span>
              </span>
            </div>
            {/* Barra de progreso hacia el récord de Klose */}
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  isRecord || reached
                    ? "bg-[var(--pmfu-lime)]"
                    : "bg-[var(--pmfu-cobalt)]",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-600">
                {p.priorWcGoals} previos
                {p.goals2026 > 0 && (
                  <span className="text-[var(--pmfu-magenta)] font-bold">
                    {" "}
                    +{p.goals2026} en 2026
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold">
                {isRecord ? (
                  <span className="text-[var(--pmfu-lime)]">
                    🏆 ¡Récord histórico!
                  </span>
                ) : reached ? (
                  <span className="text-[var(--pmfu-lime)]">
                    🤝 Igualó a Klose
                  </span>
                ) : (
                  <span className="text-gray-500">
                    a {klose - p.combined} de Klose ({klose})
                  </span>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HistoryBlock({
  currentAvg,
  history,
  record,
}: {
  currentAvg: number;
  history: ReturnType<typeof getHistoricalContext>;
  record: ReturnType<typeof getGoalRecordContext>;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-[var(--pmfu-magenta)] tabular-nums">
          {currentAvg.toFixed(2)}
        </span>
        <span className="text-sm text-gray-700 font-semibold">
          goles por partido
        </span>
        {record.vsPreviousPct !== 0 && (
          <span
            className={cn(
              "text-xs font-bold px-1.5 py-0.5 rounded-full ml-auto",
              record.vsPreviousPct > 0
                ? "text-[var(--pmfu-mint)] bg-[var(--pmfu-mint)]/15"
                : "text-[var(--pmfu-orange)] bg-[var(--pmfu-orange)]/15",
            )}
          >
            {record.vsPreviousPct > 0 ? "▲" : "▼"}{" "}
            {Math.abs(record.vsPreviousPct)}% vs {record.previous.year}
          </span>
        )}
      </div>

      {history.isRecord ? (
        <p className="text-sm text-gray-900 bg-[var(--pmfu-lime)]/20 border border-[var(--pmfu-lime)] rounded-xl p-3 font-semibold">
          🏆 ¡Sería el Mundial más goleador de la historia! Supera a{" "}
          {history.allTimeBest.year} ({history.allTimeBest.avg.toFixed(2)}).
        </p>
      ) : (
        <p className="text-sm text-gray-800">
          En promedio de gol se ubicaría <strong>#{history.rankIfHeld}</strong>{" "}
          de {history.totalEditions} ediciones.
          {history.above && (
            <>
              {" "}
              Por debajo de <strong>{history.above.year}</strong> (
              {history.above.avg.toFixed(2)})
            </>
          )}
          {history.below && (
            <>
              {" "}
              y por encima de <strong>{history.below.year}</strong> (
              {history.below.avg.toFixed(2)}).
            </>
          )}
        </p>
      )}

      {/* Proyección de goles totales — 2026 es el 1er Mundial de 104 partidos */}
      <div className="mt-3 bg-[var(--pmfu-cobalt)]/5 border border-[var(--pmfu-cobalt)]/15 rounded-xl p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
            Proyección de goles totales
          </span>
          <span className="text-xl font-bold text-[var(--pmfu-cobalt)] tabular-nums">
            ~{record.projectedTotal}
          </span>
        </div>
        <p className="text-xs text-gray-700 mt-1">
          {record.willBreakRecord ? (
            <>
              🥅 Al ritmo actual <strong>rompería el récord</strong> de goles en
              una sola Copa ({record.recordTotal.goals} en{" "}
              {record.recordTotal.year}). Es el primer Mundial con 104 partidos.
            </>
          ) : (
            <>
              Récord de goles totales: <strong>{record.recordTotal.goals}</strong>{" "}
              en {record.recordTotal.year}.
            </>
          )}
        </p>
      </div>

      {/* Top 3 ediciones más goleadoras (promedio) */}
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
          Mundiales más goleadores (promedio)
        </p>
        <div className="flex gap-2">
          {record.topByAvg.map((e, i) => (
            <div
              key={e.year}
              className="flex-1 bg-gray-50 rounded-lg p-2 text-center"
            >
              <p className="text-[10px] text-gray-500">
                {["🥇", "🥈", "🥉"][i]} {e.year}
              </p>
              <p className="text-sm font-bold text-gray-900 tabular-nums">
                {e.avg.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScorersList({
  scorers,
  loading,
}: {
  scorers: Scorer[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (scorers.length === 0) {
    return (
      <p className="text-sm text-gray-600 italic text-center py-4">
        Aún no hay goles registrados.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      <ShowMore collapsed={8} totalLabel={(n) => `Ver los ${n} goleadores`}>
        {scorers.map((s, i) => {
          const team = TEAMS_BY_TLA[s.teamTla];
          return (
            <li
              key={`${s.name}-${s.teamTla}`}
              className="flex items-center gap-2.5 py-1.5 border-b border-gray-100 last:border-0"
            >
              <span
                className={cn(
                  "w-5 text-center text-xs font-bold tabular-nums",
                  i === 0 ? "text-[var(--pmfu-orange)]" : "text-gray-500",
                )}
              >
                {i + 1}
              </span>
              {team ? (
                <Flag iso2={team.iso2} size={18} alt={team.name} />
              ) : (
                <span className="w-[18px]" />
              )}
              <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
                {s.name}
              </span>
              {s.penalties > 0 && (
                <span
                  className="text-[10px] font-bold text-gray-500"
                  title={`${s.penalties} de penal`}
                >
                  {s.penalties}P
                </span>
              )}
              <span className="text-sm font-bold tabular-nums text-[var(--pmfu-orange)] w-6 text-right">
                {s.goals}
              </span>
            </li>
          );
        })}
      </ShowMore>
    </ul>
  );
}

function GoalGemsBlock({ gems }: { gems: GoalGems }) {
  const total = gems.totalGoals;
  const playGoals = gems.firstHalfGoals + gems.secondHalfGoals;
  const secondPct =
    playGoals > 0 ? Math.round((gems.secondHalfGoals / playGoals) * 100) : 0;
  const maxBucket = Math.max(...gems.minuteBuckets, 1);
  const bucketLabels = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90", "90+"];

  // Reparto jugada / penal / autogol
  const parts = [
    { label: "Jugada", value: gems.openPlayGoals, color: "var(--pmfu-cobalt)" },
    { label: "Penal", value: gems.penaltyGoals, color: "var(--pmfu-orange)" },
    { label: "Autogol", value: gems.ownGoals, color: "var(--pmfu-magenta)" },
  ];

  return (
    <Card>
      <CardHeader title="✨ Joyas de goles" />

      {/* Tiles superiores */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {gems.earliest && (
          <GemTile
            label="Gol más madrugador"
            value={`${gems.earliest.minute}'`}
            sub={gems.earliest.name}
            tla={gems.earliest.teamTla}
          />
        )}
        {gems.latest && (
          <GemTile
            label="Gol más tardío"
            value={`${gems.latest.minute}'`}
            sub={gems.latest.name}
            tla={gems.latest.teamTla}
          />
        )}
        <GemTile
          label="Minuto promedio"
          value={`${gems.avgMinute}'`}
          sub="del gol típico"
        />
        <GemTile
          label="En descuento"
          value={`${gems.stoppageGoals}`}
          sub="goles tras el 45'/90'"
        />
      </div>

      {/* Distribución por franjas de 15' */}
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
        ¿Cuándo caen los goles?
      </p>
      <div className="flex items-end gap-1.5 h-32 mb-1">
        {gems.minuteBuckets.map((n, i) => {
          const pct = maxBucket > 0 ? (n / maxBucket) * 100 : 0;
          const totalGoals = gems.minuteBuckets.reduce((s, v) => s + v, 0);
          const share = totalGoals > 0 ? Math.round((n / totalGoals) * 100) : 0;
          const isTallest = n === maxBucket && n > 0;
          return (
            <div
              key={i}
              className="flex-1 h-full flex flex-col justify-end items-center"
            >
              <span className="text-[11px] font-bold text-gray-900 tabular-nums leading-none">
                {n}
              </span>
              <span className="text-[8px] text-gray-400 tabular-nums leading-none mb-1">
                {share}%
              </span>
              <div
                className={cn(
                  "w-full rounded-t transition-all",
                  i === 6
                    ? "bg-[var(--pmfu-magenta)]"
                    : isTallest
                      ? "bg-[var(--pmfu-cobalt)]"
                      : "bg-[var(--pmfu-cobalt)]/70",
                )}
                style={{ height: `${n > 0 ? Math.max(pct, 6) : 2}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mb-4">
        {bucketLabels.map((l) => (
          <span
            key={l}
            className="flex-1 text-center text-[8px] text-gray-500"
          >
            {l}
          </span>
        ))}
      </div>

      {/* 1er vs 2do tiempo */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
          <span>1er tiempo · {gems.firstHalfGoals}</span>
          <span>{gems.secondHalfGoals} · 2do tiempo</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden flex bg-gray-200">
          <div
            className="bg-[var(--pmfu-cobalt)]"
            style={{ width: `${100 - secondPct}%` }}
          />
          <div
            className="bg-[var(--pmfu-magenta)]"
            style={{ width: `${secondPct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-600 mt-1.5 text-center">
          El {secondPct}% de los goles cae en el segundo tiempo
        </p>
      </div>

      {/* Reparto por tipo de gol */}
      <div className="flex gap-2 mb-3">
        {parts.map((p) => (
          <div
            key={p.label}
            className="flex-1 bg-gray-50 rounded-xl p-2 text-center"
          >
            <p
              className="text-lg font-bold tabular-nums"
              style={{ color: p.color }}
            >
              {p.value}
            </p>
            <p className="text-[10px] text-gray-600">
              {p.label}
              {total > 0 && (
                <span className="text-gray-400">
                  {" "}
                  · {Math.round((p.value / total) * 100)}%
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Hat-tricks */}
      {gems.hatTricks.length > 0 && (
        <div className="bg-[var(--pmfu-orange)]/10 border border-[var(--pmfu-orange)]/25 rounded-xl p-3">
          <p className="text-xs font-bold text-gray-900 mb-1.5">
            🎩 Hat-tricks ({gems.hatTricks.length})
          </p>
          <ul className="space-y-1">
            {gems.hatTricks.map((h, i) => {
              const team = TEAMS_BY_TLA[h.teamTla];
              const rival = TEAMS_BY_TLA[h.rivalTla];
              return (
                <li
                  key={`${h.name}-${i}`}
                  className="flex items-center gap-2 text-xs text-gray-800"
                >
                  {team && <Flag iso2={team.iso2} size={14} alt={team.name} />}
                  <span className="font-semibold">{h.name}</span>
                  {h.goals > 3 && (
                    <span className="text-[var(--pmfu-orange)] font-bold">
                      ×{h.goals}
                    </span>
                  )}
                  {rival && (
                    <span className="text-gray-500">vs {rival.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function GemTile({
  label,
  value,
  sub,
  tla,
}: {
  label: string;
  value: string;
  sub: string;
  tla?: string;
}) {
  const team = tla ? TEAMS_BY_TLA[tla] : null;
  return (
    <div className="bg-gray-50 rounded-xl p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-900 tabular-nums leading-tight mt-0.5">
        {value}
      </p>
      <div className="flex items-center gap-1 mt-0.5">
        {team && <Flag iso2={team.iso2} size={12} alt={team.name} />}
        <span className="text-[11px] text-gray-700 truncate">{sub}</span>
      </div>
    </div>
  );
}

function UnbeatenRow({ f }: { f: TeamForm }) {
  const team = TEAMS_BY_TLA[f.teamTla];
  return (
    <li className="flex items-center gap-2.5 py-1.5 border-b border-gray-100 last:border-0">
      {team ? (
        <Flag iso2={team.iso2} size={18} alt={team.name} />
      ) : (
        <span className="w-[18px]" />
      )}
      <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
        {team?.name ?? f.teamTla}
      </span>
      <div className="flex items-center gap-1">
        {f.results.map((r, i) => (
          <span
            key={i}
            className={cn(
              "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white",
              r === "W" ? "bg-[var(--pmfu-mint)]" : "bg-[var(--pmfu-orange)]",
            )}
            title={r === "W" ? "Victoria" : "Empate"}
          >
            {r === "W" ? "G" : "E"}
          </span>
        ))}
      </div>
    </li>
  );
}

function TeamRankList({
  rows,
  metric,
  accent,
}: {
  rows: TeamTotals[];
  metric: "goalsFor" | "goalsAgainst";
  accent: keyof typeof ACCENTS;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-600 italic text-center py-3">
        Sin datos todavía.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      <ShowMore collapsed={6} totalLabel={(n) => `Ver los ${n} equipos`}>
        {rows.map((t, i) => {
          const team = TEAMS_BY_TLA[t.teamTla];
          return (
            <li
              key={t.teamTla}
              className="flex items-center gap-2.5 py-1.5 border-b border-gray-100 last:border-0"
            >
              <span className="w-5 text-center text-xs font-bold text-gray-500 tabular-nums">
                {i + 1}
              </span>
              {team ? (
                <Flag iso2={team.iso2} size={18} alt={team.name} />
              ) : (
                <span className="w-[18px]" />
              )}
              <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
                {team?.name ?? t.teamTla}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">
                {t.played} PJ
              </span>
              <span
                className="text-sm font-bold tabular-nums w-7 text-right"
                style={{ color: ACCENTS[accent] }}
              >
                {t[metric]}
              </span>
            </li>
          );
        })}
      </ShowMore>
    </ul>
  );
}

// Wrapper que muestra los primeros `collapsed` hijos y un botón "Ver todos".
function ShowMore({
  children,
  collapsed = 5,
  totalLabel,
}: {
  children: ReactNode;
  collapsed?: number;
  totalLabel: (n: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = (Array.isArray(children) ? children : [children]) as ReactNode[];
  const total = items.length;
  const shown = expanded ? items : items.slice(0, collapsed);
  return (
    <>
      {shown}
      {total > collapsed && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-2 text-xs font-bold text-[var(--pmfu-cobalt)] py-2 rounded-xl hover:bg-[var(--pmfu-cobalt)]/5 transition-colors"
        >
          {expanded ? "Ver menos ▲" : `${totalLabel(total)} ▼`}
        </button>
      )}
    </>
  );
}

function BestThirdsTable({ rows }: { rows: ThirdPlaceRow[] }) {
  const anyPlayed = rows.some((r) => r.standing.played > 0);
  if (!anyPlayed) {
    return (
      <p className="text-sm text-gray-600 italic text-center py-3">
        Aún sin terceros definidos.
      </p>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-500 border-b border-gray-100">
          <th className="text-left font-semibold py-1.5 pl-3">Equipo</th>
          <th className="font-semibold w-7">Gr</th>
          <th className="font-semibold w-7">PJ</th>
          <th className="font-semibold w-7">DG</th>
          <th className="font-semibold w-8 pr-3 text-right">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const team = TEAMS_BY_TLA[r.standing.teamTla];
          // Línea divisoria tras el 8º clasificado
          const isCutoff = i === 7;
          return (
            <tr
              key={r.standing.teamTla}
              className={cn(
                "border-b border-gray-50 last:border-0",
                r.qualifying && "bg-[var(--pmfu-lime)]/15",
                isCutoff && "border-b-2 border-[var(--pmfu-cobalt)]/30",
              )}
            >
              <td className="py-1.5 pl-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "w-3 tabular-nums",
                      r.qualifying
                        ? "text-[var(--pmfu-mint)] font-bold"
                        : "text-gray-400",
                    )}
                  >
                    {i + 1}
                  </span>
                  {team && (
                    <Flag iso2={team.iso2} size={14} alt={team.name} />
                  )}
                  <span className="font-medium text-gray-900 truncate">
                    {team?.name ?? r.standing.teamTla}
                  </span>
                </div>
              </td>
              <td className="text-center tabular-nums text-gray-500 font-semibold">
                {r.group}
              </td>
              <td className="text-center tabular-nums text-gray-700">
                {r.standing.played}
              </td>
              <td className="text-center tabular-nums text-gray-700">
                {r.standing.goalsDiff > 0
                  ? `+${r.standing.goalsDiff}`
                  : r.standing.goalsDiff}
              </td>
              <td className="text-right pr-3 font-bold tabular-nums text-gray-900">
                {r.standing.points}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function GroupTables({
  standings,
}: {
  standings: Record<string, { standings: TeamStanding[]; hasLive: boolean }>;
}) {
  const [open, setOpen] = useState<string | null>(GROUP_LETTERS[0] ?? null);
  return (
    <div className="space-y-2">
      {GROUP_LETTERS.map((g) => {
        const rows = standings[g]?.standings ?? [];
        const hasLive = standings[g]?.hasLive ?? false;
        const isOpen = open === g;
        const anyPlayed = rows.some((r) => r.played > 0);
        return (
          <div
            key={g}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpen(isOpen ? null : g)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-bold text-sm text-gray-900 flex items-center gap-2">
                Grupo {g}
                {hasLive && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--pmfu-magenta)] bg-[var(--pmfu-magenta)]/10 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--pmfu-magenta)] animate-pulse" />
                    EN VIVO
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500">
                {anyPlayed ? (isOpen ? "▲" : "▼") : "sin jugar"}
              </span>
            </button>
            {isOpen && anyPlayed && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left font-semibold py-1.5 pl-3">
                      Equipo
                    </th>
                    <th className="font-semibold w-7">PJ</th>
                    <th className="font-semibold w-7">DG</th>
                    <th className="font-semibold w-8 pr-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const team = TEAMS_BY_TLA[r.teamTla];
                    return (
                      <tr
                        key={r.teamTla}
                        className={cn(
                          "border-b border-gray-50 last:border-0",
                          i < 2 && "bg-[var(--pmfu-lime)]/10",
                          i === 2 && "bg-[var(--pmfu-orange)]/5",
                        )}
                      >
                        <td className="py-1.5 pl-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 text-gray-400 tabular-nums">
                              {i + 1}
                            </span>
                            {team && (
                              <Flag iso2={team.iso2} size={14} alt={team.name} />
                            )}
                            <span className="font-medium text-gray-900 truncate">
                              {team?.name ?? r.teamTla}
                            </span>
                          </div>
                        </td>
                        <td className="text-center tabular-nums text-gray-700">
                          {r.played}
                        </td>
                        <td className="text-center tabular-nums text-gray-700">
                          {r.goalsDiff > 0 ? `+${r.goalsDiff}` : r.goalsDiff}
                        </td>
                        <td className="text-right pr-3 font-bold tabular-nums text-gray-900">
                          {r.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
