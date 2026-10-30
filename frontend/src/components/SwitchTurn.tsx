import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { Player, PlayerIndex } from "../game/types";
import { playerColorIndex, playerInitial } from "./playerIdentity";
import { Scoreboard } from "./Scoreboard";
import { useMessages } from "../i18n";

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
  const m = useMessages();
  return (
    <section className="switch-turn">
      <span
        className="switch-turn-avatar"
        data-player={playerColorIndex(nextPlayerIndex)}
        aria-hidden="true"
      >
        {playerInitial(nextPlayerName)}
      </span>
      <h2>{m.turnOf(nextPlayerName)}</h2>
      <p className="switch-turn-hint">{m.passDevice}</p>
      <Scoreboard
        players={players}
        currentPlayer={nextPlayerIndex}
        progress={progress}
        categories={categories}
      />
      <button
        type="button"
        className="button-primary touch-target"
        onClick={onContinue}
      >
        {m.ready}
      </button>
    </section>
  );
}
