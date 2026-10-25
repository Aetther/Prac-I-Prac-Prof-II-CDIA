import type { LobbyInput } from "../game/lobby";
import { getNextTurn } from "../game/reducer";
import type { GameState } from "../game/types";
import { ErrorScreen } from "./ErrorScreen";
import { GameOver } from "./GameOver";
import { Lobby } from "./Lobby";
import { QuestionCard } from "./QuestionCard";
import { SwitchTurn } from "./SwitchTurn";

interface GameScreenProps {
  game: GameState;
  loading: boolean;
  errorMessage: string | null;
  onStart: (input: LobbyInput) => void;
  onAnswer: (answer: string) => void;
  onAnswerContinue: () => void;
  onTurnContinue: () => void;
  onRetry: () => void;
  onBackToLobby: () => void;
}

export function GameScreen({
  game,
  loading,
  errorMessage,
  onStart,
  onAnswer,
  onAnswerContinue,
  onTurnContinue,
  onRetry,
  onBackToLobby,
}: GameScreenProps) {
  if (errorMessage !== null) {
    return (
      <ErrorScreen
        message={errorMessage}
        onRetry={onRetry}
        onBackToLobby={onBackToLobby}
      />
    );
  }

  switch (game.phase) {
    case "Lobby":
      return <Lobby onStart={onStart} />;
    case "QuestionCard":
      if (game.config === null || game.currentQuestion === null) {
        return <p role="status">Cargando pregunta...</p>;
      }
      return (
        <QuestionCard
          question={game.currentQuestion}
          lang={game.config.lang}
          players={game.players}
          currentPlayer={game.currentPlayer}
          round={game.round}
          totalRounds={game.config.rounds}
          loading={loading}
          feedback={game.lastAnswer}
          onAnswer={onAnswer}
          onContinue={onAnswerContinue}
        />
      );
    case "SwitchTurn": {
      if (game.config === null) return null;
      const next = getNextTurn(game);
      const nextPlayer = game.players[next.currentPlayer];
      return (
        <SwitchTurn
          nextPlayerName={nextPlayer.name}
          nextPlayerIndex={next.currentPlayer}
          round={next.round}
          totalRounds={game.config.rounds}
          players={game.players}
          onContinue={onTurnContinue}
        />
      );
    }
    case "GameOver":
      if (game.result === null || game.config === null) return null;
      return (
        <GameOver
          result={game.result}
          players={game.players}
          totalRounds={game.config.rounds}
        />
      );
    case "Wheel":
    case "Result":
      return null;
  }
}
