import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, isNotNull, lt, or, type SQL } from "drizzle-orm";
import { db, orders, tasks, clients, users } from "@/db";
import { requireUser } from "@/lib/auth";
import { visibleOrders } from "@/lib/access";
import { canManage } from "@/lib/perm";
import { groupOf, STATUS_LABEL, type Status } from "@/lib/labels";
import BoardTabs from "@/components/BoardTabs";

export const metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

const TZ = "America/Caracas";
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const hour = (d: Date) => d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", timeZone: TZ });

type Item = { key: string; day: string; kind: "entrega" | "publica"; title: string; sub: string; href: string; bar: string; time?: string; done: boolean };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ mes?: string; ver?: string; cliente?: string }> }) {
  const u = await requireUser();
  if (u.role === "FREELANCER") redirect("/tareas");
  const sp = await searchParams;
  const today = dayKey(new Date());
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(`${month}-01T00:00:00-04:00`);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const end = new Date(`${nextMonth}-01T00:00:00-04:00`);
  const show = sp.ver === "entregas" || sp.ver === "publicaciones" ? sp.ver : "todo";

  const vis = visibleOrders(u);
  const clientFilter: SQL | undefined = sp.cliente ? eq(orders.clientId, sp.cliente) : undefined;
  const [due, pubs, clientList] = await Promise.all([
    show === "publicaciones" ? Promise.resolve([]) : db.select({ id: orders.id, title: orders.title, status: orders.status, dueDate: orders.dueDate, client: clients.name, owner: users.name })
      .from(orders).innerJoin(clients, eq(clients.id, orders.clientId)).leftJoin(users, eq(users.id, orders.ownerId))
      .where(and(vis, clientFilter, gte(orders.dueDate, first), lt(orders.dueDate, end))).orderBy(asc(orders.dueDate)),
    show === "entregas" ? Promise.resolve([]) : db.select({ id: tasks.id, title: tasks.title, status: tasks.status, publishAt: tasks.publishAt, channel: tasks.channel, orderId: orders.id, client: clients.name })
      .from(tasks).innerJoin(orders, eq(orders.id, tasks.orderId)).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(and(canManage(u.role) ? undefined : or(vis, eq(tasks.assigneeId, u.id)), clientFilter, isNotNull(tasks.publishAt), gte(tasks.publishAt, first), lt(tasks.publishAt, end)))
      .orderBy(asc(tasks.publishAt)),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.active, true)).orderBy(asc(clients.name)),
  ]);

  const items: Item[] = [
    ...due.map((o) => ({
      key: "o" + o.id, day: dayKey(o.dueDate!), kind: "entrega" as const, title: o.title, sub: `${o.client} · ${STATUS_LABEL[o.status as Status]}`,
      href: `/ordenes/${o.id}`, bar: groupOf(o.status as Status).bar, done: ["ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES"].includes(o.status),
    })),
    ...pubs.map((t) => ({
      key: "t" + t.id, day: dayKey(t.publishAt!), kind: "publica" as const, title: t.title, sub: `${t.client}${t.channel ? ` · ${t.channel}` : ""}`,
      href: `/ordenes/${t.orderId}#tareas`, bar: "bg-cyan", time: hour(t.publishAt!), done: t.status === "LISTA",
    })),
  ];
  const byDay = new Map<string, Item[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);

  // Cuadrícula de lunes a domingo
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ mes: month, ver: show === "todo" ? undefined : show, cliente: sp.cliente, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/calendario?${p}`;
  };
  const daysWithItems = [...byDay.keys()].sort();

  return (
    <div className="grid gap-6">
      <BoardTabs current="calendario" role={u.role} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={qs({ mes: prevMonth })} className="btn btn-sm" aria-label="Mes anterior">←</Link>
          <h2 className="h2 min-w-[150px] text-center text-xl first-letter:uppercase">{MONTHS[m - 1]} {y}</h2>
          <Link href={qs({ mes: nextMonth })} className="btn btn-sm" aria-label="Mes siguiente">→</Link>
          {month !== today.slice(0, 7) && <Link href={qs({ mes: undefined })} className="btn btn-sm">Hoy</Link>}
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="mes" value={month} />
          <label className="sr-only" htmlFor="ver">Mostrar</label>
          <select id="ver" name="ver" defaultValue={show} className="input w-auto rounded-full py-1.5 text-sm">
            <option value="todo">Entregas y publicaciones</option><option value="entregas">Solo entregas</option><option value="publicaciones">Solo publicaciones</option>
          </select>
          <label className="sr-only" htmlFor="cliente">Cliente</label>
          <select id="cliente" name="cliente" defaultValue={sp.cliente ?? ""} className="input w-auto rounded-full py-1.5 text-sm">
            <option value="">Todos los clientes</option>{clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-sm">Ver</button>
        </form>
      </div>

      <p className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-ink" />Entrega de una orden (color según su etapa)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan" />Publicación programada</span>
      </p>

      {/* Escritorio: cuadrícula del mes */}
      <div className="hidden overflow-hidden rounded-[18px] bg-paper md:block">
        <div className="grid grid-cols-7 border-b border-line">
          {DAYS.map((d) => <div key={d} className="px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const list = d ? byDay.get(d) ?? [] : [];
            return (
              <div key={i} className={`min-h-[118px] border-b border-r border-line p-1.5 ${!d ? "bg-canvas/60" : ""} ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}>
                {d && <p className={`mb-1 px-1 text-right font-mono text-xs ${d === today ? "font-bold" : "text-muted"}`}>{d === today ? <span className="rounded-full bg-yellow px-1.5 py-0.5">{Number(d.slice(8))}</span> : Number(d.slice(8))}</p>}
                <ul className="grid gap-1">
                  {list.slice(0, 4).map((it) => (
                    <li key={it.key}>
                      <Link href={it.href} title={`${it.title} · ${it.sub}`} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] leading-tight hover:bg-canvas ${it.done ? "text-muted line-through" : ""}`}>
                        {it.kind === "entrega" ? <span className={`h-2.5 w-2.5 flex-none rounded-full ${it.bar}`} /> : <span className="h-2.5 w-2.5 flex-none rounded-full bg-cyan" />}
                        <span className="truncate">{it.time ? <span className="font-mono text-muted">{it.time} </span> : null}{it.title}</span>
                      </Link>
                    </li>
                  ))}
                  {list.length > 4 && <li className="px-1.5 text-[11px] font-semibold text-muted">+{list.length - 4} más</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Celular: agenda por día */}
      <div className="grid gap-4 md:hidden">
        {daysWithItems.length ? daysWithItems.map((d) => (
          <section key={d} className="grid gap-2">
            <h3 className={`eyebrow ${d === today ? "!text-ink" : ""}`}>{new Date(`${d}T12:00:00-04:00`).toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}{d === today ? " · hoy" : ""}</h3>
            <ul className="grid gap-2">
              {byDay.get(d)!.map((it) => (
                <li key={it.key}>
                  <Link href={it.href} className="card flex items-center gap-3 px-4 py-3">
                    <span className={`h-3 w-3 flex-none rounded-full ${it.kind === "entrega" ? it.bar : "bg-cyan"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-bold ${it.done ? "text-muted line-through" : ""}`}>{it.title}</span>
                      <span className="block truncate text-[13px] text-muted">{it.kind === "entrega" ? "Entrega" : `Publica${it.time ? ` ${it.time}` : ""}`} · {it.sub}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )) : <p className="card px-6 py-8 text-center text-muted">No hay entregas ni publicaciones este mes.</p>}
      </div>
      <p className="text-xs text-muted">Para programar una publicación, abre la orden y usa “Programar publicación” en la tarea.</p>
    </div>
  );
}
