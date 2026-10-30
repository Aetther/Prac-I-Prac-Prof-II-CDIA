import { useEffect, useId, useRef, useState } from "react";
import { useMessages } from "../i18n";

interface SurrenderControlProps {
  /** The player who surrenders: the one on turn on this screen. */
  playerName: string;
  /** The player who wins if the surrender is confirmed. */
  opponentName: string;
  onSurrender: () => void;
}

/**
 * The "Rendirse" button and its inline confirmation. Nothing changes until the
 * player confirms; cancelling returns the focus to the button.
 */
export function SurrenderControl({
  playerName,
  opponentName,
  onSurrender,
}: SurrenderControlProps) {
  const m = useMessages();
  const questionId = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
      return;
    }
    if (returnFocusRef.current) {
      returnFocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return (
      <div className="surrender">
        <button
          ref={buttonRef}
          type="button"
          className="button-secondary surrender-button touch-target"
          onClick={() => setOpen(true)}
        >
          {m.surrender}
        </button>
      </div>
    );
  }

  return (
    <div className="surrender">
      <div
        role="alertdialog"
        aria-labelledby={questionId}
        className="surrender-confirm"
      >
        <p id={questionId}>{m.surrenderQuestion(playerName, opponentName)}</p>
        <div className="surrender-actions">
          <button
            type="button"
            className="button-secondary surrender-button touch-target"
            onClick={onSurrender}
          >
            {m.surrenderConfirm}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="button-primary touch-target"
            onClick={() => {
              returnFocusRef.current = true;
              setOpen(false);
            }}
          >
            {m.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
