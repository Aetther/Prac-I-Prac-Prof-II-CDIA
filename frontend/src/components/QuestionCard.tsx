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
import { SurrenderControl } from "./SurrenderControl";
import { Timer } from "./Timer";
import { useMessages } from "../i18n";

/** The answers are lettered by their API position, never by their text. */
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

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
  onUrgentSecond?: (seconds: number) => void;
  onSurrender?: () => void;
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
  onUrgentSecond,
  onSurrender,
}: QuestionCardProps) {
  const m = useMessages();
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
            <span>{m.categoryOf(categoryLabel)}</span>
          </p>
        ) : null}
        {timerActive ? (
          <Timer
            seconds={seconds}
            onExpire={handleExpire}
            onUrgentSecond={locked ? undefined : onUrgentSecond}
          />
        ) : null}
        {isUntranslated(lang, question.lang) ? (
          <p className="untranslated-badge">{m.untranslated}</p>
        ) : null}
        <div className="quiz-question">
          <div className="quiz-question-inner">
            <h2 className="question-text">{question.question}</h2>
            <span className="quiz-mark" aria-hidden="true">
              ?
            </span>
          </div>
        </div>
        <p>{m.pickAnswer}</p>
        <div className="option-list quiz-options">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              className="option-button quiz-option touch-target"
              data-option={OPTION_LETTERS[index].toLowerCase()}
              disabled={optionsDisabled}
              onClick={() => handleAnswer(option)}
            >
              <span className="quiz-letter" aria-hidden="true">
                {OPTION_LETTERS[index]}
              </span>
              <span className="option-text">{option}</span>
            </button>
          ))}
        </div>
        {loading ? <p role="status">{m.sendingAnswer}</p> : null}
        {onSurrender === undefined ? null : (
          <SurrenderControl
            playerName={players[currentPlayer].name}
            opponentName={players[currentPlayer === 0 ? 1 : 0].name}
            onSurrender={onSurrender}
          />
        )}
      </div>
    </section>
  );
}
