"use client";

import { useEffect, useState } from "react";

export function SubscribeCalendarCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [webcalUrl, setWebcalUrl] = useState<string>(
    "/api/calendar/fixture.ics",
  );
  const [httpsUrl, setHttpsUrl] = useState<string>(
    "/api/calendar/fixture.ics",
  );
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  // En modo compacto el contenido arranca colapsado.
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebcalUrl(
        `webcal://${window.location.host}/api/calendar/fixture.ics`,
      );
      setHttpsUrl(
        `${window.location.origin}/api/calendar/fixture.ics`,
      );
    }
  }, []);

  async function handleGoogleCalendar() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // Si falla el clipboard (Safari sin permisos, etc.), mostramos la URL
    }
    window.open(
      "https://calendar.google.com/calendar/u/0/r/settings/addbyurl",
      "_blank",
      "noopener,noreferrer",
    );
  }

  // Modo compacto colapsado: solo el encabezado clickeable.
  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-2xl border border-gray-200 bg-white flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-sm text-gray-900">
          📅 Calendario del fixture
        </span>
        <span className="text-xs text-gray-500">
          Llevar los 104 partidos a tu calendario ▼
        </span>
      </button>
    );
  }

  return (
    <div className="pmfu-glass rounded-2xl p-4 md:p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-widest text-[var(--pmfu-cobalt)] font-bold mb-1.5">
          📅 Calendario del fixture
        </p>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
            aria-label="Colapsar"
          >
            ▲
          </button>
        )}
      </div>
      <h3 className="font-bold text-gray-900 mb-1">
        Lleva los 104 partidos a tu calendario
      </h3>
      <p className="text-xs text-gray-700 mb-3">
        Con un solo click, en cualquier dispositivo. Incluye recordatorio
        automático 1 hora antes de cada partido.
      </p>

      {/* Acción primaria: webcal:// — funciona seamless en iOS, Android,
          macOS, Windows con Outlook, y cualquier app de calendario nativa */}
      <a
        href={webcalUrl}
        className="px-4 py-2 rounded-full bg-[var(--pmfu-cobalt)] text-white text-sm font-semibold hover:bg-[var(--pmfu-cobalt-dark)] transition-colors inline-flex items-center gap-2"
      >
        📅 Agregar a mi calendario
      </a>

      {/* Acción secundaria para Google Calendar web en desktop */}
      <div className="mt-3 text-xs text-gray-700">
        ¿Usas Google Calendar en computador?{" "}
        <button
          type="button"
          onClick={handleGoogleCalendar}
          className="font-bold text-[var(--pmfu-cobalt)] underline hover:no-underline"
        >
          Abrir en Google Calendar
        </button>
        {copied && (
          <span className="ml-2 inline-block text-[var(--pmfu-mint)] font-semibold">
            ✓ URL copiada — pégala (Ctrl+V) en el campo que abrió Google
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowHelp(!showHelp)}
        className="mt-2 text-[10px] text-gray-600 underline"
      >
        {showHelp ? "Ocultar ayuda" : "¿Tienes problemas? Ver ayuda"}
      </button>

      {showHelp && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-800 space-y-2">
          <p className="font-bold">Por plataforma</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>iPhone / iPad / Mac:</strong> click en el botón azul →
              aprueba la suscripción en el diálogo de Apple Calendar.
            </li>
            <li>
              <strong>Android:</strong> click en el botón azul → elige la app
              de calendario que prefieras → suscribir.
            </li>
            <li>
              <strong>Windows con Outlook:</strong> click en el botón azul →
              Outlook se abre con el diálogo de suscripción.
            </li>
            <li>
              <strong>Google Calendar en computador:</strong> click en{" "}
              <em>Abrir en Google Calendar</em> arriba. Se copia la URL al
              portapapeles y abre el formulario de Google. Pega con Ctrl+V (o
              Cmd+V en Mac) y haz click en <em>Agregar calendario</em>.
            </li>
          </ul>
          <p className="pt-2 border-t border-gray-200">
            Si necesitas la URL manualmente:
            <br />
            <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 block mt-1 break-all">
              {httpsUrl}
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
