"use client";

import { useRef, useState } from "react";

export default function BrandManualField({ replacing }: { replacing: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="grid gap-2">
      <button type="button" className="btn min-h-11 w-fit" onClick={() => input.current?.click()}>
        {replacing ? "Reemplazar archivo" : "Adjuntar manual"}
      </button>
      <input ref={input} type="file" name="manual" accept=".pdf,image/jpeg,image/png,image/webp" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file && file.size > 10 * 1024 * 1024) {
          event.currentTarget.value = "";
          setName("");
          setError("El archivo supera los 10 MB.");
          return;
        }
        setName(file?.name ?? "");
        setError("");
      }} />
      <p className="text-xs text-muted">PDF, JPG, PNG o WebP · hasta 10 MB</p>
      {name && <p className="break-all text-xs font-semibold">{name}</p>}
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
    </div>
  );
}
