import { useState } from "react";
import { CATEGORY_NAMES } from "../game/category";
import {
  DEFAULT_LOBBY_SETTINGS,
  isValidPlayerName,
  type LobbyInput,
} from "../game/lobby";
import type {
  GameMode,
  Lang,
  RoundsCount,
  SecondsPerQuestion,
} from "../game/types";
import { useMessages } from "../i18n";
import { CATEGORY_COLOR_TOKENS } from "./CategoryChips";
import { ChoiceGroup } from "./ChoiceGroup";
import type { ChoiceOption } from "./ChoiceGroup";
import { FlagIcon } from "./FlagIcon";

interface LobbyProps {
  onStart: (input: LobbyInput) => void;
  /** The language the Lobby opens with; Spanish when omitted. */
  language?: Lang;
  onLanguageChange?: (language: Lang) => void;
}

const SECONDS_BY_DIFFICULTY: readonly SecondsPerQuestion[] = [30, 20, 10];
const ROUND_COUNTS: readonly RoundsCount[] = [3, 5, 10];
const LANGUAGE_NAMES: Readonly<Record<Lang, string>> = {
  es: "Español",
  en: "English",
};

export function Lobby({ onStart, language, onLanguageChange }: LobbyProps) {
  const m = useMessages();
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [lang, setLang] = useState<Lang>(
    language ?? DEFAULT_LOBBY_SETTINGS.lang,
  );
  const [seconds, setSeconds] = useState<SecondsPerQuestion>(
    DEFAULT_LOBBY_SETTINGS.secondsPerQuestion,
  );
  const [rounds, setRounds] = useState<RoundsCount>(
    DEFAULT_LOBBY_SETTINGS.rounds,
  );
  const [mode, setMode] = useState<GameMode>(DEFAULT_LOBBY_SETTINGS.mode);

  const canStart = isValidPlayerName(first) && isValidPlayerName(second);

  const handleLanguage = (next: Lang) => {
    setLang(next);
    onLanguageChange?.(next);
  };

  const handleStart = () => {
    if (!canStart) return;
    if (mode === "six-categories") {
      onStart({
        playerNames: [first, second],
        lang,
        secondsPerQuestion: seconds,
        mode: "six-categories",
      });
      return;
    }
    onStart({
      playerNames: [first, second],
      lang,
      secondsPerQuestion: seconds,
      mode: "rounds",
      rounds,
    });
  };

  const languageOptions: ChoiceOption<Lang>[] = (["es", "en"] as const).map(
    (value) => ({
      value,
      name: LANGUAGE_NAMES[value],
      content: (
        <>
          <FlagIcon language={value} />
          <span className="choice-title">{LANGUAGE_NAMES[value]}</span>
        </>
      ),
    }),
  );

  const difficultyNames = [
    m.difficultyEasy,
    m.difficultyMedium,
    m.difficultyHard,
  ];
  const difficultyOptions: ChoiceOption<string>[] = SECONDS_BY_DIFFICULTY.map(
    (value, index) => ({
      value: String(value),
      name: difficultyNames[index],
      description: m.secondsOption(value),
      content: <span className="choice-title">{difficultyNames[index]}</span>,
    }),
  );

  const modeOptions: ChoiceOption<GameMode>[] = [
    {
      value: "rounds",
      name: m.modeRounds,
      description: m.modeRoundsHint,
      content: (
        <>
          <span className="mode-icon" aria-hidden="true">
            🏁
          </span>
          <span className="choice-title">{m.modeRounds}</span>
        </>
      ),
    },
    {
      value: "six-categories",
      name: m.modeSix,
      description: m.modeSixHint,
      content: (
        <>
          <span className="mode-icon" aria-hidden="true">
            🎯
          </span>
          <span className="choice-title">{m.modeSix}</span>
          <span className="mode-dots" aria-hidden="true">
            {CATEGORY_NAMES.map((name) => (
              <span
                key={name}
                className="mode-dot"
                data-category={name}
                style={{ backgroundColor: CATEGORY_COLOR_TOKENS[name] }}
              />
            ))}
          </span>
        </>
      ),
    },
  ];

  const roundOptions: ChoiceOption<string>[] = ROUND_COUNTS.map((value) => ({
    value: String(value),
    name: m.roundsOption(value),
    content: (
      <span className="round-token" data-rounds={value} aria-hidden="true">
        {value}
      </span>
    ),
  }));

  return (
    <main className="lobby">
      <h1 className="lobby-sign">
        <span className="lobby-sign-sparkle" aria-hidden="true">
          ✨
        </span>
        <span>TRIVIA</span>
        <span className="lobby-sign-sparkle" aria-hidden="true">
          ✨
        </span>
      </h1>
      <p className="lobby-tagline">{m.tagline}</p>
      <div className="lobby-mini-wheel" aria-hidden="true" />
      <div className="lobby-fields">
        <div className="lobby-field">
          <label htmlFor="lobby-player-1">{m.player1}</label>
          <input
            id="lobby-player-1"
            className="touch-target"
            type="text"
            value={first}
            onChange={(event) => setFirst(event.target.value)}
          />
        </div>
        <div className="lobby-field">
          <label htmlFor="lobby-player-2">{m.player2}</label>
          <input
            id="lobby-player-2"
            className="touch-target"
            type="text"
            value={second}
            onChange={(event) => setSecond(event.target.value)}
          />
        </div>
        <ChoiceGroup
          legend={m.languageGroup}
          className="choice-group-language"
          value={lang}
          options={languageOptions}
          onChange={handleLanguage}
        />
        <ChoiceGroup
          legend={m.difficultyGroup}
          className="choice-group-difficulty"
          value={String(seconds)}
          options={difficultyOptions}
          onChange={(value) => setSeconds(Number(value) as SecondsPerQuestion)}
        />
        <ChoiceGroup
          legend={m.modeGroup}
          className="choice-group-mode"
          value={mode}
          options={modeOptions}
          onChange={setMode}
        />
        {mode === "rounds" ? (
          <ChoiceGroup
            legend={m.roundsLabel}
            groupName={m.roundsGroup}
            className="choice-group-rounds"
            value={String(rounds)}
            options={roundOptions}
            onChange={(value) => setRounds(Number(value) as RoundsCount)}
          />
        ) : null}
        <button
          type="button"
          className="button-primary touch-target"
          disabled={!canStart}
          onClick={handleStart}
        >
          {m.play}
        </button>
      </div>
    </main>
  );
}
