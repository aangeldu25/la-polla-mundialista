"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/quinielas", label: "Quinielas" },
  { href: "/ranking", label: "Ranking" },
  { href: "/pollas", label: "Mis pollas" },
];

export function Navbar() {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside para cerrar el menú en móvil (onMouseLeave no funciona en touch)
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (!user) return null;

  return (
    <header className="pmfu-glass sticky top-0 z-30 px-4 md:px-8 py-3 flex items-center justify-between border-b border-gray-200/40">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-[var(--pmfu-cobalt)] via-[var(--pmfu-magenta)] to-[var(--pmfu-orange)] bg-clip-text text-transparent">
          PMFU
        </span>
        <span className="hidden md:inline text-xs uppercase tracking-widest text-gray-700 font-semibold">
          Mundial 2026
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-semibold transition-colors",
              pathname === item.href
                ? "bg-[var(--pmfu-cobalt)]/15 text-[var(--pmfu-cobalt)]"
                : "text-gray-800 hover:text-[var(--pmfu-cobalt)] hover:bg-gray-100",
            )}
          >
            {item.label}
          </Link>
        ))}
        {profile?.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-semibold transition-colors",
              pathname === "/admin"
                ? "bg-[var(--pmfu-magenta)]/15 text-[var(--pmfu-magenta)]"
                : "text-[var(--pmfu-magenta)] hover:bg-[var(--pmfu-magenta)]/10",
            )}
          >
            Admin
          </Link>
        )}
      </nav>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-1 pr-3"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
            {profile?.photoURL ? (
              <Image
                src={profile.photoURL}
                alt="Avatar"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-700">
                {(profile?.displayName ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="hidden md:inline text-sm font-semibold text-gray-900">
            {profile?.displayName ?? "..."}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 z-50">
            <Link
              href="/perfil"
              className="block px-3 py-2 rounded-xl text-sm font-medium text-gray-900 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              Mi perfil
            </Link>
            {profile && (
              <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-200 mt-1 pt-2">
                {profile.totalPoints} pts totales
              </div>
            )}
            <button
              onClick={() => {
                setOpen(false);
                void handleSignOut();
              }}
              className="block w-full text-left px-3 py-2 rounded-xl text-sm font-medium hover:bg-[var(--pmfu-magenta)]/10 text-[var(--pmfu-magenta)]"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
