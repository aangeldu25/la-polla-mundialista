"use client";

import { cn } from "@/lib/utils";

export function ScoreStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(Math.min(20, value + 1));

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          disabled={disabled || value === 0}
          className={cn(
            "w-10 h-10 rounded-full font-bold text-xl",
            "bg-gray-100 text-gray-700 hover:bg-gray-200",
            "disabled:opacity-30 disabled:cursor-not-allowed transition",
          )}
          aria-label="Restar"
        >
          –
        </button>
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center",
            "text-3xl font-bold tabular-nums",
            disabled
              ? "bg-gray-100 text-gray-700"
              : "bg-[var(--pmfu-cobalt)]/10 text-[var(--pmfu-cobalt)]",
          )}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={disabled || value === 20}
          className={cn(
            "w-10 h-10 rounded-full font-bold text-xl",
            "bg-gray-100 text-gray-700 hover:bg-gray-200",
            "disabled:opacity-30 disabled:cursor-not-allowed transition",
          )}
          aria-label="Sumar"
        >
          +
        </button>
      </div>
    </div>
  );
}
