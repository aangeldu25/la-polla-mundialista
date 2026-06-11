"use client";

// Helpers cliente para disparar emails transaccionales vía Resend.
// Fire-and-forget: nunca bloquean el flujo principal del usuario.

import type { User } from "firebase/auth";

async function post(body: Record<string, unknown>): Promise<void> {
  try {
    await fetch("/api/emails/transactional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // El email es secundario — no rompemos el flujo si falla
  }
}

export async function sendWelcomeEmail(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  void post({
    type: "welcome",
    idToken,
    userName: user.displayName ?? "Mundialista",
  });
}

export async function sendPollaCreatedEmail(
  user: User,
  polla: { name: string; emoji: string; inviteCode: string },
): Promise<void> {
  const idToken = await user.getIdToken();
  void post({
    type: "polla-created",
    idToken,
    userName: user.displayName ?? "Mundialista",
    pollaName: polla.name,
    emoji: polla.emoji,
    inviteCode: polla.inviteCode,
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await post({ type: "password-reset", email });
}
