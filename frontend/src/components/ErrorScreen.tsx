import { useMessages } from "../i18n";

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
  onBackToLobby: () => void;
}

export function ErrorScreen({
  message,
  onRetry,
  onBackToLobby,
}: ErrorScreenProps) {
  const m = useMessages();
  return (
    <div className="error-screen" role="alert">
      <p>{message}</p>
      <button
        type="button"
        className="button-primary touch-target"
        onClick={onRetry}
      >
        {m.retry}
      </button>
      <button
        type="button"
        className="button-primary touch-target"
        onClick={onBackToLobby}
      >
        {m.backToLobby}
      </button>
    </div>
  );
}
