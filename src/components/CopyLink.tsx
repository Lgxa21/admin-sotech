"use client";
import { useState } from "react";

export default function CopyLink({ url, label = "Copiar enlace" }: { url: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); }
    catch { window.prompt("Copia el enlace:", url); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace" className="input min-w-0 flex-[1_1_240px] font-mono text-[13px]" />
      <button type="button" onClick={copy} className="btn-primary" aria-describedby="copy-link-status">{done ? "Copiado" : label}</button>
      <span id="copy-link-status" role="status" aria-live="polite" className="sr-only">{done ? "Enlace copiado al portapapeles" : ""}</span>
    </div>
  );
}
