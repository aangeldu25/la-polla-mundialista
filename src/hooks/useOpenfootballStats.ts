"use client";

import { useEffect, useState } from "react";
import type {
  Scorer,
  GoalGems,
} from "@/lib/stats/openfootball";

interface State {
  scorers: Scorer[];
  gems: GoalGems | null;
  loading: boolean;
  error: boolean;
}

// Lee goleadores + joyas de goles desde nuestro API route (que cachea
// openfootball 15 min). Fire-and-forget; si falla, las tarjetas se ocultan.
export function useOpenfootballStats(): State {
  const [state, setState] = useState<State>({
    scorers: [],
    gems: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/stats/openfootball")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (j.ok) {
          setState({
            scorers: j.scorers ?? [],
            gems: j.gems ?? null,
            loading: false,
            error: false,
          });
        } else {
          setState((s) => ({ ...s, loading: false, error: true }));
        }
      })
      .catch(() => {
        if (active) setState((s) => ({ ...s, loading: false, error: true }));
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
