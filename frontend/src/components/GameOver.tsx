import type { CSSProperties } from "react";
import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import { isSixCategoriesResult } from "../game/sixCategories";
import type {
  CategoryHits,
  CategoryOwners,
  GameResult,
  Player,
  PlayerIndex,
  TurnsPlayed,
} from "../game/types";
import { PlayerCard } from "./PlayerCard";
import { Scoreboard } from "./Scoreboard";
import { useMessages } from "../i18n";
import type { Messages } from "../i18n";

const CONFETTI_COUNT = 24;
const CONFETTI_TOKENS = [
  "--color-category-geografia",
  "--color-category-historia",
  "--color-category-ciencia",
  "--color-category-arte",
  "--color-category-entretenimiento",
  "--color-category-deportes",
] as const;

interface GameOverProps {
  result: GameResult;
  players: readonly [Player, Player];
  categories: readonly WheelCategory[];
  ownedCategories: CategoryOwners;
  /** Correct answers per category in the crowns mode. */
  categoryHits?: CategoryHits;
  turnsPlayed: TurnsPlayed;
  /** Starts a new match at once with the same players and settings. */
  onRematch: () => void;
  onBackToLobby: () => void;
}

function confettiStyle(index: number): CSSProperties {
  const left = (index * 37) % 100;
  const delay = (index % 8) * 120;
  const token = CONFETTI_TOKENS[index % CONFETTI_TOKENS.length];
  return {
    "--confetti-x": `${left}%`,
    "--confetti-delay": `${delay}ms`,
    "--confetti-color": `var(${token})`,
  } as CSSProperties;
}

function Confetti() {
  return (
    <div className="game-over-confetti" aria-hidden="true">
      {Array.from({ length: CONFETTI_COUNT }, (_, index) => (
        <span
          key={index}
          className="confetti-piece"
          aria-hidden="true"
          style={confettiStyle(index)}
        />
      ))}
    </div>
  );
}

interface GameOverActionsProps {
  onRematch: () => void;
  onBackToLobby: () => void;
}

function GameOverActions({ onRematch, onBackToLobby }: GameOverActionsProps) {
  const m = useMessages();
  return (
    <div className="game-over-actions">
      <button
        type="button"
        className="button-primary touch-target"
        onClick={onRematch}
      >
        {m.rematch}
      </button>
      <button
        type="button"
        className="button-secondary touch-target"
        onClick={onBackToLobby}
      >
        {m.backToLobby}
      </button>
    </div>
  );
}

function winnerHeading(
  result: GameResult,
  players: readonly [Player, Player],
  m: Messages,
) {
  return result.kind === "winner"
    ? m.winner(players[result.winnerIndex].name)
    : m.tie;
}

export function GameOver({
  result,
  players,
  categories,
  ownedCategories,
  categoryHits,
  turnsPlayed,
  onRematch,
  onBackToLobby,
}: GameOverProps) {
  const m = useMessages();
  if (isSixCategoriesResult(result)) {
    const progress: MatchProgress = {
      mode: "six-categories",
      ownedCategories,
      turnsPlayed,
      ...(categoryHits === undefined ? {} : { categoryHits }),
    };
    return (
      <section className="game-over">
        <span className="game-over-trophy" aria-hidden="true">
          🏆
        </span>
        <h2>{winnerHeading(result, players, m)}</h2>
        <Confetti />
        <p>
          {result.reason === "surrender" && result.surrenderedBy !== undefined
            ? m.surrendered(players[result.surrenderedBy].name)
            : result.reason === "six-categories"
              ? m.collectedSix
              : result.kind === "winner" && result.hits !== undefined
                ? m.tieBrokenByHits(
                    result.hits[result.winnerIndex],
                    result.hits[result.winnerIndex === 0 ? 1 : 0],
                  )
                : m.turnLimitReached}
        </p>
        <Scoreboard
          players={players}
          progress={progress}
          categories={categories}
          headingLevel={3}
        />
        <p>{m.gameOver}</p>
        <GameOverActions onRematch={onRematch} onBackToLobby={onBackToLobby} />
      </section>
    );
  }

  return (
    <section className="game-over">
      <span className="game-over-trophy" aria-hidden="true">
        🏆
      </span>
      <h2>{winnerHeading(result, players, m)}</h2>
      <Confetti />
      {result.kind === "winner" && result.surrenderedBy !== undefined ? (
        <p>{m.surrendered(players[result.surrenderedBy].name)}</p>
      ) : null}
      <section className="scoreboard" aria-label={m.scoreboard}>
        <h3>{m.scoreboard}</h3>
        <ul className="scoreboard-list">
          {players.map((player, index) => (
            <PlayerCard
              key={player.name + String(index)}
              player={player}
              playerIndex={index as PlayerIndex}
            >
              <span className="scoreboard-stat scoreboard-rounds-total">
                {m.points(player.name, player.score)}
              </span>
            </PlayerCard>
          ))}
        </ul>
      </section>
      <p>{m.gameOver}</p>
      <GameOverActions onRematch={onRematch} onBackToLobby={onBackToLobby} />
    </section>
  );
}
