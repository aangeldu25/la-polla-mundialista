import { NextResponse } from "next/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendEmail, buildReminderEmailHtml } from "@/lib/notifications/email";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { venueForMatch } from "@/lib/constants/wc2026-fixture-venues";
import { ADMIN_EMAIL } from "@/lib/utils";
import type { Match, UserProfile } from "@/types/domain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/admin/send-test-reminder
// Body: { matchId, recipientEmail? }
// Envía el email de recordatorio con la plantilla real, usando los datos del
// partido elegido. No modifica nada en Firestore — es un test puro.
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
      recipientEmail?: string;
    };
    if (!body.matchId) {
      return NextResponse.json(
        { error: "matchId requerido" },
        { status: 400 },
      );
    }

    const matchSnap = await adminDb
      .collection("matches")
      .doc(body.matchId)
      .get();
    if (!matchSnap.exists) {
      return NextResponse.json(
        { error: "Partido no encontrado" },
        { status: 404 },
      );
    }
    const match = matchSnap.data() as Match;

    // Destinatario: el email pasado en body, o el del admin como default
    let recipient = body.recipientEmail?.trim();
    if (!recipient) {
      const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userSnap.data() as UserProfile | undefined;
      recipient = userData?.email ?? decoded.email ?? ADMIN_EMAIL;
    }

    // Nombre del destinatario (best effort)
    let displayName = "familiar";
    if (decoded.email === recipient) {
      const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userSnap.data() as UserProfile | undefined;
      displayName = userData?.displayName ?? displayName;
    }

    const home = TEAMS_BY_TLA[match.homeTeam.tla];
    const away = TEAMS_BY_TLA[match.awayTeam.tla];
    const homeName = home?.name ?? match.homeTeam.name;
    const awayName = away?.name ?? match.awayTeam.name;
    const summary = `${homeName} vs ${awayName}`;
    const kickoff = new Date(match.utcDate);
    const venueData = venueForMatch(match.matchNumber);
    const venueLine = venueData
      ? `${venueData.stadium}, ${venueData.city}`
      : undefined;

    const result = await sendEmail({
      to: recipient,
      subject: `[PRUEBA] ⚡ ${summary} en 30 minutos`,
      html: buildReminderEmailHtml({
        userName: displayName,
        matchSummary: summary,
        kickoffStr: format(kickoff, "EEEE d 'de' MMMM, h:mm a", { locale: es }),
        venue: venueLine,
      }),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, recipient },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      recipient,
      emailId: result.id,
      match: summary,
    });
  } catch (e) {
    const err = e as Error;
    console.error("[send-test-reminder]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
