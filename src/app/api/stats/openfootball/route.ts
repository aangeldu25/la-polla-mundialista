import { NextResponse } from "next/server";
import { fetchOpenfootballStats } from "@/lib/stats/openfootball";

// Devuelve goleadores + "joyas de goles" desde openfootball.
// Cacheado 15 min a nivel de fetch (revalidate en el módulo) + cache HTTP.
export const revalidate = 900;

export async function GET() {
  try {
    const stats = await fetchOpenfootballStats();
    return NextResponse.json(
      { ok: true, ...stats },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=900, stale-while-revalidate=1800",
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
