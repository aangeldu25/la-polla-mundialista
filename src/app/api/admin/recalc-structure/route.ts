import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { scoreAllStructure } from "@/lib/scoring/structure-scoring";
import { ADMIN_EMAIL } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/admin/recalc-structure
// Re-calcula los puntos de estructura del bracket para todos los usuarios.
// Útil después de cambios manuales en /admin (override de marcadores) que
// puedan haber alterado quién avanza a la siguiente ronda.
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
    const result = await scoreAllStructure();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const err = e as Error;
    console.error("[recalc-structure]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
