"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card grid max-w-lg gap-4 px-6 py-8" role="alert">
      <h1 className="h2">Algo salió mal</h1>
      <p className="text-sm text-muted">No pudimos cargar esta pantalla. Puedes intentar de nuevo; si sigue fallando, avisa a dirección.</p>
      {error.digest && <p className="font-mono text-xs text-muted">Código: {error.digest}</p>}
      <div><button type="button" onClick={reset} className="btn-primary">Reintentar</button></div>
    </div>
  );
}
