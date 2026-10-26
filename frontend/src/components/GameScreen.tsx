import type { WheelCategory } from "../game/category";
import type { LobbyInput } from "../game/lobby";
import { getNextTurn } from "../game/reducer";
import type { CategoryName, GameState } from "../game/types";
import type { WheelTickHandler } from "../game/wheel";
import { ErrorScreen } from "./ErrorScreen";
import { GameOver } from "./GameOver";
import { Lobby } from "./Lobby";
import { QuestionCard } from "./QuestionCard";
import { SwitchTurn } from "./SwitchTurn";
import { Wheel } from "./Wheel";

interface GameScreenProps {
  game: GameState;
  categories: readonly WheelCategory[] | null;
  loading: boolean;
  errorMessage: string | null;
  onStart: (input: LobbyInput) => void;
  onAnswer: (answer: string) => void;
  onAnswerContinue: () => void;
  onTurnContinue: () => void;
  onChooseCategory: (category: CategoryName) => void;
  onSectorCross?: WheelTickHandler;
  onRetry: () => void;
  onBackToLobby: () => void;
}

export function GameScreen({
  game,
  categories,
  loading,
  errorMessage,
  onStart,
  onAnswer,
  onAnswerContinue,
  onTurnContinue,
  onChooseCategory,
  onSectorCross,
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
    case "Wheel":
      if (categories === null) {
        return <p role="status">Cargando categorías...</p>;
      }
      if (game.config === null) return null;
      return (
        <Wheel
          categories={categories}
          players={game.players}
          currentPlayer={game.currentPlayer}
          round={game.round}
          totalRounds={game.config.rounds}
          onChooseCategory={onChooseCategory}
          onSectorCross={onSectorCross}
        />
      );
    case "QuestionCard": {
      const question = game.currentQuestion;
      if (game.config === null || question === null) {
        return <p role="status">Cargando pregunta...</p>;
      }
      const categoryLabel =
        categories === null
          ? null
          : (categories.find((category) => category.name === question.category)
              ?.label ?? null);
      return (
        <QuestionCard
          question={question}
          lang={game.config.lang}
          players={game.players}
          currentPlayer={game.currentPlayer}
          round={game.round}
          totalRounds={game.config.rounds}
          loading={loading}
          feedback={game.lastAnswer}
          categoryLabel={categoryLabel}
          onAnswer={onAnswer}
          onContinue={onAnswerContinue}
        />
      );
    }
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
    case "Result":
      return null;
  }
}
