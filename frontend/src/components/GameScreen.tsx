import { useGameSounds } from "../audio";
import type { SoundControls } from "../audio";
import type { WheelCategory } from "../game/category";
import type { LobbyInput } from "../game/lobby";
import { getMatchProgress } from "../game/progress";
import { getNextTurn } from "../game/reducer";
import type { ReportSubmissionResult } from "../game/reporting";
import type { CategoryName, GameState } from "../game/types";
import type { ReportReason } from "../api/types";
import type { WheelTickHandler } from "../game/wheel";
import { AudioControls } from "./AudioControls";
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
  reportingQuestionId: number | null;
  unavailableQuestionId: number | null;
  onReport: (
    reason: ReportReason,
    comment: string,
  ) => Promise<ReportSubmissionResult>;
  onSpinStop?: () => void;
  onUrgentSecond?: (seconds: number) => void;
}

interface GameScreenWithSoundProps extends GameScreenProps {
  sound?: SoundControls;
}

function ignore(): void {
  // Without a sound system the game view is silent.
}

const SILENT_SOUND = { play: ignore, startMusic: ignore, stopMusic: ignore };

/** The game view: the sound controls on top of every phase, plus its sounds. */
export function GameScreen({ sound, ...props }: GameScreenWithSoundProps) {
  const sounds = sound ?? SILENT_SOUND;
  const { play } = sounds;
  useGameSounds(sounds, props.game);
  return (
    <>
      {sound === undefined ? null : <AudioControls sound={sound} />}
      <GamePhase
        {...props}
        onSectorCross={props.onSectorCross ?? sound?.tick}
        onSpinStop={() => play("spinStop")}
        onUrgentSecond={() => play("clockTick")}
      />
    </>
  );
}

function GamePhase({
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
  reportingQuestionId,
  unavailableQuestionId,
  onReport,
  onSpinStop,
  onUrgentSecond,
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
          onSpinStop={onSpinStop}
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
          onUrgentSecond={onUrgentSecond}
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
          onPlayAgain={onBackToLobby}
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
          reported={game.reportedQuestionIds.includes(question.id)}
          reporting={reportingQuestionId === question.id}
          unavailable={unavailableQuestionId === question.id}
          onReport={onReport}
          onContinue={onAnswerContinue}
        />
      );
    }
  }
}
