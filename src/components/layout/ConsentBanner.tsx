"use client";

// Banner de consentimiento de analítica. Aparece una sola vez; la elección
// persiste. "Aceptar" activa Google Analytics (Firebase); "Solo lo esencial"
// no carga ningún tracker. La app funciona igual en ambos casos.

import { useEffect, useState } from "react";
import {
  getConsent,
  setConsent,
  initAnalytics,
} from "@/lib/analytics/consent";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const state = getConsent();
    if (state === "unset") {
      setVisible(true);
    } else if (state === "granted") {
      void initAnalytics();
    }
  }, []);

  if (!visible) return null;

  function choose(state: "granted" | "denied") {
    setConsent(state);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de datos"
      className="fixed bottom-0 inset-x-0 z-[70] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">🍪</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">
              ¿Nos ayudas a mejorar la app?
            </p>
            <p className="text-xs text-gray-700 mt-1">
              Usamos analítica anónima (Google Analytics) para entender qué
              secciones se usan más y mejorar la experiencia. No vendemos tus
              datos ni rastreamos fuera de la app. Puedes jugar igual si
              prefieres no compartirla.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => choose("granted")}
            className="flex-1 bg-[var(--pmfu-cobalt)] text-white text-sm font-bold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Aceptar analítica
          </button>
          <button
            onClick={() => choose("denied")}
            className="flex-1 bg-gray-100 text-gray-800 text-sm font-bold py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Solo lo esencial
          </button>
        </div>
      </div>
    </div>
  );
}
