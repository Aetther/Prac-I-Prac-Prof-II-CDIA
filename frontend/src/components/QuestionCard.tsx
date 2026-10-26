import type { GameQuestion } from "../api/types";
import { isUntranslated } from "../game/question";
import type { Lang, LastAnswer, Player, PlayerIndex } from "../game/types";
import { Scoreboard } from "./Scoreboard";

interface QuestionCardProps {
  question: GameQuestion;
  lang: Lang;
  players: readonly [Player, Player];
  currentPlayer: PlayerIndex;
  round: number;
  totalRounds: number;
  loading: boolean;
  feedback: LastAnswer | null;
  categoryLabel: string | null;
  onAnswer: (answer: string) => void;
  onContinue: () => void;
}

export function QuestionCard({
  question,
  lang,
  players,
  currentPlayer,
  round,
  totalRounds,
  loading,
  feedback,
  categoryLabel,
  onAnswer,
  onContinue,
}: QuestionCardProps) {
  const answered = feedback !== null;
  const optionsDisabled = loading || answered;

  return (
    <section className="question-card">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        round={round}
        totalRounds={totalRounds}
      />
      {categoryLabel !== null ? <p>{`Categoría: ${categoryLabel}`}</p> : null}
      {isUntranslated(lang, question.lang) ? (
        <p className="untranslated-badge">Sin traducir</p>
      ) : null}
      <h2>{question.question}</h2>
      <p>Elegí una opción</p>
      <div className="option-list">
        {question.options.map((option) => {
          const isChosen = feedback?.chosenAnswer === option;
          const isCorrect = isChosen && feedback?.correct === true;
          return (
            <button
              key={option}
              type="button"
              className="option-button touch-target"
              disabled={optionsDisabled}
              aria-label={
                isChosen
                  ? `${isCorrect ? "Opción correcta" : "Opción incorrecta"}: ${option}`
                  : undefined
              }
              onClick={() => onAnswer(option)}
            >
              <span className="option-text">{option}</span>
              {isChosen ? (
                <span className="option-mark">
                  {isCorrect ? "Correcta" : "Incorrecta"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {loading && !answered ? <p role="status">Enviando respuesta...</p> : null}
      {answered ? (
        <>
          <p role="status">{`La respuesta correcta era: ${feedback.correctAnswer}`}</p>
          <button type="button" className="touch-target" onClick={onContinue}>
            Continuar
          </button>
        </>
      ) : null}
    </section>
  );
}
