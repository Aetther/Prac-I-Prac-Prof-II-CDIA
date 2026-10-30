import type { OscillatorKind } from "./recipes";

export type MusicVoice = "bass" | "lead";

export interface MusicNote {
  readonly voice: MusicVoice;
  readonly frequency: number;
  /** Seconds from the start of the loop. */
  readonly start: number;
  readonly duration: number;
}

export interface ScheduledMusicNote extends MusicNote {
  /** Seconds on the music timeline, counting every loop since the start. */
  readonly time: number;
}

export const MUSIC_BPM = 112;
export const BEAT_SECONDS = 60 / MUSIC_BPM;
export const MUSIC_BEATS = 32;
export const MUSIC_LOOP_SECONDS = MUSIC_BEATS * BEAT_SECONDS;

export const MUSIC_VOICES: Readonly<
  Record<MusicVoice, { readonly type: OscillatorKind; readonly peak: number }>
> = {
  bass: { type: "triangle", peak: 0.22 },
  lead: { type: "square", peak: 0.08 },
};

/** One bass root per beat over four bars: C C G G | A A F F | C C G G | F F G G. */
const BASS_ROOTS: readonly number[] = [
  36, 36, 43, 43, 45, 45, 41, 41, 36, 36, 43, 43, 41, 41, 43, 43,
];

/** Thirty-two eighth notes on the C major pentatonic; null is a rest. */
const LEAD_STEPS: readonly (number | null)[] = [
  72,
  null,
  76,
  79,
  81,
  79,
  76,
  null,
  74,
  76,
  79,
  null,
  76,
  74,
  72,
  null,
  72,
  76,
  79,
  84,
  81,
  79,
  76,
  74,
  76,
  null,
  74,
  72,
  74,
  null,
  72,
  null,
];

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function buildLoop(): MusicNote[] {
  const notes: MusicNote[] = [];
  for (let beat = 0; beat < MUSIC_BEATS; beat += 1) {
    notes.push({
      voice: "bass",
      frequency: midiToFrequency(BASS_ROOTS[beat % BASS_ROOTS.length]),
      start: beat * BEAT_SECONDS,
      duration: BEAT_SECONDS * 0.9,
    });
  }
  const stepSeconds = BEAT_SECONDS / 2;
  for (let step = 0; step < MUSIC_BEATS * 2; step += 1) {
    const midi = LEAD_STEPS[step % LEAD_STEPS.length];
    if (midi === null) continue;
    notes.push({
      voice: "lead",
      frequency: midiToFrequency(midi),
      start: step * stepSeconds,
      duration: stepSeconds * 0.8,
    });
  }
  return notes.sort((a, b) => a.start - b.start);
}

/** The original background loop: eight bars at 112 BPM. */
export const MUSIC_LOOP: readonly MusicNote[] = buildLoop();

/** Notes whose start falls in [from, to) on the looping music timeline. */
export function notesInWindow(from: number, to: number): ScheduledMusicNote[] {
  if (!(to > from)) return [];
  const result: ScheduledMusicNote[] = [];
  const firstLoop = Math.floor(from / MUSIC_LOOP_SECONDS);
  const lastLoop = Math.floor(to / MUSIC_LOOP_SECONDS);
  for (let loop = firstLoop; loop <= lastLoop; loop += 1) {
    const offset = loop * MUSIC_LOOP_SECONDS;
    for (const note of MUSIC_LOOP) {
      const time = offset + note.start;
      if (time >= from && time < to) result.push({ ...note, time });
    }
  }
  return result;
}
