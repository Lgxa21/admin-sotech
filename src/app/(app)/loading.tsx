export default function Loading() {
  return (
    <div className="grid gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-full bg-paper" />
      <div className="h-28 rounded-[18px] bg-paper" />
      <div className="h-48 rounded-[18px] bg-paper" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
