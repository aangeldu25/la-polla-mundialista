"use client";

// Selector de polla activa — un dropdown simple con las pollas del usuario.
// Aparece en Ranking y otros lugares filtrados por grupo.

import Link from "next/link";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";

export function PollaSwitcher() {
  const { pollas, activePolla, setActivePollaId } = useActivePolla();

  if (pollas.length === 0) {
    return (
      <Link
        href="/pollas"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10 px-3 py-1.5 rounded-full hover:bg-[var(--pmfu-cobalt)]/20 transition-colors"
      >
        ➕ Crea o únete a una polla
      </Link>
    );
  }

  if (pollas.length === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full">
        {pollas[0].emoji} {pollas[0].name}
      </span>
    );
  }

  return (
    <select
      value={activePolla?.id ?? ""}
      onChange={(e) => setActivePollaId(e.target.value)}
      className="text-sm font-bold text-gray-900 bg-white border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]"
    >
      {pollas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.emoji} {p.name}
        </option>
      ))}
    </select>
  );
}
