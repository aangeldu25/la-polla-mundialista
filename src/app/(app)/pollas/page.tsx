"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  createPolla,
  joinPollaByCode,
  leavePolla,
  inviteLink,
} from "@/lib/pollas/actions";
import type { Polla } from "@/types/domain";
import { sendPollaCreatedEmail } from "@/lib/notifications/client";
import { cn } from "@/lib/utils";

const EMOJIS = ["🏆", "⚽", "🎉", "🔥", "🦁", "🌟", "🍀", "👑"];

export default function PollasPage() {
  const { user } = useAuth();
  const { pollas, activePolla, setActivePollaId, loading } = useActivePolla();

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏆");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      const polla = await createPolla({ uid: user.uid, name, emoji });
      void sendPollaCreatedEmail(user, polla);
      setActivePollaId(polla.id);
      setName("");
      setCreating(false);
      setMsg({ type: "ok", text: `¡Polla "${polla.name}" creada! Comparte el link de invitación.` });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      const polla = await joinPollaByCode(user.uid, code);
      setActivePollaId(polla.id);
      setCode("");
      setJoining(false);
      setMsg({ type: "ok", text: `¡Te uniste a "${polla.name}"!` });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(polla: Polla) {
    if (!user) return;
    if (!confirm(`¿Salir de "${polla.name}"?`)) return;
    setBusy(true);
    try {
      await leavePolla(user.uid, polla.id);
      setMsg({ type: "ok", text: `Saliste de "${polla.name}"` });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink(polla: Polla) {
    try {
      await navigator.clipboard.writeText(inviteLink(polla));
      setCopiedId(polla.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: mostrar el link
      prompt("Copia el link:", inviteLink(polla));
    }
  }

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="px-4 md:px-6 py-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Mis pollas
        </h1>
        <p className="mt-1 text-gray-800 font-medium">
          Crea grupos con tu familia, amigos o trabajo. Tus predicciones
          cuentan en todas tus pollas.
        </p>
      </div>

      {msg && (
        <p
          className={cn(
            "mb-4 text-sm font-bold",
            msg.type === "ok"
              ? "text-[var(--pmfu-mint)]"
              : "text-[var(--pmfu-magenta)]",
          )}
        >
          {msg.text}
        </p>
      )}

      {/* Lista de pollas */}
      {pollas.length === 0 ? (
        <Card className="text-center py-8 mb-6">
          <p className="text-4xl mb-2">👋</p>
          <p className="font-bold text-gray-900">Aún no estás en ninguna polla</p>
          <p className="text-sm text-gray-700 mt-1">
            Crea una nueva o únete con un código de invitación.
          </p>
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {pollas.map((p) => {
            const isActive = activePolla?.id === p.id;
            const isOwner = p.ownerUid === user.uid;
            return (
              <Card
                key={p.id}
                className={cn(
                  "transition-all",
                  isActive && "ring-2 ring-[var(--pmfu-cobalt)]",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">
                      {p.name}
                      {isOwner && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-[var(--pmfu-orange)] bg-[var(--pmfu-orange)]/10 px-1.5 py-0.5 rounded-full">
                          Creador
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">
                      {p.memberCount}{" "}
                      {p.memberCount === 1 ? "miembro" : "miembros"} · Código:{" "}
                      <span className="font-mono font-bold">{p.inviteCode}</span>
                    </p>
                  </div>
                  {isActive ? (
                    <span className="text-xs font-bold text-[var(--pmfu-cobalt)] whitespace-nowrap">
                      ✓ Activa
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActivePollaId(p.id)}
                    >
                      Ver esta
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCopyLink(p)}
                  >
                    {copiedId === p.id ? "✓ Copiado" : "🔗 Copiar link de invitación"}
                  </Button>
                  {!isOwner && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleLeave(p)}
                      disabled={busy}
                    >
                      Salir
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Crear polla */}
      <Card className="mb-4">
        <CardHeader title="➕ Crear una polla" />
        {creating ? (
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del grupo (ej. Familia García)"
              maxLength={40}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]"
            />
            <div className="flex gap-2 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "text-2xl p-1.5 rounded-xl border-2 transition-all",
                    emoji === e
                      ? "border-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10"
                      : "border-transparent hover:bg-gray-100",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={busy} className="flex-1">
                Crear polla
              </Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setCreating(true)} className="w-full">
            Crear una polla nueva
          </Button>
        )}
      </Card>

      {/* Unirse con código */}
      <Card>
        <CardHeader title="🎟️ Unirse con código" />
        {joining ? (
          <div className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[var(--pmfu-cobalt)]"
            />
            <div className="flex gap-2">
              <Button onClick={handleJoin} loading={busy} className="flex-1">
                Unirme
              </Button>
              <Button variant="secondary" onClick={() => setJoining(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setJoining(true)}
            className="w-full"
          >
            Tengo un código de invitación
          </Button>
        )}
      </Card>
    </main>
  );
}
