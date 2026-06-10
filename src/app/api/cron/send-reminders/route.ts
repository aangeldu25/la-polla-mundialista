import { NextResponse } from "next/server";
import { sendKickoffReminders } from "@/lib/notifications/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/cron/send-reminders
// Header: Authorization: Bearer <CRON_SECRET>
// Idealmente corre cada 15 minutos vía Cloud Scheduler.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendKickoffReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const err = e as Error;
    console.error("[send-reminders]", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 },
    );
  }
}
