import { useEffect, useId, useRef, useState } from "react";
import type { GameQuestion, ReportReason } from "../api/types";
import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { ReportSubmissionResult } from "../game/reporting";
import type { LastAnswer, Player, PlayerIndex } from "../game/types";
import { ReportForm } from "./ReportForm";
import { ResultIcon } from "./ResultIcon";
import { Scoreboard } from "./Scoreboard";
import { useMessages } from "../i18n";
import type { Messages } from "../i18n";

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

function outcomeLabel(lastAnswer: LastAnswer, m: Messages): string {
  if (lastAnswer.timedOut) return m.timeUp;
  return lastAnswer.correct ? m.correct : m.wrong;
}

function outcomeKind(lastAnswer: LastAnswer): "correct" | "wrong" | "timeout" {
  if (lastAnswer.timedOut) return "timeout";
  return lastAnswer.correct ? "correct" : "wrong";
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
  const m = useMessages();
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
    ? m.alreadyReported
    : unavailable
      ? m.questionUnavailable
      : reporting
        ? m.sendingReport
        : formOpen
          ? m.reportFormOpen
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

  const iconKind = outcomeKind(lastAnswer);

  return (
    <section className="result game-layout">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        progress={progress}
        categories={categories}
      />
      <div className="game-main">
        <h2>{m.resultHeading}</h2>
        <p className="question-text">{question.question}</p>
        <p className="result-outcome">
          <ResultIcon kind={iconKind} />
          <span>{outcomeLabel(lastAnswer, m)}</span>
        </p>
        <p role="status">{m.correctAnswerWas(lastAnswer.correctAnswer)}</p>
        {showChosen ? <p>{m.youChose(lastAnswer.chosenAnswer)}</p> : null}
        {reported ? (
          <p ref={confirmationRef} role="status" tabIndex={-1}>
            {m.reportThanks}
          </p>
        ) : null}
        <button
          ref={reportButtonRef}
          type="button"
          className="button-secondary touch-target"
          disabled={reportDisabled}
          aria-describedby={
            reportDescription === null ? undefined : descriptionId
          }
          onClick={() => setFormOpen(true)}
        >
          {m.report}
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
          className="button-primary result-continue touch-target"
          onClick={handleContinue}
        >
          {m.continueAction}
        </button>
      </div>
    </section>
  );
}
