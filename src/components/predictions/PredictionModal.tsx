"use client";

import { useEffect, useState } from "react";
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
  const { bracket: derivedBracket } = useDerivedBracket(user?.uid);

  const myPrediction = match ? myPredictions.get(match.id) : undefined;

  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  // Para empates en eliminatorias: qué equipo avanza por penales
  const [advancingTla, setAdvancingTla] = useState<string | null>(null);
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
    } else {
      setHome(0);
      setAway(0);
      setAdvancingTla(null);
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
  const officialHome = TEAMS_BY_TLA[match.homeTeam.tla];
  const officialAway = TEAMS_BY_TLA[match.awayTeam.tla];
  const bracket =
    match.matchNumber !== undefined
      ? BRACKET_BY_MATCH_NUMBER[match.matchNumber]
      : undefined;

  // Si los equipos oficiales aún no están definidos (eliminatorias antes del
  // sorteo), usamos los DERIVADOS de las predicciones del propio usuario.
  const derivedSlot =
    match.matchNumber !== undefined
      ? derivedBracket.get(match.matchNumber)
      : undefined;
  const derivedHome = derivedSlot?.homeTla
    ? TEAMS_BY_TLA[derivedSlot.homeTla]
    : undefined;
  const derivedAway = derivedSlot?.awayTla
    ? TEAMS_BY_TLA[derivedSlot.awayTla]
    : undefined;

  // Prioridad: equipo oficial > equipo derivado de mis predicciones > label
  const homeTeam = officialHome ?? derivedHome;
  const awayTeam = officialAway ?? derivedAway;
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
  const isDerived =
    !officialHome && !officialAway && !!(derivedHome || derivedAway);

  const venue = venueForMatch(match.matchNumber);
  const venueLine = [venue?.city, venue?.stadium]
    .filter(Boolean)
    .join(" · ");

  async function handleSave() {
    if (!user || !match) return;
    setError(null);
    // Validar empate en eliminatorias: debe escoger un ganador
    const isDraw = home === away;
    const isKnockout = match.stage !== "GROUP";
    if (isKnockout && isDraw && !advancingTla) {
      setError(
        "Si predices empate, debes elegir qué equipo avanza por penales.",
      );
      return;
    }
    setSaving(true);
    try {
      await savePrediction({
        uid: user.uid,
        matchId: match.id,
        homeScore: home,
        awayScore: away,
        // Solo guardamos advancingTla si aplica (empate en eliminatorias)
        advancingTeamTla: isKnockout && isDraw ? advancingTla : null,
      });
      setSavedAt(Date.now());
      // Pequeño confeti como feedback positivo
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
          {isDerived && (
            <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-[var(--pmfu-cobalt)] bg-[var(--pmfu-cobalt)]/10 inline-block px-2 py-1 rounded-full">
              ⚡ Equipos según tu bracket
            </div>
          )}
        </div>

        {/* Equipos + steppers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-5">
          <TeamColumn
            iso2={homeTeam?.iso2}
            name={homeLabel}
            tla={homeTeam?.tla ?? match.homeTeam.tla}
            predictedTla={
              officialHome && derivedHome && derivedHome.tla !== officialHome.tla
                ? derivedHome.tla
                : undefined
            }
            predictedIso2={
              officialHome && derivedHome && derivedHome.tla !== officialHome.tla
                ? derivedHome.iso2
                : undefined
            }
            predictedHit={
              !!(officialHome && derivedHome && derivedHome.tla === officialHome.tla)
            }
          />
          <span className="text-xl font-bold text-gray-400">vs</span>
          <TeamColumn
            iso2={awayTeam?.iso2}
            name={awayLabel}
            tla={awayTeam?.tla ?? match.awayTeam.tla}
            predictedTla={
              officialAway && derivedAway && derivedAway.tla !== officialAway.tla
                ? derivedAway.tla
                : undefined
            }
            predictedIso2={
              officialAway && derivedAway && derivedAway.tla !== officialAway.tla
                ? derivedAway.iso2
                : undefined
            }
            predictedHit={
              !!(officialAway && derivedAway && derivedAway.tla === officialAway.tla)
            }
          />
        </div>

        {/* Steppers */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <ScoreStepper value={home} onChange={setHome} disabled={locked} />
          <ScoreStepper value={away} onChange={setAway} disabled={locked} />
        </div>

        {/* Selector "quién avanza" cuando hay empate en eliminatorias */}
        {match.stage !== "GROUP" && home === away && !locked && (
          <div className="bg-[var(--pmfu-orange)]/10 border border-[var(--pmfu-orange)]/30 rounded-xl p-3 mb-4">
            <p className="text-xs font-bold text-gray-900 mb-2">
              🟰 Empate en eliminatorias — ¿quién avanza?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <AdvanceButton
                tla={homeTeam?.tla ?? match.homeTeam.tla}
                label={homeTeam?.name ?? homeLabel}
                iso2={homeTeam?.iso2}
                selected={advancingTla === (homeTeam?.tla ?? match.homeTeam.tla)}
                onClick={() =>
                  setAdvancingTla(homeTeam?.tla ?? match.homeTeam.tla ?? null)
                }
              />
              <AdvanceButton
                tla={awayTeam?.tla ?? match.awayTeam.tla}
                label={awayTeam?.name ?? awayLabel}
                iso2={awayTeam?.iso2}
                selected={advancingTla === (awayTeam?.tla ?? match.awayTeam.tla)}
                onClick={() =>
                  setAdvancingTla(awayTeam?.tla ?? match.awayTeam.tla ?? null)
                }
              />
            </div>
          </div>
        )}

        {/* Mostrar quién avanzó si está bloqueada y hubo empate */}
        {match.stage !== "GROUP" &&
          locked &&
          myPrediction &&
          myPrediction.homeScore === myPrediction.awayScore &&
          myPrediction.advancingTeamTla && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 mb-3 text-xs text-gray-800">
              <strong>🟰 Predijiste empate, avanza:</strong>{" "}
              {TEAMS_BY_TLA[myPrediction.advancingTeamTla]?.name ??
                myPrediction.advancingTeamTla}
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

function TeamColumn({
  iso2,
  name,
  tla,
  predictedTla,
  predictedIso2,
  predictedHit,
}: {
  iso2?: string;
  name: string;
  tla: string;
  /** TLA del equipo que predijo el usuario (solo cuando difiere del oficial). */
  predictedTla?: string;
  /** Bandera ISO2 del equipo predicho. */
  predictedIso2?: string;
  /** True cuando hay equipo oficial Y el derivado del usuario coincide. */
  predictedHit?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
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
        {predictedHit && (
          <p
            className="mt-1 inline-block text-[10px] font-bold text-[var(--pmfu-mint)] bg-[var(--pmfu-mint)]/15 px-1.5 py-0.5 rounded-full"
            title="Tu bracket acertó este equipo"
          >
            ✓ Acertaste
          </p>
        )}
        {predictedTla && !predictedHit && (
          <div
            className="mt-1 flex items-center justify-center gap-1 opacity-60"
            title="Equipo que predijiste para este slot"
          >
            {predictedIso2 ? (
              <Flag iso2={predictedIso2} size={12} alt={predictedTla} />
            ) : null}
            <span className="text-[10px] font-semibold text-gray-700 line-through">
              Tu pick: {predictedTla}
            </span>
          </div>
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
