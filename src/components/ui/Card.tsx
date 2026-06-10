import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "pmfu-glass rounded-3xl p-8 md:p-10 shadow-xl w-full",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-gray-900 text-sm md:text-base font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
}
