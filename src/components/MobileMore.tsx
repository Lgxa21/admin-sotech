"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type Item = { href: string; label: string; icon: string; badge?: number };

export default function MobileMore({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  const badge = items.reduce((a, i) => a + (i.badge ?? 0), 0);

  return (
    <div ref={ref} className="relative flex min-w-0 flex-1 flex-col items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={`relative flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${open ? "bg-yellow text-ink font-bold" : "text-canvas/80"}`}
      >
        <Icon name="list" className="h-5 w-5" />
        <span className="truncate">Más</span>
        {badge > 0 && <span className="absolute right-[22%] top-1 h-2.5 w-2.5 rounded-full bg-magenta ring-2 ring-ink" />}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-[calc(100%+8px)] right-0 z-30 min-w-[200px] rounded-[14px] bg-paper p-2 shadow-[0_8px_30px_rgba(0,0,0,.18)]">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
            >
              <Icon name={it.icon} className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className="rounded-full bg-magenta px-2 py-px text-[11px] font-bold text-white tabular">{it.badge}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
