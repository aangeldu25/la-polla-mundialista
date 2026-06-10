"use client";

import confetti from "canvas-confetti";

// Paleta PMFU para que el confeti tenga la misma identidad visual
const PMFU_COLORS = [
  "#0033a0", // cobalto
  "#e6007e", // magenta
  "#c8e21c", // lima
  "#ff7a1a", // naranja
  "#00c389", // mint
  "#ffffff",
];

export function fireConfetti(
  intensity: "small" | "medium" | "large" = "medium",
) {
  if (typeof window === "undefined") return;

  const configs = {
    small: {
      particleCount: 35,
      spread: 50,
      startVelocity: 25,
      decay: 0.93,
    },
    medium: {
      particleCount: 100,
      spread: 75,
      startVelocity: 40,
      decay: 0.92,
    },
    large: {
      particleCount: 200,
      spread: 100,
      startVelocity: 50,
      decay: 0.91,
    },
  };

  confetti({
    ...configs[intensity],
    origin: { y: 0.65 },
    colors: PMFU_COLORS,
    ticks: 200,
    gravity: 1,
    scalar: intensity === "large" ? 1.2 : 1,
  });
}

// "Fireworks" — múltiples ráfagas desde puntos aleatorios.
// Para celebrar logros grandes: marcador exacto, partido ganado, etc.
export function fireFireworks(durationMs = 2500) {
  if (typeof window === "undefined") return;

  const end = Date.now() + durationMs;
  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval);
      return;
    }
    confetti({
      particleCount: 60,
      spread: 70,
      origin: {
        x: Math.random(),
        y: Math.random() * 0.5 + 0.15,
      },
      colors: PMFU_COLORS,
      ticks: 150,
      startVelocity: 35,
    });
  }, 220);
}

// Burst desde un lado al otro de la pantalla. Útil para "saves"
export function fireSideCannons() {
  if (typeof window === "undefined") return;

  const defaults = {
    spread: 360,
    ticks: 80,
    gravity: 0.8,
    decay: 0.94,
    startVelocity: 35,
    colors: PMFU_COLORS,
  };

  confetti({ ...defaults, particleCount: 60, origin: { x: 0.1, y: 0.7 } });
  confetti({ ...defaults, particleCount: 60, origin: { x: 0.9, y: 0.7 } });
}
