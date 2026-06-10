"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { Flag } from "@/components/ui/Flag";
import { Button } from "@/components/ui/Button";
import { ScoreStepper } from "@/components/predictions/ScoreStepper";
import type { Match } from "@/types/domain";

export function OverrideMatchSection() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [homePen, setHomePen] = useState<number | null>(null);
  const [awayPen, setAwayPen] = useState<number | null>(null);
  const [usePenalties, setUsePenalties] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => d.data() as Match));
    });
    return () => unsub();
  }, []);

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedId),
    [matches, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setHome(selected.score.homeFullTime ?? 0);
    setAway(selected.score.awayFullTime ?? 0);
    setHomePen(selected.score.homePenalties ?? null);
    setAwayPen(selected.score.awayPenalties ?? null);
    setUsePenalties(
      selected.score.homePenalties != null &&
        selected.score.awayPenalties != null,
    );
  }, [selectedId, selected]);

  async function handleOverride() {
    if (!selected || !auth.currentUser) return;
    setSaving(true);
    setMsg(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const body: Record<string, unknown> = {
        matchId: selected.id,
        homeScore: home,
        awayScore: away,
      };
      if (usePenalties && home === away) {
        body.homePenalties = homePen ?? 0;
        body.awayPenalties = awayPen ?? 0;
      } else {
        body.homePenalties = null;
        body.awayPenalties = null;
      }
      const res = await fetch("/api/admin/override-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsg({
        type: "ok",
        text: `OK: ${data.scoring?.predictions ?? 0} predicciones procesadas, ${data.scoring?.totalPointsAwarded ?? 0} pts otorgados`,
      });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        ⚙️ Override de marcador
      </h2>
      <p className="text-sm text-gray-800 font-medium mb-4">
        Útil si Football-Data se equivoca o demora en publicar el resultado
        final. El partido se marca como FINISHED y los puntos se recalculan
        desde cero automáticamente.
      </p>

      <div className="flex flex-col gap-1.5 mb-4">
        <label className="text-sm font-semibold text-gray-900">
          Seleccionar partido
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white text-gray-900 border border-gray-300 focus:border-[var(--pmfu-cobalt)] outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]/20"
        >
          <option value="">— Elegir partido —</option>
          {matches.map((m) => {
            const h = TEAMS_BY_TLA[m.homeTeam.tla];
            const a = TEAMS_BY_TLA[m.awayTeam.tla];
            const label = `#${m.matchNumber ?? "?"} · ${h?.name ?? m.homeTeam.name} vs ${a?.name ?? m.awayTeam.name} · ${m.status}`;
            return (
              <option key={m.id} value={m.id}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      {selected && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <TeamColumn tla={selected.homeTeam.tla} />
            <span className="text-xs font-bold text-gray-700">VS</span>
            <TeamColumn tla={selected.awayTeam.tla} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ScoreStepper value={home} onChange={setHome} label="Local" />
            <ScoreStepper value={away} onChange={setAway} label="Visitante" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <input
                type="checkbox"
                checked={usePenalties}
                onChange={(e) => setUsePenalties(e.target.checked)}
                className="w-4 h-4"
              />
              Definir por penales (solo si empata en 90&apos;/extra)
            </label>
            {usePenalties && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <ScoreStepper
                  value={homePen ?? 0}
                  onChange={(v) => setHomePen(v)}
                  label="Penales L"
                />
                <ScoreStepper
                  value={awayPen ?? 0}
                  onChange={(v) => setAwayPen(v)}
                  label="Penales V"
                />
              </div>
            )}
          </div>

          <Button onClick={handleOverride} loading={saving} variant="danger">
            Sobrescribir marcador y recalcular puntos
          </Button>

          {msg && (
            <p
              className={
                "text-sm font-semibold " +
                (msg.type === "ok"
                  ? "text-[var(--pmfu-mint)]"
                  : "text-[var(--pmfu-magenta)]")
              }
            >
              {msg.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function TeamColumn({ tla }: { tla: string }) {
  const team = TEAMS_BY_TLA[tla];
  if (!team) {
    return (
      <div className="flex items-center gap-2 justify-center text-sm text-gray-700 italic">
        Por definir
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 justify-center">
      <Flag iso2={team.iso2} size={28} alt={team.name} />
      <span className="font-bold text-gray-900 truncate text-sm">
        {team.name}
      </span>
    </div>
  );
}
