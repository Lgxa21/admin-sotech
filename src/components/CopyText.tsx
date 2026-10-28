"use client";
import { useState } from "react";

export default function CopyText({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { window.prompt("Copia el texto:", text); }
    }}>{done ? "Copiado" : label}</button>
  );
}
