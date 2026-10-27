export interface Category {
  name: string;
  label: string;
  description: string;
}

export interface GameQuestion {
  id: number;
  question: string;
  category: string;
  options: [string, string, string, string];
  lang: "es" | "en";
}

export interface SubmitAnswerResult {
  correct: boolean;
  correct_answer: string;
}

export type ReportReason =
  "traduccion" | "respuesta_incorrecta" | "error_texto" | "otro";

export type ReportStatus = "pendiente" | "resuelto" | "descartado";

export interface ReportQuestionResult {
  id: number;
  question_id: number;
  reason: ReportReason;
  status: ReportStatus;
  created_at: string;
}

export type AdminReportStatusFilter = ReportStatus | "todos";

export interface ReportStats {
  pendiente: number;
  resuelto: number;
  descartado: number;
  pending_by_reason: Record<string, number>;
}

export interface AdminReportQuestion {
  question: string;
  answer: string;
  question_es: string | null;
  answer_es: string | null;
  is_translated: boolean;
  is_active: boolean;
}

export interface AdminReport {
  id: number;
  question_id: number;
  reason: ReportReason;
  comment: string | null;
  lang: "es" | "en";
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  question: AdminReportQuestion;
}
