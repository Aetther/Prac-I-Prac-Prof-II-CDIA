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
  return (
    <div className="error-screen" role="alert">
      <p>{message}</p>
      <button type="button" className="touch-target" onClick={onRetry}>
        Reintentar
      </button>
      <button type="button" className="touch-target" onClick={onBackToLobby}>
        Volver al lobby
      </button>
    </div>
  );
}
