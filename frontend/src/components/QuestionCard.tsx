import { useRef, useState } from "react";
import type { GameQuestion } from "../api/types";
import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import { isUntranslated } from "../game/question";
import type { Lang, Player, PlayerIndex } from "../game/types";
import { Scoreboard } from "./Scoreboard";
import { Timer } from "./Timer";

interface QuestionCardProps {
  question: GameQuestion;
  lang: Lang;
  players: readonly [Player, Player];
  currentPlayer: PlayerIndex;
  progress: MatchProgress;
  categories: readonly WheelCategory[];
  loading: boolean;
  seconds: number;
  timerActive: boolean;
  categoryLabel: string | null;
  onAnswer: (answer: string) => void;
  onTimeout: () => void;
}

export function QuestionCard({
  question,
  lang,
  players,
  currentPlayer,
  progress,
  categories,
  loading,
  seconds,
  timerActive,
  categoryLabel,
  onAnswer,
  onTimeout,
}: QuestionCardProps) {
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);

  const lock = (): boolean => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    setLocked(true);
    return true;
  };

  const handleAnswer = (answer: string) => {
    if (!lock()) return;
    onAnswer(answer);
  };

  const handleExpire = () => {
    if (!lock()) return;
    onTimeout();
  };

  const optionsDisabled = loading || locked;

  return (
    <section className="question-card">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        progress={progress}
        categories={categories}
      />
      {categoryLabel !== null ? <p>{`Categoría: ${categoryLabel}`}</p> : null}
      {isUntranslated(lang, question.lang) ? (
        <p className="untranslated-badge">Sin traducir</p>
      ) : null}
      <h2>{question.question}</h2>
      {timerActive ? <Timer seconds={seconds} onExpire={handleExpire} /> : null}
      <p>Elegí una opción</p>
      <div className="option-list">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            className="option-button touch-target"
            disabled={optionsDisabled}
            onClick={() => handleAnswer(option)}
          >
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>
      {loading ? <p role="status">Enviando respuesta...</p> : null}
    </section>
  );
}
