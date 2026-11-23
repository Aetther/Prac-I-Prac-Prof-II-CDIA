import { useEffect, useState } from "react";
import { WAVE_DURATION, WAVE_REST_TIME } from "./flagWave";

/**
 * Decorative motion runs only when the browser confirms the visitor has no
 * reduced-motion preference; without that answer the flag stays still.
 */
export function motionAllowed(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const free = window.matchMedia("(prefers-reduced-motion: no-preference)");
  return free?.matches === true && calm?.matches === false;
}

/**
 * The wave time for a Lobby flag. While the flag's option is selected it
 * waves for a few cycles after the selection and then rests; otherwise, and
 * whenever motion is not allowed, it keeps the rest pose.
 */
export function useFlagWave(active: boolean): number {
  const [time, setTime] = useState(WAVE_REST_TIME);

  useEffect(() => {
    if (!active || !motionAllowed()) return;
    if (typeof requestAnimationFrame !== "function") return;
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = (now - start) / 1000;
      if (elapsed >= WAVE_DURATION) {
        setTime(WAVE_REST_TIME);
        return;
      }
      setTime(WAVE_REST_TIME + elapsed);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setTime(WAVE_REST_TIME);
    };
  }, [active]);

  return active ? time : WAVE_REST_TIME;
}
