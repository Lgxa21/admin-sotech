import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, eq, gte, inArray, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, orders, tasks, clients, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleOrders } from "@/lib/access";
import { canManage, isDirector } from "@/lib/perm";
import { STAGE_GROUPS, type Status } from "@/lib/labels";
import { ensureRetainerOrders } from "@/lib/retainers";

export const metadata = { title: "Hoy" };
export const dynamic = "force-dynamic";

// Etapas en las que el trabajo todavía no se ha entregado.
const PRE_DELIVERY: Status[] = ["RECIBIDO", "BRIEF_REVISION", "EN_PRODUCCION", "REVISION_INTERNA", "ENVIADO_CLIENTE", "AJUSTES", "APROBADO"];
const STALLED_DAYS = 3;
const TZ = "America/Caracas";

type Attention = { key: string; tag: string; tone: string; title: string; detail: string; href: string; cta: string; primary?: boolean };

export default async function Hoy() {
  const u = await requireUser();
  if (u.role === "FREELANCER") redirect("/tareas");
  await ensureRetainerOrders().catch(() => 0);
  const vis = visibleOrders(u);
  const scope = (...c: (SQL | undefined)[]) => and(vis, ...c);
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 864e5);
  const stalledBefore = new Date(now.getTime() - STALLED_DAYS * 864e5);
  const sel = { id: orders.id, number: orders.number, title: orders.title, status: orders.status, dueDate: orders.dueDate, client: clients.name, owner: users.name, statusChangedAt: orders.statusChangedAt };
  const base = () => db.select(sel).from(orders).innerJoin(clients, eq(clients.id, orders.clientId)).leftJoin(users, eq(users.id, orders.ownerId));

  const [byStatus, urgent, toApprove, late, stalled, toInvoice, myTasks, week, [lateN], [approveN]] = await Promise.all([
    db.select({ status: orders.status, n: count() }).from(orders).where(scope(ne(orders.status, "PAGO_PROVEEDORES"))).groupBy(orders.status),
    base().where(scope(eq(orders.priority, "URGENTE"), inArray(orders.status, PRE_DELIVERY))).limit(5),
    isDirector(u.role) ? base().where(scope(eq(orders.status, "REVISION_INTERNA"))).orderBy(asc(orders.statusChangedAt)).limit(5) : Promise.resolve([]),
    base().where(scope(inArray(orders.status, PRE_DELIVERY), lt(orders.dueDate, now))).orderBy(asc(orders.dueDate)).limit(5),
    base().where(scope(inArray(orders.status, PRE_DELIVERY), lt(orders.statusChangedAt, stalledBefore))).orderBy(asc(orders.statusChangedAt)).limit(5),
    canManage(u.role) ? base().where(scope(inArray(orders.status, ["APROBADO", "ENTREGADO"]))).limit(5) : Promise.resolve([]),
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate, orderId: tasks.orderId, number: orders.number })
      .from(tasks).innerJoin(orders, eq(orders.id, tasks.orderId))
      .where(and(eq(tasks.assigneeId, u.id), or(eq(tasks.status, "POR_ACEPTAR"), and(ne(tasks.status, "LISTA"), lt(tasks.dueDate, new Date(now.getTime() + 864e5))))))
      .orderBy(sql`${tasks.dueDate} asc nulls last`).limit(5),
    base().where(scope(inArray(orders.status, PRE_DELIVERY), gte(orders.dueDate, now), lte(orders.dueDate, in7))).orderBy(asc(orders.dueDate)).limit(6),
    db.select({ n: count() }).from(orders).where(scope(inArray(orders.status, PRE_DELIVERY), lt(orders.dueDate, now))),
    db.select({ n: count() }).from(orders).where(scope(eq(orders.status, "REVISION_INTERNA"))),
  ]);

  // Lo que necesita una acción, sin repetir órdenes, ordenado por gravedad.
  const seen = new Set<string>();
  const items: Attention[] = [];
  const add = (a: Attention, orderId?: string) => {
    if (orderId && seen.has(orderId)) return;
    if (orderId) seen.add(orderId);
    items.push(a);
  };
  for (const o of urgent) add({ key: "u" + o.id, tag: "Urgencia", tone: "bg-magenta text-white", title: o.title, detail: `${o.client} · #${o.number}`, href: `/ordenes/${o.id}`, cta: "Ver" }, o.id);
  for (const o of toApprove) add({ key: "a" + o.id, tag: "Aprobar", tone: "bg-yellow text-ink", title: o.title, detail: `${o.client} · ${o.owner ? `${o.owner.split(" ")[0]} la dejó lista para revisión` : "lista para revisión"}`, href: `/ordenes/${o.id}`, cta: "Revisar pieza", primary: true }, o.id);
  for (const o of late) add({ key: "l" + o.id, tag: "Vencida", tone: "bg-cyan text-ink", title: o.title, detail: `${o.client} · venció ${relDay(o.dueDate!, now)}`, href: `/ordenes/${o.id}`, cta: "Ver" }, o.id);
  for (const t of myTasks) add({ key: "t" + t.id, tag: t.status === "POR_ACEPTAR" ? "Por aceptar" : "Tu tarea", tone: "bg-ink text-paper", title: t.title, detail: `Orden #${t.number}${t.dueDate ? ` · entrega ${relDay(t.dueDate, now)}` : ""}`, href: `/ordenes/${t.orderId}#tareas`, cta: "Abrir" });
  for (const o of stalled) add({ key: "s" + o.id, tag: "Detenida", tone: "bg-ink/10 text-ink", title: o.title, detail: `${o.client} · ${Math.floor((now.getTime() - o.statusChangedAt.getTime()) / 864e5)} días sin moverse`, href: `/ordenes/${o.id}`, cta: "Ver" }, o.id);
  for (const o of toInvoice) add({ key: "f" + o.id, tag: "Facturar", tone: "bg-yellow/40 text-ink", title: o.title, detail: `${o.client} · aprobada por el cliente`, href: `/ordenes/${o.id}`, cta: "Ver" }, o.id);
  const shown = items.slice(0, 6);

  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<Status, number>>;
  const active = byStatus.reduce((a, r) => a + r.n, 0);
  const groups = STAGE_GROUPS.map((g) => ({ ...g, n: g.statuses.reduce((a, s) => a + (counts[s as Status] ?? 0), 0) }));
  const total = Math.max(1, groups.reduce((a, g) => a + g.n, 0));
  const lateCount = lateN.n;
  const approveCount = approveN.n;
  const h = Number(now.toLocaleString("es-VE", { hour: "numeric", hour12: false, timeZone: TZ }));
  const today = now.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

  return (
    <div className="grid gap-9">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="grid max-w-[720px] gap-2.5">
          <p className="eyebrow">{today}</p>
          <h1 className="h1">
            {h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"}, {u.name.split(" ")[0]}.{" "}
            {shown.length ? <>Hay <span className="bg-yellow px-1.5">{shown.length} {shown.length === 1 ? "cosa" : "cosas"}</span> esperándote.</> : "Todo está en orden."}
          </h1>
        </div>
        {canManage(u.role) && <Link href="/ordenes/nueva" className="btn-primary px-6 py-3 text-[15px]">+ Nueva orden</Link>}
      </header>

      <section aria-label="Resumen" className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Stat n={active} label={active === 1 ? "orden en curso" : "órdenes en curso"} bar="border-cyan" href="/ordenes" />
        <Stat n={lateCount} label={lateCount === 1 ? "vencida" : "vencidas"} bar="border-magenta" href="/ordenes?vista=lista" />
        {isDirector(u.role)
          ? <Stat n={approveCount} label="esperando tu aprobación" bar="border-yellow" href="/ordenes?estado=REVISION_INTERNA" />
          : <Stat n={myTasks.length} label="tareas tuyas por atender" bar="border-yellow" href="/tareas" />}
      </section>

      <section aria-labelledby="atencion" className="grid gap-3.5">
        <h2 id="atencion" className="h2 text-[22px]">Necesita tu atención</h2>
        {shown.length ? (
          <ul className="grid gap-2.5">
            {shown.map((a) => (
              <li key={a.key} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                <span className={`tag ${a.tone}`}>{a.tag}</span>
                <div className="min-w-0 flex-[1_1_240px]">
                  <p className="truncate text-base font-bold">{a.title}</p>
                  <p className="truncate text-sm text-muted">{a.detail}</p>
                </div>
                <Link href={a.href} className={a.primary ? "btn-primary" : "btn"}>{a.cta}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card px-5 py-6 text-muted">Nada pendiente de tu lado. Las órdenes siguen su curso.</p>
        )}
        {items.length > shown.length && <p className="text-sm text-muted">Y {items.length - shown.length} más en el <Link href="/ordenes" className="font-bold text-ink underline">tablero</Link>.</p>}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="flujo" className="card-ink grid content-start gap-4 p-6">
          <h2 id="flujo" className="h2">Así va el trabajo</h2>
          <div className="flex h-[18px] gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
            {groups.map((g) => g.n > 0 && <span key={g.key} className={g.key === "entrada" ? "bg-canvas" : g.bar} style={{ flex: g.n / total }} />)}
            {active === 0 && <span className="flex-1 bg-white/15" />}
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <li><b className="font-mono">{groups[0].n}</b> recién llegadas</li>
            <li><b className="font-mono text-[#6FCFF2]">{groups[1].n}</b> en producción</li>
            <li><b className="font-mono text-[#FF6BB5]">{groups[2].n}</b> con el cliente</li>
            <li><b className="font-mono text-yellow">{(counts.ENTREGADO ?? 0) + (counts.FACTURADO ?? 0)}</b> por cerrar</li>
          </ul>
        </section>
        <section aria-labelledby="semana" className="card grid content-start gap-3 p-6">
          <h2 id="semana" className="h2">Entregas de la semana</h2>
          {week.length ? (
            <ul className="grid gap-2.5 text-sm">
              {week.map((o) => (
                <li key={o.id}>
                  <Link href={`/ordenes/${o.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="w-[68px] shrink-0 font-mono font-semibold uppercase">{dayTag(o.dueDate!)}</span>
                    <span className="min-w-0 truncate">{o.title} <span className="text-muted">· {o.client}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No hay entregas en los próximos 7 días.</p>}
        </section>
      </div>
    </div>
  );
}

function Stat({ n, label, bar, href }: { n: number; label: string; bar: string; href: string }) {
  return (
    <Link href={href} className={`card grid content-start gap-1.5 border-t-[6px] ${bar} px-3.5 py-4 transition-transform hover:-translate-y-0.5 sm:px-6 sm:py-5`}>
      <span className="font-mono text-[30px] font-semibold leading-none tabular sm:text-[40px]">{n}</span>
      <span className="text-xs leading-snug text-muted sm:text-sm">{label}</span>
    </Link>
  );
}

function dayTag(d: Date) {
  const w = d.toLocaleDateString("es-VE", { weekday: "short", timeZone: TZ }).replace(".", "").slice(0, 3);
  const day = d.toLocaleDateString("es-VE", { day: "2-digit", timeZone: TZ });
  return `${w} ${day}`;
}

function relDay(d: Date, now: Date) {
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const diff = Math.round((Date.parse(key(d)) - Date.parse(key(now))) / 864e5);
  if (diff === 0) return "hoy";
  if (diff === -1) return "ayer";
  if (diff === 1) return "mañana";
  if (diff < 0) return `hace ${-diff} días`;
  return d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", timeZone: TZ });
}
