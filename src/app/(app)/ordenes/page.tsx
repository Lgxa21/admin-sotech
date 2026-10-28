import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, orders, clients, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleOrders } from "@/lib/access";
import { canManage } from "@/lib/perm";
import { STATUSES, STATUS_LABEL, SERVICES, SERVICE_LABEL, PRIORITY_LABEL, PRIORITY_TONE, fmtDate, type Status } from "@/lib/labels";
import StatusBadge from "@/components/StatusBadge";
import Kanban, { type Card } from "@/components/Kanban";
import { orderFilters } from "@/lib/order-filters";
import Icon from "@/components/Icon";
import MoreFilters from "@/components/MoreFilters";
import BoardTabs from "@/components/BoardTabs";

export const metadata = { title: "Tablero" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const u = await requireUser();
  if (u.role === "FREELANCER") redirect("/tareas");
  const sp = await searchParams;
  const view = sp.vista === "lista" ? "lista" : "tablero";
  const where = orderFilters(u, sp);

  const [rows, clientList, people] = await Promise.all([
    db.select({
      id: orders.id, number: orders.number, title: orders.title, status: orders.status, dueDate: orders.dueDate,
      priority: orders.priority, serviceType: orders.serviceType, client: clients.name, owner: users.name,
    }).from(orders).innerJoin(clients, eq(clients.id, orders.clientId)).leftJoin(users, eq(users.id, orders.ownerId))
      .where(where).orderBy(sql`${orders.dueDate} asc nulls last`, desc(orders.number)),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.active, true)).orderBy(asc(clients.name)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/ordenes?${p}`;
  };

  return (
    <div className="grid gap-6">
      <BoardTabs current="ordenes" role={u.role}>
          <div className="inline-flex rounded-full bg-paper p-1" role="group" aria-label="Vista">
            <Link href={qs({ vista: "tablero" })} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${view === "tablero" ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}><Icon name="board" />Tablero</Link>
            <Link href={qs({ vista: "lista" })} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${view === "lista" ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}><Icon name="list" />Lista</Link>
          </div>
          {canManage(u.role) && <Link href="/ordenes/nueva" className="btn-primary">+ Nueva orden</Link>}
      </BoardTabs>

      <form className="card p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] items-end">
        <input type="hidden" name="vista" value={view} />
        <div><label className="label" htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={sp.q} placeholder="Título, cliente o número" className="input" /></div>
        <MoreFilters active={!!(sp.cliente || sp.responsable || sp.servicio || sp.estado)}>
          <Select id="cliente" label="Cliente" value={sp.cliente} options={clientList.map((c) => [c.id, c.name])} />
          <Select id="responsable" label="Responsable" value={sp.responsable} options={people.map((p) => [p.id, p.name])} />
          <Select id="servicio" label="Servicio" value={sp.servicio} options={SERVICES.map((s) => [s, SERVICE_LABEL[s]])} />
          <Select id="estado" label="Etapa" value={sp.estado} options={STATUSES.map((s) => [s, STATUS_LABEL[s]])} />
        </MoreFilters>
        <div className="flex gap-2"><button className="btn">Filtrar</button><Link href={`/ordenes?vista=${view}`} className="btn">Limpiar</Link></div>
      </form>

      {view === "tablero" ? (
        <Kanban cards={rows.map<Card>((r) => ({ ...r, dueDate: r.dueDate?.toISOString() ?? null }))} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">#</th><th className="px-2 font-medium">Orden</th><th className="px-2 font-medium">Cliente</th>
                <th className="px-2 font-medium">Etapa</th><th className="px-2 font-medium">Prioridad</th><th className="px-2 font-medium">Responsable</th><th className="px-4 font-medium text-right">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const late = r.dueDate && r.dueDate < new Date() && ["RECIBIDO", "BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "ENVIADO_CLIENTE", "AJUSTES", "APROBADO"].includes(r.status);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted tabular">{r.number}</td>
                    <td className="px-2"><Link href={`/ordenes/${r.id}`} className="font-bold hover:underline">{r.title}</Link><span className="block text-xs text-muted">{SERVICE_LABEL[r.serviceType]}</span></td>
                    <td className="px-2">{r.client}</td>
                    <td className="px-2"><StatusBadge status={r.status} /></td>
                    <td className={`px-2 ${PRIORITY_TONE[r.priority]}`}>{PRIORITY_LABEL[r.priority]}</td>
                    <td className="px-2 text-muted">{r.owner ?? "—"}</td>
                    <td className={`px-4 text-right tabular ${late ? "text-bad font-semibold" : "text-muted"}`}>{late ? "Vencida" : fmtDate(r.dueDate)}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No hay órdenes con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <a href={`/exportar/ordenes?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "vista") as [string, string][])}`} className="font-semibold text-ink underline">Exportar estas órdenes a Excel</a>
        {sp.cerradas ? <Link className="font-semibold text-ink underline" href={qs({ cerradas: undefined })}>Ocultar órdenes cerradas</Link> : <Link className="font-semibold text-ink underline" href={qs({ cerradas: "1" })}>Mostrar también las cerradas (pago a proveedores hecho)</Link>}
      </p>
    </div>
  );
}

function Select({ id, label, value, options }: { id: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} name={id} defaultValue={value ?? ""} className="input">
        <option value="">Todos</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
