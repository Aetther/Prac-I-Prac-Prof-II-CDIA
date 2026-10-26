import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import { isSixCategoriesResult } from "../game/sixCategories";
import type {
  CategoryOwners,
  GameResult,
  Player,
  TurnsPlayed,
} from "../game/types";
import { Scoreboard } from "./Scoreboard";

interface GameOverProps {
  result: GameResult;
  players: readonly [Player, Player];
  categories: readonly WheelCategory[];
  ownedCategories: CategoryOwners;
  turnsPlayed: TurnsPlayed;
}

export function GameOver({
  result,
  players,
  categories,
  ownedCategories,
  turnsPlayed,
}: GameOverProps) {
  if (isSixCategoriesResult(result)) {
    const progress: MatchProgress = {
      mode: "six-categories",
      ownedCategories,
      turnsPlayed,
    };
    return (
      <section className="game-over">
        <h2>
          {result.kind === "winner"
            ? `Ganó ${players[result.winnerIndex].name}`
            : "Empate"}
        </h2>
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
      </section>
    );
  }

  return (
    <section className="game-over">
      <h2>
        {result.kind === "winner"
          ? `Ganó ${players[result.winnerIndex].name}`
          : "Empate"}
      </h2>
      <section className="scoreboard" aria-label="Marcador">
        <h3>Marcador</h3>
        <ul className="scoreboard-list">
          {players.map((player, index) => (
            <li key={player.name + String(index)} className="scoreboard-row">
              <span>{`${player.name}: ${player.score} puntos`}</span>
            </li>
          ))}
        </ul>
      </section>
      <p>Fin de la partida</p>
    </section>
  );
}
