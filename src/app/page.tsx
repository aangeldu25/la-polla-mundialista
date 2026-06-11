import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="pmfu-glass max-w-2xl w-full rounded-3xl p-10 md:p-14 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--pmfu-cobalt)]" />
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--pmfu-magenta)]" />
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--pmfu-lime)]" />
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--pmfu-orange)]" />
          <span className="ml-2 text-xs uppercase tracking-[0.25em] text-[var(--pmfu-cobalt)] font-bold">
            Mundial 2026
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-gray-900">
          Polla Mundialista
          <br />
          <span className="bg-gradient-to-r from-[var(--pmfu-cobalt)] via-[var(--pmfu-magenta)] to-[var(--pmfu-orange)] bg-clip-text text-transparent">
            Polla Mundialista 2026
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-gray-800 max-w-xl">
          Predice cada partido, compite con la familia y celebra cada gol. La
          polla del Mundial 2026, hecha en casa.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link
            href="/registro"
            className="px-6 py-3 rounded-full bg-[var(--pmfu-cobalt)] text-white font-semibold text-center hover:bg-[var(--pmfu-cobalt-dark)] transition-colors"
          >
            Crear cuenta
          </Link>
          <Link
            href="/ingresar"
            className="px-6 py-3 rounded-full border-2 border-[var(--pmfu-cobalt)]/40 text-[var(--pmfu-cobalt)] font-semibold text-center hover:bg-[var(--pmfu-cobalt)]/10 transition-colors"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-700">
          App familiar sin afiliación oficial con FIFA. Datos de partidos
          provistos por Football-Data.org.
        </p>
      </div>
    </main>
  );
}
