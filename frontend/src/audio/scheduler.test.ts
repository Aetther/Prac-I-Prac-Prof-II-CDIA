// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUSIC_LOOP_SECONDS } from "./music";
import type { ScheduledMusicNote } from "./music";
import {
  LOOKAHEAD_SECONDS,
  SCHEDULE_INTERVAL_MS,
  START_DELAY_SECONDS,
  createMusicScheduler,
} from "./scheduler";

let now = 0;
let played: { note: ScheduledMusicNote; when: number }[] = [];

function setup() {
  return createMusicScheduler(
    () => now,
    (note, when) => played.push({ note, when }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  now = 5;
  played = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("music scheduler", () => {
  it("SCH-01 start schedules the first notes after a short delay, inside the lookahead", () => {
    const scheduler = setup();
    scheduler.start();
    expect(scheduler.running).toBe(true);
    expect(played.length).toBeGreaterThan(0);
    for (const { when } of played) {
      expect(when).toBeGreaterThanOrEqual(5 + START_DELAY_SECONDS);
      expect(when).toBeLessThan(5 + LOOKAHEAD_SECONDS + 1e-9);
    }
  });

  it("SCH-02 each interval schedules only the new window, never a note twice", () => {
    const scheduler = setup();
    scheduler.start();
    for (let step = 0; step < 200; step += 1) {
      now += SCHEDULE_INTERVAL_MS / 1000;
      vi.advanceTimersByTime(SCHEDULE_INTERVAL_MS);
    }
    const times = played.map(
      ({ when, note }) => `${note.voice}@${when.toFixed(6)}`,
    );
    expect(new Set(times).size).toBe(times.length);
    expect(Math.max(...played.map(({ when }) => when))).toBeLessThan(
      now + LOOKAHEAD_SECONDS,
    );
  });

  it("SCH-03 an interval with no new audio time schedules nothing", () => {
    const scheduler = setup();
    scheduler.start();
    const count = played.length;
    vi.advanceTimersByTime(SCHEDULE_INTERVAL_MS * 4);
    expect(played).toHaveLength(count);
  });

  it("SCH-04 the music keeps looping past the loop length", () => {
    const scheduler = setup();
    scheduler.start();
    now += MUSIC_LOOP_SECONDS + 1;
    vi.advanceTimersByTime(SCHEDULE_INTERVAL_MS);
    const last = played[played.length - 1];
    expect(last.note.time).toBeGreaterThan(MUSIC_LOOP_SECONDS);
  });

  it("SCH-05 stop schedules nothing after that moment and start twice is one run", () => {
    const scheduler = setup();
    scheduler.start();
    scheduler.start();
    scheduler.stop();
    scheduler.stop();
    expect(scheduler.running).toBe(false);
    const count = played.length;
    now += 2;
    vi.advanceTimersByTime(1000);
    expect(played).toHaveLength(count);
  });

  it("SCH-06 a restart begins the loop again from its first note", () => {
    const scheduler = setup();
    scheduler.start();
    scheduler.stop();
    played = [];
    now = 40;
    scheduler.start();
    expect(played[0].note.time).toBe(0);
    expect(played[0].when).toBeCloseTo(40 + START_DELAY_SECONDS);
  });
});
