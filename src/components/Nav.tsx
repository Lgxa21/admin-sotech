"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

type Item = { href: string; label: string; icon: string; badge?: number };

export default function Nav({ items, variant }: { items: Item[]; variant: "side" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  if (variant === "side") return (
      <nav aria-label="Principal" className="grid gap-1">
        {items.map((it) => (
          <Link key={it.href} href={it.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active(it.href) ? "bg-accent/10 text-accent font-semibold" : "text-muted hover:bg-canvas hover:text-ink"}`}>
            <Icon name={it.icon} />
            <span className="flex-1">{it.label}</span>
            {!!it.badge && <span className="chip bg-bad text-white tabular">{it.badge}</span>}
          </Link>
        ))}
      </nav>
  );
  return (
      <nav aria-label="Principal" className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex justify-around">
          {items.slice(0, 5).map((it) => (
            <Link key={it.href} href={it.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(it.href) ? "text-accent font-semibold" : "text-muted"}`}>
              <Icon name={it.icon} className="h-5 w-5" />
              {it.label}
              {!!it.badge && <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-bad" />}
            </Link>
          ))}
        </div>
      </nav>
  );
}
