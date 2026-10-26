import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelCategory } from "../game/category";
import type { CategoryName, Player, PlayerIndex } from "../game/types";
import {
  INITIAL_WHEEL_ROTATION,
  WHEEL_SLICE_ANGLE,
  createSpinPlan,
  rotationAtElapsed,
  sectorIndexAtRotation,
  sectorIndicesCrossed,
} from "../game/wheel";
import type { WheelTickHandler } from "../game/wheel";
import { Scoreboard } from "./Scoreboard";
import { readWheelPalette } from "./wheelPalette";

const CANVAS_SIZE = 320;
const MAX_DEVICE_PIXEL_RATIO = 3;
const LABEL_FONT_SIZE = 12;
const HUB_RADIUS = 24;
const LABEL_INSET = 12;

type WheelStatus = "idle" | "spinning" | "result";

interface WheelProps {
  categories: readonly WheelCategory[];
  players: readonly [Player, Player];
  currentPlayer: PlayerIndex;
  round: number;
  totalRounds: number;
  onChooseCategory: (category: CategoryName) => void;
  onSectorCross?: WheelTickHandler;
}

export function Wheel({
  categories,
  players,
  currentPlayer,
  round,
  totalRounds,
  onChooseCategory,
  onSectorCross,
}: WheelProps) {
  const [status, setStatus] = useState<WheelStatus>("idle");
  const [result, setResult] = useState<WheelCategory | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const devicePixelRatioRef = useRef(1);
  const fontFamilyRef = useRef("");
  const categoriesRef = useRef(categories);
  const paletteRef = useRef<ReturnType<typeof readWheelPalette> | null>(null);
  const rotationRef = useRef(INITIAL_WHEEL_ROTATION);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const spinningRef = useRef(false);

  const drawFrame = useCallback((rotation: number) => {
    const context = contextRef.current;
    const palette = paletteRef.current;
    if (context === null || palette === null) return;

    const ratio = devicePixelRatioRef.current;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const centre = CANVAS_SIZE / 2;
    const radius = CANVAS_SIZE / 2;
    context.save();
    context.translate(centre, centre);

    categoriesRef.current.forEach((category, index) => {
      const start = rotation + index * WHEEL_SLICE_ANGLE - Math.PI / 2;
      const end = start + WHEEL_SLICE_ANGLE;

      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, start, end);
      context.closePath();
      context.fillStyle = palette.sector[category.name];
      context.fill();
      context.strokeStyle = palette.stroke;
      context.stroke();

      context.save();
      context.rotate(
        rotation + (index + 0.5) * WHEEL_SLICE_ANGLE - Math.PI / 2,
      );
      context.fillStyle = palette.label;
      context.font = `${LABEL_FONT_SIZE}px ${fontFamilyRef.current}`;
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(category.label, radius - LABEL_INSET, 0);
      context.restore();
    });

    context.beginPath();
    context.arc(0, 0, HUB_RADIUS, 0, Math.PI * 2);
    context.fillStyle = palette.hub;
    context.fill();
    context.strokeStyle = palette.stroke;
    context.stroke();

    context.beginPath();
    context.moveTo(0, -radius);
    context.lineTo(-10, -radius + 18);
    context.lineTo(10, -radius + 18);
    context.closePath();
    context.fillStyle = palette.pointer;
    context.fill();

    context.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const ratio = Math.min(
      window.devicePixelRatio || 1,
      MAX_DEVICE_PIXEL_RATIO,
    );
    devicePixelRatioRef.current = ratio;
    canvas.width = CANVAS_SIZE * ratio;
    canvas.height = CANVAS_SIZE * ratio;
    contextRef.current = canvas.getContext("2d");

    const style = getComputedStyle(document.documentElement);
    paletteRef.current = readWheelPalette(style);
    fontFamilyRef.current = style.getPropertyValue("--font-family-sans").trim();
  }, []);

  useEffect(() => {
    categoriesRef.current = categories;
    drawFrame(rotationRef.current);
  }, [categories, drawFrame]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const handleSpin = () => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setStatus("spinning");
    setResult(null);

    const plan = createSpinPlan(rotationRef.current);
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const rotation = rotationAtElapsed(plan, elapsed);
      const crossed = sectorIndicesCrossed(rotationRef.current, rotation);
      rotationRef.current = rotation;
      drawFrame(rotation);
      for (const sectorIndex of crossed) {
        onSectorCross?.({
          sectorIndex,
          category: categoriesRef.current[sectorIndex].name,
        });
      }

      if (elapsed >= plan.durationMs) {
        frameRef.current = null;
        spinningRef.current = false;
        const sectorIndex = sectorIndexAtRotation(rotation);
        setResult(categoriesRef.current[sectorIndex] ?? null);
        setStatus("result");
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  };

  const categoryList = categories.map((category) => category.label).join(", ");

  return (
    <section className="wheel">
      <h2>Girá la ruleta</h2>
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        round={round}
        totalRounds={totalRounds}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="wheel-canvas"
        role="img"
        aria-label="Ruleta de categorías"
        aria-describedby="wheel-category-list"
      />
      <p id="wheel-category-list" className="visually-hidden">
        {`${categoryList}.`}
      </p>
      {status === "spinning" ? <p>Girando...</p> : null}
      {status !== "result" ? (
        <button
          type="button"
          className="touch-target"
          disabled={status === "spinning"}
          onClick={handleSpin}
        >
          Girar
        </button>
      ) : null}
      {status === "result" && result !== null ? (
        <>
          <p role="status">{`Salió: ${result.label}`}</p>
          <button
            type="button"
            className="touch-target"
            onClick={() => onChooseCategory(result.name)}
          >
            Continuar
          </button>
        </>
      ) : null}
    </section>
  );
}
