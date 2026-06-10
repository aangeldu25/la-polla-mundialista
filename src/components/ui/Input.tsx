"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-gray-900"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "px-4 py-2.5 rounded-xl bg-white text-gray-900",
          "border border-gray-200 focus:border-[var(--pmfu-cobalt)]",
          "outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]/20",
          "transition-all placeholder:text-gray-400",
          error && "border-[var(--pmfu-magenta)]",
          className,
        )}
        {...rest}
      />
      {error && (
        <span className="text-xs text-[var(--pmfu-magenta)]">{error}</span>
      )}
    </div>
  );
});
