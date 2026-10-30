import { useEffect, useRef, useState } from "react";
import {
  TIMER_TICK_MS,
  getTimerSnapshot,
  urgentSecondToAnnounce,
} from "../game/timer";
import type { TimerSnapshot } from "../game/timer";

interface TimerProps {
  seconds: number;
  onExpire: () => void;
  onUrgentSecond?: (seconds: number) => void;
}

export function Timer({ seconds, onExpire, onUrgentSecond }: TimerProps) {
  const deadlineRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onUrgentSecondRef = useRef(onUrgentSecond);
  const lastSecondRef = useRef(seconds);
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() =>
    getTimerSnapshot(seconds, seconds * 1000, 0),
  );

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onUrgentSecondRef.current = onUrgentSecond;
  }, [onUrgentSecond]);

  useEffect(() => {
    if (expiredRef.current) return;
    if (deadlineRef.current === null) {
      deadlineRef.current = Date.now() + seconds * 1000;
    }
    const deadline = deadlineRef.current;
    setSnapshot(getTimerSnapshot(seconds, deadline, Date.now()));

    const intervalId = setInterval(() => {
      const next = getTimerSnapshot(seconds, deadline, Date.now());
      setSnapshot(next);
      const announce = urgentSecondToAnnounce(
        lastSecondRef.current,
        next.remainingSeconds,
      );
      lastSecondRef.current = next.remainingSeconds;
      if (announce !== null) onUrgentSecondRef.current?.(announce);
      if (next.remainingMs > 0) return;
      expiredRef.current = true;
      clearInterval(intervalId);
      onExpireRef.current();
    }, TIMER_TICK_MS);
    return () => clearInterval(intervalId);
  }, [seconds]);

  const { remainingSeconds, urgent, progress } = snapshot;

  return (
    <div
      className={urgent ? "timer timer-urgent" : "timer"}
      data-urgent={urgent ? "true" : undefined}
    >
      <p role="timer" aria-label="Tiempo restante">{`${remainingSeconds} s`}</p>
      <div
        className="timer-track"
        role="progressbar"
        aria-label="Tiempo restante"
        aria-valuemin={0}
        aria-valuemax={seconds}
        aria-valuenow={remainingSeconds}
      >
        <div className="timer-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {urgent ? <p className="timer-urgent-text">Últimos 5 segundos</p> : null}
    </div>
  );
}
