import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ADMIN_EMAIL } from "@/lib/utils";
import type { Match, MatchPrediction, UserProfile } from "@/types/domain";

export const dynamic = "force-dynamic";

interface MetricsResponse {
  totalUsers: number;
  totalPredictions: number;
  totalSpecialPredictions: number;
  totalPointsAwarded: number;
  matchesByStatus: Record<string, number>;
  predictionsByMatch: Array<{
    matchId: string;
    matchNumber?: number;
    summary: string;
    count: number;
  }>;
  topUsers: Array<{
    uid: string;
    displayName: string;
    totalPoints: number;
    exactScoreHits: number;
  }>;
  duplicateEmails: Array<{ email: string; count: number; uids: string[] }>;
}

export async function GET(req: Request) {
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

    const [usersSnap, predsSnap, specialsSnap, matchesSnap] =
      await Promise.all([
        adminDb.collection("users").get(),
        adminDb.collection("predictions").get(),
        adminDb.collection("specialPredictions").get(),
        adminDb.collection("matches").get(),
      ]);

    const users = usersSnap.docs.map((d) => d.data() as UserProfile);
    const preds = predsSnap.docs.map((d) => d.data() as MatchPrediction);
    const matches = matchesSnap.docs.map((d) => d.data() as Match);

    // Status counts
    const matchesByStatus: Record<string, number> = {};
    for (const m of matches) {
      matchesByStatus[m.status] = (matchesByStatus[m.status] ?? 0) + 1;
    }

    // Predicciones por partido (top 10 con más)
    const predsByMatchId = new Map<string, number>();
    for (const p of preds) {
      predsByMatchId.set(p.matchId, (predsByMatchId.get(p.matchId) ?? 0) + 1);
    }
    const predictionsByMatch = [...predsByMatchId.entries()]
      .map(([matchId, count]) => {
        const match = matches.find((m) => m.id === matchId);
        return {
          matchId,
          matchNumber: match?.matchNumber,
          summary: match
            ? `${match.homeTeam.tla || "?"} vs ${match.awayTeam.tla || "?"}`
            : matchId,
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top usuarios
    const topUsers = [...users]
      .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
      .slice(0, 10)
      .map((u) => ({
        uid: u.uid,
        displayName: u.displayName,
        totalPoints: u.totalPoints ?? 0,
        exactScoreHits: u.exactScoreHits ?? 0,
      }));

    // Emails duplicados (cuentas multi-OAuth)
    const emailCount = new Map<string, string[]>();
    for (const u of users) {
      if (!u.email) continue;
      const e = u.email.toLowerCase().trim();
      const arr = emailCount.get(e) ?? [];
      arr.push(u.uid);
      emailCount.set(e, arr);
    }
    const duplicateEmails = [...emailCount.entries()]
      .filter(([, uids]) => uids.length > 1)
      .map(([email, uids]) => ({ email, count: uids.length, uids }));

    const totalPointsAwarded = users.reduce(
      (s, u) => s + (u.totalPoints ?? 0),
      0,
    );

    const response: MetricsResponse = {
      totalUsers: users.length,
      totalPredictions: preds.length,
      totalSpecialPredictions: specialsSnap.size,
      totalPointsAwarded,
      matchesByStatus,
      predictionsByMatch,
      topUsers,
      duplicateEmails,
    };

    return NextResponse.json({ ok: true, ...response });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
