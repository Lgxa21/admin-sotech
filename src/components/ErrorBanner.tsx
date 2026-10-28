"use client";
import { useSearchParams } from "next/navigation";

// Muestra el ?error= que dejan las acciones al rechazar un formulario.
export default function ErrorBanner() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{error}</p>;
}
