import { useState } from "react";
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

interface LobbyProps {
  onStart: (input: LobbyInput) => void;
}

export function Lobby({ onStart }: LobbyProps) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [lang, setLang] = useState<Lang>(DEFAULT_LOBBY_SETTINGS.lang);
  const [seconds, setSeconds] = useState<SecondsPerQuestion>(
    DEFAULT_LOBBY_SETTINGS.secondsPerQuestion,
  );
  const [rounds, setRounds] = useState<RoundsCount>(
    DEFAULT_LOBBY_SETTINGS.rounds,
  );
  const [mode, setMode] = useState<GameMode>(DEFAULT_LOBBY_SETTINGS.mode);

  const canStart = isValidPlayerName(first) && isValidPlayerName(second);

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

  return (
    <main className="lobby">
      <h1>Trivia IA</h1>
      <div className="lobby-field">
        <label htmlFor="lobby-player-1">Jugador 1</label>
        <input
          id="lobby-player-1"
          className="touch-target"
          type="text"
          value={first}
          onChange={(event) => setFirst(event.target.value)}
        />
      </div>
      <div className="lobby-field">
        <label htmlFor="lobby-player-2">Jugador 2</label>
        <input
          id="lobby-player-2"
          className="touch-target"
          type="text"
          value={second}
          onChange={(event) => setSecond(event.target.value)}
        />
      </div>
      <div className="lobby-field">
        <label htmlFor="lobby-lang">Idioma de las preguntas</label>
        <select
          id="lobby-lang"
          className="touch-target"
          value={lang}
          onChange={(event) => setLang(event.target.value as Lang)}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="lobby-field">
        <label htmlFor="lobby-seconds">Tiempo por pregunta</label>
        <select
          id="lobby-seconds"
          className="touch-target"
          value={String(seconds)}
          onChange={(event) =>
            setSeconds(Number(event.target.value) as SecondsPerQuestion)
          }
        >
          <option value="10">10 segundos</option>
          <option value="20">20 segundos</option>
          <option value="30">30 segundos</option>
        </select>
      </div>
      <div className="lobby-field">
        <label htmlFor="lobby-mode">Modo de juego</label>
        <select
          id="lobby-mode"
          className="touch-target"
          value={mode}
          onChange={(event) => setMode(event.target.value as GameMode)}
        >
          <option value="rounds">Por rondas</option>
          <option value="six-categories">Juntar las 6 categorías</option>
        </select>
      </div>
      {mode === "rounds" ? (
        <div className="lobby-field">
          <label htmlFor="lobby-rounds">Rondas</label>
          <select
            id="lobby-rounds"
            className="touch-target"
            value={String(rounds)}
            onChange={(event) =>
              setRounds(Number(event.target.value) as RoundsCount)
            }
          >
            <option value="3">3 rondas</option>
            <option value="5">5 rondas</option>
            <option value="10">10 rondas</option>
          </select>
        </div>
      ) : null}
      <button
        type="button"
        className="touch-target"
        disabled={!canStart}
        onClick={handleStart}
      >
        Comenzar
      </button>
    </main>
  );
}
