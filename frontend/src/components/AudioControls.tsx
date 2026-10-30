import { useId } from "react";
import type { SoundControls } from "../audio";
import { useMessages } from "../i18n";

export type AudioControlsSound = Pick<
  SoundControls,
  "preferences" | "setMuted" | "setVolume" | "setEffects" | "setMusic"
>;

interface AudioControlsProps {
  sound: AudioControlsSound;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      className="audio-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

export function AudioControls({ sound }: AudioControlsProps) {
  const volumeId = useId();
  const m = useMessages();
  const { preferences } = sound;

  return (
    <section aria-label={m.sound} className="audio-controls">
      <button
        type="button"
        className="touch-target button-secondary audio-mute"
        onClick={() => sound.setMuted(!preferences.muted)}
      >
        <SpeakerIcon muted={preferences.muted} />
        <span>{preferences.muted ? m.soundOn : m.soundOff}</span>
      </button>
      <div className="audio-volume">
        <label htmlFor={volumeId}>{m.volume}</label>
        <input
          id={volumeId}
          type="range"
          className="touch-target"
          min={0}
          max={100}
          step={5}
          value={preferences.volume}
          onChange={(event) =>
            sound.setVolume(Number(event.currentTarget.value))
          }
        />
      </div>
      <button
        type="button"
        className="touch-target button-secondary audio-toggle"
        aria-pressed={preferences.effects}
        onClick={() => sound.setEffects(!preferences.effects)}
      >
        {m.effects}
      </button>
      <button
        type="button"
        className="touch-target button-secondary audio-toggle"
        aria-pressed={preferences.music}
        onClick={() => sound.setMusic(!preferences.music)}
      >
        {m.music}
      </button>
    </section>
  );
}
