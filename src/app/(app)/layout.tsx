import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { canManage, isDirector } from "@/lib/perm";
import { logout } from "@/app/actions/auth";
import Nav from "@/components/Nav";
import Icon from "@/components/Icon";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
  const items = [
    ...(u.role !== "FREELANCER" ? [{ href: "/", label: "Panel", icon: "home" }, { href: "/ordenes", label: "Órdenes", icon: "board" }] : []),
    { href: "/tareas", label: "Mis tareas", icon: "check" },
    ...(canManage(u.role) ? [{ href: "/clientes", label: "Clientes", icon: "building" }] : []),
    { href: "/avisos", label: "Avisos", icon: "bell", badge: n },
    ...(isDirector(u.role) ? [{ href: "/equipo", label: "Equipo", icon: "users" }] : []),
  ];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden md:flex md:flex-col sticky top-0 h-dvh border-r border-line bg-paper px-3 py-5">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="font-display font-bold">Sotech</span>
        </Link>
        <Nav items={items} variant="side" />
        <div className="mt-auto border-t border-line pt-4 px-2 grid gap-2">
          <Link href="/perfil" className="text-sm">
            <span className="block font-medium">{u.name}</span>
            <span className="block text-xs text-muted">{ROLE_LABEL[u.role]}</span>
          </Link>
          <form action={logout}><button className="flex items-center gap-2 text-xs text-muted hover:text-ink"><Icon name="logout" className="h-3.5 w-3.5" />Salir</button></form>
        </div>
      </aside>
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/95 backdrop-blur px-4 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Link href="/" className="flex items-center gap-2"><img src="/icon.svg" alt="" className="h-7 w-7" /><span className="font-display font-bold">Sotech</span></Link>
        <Link href="/perfil" className="text-xs text-muted">{u.name.split(" ")[0]}</Link>
      </header>
      <main className="min-w-0 px-4 pb-24 pt-5 md:px-8 md:py-8">{children}</main>
      <Nav items={items} variant="bottom" />
    </div>
  );
}
