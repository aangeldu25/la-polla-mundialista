"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  ALL_PLAYERS,
  GOALKEEPERS,
  PLAYERS_BY_ID,
  searchPlayers,
  type WCPlayer,
} from "@/lib/constants/wc2026-players";
import { Flag } from "@/components/ui/Flag";
import { cn } from "@/lib/utils";

export function PlayerSelect({
  value,
  onChange,
  label,
  goalkeepersOnly = false,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  goalkeepersOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? PLAYERS_BY_ID[value] : null;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pool = goalkeepersOnly ? GOALKEEPERS : ALL_PLAYERS;
  const filtered = useMemo(
    () => searchPlayers(query, pool),
    [query, pool],
  );

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-sm font-semibold text-gray-900">{label}</label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full px-4 py-2.5 rounded-xl border outline-none flex items-center justify-between gap-3 text-left",
          disabled
            ? "bg-gray-100 text-gray-700 cursor-not-allowed border-gray-200"
            : "bg-white text-gray-900 border-gray-300 focus:border-[var(--pmfu-cobalt)] focus:ring-2 focus:ring-[var(--pmfu-cobalt)]/20",
        )}
      >
        <span className="flex items-center gap-3 flex-1 min-w-0">
          {selected ? (
            <>
              <Flag iso2={selected.teamIso2} size={28} alt={selected.teamName} />
              <span className="min-w-0">
                <span className="font-semibold block truncate">
                  {selected.name}
                </span>
                <span className="text-xs text-gray-600 block truncate">
                  {selected.teamName} · {selected.posLabel}
                </span>
              </span>
            </>
          ) : (
            <span className="text-gray-500">— Selecciona un jugador —</span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={cn(
            "text-gray-600 transition-transform",
            open && "rotate-180",
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="relative">
          <div className="absolute z-40 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-[min(24rem,60vh)] overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                autoFocus
                placeholder={
                  goalkeepersOnly
                    ? "Buscar portero..."
                    : "Buscar por nombre, club o selección..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 text-gray-900 border border-gray-200 focus:border-[var(--pmfu-cobalt)] outline-none text-base"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--pmfu-magenta)] hover:bg-gray-100 italic"
                >
                  Limpiar selección
                </button>
              )}
              {filtered.map((p: WCPlayer) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-[var(--pmfu-cobalt)]/10 transition-colors",
                    value === p.id && "bg-[var(--pmfu-cobalt)]/15",
                  )}
                >
                  <Flag iso2={p.teamIso2} size={24} alt={p.teamName} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {p.teamName} · {p.posLabel} · {p.club}
                    </p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-600">
                  No hay resultados
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
