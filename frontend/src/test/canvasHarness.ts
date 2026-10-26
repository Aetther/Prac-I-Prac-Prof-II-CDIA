import { vi } from "vitest";

export interface RecordedArc {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly start: number;
  readonly end: number;
}

export interface RecordedText {
  readonly text: string;
  readonly style: string;
  readonly font: string;
}

export interface RecordedPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasHarness {
  readonly ctx: CanvasRenderingContext2D;
  readonly fillsAtFill: string[];
  readonly strokesAtStroke: string[];
  readonly texts: RecordedText[];
  readonly arcs: RecordedArc[];
  readonly moves: RecordedPoint[];
  readonly lines: RecordedPoint[];
  readonly transforms: number[][];
  readonly setTransform: ReturnType<typeof vi.fn>;
  readonly scale: ReturnType<typeof vi.fn>;
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly translate: ReturnType<typeof vi.fn>;
}

export function installCanvasHarness(): CanvasHarness {
  const fillsAtFill: string[] = [];
  const strokesAtStroke: string[] = [];
  const texts: RecordedText[] = [];
  const arcs: RecordedArc[] = [];
  const moves: RecordedPoint[] = [];
  const lines: RecordedPoint[] = [];
  const transforms: number[][] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let font = "";

  const setTransform = vi.fn(
    (a: number, b: number, c: number, d: number, e: number, f: number) => {
      transforms.push([a, b, c, d, e, f]);
    },
  );
  const scale = vi.fn();
  const clearRect = vi.fn();
  const translate = vi.fn();

  const ctx = {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      moves.push({ x, y });
    }),
    lineTo: vi.fn((x: number, y: number) => {
      lines.push({ x, y });
    }),
    arc: vi.fn(
      (x: number, y: number, r: number, start: number, end: number) => {
        arcs.push({ x, y, r, start, end });
      },
    ),
    fill: vi.fn(() => {
      fillsAtFill.push(fillStyle);
    }),
    stroke: vi.fn(() => {
      strokesAtStroke.push(strokeStyle);
    }),
    save: vi.fn(),
    restore: vi.fn(),
    translate,
    rotate: vi.fn(),
    clearRect,
    fillText: vi.fn((text: string) => {
      texts.push({ text, style: fillStyle, font });
    }),
    setTransform,
    scale,
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
    },
    get font() {
      return font;
    },
    set font(value: string) {
      font = value;
    },
  };

  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  getContext.mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    fillsAtFill,
    strokesAtStroke,
    texts,
    arcs,
    moves,
    lines,
    transforms,
    setTransform,
    scale,
    clearRect,
    translate,
  };
}
