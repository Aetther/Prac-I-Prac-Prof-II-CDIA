import type { Lang } from "../game/types";

/**
 * Original, simplified flags drawn for this game: Spain as red-yellow-red
 * bands, the United States as stripes with a canton of dots. Decorative only.
 */
export function FlagIcon({ language }: { language: Lang }) {
  if (language === "es") {
    return (
      <svg
        className="flag-icon"
        viewBox="0 0 30 20"
        aria-hidden="true"
        focusable="false"
        data-flag="es"
      >
        <rect className="flag-red" x="0" y="0" width="30" height="5" />
        <rect className="flag-yellow" x="0" y="5" width="30" height="10" />
        <rect className="flag-red" x="0" y="15" width="30" height="5" />
      </svg>
    );
  }
  const stripes = [0, 1, 2, 3, 4, 5, 6];
  const stripeHeight = 20 / stripes.length;
  const dots = [
    [3, 2.5],
    [8, 2.5],
    [13, 2.5],
    [3, 7],
    [8, 7],
    [13, 7],
  ];
  return (
    <svg
      className="flag-icon"
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      data-flag="en"
    >
      {stripes.map((stripe) => (
        <rect
          key={stripe}
          className={stripe % 2 === 0 ? "flag-red" : "flag-white"}
          x="0"
          y={stripe * stripeHeight}
          width="30"
          height={stripeHeight}
        />
      ))}
      <rect
        className="flag-blue"
        x="0"
        y="0"
        width="16"
        height={stripeHeight * 4}
      />
      {dots.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          className="flag-white"
          cx={cx}
          cy={cy}
          r="1.1"
        />
      ))}
    </svg>
  );
}
