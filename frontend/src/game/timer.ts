export const TIMER_URGENT_SECONDS = 5;
export const TIMER_TICK_MS = 250;
export const TIMEOUT_ANSWER = "(sin respuesta)";

export interface TimerSnapshot {
  readonly remainingMs: number;
  readonly remainingSeconds: number;
  readonly urgent: boolean;
  readonly progress: number;
}

const MS_PER_SECOND = 1000;
const URGENT_MS = TIMER_URGENT_SECONDS * MS_PER_SECOND;

export function isTimerUrgent(remainingMs: number): boolean {
  return remainingMs <= URGENT_MS;
}

export function remainingSeconds(remainingMs: number): number {
  return Math.ceil(Math.max(0, remainingMs) / MS_PER_SECOND);
}

export function timerProgress(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  const ratio = remainingMs / totalMs;
  return Math.min(1, Math.max(0, ratio));
}

export function getTimerSnapshot(
  totalSeconds: number,
  deadlineMs: number,
  nowMs: number,
): TimerSnapshot {
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  return {
    remainingMs,
    remainingSeconds: remainingSeconds(remainingMs),
    urgent: isTimerUrgent(remainingMs),
    progress: timerProgress(remainingMs, totalSeconds * MS_PER_SECOND),
  };
}
