import type { Player, PlayerIndex } from "../game/types";
import { Scoreboard } from "./Scoreboard";

interface SwitchTurnProps {
  nextPlayerName: string;
  nextPlayerIndex: PlayerIndex;
  round: number;
  totalRounds: number;
  players: readonly [Player, Player];
  onContinue: () => void;
}

export function SwitchTurn({
  nextPlayerName,
  nextPlayerIndex,
  round,
  totalRounds,
  players,
  onContinue,
}: SwitchTurnProps) {
  return (
    <section className="switch-turn">
      <h2>{`Pasale el dispositivo a ${nextPlayerName}`}</h2>
      <Scoreboard
        players={players}
        currentPlayer={nextPlayerIndex}
        round={round}
        totalRounds={totalRounds}
      />
      <button type="button" className="touch-target" onClick={onContinue}>
        Continuar
      </button>
    </section>
  );
}
