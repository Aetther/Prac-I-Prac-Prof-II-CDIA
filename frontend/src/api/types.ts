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
