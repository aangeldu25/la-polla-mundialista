"use client";

import { useState } from "react";
import { fireConfetti } from "@/lib/festive/confetti";
import type { UserProfile } from "@/types/domain";

const APP_URL = "https://la-polla-mundialista-2026-seven.vercel.app";

export function ShareRankingButton({
  ranked,
  myUid,
}: {
  ranked: UserProfile[];
  myUid: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!myUid) return null;
  const myRank = ranked.findIndex((u) => u.uid === myUid) + 1;
  const me = ranked.find((u) => u.uid === myUid);
  if (!me || myRank === 0) return null;

  const medal =
    myRank === 1 ? "🏆" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "📊";

  function buildText() {
    const total = ranked.length;
    return `${medal} La Polla Mundialista — Mundial 2026

Voy en el puesto ${myRank} de ${total} con ${me!.totalPoints} puntos
🎯 ${me!.exactScoreHits} marcadores exactos
✓ ${me!.winnerHits} ganadores acertados

${myRank === 1 ? "¡Voy primero! 🥇" : myRank <= 3 ? "¡En el podio! 💪" : "Vamos por más 🚀"}

Únete: ${APP_URL}`;
  }

  async function handleShare() {
    const text = buildText();
    // Web Share API funciona en móvil (Android, iOS) y algunos browsers desktop
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Mi posición en PMFU",
          text,
        });
        fireConfetti("small");
        return;
      } catch {
        // Si el usuario canceló o falló, caemos a copy
      }
    }
    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      fireConfetti("small");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // último recurso: alert
      window.alert(text);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="w-full md:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-[var(--pmfu-cobalt)] via-[var(--pmfu-magenta)] to-[var(--pmfu-orange)] text-white text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 shadow-md"
    >
      {copied ? "✓ Copiado al portapapeles" : "📤 Compartir mi posición"}
    </button>
  );
}
