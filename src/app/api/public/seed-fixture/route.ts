import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { syncFixture } from "@/lib/footballData/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Endpoint público idempotente: si la base de partidos está vacía,
// dispara la sincronización inicial desde Football-Data.
// No requiere auth porque solo actúa cuando NO hay datos (rate-limited
// implícitamente por la lógica de "ya hay matches").
export async function GET() {
  try {
    const snap = await adminDb.collection("matches").limit(1).get();
    if (!snap.empty) {
      return NextResponse.json({
        ok: true,
        seeded: false,
        message: "Fixture ya inicializado",
      });
    }
    const result = await syncFixture();
    return NextResponse.json({ ok: true, seeded: true, ...result });
  } catch (e) {
    const err = e as Error;
    console.error("[seed-fixture] error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
