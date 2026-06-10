"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: "¡Bienvenido a la Polla Mundialista!",
    body: (
      <>
        <p className="text-gray-800">
          Predice los 104 partidos del Mundial 2026 y compite con la familia.
          Te explicamos cómo en 30 segundos.
        </p>
      </>
    ),
  },
  {
    title: "Puntos por partido",
    body: (
      <ul className="text-sm text-gray-800 space-y-2.5">
        <li>
          <strong className="text-gray-900">Marcador exacto:</strong> 3 puntos
          base.
        </li>
        <li>
          <strong className="text-gray-900">Ganador o empate correcto:</strong>{" "}
          1 punto base.
        </li>
        <li>
          <strong className="text-gray-900">Multiplicador por fase:</strong>{" "}
          Grupos x1 · 16avos y Octavos x2 · Cuartos x3 · Semis y 3° x4 · Final
          x5.
        </li>
        <li className="text-xs text-gray-700 pt-1 border-t border-gray-200 mt-2">
          Ej: marcador exacto de la final = 3 × 5 = 15 pts.
        </li>
      </ul>
    ),
  },
  {
    title: "Puntos por estructura del bracket",
    body: (
      <>
        <p className="text-sm text-gray-800 mb-2">
          Además de acertar marcadores, ganas puntos por armar bien tu bracket
          predicho:
        </p>
        <ul className="text-sm text-gray-800 space-y-2">
          <li>
            <strong className="text-gray-900">Clasificado a la ronda:</strong>{" "}
            la selección llegó a esa fase. 2 pts base.
          </li>
          <li>
            <strong className="text-gray-900">Acierto de Slot:</strong> tu
            selección está en la posición exacta del partido (local/visitante).
            3 pts base.
          </li>
          <li>
            <strong className="text-gray-900">Duelo Exacto:</strong> acertaste
            las dos selecciones del cruce. 5 pts base.
          </li>
        </ul>
        <p className="text-xs text-gray-700 mt-3 pt-2 border-t border-gray-200">
          Estos puntos también se multiplican por fase y el acierto mayor
          absorbe al menor (Duelo Exacto anula Slot y Clasificado).
        </p>
      </>
    ),
  },
  {
    title: "Bracket que se auto-completa",
    body: (
      <p className="text-sm text-gray-800">
        Al predecir los partidos de la fase de grupos, el sistema deriva
        automáticamente las selecciones que avanzarían a Dieciseisavos, Octavos,
        etc. Esos equipos aparecen automáticamente al abrir cada partido de
        eliminatorias. Si cambias una predicción de grupos, todo tu bracket se
        recalcula.
      </p>
    ),
  },
  {
    title: "Quinielas extras",
    body: (
      <ul className="text-sm text-gray-800 space-y-2">
        <li>🥇 <strong>Campeón:</strong> 15 puntos</li>
        <li>🥈 <strong>Subcampeón:</strong> 10 puntos</li>
        <li>🥉 <strong>Tercer puesto:</strong> 8 puntos</li>
        <li>⚽ <strong>Goleador del torneo:</strong> 10 puntos</li>
        <li>🌟 <strong>Balón de Oro:</strong> 8 puntos</li>
        <li>🧤 <strong>Guante de Oro:</strong> 6 puntos</li>
        <li className="text-xs text-gray-700 pt-1 border-t border-gray-200 mt-2">
          El Top 3 sale automáticamente de tus predicciones a los partidos 103
          y 104.
        </li>
      </ul>
    ),
  },
  {
    title: "Las 4 secciones de la app",
    body: (
      <ul className="text-sm text-gray-800 space-y-2.5">
        <li>
          <strong className="text-gray-900">🏠 Inicio:</strong> tu posición en
          el ranking y los partidos del día.
        </li>
        <li>
          <strong className="text-gray-900">⚽ Partidos:</strong> los 104
          partidos. Toca cualquiera para predecir.
        </li>
        <li>
          <strong className="text-gray-900">🏆 Quinielas:</strong> Goleador,
          Balón y Guante de Oro.
        </li>
        <li>
          <strong className="text-gray-900">📊 Ranking:</strong> tabla de
          posiciones de la familia.
        </li>
      </ul>
    ),
  },
  {
    title: "Cierre de predicciones",
    body: (
      <>
        <p className="text-sm text-gray-800">
          Puedes editar tus predicciones libremente{" "}
          <strong className="text-gray-900">
            hasta el inicio de cada partido
          </strong>
          . Cuando suena el pitazo inicial, tu marcador queda bloqueado.
        </p>
        <p className="text-sm text-gray-800 mt-3">
          Las quinielas extras se cierran al{" "}
          <strong className="text-gray-900">
            kickoff del partido inaugural
          </strong>{" "}
          (11 de junio 2026, 4:00 p.m. hora Colombia).
        </p>
      </>
    ),
  },
];

export function WelcomeTutorial() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  // Solo mostrar si el perfil existe y NO ha completado el tutorial
  const open =
    !!profile && profile.tutorialCompleted !== true && !closing;

  async function markCompleted() {
    if (!user) return;
    setClosing(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { tutorialCompleted: true },
        { merge: true },
      );
    } catch (e) {
      console.error("[tutorial]", e);
    }
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      void markCompleted();
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Modal open={open} onClose={markCompleted}>
      <div className="p-6 md:p-7">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step
                  ? "w-6 bg-[var(--pmfu-cobalt)]"
                  : i < step
                    ? "w-1.5 bg-[var(--pmfu-cobalt)]/60"
                    : "w-1.5 bg-gray-300",
              )}
            />
          ))}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
          {current.title}
        </h2>
        <div className="mb-6">{current.body}</div>

        <div className="flex gap-2">
          {step > 0 && (
            <Button onClick={back} variant="secondary" className="flex-1">
              Atrás
            </Button>
          )}
          <Button onClick={next} className="flex-1">
            {isLast ? "Empezar a jugar" : "Siguiente"}
          </Button>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={markCompleted}
            className="block w-full text-xs text-gray-600 hover:text-gray-900 mt-3 font-medium"
          >
            Saltar tutorial
          </button>
        )}
      </div>
    </Modal>
  );
}
