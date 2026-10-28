import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { canManage } from "@/lib/perm";
import { logout } from "@/app/actions/auth";
import Nav from "@/components/Nav";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import SwRegister from "@/components/SwRegister";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
  const items = [
    ...(u.role !== "FREELANCER"
      ? [{ href: "/", label: "Hoy", icon: "home" }, { href: "/ordenes", label: "Tablero", icon: "board", match: ["/tareas", "/equipo"] }]
      : [{ href: "/tareas", label: "Mis tareas", icon: "check" }]),
    ...(canManage(u.role) ? [{ href: "/clientes", label: "Clientes", icon: "building" }, { href: "/finanzas", label: "Finanzas", icon: "money" }] : []),
    { href: "/avisos", label: "Avisos", icon: "bell", badge: n },
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden md:flex md:flex-col sticky top-0 h-dvh bg-ink px-5 py-7 gap-8">
        <Link href="/" aria-label="Inicio"><Logo /></Link>
        <Nav items={items} variant="side" />
        <div className="mt-auto grid gap-2 text-sm">
          <Link href="/perfil" className="text-canvas hover:text-yellow">
            <span className="block font-semibold">{u.name}</span>
            <span className="block text-xs text-canvas/60">{ROLE_LABEL[u.role]}</span>
          </Link>
          <form action={logout}><button className="flex items-center gap-2 text-xs text-canvas/60 hover:text-canvas"><Icon name="logout" className="h-3.5 w-3.5" />Salir</button></form>
        </div>
      </aside>
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between bg-ink px-4 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))", paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}>
        <Link href="/" aria-label="Inicio"><Logo size={28} /></Link>
        <Link href="/perfil" className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink" aria-label="Mi perfil">
          {u.name.replace(/\(.*?\)/g, "").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </Link>
      </header>
      <main className="min-w-0 pb-28 pt-6 md:pb-12 md:pt-10" style={{ paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}>
        <div className="mx-auto w-full max-w-[1180px] md:px-6 lg:px-10">{children}</div>
      </main>
      <Nav items={items} variant="bottom" />
      <SwRegister />
    </div>
  );
}
