"use client";

// Loader festivo: balón de fútbol rebotando con sombra.
// Reemplaza los spinners genéricos en las transiciones de pantalla completa.

export function BallLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 select-none">
      <div className="ball-bounce text-5xl leading-none" aria-hidden>
        ⚽
      </div>
      <div className="ball-shadow" aria-hidden />
      <p className="mt-4 text-sm font-bold text-gray-700 animate-pulse">
        {message ?? "Cargando..."}
      </p>
      <style jsx>{`
        .ball-bounce {
          animation: ball-bounce 0.6s cubic-bezier(0.28, 0.05, 0.42, 1) infinite
            alternate;
        }
        @keyframes ball-bounce {
          from {
            transform: translateY(-28px) rotate(-12deg);
          }
          to {
            transform: translateY(0) rotate(12deg);
          }
        }
        .ball-shadow {
          width: 44px;
          height: 8px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.18);
          animation: ball-shadow 0.6s cubic-bezier(0.28, 0.05, 0.42, 1)
            infinite alternate;
        }
        @keyframes ball-shadow {
          from {
            transform: scaleX(0.55);
            opacity: 0.35;
          }
          to {
            transform: scaleX(1);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}

// Pantalla completa de carga (auth, transiciones de página).
export function FullScreenLoader({ message }: { message?: string }) {
  return (
    <main className="min-h-dvh flex-1 flex items-center justify-center">
      <BallLoader message={message} />
    </main>
  );
}
