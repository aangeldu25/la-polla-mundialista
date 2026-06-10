"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";



interface MetricsResponse {
  ok: boolean;
  totalUsers?: number;
  totalPredictions?: number;
  totalSpecialPredictions?: number;
  totalPointsAwarded?: number;
  matchesByStatus?: Record<string, number>;
  predictionsByMatch?: Array<{
    matchId: string;
    matchNumber?: number;
    summary: string;
    count: number;
  }>;
  topUsers?: Array<{
    uid: string;
    displayName: string;
    totalPoints: number;
    exactScoreHits: number;
  }>;
  duplicateEmails?: Array<{ email: string; count: number; uids: string[] }>;
  error?: string;
}

export function MetricsSection() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as MetricsResponse;
      setData(json);
    } catch (e) {
      setData({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">📊 Métricas</h2>
      <p className="text-sm text-gray-800 font-medium mb-4">
        Resumen de actividad: usuarios, predicciones, puntos otorgados, top de
        partidos predichos, y detección de cuentas duplicadas.
      </p>
      <Button onClick={load} loading={loading} variant="secondary">
        Cargar métricas
      </Button>

      {data?.ok && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Usuarios" value={data.totalUsers ?? 0} />
          <Stat label="Predicciones" value={data.totalPredictions ?? 0} />
          <Stat
            label="Quinielas extras"
            value={data.totalSpecialPredictions ?? 0}
          />
          <Stat label="Puntos totales" value={data.totalPointsAwarded ?? 0} />
        </div>
      )}

      {data?.matchesByStatus && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs">
          <p className="font-bold text-gray-900 mb-2">Partidos por status</p>
          <p className="font-mono text-gray-800">
            {Object.entries(data.matchesByStatus)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </p>
        </div>
      )}

      {data?.predictionsByMatch && data.predictionsByMatch.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-gray-900 mb-2">
            🔥 Top 10 partidos con más predicciones
          </p>
          <ul className="text-xs space-y-1 bg-gray-50 border border-gray-200 rounded-xl p-3">
            {data.predictionsByMatch.map((m) => (
              <li
                key={m.matchId}
                className="flex justify-between text-gray-800"
              >
                <span>
                  #{m.matchNumber ?? "?"} {m.summary}
                </span>
                <strong className="text-[var(--pmfu-cobalt)]">
                  {m.count}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.topUsers && data.topUsers.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-gray-900 mb-2">
            🏆 Top 10 usuarios
          </p>
          <ul className="text-xs space-y-1 bg-gray-50 border border-gray-200 rounded-xl p-3">
            {data.topUsers.map((u, i) => (
              <li key={u.uid} className="flex justify-between text-gray-800">
                <span>
                  #{i + 1} {u.displayName}
                </span>
                <span className="text-gray-600">
                  {u.totalPoints} pts · 🎯 {u.exactScoreHits}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.duplicateEmails && data.duplicateEmails.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-[var(--pmfu-magenta)] mb-2">
            ⚠️ Emails con cuentas duplicadas
          </p>
          <ul className="text-xs space-y-2 bg-red-50 border border-red-200 rounded-xl p-3">
            {data.duplicateEmails.map((d) => (
              <li key={d.email} className="text-gray-900">
                <strong>{d.email}</strong> · {d.count} cuentas
                <div className="text-[10px] text-gray-700 font-mono break-all mt-0.5">
                  {d.uids.join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && !data.ok && (
        <p className="mt-3 text-sm font-semibold text-[var(--pmfu-magenta)]">
          {data.error}
        </p>
      )}

      <CleanupOrphansButton />
    </section>
  );
}

function CleanupOrphansButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function handleCleanup() {
    if (!auth.currentUser) return;
    if (
      !confirm(
        "Esto borra permanentemente las predicciones y quinielas de cuentas que ya no existen en /users (residuos de cuentas duplicadas). ¿Continuar?",
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/cleanup-orphans", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult({
        ok: true,
        text: `Borradas ${data.deletedPredictions} predicciones y ${data.deletedSpecials} quinielas huérfanas de ${data.uniqueOrphanUids} cuentas fantasma.`,
      });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <p className="text-sm font-bold text-gray-900 mb-1">
        🧹 Limpiar datos huérfanos
      </p>
      <p className="text-xs text-gray-700 mb-3">
        Borra predicciones de cuentas que ya no existen (residuos de las
        cuentas duplicadas de pruebas iniciales).
      </p>
      <Button onClick={handleCleanup} loading={loading} variant="danger">
        Borrar huérfanos
      </Button>
      {result && (
        <p
          className={
            "mt-2 text-sm font-semibold " +
            (result.ok
              ? "text-[var(--pmfu-mint)]"
              : "text-[var(--pmfu-magenta)]")
          }
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}
