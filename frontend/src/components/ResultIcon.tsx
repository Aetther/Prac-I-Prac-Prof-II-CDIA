type ResultIconKind = "correct" | "wrong" | "timeout";

interface ResultIconProps {
  readonly kind: ResultIconKind;
}

export function ResultIcon({ kind }: ResultIconProps) {
  const className = `result-icon result-icon-${kind}`;
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {kind === "correct" ? (
        <path
          d="M12 34 26 48 52 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {kind === "wrong" ? (
        <path
          d="M16 16 48 48M48 16 16 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
      ) : null}
      {kind === "timeout" ? (
        <>
          <path
            d="M25 7h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle
            cx="32"
            cy="34"
            r="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
          />
          <path
            d="M32 20v15l11 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
    </svg>
  );
}
