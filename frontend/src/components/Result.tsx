import { useId, useRef } from "react";
import type { GameQuestion } from "../api/types";
import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { LastAnswer, Player, PlayerIndex } from "../game/types";
import { Scoreboard } from "./Scoreboard";

interface ResultProps {
  question: GameQuestion;
  lastAnswer: LastAnswer;
  players: readonly [Player, Player];
  currentPlayer: PlayerIndex;
  progress: MatchProgress;
  categories: readonly WheelCategory[];
  onContinue: () => void;
}

function outcomeLabel(lastAnswer: LastAnswer): string {
  if (lastAnswer.timedOut) return "Se acabó el tiempo";
  return lastAnswer.correct ? "Correcta" : "Incorrecta";
}

export function Result({
  question,
  lastAnswer,
  players,
  currentPlayer,
  progress,
  categories,
  onContinue,
}: ResultProps) {
  const descriptionId = useId();
  const continuedRef = useRef(false);
  const showChosen =
    !lastAnswer.timedOut &&
    !lastAnswer.correct &&
    lastAnswer.chosenAnswer !== null;

  const handleContinue = () => {
    if (continuedRef.current) return;
    continuedRef.current = true;
    onContinue();
  };

  return (
    <section className="result">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        progress={progress}
        categories={categories}
      />
      <h2>Resultado</h2>
      <p>{question.question}</p>
      <p className="result-outcome">{outcomeLabel(lastAnswer)}</p>
      <p role="status">{`La respuesta correcta era: ${lastAnswer.correctAnswer}`}</p>
      {showChosen ? <p>{`Elegiste: ${lastAnswer.chosenAnswer}`}</p> : null}
      <button
        type="button"
        className="touch-target"
        disabled
        aria-describedby={descriptionId}
      >
        Reportar
      </button>
      <p id={descriptionId} className="visually-hidden">
        Función no disponible todavía.
      </p>
      <button type="button" className="touch-target" onClick={handleContinue}>
        Continuar
      </button>
    </section>
  );
}
