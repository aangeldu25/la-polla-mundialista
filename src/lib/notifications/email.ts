import { Resend } from "resend";

const APP_URL = "https://polla-mundialista-familia-unida.vercel.app";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "resend-not-configured" };

  const from =
    process.env.RESEND_FROM ??
    "PMFU <onboarding@resend.dev>"; // Default funciona sin verificar dominio

  try {
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Plantilla HTML branded para el recordatorio de predicción pendiente.
export function buildReminderEmailHtml(params: {
  userName: string;
  matchSummary: string;
  kickoffStr: string;
  venue?: string;
}): string {
  const venueLine = params.venue
    ? `<p style="margin: 6px 0 0; color: #555; font-size: 14px;">📍 ${escapeHtml(params.venue)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Predicción pendiente — PMFU</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px 12px;">
    <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
      <div style="background:linear-gradient(135deg,#0033a0 0%,#e6007e 50%,#ff7a1a 100%);padding:28px 24px;color:white;text-align:center;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;opacity:0.85;">PMFU · Mundial 2026</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;">⚡ Tu partido empieza en 30 minutos</h1>
      </div>
      <div style="padding:24px;color:#0a1a3a;">
        <p style="margin:0 0 16px;font-size:16px;">Hola <strong>${escapeHtml(params.userName)}</strong>,</p>
        <div style="background:#f7f8fb;border:1px solid #e5e7eb;border-radius:16px;padding:18px;margin:16px 0;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#0033a0;font-weight:700;">Partido próximo</p>
          <h2 style="margin:8px 0 4px;font-size:20px;color:#0a1a3a;">${escapeHtml(params.matchSummary)}</h2>
          <p style="margin:6px 0 0;color:#444;font-size:14px;font-weight:600;">${escapeHtml(params.kickoffStr)}</p>
          ${venueLine}
        </div>
        <p style="margin:16px 0;font-size:15px;color:#333;">Aún no has predicho el marcador. Las predicciones se cierran al kickoff.</p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${APP_URL}/partidos" style="display:inline-block;background:#0033a0;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px;">Predecir ahora</a>
        </p>
      </div>
      <div style="padding:18px 24px;background:#fafbff;border-top:1px solid #e5e7eb;text-align:center;color:#666;font-size:12px;">
        <strong style="color:#0033a0;">La Polla Mundialista</strong><br>
        <span style="opacity:0.8;">Recibes este correo porque tienes notificaciones activadas.</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
