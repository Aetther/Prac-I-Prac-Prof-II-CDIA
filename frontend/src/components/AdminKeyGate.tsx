import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

interface AdminKeyGateProps {
  verifying: boolean;
  error: string | null;
  onSubmit: (apiKey: string) => void;
}

export function AdminKeyGate({
  verifying,
  error,
  onSubmit,
}: AdminKeyGateProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error !== null) {
      inputRef.current?.focus();
    }
  }, [error]);

  const trimmed = value.trim();
  const disabled = trimmed === "" || verifying;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    onSubmit(trimmed);
  };

  return (
    <section className="admin-gate">
      <p>Ingresá la clave de administración para revisar los reportes.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor={inputId}>Clave de administración</label>
        <input
          ref={inputRef}
          id={inputId}
          className="touch-target"
          type="password"
          autoComplete="off"
          value={value}
          disabled={verifying}
          aria-describedby={hintId}
          onChange={(event) => setValue(event.target.value)}
        />
        <p id={hintId}>
          Se guarda solo en la memoria de esta pestaña. Si recargás la página,
          tenés que volver a ingresarla.
        </p>
        {error !== null ? <p role="alert">{error}</p> : null}
        <button type="submit" className="touch-target" disabled={disabled}>
          {verifying ? "Verificando..." : "Ingresar"}
        </button>
      </form>
    </section>
  );
}
