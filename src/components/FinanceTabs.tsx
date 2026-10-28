"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/cobros", label: "Cobros" },
  { href: "/finanzas/pagos", label: "Pagos" },
  { href: "/finanzas/cotizaciones", label: "Cotizaciones" },
  { href: "/finanzas/igualas", label: "Igualas" },
];

export default function FinanceTabs() {
  const path = usePathname();
  const active = (h: string) => (h === "/finanzas" ? path === h : path.startsWith(h));
  return (
    <nav aria-label="Secciones de finanzas" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={active(t.href) ? "page" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active(t.href) ? "bg-yellow text-ink" : "bg-paper text-muted hover:text-ink"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
