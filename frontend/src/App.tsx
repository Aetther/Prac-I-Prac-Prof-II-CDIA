import { useReducer, useRef, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "./api/errors";
import { getCategories, getGameQuestion, submitAnswer } from "./api/game";
import { reportQuestion } from "./api/reports";
import type { ReportReason } from "./api/types";
import { Admin } from "./components/Admin";
import { GameScreen } from "./components/GameScreen";
import {
  ALL_CATEGORIES_404_MESSAGE,
  DuplicateQuestionExhaustedError,
  INITIAL_GAME_STATE,
  TIMEOUT_ANSWER,
  buildWheelCategories,
  createLobbyConfig,
  fetchUnusedQuestion,
  gameReducer,
  getApiErrorMessage,
  getReportFailure,
  loadQuestionWithFallback,
  pickCategoryExcluding,
} from "./game";
import type { CategoryName, Lang, LobbyInput, WheelCategory } from "./game";
import type { ReportSubmissionResult } from "./game/reporting";

interface LoadRetryTarget {
  readonly type: "loadQuestion";
  readonly category: CategoryName;
  readonly attempted404: readonly CategoryName[];
}

interface LoadCategoriesTarget {
  readonly type: "loadCategories";
}

interface RespinTarget {
  readonly type: "respinCategory";
}

interface SubmitRetryTarget {
  readonly type: "submitAnswer";
  readonly questionId: number;
  readonly answer: string;
  readonly timedOut: boolean;
}

type RetryTarget =
  LoadRetryTarget | LoadCategoriesTarget | RespinTarget | SubmitRetryTarget;

type RequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "error";
      readonly message: string;
      readonly retry: RetryTarget;
    };

interface BeginQuestionContext {
  readonly category: CategoryName;
  readonly attempted404: readonly CategoryName[];
  readonly usedQuestionIds: readonly number[];
  readonly lang: Lang;
}

function isQuestion404(error: unknown): boolean {
  return (
    error instanceof ApiError && error.kind === "http" && error.status === 404
  );
}

function App() {
  const [game, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  const [categories, setCategories] = useState<readonly WheelCategory[] | null>(
    null,
  );
  const [request, setRequest] = useState<RequestState>({ status: "idle" });
  const inFlightRef = useRef(false);
  const [reportingQuestionId, setReportingQuestionId] = useState<number | null>(
    null,
  );
  const [unavailableQuestionId, setUnavailableQuestionId] = useState<
    number | null
  >(null);
  const gameRef = useRef(game);
  // A settled report promise needs the latest committed config synchronously.
  // eslint-disable-next-line react-hooks/refs
  gameRef.current = game;

  async function runExclusive(task: () => Promise<void>): Promise<void> {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await task();
    } finally {
      inFlightRef.current = false;
    }
  }

  async function loadCategories(): Promise<void> {
    setRequest({ status: "loading" });
    try {
      const data = await getCategories();
      const wheelCategories = buildWheelCategories(data);
      if (wheelCategories === null) {
        setRequest({
          status: "error",
          message: "Respuesta inválida del servidor.",
          retry: { type: "loadCategories" },
        });
        return;
      }
      setCategories(wheelCategories);
      setRequest({ status: "idle" });
    } catch (error) {
      let message: string;
      if (error instanceof ApiError) {
        message = getApiErrorMessage(error);
        console.error("No se pudieron cargar las categorías", {
          kind: error.kind,
          status: error.status,
        });
      } else {
        message = "Ocurrió un error inesperado.";
      }
      setRequest({
        status: "error",
        message,
        retry: { type: "loadCategories" },
      });
    }
  }

  async function beginQuestion(context: BeginQuestionContext): Promise<void> {
    setRequest({ status: "loading" });
    const outcome = await loadQuestionWithFallback(
      (category) =>
        fetchUnusedQuestion(
          getGameQuestion,
          category,
          context.lang,
          context.usedQuestionIds,
        ),
      pickCategoryExcluding,
      isQuestion404,
      { category: context.category, attempted404: context.attempted404 },
    );

    if (outcome.kind === "loaded") {
      dispatch({ type: "QUESTION_LOADED", question: outcome.question });
      setRequest({ status: "idle" });
      return;
    }

    if (outcome.kind === "all-categories-404") {
      setRequest({
        status: "error",
        message: ALL_CATEGORIES_404_MESSAGE,
        retry: { type: "respinCategory" },
      });
      return;
    }

    let message: string;
    if (outcome.error instanceof DuplicateQuestionExhaustedError) {
      message = outcome.error.message;
    } else if (outcome.error instanceof ApiError) {
      message = getApiErrorMessage(outcome.error);
      console.error("No se pudo cargar la pregunta", {
        kind: outcome.error.kind,
        status: outcome.error.status,
      });
    } else {
      message = "Ocurrió un error inesperado.";
    }
    setRequest({
      status: "error",
      message,
      retry: {
        type: "loadQuestion",
        category: outcome.category,
        attempted404: outcome.attempted404,
      },
    });
  }

  async function submitAnswerWithRetry(
    questionId: number,
    answer: string,
    lang: Lang,
    timedOut: boolean,
  ): Promise<void> {
    setRequest({ status: "loading" });
    try {
      const result = await submitAnswer(questionId, answer, lang);
      dispatch({
        type: "ANSWER_RECEIVED",
        chosenAnswer: timedOut ? null : answer,
        correct: timedOut ? false : result.correct,
        correctAnswer: result.correct_answer,
        timedOut,
      });
      setRequest({ status: "idle" });
    } catch (error) {
      let message: string;
      if (error instanceof ApiError) {
        message = getApiErrorMessage(error);
        console.error("No se pudo enviar la respuesta", {
          questionId,
          kind: error.kind,
          status: error.status,
        });
      } else {
        message = "Ocurrió un error inesperado.";
      }
      setRequest({
        status: "error",
        message,
        retry: { type: "submitAnswer", questionId, answer, timedOut },
      });
    }
  }

  const handleStart = (input: LobbyInput) => {
    const config = createLobbyConfig(input);
    if (config === null) return;
    setUnavailableQuestionId(null);
    void runExclusive(async () => {
      dispatch({ type: "START_GAME", config });
      await loadCategories();
    });
  };

  const handleAnswer = (answer: string) => {
    const question = game.currentQuestion;
    const config = game.config;
    if (game.phase !== "QuestionCard") return;
    if (question === null || config === null) return;
    if (game.lastAnswer !== null || request.status === "loading") return;
    void runExclusive(async () => {
      await submitAnswerWithRetry(question.id, answer, config.lang, false);
    });
  };

  const handleTimeout = () => {
    const question = game.currentQuestion;
    const config = game.config;
    if (game.phase !== "QuestionCard") return;
    if (question === null || config === null) return;
    if (game.lastAnswer !== null || request.status === "loading") return;
    void runExclusive(async () => {
      await submitAnswerWithRetry(
        question.id,
        TIMEOUT_ANSWER,
        config.lang,
        true,
      );
    });
  };

  const handleAnswerContinue = () => {
    if (game.phase !== "Result" || game.lastAnswer === null) return;
    dispatch({ type: "CONTINUE_AFTER_ANSWER" });
  };

  const handleReport = async (
    reason: ReportReason,
    comment: string,
  ): Promise<ReportSubmissionResult> => {
    const question = game.currentQuestion;
    const config = game.config;
    if (
      game.phase !== "Result" ||
      question === null ||
      config === null ||
      game.reportedQuestionIds.includes(question.id) ||
      unavailableQuestionId === question.id ||
      reportingQuestionId !== null
    ) {
      return {
        ok: false,
        message: "No se pudo enviar el reporte.",
        retryable: false,
        unavailable: false,
      };
    }

    const questionId = question.id;
    const matchId = game.matchId;
    setReportingQuestionId(questionId);
    try {
      await reportQuestion(questionId, reason, comment, config.lang);
      if (gameRef.current.config === config) {
        dispatch({ type: "QUESTION_REPORTED", questionId, matchId });
      }
      return { ok: true };
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("No se pudo reportar la pregunta", {
          questionId,
          kind: error.kind,
          status: error.status,
        });
        const failure = getReportFailure(error);
        if (failure.unavailable) {
          setUnavailableQuestionId(questionId);
        }
        return failure;
      }
      console.error("No se pudo reportar la pregunta", { questionId });
      return {
        ok: false,
        message: "Ocurrió un error inesperado.",
        retryable: false,
        unavailable: false,
      };
    } finally {
      setReportingQuestionId((current) =>
        current === questionId ? null : current,
      );
    }
  };

  const handleTurnContinue = () => {
    if (game.phase !== "SwitchTurn" || game.config === null) return;
    dispatch({ type: "ADVANCE_TURN" });
  };

  const handleChooseCategory = (category: CategoryName) => {
    if (game.phase !== "Wheel" || game.config === null) return;
    const usedQuestionIds = game.usedQuestionIds;
    const lang = game.config.lang;
    void runExclusive(async () => {
      dispatch({ type: "CATEGORY_CONFIRMED" });
      await beginQuestion({
        category,
        attempted404: [],
        usedQuestionIds,
        lang,
      });
    });
  };

  const handleRetry = () => {
    if (request.status !== "error" || game.config === null) return;
    const target = request.retry;
    const usedQuestionIds = game.usedQuestionIds;
    const lang = game.config.lang;
    void runExclusive(async () => {
      if (target.type === "loadQuestion") {
        await beginQuestion({
          category: target.category,
          attempted404: target.attempted404,
          usedQuestionIds,
          lang,
        });
      } else if (target.type === "loadCategories") {
        await loadCategories();
      } else if (target.type === "respinCategory") {
        dispatch({ type: "RESPIN_CATEGORY" });
        setRequest({ status: "idle" });
      } else {
        await submitAnswerWithRetry(
          target.questionId,
          target.answer,
          lang,
          target.timedOut,
        );
      }
    });
  };

  const handleBackToLobby = () => {
    dispatch({ type: "RESET_GAME" });
    setCategories(null);
    setRequest({ status: "idle" });
    setUnavailableQuestionId(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <GameScreen
              game={game}
              categories={categories}
              loading={request.status === "loading"}
              errorMessage={request.status === "error" ? request.message : null}
              onStart={handleStart}
              onAnswer={handleAnswer}
              onTimeout={handleTimeout}
              onAnswerContinue={handleAnswerContinue}
              onTurnContinue={handleTurnContinue}
              onChooseCategory={handleChooseCategory}
              onRetry={handleRetry}
              onBackToLobby={handleBackToLobby}
              reportingQuestionId={reportingQuestionId}
              unavailableQuestionId={unavailableQuestionId}
              onReport={handleReport}
            />
          }
        />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
