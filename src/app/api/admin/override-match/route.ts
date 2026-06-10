import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { scoreMatch } from "@/lib/scoring/match-scoring";
import { ADMIN_EMAIL } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/override-match
// Body: { matchId, homeScore, awayScore, homePenalties?, awayPenalties? }
// Marca el partido como FINISHED, fija marcador, y dispara recálculo de puntos.
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
      matchId?: string;
      homeScore?: number;
      awayScore?: number;
      homePenalties?: number | null;
      awayPenalties?: number | null;
    };
    if (!body.matchId) {
      return NextResponse.json(
        { error: "matchId requerido" },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(body.homeScore) ||
      !Number.isInteger(body.awayScore)
    ) {
      return NextResponse.json(
        { error: "homeScore y awayScore deben ser enteros" },
        { status: 400 },
      );
    }

    const ref = adminDb.collection("matches").doc(body.matchId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Partido no encontrado" },
        { status: 404 },
      );
    }

    // Determinar ganador automáticamente
    const home = body.homeScore!;
    const away = body.awayScore!;
    const homePen = body.homePenalties ?? null;
    const awayPen = body.awayPenalties ?? null;
    let winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" = "DRAW";
    if (home > away) winner = "HOME_TEAM";
    else if (away > home) winner = "AWAY_TEAM";
    else if (homePen != null && awayPen != null) {
      winner = homePen > awayPen ? "HOME_TEAM" : "AWAY_TEAM";
    }

    await ref.update({
      status: "FINISHED",
      "score.homeFullTime": home,
      "score.awayFullTime": away,
      "score.homePenalties": homePen,
      "score.awayPenalties": awayPen,
      "score.winner": winner,
      pointsCalculated: false, // Forzamos recálculo
      updatedAt: new Date().toISOString(),
      overrideBy: decoded.uid,
      overrideAt: new Date().toISOString(),
    });

    // Re-calcular puntos con force=true (revierte y recalcula)
    const scoringResult = await scoreMatch(body.matchId, { force: true });

    return NextResponse.json({ ok: true, scoring: scoringResult });
  } catch (e) {
    const err = e as Error;
    console.error("[override-match]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
