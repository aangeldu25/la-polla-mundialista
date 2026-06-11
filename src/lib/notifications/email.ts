import { Resend } from "resend";

const APP_URL = "https://la-polla-mundialista-2026-seven.vercel.app";

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

// ===== Plantilla base compartida para emails transaccionales =====
function baseTemplate(params: {
  preheader: string;
  headline: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const cta =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:24px 0;text-align:center;">
          <a href="${params.ctaUrl}" style="display:inline-block;background:#0033a0;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px;">${escapeHtml(params.ctaLabel)}</a>
        </p>`
      : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(params.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(params.preheader)}</span>
  <div style="max-width:480px;margin:0 auto;padding:24px 12px;">
    <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
      <div style="background:linear-gradient(135deg,#0033a0 0%,#e6007e 50%,#ff7a1a 100%);padding:28px 24px;color:white;text-align:center;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;opacity:0.85;">⚽ La Polla Mundialista · 2026</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;">${escapeHtml(params.headline)}</h1>
      </div>
      <div style="padding:24px;color:#0a1a3a;">
        ${params.bodyHtml}
        ${cta}
      </div>
      <div style="padding:18px 24px;background:#fafbff;border-top:1px solid #e5e7eb;text-align:center;color:#666;font-size:12px;">
        <strong style="color:#0033a0;">La Polla Mundialista</strong><br>
        <span style="opacity:0.8;">${escapeHtml(params.footerNote ?? "El Mundial 2026 se vive mejor compitiendo.")}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Bienvenida al crear cuenta.
export function buildWelcomeEmailHtml(params: { userName: string }): string {
  return baseTemplate({
    preheader: "Tu cuenta está lista. ¡A predecir!",
    headline: `¡Bienvenido, ${params.userName}! 🎉`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;">Tu cuenta en <strong>La Polla Mundialista</strong> quedó lista.</p>
      <p style="margin:0 0 10px;font-size:15px;color:#333;">Ahora sigue lo divertido:</p>
      <ul style="margin:0 0 8px;padding-left:20px;font-size:15px;color:#333;line-height:1.7;">
        <li>📝 Predice los marcadores de los 104 partidos</li>
        <li>👥 Crea tu polla e invita a tu gente con un link</li>
        <li>🏆 Elige goleador, Balón de Oro y Guante de Oro</li>
      </ul>
      <p style="margin:14px 0 0;font-size:13px;color:#777;">Las quinielas cierran el 11 de junio de 2026 a las 4:00 p.m. (hora Colombia).</p>`,
    ctaLabel: "Hacer mis predicciones",
    ctaUrl: `${APP_URL}/partidos`,
  });
}

// Confirmación de polla creada, con el link de invitación destacado.
export function buildPollaCreatedEmailHtml(params: {
  userName: string;
  pollaName: string;
  emoji: string;
  inviteCode: string;
}): string {
  const inviteUrl = `${APP_URL}/unirse/${params.inviteCode}`;
  return baseTemplate({
    preheader: `Tu polla "${params.pollaName}" está lista para invitar gente`,
    headline: `${params.emoji} ¡Tu polla está lista!`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;">Hola <strong>${escapeHtml(params.userName)}</strong>,</p>
      <p style="margin:0 0 14px;font-size:15px;color:#333;">Creaste la polla <strong>${escapeHtml(params.pollaName)}</strong>. Comparte este link con tu gente para que se unan:</p>
      <div style="background:#f7f8fb;border:1px dashed #0033a0;border-radius:16px;padding:16px;margin:16px 0;text-align:center;">
        <a href="${inviteUrl}" style="font-size:14px;color:#0033a0;font-weight:700;word-break:break-all;">${inviteUrl}</a>
        <p style="margin:10px 0 0;font-size:12px;color:#666;">Código: <strong style="font-family:monospace;letter-spacing:2px;">${escapeHtml(params.inviteCode)}</strong></p>
      </div>
      <p style="margin:0;font-size:13px;color:#777;">Tip: pégalo en el grupo de WhatsApp y listo. Quien lo abra queda dentro en dos toques.</p>`,
    ctaLabel: "Ver mi polla",
    ctaUrl: `${APP_URL}/pollas`,
  });
}

// Recuperación de contraseña (link generado por Firebase Admin).
export function buildPasswordResetEmailHtml(params: {
  resetLink: string;
}): string {
  return baseTemplate({
    preheader: "Restablece tu contraseña de La Polla Mundialista",
    headline: "Recupera tu acceso 🔑",
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;">Recibimos una solicitud para restablecer tu contraseña.</p>
      <p style="margin:0 0 8px;font-size:15px;color:#333;">Si fuiste tú, haz clic en el botón. El enlace expira en 1 hora.</p>
      <p style="margin:14px 0 0;font-size:13px;color:#777;">Si no fuiste tú, ignora este correo — tu cuenta sigue segura.</p>`,
    ctaLabel: "Restablecer contraseña",
    ctaUrl: params.resetLink,
    footerNote: "Por seguridad, nunca compartas este enlace.",
  });
}
