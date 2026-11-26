"use client";

import { useEffect, useState } from "react";

export default function ContentStudio() {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function checkAccess() {
      try {
        const response = await fetch("/carruseles/studio/estado", { cache: "no-store", signal: controller.signal });
        if (response.status === 404 || response.redirected) setAvailable(false);
      } catch {
        // Un fallo transitorio de red no interrumpe una edición en curso.
      }
    }

    const check = window.setInterval(checkAccess, 30_000);
    window.addEventListener("focus", checkAccess);
    return () => {
      controller.abort();
      window.clearInterval(check);
      window.removeEventListener("focus", checkAccess);
    };
  }, []);

  if (!available) return <p role="status" className="card p-5 text-muted">Content Studio está desactivado.</p>;

  return (
    <iframe
      title="Editor de carruseles de Sotech"
      src="/carruseles/studio/index.html"
      className="h-[76dvh] min-h-[420px] w-full rounded-2xl border border-line bg-paper"
    />
  );
}
