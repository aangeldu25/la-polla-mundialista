"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Renderiza banderas desde flagcdn.com (SVG para nitidez en cualquier tamaño)
// con contenedor de tamaño fijo y proporción uniforme 4:3 para que todas las
// selecciones se vean idénticas en tamaño (independiente del aspect-ratio
// natural de cada bandera real).
//
// Si la imagen falla a cargar (red lenta en móvil, etc.) mostramos las
// primeras 2 letras del código como fallback elegante en vez de un ícono roto.
export function Flag({
  iso2,
  size = 24,
  className,
  alt,
  rounded = "sm",
}: {
  iso2: string;
  size?: number;
  className?: string;
  alt?: string;
  rounded?: "sm" | "md" | "full" | "none";
}) {
  const [errored, setErrored] = useState(false);
  const height = Math.round((size * 3) / 4); // proporción 4:3 uniforme
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "md"
        ? "rounded-md"
        : rounded === "none"
          ? ""
          : "rounded-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden shrink-0 bg-gray-100 ring-1 ring-black/5",
        radius,
        className,
      )}
      style={{
        width: size,
        height,
        minWidth: size,
        minHeight: height,
      }}
      role="img"
      aria-label={alt ?? iso2}
    >
      {!errored && iso2 ? (
        <img
          src={`https://flagcdn.com/${iso2}.svg`}
          alt=""
          className="block w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span
          className="font-bold uppercase text-gray-600 tracking-tight"
          style={{ fontSize: Math.max(8, Math.round(size * 0.32)) }}
        >
          {(iso2 ?? "").slice(0, 2)}
        </span>
      )}
    </span>
  );
}
