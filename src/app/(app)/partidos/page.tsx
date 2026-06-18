"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyPredictions } from "@/hooks/usePredictions";
import type { Match, MatchStage } from "@/types/domain";
import { STAGE_LABEL_ES, STAGE_ORDER } from "@/lib/constants/stages";
import { MatchCard } from "@/components/partidos/MatchCard";
import { PredictionModal } from "@/components/predictions/PredictionModal";
import { SubscribeCalendarCard } from "@/components/calendar/SubscribeCalendarCard";
import { cn } from "@/lib/utils";

type Filter =
  | "ALL"
  | "UPCOMING"
  | "LIVE"
  | "FINISHED"
  | "PENDIENTES"
  | "LISTOS"
  | MatchStage;

// Cuántos partidos hay en cada fase del Mundial 2026.
const STAGE_LIMITS: Record<MatchStage, number> = {
  GROUP: 72,
  ROUND_OF_32: 16,
  ROUND_OF_16: 8,
  QUARTER_FINAL: 4,
  SEMI_FINAL: 2,
  THIRD_PLACE: 1,
  FINAL: 1,
};

// "Calidad" del partido para priorizar al deduplicar:
// 1000 = tiene equipos definidos, 100 = tiene matchNumber, 10 = tiene label.
function matchQuality(m: Match): number {
  let score = 0;
  if (m.homeTeam.tla && m.awayTeam.tla) score += 1000;
  if (m.matchNumber !== undefined) score += 100;
  if (m.homeLabel || m.awayLabel) score += 10;
  return score;
}

// Consolida la lista de Firestore en exactamente 104 partidos (o menos si
// faltan datos). Maneja duplicados, partidos basura y dedup por fase.
function consolidateMatches(all: Match[]): Match[] {
  const validStages: MatchStage[] = [
    "GROUP",
    "ROUND_OF_32",
    "ROUND_OF_16",
    "QUARTER_FINAL",
    "SEMI_FINAL",
    "THIRD_PLACE",
    "FINAL",
  ];
  // 1) Descartar docs sin fase válida.
  const withStage = all.filter((m) => validStages.includes(m.stage));

  // 2) Agrupar por fase.
  const byStage = new Map<MatchStage, Match[]>();
  for (const m of withStage) {
    const arr = byStage.get(m.stage) ?? [];
    arr.push(m);
    byStage.set(m.stage, arr);
  }

  const final: Match[] = [];
  for (const [stage, list] of byStage) {
    // 3) Ordenar por calidad desc, luego matchNumber asc, luego fecha asc.
    const sorted = [...list].sort((a, b) => {
      const q = matchQuality(b) - matchQuality(a);
      if (q !== 0) return q;
      const an = a.matchNumber ?? 9999;
      const bn = b.matchNumber ?? 9999;
      if (an !== bn) return an - bn;
      return a.utcDate.localeCompare(b.utcDate);
    });

    // 4) Tomar hasta el límite, deduplicando por matchNumber o por pareja.
    const limit = STAGE_LIMITS[stage] ?? list.length;
    const seenKeys = new Set<string>();
    const taken: Match[] = [];
    for (const m of sorted) {
      if (taken.length >= limit) break;
      const key =
        m.matchNumber !== undefined
          ? `MN:${m.matchNumber}`
          : `${m.utcDate}|${m.homeTeam.tla}|${m.awayTeam.tla}|${m.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      taken.push(m);
    }
    final.push(...taken);
  }

  return final.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
}

export default function PartidosPage() {
  const { user } = useAuth();
  const { predictions } = useMyPredictions(user?.uid);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("UPCOMING");
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  // Tick que se actualiza cada 30s para refrescar filtros que dependen del tiempo.
  // Inicializamos en 0 y lo seteamos en un effect — Date.now() en useState init
  // es impuro y rompe SSR/hydration.
  const [nowTick, setNowTick] = useState(0);
  const [selected, setSelected] = useState<Match | null>(null);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => d.data() as Match);
        setMatches(consolidateMatches(all));
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "meta", "fixtureSync"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { lastRunAt?: string };
        setLastSync(data.lastRunAt ?? null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setNowTick(Date.now()); // Set actual time after mount
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Disparo único de seed cuando no hay partidos. Usamos un ref en vez de
  // useState para evitar setState dentro de un effect (regla de React 19).
  const seededRef = useRef(false);
  useEffect(() => {
    if (loading || seededRef.current || matches.length > 0) return;
    seededRef.current = true;
    fetch("/api/public/seed-fixture").catch(() => {});
  }, [loading, matches.length]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return matches;
    if (filter === "UPCOMING")
      return matches.filter(
        (m) => m.status === "SCHEDULED" || m.status === "LIVE",
      );
    if (filter === "LIVE") return matches.filter((m) => m.status === "LIVE");
    if (filter === "FINISHED")
      return matches.filter((m) => m.status === "FINISHED");
    if (filter === "PENDIENTES")
      return matches.filter(
        (m) =>
          m.status === "SCHEDULED" &&
          new Date(m.utcDate).getTime() > nowTick &&
          !predictions.get(m.id),
      );
    if (filter === "LISTOS")
      return matches.filter(
        (m) =>
          m.status === "SCHEDULED" &&
          new Date(m.utcDate).getTime() > nowTick &&
          !!predictions.get(m.id),
      );
    return matches.filter((m) => m.stage === filter);
  }, [matches, filter, predictions, nowTick]);

  const grouped = useMemo(() => {
    const map = new Map<MatchStage, Match[]>();
    for (const m of filtered) {
      const arr = map.get(m.stage) ?? [];
      arr.push(m);
      map.set(m.stage, arr);
    }
    // El orden de las etapas se mantiene igual (Grupos → Final). En
    // "Terminados" solo invertimos los partidos DENTRO de cada etapa para
    // mostrar el más reciente primero.
    const entries = [...map.entries()].sort(
      ([a], [b]) => STAGE_ORDER[a] - STAGE_ORDER[b],
    );
    if (filter === "FINISHED") {
      for (const [, arr] of entries) {
        arr.sort((a, b) => b.utcDate.localeCompare(a.utcDate));
      }
    }
    return entries;
  }, [filtered, filter]);

  const pendingCount = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.status === "SCHEDULED" &&
          new Date(m.utcDate).getTime() > nowTick &&
          !predictions.get(m.id),
      ).length,
    [matches, predictions, nowTick],
  );

  const readyCount = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.status === "SCHEDULED" &&
          new Date(m.utcDate).getTime() > nowTick &&
          !!predictions.get(m.id),
      ).length,
    [matches, predictions, nowTick],
  );

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-6 py-10 max-w-3xl mx-auto">
        <div className="pmfu-glass rounded-2xl p-6 text-center">
          <p className="text-[var(--pmfu-magenta)] font-semibold">{error}</p>
        </div>
      </main>
    );
  }

  if (matches.length === 0) {
    return (
      <main className="px-6 py-10 max-w-3xl mx-auto">
        <div className="pmfu-glass rounded-2xl p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Cargando fixture...
          </h1>
          <p className="text-gray-800 mb-4">
            Estamos sincronizando los 104 partidos del Mundial 2026.
          </p>
          <div className="w-8 h-8 mx-auto border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 md:px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Partidos
        </h1>
        <p className="text-gray-800 font-medium mt-1">
          {matches.length} partidos · zona horaria local
          {lastSync && (
            <>
              {" · "}
              <span className="text-gray-700">
                actualizado hace{" "}
                {formatDistanceToNow(new Date(lastSync), { locale: es })}
              </span>
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold">
          {pendingCount > 0 && (
            <span className="text-[var(--pmfu-orange)]">
              ⚡ {pendingCount} pendientes
            </span>
          )}
          {readyCount > 0 && (
            <span className="text-[var(--pmfu-mint)]">
              ✓ {readyCount} listas
            </span>
          )}
        </div>
      </div>
      <span data-tick={nowTick} className="sr-only" />

      <div className="mb-4">
        <SubscribeCalendarCard />
      </div>

      <FilterTabs
        filter={filter}
        setFilter={setFilter}
        matches={matches}
        pendingCount={pendingCount}
        readyCount={readyCount}
      />

      <div className="mt-6 flex flex-col gap-8">
        {grouped.map(([stage, ms]) => (
          <section key={stage}>
            <h2 className="text-sm uppercase tracking-widest text-[var(--pmfu-cobalt)] font-bold mb-3">
              {STAGE_LABEL_ES[stage]}
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {ms.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  prediction={predictions.get(m.id)}
                  onClick={() => setSelected(m)}
                />
              ))}
            </div>
          </section>
        ))}
        {grouped.length === 0 && (
          <p className="text-center text-gray-700 py-12 font-medium">
            No hay partidos con este filtro.
          </p>
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

function FilterTabs({
  filter,
  setFilter,
  matches,
  pendingCount,
  readyCount,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  matches: Match[];
  pendingCount: number;
  readyCount: number;
}) {
  const liveCount = matches.filter((m) => m.status === "LIVE").length;
  const tabs: { key: Filter; label: string }[] = [
    {
      key: "PENDIENTES",
      label: pendingCount > 0 ? `⚡ Pendientes (${pendingCount})` : "Pendientes",
    },
    {
      key: "LISTOS",
      label: readyCount > 0 ? `✓ Listas (${readyCount})` : "Listas",
    },
    { key: "UPCOMING", label: "Próximos" },
    { key: "LIVE", label: liveCount > 0 ? `🔴 En vivo (${liveCount})` : "En vivo" },
    { key: "FINISHED", label: "Terminados" },
    { key: "GROUP", label: "Grupos" },
    { key: "ROUND_OF_32", label: "Dieciseisavos" },
    { key: "ROUND_OF_16", label: "Octavos" },
    { key: "QUARTER_FINAL", label: "Cuartos" },
    { key: "SEMI_FINAL", label: "Semis" },
    { key: "THIRD_PLACE", label: "Tercer lugar" },
    { key: "FINAL", label: "Final" },
    { key: "ALL", label: "Todos" },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setFilter(t.key)}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
            filter === t.key
              ? "bg-[var(--pmfu-cobalt)] text-white"
              : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-100",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
