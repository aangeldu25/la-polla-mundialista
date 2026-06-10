import { format } from "date-fns";
import { es } from "date-fns/locale";
import { adminDb } from "@/lib/firebase/admin";
import { sendEmail, buildReminderEmailHtml } from "./email";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { venueForMatch } from "@/lib/constants/wc2026-fixture-venues";
import type {
  Match,
  MatchPrediction,
  UserProfile,
} from "@/types/domain";

export interface ReminderRunResult {
  windowStart: string;
  windowEnd: string;
  matchesEvaluated: number;
  matchesNotified: number;
  totalUsersNotified: number;
  details: Array<{
    matchId: string;
    summary: string;
    usersNeeded: number;
    notified: number;
    errors: string[];
  }>;
}

// Llamada por el cron cada ~15 min. Envía emails de recordatorio para
// partidos que empiezan en 25-40 minutos a usuarios con predicción pendiente.
// (Con cron cada 15 min, esta ventana garantiza que cada partido se notifique
// exactamente una vez, ~30 min antes del kickoff.)
export async function sendKickoffReminders(): Promise<ReminderRunResult> {
  const now = Date.now();
  const windowStart = new Date(now + 25 * 60 * 1000);
  const windowEnd = new Date(now + 40 * 60 * 1000);
  const result: ReminderRunResult = {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    matchesEvaluated: 0,
    matchesNotified: 0,
    totalUsersNotified: 0,
    details: [],
  };

  // Partidos próximos en la ventana
  const matchesSnap = await adminDb.collection("matches").get();
  const allMatches = matchesSnap.docs.map(
    (d) =>
      ({ ...(d.data() as Match), _kickoffNotified: (d.data() as { kickoffNotified?: boolean }).kickoffNotified }) as Match & { _kickoffNotified?: boolean },
  );
  const upcoming = allMatches.filter((m) => {
    if (m.status !== "SCHEDULED") return false;
    if (m._kickoffNotified) return false;
    const t = new Date(m.utcDate).getTime();
    return t >= windowStart.getTime() && t < windowEnd.getTime();
  });
  result.matchesEvaluated = upcoming.length;

  if (upcoming.length === 0) return result;

  // Todos los usuarios
  const usersSnap = await adminDb.collection("users").get();
  const users = usersSnap.docs.map((d) => d.data() as UserProfile);

  for (const match of upcoming) {
    const predsSnap = await adminDb
      .collection("predictions")
      .where("matchId", "==", match.id)
      .get();
    const predictedUids = new Set(
      predsSnap.docs.map((d) => (d.data() as MatchPrediction).uid),
    );

    const usersToNotify = users.filter((u) => !predictedUids.has(u.uid));

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

    const errors: string[] = [];
    let notified = 0;

    for (const user of usersToNotify) {
      if (!user.email) continue;
      const kickoffStr = format(kickoff, "EEEE d 'de' MMMM, h:mm a", {
        locale: es,
      });
      const r = await sendEmail({
        to: user.email,
        subject: `⚡ ${summary} en 30 minutos — predice tu marcador`,
        html: buildReminderEmailHtml({
          userName: user.displayName,
          matchSummary: summary,
          kickoffStr,
          venue: venueLine,
        }),
      });
      if (!r.ok && r.error !== "resend-not-configured") {
        errors.push(`email:${user.uid}:${r.error}`);
      } else if (r.ok) {
        notified++;
      }
    }

    // Marcar el partido como notificado para no re-enviar en el siguiente tick
    await adminDb
      .collection("matches")
      .doc(match.id)
      .update({ kickoffNotified: true });

    result.matchesNotified++;
    result.totalUsersNotified += notified;
    result.details.push({
      matchId: match.id,
      summary,
      usersNeeded: usersToNotify.length,
      notified,
      errors: errors.slice(0, 3),
    });
  }

  return result;
}
