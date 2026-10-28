import Link from "next/link";
import type { RoleT } from "@/lib/labels";

// Encabezado común de Tablero: órdenes, mis tareas y (para dirección) el equipo.
export default function BoardTabs({ current, role, children }: { current: "ordenes" | "tareas" | "equipo"; role: RoleT; children?: React.ReactNode }) {
  const tabs = [
    { key: "ordenes", href: "/ordenes", label: "Órdenes" },
    { key: "tareas", href: "/tareas", label: "Mis tareas" },
    ...(role === "DIRECCION" ? [{ key: "equipo", href: "/equipo", label: "Equipo" }] : []),
  ];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Tablero</h1>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
      <nav aria-label="Secciones del tablero" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={current === t.key ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${current === t.key ? "bg-yellow text-ink" : "bg-paper text-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
