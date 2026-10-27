import { useEffect, useId, useRef, useState } from "react";
import type { GameQuestion, ReportReason } from "../api/types";
import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { ReportSubmissionResult } from "../game/reporting";
import type { LastAnswer, Player, PlayerIndex } from "../game/types";
import { ReportForm } from "./ReportForm";
import { Scoreboard } from "./Scoreboard";

interface ResultProps {
  question: GameQuestion;
  lastAnswer: LastAnswer;
  players: readonly [Player, Player];
  currentPlayer: PlayerIndex;
  progress: MatchProgress;
  categories: readonly WheelCategory[];
  reported: boolean;
  reporting: boolean;
  unavailable: boolean;
  onReport: (
    reason: ReportReason,
    comment: string,
  ) => Promise<ReportSubmissionResult>;
  onContinue: () => void;
}

function outcomeLabel(lastAnswer: LastAnswer): string {
  if (lastAnswer.timedOut) return "Se acabó el tiempo";
  return lastAnswer.correct ? "Correcta" : "Incorrecta";
}

export function Result({
  question,
  lastAnswer,
  players,
  currentPlayer,
  progress,
  categories,
  reported,
  reporting,
  unavailable,
  onReport,
  onContinue,
}: ResultProps) {
  const descriptionId = useId();
  const continuedRef = useRef(false);
  const reportButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const focusAfterCancelRef = useRef<"report" | "continue" | null>(null);
  const focusConfirmationRef = useRef(false);
  const [formOpen, setFormOpen] = useState(false);

  const showChosen =
    !lastAnswer.timedOut &&
    !lastAnswer.correct &&
    lastAnswer.chosenAnswer !== null;

  const reportDisabled = reported || reporting || unavailable || formOpen;

  const reportDescription = reported
    ? "Ya reportaste esta pregunta."
    : unavailable
      ? "La pregunta ya no está disponible."
      : reporting
        ? "Enviando reporte..."
        : formOpen
          ? "El formulario de reporte está abierto."
          : null;

  useEffect(() => {
    if (
      focusConfirmationRef.current &&
      reported &&
      !formOpen &&
      confirmationRef.current !== null
    ) {
      focusConfirmationRef.current = false;
      confirmationRef.current.focus();
    }
  }, [reported, formOpen]);

  useEffect(() => {
    if (formOpen || focusAfterCancelRef.current === null) return;
    const target =
      focusAfterCancelRef.current === "report"
        ? reportButtonRef.current
        : continueButtonRef.current;
    focusAfterCancelRef.current = null;
    target?.focus();
  }, [formOpen]);

  const handleContinue = () => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    onContinue();
  };

  const handleCancel = () => {
    focusAfterCancelRef.current =
      reported || reporting || unavailable ? "continue" : "report";
    setFormOpen(false);
  };

  const handleSuccess = () => {
    focusConfirmationRef.current = true;
    setFormOpen(false);
  };

  return (
    <section className="result">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        progress={progress}
        categories={categories}
      />
      <h2>Resultado</h2>
      <p>{question.question}</p>
      <p className="result-outcome">{outcomeLabel(lastAnswer)}</p>
      <p role="status">{`La respuesta correcta era: ${lastAnswer.correctAnswer}`}</p>
      {showChosen ? <p>{`Elegiste: ${lastAnswer.chosenAnswer}`}</p> : null}
      {reported ? (
        <p ref={confirmationRef} role="status" tabIndex={-1}>
          Gracias. Recibimos tu reporte.
        </p>
      ) : null}
      <button
        ref={reportButtonRef}
        type="button"
        className="touch-target"
        disabled={reportDisabled}
        aria-describedby={
          reportDescription === null ? undefined : descriptionId
        }
        onClick={() => setFormOpen(true)}
      >
        Reportar
      </button>
      {reportDescription !== null ? (
        <p id={descriptionId} className="visually-hidden">
          {reportDescription}
        </p>
      ) : null}
      {formOpen ? (
        <ReportForm
          disabled={reporting}
          unavailable={unavailable}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
          onSubmit={onReport}
        />
      ) : null}
      <button
        ref={continueButtonRef}
        type="button"
        className="touch-target"
        onClick={handleContinue}
      >
        Continuar
      </button>
    </section>
  );
}
