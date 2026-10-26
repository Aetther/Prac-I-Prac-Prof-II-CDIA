import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { Player, PlayerIndex } from "../game/types";
import { Scoreboard } from "./Scoreboard";

interface SwitchTurnProps {
  nextPlayerName: string;
  nextPlayerIndex: PlayerIndex;
  progress: MatchProgress;
  categories: readonly WheelCategory[];
  players: readonly [Player, Player];
  onContinue: () => void;
}

export function SwitchTurn({
  nextPlayerName,
  nextPlayerIndex,
  progress,
  categories,
  players,
  onContinue,
}: SwitchTurnProps) {
  return (
    <section className="switch-turn">
      <h2>{`Pasale el dispositivo a ${nextPlayerName}`}</h2>
      <Scoreboard
        players={players}
        currentPlayer={nextPlayerIndex}
        progress={progress}
        categories={categories}
      />
      <button type="button" className="touch-target" onClick={onContinue}>
        Continuar
      </button>
    </section>
  );
}
