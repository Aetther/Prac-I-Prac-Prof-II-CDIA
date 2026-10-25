import type { Player, PlayerIndex } from "../game/types";

interface ScoreboardProps {
  players: readonly [Player, Player];
  currentPlayer?: PlayerIndex;
  round: number;
  totalRounds: number;
}

export function Scoreboard({
  players,
  currentPlayer,
  round,
  totalRounds,
}: ScoreboardProps) {
  return (
    <section className="scoreboard" aria-label="Marcador">
      <h2>Marcador</h2>
      <p>{`Ronda ${round} de ${totalRounds}`}</p>
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
              <span>{`${player.name}: ${player.score} puntos`}</span>
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
