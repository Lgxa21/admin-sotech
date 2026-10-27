import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { db, orders, tasks, users, clients } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleOrders } from "@/lib/access";
import { canManage } from "@/lib/perm";
import { STATUSES, STATUS_LABEL, fmtDate, PRIORITY_LABEL, type Status } from "@/lib/labels";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Panel" };
export const dynamic = "force-dynamic";

// Etapas en las que el trabajo todavía no se ha entregado.
const PRE_DELIVERY: Status[] = ["RECIBIDO", "BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "ENVIADO_CLIENTE", "AJUSTES", "APROBADO"];
const STALLED_DAYS = 3;

export default async function Panel() {
  const u = await requireUser();
  if (u.role === "FREELANCER") redirect("/tareas");
  const vis = visibleOrders(u);
  const scope = (...c: (ReturnType<typeof eq> | undefined)[]) => and(vis, ...c);
  const now = new Date();
  const in2 = new Date(now.getTime() + 2 * 864e5);
  const in7 = new Date(now.getTime() + 7 * 864e5);
  const stalledBefore = new Date(now.getTime() - STALLED_DAYS * 864e5);

  const sel = { id: orders.id, number: orders.number, title: orders.title, status: orders.status, dueDate: orders.dueDate, priority: orders.priority, client: clients.name, statusChangedAt: orders.statusChangedAt };

  const [byStatus, risk, stalled, week, urgent, myTasks, load] = await Promise.all([
    db.select({ status: orders.status, n: count() }).from(orders).where(scope(ne(orders.status, "PAGO_PROVEEDORES"))).groupBy(orders.status),
    db.select(sel).from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(scope(inArray(orders.status, PRE_DELIVERY), lte(orders.dueDate, in2))).orderBy(asc(orders.dueDate)).limit(8),
    db.select(sel).from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(scope(inArray(orders.status, PRE_DELIVERY), lt(orders.statusChangedAt, stalledBefore))).orderBy(asc(orders.statusChangedAt)).limit(8),
    db.select(sel).from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(scope(inArray(orders.status, PRE_DELIVERY), gte(orders.dueDate, now), lte(orders.dueDate, in7))).orderBy(asc(orders.dueDate)).limit(10),
    db.select(sel).from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(scope(eq(orders.priority, "URGENTE"), inArray(orders.status, PRE_DELIVERY))).limit(5),
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate, orderId: tasks.orderId, number: orders.number })
      .from(tasks).innerJoin(orders, eq(orders.id, tasks.orderId))
      .where(and(eq(tasks.assigneeId, u.id), ne(tasks.status, "LISTA"))).orderBy(sql`${tasks.dueDate} asc nulls last`).limit(6),
    canManage(u.role)
      ? db.select({ name: users.name, n: count(tasks.id) }).from(users)
          .leftJoin(tasks, and(eq(tasks.assigneeId, users.id), ne(tasks.status, "LISTA")))
          .where(eq(users.active, true)).groupBy(users.id, users.name).orderBy(sql`count(${tasks.id}) desc`)
      : Promise.resolve([] as { name: string; n: number }[]),
  ]);

  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<Status, number>;
  const active = byStatus.reduce((a, r) => a + r.n, 0);
  const maxLoad = Math.max(1, ...load.map((l) => l.n));
  const greeting = now.toLocaleString("es-VE", { hour: "numeric", hour12: false, timeZone: "America/Caracas" });
  const h = Number(greeting);

  return (
    <div className="grid gap-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"}, {u.name.split(" ")[0]}</p>
          <h1 className="h1">{active} órdenes en curso</h1>
        </div>
        {canManage(u.role) && <Link href="/ordenes/nueva" className="btn-primary">+ Nueva orden</Link>}
      </div>

      {urgent.length > 0 && (
        <section className="card border-bad/40 bg-bad/5 p-4">
          <h2 className="h2 text-bad mb-2">Urgencias abiertas</h2>
          <ul className="grid gap-1.5">{urgent.map((o) => <OrderRow key={o.id} o={o} />)}</ul>
        </section>
      )}

      <section className="card p-4 overflow-x-auto">
        <h2 className="h2 mb-3">Órdenes por etapa</h2>
        <div className="grid grid-cols-5 lg:grid-cols-9 gap-2 min-w-[560px]">
          {STATUSES.filter((s) => s !== "PAGO_PROVEEDORES").map((s) => (
            <Link key={s} href={`/ordenes?estado=${s}`} className="rounded-lg border border-line p-2.5 hover:border-accent">
              <span className="block font-display text-xl font-bold tabular">{counts[s] ?? 0}</span>
              <span className="block text-[11px] leading-tight text-muted">{STATUS_LABEL[s]}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Vencidas o por vencer" hint="Entrega en los próximos 2 días o ya pasada" empty="Nada en riesgo.">
          {risk.map((o) => <OrderRow key={o.id} o={o} due />)}
        </Block>
        <Block title="Detenidas" hint={`Sin cambio de etapa en más de ${STALLED_DAYS} días`} empty="Ninguna orden detenida.">
          {stalled.map((o) => <OrderRow key={o.id} o={o} since />)}
        </Block>
        <Block title="Entregas de la semana" hint="Próximos 7 días" empty="Sin entregas esta semana.">
          {week.map((o) => <OrderRow key={o.id} o={o} due />)}
        </Block>
        <Block title="Mis tareas" hint={<Link href="/tareas" className="text-accent">Ver todas</Link>} empty="No tienes tareas pendientes.">
          {myTasks.map((t) => (
            <li key={t.id}>
              <Link href={`/ordenes/${t.orderId}#tareas`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-canvas">
                <span className="min-w-0 truncate text-sm">{t.title} <span className="text-muted">· #{t.number}</span></span>
                <span className="shrink-0 text-xs text-muted tabular">{fmtDate(t.dueDate)}</span>
              </Link>
            </li>
          ))}
        </Block>
      </div>

      {load.length > 0 && (
        <section className="card p-4">
          <h2 className="h2">Carga del equipo</h2>
          <p className="text-xs text-muted mb-3">Tareas abiertas por persona</p>
          <ul className="grid gap-2">
            {load.map((l) => (
              <li key={l.name} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm">
                <span className="truncate">{l.name}</span>
                <span className="h-2 rounded-full bg-canvas overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${(l.n / maxLoad) * 100}%` }} /></span>
                <span className="text-right tabular text-muted">{l.n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Row = { id: string; number: number; title: string; status: Status; dueDate: Date | null; priority: string; client: string; statusChangedAt: Date };

function OrderRow({ o, due, since }: { o: Row; due?: boolean; since?: boolean }) {
  const late = due && o.dueDate && o.dueDate < new Date();
  const days = Math.floor((Date.now() - o.statusChangedAt.getTime()) / 864e5);
  return (
    <li>
      <Link href={`/ordenes/${o.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-canvas">
        <span className="font-mono text-xs text-muted tabular">#{o.number}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{o.title} <span className="text-muted">· {o.client}</span></span>
        <StatusBadge status={o.status} />
        {due && <span className={`w-16 shrink-0 text-right text-xs tabular ${late ? "text-bad font-semibold" : "text-muted"}`}>{late ? "Vencida" : fmtDate(o.dueDate)}</span>}
        {since && <span className="w-16 shrink-0 text-right text-xs tabular text-warn">{days} días</span>}
        {!due && !since && <span className="text-xs text-bad">{PRIORITY_LABEL[o.priority as "URGENTE"]}</span>}
      </Link>
    </li>
  );
}

function Block({ title, hint, empty, children }: { title: string; hint: React.ReactNode; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="h2">{title}</h2>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      {children.length ? <ul className="grid gap-0.5">{children}</ul> : <p className="px-2 py-3 text-sm text-muted">{empty}</p>}
    </section>
  );
}
