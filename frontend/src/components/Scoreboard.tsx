import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { Player, PlayerIndex } from "../game/types";
import { CategoryChips } from "./CategoryChips";
import { PlayerCard } from "./PlayerCard";
import { useMessages } from "../i18n";

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
  const m = useMessages();
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section
      className="scoreboard scoreboard-rail"
      aria-label={m.scoreboard}
      data-mode={progress.mode}
    >
      <Heading>{m.scoreboard}</Heading>
      {progress.mode === "rounds" ? (
        <p>{m.roundOf(progress.round, progress.totalRounds)}</p>
      ) : (
        <p>{m.turnLimit}</p>
      )}
      <ul className="scoreboard-list">
        {players.map((player, index) => {
          const isCurrent = currentPlayer === index;
          return (
            <PlayerCard
              key={player.name + String(index)}
              player={player}
              playerIndex={index as PlayerIndex}
              current={isCurrent}
            >
              {progress.mode === "rounds" ? (
                <span className="scoreboard-stat scoreboard-rounds-total">
                  {m.points(player.name, player.score)}
                </span>
              ) : (
                <>
                  <span>{player.name}</span>
                  <span className="scoreboard-stat">
                    {m.categoriesCount(progress.ownedCategories[index].length)}
                  </span>
                  <span className="scoreboard-stat">
                    {m.turnsCount(progress.turnsPlayed[index])}
                  </span>
                  <CategoryChips
                    playerName={player.name}
                    categories={categories}
                    owned={progress.ownedCategories[index]}
                  />
                </>
              )}
              {isCurrent ? (
                <span className="scoreboard-turn">{m.turn}</span>
              ) : null}
            </PlayerCard>
          );
        })}
      </ul>
    </section>
  );
}
