import type { WheelCategory } from "../game/category";
import type { LobbyInput } from "../game/lobby";
import { getMatchProgress } from "../game/progress";
import { getNextTurn } from "../game/reducer";
import type { CategoryName, GameState } from "../game/types";
import type { WheelTickHandler } from "../game/wheel";
import { ErrorScreen } from "./ErrorScreen";
import { GameOver } from "./GameOver";
import { Lobby } from "./Lobby";
import { QuestionCard } from "./QuestionCard";
import { Result } from "./Result";
import { SwitchTurn } from "./SwitchTurn";
import { Wheel } from "./Wheel";

interface GameScreenProps {
  game: GameState;
  categories: readonly WheelCategory[] | null;
  loading: boolean;
  errorMessage: string | null;
  onStart: (input: LobbyInput) => void;
  onAnswer: (answer: string) => void;
  onTimeout: () => void;
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
  onTimeout,
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

  if (game.phase === "Lobby") {
    return <Lobby onStart={onStart} />;
  }

  if (game.config === null) return null;

  const progress = getMatchProgress(game.config, game);
  const wheelCategories = categories ?? [];

  switch (game.phase) {
    case "Wheel":
      if (categories === null) {
        return <p role="status">Cargando categorías...</p>;
      }
      return (
        <Wheel
          categories={categories}
          players={game.players}
          currentPlayer={game.currentPlayer}
          progress={progress}
          onChooseCategory={onChooseCategory}
          onSectorCross={onSectorCross}
        />
      );
    case "QuestionCard": {
      const question = game.currentQuestion;
      if (question === null) {
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
          progress={progress}
          categories={wheelCategories}
          loading={loading}
          seconds={game.config.secondsPerQuestion}
          timerActive={!loading && game.lastAnswer === null}
          categoryLabel={categoryLabel}
          onAnswer={onAnswer}
          onTimeout={onTimeout}
        />
      );
    }
    case "SwitchTurn": {
      const next = getNextTurn(game);
      const nextPlayer = game.players[next.currentPlayer];
      const nextProgress =
        progress.mode === "rounds"
          ? { ...progress, round: next.round }
          : progress;
      return (
        <SwitchTurn
          nextPlayerName={nextPlayer.name}
          nextPlayerIndex={next.currentPlayer}
          progress={nextProgress}
          categories={wheelCategories}
          players={game.players}
          onContinue={onTurnContinue}
        />
      );
    }
    case "GameOver":
      if (game.result === null) return null;
      return (
        <GameOver
          result={game.result}
          players={game.players}
          categories={wheelCategories}
          ownedCategories={game.ownedCategories}
          turnsPlayed={game.turnsPlayed}
        />
      );
    case "Result": {
      const question = game.currentQuestion;
      const lastAnswer = game.lastAnswer;
      if (question === null || lastAnswer === null) {
        return null;
      }
      return (
        <Result
          question={question}
          lastAnswer={lastAnswer}
          players={game.players}
          currentPlayer={game.currentPlayer}
          progress={progress}
          categories={wheelCategories}
          onContinue={onAnswerContinue}
        />
      );
    }
  }
}
