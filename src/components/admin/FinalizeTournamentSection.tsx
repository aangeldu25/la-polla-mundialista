"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { PlayerSelect } from "@/components/predictions/PlayerSelect";
import { Button } from "@/components/ui/Button";

interface FinalizeResponse {
  ok: boolean;
  processedUsers?: number;
  totalPointsAwarded?: number;
  actualResults?: {
    champion: string | null;
    runnerUp: string | null;
    third: string | null;
    topScorerName: string | null;
    goldenBallName: string | null;
    goldenGloveName: string | null;
  };
  error?: string;
}

export function FinalizeTournamentSection() {
  const [topScorer, setTopScorer] = useState<string | null>(null);
  const [goldenBall, setGoldenBall] = useState<string | null>(null);
  const [goldenGlove, setGoldenGlove] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<FinalizeResponse | null>(null);

  async function handleFinalize() {
    if (!auth.currentUser) return;
    if (
      !confirm(
        "Esto va a calcular y otorgar los puntos de las quinielas especiales para TODOS los usuarios. ¿Continuar?",
      )
    ) {
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/finalize-tournament", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topScorerName: topScorer,
          goldenBallName: goldenBall,
          goldenGloveName: goldenGlove,
        }),
      });
      const data = (await res.json()) as FinalizeResponse;
      if (!res.ok) throw new Error(data.error ?? "Error");
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        🏆 Finalizar torneo
      </h2>
      <p className="text-sm text-gray-800 font-medium mb-1">
        Ejecuta UNA VEZ al final del torneo, después de:
      </p>
      <ul className="text-xs text-gray-700 font-medium list-disc pl-5 mb-4 space-y-1">
        <li>Partido 103 (Tercer puesto) terminado y procesado</li>
        <li>Partido 104 (Final) terminado y procesado</li>
        <li>FIFA anunció Goleador, Balón de Oro y Guante de Oro</li>
      </ul>
      <p className="text-xs text-gray-700 mb-4">
        Campeón, Subcampeón y Tercer puesto se calculan automáticamente desde
        los resultados reales de los partidos 104 y 103. Solo necesitas
        ingresar los premios individuales abajo.
      </p>

      <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <PlayerSelect
          value={topScorer}
          onChange={setTopScorer}
          label="⚽ Goleador del torneo (real)"
        />
        <PlayerSelect
          value={goldenBall}
          onChange={setGoldenBall}
          label="🌟 Balón de Oro (mejor jugador)"
        />
        <PlayerSelect
          value={goldenGlove}
          onChange={setGoldenGlove}
          label="🧤 Guante de Oro (mejor portero)"
          goalkeepersOnly
        />
      </div>

      <div className="mt-4">
        <Button onClick={handleFinalize} loading={saving} variant="danger">
          Finalizar torneo y calcular puntos especiales
        </Button>
      </div>

      {result && (
        <div
          className={
            "mt-4 rounded-xl p-4 text-sm border " +
            (result.ok
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200")
          }
        >
          {result.ok ? (
            <>
              <p className="font-bold text-green-900 mb-2">
                ✅ {result.processedUsers} usuarios procesados ·{" "}
                {result.totalPointsAwarded} pts otorgados
              </p>
              {result.actualResults && (
                <ul className="text-xs text-gray-800 space-y-0.5">
                  <li>
                    🥇 Campeón: <strong>{result.actualResults.champion ?? "—"}</strong>
                  </li>
                  <li>
                    🥈 Subcampeón:{" "}
                    <strong>{result.actualResults.runnerUp ?? "—"}</strong>
                  </li>
                  <li>
                    🥉 Tercer puesto:{" "}
                    <strong>{result.actualResults.third ?? "—"}</strong>
                  </li>
                </ul>
              )}
            </>
          ) : (
            <p className="font-bold text-red-900">❌ {result.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
