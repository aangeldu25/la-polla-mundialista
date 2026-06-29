import { NextResponse } from "next/server";
import { fetchDetailedStats } from "@/lib/stats/wcDataset";

// Estadísticas detalladas (posesión, tarjetas, faltas, disparos, xG…).
// Fuente confirmada: dataset comunitario de GitHub (ver wcDataset.ts).
//
// PUNTO ENCHUFABLE: cuando validemos en el deploy que la API oficial FIFA
// (givevoicetofootball / api.fifa.com) entrega estas métricas POBLADAS, basta
// con anteponer aquí un fetchFifaOfficialDetailedStats() y caer al dataset si
// vuelve null. Hoy la oficial llega vacía, así que usamos el dataset.
export const revalidate = 1800;

export async function GET() {
  try {
    const stats = await fetchDetailedStats();
    if (!stats) {
      return NextResponse.json({ ok: false, error: "sin datos" }, { status: 200 });
    }
    return NextResponse.json(
      { ok: true, source: "dataset", ...stats },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
