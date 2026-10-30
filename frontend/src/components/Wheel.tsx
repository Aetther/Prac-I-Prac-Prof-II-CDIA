import { useCallback, useEffect, useRef, useState } from "react";
import { findCategoryEmoji, type WheelCategory } from "../game/category";
import type { MatchProgress } from "../game/progress";
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
import { playerColorIndex } from "./playerIdentity";
import { Scoreboard } from "./Scoreboard";
import { readWheelPalette } from "./wheelPalette";
import { useMessages } from "../i18n";

const CANVAS_SIZE = 320;
const MAX_DEVICE_PIXEL_RATIO = 3;
const LABEL_FONT_SIZE = 12;
const LABEL_INSET = 12;
const RIM_THICKNESS = 6;
const POINTER_HEIGHT = 26;
const POINTER_BASE_MARGIN = 2;
const POINTER_TIP_INSET = 10;
const POINTER_HALF_WIDTH = 16;
const POINTER_BASE_Y = -(CANVAS_SIZE / 2 - POINTER_BASE_MARGIN);
const POINTER_TIP_Y = POINTER_BASE_Y + POINTER_HEIGHT;
const SECTOR_RADIUS =
  CANVAS_SIZE / 2 - POINTER_BASE_MARGIN - POINTER_HEIGHT + POINTER_TIP_INSET;
const RIM_RADIUS = SECTOR_RADIUS + RIM_THICKNESS;

type WheelStatus = "idle" | "spinning" | "result";

interface WheelProps {
  categories: readonly WheelCategory[];
  players: readonly [Player, Player];
  currentPlayer: PlayerIndex;
  progress: MatchProgress;
  onChooseCategory: (category: CategoryName) => void;
  onSectorCross?: WheelTickHandler;
  onSpinStop?: () => void;
}

export function Wheel({
  categories,
  players,
  currentPlayer,
  progress,
  onChooseCategory,
  onSectorCross,
  onSpinStop,
}: WheelProps) {
  const m = useMessages();
  const [status, setStatus] = useState<WheelStatus>("idle");
  const [result, setResult] = useState<WheelCategory | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const devicePixelRatioRef = useRef(1);
  const fontFamilyRef = useRef("");
  const rimColorRef = useRef("");
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
    context.save();
    context.translate(centre, centre);

    context.beginPath();
    context.arc(0, 0, RIM_RADIUS, 0, Math.PI * 2);
    context.fillStyle = rimColorRef.current;
    context.fill();

    categoriesRef.current.forEach((category, index) => {
      const start = rotation + index * WHEEL_SLICE_ANGLE - Math.PI / 2;
      const end = start + WHEEL_SLICE_ANGLE;

      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, SECTOR_RADIUS, start, end);
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
      context.fillText(category.label, SECTOR_RADIUS - LABEL_INSET, 0);
      const labelWidth = context.measureText(category.label).width;
      const labelLeft = SECTOR_RADIUS - LABEL_INSET - labelWidth;
      context.textAlign = "right";
      context.fillText(
        findCategoryEmoji(category.name),
        labelLeft - LABEL_INSET,
        0,
      );
      context.restore();
    });

    context.beginPath();
    context.moveTo(0, POINTER_TIP_Y);
    context.lineTo(-POINTER_HALF_WIDTH, POINTER_BASE_Y);
    context.lineTo(POINTER_HALF_WIDTH, POINTER_BASE_Y);
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
    rimColorRef.current = style.getPropertyValue("--color-wheel-rim").trim();
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

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const plan = createSpinPlan(rotationRef.current, Math.random, {
      reducedMotion,
    });
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
        onSpinStop?.();
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  };

  const categoryList = categories.map((category) => category.label).join(", ");

  return (
    <section className="wheel game-layout">
      <Scoreboard
        players={players}
        currentPlayer={currentPlayer}
        progress={progress}
        categories={categories}
      />
      <div className="game-main">
        <p className="wheel-turn" data-player={playerColorIndex(currentPlayer)}>
          {m.turnOf(players[currentPlayer].name)}
        </p>
        <h2>{m.spinHeading}</h2>
        <div className="wheel-stage">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="wheel-canvas"
            role="img"
            aria-label={m.wheelName}
            aria-describedby="wheel-category-list"
          />
          {status !== "result" ? (
            <button
              type="button"
              className="wheel-spin button-primary touch-target"
              disabled={status === "spinning"}
              onClick={handleSpin}
            >
              {m.spin}
            </button>
          ) : null}
        </div>
        <p id="wheel-category-list" className="visually-hidden">
          {`${categoryList}.`}
        </p>
        {status === "spinning" ? (
          <p className="wheel-status">{m.spinning}</p>
        ) : null}
        {status === "result" && result !== null ? (
          <>
            <p
              className="wheel-status wheel-status-result wheel-result"
              role="status"
              data-category={result.name}
            >
              <span aria-hidden="true">{findCategoryEmoji(result.name)}</span>
              <span>{m.wheelResult(result.label)}</span>
            </p>
            <button
              type="button"
              className="wheel-continue button-primary touch-target"
              onClick={() => onChooseCategory(result.name)}
            >
              {m.continueAction}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
