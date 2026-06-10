"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Polla } from "@/types/domain";

// Genera un código de invitación corto y legible, ej. "X7K2-M9QD".
// Evita caracteres ambiguos (0/O, 1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateInviteCode(): string {
  const pick = () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  const part = (n: number) => Array.from({ length: n }, pick).join("");
  return `${part(4)}-${part(4)}`;
}

export function membershipId(pollaId: string, uid: string): string {
  return `${pollaId}_${uid}`;
}

const MAX_POLLAS_PER_USER = 10;
const MAX_MEMBERS_PER_POLLA = 200;

// Crea una polla nueva y agrega al creador como owner. Retorna la polla.
export async function createPolla(params: {
  uid: string;
  name: string;
  emoji: string;
}): Promise<Polla> {
  const { uid, name, emoji } = params;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 40) {
    throw new Error("El nombre debe tener entre 3 y 40 caracteres");
  }

  // Límite anti-abuso: máximo de pollas por usuario
  const mine = await getDocs(
    query(
      collection(db, "memberships"),
      where("uid", "==", uid),
      limit(MAX_POLLAS_PER_USER),
    ),
  );
  if (mine.size >= MAX_POLLAS_PER_USER) {
    throw new Error(
      `Solo puedes pertenecer a ${MAX_POLLAS_PER_USER} pollas a la vez`,
    );
  }

  // Generar código único (reintenta si colisiona — improbable con 32^8)
  let inviteCode = generateInviteCode();
  for (let i = 0; i < 3; i++) {
    const clash = await getDocs(
      query(
        collection(db, "pollas"),
        where("inviteCode", "==", inviteCode),
        limit(1),
      ),
    );
    if (clash.empty) break;
    inviteCode = generateInviteCode();
  }

  const pollaRef = doc(collection(db, "pollas"));
  const now = new Date().toISOString();
  const polla: Polla = {
    id: pollaRef.id,
    name: trimmed,
    inviteCode,
    ownerUid: uid,
    emoji: emoji || "🏆",
    memberCount: 1,
    createdAt: now,
  };

  await runTransaction(db, async (tx) => {
    tx.set(pollaRef, { ...polla, _createdAt: serverTimestamp() });
    tx.set(doc(db, "memberships", membershipId(pollaRef.id, uid)), {
      uid,
      pollaId: pollaRef.id,
      role: "owner",
      joinedAt: now,
      _joinedAt: serverTimestamp(),
    });
  });

  return polla;
}

// Busca una polla por código de invitación (case-insensitive en formato).
export async function findPollaByCode(code: string): Promise<Polla | null> {
  const normalized = code.trim().toUpperCase();
  const snap = await getDocs(
    query(
      collection(db, "pollas"),
      where("inviteCode", "==", normalized),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as Polla;
}

// Une al usuario a la polla con el código dado. Idempotente.
export async function joinPollaByCode(
  uid: string,
  code: string,
): Promise<Polla> {
  const polla = await findPollaByCode(code);
  if (!polla) {
    throw new Error("Código de invitación inválido");
  }
  const memRef = doc(db, "memberships", membershipId(polla.id, uid));
  const existing = await getDoc(memRef);
  if (existing.exists()) return polla; // ya es miembro

  if (polla.memberCount >= MAX_MEMBERS_PER_POLLA) {
    throw new Error("Esta polla alcanzó el máximo de miembros");
  }

  const now = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    const pollaSnap = await tx.get(doc(db, "pollas", polla.id));
    if (!pollaSnap.exists()) throw new Error("La polla ya no existe");
    const count = (pollaSnap.data().memberCount as number) ?? 0;
    if (count >= MAX_MEMBERS_PER_POLLA) {
      throw new Error("Esta polla alcanzó el máximo de miembros");
    }
    tx.set(memRef, {
      uid,
      pollaId: polla.id,
      role: "member",
      joinedAt: now,
      _joinedAt: serverTimestamp(),
    });
    tx.update(doc(db, "pollas", polla.id), { memberCount: count + 1 });
  });
  return polla;
}

// Sale de una polla. El owner no puede salir (debería transferir o eliminar).
export async function leavePolla(uid: string, pollaId: string): Promise<void> {
  const memRef = doc(db, "memberships", membershipId(pollaId, uid));
  const mem = await getDoc(memRef);
  if (!mem.exists()) return;
  if (mem.data().role === "owner") {
    throw new Error(
      "El creador no puede abandonar su polla. Contáctanos para transferirla.",
    );
  }
  await runTransaction(db, async (tx) => {
    const pollaSnap = await tx.get(doc(db, "pollas", pollaId));
    tx.delete(memRef);
    if (pollaSnap.exists()) {
      const count = (pollaSnap.data().memberCount as number) ?? 1;
      tx.update(doc(db, "pollas", pollaId), {
        memberCount: Math.max(0, count - 1),
      });
    }
  });
}

// Link de invitación completo para compartir.
export function inviteLink(polla: Polla): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://la-polla-mundialista-2026-seven.vercel.app";
  return `${base}/unirse/${polla.inviteCode}`;
}
