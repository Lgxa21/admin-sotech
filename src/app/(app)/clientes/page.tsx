import Link from "next/link";
import { asc, count, eq, sql, and, ne } from "drizzle-orm";
import { db, clients, orders } from "@/db";
import { requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/labels";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const rows = await db.select({
    id: clients.id, name: clients.name, contactName: clients.contactName, renewalDate: clients.renewalDate,
    open: count(orders.id),
  }).from(clients).leftJoin(orders, and(eq(orders.clientId, clients.id), ne(orders.status, "PAGO_PROVEEDORES")))
    .where(eq(clients.active, true)).groupBy(clients.id).orderBy(asc(clients.name));
  const soon = new Date(Date.now() + 30 * 864e5);
  return (
    <div className="grid gap-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3"><h1 className="h1">Clientes</h1><Link href="/clientes/nuevo" className="btn-primary">+ Nuevo cliente</Link></div>
      {rows.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const renew = c.renewalDate && c.renewalDate < soon;
            return (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="card p-4 grid gap-1 transition-transform hover:-translate-y-0.5 h-full">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.contactName ?? "Sin contacto"}</span>
                  <span className="mt-2 flex justify-between text-xs">
                    <span className="tabular">{c.open} {c.open === 1 ? "orden abierta" : "órdenes abiertas"}</span>
                    {c.renewalDate && <span className={renew ? "text-warn font-semibold" : "text-muted"}>Renueva {fmtDate(c.renewalDate)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card p-8 text-center grid gap-3 justify-items-center">
          <p className="text-muted">Todavía no hay clientes registrados.</p>
          <Link href="/clientes/nuevo" className="btn-primary">Registrar el primero</Link>
        </div>
      )}
    </div>
  );
}
