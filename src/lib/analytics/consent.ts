"use client";

// Consentimiento de analítica (estilo GDPR/LPDP):
// - Firebase Analytics SOLO se inicializa si el usuario acepta.
// - La elección persiste en localStorage; "rechazar" nunca carga analytics.

import { firebaseApp } from "@/lib/firebase/client";

const CONSENT_KEY = "pm2026.analyticsConsent"; // "granted" | "denied"

export type ConsentState = "granted" | "denied" | "unset";

export function getConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "granted" || v === "denied") return v;
  return "unset";
}

export function setConsent(state: "granted" | "denied"): void {
  localStorage.setItem(CONSENT_KEY, state);
  if (state === "granted") void initAnalytics();
}

let initialized = false;

// Inicializa Firebase Analytics (GA4) solo tras consentimiento explícito.
export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (getConsent() !== "granted") return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) {
      getAnalytics(firebaseApp);
      initialized = true;
    }
  } catch (e) {
    console.warn("[analytics] no se pudo inicializar", e);
  }
}
