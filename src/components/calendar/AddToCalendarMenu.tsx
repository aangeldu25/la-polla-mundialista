"use client";

import { useEffect, useRef, useState } from "react";
import { googleCalendarUrl } from "@/lib/calendar/google-url";
import { matchesToIcs } from "@/lib/calendar/ical";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import type { Match } from "@/types/domain";
import { cn } from "@/lib/utils";

export function AddToCalendarMenu({
  match,
  className,
}: {
  match: Match;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleGoogle() {
    window.open(googleCalendarUrl(match), "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function handleDownload() {
    const ics = matchesToIcs([match]);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const home =
      TEAMS_BY_TLA[match.homeTeam.tla]?.tla.toLowerCase() ?? "tbd";
    const away =
      TEAMS_BY_TLA[match.awayTeam.tla]?.tla.toLowerCase() ?? "tbd";
    a.download = `mundial-2026-${home}-vs-${away}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 rounded-full border-2 border-[var(--pmfu-cobalt)]/30 text-[var(--pmfu-cobalt)] font-semibold text-sm hover:bg-[var(--pmfu-cobalt)]/5 transition-colors inline-flex items-center justify-center gap-2"
      >
        📅 Agregar a mi calendario
      </button>

      {open && (
        <div className="absolute right-0 left-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
          >
            <span className="text-xl">🟦</span>
            <div>
              <div>Google Calendar</div>
              <div className="text-xs text-gray-600 font-normal">
                Abre el editor pre-llenado en una pestaña nueva
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center gap-3"
          >
            <span className="text-xl">💾</span>
            <div>
              <div>Descargar archivo .ics</div>
              <div className="text-xs text-gray-600 font-normal">
                Apple Calendar, Outlook y otros
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
