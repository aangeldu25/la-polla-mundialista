"use client";

// Landing del link de invitación: /unirse/XXXX-XXXX
// - Si no hay sesión: guarda el código y redirige a login/registro.
// - Si hay sesión: muestra la polla y un botón para unirse.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import {
  findPollaByCode,
  joinPollaByCode,
} from "@/lib/pollas/actions";
import type { Polla } from "@/types/domain";

const PENDING_INVITE_KEY = "pmp.pendingInviteCode";

export default function UnirsePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [polla, setPolla] = useState<Polla | null | "notfound">(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar la polla por código
  useEffect(() => {
    let active = true;
    findPollaByCode(codigo)
      .then((p) => {
        if (active) setPolla(p ?? "notfound");
      })
      .catch(() => {
        if (active) setPolla("notfound");
      });
    return () => {
      active = false;
    };
  }, [codigo]);

  // Si no hay sesión: guardar código pendiente y mandar a registro
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      localStorage.setItem(PENDING_INVITE_KEY, codigo);
      router.replace(`/registro?invite=${encodeURIComponent(codigo)}`);
    }
  }, [authLoading, user, codigo, router]);

  async function handleJoin() {
    if (!user) return;
    setJoining(true);
    setError(null);
    try {
      await joinPollaByCode(user.uid, codigo);
      localStorage.removeItem(PENDING_INVITE_KEY);
      router.replace("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setJoining(false);
    }
  }

  if (authLoading || !user || polla === null) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (polla === "notfound") {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-3">😵</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Código inválido
          </h1>
          <p className="text-sm text-gray-700 mb-4">
            El link de invitación no corresponde a ninguna polla. Pide a quien
            te invitó que te lo reenvíe.
          </p>
          <Button onClick={() => router.push("/dashboard")}>
            Ir al inicio
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-5xl mb-3">{polla.emoji}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{polla.name}</h1>
        <p className="text-sm text-gray-700 mb-5">
          {polla.memberCount}{" "}
          {polla.memberCount === 1 ? "miembro te espera" : "miembros te esperan"}{" "}
          en esta polla. ¿Te unes?
        </p>
        {error && (
          <p className="text-sm font-bold text-[var(--pmfu-magenta)] mb-3">
            {error}
          </p>
        )}
        <Button onClick={handleJoin} loading={joining} className="w-full" size="lg">
          🎉 Unirme a la polla
        </Button>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-3 text-xs text-gray-600 underline"
        >
          Ahora no
        </button>
      </div>
    </main>
  );
}
