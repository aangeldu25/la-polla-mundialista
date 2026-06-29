"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import type {
  DetailedStats,
  DetailedStatsLeader,
  TeamDetailedStats,
} from "@/lib/stats/wcDataset";

function TeamLabel({ tla, size = 16 }: { tla: string; size?: number }) {
  const t = TEAMS_BY_TLA[tla];
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {t?.iso2 ? (
        <Flag iso2={t.iso2} size={size} alt={t.name} />
      ) : (
        <span className="w-4 h-3 bg-gray-200 rounded" />
      )}
      <span className="font-medium text-gray-900 truncate">{t?.name ?? tla}</span>
    </span>
  );
}

// Lista de líderes: ranking + bandera + nombre + valor (con sufijo opcional).
function LeaderList({
  rows,
  suffix = "",
  accent = "var(--pmfu-cobalt)",
}: {
  rows: DetailedStatsLeader[];
  suffix?: string;
  accent?: string;
}) {
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li
          key={r.tla}
          className="flex items-center gap-2 text-sm py-1 border-b border-gray-100 last:border-0"
        >
          <span className="w-5 text-xs font-bold text-gray-400 tabular-nums text-right">
            {i + 1}
          </span>
          <span className="flex-1 min-w-0">
            <TeamLabel tla={r.tla} />
          </span>
          <span
            className="font-bold tabular-nums"
            style={{ color: accent }}
          >
            {r.value}
            {suffix}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DetailedStatsSections({
  data,
  loading,
}: {
  data: DetailedStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader
          title="📊 Estadísticas detalladas"
          subtitle="Cargando posesión, disciplina, disparos y xG…"
        />
        <div className="h-24 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }
  if (!data || data.teams.length === 0) return null;

  const { totals, teams } = data;
  // Tabla de disparos: por equipo, ordenada por disparos al arco.
  const shooting: TeamDetailedStats[] = [...teams]
    .sort((a, b) => b.shotsOnTarget - a.shotsOnTarget)
    .slice(0, 8);
  // Disciplina por equipo (más tarjetas), con amarillas/rojas.
  const discipline: TeamDetailedStats[] = [...teams]
    .sort((a, b) => b.yellow + b.red * 3 - (a.yellow + a.red * 3))
    .slice(0, 8);

  return (
    <>
      {/* Resumen */}
      <Card>
        <CardHeader
          title="📊 Estadísticas detalladas"
          subtitle="Posesión, disciplina, disparos y xG del torneo"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Chip label="Tarjetas 🟨" value={totals.yellow} accent="var(--pmfu-orange)" />
          <Chip label="Tarjetas 🟥" value={totals.red} accent="var(--pmfu-magenta)" />
          <Chip label="Faltas" value={totals.fouls} accent="var(--pmfu-cobalt)" />
          <Chip label="xG total" value={totals.xg} accent="var(--pmfu-lime)" />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Sobre {data.matchesWithStats} partidos con estadísticas
          {data.updatedAt ? ` · datos al ${data.updatedAt}` : ""}.
        </p>
      </Card>

      {/* Disciplina & Fair Play */}
      <Card>
        <CardHeader
          title="🟨 Disciplina & Fair Play"
          subtitle="Tarjetas por equipo (amarilla = 1, roja = 3)"
        />
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Más sancionados
            </p>
            <ul className="space-y-1">
              {discipline.map((t, i) => (
                <li
                  key={t.tla}
                  className="flex items-center gap-2 text-sm py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="w-5 text-xs font-bold text-gray-400 tabular-nums text-right">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <TeamLabel tla={t.tla} />
                  </span>
                  <span className="text-xs font-bold tabular-nums text-gray-700">
                    🟨{t.yellow} 🟥{t.red}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Fair Play (menos tarjetas)
            </p>
            <LeaderList rows={data.fairPlay} accent="var(--pmfu-mint)" />
          </div>
        </div>
      </Card>

      {/* Posesión */}
      <Card>
        <CardHeader
          title="🔵 Posesión promedio"
          subtitle="Equipos que más dominan el balón"
        />
        <LeaderList rows={data.possession} suffix="%" />
      </Card>

      {/* Disparos & efectividad */}
      <Card>
        <CardHeader
          title="🎯 Disparos & puntería"
          subtitle="Disparos, al arco y % de efectividad"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 text-right">
                <th className="text-left font-semibold pb-1">Equipo</th>
                <th className="font-semibold pb-1">Disp.</th>
                <th className="font-semibold pb-1">Al arco</th>
                <th className="font-semibold pb-1">%</th>
              </tr>
            </thead>
            <tbody>
              {shooting.map((t) => (
                <tr key={t.tla} className="border-b border-gray-100 last:border-0">
                  <td className="py-1">
                    <TeamLabel tla={t.tla} />
                  </td>
                  <td className="text-right tabular-nums text-gray-700">{t.shots}</td>
                  <td className="text-right tabular-nums font-bold text-gray-900">
                    {t.shotsOnTarget}
                  </td>
                  <td className="text-right tabular-nums font-bold text-[var(--pmfu-cobalt)]">
                    {t.shotAccuracy}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Juego brusco */}
      <Card>
        <CardHeader title="🦶 Más faltas cometidas" subtitle="Por equipo en el torneo" />
        <LeaderList rows={data.fouling} accent="var(--pmfu-orange)" />
      </Card>

      {/* xG & eficacia */}
      <Card>
        <CardHeader
          title="📈 xG & eficacia"
          subtitle="Goles esperados y quién rinde por encima"
        />
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Mayor xG (peligro generado)
            </p>
            <LeaderList rows={data.xgRanking} accent="var(--pmfu-lime)" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Eficacia (goles − xG)
            </p>
            <LeaderList rows={data.overperformers} accent="var(--pmfu-magenta)" />
          </div>
        </div>
      </Card>
    </>
  );
}

function Chip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-3 text-center border"
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 8%, white)`,
        borderColor: `color-mix(in srgb, ${accent} 25%, white)`,
      }}
    >
      <p
        className="text-2xl font-bold tabular-nums leading-none"
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="text-[11px] font-semibold text-gray-700 mt-1">{label}</p>
    </div>
  );
}
