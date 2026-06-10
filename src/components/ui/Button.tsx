"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--pmfu-cobalt)] text-white hover:bg-[var(--pmfu-cobalt-dark)] disabled:opacity-50",
  secondary:
    "border border-[var(--pmfu-cobalt)]/30 text-[var(--pmfu-cobalt)] hover:bg-[var(--pmfu-cobalt)]/10 disabled:opacity-50",
  ghost:
    "text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-50",
  danger:
    "bg-[var(--pmfu-magenta)] text-white hover:opacity-90 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "rounded-full font-semibold transition-colors inline-flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
});
