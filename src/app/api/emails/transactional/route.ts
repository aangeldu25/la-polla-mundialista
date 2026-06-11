// Envío de emails transaccionales vía Resend (en vez de los emails "raw"
// de Firebase que suelen caer a spam).
//
// Tipos soportados:
//  - welcome:        bienvenida tras crear cuenta
//  - polla-created:  confirmación con link de invitación
//  - password-reset: link de restablecimiento generado por Firebase Admin
//
// Seguridad: welcome y polla-created exigen un ID token válido del usuario.
// password-reset es anónimo por naturaleza (el usuario no tiene sesión) pero
// solo revela "ok" — nunca dice si el email existe o no.

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  sendEmail,
  buildWelcomeEmailHtml,
  buildPollaCreatedEmailHtml,
  buildPasswordResetEmailHtml,
} from "@/lib/notifications/email";

export async function POST(req: NextRequest) {
  let body: {
    type?: string;
    idToken?: string;
    email?: string;
    userName?: string;
    pollaName?: string;
    emoji?: string;
    inviteCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  try {
    switch (body.type) {
      case "welcome": {
        const decoded = await adminAuth.verifyIdToken(body.idToken ?? "");
        const to = decoded.email;
        if (!to) return NextResponse.json({ ok: false }, { status: 400 });
        const result = await sendEmail({
          to,
          subject: "¡Bienvenido a La Polla Mundialista! ⚽",
          html: buildWelcomeEmailHtml({
            userName: body.userName || "Mundialista",
          }),
        });
        return NextResponse.json(result);
      }

      case "polla-created": {
        const decoded = await adminAuth.verifyIdToken(body.idToken ?? "");
        const to = decoded.email;
        if (!to || !body.pollaName || !body.inviteCode) {
          return NextResponse.json({ ok: false }, { status: 400 });
        }
        const result = await sendEmail({
          to,
          subject: `${body.emoji ?? "🏆"} Tu polla "${body.pollaName}" está lista`,
          html: buildPollaCreatedEmailHtml({
            userName: body.userName || "Mundialista",
            pollaName: body.pollaName,
            emoji: body.emoji ?? "🏆",
            inviteCode: body.inviteCode,
          }),
        });
        return NextResponse.json(result);
      }

      case "password-reset": {
        const email = (body.email ?? "").trim().toLowerCase();
        if (!email) {
          return NextResponse.json({ ok: false }, { status: 400 });
        }
        try {
          const resetLink = await adminAuth.generatePasswordResetLink(email);
          await sendEmail({
            to: email,
            subject: "Restablece tu contraseña — La Polla Mundialista",
            html: buildPasswordResetEmailHtml({ resetLink }),
          });
        } catch {
          // Usuario no existe u otro error: respondemos ok igual para no
          // revelar qué correos están registrados (anti-enumeración).
        }
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { ok: false, error: "unknown-type" },
          { status: 400 },
        );
    }
  } catch (e) {
    console.error("[emails/transactional]", e);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
