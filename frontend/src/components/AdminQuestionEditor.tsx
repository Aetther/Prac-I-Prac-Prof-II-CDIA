import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { AdminFailure } from "../api/adminFailures";
import type {
  AdminQuestion,
  AdminQuestionEdit,
  AdminQuestionPatch,
  AdminQuestionTextField,
} from "../api/types";
import { formatAdminTimestamp } from "./adminDateFormat";
import {
  buildQuestionPatch,
  fieldLimit,
  QUESTION_EXPORT_REMINDER,
  QUESTION_FIELD_LABELS,
  QUESTION_HISTORY_FIELD_LABELS,
  QUESTION_TEXT_FIELDS,
  questionToDraft,
} from "./questionEditorForm";
import type { QuestionDraft } from "./questionEditorForm";

interface AdminQuestionEditorProps {
  questionId: number;
  state: "loading" | "ready";
  question: AdminQuestion | null;
  edits: readonly AdminQuestionEdit[] | null;
  editsLoading: boolean;
  editsFailure: AdminFailure | null;
  busy: boolean;
  failure: AdminFailure | null;
  statusMessage: string | null;
  showReminder: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  historyHeadingRef: RefObject<HTMLHeadingElement | null>;
  onSave: (patch: AdminQuestionPatch | null) => void;
  onHide: () => void;
  onRestore: () => void;
  onClose: () => void;
  onRetry: () => void;
  onRetryEdits: () => void;
}

const ENGLISH_FIELDS: readonly AdminQuestionTextField[] =
  QUESTION_TEXT_FIELDS.slice(0, 5);
const SPANISH_FIELDS: readonly AdminQuestionTextField[] =
  QUESTION_TEXT_FIELDS.slice(5);

function displayOptional(value: string | null): string {
  return value === null || value === "" ? "Sin valor" : value;
}

export function AdminQuestionEditor({
  questionId,
  state,
  question,
  edits,
  editsLoading,
  editsFailure,
  busy,
  failure,
  statusMessage,
  showReminder,
  headingRef,
  historyHeadingRef,
  onSave,
  onHide,
  onRestore,
  onClose,
  onRetry,
  onRetryEdits,
}: AdminQuestionEditorProps) {
  const [loadedQuestion, setLoadedQuestion] = useState(question);
  const [draft, setDraft] = useState<QuestionDraft | null>(() =>
    question === null ? null : questionToDraft(question),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const hideButtonRef = useRef<HTMLButtonElement>(null);
  const restoreHideFocusRef = useRef(false);
  const baseId = useId();

  if (question !== loadedQuestion) {
    setLoadedQuestion(question);
    setDraft(question === null ? null : questionToDraft(question));
    setLocalError(null);
    setConfirming(false);
  }

  useEffect(() => {
    if (state === "ready") {
      headingRef.current?.focus();
    }
  }, [state, headingRef]);

  useEffect(() => {
    if (!confirming && restoreHideFocusRef.current) {
      restoreHideFocusRef.current = false;
      hideButtonRef.current?.focus();
    }
  }, [confirming]);

  const handleFieldChange = (field: AdminQuestionTextField, value: string) => {
    setLocalError(null);
    setDraft((current) =>
      current === null ? current : { ...current, [field]: value },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || question === null || draft === null) return;
    const result = buildQuestionPatch(question, draft);
    if (!result.ok) {
      setLocalError(result.message);
      return;
    }
    setLocalError(null);
    onSave(result.patch);
  };

  const handleCancelHide = () => {
    restoreHideFocusRef.current = true;
    setConfirming(false);
  };

  const handleConfirmHide = () => {
    setConfirming(false);
    onHide();
  };

  const headingId = `${baseId}-heading`;
  const historyHeadingId = `${baseId}-history-heading`;
  const fieldId = (field: AdminQuestionTextField) => `${baseId}-field-${field}`;
  const counterId = (field: AdminQuestionTextField) =>
    `${baseId}-counter-${field}`;

  const renderField = (field: AdminQuestionTextField) => {
    const label = QUESTION_FIELD_LABELS[field];
    const value = draft === null ? "" : draft[field];
    const limit = fieldLimit(field);
    const isQuestionText = field === "question" || field === "question_es";
    return (
      <div className="admin-editor-field" key={field}>
        <label htmlFor={fieldId(field)}>{label}</label>
        {isQuestionText ? (
          <textarea
            id={fieldId(field)}
            className="touch-target"
            value={value}
            aria-describedby={counterId(field)}
            onChange={(event) => handleFieldChange(field, event.target.value)}
          />
        ) : (
          <input
            id={fieldId(field)}
            className="touch-target"
            type="text"
            value={value}
            aria-describedby={counterId(field)}
            onChange={(event) => handleFieldChange(field, event.target.value)}
          />
        )}
        <span id={counterId(field)} className="admin-editor-counter">
          {`${value.trim().length}/${limit}`}
        </span>
      </div>
    );
  };

  return (
    <section className="admin-editor" aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        {`Editar pregunta ${questionId}`}
      </h2>
      <button type="button" className="touch-target" onClick={onClose}>
        Cerrar
      </button>

      {question === null ? (
        <p role="status">Cargando pregunta...</p>
      ) : (
        <>
          <dl className="admin-question-facts">
            <dt>Id</dt>
            <dd>{question.id}</dd>
            <dt>Categoría</dt>
            <dd>{displayOptional(question.category)}</dd>
            <dt>Origen</dt>
            <dd>{displayOptional(question.source)}</dd>
            <dt>Modelo de traducción</dt>
            <dd>{displayOptional(question.translation_model)}</dd>
            <dt>Estado de traducción</dt>
            <dd>{question.is_translated ? "Traducida" : "Sin traducir"}</dd>
            <dt>Visibilidad</dt>
            <dd>{question.is_active ? "Visible" : "Oculta"}</dd>
          </dl>

          {localError !== null || failure !== null ? (
            <div className="admin-alert" role="alert">
              <p>{localError ?? failure?.message}</p>
              {failure?.detail !== undefined ? <p>{failure.detail}</p> : null}
              {failure?.retryable && localError === null ? (
                <button
                  type="button"
                  className="touch-target"
                  onClick={onRetry}
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}

          <form
            aria-label={`Editar pregunta ${questionId}`}
            onSubmit={handleSubmit}
          >
            <fieldset className="admin-editor-group">
              <legend>Inglés</legend>
              {ENGLISH_FIELDS.map(renderField)}
            </fieldset>
            <fieldset className="admin-editor-group">
              <legend>Español</legend>
              {SPANISH_FIELDS.map(renderField)}
            </fieldset>
            <button type="submit" className="touch-target" disabled={busy}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>

          {question.is_active ? (
            confirming ? (
              <div
                className="admin-editor-confirmation"
                role="group"
                aria-label={`Confirmar ocultar la pregunta ${questionId}`}
              >
                <p>¿Ocultar la pregunta? El juego deja de mostrarla.</p>
                <button
                  type="button"
                  className="touch-target"
                  disabled={busy}
                  onClick={handleConfirmHide}
                >
                  Confirmar ocultar
                </button>
                <button
                  type="button"
                  className="touch-target"
                  onClick={handleCancelHide}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                ref={hideButtonRef}
                type="button"
                className="touch-target"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                Ocultar pregunta
              </button>
            )
          ) : (
            <button
              type="button"
              className="touch-target"
              disabled={busy}
              onClick={onRestore}
            >
              Volver a mostrar
            </button>
          )}

          {statusMessage !== null ? (
            <p className="admin-status-message" role="status">
              {statusMessage}
            </p>
          ) : null}
          {showReminder ? (
            <p className="admin-export-reminder">{QUESTION_EXPORT_REMINDER}</p>
          ) : null}

          <section
            className="admin-question-history"
            aria-labelledby={historyHeadingId}
          >
            <h3 id={historyHeadingId} ref={historyHeadingRef} tabIndex={-1}>
              Historial de ediciones
            </h3>
            {editsLoading ? <p role="status">Cargando historial...</p> : null}
            {!editsLoading && editsFailure !== null ? (
              <div className="admin-alert" role="alert">
                <p>No se pudo cargar el historial.</p>
                <p>{editsFailure.message}</p>
                {editsFailure.detail !== undefined ? (
                  <p>{editsFailure.detail}</p>
                ) : null}
                {editsFailure.retryable ? (
                  <button
                    type="button"
                    className="touch-target"
                    aria-label="Reintentar el historial"
                    onClick={onRetryEdits}
                  >
                    Reintentar
                  </button>
                ) : null}
              </div>
            ) : null}
            {!editsLoading && editsFailure === null && edits !== null ? (
              edits.length === 0 ? (
                <p>Sin ediciones registradas.</p>
              ) : (
                <ol className="admin-question-history-list">
                  {edits.map((edit) => (
                    <li key={edit.id}>
                      <p>
                        {`Campo: ${
                          QUESTION_HISTORY_FIELD_LABELS[edit.field] ??
                          edit.field
                        }`}
                      </p>
                      <p>{`Antes: ${edit.old_value ?? "Sin valor"}`}</p>
                      <p>{`Después: ${edit.new_value ?? "Sin valor"}`}</p>
                      <p>
                        Fecha:{" "}
                        <time dateTime={edit.edited_at}>
                          {formatAdminTimestamp(edit.edited_at)}
                        </time>
                      </p>
                    </li>
                  ))}
                </ol>
              )
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
