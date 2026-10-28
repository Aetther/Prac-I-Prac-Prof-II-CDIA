import { useId } from "react";
import { ADMIN_REPORT_LANG_LABELS, ADMIN_STATUS_LABELS } from "../api/admin";
import type { AdminReport, ReportStatus } from "../api/types";
import { REPORT_REASON_LABELS } from "../game/reporting";
import { formatAdminTimestamp } from "./adminDateFormat";

interface AdminReportRowProps {
  report: AdminReport;
  expanded: boolean;
  busy: boolean;
  onToggleQuestion: (reportId: number) => void;
  onChangeStatus: (reportId: number, status: ReportStatus) => void;
  onEditQuestion: (questionId: number) => void;
}

const ACTION_LABELS: Record<ReportStatus, string> = {
  pendiente: "Volver a pendiente",
  resuelto: "Marcar resuelto",
  descartado: "Descartar",
};

function actionsFor(status: ReportStatus): readonly ReportStatus[] {
  if (status === "pendiente") return ["resuelto", "descartado"];
  if (status === "resuelto") return ["pendiente", "descartado"];
  return ["pendiente", "resuelto"];
}

function spanishText(value: string | null): string {
  return value === null || value === "" ? "Sin traducir" : value;
}

export function AdminReportRow({
  report,
  expanded,
  busy,
  onToggleQuestion,
  onChangeStatus,
  onEditQuestion,
}: AdminReportRowProps) {
  const regionId = useId();
  const question = report.question;

  return (
    <li className="admin-report-row">
      <h3>Reporte {report.id}</h3>
      <p>Pregunta: {report.question_id}</p>
      <p>Motivo: {REPORT_REASON_LABELS[report.reason]}</p>
      <p>Idioma: {ADMIN_REPORT_LANG_LABELS[report.lang]}</p>
      <p>Estado: {ADMIN_STATUS_LABELS[report.status]}</p>
      <p>
        Creado:{" "}
        <time dateTime={report.created_at}>
          {formatAdminTimestamp(report.created_at)}
        </time>
      </p>
      {report.resolved_at !== null ? (
        <p>
          Resuelto:{" "}
          <time dateTime={report.resolved_at}>
            {formatAdminTimestamp(report.resolved_at)}
          </time>
        </p>
      ) : null}
      <p>
        Comentario:{" "}
        {report.comment === null || report.comment === ""
          ? "Sin comentario."
          : report.comment}
      </p>
      <div className="admin-report-actions">
        {actionsFor(report.status).map((target) => (
          <button
            key={target}
            type="button"
            className="touch-target"
            aria-label={`${ACTION_LABELS[target]} el reporte ${report.id}`}
            disabled={busy}
            onClick={() => onChangeStatus(report.id, target)}
          >
            {ACTION_LABELS[target]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="touch-target"
        aria-expanded={expanded}
        aria-controls={regionId}
        aria-label={`${expanded ? "Cerrar" : "Abrir"} la pregunta ${report.question_id}`}
        onClick={() => onToggleQuestion(report.id)}
      >
        {expanded ? "Cerrar la pregunta" : "Abrir la pregunta"}
      </button>
      {expanded ? (
        <section
          id={regionId}
          className="admin-question-region"
          aria-label={`Pregunta ${report.question_id}`}
        >
          <p>{question.is_translated ? "Traducida" : "Sin traducir"}</p>
          {question.is_active ? null : <p>Oculta</p>}
          <h4>Pregunta en inglés</h4>
          <p>{question.question}</p>
          <h4>Respuesta en inglés</h4>
          <p>{question.answer}</p>
          <h4>Pregunta en español</h4>
          <p>{spanishText(question.question_es)}</p>
          <h4>Respuesta en español</h4>
          <p>{spanishText(question.answer_es)}</p>
          <button
            type="button"
            className="touch-target"
            aria-label={`Editar pregunta ${report.question_id}`}
            disabled={busy}
            onClick={() => onEditQuestion(report.question_id)}
          >
            Editar pregunta
          </button>
        </section>
      ) : null}
    </li>
  );
}
