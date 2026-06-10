"use client";

import { cn } from "@/lib/utils";

export function SameAsBadge({
  count,
  onClick,
  pickIsEmpty = false,
  className,
}: {
  count: number;
  onClick: () => void;
  pickIsEmpty?: boolean;
  className?: string;
}) {
  if (pickIsEmpty) return null;
  if (count === 0) {
    return (
      <span
        className={cn(
          "text-xs text-gray-600 italic inline-flex items-center gap-1",
          className,
        )}
      >
        🦄 Eres el único con esta elección
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs font-semibold text-[var(--pmfu-cobalt)] hover:underline inline-flex items-center gap-1",
        className,
      )}
    >
      👥 Igual que {count} {count === 1 ? "familiar" : "familiares"}
    </button>
  );
}
