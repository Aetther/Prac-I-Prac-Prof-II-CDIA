import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { Player, PlayerIndex } from "../game/types";
import { CategoryChips } from "./CategoryChips";

interface ScoreboardProps {
  players: readonly [Player, Player];
  currentPlayer?: PlayerIndex;
  progress: MatchProgress;
  categories: readonly WheelCategory[];
  headingLevel?: 2 | 3;
}

export function Scoreboard({
  players,
  currentPlayer,
  progress,
  categories,
  headingLevel = 2,
}: ScoreboardProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section className="scoreboard" aria-label="Marcador">
      <Heading>Marcador</Heading>
      {progress.mode === "rounds" ? (
        <p>{`Ronda ${progress.round} de ${progress.totalRounds}`}</p>
      ) : (
        <p>Límite: 20 turnos por jugador</p>
      )}
      <ul className="scoreboard-list">
        {players.map((player, index) => {
          const isCurrent = currentPlayer === index;
          return (
            <li
              key={player.name + String(index)}
              className={
                isCurrent
                  ? "scoreboard-row scoreboard-row-current"
                  : "scoreboard-row"
              }
              aria-current={isCurrent ? "true" : undefined}
            >
              {progress.mode === "rounds" ? (
                <span>{`${player.name}: ${player.score} puntos`}</span>
              ) : (
                <>
                  <span>{player.name}</span>
                  <span>{`Categorías: ${progress.ownedCategories[index].length} de 6`}</span>
                  <span>{`Turnos: ${progress.turnsPlayed[index]} de 20`}</span>
                  <CategoryChips
                    playerName={player.name}
                    categories={categories}
                    owned={progress.ownedCategories[index]}
                  />
                </>
              )}
              {isCurrent ? (
                <span className="scoreboard-turn">Turno</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
