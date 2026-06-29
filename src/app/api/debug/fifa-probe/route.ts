import { NextResponse } from "next/server";

// Probe diagnóstico: ¿la red de salida de Vercel SÍ alcanza la API de FIFA+
// (api.fifa.com/fifaplusweb) y la oficial FDCP (givevoicetofootball)? Desde el
// entorno de desarrollo dan 503/TLS, pero la egress de producción es distinta.
// Si alguna responde 200 con datos, podemos evaluar sumarla como fuente.
//
// Solo lectura, sin secretos. Pensado para abrir manualmente:
//   /api/debug/fifa-probe
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TARGETS = [
  "https://api.fifa.com/fifaplusweb/api/sections/home?locale=en",
  "https://api.fifa.com/fifaplusweb/api/livescores?locale=en",
  "https://givevoicetofootball.fifa.com/api/v1/seasons/search?name=World%20Cup",
  "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&count=1&language=en",
];

async function probe(url: string) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (polla-mundialista probe)" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    return {
      url,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      contentType: res.headers.get("content-type"),
      sample: text.slice(0, 240),
    };
  } catch (e) {
    return {
      url,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: (e as Error).message,
    };
  }
}

export async function GET() {
  const results = await Promise.all(TARGETS.map(probe));
  return NextResponse.json(
    { ranAt: new Date().toISOString(), results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
