import type { WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
import type { Player, PlayerIndex } from "../game/types";
import { playerColorIndex, playerInitial } from "./playerIdentity";
import { Scoreboard } from "./Scoreboard";
import { SurrenderControl } from "./SurrenderControl";
import { useMessages } from "../i18n";

interface SwitchTurnProps {
  nextPlayerName: string;
  nextPlayerIndex: PlayerIndex;
  progress: MatchProgress;
  categories: readonly WheelCategory[];
  players: readonly [Player, Player];
  onContinue: () => void;
  onSurrender?: () => void;
}

function PassDeviceIcon() {
  return (
    <svg
      className="switch-turn-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="7"
        y="3"
        width="10"
        height="18"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M11 18h2M3 9l2 2-2 2M21 9l-2 2 2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One dot per round; the rounds reached so far are filled. */
function RoundDots({ round, total }: { round: number; total: number }) {
  return (
    <span className="round-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={index < round ? "round-dot round-dot-filled" : "round-dot"}
        />
      ))}
    </span>
  );
}

export function SwitchTurn({
  nextPlayerName,
  nextPlayerIndex,
  progress,
  categories,
  players,
  onContinue,
  onSurrender,
}: SwitchTurnProps) {
  const m = useMessages();
  return (
    <section
      className="switch-turn"
      data-player={playerColorIndex(nextPlayerIndex)}
    >
      <span
        className="switch-turn-avatar"
        data-player={playerColorIndex(nextPlayerIndex)}
        aria-hidden="true"
      >
        {playerInitial(nextPlayerName)}
      </span>
      <h2 className="switch-turn-bubble">{m.turnOf(nextPlayerName)}</h2>
      <p className="switch-turn-hint">
        <PassDeviceIcon />
        {m.passDevice}
      </p>
      <Scoreboard
        players={players}
        currentPlayer={nextPlayerIndex}
        progress={progress}
        categories={categories}
        roundExtra={
          progress.mode === "rounds" ? (
            <RoundDots round={progress.round} total={progress.totalRounds} />
          ) : undefined
        }
      />
      {onSurrender === undefined ? null : (
        <SurrenderControl
          playerName={nextPlayerName}
          opponentName={players[nextPlayerIndex === 0 ? 1 : 0].name}
          onSurrender={onSurrender}
        />
      )}
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
