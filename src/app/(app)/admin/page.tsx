"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OverrideMatchSection } from "@/components/admin/OverrideMatchSection";
import { FinalizeTournamentSection } from "@/components/admin/FinalizeTournamentSection";
import { MetricsSection } from "@/components/admin/MetricsSection";
import { TestReminderSection } from "@/components/admin/TestReminderSection";

interface FixtureMeta {
  lastRunAt?: string;
  total?: number;
  created?: number;
  updated?: number;
  bracketSeeded?: number;
  labelsAssigned?: number;
  stagesFromApi?: Record<string, number>;
  rawStagesSeen?: string[];
}

interface SyncResponse {
  ok: boolean;
  total?: number;
  created?: number;
  updated?: number;
  bracketSeeded?: number;
  labelsAssigned?: number;
  stagesFromApi?: Record<string, number>;
  rawStagesSeen?: string[];
  sample?: Array<{
    id: string;
    matchNumber?: number;
    stage: string;
    group?: string;
    homeName: string;
    homeLabel?: string;
    awayName: string;
    awayLabel?: string;
    venue?: string;
    city?: string;
    utcDate: string;
  }>;
  error?: string;
}

export default function AdminPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [response, setResponse] = useState<SyncResponse | null>(null);
  const [meta, setMeta] = useState<FixtureMeta | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [recalcErr, setRecalcErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile && !profile.isAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile?.isAdmin) return;
    const ref = doc(db, "meta", "fixtureSync");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setMeta(snap.data() as FixtureMeta);
    });
    return () => unsub();
  }, [profile?.isAdmin]);

  async function handleSync() {
    if (!auth.currentUser) return;
    setSyncing(true);
    setResponse(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/force-sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as SyncResponse;
      setResponse(data);
    } catch (e) {
      const err = e as Error;
      setResponse({ ok: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  async function handleRecalc(force: boolean) {
    if (!auth.currentUser) return;
    setRecalcing(true);
    setRecalcMsg(null);
    setRecalcErr(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const url = force
        ? "/api/admin/recalc-points?force=1"
        : "/api/admin/recalc-points";
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setRecalcMsg(
        `OK: ${data.matchesProcessed} partidos procesados · ${data.totalPointsAwarded} puntos otorgados${force ? " (recalculados desde cero)" : ""}`,
      );
    } catch (e) {
      const err = e as Error;
      setRecalcErr(err.message);
    } finally {
      setRecalcing(false);
    }
  }

  if (loading || !profile?.isAdmin) return null;

  return (
    <main className="px-6 py-10 max-w-3xl mx-auto w-full">
      <Card>
        <CardHeader
          title="Panel de Admin"
          subtitle="Diagnóstico del sync + acciones de mantenimiento."
        />

        <section className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Fixture Mundial 2026
          </h2>
          <p className="text-sm text-gray-800 font-medium mb-4">
            Cloud Scheduler corre cada 5 min. Este botón es solo para forzar
            una sincronización inmediata y ver el diagnóstico.
          </p>

          <Button onClick={handleSync} loading={syncing}>
            Sincronizar ahora y ver diagnóstico
          </Button>

          {meta?.lastRunAt && !response && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-gray-900">Último sync</p>
              <p className="font-mono text-gray-800 text-xs">
                {new Date(meta.lastRunAt).toLocaleString("es-CO")}
              </p>
              <p className="text-gray-800 mt-2">
                {meta.total} partidos · {meta.created ?? 0} creados ·{" "}
                {meta.updated ?? 0} actualizados ·{" "}
                {meta.bracketSeeded ?? 0} R32 sembrados ·{" "}
                {meta.labelsAssigned ?? 0} labels asignados
              </p>
              {meta.stagesFromApi && (
                <p className="text-xs text-gray-700 mt-2">
                  Fases del API:{" "}
                  {Object.entries(meta.stagesFromApi)
                    .map(([s, n]) => `${s}=${n}`)
                    .join(" · ")}
                </p>
              )}
              {meta.rawStagesSeen && meta.rawStagesSeen.length > 0 && (
                <p className="text-xs text-gray-700 mt-1 font-mono">
                  Stages crudos: {meta.rawStagesSeen.join(", ")}
                </p>
              )}
            </div>
          )}

          {response && (
            <div
              className={
                "mt-4 rounded-xl p-4 text-sm border " +
                (response.ok
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200")
              }
            >
              {response.ok ? (
                <>
                  <p className="font-bold text-green-900 mb-2">
                    ✅ Sync OK ({response.total} partidos)
                  </p>
                  <ul className="text-gray-900 text-xs space-y-0.5">
                    <li>📥 {response.created} creados</li>
                    <li>♻️ {response.updated} actualizados</li>
                    <li>🌱 {response.bracketSeeded} R32 sembrados</li>
                    <li>🏷️ {response.labelsAssigned} labels bracket asignados</li>
                  </ul>
                  {response.stagesFromApi && (
                    <p className="text-xs text-gray-800 mt-3 font-mono">
                      <strong>Fases del API:</strong>{" "}
                      {Object.entries(response.stagesFromApi)
                        .map(([s, n]) => `${s}=${n}`)
                        .join(" · ")}
                    </p>
                  )}
                  {response.rawStagesSeen && (
                    <p className="text-xs text-gray-800 mt-1 font-mono">
                      <strong>Stages crudos (Football-Data):</strong>{" "}
                      {response.rawStagesSeen.join(", ")}
                    </p>
                  )}
                  {response.sample && response.sample.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-gray-900 font-semibold text-xs">
                        Sample de partidos (click para expandir)
                      </summary>
                      <pre className="mt-2 text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-96">
                        {JSON.stringify(response.sample, null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-red-900">❌ Error</p>
                  <p className="text-red-800 text-xs mt-1 font-mono">
                    {response.error}
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="border-t border-gray-200 pt-6 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Puntuación y ranking
          </h2>
          <p className="text-sm text-gray-800 font-medium mb-4">
            Los puntos se calculan automáticamente al terminar cada partido
            (en cada corrida del sync). Estos botones son para casos de fallo
            o corrección manual.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleRecalc(false)}
              loading={recalcing}
              variant="secondary"
            >
              Procesar partidos pendientes
            </Button>
            <Button
              onClick={() => {
                if (
                  confirm(
                    "Esto recalcula desde cero TODOS los partidos terminados y ajusta los totales de cada usuario. ¿Continuar?",
                  )
                ) {
                  handleRecalc(true);
                }
              }}
              loading={recalcing}
              variant="danger"
            >
              Recalcular todo desde cero
            </Button>
          </div>
          {recalcMsg && (
            <p className="mt-3 text-sm text-[var(--pmfu-mint)] font-semibold">
              {recalcMsg}
            </p>
          )}
          {recalcErr && (
            <p className="mt-3 text-sm text-[var(--pmfu-magenta)] font-semibold">
              {recalcErr}
            </p>
          )}
        </section>

        <OverrideMatchSection />
        <TestReminderSection />
        <FinalizeTournamentSection />
        <MetricsSection />
      </Card>
    </main>
  );
}
