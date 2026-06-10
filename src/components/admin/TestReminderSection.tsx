"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Match } from "@/types/domain";

export function TestReminderSection() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => d.data() as Match));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (profile?.email) setRecipient(profile.email);
  }, [profile?.email]);

  async function handleSend() {
    if (!matchId || !auth.currentUser) return;
    setSending(true);
    setMsg(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/send-test-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          matchId,
          recipientEmail: recipient || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Error enviando email de prueba");
      setMsg({
        type: "ok",
        text: `Email enviado a ${data.recipient} (partido: ${data.match})`,
      });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="border-t border-gray-200 pt-6 mt-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        📧 Probar email de recordatorio
      </h2>
      <p className="text-sm text-gray-800 font-medium mb-4">
        Envía el email de recordatorio (la plantilla real con branding PMFU)
        usando los datos de un partido que elijas. No modifica nada en
        Firestore ni dispara el cron real — solo el envío.
      </p>

      <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-900">
            Partido de prueba
          </label>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white text-gray-900 border border-gray-300 focus:border-[var(--pmfu-cobalt)] outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]/20"
          >
            <option value="">— Elegir partido —</option>
            {matches.map((m) => {
              const h = TEAMS_BY_TLA[m.homeTeam.tla];
              const a = TEAMS_BY_TLA[m.awayTeam.tla];
              const home = h?.name ?? m.homeTeam.name;
              const away = a?.name ?? m.awayTeam.name;
              return (
                <option key={m.id} value={m.id}>
                  #{m.matchNumber ?? "?"} · {home} vs {away}
                </option>
              );
            })}
          </select>
        </div>

        <Input
          label="Email destinatario (déjalo en tu correo si quieres recibirlo tú)"
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="tu@correo.com"
        />

        <Button
          onClick={handleSend}
          loading={sending}
          disabled={!matchId}
          variant="primary"
        >
          Enviar email de prueba ahora
        </Button>

        {msg && (
          <p
            className={
              "text-sm font-semibold " +
              (msg.type === "ok"
                ? "text-[var(--pmfu-mint)]"
                : "text-[var(--pmfu-magenta)]")
            }
          >
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
