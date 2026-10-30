// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BEAT_SECONDS,
  MUSIC_BEATS,
  MUSIC_LOOP,
  MUSIC_LOOP_SECONDS,
  MUSIC_VOICES,
  midiToFrequency,
  notesInWindow,
} from "./music";

describe("music loop", () => {
  it("MUS-01 the loop is eight bars of four beats at 112 BPM", () => {
    expect(MUSIC_BEATS).toBe(32);
    expect(BEAT_SECONDS).toBeCloseTo(60 / 112);
    expect(MUSIC_LOOP_SECONDS).toBeCloseTo(32 * (60 / 112));
  });

  it("MUS-02 midiToFrequency maps A4 to 440 Hz and an octave to a doubling", () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880);
    expect(midiToFrequency(36)).toBeCloseTo(65.41, 1);
  });

  it("MUS-03 the bass plays one note per beat and the lead rests on some steps", () => {
    const bass = MUSIC_LOOP.filter((note) => note.voice === "bass");
    const lead = MUSIC_LOOP.filter((note) => note.voice === "lead");
    expect(bass).toHaveLength(32);
    expect(lead.length).toBeGreaterThan(0);
    expect(lead.length).toBeLessThan(64);
  });

  it("MUS-04 every note starts and ends inside the loop, sorted by start", () => {
    let previous = -1;
    for (const note of MUSIC_LOOP) {
      expect(note.start).toBeGreaterThanOrEqual(previous);
      expect(note.start + note.duration).toBeLessThanOrEqual(
        MUSIC_LOOP_SECONDS + 1e-9,
      );
      previous = note.start;
    }
  });

  it("MUS-05 the lead is quieter than the bass and both are below the effects", () => {
    expect(MUSIC_VOICES.lead.peak).toBeLessThan(MUSIC_VOICES.bass.peak);
    expect(MUSIC_VOICES.bass.peak).toBeLessThanOrEqual(0.25);
  });

  it("MUS-06 a window returns the notes starting inside it, end excluded", () => {
    const window = notesInWindow(0, BEAT_SECONDS);
    expect(window.length).toBeGreaterThan(0);
    for (const note of window) {
      expect(note.time).toBeGreaterThanOrEqual(0);
      expect(note.time).toBeLessThan(BEAT_SECONDS);
    }
    expect(window.filter((note) => note.voice === "bass")).toHaveLength(1);
  });

  it("MUS-07 a window that crosses the loop end wraps to the start", () => {
    const from = MUSIC_LOOP_SECONDS - BEAT_SECONDS / 4;
    const to = MUSIC_LOOP_SECONDS + BEAT_SECONDS / 4;
    const notes = notesInWindow(from, to);
    const bassTimes = notes
      .filter((note) => note.voice === "bass")
      .map((note) => note.time);
    expect(bassTimes).toEqual([MUSIC_LOOP_SECONDS]);
  });

  it("MUS-08 a later loop repeats the first one shifted by the loop length", () => {
    const first = notesInWindow(0, MUSIC_LOOP_SECONDS);
    const third = notesInWindow(2 * MUSIC_LOOP_SECONDS, 3 * MUSIC_LOOP_SECONDS);
    expect(third).toHaveLength(first.length);
    expect(first).toHaveLength(MUSIC_LOOP.length);
    third.forEach((note, index) => {
      expect(note.time).toBeCloseTo(first[index].time + 2 * MUSIC_LOOP_SECONDS);
      expect(note.frequency).toBe(first[index].frequency);
    });
  });

  it("MUS-09 an empty or reversed window returns no notes", () => {
    expect(notesInWindow(1, 1)).toEqual([]);
    expect(notesInWindow(2, 1)).toEqual([]);
  });
});
