"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ScoreStepper } from "./ScoreStepper";
import { ChismeList, kickoffCountdown } from "./ChismeList";
import { Flag } from "@/components/ui/Flag";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  useMatchPredictions,
  useMyPredictions,
} from "@/hooks/usePredictions";
import { savePrediction } from "@/lib/predictions/actions";
import { fireConfetti, fireFireworks } from "@/lib/festive/confetti";
import { TEAMS_BY_TLA } from "@/lib/constants/wc2026-teams";
import { useDerivedBracket } from "@/hooks/useDerivedBracket";
import { computeRealKnockoutProjection } from "@/lib/stats/r32-projection";
import { BRACKET_BY_MATCH_NUMBER } from "@/lib/constants/wc2026-bracket";
import { venueForMatch } from "@/lib/constants/wc2026-fixture-venues";
import type { Match } from "@/types/domain";
import { cn } from "@/lib/utils";

export function PredictionModal({
  match,
  open,
  onClose,
}: {
  match: Match | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { predictions } = useMatchPredictions(match?.id ?? null);
  const { predictions: myPredictions } = useMyPredictions(user?.uid);
  const { bracket: derivedBracket, matches } = useDerivedBracket(user?.uid);

  const myPrediction = match ? myPredictions.get(match.id) : undefined;

  // Proyección REAL de toda la eliminatoria (grupos → ganadores en cascada).
  const realR32 = useMemo(
    () => computeRealKnockoutProjection(matches),
    [matches],
  );

  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  // Empates en eliminatorias — DOS elecciones independientes:
  //  • advancingTla: quién avanza en TU BRACKET (alimenta estructura/cascade)
  //  • realAdvancingTla: quién avanza en el PARTIDO REAL (informativo)
  const [advancingTla, setAdvancingTla] = useState<string | null>(null);
  const [realAdvancingTla, setRealAdvancingTla] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // tick para refrescar "cierra en X" cada minuto
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (myPrediction) {
      setHome(myPrediction.homeScore);
      setAway(myPrediction.awayScore);
      setAdvancingTla(myPrediction.advancingTeamTla ?? null);
      setRealAdvancingTla(myPrediction.realAdvancingTla ?? null);
    } else {
      setHome(0);
      setAway(0);
      setAdvancingTla(null);
      setRealAdvancingTla(null);
    }
    setError(null);
    setSavedAt(null);
  }, [myPrediction, match?.id]);

  // Hook para celebrar marcador exacto — DEBE estar antes del early return
  // (regla de React Hooks: mismo número de hooks en cada render).
  const [celebratedExact, setCelebratedExact] = useState(false);
  useEffect(() => {
    if (!match || !myPrediction || celebratedExact) return;
    if (match.status !== "FINISHED") return;
    const isExact =
      myPrediction.homeScore === match.score.homeFullTime &&
      myPrediction.awayScore === match.score.awayFullTime;
    if (isExact) {
      setCelebratedExact(true);
      fireFireworks(2000);
    }
  }, [match, myPrediction, celebratedExact]);

  // Reset del flag de celebración al cambiar de partido
  useEffect(() => {
    setCelebratedExact(false);
  }, [match?.id]);

  if (!match) return null;

  const kickoff = new Date(match.utcDate);
  const locked = Date.now() >= kickoff.getTime();
  const isKnockout = match.stage !== "GROUP";
  const officialHome = TEAMS_BY_TLA[match.homeTeam.tla];
  const officialAway = TEAMS_BY_TLA[match.awayTeam.tla];
  const bracket =
    match.matchNumber !== undefined
      ? BRACKET_BY_MATCH_NUMBER[match.matchNumber]
      : undefined;

  // === Equipos REALES (la llave que se juega) ===
  // Oficial (post-sorteo) > Proyección real desde resultados de grupos (R32).
  const proj =
    match.matchNumber !== undefined ? realR32.get(match.matchNumber) : undefined;
  const realHomeTla = officialHome
    ? officialHome.tla
    : (proj?.homeTla ?? null);
  const realAwayTla = officialAway
    ? officialAway.tla
    : (proj?.awayTla ?? null);
  const realHome = realHomeTla ? TEAMS_BY_TLA[realHomeTla] : undefined;
  const realAway = realAwayTla ? TEAMS_BY_TLA[realAwayTla] : undefined;
  const realHomeConfirmed = officialHome ? true : (proj?.homeConfirmed ?? false);
  const realAwayConfirmed = officialAway ? true : (proj?.awayConfirmed ?? false);
  const hasRealTeams = !!(realHome || realAway);

  // === Equipos del BRACKET del usuario (referencia, alimenta estructura) ===
  const derivedSlot =
    match.matchNumber !== undefined
      ? derivedBracket.get(match.matchNumber)
      : undefined;
  const bracketHome = derivedSlot?.homeTla
    ? TEAMS_BY_TLA[derivedSlot.homeTla]
    : undefined;
  const bracketAway = derivedSlot?.awayTla
    ? TEAMS_BY_TLA[derivedSlot.awayTla]
    : undefined;
  const hasBracketTeams = !!(bracketHome || bracketAway);

  // ¿La llave real coincide con tu bracket? Si sí, una sola elección de avance.
  const bracketMatchesReal =
    hasRealTeams &&
    hasBracketTeams &&
    realHome?.tla === bracketHome?.tla &&
    realAway?.tla === bracketAway?.tla;

  // Equipos PRIMARIOS a mostrar: reales si existen, si no el bracket (fallback).
  const homeTeam = hasRealTeams ? realHome : bracketHome;
  const awayTeam = hasRealTeams ? realAway : bracketAway;
  const homeLabel =
    homeTeam?.name ??
    match.homeLabel ??
    bracket?.homeLabel ??
    match.homeTeam.name;
  const awayLabel =
    awayTeam?.name ??
    match.awayLabel ??
    bracket?.awayLabel ??
    match.awayTeam.name;
  // Difuminado del bloque primario: si son reales pero aún provisionales.
  const homeProvisional = hasRealTeams && !realHomeConfirmed && !officialHome;
  const awayProvisional = hasRealTeams && !realAwayConfirmed && !officialAway;
  // Bandera de "según tu bracket" solo si caemos al bracket (sin equipos reales).
  const showingBracketAsPrimary = !hasRealTeams && hasBracketTeams;

  const venue = venueForMatch(match.matchNumber);
  const venueLine = [venue?.city, venue?.stadium]
    .filter(Boolean)
    .join(" · ");

  async function handleSave() {
    if (!user || !match) return;
    setError(null);
    const isDraw = home === away;

    // Validación de empate en eliminatorias: hay que elegir quién avanza.
    if (isKnockout && isDraw) {
      if (hasRealTeams && !realAdvancingTla) {
        setError(
          "Empate: elige qué equipo avanza por penales en el partido real.",
        );
        return;
      }
    }

    setSaving(true);
    try {
      // Si la llave real coincide con tu bracket, una sola elección sirve para
      // ambos campos.
      const bracketAdvance =
        isKnockout && isDraw
          ? bracketMatchesReal
            ? realAdvancingTla
            : advancingTla
          : null;
      await savePrediction({
        uid: user.uid,
        matchId: match.id,
        homeScore: home,
        awayScore: away,
        advancingTeamTla: bracketAdvance,
        realAdvancingTla: isKnockout && isDraw ? realAdvancingTla : null,
      });
      setSavedAt(Date.now());
      fireConfetti("small");
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-5 md:p-6">
        {/* Encabezado */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-gray-700">
              {match.group && `Grupo ${match.group}`}
              {match.matchNumber && (
                <span className="text-gray-500 ml-2">
                  Partido #{match.matchNumber}
                </span>
              )}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-700"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-700 font-semibold">
            {format(kickoff, "EEEE d 'de' MMMM · h:mm a", { locale: es })}
          </p>
          {venueLine && (
            <p className="text-xs text-gray-700">📍 {venueLine}</p>
          )}
          {showingBracketAsPrimary && (
            <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10 inline-block px-2 py-1 rounded-full">
              ⚡ Aún sin definir — equipos según tu bracket
            </div>
          )}
        </div>

        {/* Equipos PRIMARIOS (la llave real) + steppers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-5">
          <TeamColumn
            iso2={homeTeam?.iso2}
            name={homeLabel}
            tla={homeTeam?.tla ?? match.homeTeam.tla}
            status={
              !hasRealTeams
                ? null
                : homeProvisional
                  ? "provisional"
                  : realHomeConfirmed
                    ? "confirmed"
                    : null
            }
          />
          <span className="text-xl font-bold text-gray-400">vs</span>
          <TeamColumn
            iso2={awayTeam?.iso2}
            name={awayLabel}
            tla={awayTeam?.tla ?? match.awayTeam.tla}
            status={
              !hasRealTeams
                ? null
                : awayProvisional
                  ? "provisional"
                  : realAwayConfirmed
                    ? "confirmed"
                    : null
            }
          />
        </div>

        {/* Steppers */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <ScoreStepper value={home} onChange={setHome} disabled={locked} />
          <ScoreStepper value={away} onChange={setAway} disabled={locked} />
        </div>

        {/* Empate: quién avanza en el PARTIDO REAL (cuando hay equipos reales) */}
        {isKnockout && home === away && !locked && hasRealTeams && (
          <div className="bg-[var(--pmfu-orange)]/10 border border-[var(--pmfu-orange)]/30 rounded-xl p-3 mb-4">
            <p className="text-xs font-bold text-gray-900 mb-2">
              🟰 Empate en eliminatoria — ¿quién avanza por penales?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <AdvanceButton
                tla={realHomeTla ?? ""}
                label={realHome?.name ?? homeLabel}
                iso2={realHome?.iso2}
                selected={realAdvancingTla === realHomeTla}
                onClick={() => setRealAdvancingTla(realHomeTla)}
              />
              <AdvanceButton
                tla={realAwayTla ?? ""}
                label={realAway?.name ?? awayLabel}
                iso2={realAway?.iso2}
                selected={realAdvancingTla === realAwayTla}
                onClick={() => setRealAdvancingTla(realAwayTla)}
              />
            </div>
          </div>
        )}

        {/* Empate: quién avanza (FALLBACK al bracket cuando aún no hay reales) */}
        {isKnockout && home === away && !locked && !hasRealTeams && hasBracketTeams && (
          <div className="bg-[var(--pmfu-orange)]/10 border border-[var(--pmfu-orange)]/30 rounded-xl p-3 mb-4">
            <p className="text-xs font-bold text-gray-900 mb-2">
              🟰 Empate en eliminatoria — ¿quién avanza?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <AdvanceButton
                tla={bracketHome?.tla ?? ""}
                label={bracketHome?.name ?? homeLabel}
                iso2={bracketHome?.iso2}
                selected={advancingTla === bracketHome?.tla}
                onClick={() => setAdvancingTla(bracketHome?.tla ?? null)}
              />
              <AdvanceButton
                tla={bracketAway?.tla ?? ""}
                label={bracketAway?.name ?? awayLabel}
                iso2={bracketAway?.iso2}
                selected={advancingTla === bracketAway?.tla}
                onClick={() => setAdvancingTla(bracketAway?.tla ?? null)}
              />
            </div>
          </div>
        )}

        {/* Referencia: tu bracket — solo para estructura. La bandera va en full
            color si tu pick coincide con el equipo real de la posición, y
            semitransparente si no (una vez confirmado el equipo real). */}
        {hasRealTeams && hasBracketTeams && !locked && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
              ⚡ Según tu bracket · solo puntos de estructura
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-700">
              <BracketPickChip
                team={bracketHome}
                evaluated={realHomeConfirmed}
                correct={
                  realHomeConfirmed && bracketHome?.tla === realHomeTla
                }
              />
              <span className="text-gray-400">vs</span>
              <BracketPickChip
                team={bracketAway}
                evaluated={realAwayConfirmed}
                correct={
                  realAwayConfirmed && bracketAway?.tla === realAwayTla
                }
              />
            </div>
          </div>
        )}

        {/* Mostrar quién avanzó si está bloqueada y hubo empate */}
        {isKnockout &&
          locked &&
          myPrediction &&
          myPrediction.homeScore === myPrediction.awayScore &&
          (myPrediction.realAdvancingTla || myPrediction.advancingTeamTla) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 mb-3 text-xs text-gray-800 space-y-0.5">
              {myPrediction.realAdvancingTla && (
                <p>
                  <strong>🟰 Avanza (real):</strong>{" "}
                  {TEAMS_BY_TLA[myPrediction.realAdvancingTla]?.name ??
                    myPrediction.realAdvancingTla}
                </p>
              )}
              {myPrediction.advancingTeamTla && (
                <p className="text-gray-500">
                  En tu bracket:{" "}
                  {TEAMS_BY_TLA[myPrediction.advancingTeamTla]?.name ??
                    myPrediction.advancingTeamTla}
                </p>
              )}
            </div>
          )}

        {/* Estado de la predicción */}
        {locked ? (
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-3 text-sm mb-3">
            <p className="font-bold text-gray-900">🔒 Bloqueada al kickoff</p>
            {myPrediction ? (
              <p className="text-gray-800 mt-1">
                Tu predicción: <strong>{myPrediction.homeScore} – {myPrediction.awayScore}</strong>
                {myPrediction.pointsAwarded !== null &&
                  myPrediction.pointsAwarded !== undefined && (
                    <span className="ml-2 text-[var(--pmfu-cobalt)] font-bold">
                      +{myPrediction.pointsAwarded} pts
                    </span>
                  )}
              </p>
            ) : (
              <p className="text-gray-700 mt-1">
                No registraste predicción para este partido.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-gray-700 font-semibold">
                ⏱ {kickoffCountdown(match.utcDate)}
              </span>
              {myPrediction && (
                <span className="text-[var(--pmfu-mint)] font-semibold">
                  ✓ Ya predijiste
                </span>
              )}
            </div>

            {error && (
              <p className="text-sm text-[var(--pmfu-magenta)] font-semibold mb-2">
                {error}
              </p>
            )}
            {savedAt && (
              <p className="text-sm text-[var(--pmfu-mint)] font-semibold mb-2">
                ✓ Predicción guardada
              </p>
            )}

            <Button onClick={handleSave} loading={saving} className="w-full">
              {myPrediction ? "Actualizar predicción" : "Guardar predicción"}
            </Button>
          </>
        )}

        <ChismeList
          predictions={predictions}
          match={match}
          currentUid={user?.uid ?? null}
        />
      </div>
    </Modal>
  );
}

// Chip del pick del usuario en su bracket (referencia de estructura): full
// color si coincide con el equipo real de la posición, semitransparente si no.
function BracketPickChip({
  team,
  evaluated,
  correct,
}: {
  team?: { iso2: string; name: string; tla: string };
  evaluated: boolean;
  correct: boolean;
}) {
  if (!team) {
    return <span className="font-medium text-gray-500">—</span>;
  }
  const dim = evaluated && !correct;
  return (
    <span
      className={cn(
        "flex items-center gap-1 transition-opacity",
        dim && "opacity-40",
      )}
    >
      <Flag iso2={team.iso2} size={14} alt={team.name} />
      <span className={cn("font-medium", dim && "text-gray-500")}>
        {team.name}
      </span>
      {evaluated && correct && (
        <span
          className="text-[9px] font-bold text-[var(--pmfu-mint)] bg-[var(--pmfu-mint)]/15 px-1 py-0.5 rounded-full"
          title="Tu bracket acertó el equipo en esta posición"
        >
          ✓
        </span>
      )}
    </span>
  );
}

function TeamColumn({
  iso2,
  name,
  tla,
  status,
}: {
  iso2?: string;
  name: string;
  tla: string;
  /** Estado del clasificado real: provisional (difuminado) o confirmado. */
  status?: "provisional" | "confirmed" | null;
}) {
  const provisional = status === "provisional";
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center gap-2 transition-opacity",
        provisional && "opacity-50",
      )}
    >
      {iso2 ? (
        <Flag iso2={iso2} size={48} alt={name} />
      ) : (
        <div className="w-12 h-9 bg-gray-200 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">
          ?
        </div>
      )}
      <div>
        <p
          className={cn(
            "font-bold text-sm leading-tight",
            iso2 ? "text-gray-900" : "text-gray-800 italic",
          )}
        >
          {name}
        </p>
        {iso2 && (
          <p className="text-xs text-gray-600 font-semibold">{tla}</p>
        )}
      </div>
    </div>
  );
}

function AdvanceButton({
  tla,
  label,
  iso2,
  selected,
  onClick,
}: {
  tla: string;
  label: string;
  iso2?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const disabled = !tla;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-left",
        selected
          ? "border-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10"
          : "border-gray-200 bg-white hover:border-gray-300",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {iso2 ? (
        <Flag iso2={iso2} size={20} alt={label} />
      ) : (
        <span className="w-5 h-4 bg-gray-200 rounded" />
      )}
      <span className="text-xs font-bold text-gray-900 truncate flex-1">
        {label}
      </span>
      {selected && (
        <span className="text-[var(--pmfu-cobalt)] font-bold text-sm">✓</span>
      )}
    </button>
  );
}
