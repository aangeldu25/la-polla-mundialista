import type { FDMatchesResponse } from "./types";

const BASE = "https://api.football-data.org/v4";

function getApiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY no configurada");
  return key;
}

export async function fetchWorldCupMatches(): Promise<FDMatchesResponse> {
  const res = await fetch(`${BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": getApiKey() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Football-Data ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
    );
  }
  return res.json();
}
