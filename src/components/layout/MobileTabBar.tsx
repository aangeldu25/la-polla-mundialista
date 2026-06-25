"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  adminOnly?: boolean;
}

// SVG icons minimalistas — stroke 1.8, sin relleno cuando inactivo
const stroke = 1.8;
const sizeClass = "w-6 h-6";

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sizeClass}
      >
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    href: "/partidos",
    label: "Partidos",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sizeClass}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
      </svg>
    ),
  },
  {
    href: "/quinielas",
    label: "Quinielas",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sizeClass}
      >
        <path d="M6 9V3h12v6a6 6 0 11-12 0z" />
        <path d="M6 5H3a3 3 0 003 3M18 5h3a3 3 0 01-3 3" />
        <path d="M12 15v4M9 21h6" />
      </svg>
    ),
  },
  {
    href: "/ranking",
    label: "Ranking",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sizeClass}
      >
        <rect x="4" y="13" width="4" height="8" rx="0.5" />
        <rect x="10" y="8" width="4" height="13" rx="0.5" />
        <rect x="16" y="4" width="4" height="17" rx="0.5" />
      </svg>
    ),
  },
  {
    href: "/pollas",
    label: "Pollas",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sizeClass}
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/estadisticas",
    label: "Stats",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={sizeClass}
      >
        <path d="M3 3v18h18" />
        <path d="M7 14l3-4 3 3 4-6" />
        <circle cx="7" cy="14" r="0.5" fill="currentColor" />
        <circle cx="10" cy="10" r="0.5" fill="currentColor" />
        <circle cx="13" cy="13" r="0.5" fill="currentColor" />
        <circle cx="17" cy="7" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const { user, profile } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const visibleTabs = TABS.filter((t) => !t.adminOnly || profile?.isAdmin);

  return (
    <>
      {/* Spacer para que el contenido no quede tapado */}
      <div className="md:hidden" style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }} aria-hidden />

      {/* Barra fija con fondo blanco sólido y borde superior visible.
          position: fixed + position: sticky no aplican aquí — usamos fixed
          con safe-area-inset para iOS. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul
          className="grid px-1 h-16"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}
        >
          {visibleTabs.map((t) => {
            const active =
              pathname === t.href ||
              (t.href !== "/dashboard" && pathname.startsWith(t.href));
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 h-full px-1 text-[11px] font-semibold transition-colors",
                    active
                      ? "text-[var(--pmfu-cobalt)]"
                      : "text-gray-500",
                  )}
                >
                  {t.icon(active)}
                  <span className="leading-none">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
