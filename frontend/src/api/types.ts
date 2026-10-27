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
