import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { scoreAllFinishedMatches } from "@/lib/scoring/match-scoring";
import { ADMIN_EMAIL } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const result = await scoreAllFinishedMatches({ force });
    return NextResponse.json({ ok: true, force, ...result });
  } catch (e) {
    const err = e as Error;
    console.error("[recalc-points] error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
