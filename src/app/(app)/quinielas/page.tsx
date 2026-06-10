"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Flag } from "@/components/ui/Flag";
import { PlayerSelect } from "@/components/predictions/PlayerSelect";
import { QuinielaChisme } from "@/components/predictions/QuinielaChisme";
import { SameAsBadge } from "@/components/predictions/SameAsBadge";
import { SameAsModal } from "@/components/predictions/SameAsModal";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { findPlayer } from "@/lib/constants/wc2026-players";
import { db } from "@/lib/firebase/client";
import {
  useMyPredictions,
  useProfilesForUids,
  useAllPredictionsForMatches,
  useAllPredictionsForUsers,
} from "@/hooks/usePredictions";
import {
  saveSpecialPrediction,
  persistLockedTop3,
  isQuinielaLocked,
  TOURNAMENT_START_UTC,
  type SpecialPredictionDraft,
} from "@/lib/predictions/special-actions";
import {
  useMySpecialPrediction,
  useSpecialPredictionsForUids,
} from "@/hooks/useSpecialPredictions";
import { useActivePolla } from "@/components/polla/ActivePollaProvider";
import { computeAllGroupStandings } from "@/lib/standings/group-standings";
import { computeDerivedBracket } from "@/lib/standings/knockout-cascade";
import type {
  Match,
  MatchPrediction,
  UserProfile,
} from "@/types/domain";

const EMPTY_DRAFT: SpecialPredictionDraft = {
  topScorerName: null,
  goldenBallName: null,
  goldenGloveName: null,
};

const POINTS = {
  CHAMPION: 15,
  RUNNER_UP: 10,
  THIRD: 8,
  TOP_SCORER: 10,
  GOLDEN_BALL: 8,
  GOLDEN_GLOVE: 6,
};

export default function QuinielasPage() {
  const { user } = useAuth();
  const { data: existing, loading } = useMySpecialPrediction(user?.uid);
  const { predictions: myMatchPredictions } = useMyPredictions(user?.uid);
  const [matches, setMatches] = useState<Match[]>([]);
  const { memberUids } = useActivePolla();
  const profiles = useProfilesForUids(memberUids);
  const { list: allSpecials } = useSpecialPredictionsForUids(memberUids);

  const [draft, setDraft] = useState<SpecialPredictionDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [modal, setModal] = useState<{
    title: string;
    pickLabel: string;
    users: UserProfile[];
  } | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "matches"), orderBy("utcDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map((d) => d.data() as Match));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (existing) {
      setDraft({
        topScorerName: existing.topScorerName ?? null,
        goldenBallName: existing.goldenBallName ?? null,
        goldenGloveName: existing.goldenGloveName ?? null,
      });
    }
  }, [existing]);

  const finalMatch = useMemo(
    () => matches.find((m) => m.matchNumber === 104),
    [matches],
  );
  const bronzeMatch = useMemo(
    () => matches.find((m) => m.matchNumber === 103),
    [matches],
  );

  // Predicciones de TODOS los usuarios para los partidos 103 y 104
  const matchIdsForTop3 = useMemo(() => {
    const ids: string[] = [];
    if (finalMatch) ids.push(finalMatch.id);
    if (bronzeMatch) ids.push(bronzeMatch.id);
    return ids;
  }, [finalMatch, bronzeMatch]);

  const allUserPredictionsByMatch = useAllPredictionsForMatches(matchIdsForTop3);

  // Para comparar el Top 3 de cada familiar necesitamos su bracket cascade
  // completo (predicciones de TODOS sus partidos, no solo #103/#104).
  const otherUids = useMemo(() => {
    const memberSet = new Set(memberUids);
    return Array.from(allUserPredictionsByMatch.keys()).filter(
      (uid) => uid !== user?.uid && memberSet.has(uid),
    );
  }, [allUserPredictionsByMatch, user?.uid, memberUids]);
  const allUserFullPredictions = useAllPredictionsForUsers(otherUids);

  const finalPrediction = finalMatch
    ? myMatchPredictions.get(finalMatch.id)
    : undefined;
  const bronzePrediction = bronzeMatch
    ? myMatchPredictions.get(bronzeMatch.id)
    : undefined;

  // Equipos derivados de los partidos 103/104 usando el bracket cascade del
  // usuario actual (puesto que los partidos 103/104 no tienen homeTeam/awayTeam
  // oficiales hasta que la FIFA los publique tras Semis).
  const myDerivedBracket = useMemo(() => {
    if (matches.length === 0) return null;
    const standings = computeAllGroupStandings(matches, myMatchPredictions);
    return computeDerivedBracket(matches, myMatchPredictions, standings);
  }, [matches, myMatchPredictions]);

  const derivedTop3 = useMemo(() => {
    // Si ya hay snapshot bloqueado, usarlo siempre
    if (existing?.lockedTop3) {
      return {
        championTla: existing.lockedTop3.championTla,
        runnerUpTla: existing.lockedTop3.runnerUpTla,
        thirdTla: existing.lockedTop3.thirdTla,
        finalIsTBD: false,
        bronzeIsTBD: false,
        finalPredicted: true,
        bronzePredicted: true,
      };
    }
    return computeTop3(
      finalMatch,
      finalPrediction,
      bronzeMatch,
      bronzePrediction,
      myDerivedBracket,
    );
  }, [
    existing?.lockedTop3,
    finalMatch,
    finalPrediction,
    bronzeMatch,
    bronzePrediction,
    myDerivedBracket,
  ]);

  // Snapshot lazy: si está bloqueado pero aún no se persistió, hacerlo una vez.
  const locked = isQuinielaLocked();
  useEffect(() => {
    if (!user) return;
    if (!locked) return;
    if (existing?.lockedTop3) return;
    if (loading) return;
    if (!myDerivedBracket) return;
    // Solo persistir si tenemos algo significativo (al menos uno definido)
    if (
      derivedTop3.championTla === null &&
      derivedTop3.runnerUpTla === null &&
      derivedTop3.thirdTla === null
    ) {
      return;
    }
    void persistLockedTop3(user.uid, {
      championTla: derivedTop3.championTla,
      runnerUpTla: derivedTop3.runnerUpTla,
      thirdTla: derivedTop3.thirdTla,
    });
  }, [
    user,
    locked,
    existing?.lockedTop3,
    loading,
    myDerivedBracket,
    derivedTop3.championTla,
    derivedTop3.runnerUpTla,
    derivedTop3.thirdTla,
  ]);

  // Pre-cómputo: para cada otro usuario, derivar SU bracket cascade y SU Top 3.
  const otherUsersTop3 = useMemo(() => {
    const out = new Map<string, DerivedTop3Result>();
    if (matches.length === 0) return out;
    for (const [uid, preds] of allUserFullPredictions.entries()) {
      const standings = computeAllGroupStandings(matches, preds);
      const bracket = computeDerivedBracket(matches, preds, standings);
      const finalP = finalMatch ? preds.get(finalMatch.id) : undefined;
      const bronzeP = bronzeMatch ? preds.get(bronzeMatch.id) : undefined;
      out.set(
        uid,
        computeTop3(finalMatch, finalP, bronzeMatch, bronzeP, bracket),
      );
    }
    return out;
  }, [matches, allUserFullPredictions, finalMatch, bronzeMatch]);

  function findUsersWithSameTeam(
    field: "championTla" | "runnerUpTla" | "thirdTla",
    myValue: string | null,
  ): UserProfile[] {
    if (!myValue || !user) return [];
    const result: UserProfile[] = [];
    for (const [uid, theirTop3] of otherUsersTop3.entries()) {
      if (uid === user.uid) continue;
      if (theirTop3[field] === myValue) {
        const prof = profiles.get(uid);
        if (prof) result.push(prof);
      }
    }
    return result;
  }

  function findUsersWithSamePlayer(
    field: "topScorerName" | "goldenBallName" | "goldenGloveName",
    myValue: string | null,
  ): UserProfile[] {
    if (!myValue || !user) return [];
    const result: UserProfile[] = [];
    for (const sp of allSpecials) {
      if (sp.uid === user.uid) continue;
      if (sp[field] === myValue) {
        const prof = profiles.get(sp.uid);
        if (prof) result.push(prof);
      }
    }
    return result;
  }

  const sameChampion = useMemo(
    () => findUsersWithSameTeam("championTla", derivedTop3.championTla),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [otherUsersTop3, profiles, derivedTop3.championTla, user?.uid],
  );
  const sameRunnerUp = useMemo(
    () => findUsersWithSameTeam("runnerUpTla", derivedTop3.runnerUpTla),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [otherUsersTop3, profiles, derivedTop3.runnerUpTla, user?.uid],
  );
  const sameThird = useMemo(
    () => findUsersWithSameTeam("thirdTla", derivedTop3.thirdTla),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [otherUsersTop3, profiles, derivedTop3.thirdTla, user?.uid],
  );
  const sameTopScorer = useMemo(
    () => findUsersWithSamePlayer("topScorerName", draft.topScorerName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSpecials, profiles, draft.topScorerName, user?.uid],
  );
  const sameGoldenBall = useMemo(
    () => findUsersWithSamePlayer("goldenBallName", draft.goldenBallName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSpecials, profiles, draft.goldenBallName, user?.uid],
  );
  const sameGoldenGlove = useMemo(
    () => findUsersWithSamePlayer("goldenGloveName", draft.goldenGloveName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSpecials, profiles, draft.goldenGloveName, user?.uid],
  );

  const tournamentStart = new Date(TOURNAMENT_START_UTC);

  function patch<K extends keyof SpecialPredictionDraft>(
    key: K,
    value: SpecialPredictionDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMsg(null);
  }

  function openModal(
    title: string,
    pickLabel: string,
    users: UserProfile[],
  ) {
    setModal({ title, pickLabel, users });
  }

  async function handleSave() {
    if (!user) return;
    setMsg(null);
    setSaving(true);
    try {
      await saveSpecialPrediction(user.uid, draft);
      setMsg({ type: "ok", text: "Quiniela guardada" });
    } catch (e) {
      const err = e as Error;
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--pmfu-cobalt)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="px-4 md:px-6 py-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Quinielas extras
        </h1>
        <p className="mt-1 text-gray-800 font-medium">
          Premios especiales para complementar tus predicciones de partidos.
        </p>
        <StatusBar
          locked={locked}
          tournamentStart={tournamentStart}
          existing={!!existing}
        />
      </div>

      <Card>
        <CardHeader
          title="Tu Top 3 según tu fixture"
          subtitle="Se calcula automáticamente desde tus predicciones de los partidos 103 y 104."
        />
        <DerivedTop3
          derived={derivedTop3}
          sameChampion={sameChampion}
          sameRunnerUp={sameRunnerUp}
          sameThird={sameThird}
          onOpenModal={openModal}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Premios individuales"
          subtitle={
            locked
              ? "Las quinielas se cerraron al kickoff del partido inaugural."
              : "Edita libremente hasta el 11 de junio. Después queda bloqueada."
          }
        />

        <section className="space-y-5">
          <PlayerPickRow
            label="⚽ Goleador del torneo"
            points={POINTS.TOP_SCORER}
            value={draft.topScorerName}
            onChange={(id) => patch("topScorerName", id)}
            disabled={locked}
            sameUsers={sameTopScorer}
            onOpenModal={() =>
              openModal(
                "Mismo goleador",
                playerLabel(draft.topScorerName),
                sameTopScorer,
              )
            }
          />
          <PlayerPickRow
            label="🌟 Balón de Oro (mejor jugador)"
            points={POINTS.GOLDEN_BALL}
            value={draft.goldenBallName}
            onChange={(id) => patch("goldenBallName", id)}
            disabled={locked}
            sameUsers={sameGoldenBall}
            onOpenModal={() =>
              openModal(
                "Mismo Balón de Oro",
                playerLabel(draft.goldenBallName),
                sameGoldenBall,
              )
            }
          />
          <PlayerPickRow
            label="🧤 Guante de Oro (mejor portero)"
            points={POINTS.GOLDEN_GLOVE}
            value={draft.goldenGloveName}
            onChange={(id) => patch("goldenGloveName", id)}
            disabled={locked}
            goalkeepersOnly
            sameUsers={sameGoldenGlove}
            onOpenModal={() =>
              openModal(
                "Mismo Guante de Oro",
                playerLabel(draft.goldenGloveName),
                sameGoldenGlove,
              )
            }
          />
        </section>

        {msg && (
          <p
            className={
              msg.type === "ok"
                ? "text-sm font-bold text-[var(--pmfu-mint)] mt-4"
                : "text-sm font-bold text-[var(--pmfu-magenta)] mt-4"
            }
          >
            {msg.text}
          </p>
        )}

        {!locked && (
          <Button
            onClick={handleSave}
            loading={saving}
            className="w-full mt-6"
            size="lg"
          >
            {existing ? "Actualizar quiniela" : "Guardar quiniela"}
          </Button>
        )}
      </Card>

      {locked && <QuinielaChisme currentUid={user.uid} />}

      <SameAsModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.title ?? ""}
        pickLabel={modal?.pickLabel ?? ""}
        users={modal?.users ?? []}
      />
    </main>
  );
}

function playerLabel(id: string | null): string {
  if (!id) return "—";
  const p = findPlayer(id);
  return p ? `${p.name} (${p.teamTla})` : id;
}

function teamLabel(tla: string | null): string {
  if (!tla) return "—";
  const t = TEAMS_BY_TLA[tla];
  return t ? t.name : tla;
}

interface DerivedTop3Result {
  championTla: string | null;
  runnerUpTla: string | null;
  thirdTla: string | null;
  finalIsTBD: boolean;
  bronzeIsTBD: boolean;
  finalPredicted: boolean;
  bronzePredicted: boolean;
}

function computeTop3(
  finalMatch: Match | undefined,
  finalPrediction: MatchPrediction | undefined,
  bronzeMatch: Match | undefined,
  bronzePrediction: MatchPrediction | undefined,
  derivedBracket: Map<number, { homeTla: string | null; awayTla: string | null }> | null,
): DerivedTop3Result {
  // Resolver equipos del Final (#104): preferir oficial (TLA no vacío),
  // luego derivado del cascade del usuario. OJO: los matches TBD tienen
  // tla === "" (no null), así que normalizamos.
  const officialOrNull = (s: string | null | undefined) =>
    s && s.length > 0 ? s : null;
  const finalDerived = derivedBracket?.get(104);
  const finalHomeTla =
    officialOrNull(finalMatch?.homeTeam.tla) ?? finalDerived?.homeTla ?? null;
  const finalAwayTla =
    officialOrNull(finalMatch?.awayTeam.tla) ?? finalDerived?.awayTla ?? null;
  const finalHasTeams = !!(finalHomeTla && finalAwayTla);

  // Resolver equipos del Tercer puesto (#103) igual
  const bronzeDerived = derivedBracket?.get(103);
  const bronzeHomeTla =
    officialOrNull(bronzeMatch?.homeTeam.tla) ?? bronzeDerived?.homeTla ?? null;
  const bronzeAwayTla =
    officialOrNull(bronzeMatch?.awayTeam.tla) ?? bronzeDerived?.awayTla ?? null;
  const bronzeHasTeams = !!(bronzeHomeTla && bronzeAwayTla);

  let championTla: string | null = null;
  let runnerUpTla: string | null = null;
  if (finalHasTeams && finalPrediction) {
    if (finalPrediction.homeScore > finalPrediction.awayScore) {
      championTla = finalHomeTla;
      runnerUpTla = finalAwayTla;
    } else if (finalPrediction.awayScore > finalPrediction.homeScore) {
      championTla = finalAwayTla;
      runnerUpTla = finalHomeTla;
    } else if (finalPrediction.advancingTeamTla) {
      // empate con elección de ganador por penales
      championTla = finalPrediction.advancingTeamTla;
      runnerUpTla =
        finalPrediction.advancingTeamTla === finalHomeTla
          ? finalAwayTla
          : finalHomeTla;
    }
  }

  let thirdTla: string | null = null;
  if (bronzeHasTeams && bronzePrediction) {
    if (bronzePrediction.homeScore > bronzePrediction.awayScore) {
      thirdTla = bronzeHomeTla;
    } else if (bronzePrediction.awayScore > bronzePrediction.homeScore) {
      thirdTla = bronzeAwayTla;
    } else if (bronzePrediction.advancingTeamTla) {
      thirdTla = bronzePrediction.advancingTeamTla;
    }
  }

  return {
    championTla,
    runnerUpTla,
    thirdTla,
    finalIsTBD: !finalHasTeams,
    bronzeIsTBD: !bronzeHasTeams,
    finalPredicted: !!finalPrediction,
    bronzePredicted: !!bronzePrediction,
  };
}

function DerivedTop3({
  derived,
  sameChampion,
  sameRunnerUp,
  sameThird,
  onOpenModal,
}: {
  derived: DerivedTop3Result;
  sameChampion: UserProfile[];
  sameRunnerUp: UserProfile[];
  sameThird: UserProfile[];
  onOpenModal: (title: string, pickLabel: string, users: UserProfile[]) => void;
}) {
  const rows: Array<{
    medal: string;
    label: string;
    tla: string | null;
    points: number;
    note?: string;
    sameUsers: UserProfile[];
    title: string;
  }> = [
    {
      medal: "🥇",
      label: "Campeón",
      tla: derived.championTla,
      points: POINTS.CHAMPION,
      sameUsers: sameChampion,
      title: "Mismo Campeón",
      note: derived.finalIsTBD
        ? "Equipos del partido 104 aún por definir"
        : !derived.finalPredicted
          ? "Predice el marcador del partido 104 (Final)"
          : derived.championTla === null
            ? "Tu predicción del partido 104 es empate — necesitas un ganador"
            : undefined,
    },
    {
      medal: "🥈",
      label: "Subcampeón",
      tla: derived.runnerUpTla,
      points: POINTS.RUNNER_UP,
      sameUsers: sameRunnerUp,
      title: "Mismo Subcampeón",
      note: derived.finalIsTBD
        ? "Equipos del partido 104 aún por definir"
        : !derived.finalPredicted
          ? "Predice el marcador del partido 104 (Final)"
          : undefined,
    },
    {
      medal: "🥉",
      label: "Tercer puesto",
      tla: derived.thirdTla,
      points: POINTS.THIRD,
      sameUsers: sameThird,
      title: "Mismo Tercer puesto",
      note: derived.bronzeIsTBD
        ? "Equipos del partido 103 aún por definir"
        : !derived.bronzePredicted
          ? "Predice el marcador del partido 103 (Tercer lugar)"
          : derived.thirdTla === null
            ? "Tu predicción del partido 103 es empate — necesitas un ganador"
            : undefined,
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const team = r.tla ? TEAMS_BY_TLA[r.tla] : null;
        return (
          <div
            key={r.label}
            className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl"
          >
            <span className="text-xl leading-none mt-0.5">{r.medal}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">{r.label}</p>
              {team ? (
                <>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Flag iso2={team.iso2} size={20} alt={team.name} />
                    <span className="font-semibold text-gray-900">
                      {team.name}
                    </span>
                  </div>
                  <div className="mt-1">
                    <SameAsBadge
                      count={r.sameUsers.length}
                      pickIsEmpty={!r.tla}
                      onClick={() =>
                        onOpenModal(r.title, teamLabel(r.tla), r.sameUsers)
                      }
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-700 italic mt-0.5">
                  {r.note ?? "—"}
                </p>
              )}
            </div>
            <span className="text-xs font-bold text-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10 px-2 py-1 rounded-full whitespace-nowrap shrink-0">
              {r.points} pts
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerPickRow({
  label,
  points,
  value,
  onChange,
  disabled,
  goalkeepersOnly,
  sameUsers,
  onOpenModal,
}: {
  label: string;
  points: number;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  goalkeepersOnly?: boolean;
  sameUsers: UserProfile[];
  onOpenModal: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="text-xs font-bold text-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10 px-2 py-1 rounded-full whitespace-nowrap">
          {points} pts
        </span>
      </div>
      <PlayerSelect
        value={value}
        onChange={onChange}
        label=""
        disabled={disabled}
        goalkeepersOnly={goalkeepersOnly}
      />
      <div className="mt-1.5">
        <SameAsBadge
          count={sameUsers.length}
          pickIsEmpty={!value}
          onClick={onOpenModal}
        />
      </div>
    </div>
  );
}

function StatusBar({
  locked,
  tournamentStart,
  existing,
}: {
  locked: boolean;
  tournamentStart: Date;
  existing: boolean;
}) {
  if (locked) {
    return (
      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm font-bold">
        🔒 Quinielas bloqueadas
      </div>
    );
  }
  return (
    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--pmfu-orange)]/15 text-[var(--pmfu-orange)] text-sm font-bold">
      ⏱ Cierra el{" "}
      {format(tournamentStart, "d 'de' MMMM 'a las' h:mm a", { locale: es })}
      {existing && (
        <span className="ml-2 text-[var(--pmfu-mint)]">✓ Ya guardada</span>
      )}
    </div>
  );
}
