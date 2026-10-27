import { useEffect, useId, useRef, useState } from "react";
import {
  MAX_REPORT_COMMENT_LENGTH,
  REPORT_REASONS,
} from "../api/reportReasons";
import type { ReportReason } from "../api/types";
import { getReportCommentError, REPORT_REASON_LABELS } from "../game/reporting";
import type { ReportFailure, ReportSubmissionResult } from "../game/reporting";

interface ReportFormProps {
  disabled: boolean;
  unavailable: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit: (
    reason: ReportReason,
    comment: string,
  ) => Promise<ReportSubmissionResult>;
}

export function ReportForm({
  disabled,
  unavailable,
  onCancel,
  onSuccess,
  onSubmit,
}: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ReportFailure | null>(null);
  const firstReasonRef = useRef<HTMLInputElement>(null);
  const lockedRef = useRef(false);

  const titleId = useId();
  const hintId = useId();
  const counterId = useId();
  const commentId = useId();
  const commentErrorId = useId();

  useEffect(() => {
    firstReasonRef.current?.focus();
  }, []);

  const commentError = getReportCommentError(reason, comment);
  const isUnavailable = unavailable || failure?.unavailable === true;
  const canSubmit =
    reason !== null &&
    commentError === null &&
    !disabled &&
    !isUnavailable &&
    !submitting;

  function clearFailure() {
    if (!isUnavailable) {
      setFailure(null);
    }
  }

  const handleReasonChange = (nextReason: ReportReason) => {
    setReason(nextReason);
    clearFailure();
  };

  const handleCommentChange = (value: string) => {
    setComment(value);
    clearFailure();
  };

  const handleSubmit = async () => {
    if (lockedRef.current) return;
    if (reason === null || commentError !== null) return;
    if (disabled || isUnavailable) return;
    lockedRef.current = true;
    setSubmitting(true);
    try {
      const result = await onSubmit(reason, comment);
      if (result.ok) {
        onSuccess();
        return;
      }
      setFailure(result);
    } finally {
      lockedRef.current = false;
      setSubmitting(false);
    }
  };

  const submitLabel = submitting
    ? "Enviando reporte..."
    : failure?.retryable === true
      ? "Reintentar"
      : "Enviar reporte";

  return (
    <section aria-labelledby={titleId} className="report-form">
      <h3 id={titleId}>Reportar pregunta</h3>
      <fieldset>
        <legend>Motivo del reporte</legend>
        {REPORT_REASONS.map((option, index) => (
          <label key={option} className="touch-target">
            <input
              ref={index === 0 ? firstReasonRef : undefined}
              type="radio"
              name="report-reason"
              value={option}
              checked={reason === option}
              onChange={() => handleReasonChange(option)}
            />{" "}
            {REPORT_REASON_LABELS[option]}
          </label>
        ))}
      </fieldset>
      <label htmlFor={commentId}>Comentario</label>
      <p id={hintId}>Opcional; obligatorio para Otro.</p>
      <textarea
        id={commentId}
        className="touch-target"
        value={comment}
        maxLength={MAX_REPORT_COMMENT_LENGTH}
        aria-describedby={
          commentError === null
            ? `${hintId} ${counterId}`
            : `${hintId} ${counterId} ${commentErrorId}`
        }
        onChange={(event) => handleCommentChange(event.target.value)}
      />
      <p
        id={counterId}
        aria-live="polite"
        data-over-limit={
          comment.length > MAX_REPORT_COMMENT_LENGTH ? "true" : undefined
        }
      >
        {`${comment.length}/${MAX_REPORT_COMMENT_LENGTH}`}
      </p>
      {commentError !== null ? (
        <p id={commentErrorId} role="alert">
          {commentError}
        </p>
      ) : null}
      {failure !== null ? (
        <div role="alert">
          <p>{failure.message}</p>
          {failure.detail !== undefined ? <p>{failure.detail}</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        className="touch-target"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
      >
        {submitLabel}
      </button>
      <button type="button" className="touch-target" onClick={onCancel}>
        Cancelar
      </button>
    </section>
  );
}
