import { useRef, useState } from "react";
import type { GameQuestion } from "../api/types";
import {
  findCategoryEmoji,
  isCategoryName,
  type WheelCategory,
} from "../game/category";
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
  const categoryEmoji = isCategoryName(question.category)
    ? findCategoryEmoji(question.category)
    : "";

  return (
    <section className="question-card game-layout">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        progress={progress}
        categories={categories}
      />
      <div className="game-main">
        {categoryLabel !== null ? (
          <p className="category-banner" data-category={question.category}>
            <span aria-hidden="true">{categoryEmoji}</span>
            <span>{`Categoría: ${categoryLabel}`}</span>
          </p>
        ) : null}
        {timerActive ? (
          <Timer seconds={seconds} onExpire={handleExpire} />
        ) : null}
        {isUntranslated(lang, question.lang) ? (
          <p className="untranslated-badge">Sin traducir</p>
        ) : null}
        <h2 className="question-text">{question.question}</h2>
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
      </div>
    </section>
  );
}
