"use client";

import { useEffect, useRef, useState } from "react";
import { TEAMS_SORTED, TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { Flag } from "./Flag";
import { cn } from "@/lib/utils";

export function TeamSelect({
  value,
  onChange,
  label = "Soy hincha de",
}: {
  value: string;
  onChange: (tla: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? TEAMS_BY_TLA[value] : null;

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

  const filtered = query
    ? TEAMS_SORTED.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.tla.toLowerCase().includes(query.toLowerCase()),
      )
    : TEAMS_SORTED;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-sm font-semibold text-gray-800">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 rounded-xl bg-white text-gray-900 border border-gray-300 focus:border-[var(--pmfu-cobalt)] outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]/20 flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-3 flex-1 min-w-0">
          {selected ? (
            <>
              <Flag iso2={selected.iso2} size={28} alt={selected.name} />
              <span className="font-semibold truncate">{selected.name}</span>
              <span className="text-xs text-gray-600">({selected.tla})</span>
            </>
          ) : (
            <span className="text-gray-500">— Selecciona una —</span>
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
          <div className="absolute z-40 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-[min(20rem,60vh)] overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                autoFocus
                placeholder="Buscar selección..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 text-gray-900 border border-gray-200 focus:border-[var(--pmfu-cobalt)] outline-none text-base"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-100 italic"
              >
                — Sin preferencia —
              </button>
              {filtered.map((t) => (
                <button
                  key={t.tla}
                  type="button"
                  onClick={() => {
                    onChange(t.tla);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-[var(--pmfu-cobalt)]/10 transition-colors",
                    value === t.tla && "bg-[var(--pmfu-cobalt)]/15",
                  )}
                >
                  <Flag iso2={t.iso2} size={28} alt={t.name} />
                  <span className="font-semibold text-gray-900 flex-1">
                    {t.name}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">
                    {t.tla}
                  </span>
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
