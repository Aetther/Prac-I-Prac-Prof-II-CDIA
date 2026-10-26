import { vi } from "vitest";
import { FRAME_TIMESTAMPS } from "./wheelFixtures";

export interface RafQueue {
  frames: FrameRequestCallback[];
  pending: () => number;
  lastScheduledId: () => number;
  runFrame: (timestamp: number) => void;
  drive: (timestamps?: readonly number[]) => void;
}

export function installRafQueue(): RafQueue {
  const frames: FrameRequestCallback[] = [];
  let nextId = 1;

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return nextId++;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  const runFrame = (timestamp: number): void => {
    const frame = frames.shift();
    if (frame === undefined) {
      throw new Error("no animation frame is queued");
    }
    frame(timestamp);
  };

  return {
    frames,
    pending: () => frames.length,
    lastScheduledId: () => nextId - 1,
    runFrame,
    drive: (timestamps: readonly number[] = FRAME_TIMESTAMPS) => {
      for (const timestamp of timestamps) {
        runFrame(timestamp);
      }
    },
  };
}
