import { adminDb } from "@/lib/firebase/admin";
import { matchesToIcs } from "@/lib/calendar/ical";
import type { Match } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

// URL pública que cualquiera puede suscribir desde Google Calendar,
// Apple Calendar, Outlook, etc. para tener el fixture siempre actualizado.
export async function GET() {
  const snap = await adminDb
    .collection("matches")
    .orderBy("utcDate", "asc")
    .get();
  const all = snap.docs.map((d) => d.data() as Match);
  // Filtramos basura igual que en el cliente
  const valid = all.filter(
    (m) =>
      m.matchNumber !== undefined ||
      !!(m.homeTeam.tla && m.awayTeam.tla),
  );
  // Dedupe básico por matchNumber
  const seen = new Set<string>();
  const dedup: Match[] = [];
  for (const m of valid) {
    const key =
      m.matchNumber !== undefined ? `MN:${m.matchNumber}` : `ID:${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(m);
  }

  const ics = matchesToIcs(dedup);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="mundial-2026-pmfu.ics"',
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
