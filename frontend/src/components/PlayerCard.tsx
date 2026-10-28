import type { ReactNode } from "react";
import type { Player, PlayerIndex } from "../game/types";
import { playerColorIndex, playerInitial } from "./playerIdentity";

interface PlayerCardProps {
  player: Player;
  playerIndex: PlayerIndex;
  current?: boolean;
  children: ReactNode;
}

export function PlayerCard({
  player,
  playerIndex,
  current = false,
  children,
}: PlayerCardProps) {
  const playerNumber = playerColorIndex(playerIndex);
  return (
    <li
      className={[
        "scoreboard-row",
        "scoreboard-card",
        `scoreboard-card-${playerNumber}`,
        current ? "scoreboard-row-current" : "",
        current ? "scoreboard-card-current" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-player={String(playerNumber)}
      aria-current={current ? "true" : undefined}
    >
      <span className="scoreboard-avatar" aria-hidden="true">
        {playerInitial(player.name)}
      </span>
      {children}
    </li>
  );
}
