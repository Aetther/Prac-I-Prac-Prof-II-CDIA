import { useEffect } from "react";
import type { GameState, LastAnswer } from "../game/types";
import type { SoundEffect } from "./recipes";
import type { SoundControls } from "./useSound";

export function outcomeEffect(
  answer: Pick<LastAnswer, "correct" | "timedOut">,
): SoundEffect {
  if (answer.timedOut) return "timeout";
  return answer.correct ? "correct" : "wrong";
}

/** A match is in progress from "JUGAR" until GameOver or the Lobby. */
export function isMatchInProgress(phase: GameState["phase"]): boolean {
  return phase !== "Lobby" && phase !== "GameOver";
}

type GameSoundControls = Pick<
  SoundControls,
  "play" | "startMusic" | "stopMusic"
>;

/**
 * Plays the outcome and victory sounds on the transitions into Result and
 * GameOver, and keeps the music running only while a match is in progress.
 * `sound` methods must be stable, so a preference change never replays a sound.
 */
export function useGameSounds(
  sound: GameSoundControls,
  game: Pick<GameState, "phase" | "lastAnswer">,
): void {
  const { play, startMusic, stopMusic } = sound;
  const matchInProgress = isMatchInProgress(game.phase);
  const settledAnswer = game.phase === "Result" ? game.lastAnswer : null;
  const gameOver = game.phase === "GameOver";

  useEffect(() => {
    if (matchInProgress) startMusic();
    else stopMusic();
  }, [matchInProgress, startMusic, stopMusic]);

  useEffect(() => stopMusic, [stopMusic]);

  useEffect(() => {
    if (settledAnswer !== null) play(outcomeEffect(settledAnswer));
  }, [settledAnswer, play]);

  useEffect(() => {
    if (gameOver) play("victory");
  }, [gameOver, play]);
}
