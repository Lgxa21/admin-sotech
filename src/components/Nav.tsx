"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

type Item = { href: string; label: string; icon: string; badge?: number; match?: string[] };

export default function Nav({ items, variant }: { items: Item[]; variant: "side" | "bottom" }) {
  const path = usePathname();
  const isActive = (it: Item) => (it.href === "/" ? path === "/" : [it.href, ...(it.match ?? [])].some((h) => path.startsWith(h)));

  if (variant === "side") return (
    <nav aria-label="Principal" className="grid gap-1 text-[15px]">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={isActive(it) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 ${isActive(it) ? "bg-yellow text-ink font-bold" : "text-canvas/85 hover:bg-white/10 hover:text-canvas"}`}>
          <Icon name={it.icon} className="h-[18px] w-[18px]" />
          <span className="flex-1">{it.label}</span>
          {!!it.badge && <span className="rounded-full bg-magenta px-2 py-px text-xs font-bold text-white tabular">{it.badge}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <nav aria-label="Principal" className="md:hidden fixed inset-x-0 bottom-0 z-20 bg-ink"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <div className="flex justify-around px-1 pt-1.5 pb-1">
        {items.map((it) => (
          <Link key={it.href} href={it.href} aria-current={isActive(it) ? "page" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${isActive(it) ? "bg-yellow text-ink font-bold" : "text-canvas/80"}`}>
            <Icon name={it.icon} className="h-5 w-5" />
            <span className="truncate">{it.label}</span>
            {!!it.badge && <span className="absolute right-[22%] top-1 h-2.5 w-2.5 rounded-full bg-magenta ring-2 ring-ink" />}
          </Link>
        ))}
      </div>
    </nav>
  );
}
