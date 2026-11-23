import { useId } from "react";
import { fillToken, stopToken, strokeToken } from "./svgPaint";

const PEARLS = [
  [4, 9, 3.2],
  [19, 12.5, 2.8],
  [32, 3, 3.6],
  [45, 12.5, 2.8],
  [60, 9, 3.2],
] as const;

/** The five gold spikes: two shaded faces each, then their outline. */
const SPIKES = [
  {
    light: "M8.00 30.00L4 9L12.00 32.24Z",
    lightPaint: "lite",
    dark: "M12.00 32.24L4 9L16.00 34.47Z",
    darkPaint: "mid",
    edge: "M8.00 30.00L4 9L16.00 34.47",
  },
  {
    light: "M16.00 34.47L19 12.5L21.00 35.14Z",
    lightPaint: "lite",
    dark: "M21.00 35.14L19 12.5L26.00 35.81Z",
    darkPaint: "mid",
    edge: "M16.00 34.47L19 12.5L26.00 35.81",
  },
  {
    light: "M24.50 35.70L32 3L32.00 35.70Z",
    lightPaint: "lite",
    dark: "M32.00 35.70L32 3L39.50 35.70Z",
    darkPaint: "mid",
    edge: "M24.50 35.70L32 3L39.50 35.70",
  },
  {
    light: "M38.00 35.81L45 12.5L43.00 35.14Z",
    lightPaint: "mid",
    dark: "M43.00 35.14L45 12.5L48.00 34.47Z",
    darkPaint: "dark",
    edge: "M38.00 35.81L45 12.5L48.00 34.47",
  },
  {
    light: "M48.00 34.47L60 9L52.00 32.24Z",
    lightPaint: "mid",
    dark: "M52.00 32.24L60 9L56.00 30.00Z",
    darkPaint: "dark",
    edge: "M48.00 34.47L60 9L56.00 30.00",
  },
] as const;

const BAND = "M8 30A24 6 0 0 0 56 30L54 46A22 5.5 0 0 1 10 46Z";
const BACK_SPIKES = ["M15 26 21 8.5 27 24.5Z", "M37 24.5 43 8.5 49 26Z"];

/**
 * The jewelled crown of the six-categories mode. When the mode is selected
 * it hops once, a light beam sweeps across it and two sparks twinkle; the
 * motion is CSS only and stops under reduced motion. Decorative.
 */
export function ModeCrownIcon() {
  const raw = useId();
  const id = (name: string) => `${raw}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      className="mode-crown"
      viewBox="0 0 64 58"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id("lite")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stopToken("crown-gold-100")} />
          <stop offset="0.5" style={stopToken("crown-gold-300")} />
          <stop offset="1" style={stopToken("crown-gold-500")} />
        </linearGradient>
        <linearGradient id={id("mid")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stopToken("crown-gold-300")} />
          <stop offset="0.6" style={stopToken("crown-gold-500")} />
          <stop offset="1" style={stopToken("crown-gold-600")} />
        </linearGradient>
        <linearGradient id={id("dark")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stopToken("crown-gold-500")} />
          <stop offset="1" style={stopToken("crown-gold-700")} />
        </linearGradient>
        <linearGradient id={id("back")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stopToken("crown-gold-600")} />
          <stop offset="1" style={stopToken("crown-gold-800")} />
        </linearGradient>
        <linearGradient id={id("band")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={stopToken("crown-gold-700")} />
          <stop offset="0.22" style={stopToken("crown-gold-400")} />
          <stop offset="0.38" style={stopToken("crown-gold-200")} />
          <stop offset="0.55" style={stopToken("crown-gold-400")} />
          <stop offset="0.85" style={stopToken("crown-gold-600")} />
          <stop offset="1" style={stopToken("crown-gold-800")} />
        </linearGradient>
        <radialGradient id={id("velvet")} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" style={stopToken("crown-velvet-light")} />
          <stop offset="0.6" style={stopToken("crown-velvet")} />
          <stop offset="1" style={stopToken("crown-velvet-deep")} />
        </radialGradient>
        <radialGradient id={id("pearl")} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" style={stopToken("crown-pearl-light")} />
          <stop offset="0.55" style={stopToken("crown-pearl")} />
          <stop offset="1" style={stopToken("crown-pearl-deep")} />
        </radialGradient>
        <radialGradient id={id("ruby")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" style={stopToken("crown-ruby-light")} />
          <stop offset="0.45" style={stopToken("crown-ruby")} />
          <stop offset="1" style={stopToken("crown-ruby-deep")} />
        </radialGradient>
        <radialGradient id={id("sapphire")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" style={stopToken("crown-sapphire-light")} />
          <stop offset="0.45" style={stopToken("crown-sapphire")} />
          <stop offset="1" style={stopToken("crown-sapphire-deep")} />
        </radialGradient>
        <radialGradient id={id("emerald")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" style={stopToken("crown-emerald-light")} />
          <stop offset="0.5" style={stopToken("crown-emerald")} />
          <stop offset="1" style={stopToken("crown-emerald-deep")} />
        </radialGradient>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={stopToken("sparkle", 0)} />
          <stop offset="0.5" style={stopToken("sparkle", 0.95)} />
          <stop offset="1" style={stopToken("sparkle", 0)} />
        </linearGradient>
        <clipPath id={id("clip")}>
          {SPIKES.map((spike) => (
            <path key={spike.edge} d={`${spike.edge}Z`} />
          ))}
          <path d={BAND} />
          {PEARLS.map(([cx, cy, r]) => (
            <circle key={cx} cx={cx} cy={cy} r={r} />
          ))}
          <path d={BACK_SPIKES.join("")} />
        </clipPath>
      </defs>
      <ellipse
        className="crown-shadow"
        cx="32"
        cy="53"
        rx="22"
        ry="3.4"
        style={fillToken("crown-shadow")}
        opacity="0.38"
      />
      <g className="crown-body">
        {BACK_SPIKES.map((d) => (
          <path
            key={d}
            d={d}
            fill={url("back")}
            style={strokeToken("crown-gold-900")}
            strokeWidth="0.6"
          />
        ))}
        <circle cx="21" cy="8" r="2.3" fill={url("pearl")} opacity="0.85" />
        <circle cx="43" cy="8" r="2.3" fill={url("pearl")} opacity="0.85" />
        <ellipse cx="32" cy="29.6" rx="23.4" ry="5.6" fill={url("velvet")} />
        <ellipse
          cx="32"
          cy="27.8"
          rx="16"
          ry="2.6"
          style={fillToken("crown-ruby-light")}
          opacity="0.25"
        />
        <path
          d={BAND}
          fill={url("band")}
          style={strokeToken("crown-gold-800")}
          strokeWidth="0.8"
        />
        <path
          d="M8.6 31.6A24 6 0 0 0 55.4 31.6"
          fill="none"
          style={strokeToken("knob-light")}
          strokeWidth="1"
          opacity="0.75"
        />
        <path
          d="M10.5 44A22 5.5 0 0 0 53.5 44"
          fill="none"
          style={strokeToken("crown-gold-900")}
          strokeWidth="0.8"
          opacity="0.6"
        />
        {SPIKES.map((spike) => (
          <g key={spike.edge}>
            <path d={spike.light} fill={url(spike.lightPaint)} />
            <path d={spike.dark} fill={url(spike.darkPaint)} />
            <path
              d={spike.edge}
              fill="none"
              style={strokeToken("crown-gold-800")}
              strokeWidth="0.7"
              strokeLinejoin="round"
            />
          </g>
        ))}
        <g className="crown-pearls">
          {PEARLS.map(([cx, cy, r]) => (
            <circle
              key={cx}
              cx={cx}
              cy={cy}
              r={r}
              fill={url("pearl")}
              style={strokeToken("crown-gold-700")}
              strokeWidth="0.4"
            />
          ))}
        </g>
        <ellipse
          cx="32"
          cy="42.6"
          rx="4.2"
          ry="3.3"
          fill={url("ruby")}
          style={strokeToken("crown-velvet-deep")}
          strokeWidth="0.5"
        />
        <ellipse cx="20.5" cy="41.8" rx="2.5" ry="2.9" fill={url("sapphire")} />
        <ellipse cx="43.5" cy="41.8" rx="2.5" ry="2.9" fill={url("sapphire")} />
        <ellipse cx="12.6" cy="39.6" rx="1.2" ry="2.1" fill={url("emerald")} />
        <ellipse cx="51.4" cy="39.6" rx="1.2" ry="2.1" fill={url("emerald")} />
        <path
          d="M32 21.2l2.6 3-2.6 3.4-2.6-3.4z"
          fill={url("ruby")}
          opacity="0.9"
        />
        <g clipPath={url("clip")}>
          <g className="crown-beam">
            <rect
              x="-24"
              y="-6"
              width="14"
              height="70"
              fill={url("beam")}
              transform="skewX(-20)"
            />
          </g>
        </g>
      </g>
      <path
        className="crown-spark"
        d="M63 -4l1.6 6.4L71 4l-6.4 1.6L63 12l-1.6-6.4L55 4l6.4-1.6z"
        style={fillToken("sparkle")}
      />
      <circle
        className="crown-spark crown-spark-late"
        cx="68"
        cy="12"
        r="1.4"
        style={fillToken("sparkle")}
      />
    </svg>
  );
}
