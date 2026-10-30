import { notesInWindow } from "./music";
import type { ScheduledMusicNote } from "./music";

export const LOOKAHEAD_SECONDS = 0.12;
export const SCHEDULE_INTERVAL_MS = 25;
export const START_DELAY_SECONDS = 0.05;

export interface MusicScheduler {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/**
 * Lookahead scheduler: every 25 ms it hands `playNote` the notes that start in
 * the next 120 ms of audio time, so the music keeps time even when the main
 * thread is busy. `clock` returns the audio context's current time in seconds.
 */
export function createMusicScheduler(
  clock: () => number,
  playNote: (note: ScheduledMusicNote, when: number) => void,
): MusicScheduler {
  let handle: ReturnType<typeof setInterval> | null = null;
  let origin = 0;
  let scheduledUntil = 0;

  function pump(): void {
    const until = clock() - origin + LOOKAHEAD_SECONDS;
    if (until <= scheduledUntil) return;
    for (const note of notesInWindow(scheduledUntil, until)) {
      playNote(note, origin + note.time);
    }
    scheduledUntil = until;
  }

  return {
    start() {
      if (handle !== null) return;
      origin = clock() + START_DELAY_SECONDS;
      scheduledUntil = 0;
      pump();
      handle = setInterval(pump, SCHEDULE_INTERVAL_MS);
    },
    stop() {
      if (handle === null) return;
      clearInterval(handle);
      handle = null;
    },
    get running() {
      return handle !== null;
    },
  };
}
