import type { ReportReason } from "../api/types";

/** Every text of the game view. Strings with a value are functions. */
export interface Messages {
  // Lobby
  readonly tagline: string;
  readonly player1: string;
  readonly player2: string;
  readonly languageGroup: string;
  readonly difficultyGroup: string;
  readonly difficultyEasy: string;
  readonly difficultyMedium: string;
  readonly difficultyHard: string;
  secondsOption(seconds: number): string;
  readonly modeGroup: string;
  readonly modeRounds: string;
  readonly modeRoundsHint: string;
  readonly modeSix: string;
  readonly modeSixHint: string;
  readonly roundsGroup: string;
  readonly roundsLabel: string;
  roundsOption(rounds: number): string;
  readonly play: string;
  // Wheel
  turnOf(name: string): string;
  readonly spinHeading: string;
  readonly spin: string;
  readonly spinning: string;
  readonly wheelName: string;
  wheelResult(label: string): string;
  readonly continueAction: string;
  // Question
  categoryOf(label: string): string;
  readonly pickAnswer: string;
  readonly sendingAnswer: string;
  readonly untranslated: string;
  readonly timeLeft: string;
  readonly lastSeconds: string;
  // Result
  readonly resultHeading: string;
  readonly correct: string;
  readonly wrong: string;
  readonly timeUp: string;
  correctAnswerWas(answer: string): string;
  youChose(answer: string): string;
  readonly reportThanks: string;
  readonly report: string;
  readonly alreadyReported: string;
  readonly questionUnavailable: string;
  readonly sendingReport: string;
  readonly reportFormOpen: string;
  // Report form
  readonly reportTitle: string;
  readonly reportReasonLegend: string;
  readonly reportReasons: Readonly<Record<ReportReason, string>>;
  readonly comment: string;
  readonly commentHint: string;
  readonly sendReport: string;
  readonly retry: string;
  readonly cancel: string;
  // Scoreboard
  readonly scoreboard: string;
  roundOf(round: number, total: number): string;
  readonly turnLimit: string;
  points(name: string, score: number): string;
  categoriesCount(count: number): string;
  turnsCount(count: number): string;
  readonly turn: string;
  readonly noCategories: string;
  categoriesOfPlayer(name: string): string;
  // SwitchTurn
  readonly passDevice: string;
  readonly ready: string;
  // GameOver
  winner(name: string): string;
  readonly tie: string;
  readonly collectedSix: string;
  readonly turnLimitReached: string;
  readonly gameOver: string;
  readonly playAgain: string;
  // Errors and loading
  readonly backToLobby: string;
  readonly loadingCategories: string;
  readonly loadingQuestion: string;
  // Sound
  readonly sound: string;
  readonly soundOptions: string;
  readonly soundOn: string;
  readonly soundOff: string;
  readonly volume: string;
  readonly effects: string;
  readonly music: string;
}
