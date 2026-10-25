import type { GameResult, Player } from "../game/types";

interface GameOverProps {
  result: GameResult;
  players: readonly [Player, Player];
  totalRounds: number;
}

export function GameOver({ result, players }: GameOverProps) {
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
