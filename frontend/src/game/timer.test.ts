// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  TIMEOUT_ANSWER,
  getTimerSnapshot,
  isTimerUrgent,
  remainingSeconds,
  timerProgress,
  urgentSecondToAnnounce,
} from "./timer";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

describe("timer rules", () => {
  it("TMR-01 getTimerSnapshot returns the full configured window at its start", () => {
    for (const totalSeconds of [10, 20, 30]) {
      expect(
        getTimerSnapshot(totalSeconds, NOW + totalSeconds * 1000, NOW),
      ).toEqual({
        remainingMs: totalSeconds * 1000,
        remainingSeconds: totalSeconds,
        urgent: false,
        progress: 1,
      });
    }
  });

  it("TMR-02 getTimerSnapshot uses ceil seconds and the remaining fraction", () => {
    const snapshot = getTimerSnapshot(20, NOW + 20_000, NOW + 3_000);

    expect(snapshot.remainingMs).toBe(17_000);
    expect(snapshot.remainingSeconds).toBe(17);
    expect(snapshot.urgent).toBe(false);
    expect(snapshot.progress).toBeCloseTo(0.85, 10);
  });

  it("TMR-03 isTimerUrgent is true at five seconds and false at six", () => {
    expect(isTimerUrgent(6_000)).toBe(false);
    expect(isTimerUrgent(5_000)).toBe(true);
    expect(isTimerUrgent(4_999)).toBe(true);
    expect(isTimerUrgent(0)).toBe(true);
  });

  it("TMR-04 getTimerSnapshot is empty and urgent at or past the deadline", () => {
    const empty = {
      remainingMs: 0,
      remainingSeconds: 0,
      urgent: true,
      progress: 0,
    };

    expect(getTimerSnapshot(20, NOW, NOW)).toEqual(empty);
    expect(getTimerSnapshot(20, NOW, NOW + 1)).toEqual(empty);
    expect(getTimerSnapshot(0, NOW, NOW).progress).toBe(0);
    expect(getTimerSnapshot(-5, NOW, NOW).progress).toBe(0);
    expect(getTimerSnapshot(0, NOW, NOW).remainingSeconds).toBe(0);
  });

  it("TMR-05 remainingSeconds rounds 1.5 seconds up to 2", () => {
    expect(remainingSeconds(1_500)).toBe(2);
    expect(remainingSeconds(1_000)).toBe(1);
    expect(remainingSeconds(999)).toBe(1);
    expect(remainingSeconds(1)).toBe(1);
  });

  it("TMR-06 timerProgress clamps to the unit interval", () => {
    expect(timerProgress(0, 20_000)).toBe(0);
    expect(timerProgress(20_000, 20_000)).toBe(1);
    expect(timerProgress(25_000, 20_000)).toBe(1);
    expect(timerProgress(-1_000, 20_000)).toBe(0);
    expect(timerProgress(1_000, 0)).toBe(0);
    expect(timerProgress(1_000, -1)).toBe(0);
  });

  it("TMR-07 getTimerSnapshot for a 10-second window is urgent for half of it", () => {
    const deadline = NOW + 10_000;

    expect(getTimerSnapshot(10, deadline, NOW + 4_000).urgent).toBe(false);
    expect(getTimerSnapshot(10, deadline, NOW + 5_000)).toEqual({
      remainingMs: 5_000,
      remainingSeconds: 5,
      urgent: true,
      progress: 0.5,
    });
    expect(getTimerSnapshot(10, deadline, NOW + 7_500).progress).toBeCloseTo(
      0.25,
      10,
    );
  });

  it("TMR-08 getTimerSnapshot for a 30-second window keeps exact seconds across the boundary", () => {
    const deadline = NOW + 30_000;

    expect(getTimerSnapshot(30, deadline, NOW + 5_000)).toMatchObject({
      remainingSeconds: 25,
      urgent: false,
    });
    expect(getTimerSnapshot(30, deadline, NOW + 25_000)).toMatchObject({
      remainingSeconds: 5,
      urgent: true,
    });
  });

  it("exposes the sentinel answer as a constant", () => {
    expect(TIMEOUT_ANSWER).toBe("(sin respuesta)");
  });
});

describe("urgentSecondToAnnounce", () => {
  it("TMR-20 announces each of the last five seconds as the countdown reaches it", () => {
    expect(urgentSecondToAnnounce(6, 5)).toBe(5);
    expect(urgentSecondToAnnounce(5, 4)).toBe(4);
    expect(urgentSecondToAnnounce(3, 2)).toBe(2);
    expect(urgentSecondToAnnounce(2, 1)).toBe(1);
  });

  it("TMR-21 does not announce zero, an unchanged value or a second above five", () => {
    expect(urgentSecondToAnnounce(1, 0)).toBeNull();
    expect(urgentSecondToAnnounce(4, 4)).toBeNull();
    expect(urgentSecondToAnnounce(8, 7)).toBeNull();
    expect(urgentSecondToAnnounce(7, 6)).toBeNull();
  });

  it("TMR-22 announces the second reached when the countdown jumps", () => {
    expect(urgentSecondToAnnounce(7, 4)).toBe(4);
    expect(urgentSecondToAnnounce(10, 5)).toBe(5);
  });
});
