import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { scoreSpecials } from "@/lib/scoring/specials-scoring";
import { ADMIN_EMAIL } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/admin/finalize-tournament
// Body: { topScorerName, goldenBallName, goldenGloveName }
// Guarda tournament/results y calcula puntos de quinielas especiales.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 401 });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if ((decoded.email ?? "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }
    const body = (await req.json()) as {
      topScorerName?: string | null;
      goldenBallName?: string | null;
      goldenGloveName?: string | null;
    };

    // Guardar resultados
    await adminDb
      .collection("tournament")
      .doc("results")
      .set(
        {
          topScorerName: body.topScorerName ?? null,
          goldenBallName: body.goldenBallName ?? null,
          goldenGloveName: body.goldenGloveName ?? null,
          isFinalized: false, // scoreSpecials lo marcará como true
          updatedAt: new Date().toISOString(),
          updatedBy: decoded.uid,
        },
        { merge: true },
      );

    // Calcular puntos
    const result = await scoreSpecials();

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const err = e as Error;
    console.error("[finalize-tournament]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
