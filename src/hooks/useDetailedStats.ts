"use client";

import { useEffect, useState } from "react";
import type { DetailedStats } from "@/lib/stats/wcDataset";

interface State {
  data: DetailedStats | null;
  loading: boolean;
  error: boolean;
}

// Lee las estadísticas detalladas (posesión, tarjetas, faltas, disparos, xG…)
// desde nuestro API route cacheado. Fire-and-forget: si falla o no hay datos,
// las secciones simplemente se ocultan.
export function useDetailedStats(): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/stats/detailed")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (j.ok) {
          setState({ data: j as DetailedStats, loading: false, error: false });
        } else {
          setState({ data: null, loading: false, error: true });
        }
      })
      .catch(() => {
        if (active) setState({ data: null, loading: false, error: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
