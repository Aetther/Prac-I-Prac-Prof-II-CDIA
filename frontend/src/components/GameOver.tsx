import type { CSSProperties } from "react";
import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import { isSixCategoriesResult } from "../game/sixCategories";
import type {
  CategoryOwners,
  GameResult,
  Player,
  PlayerIndex,
  TurnsPlayed,
} from "../game/types";
import { PlayerCard } from "./PlayerCard";
import { Scoreboard } from "./Scoreboard";

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
  turnsPlayed: TurnsPlayed;
  onPlayAgain: () => void;
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

function winnerHeading(result: GameResult, players: readonly [Player, Player]) {
  return result.kind === "winner"
    ? `¡Ganó ${players[result.winnerIndex].name}!`
    : "¡Empate!";
}

export function GameOver({
  result,
  players,
  categories,
  ownedCategories,
  turnsPlayed,
  onPlayAgain,
}: GameOverProps) {
  if (isSixCategoriesResult(result)) {
    const progress: MatchProgress = {
      mode: "six-categories",
      ownedCategories,
      turnsPlayed,
    };
    return (
      <section className="game-over">
        <span className="game-over-trophy" aria-hidden="true">
          🏆
        </span>
        <h2>{winnerHeading(result, players)}</h2>
        <Confetti />
        <p>
          {result.reason === "six-categories"
            ? "Juntó las 6 categorías."
            : "Se alcanzó el límite de 20 turnos."}
        </p>
        <Scoreboard
          players={players}
          progress={progress}
          categories={categories}
          headingLevel={3}
        />
        <p>Fin de la partida</p>
        <button
          type="button"
          className="button-primary touch-target"
          onClick={onPlayAgain}
        >
          Jugar de nuevo
        </button>
      </section>
    );
  }

  return (
    <section className="game-over">
      <span className="game-over-trophy" aria-hidden="true">
        🏆
      </span>
      <h2>{winnerHeading(result, players)}</h2>
      <Confetti />
      <section className="scoreboard" aria-label="Marcador">
        <h3>Marcador</h3>
        <ul className="scoreboard-list">
          {players.map((player, index) => (
            <PlayerCard
              key={player.name + String(index)}
              player={player}
              playerIndex={index as PlayerIndex}
            >
              <span className="scoreboard-stat scoreboard-rounds-total">
                {`${player.name}: ${player.score} puntos`}
              </span>
            </PlayerCard>
          ))}
        </ul>
      </section>
      <p>Fin de la partida</p>
      <button
        type="button"
        className="button-primary touch-target"
        onClick={onPlayAgain}
      >
        Jugar de nuevo
      </button>
    </section>
  );
}
