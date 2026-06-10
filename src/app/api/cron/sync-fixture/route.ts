import { NextResponse } from "next/server";
import { syncFixture } from "@/lib/footballData/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Endpoint que Vercel Cron llama. Vercel firma con header
// `Authorization: Bearer <CRON_SECRET>`. También permitimos llamadas con el
// mismo secreto desde otros schedulers (Cloud Scheduler, etc.).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncFixture();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const err = e as Error;
    console.error("[sync-fixture] error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
