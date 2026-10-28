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

export interface AdminQuestion {
  id: number;
  question: string;
  answer: string;
  wrong_1: string;
  wrong_2: string;
  wrong_3: string;
  category: string | null;
  source: string | null;
  question_es: string | null;
  answer_es: string | null;
  wrong_1_es: string | null;
  wrong_2_es: string | null;
  wrong_3_es: string | null;
  is_translated: boolean;
  translation_model: string | null;
  is_active: boolean;
}

export type AdminQuestionTextField =
  | "question"
  | "answer"
  | "wrong_1"
  | "wrong_2"
  | "wrong_3"
  | "question_es"
  | "answer_es"
  | "wrong_1_es"
  | "wrong_2_es"
  | "wrong_3_es";

export interface AdminQuestionPatch {
  question?: string;
  answer?: string;
  wrong_1?: string;
  wrong_2?: string;
  wrong_3?: string;
  question_es?: string;
  answer_es?: string;
  wrong_1_es?: string;
  wrong_2_es?: string;
  wrong_3_es?: string;
  is_active?: true;
}

export interface AdminQuestionUpdateResult {
  changed_fields: string[];
  question: AdminQuestion;
}

export interface AdminQuestionEdit {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  edited_at: string;
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
