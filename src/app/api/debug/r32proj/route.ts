import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { computeRealKnockoutProjection } from "@/lib/stats/r32-projection";
import type { Match } from "@/types/domain";

// TEMPORAL: dump de la proyección real de eliminatorias para diagnosticar.
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await adminDb.collection("matches").get();
  const all = snap.docs.map((d) => d.data() as Match);
  const proj = computeRealKnockoutProjection(all);
  const out: Record<number, unknown> = {};
  for (let n = 73; n <= 88; n++) out[n] = proj.get(n) ?? null;
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
