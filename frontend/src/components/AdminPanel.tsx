import { useId, useState } from "react";
import type { FormEvent, RefObject } from "react";
import {
  ADMIN_REPORT_PAGE_SIZE,
  ADMIN_STATUS_FILTER_OPTIONS,
} from "../api/admin";
import { isReportReason, REPORT_REASONS } from "../api/reportReasons";
import type {
  AdminReport,
  AdminReportStatusFilter,
  ReportStats,
  ReportStatus,
} from "../api/types";
import type { AdminFailure } from "../api/adminFailures";
import { REPORT_REASON_LABELS } from "../game/reporting";
import { AdminReportRow } from "./AdminReportRow";

export interface AppliedFilters {
  status: AdminReportStatusFilter;
  questionId: number | null;
}

interface AdminPanelProps {
  stats: ReportStats | null;
  reports: readonly AdminReport[];
  filters: AppliedFilters;
  skip: number;
  listLoading: boolean;
  busy: boolean;
  failure: AdminFailure | null;
  statusMessage: string | null;
  expandedIds: ReadonlySet<number>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onApplyFilters: (
    status: AdminReportStatusFilter,
    questionId: number | null,
  ) => void;
  onPage: (skip: number) => void;
  onChangeStatus: (reportId: number, status: ReportStatus) => void;
  onRetry: () => void;
  onToggleQuestion: (reportId: number) => void;
  onEditQuestion: (questionId: number) => void;
  onSignOut: () => void;
}

const ID_ERROR =
  "El id de la pregunta tiene que ser un número entero mayor que 0.";

type ParsedQuestionId = { ok: true; value: number | null } | { ok: false };

function parseQuestionId(raw: string): ParsedQuestionId {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value > 0 ? { ok: true, value } : { ok: false };
}

export function AdminPanel({
  stats,
  reports,
  filters,
  skip,
  listLoading,
  busy,
  failure,
  statusMessage,
  expandedIds,
  headingRef,
  onApplyFilters,
  onPage,
  onChangeStatus,
  onRetry,
  onToggleQuestion,
  onEditQuestion,
  onSignOut,
}: AdminPanelProps) {
  const [draftStatus, setDraftStatus] = useState<AdminReportStatusFilter>(
    filters.status,
  );
  const [draftQuestionId, setDraftQuestionId] = useState(
    filters.questionId === null ? "" : String(filters.questionId),
  );
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(filters);
  const [idError, setIdError] = useState<string | null>(null);
  const [editorQuestionId, setEditorQuestionId] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);

  const statusId = useId();
  const questionIdFieldId = useId();
  const hintId = useId();
  const editorFieldId = useId();
  const editorHintId = useId();

  if (
    appliedFilters.status !== filters.status ||
    appliedFilters.questionId !== filters.questionId
  ) {
    setAppliedFilters(filters);
    setDraftStatus(filters.status);
    setDraftQuestionId(
      filters.questionId === null ? "" : String(filters.questionId),
    );
  }

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseQuestionId(draftQuestionId);
    if (!parsed.ok) {
      setIdError(ID_ERROR);
      return;
    }
    setIdError(null);
    onApplyFilters(draftStatus, parsed.value);
  };

  const handleOpenEditor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseQuestionId(editorQuestionId);
    if (!parsed.ok || parsed.value === null) {
      setEditorError(ID_ERROR);
      return;
    }
    setEditorError(null);
    onEditQuestion(parsed.value);
  };

  const knownReasons = REPORT_REASONS.filter((reason) =>
    Object.hasOwn(stats?.pending_by_reason ?? {}, reason),
  );
  const unknownReasons = Object.entries(stats?.pending_by_reason ?? {}).filter(
    ([key]) => !isReportReason(key),
  );
  const hasBreakdown = knownReasons.length + unknownReasons.length > 0;

  return (
    <section className="admin-panel">
      <h2 ref={headingRef} tabIndex={-1}>
        Reportes
      </h2>
      <button type="button" className="touch-target" onClick={onSignOut}>
        Salir
      </button>

      {stats !== null ? (
        <section className="admin-stats">
          <h3>Resumen de reportes</h3>
          <ul
            className="admin-stats-counters"
            aria-label="Contadores de reportes"
          >
            <li>Pendientes: {stats.pendiente}</li>
            <li>Resueltos: {stats.resuelto}</li>
            <li>Descartados: {stats.descartado}</li>
          </ul>
          <h4>Pendientes por motivo</h4>
          {hasBreakdown ? (
            <ul
              className="admin-stats-breakdown"
              aria-label="Pendientes por motivo"
            >
              {knownReasons.map((reason) => (
                <li key={reason}>
                  {`${REPORT_REASON_LABELS[reason]}: ${stats.pending_by_reason[reason]}`}
                </li>
              ))}
              {unknownReasons.map(([key, count]) => (
                <li key={key}>{`${key}: ${count}`}</li>
              ))}
            </ul>
          ) : (
            <p>Sin pendientes por motivo.</p>
          )}
        </section>
      ) : null}

      <form
        className="admin-filters"
        aria-label="Filtros de reportes"
        onSubmit={handleApply}
      >
        <label htmlFor={statusId}>Estado</label>
        <select
          id={statusId}
          className="touch-target"
          value={draftStatus}
          onChange={(event) =>
            setDraftStatus(event.target.value as AdminReportStatusFilter)
          }
        >
          {ADMIN_STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor={questionIdFieldId}>Id de la pregunta</label>
        <input
          id={questionIdFieldId}
          className="touch-target"
          type="text"
          inputMode="numeric"
          value={draftQuestionId}
          aria-describedby={hintId}
          onChange={(event) => setDraftQuestionId(event.target.value)}
        />
        <p id={hintId} className="help-text">
          Opcional. Solo números enteros.
        </p>
        {idError !== null ? <p role="alert">{idError}</p> : null}
        <button type="submit" className="touch-target">
          Aplicar filtros
        </button>
      </form>

      <form
        className="admin-editor-open"
        aria-label="Abrir editor de pregunta"
        onSubmit={handleOpenEditor}
      >
        <label htmlFor={editorFieldId}>Pregunta</label>
        <input
          id={editorFieldId}
          className="touch-target"
          type="text"
          inputMode="numeric"
          value={editorQuestionId}
          aria-describedby={editorHintId}
          onChange={(event) => setEditorQuestionId(event.target.value)}
        />
        <p id={editorHintId} className="help-text">
          Número de pregunta. Solo números enteros.
        </p>
        {editorError !== null ? <p role="alert">{editorError}</p> : null}
        <button type="submit" className="touch-target" disabled={busy}>
          Abrir editor
        </button>
      </form>

      <section className="admin-list">
        <h3>Lista de reportes</h3>
        {listLoading && reports.length === 0 ? (
          <p role="status">Cargando reportes...</p>
        ) : null}
        {!listLoading && reports.length === 0 ? (
          <p role="status">No hay reportes para mostrar.</p>
        ) : null}
        {reports.length > 0 ? (
          <ul className="admin-report-list">
            {reports.map((report) => (
              <AdminReportRow
                key={report.id}
                report={report}
                expanded={expandedIds.has(report.id)}
                busy={busy}
                onToggleQuestion={onToggleQuestion}
                onChangeStatus={onChangeStatus}
                onEditQuestion={onEditQuestion}
              />
            ))}
          </ul>
        ) : null}
        <div className="admin-pager">
          <button
            type="button"
            className="touch-target"
            disabled={busy || skip === 0}
            onClick={() => onPage(skip - ADMIN_REPORT_PAGE_SIZE)}
          >
            Anterior
          </button>
          <span>{`Página ${skip / ADMIN_REPORT_PAGE_SIZE + 1}`}</span>
          <button
            type="button"
            className="touch-target"
            disabled={busy || reports.length !== ADMIN_REPORT_PAGE_SIZE}
            onClick={() => onPage(skip + ADMIN_REPORT_PAGE_SIZE)}
          >
            Siguiente
          </button>
        </div>
      </section>

      {failure !== null ? (
        <div className="admin-alert" role="alert">
          <p>{failure.message}</p>
          {failure.detail !== undefined ? <p>{failure.detail}</p> : null}
          {failure.retryable ? (
            <button type="button" className="touch-target" onClick={onRetry}>
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {statusMessage !== null ? (
        <p className="admin-status-message" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
