import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, orders, users, comments, statusChanges, tasks, payments, costs, suppliers, approvalLinks } from "@/db";
import { requireUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { canManage, canSeeMoney, isDirector } from "@/lib/perm";
import {
  STATUSES, STATUS_LABEL, SERVICE_LABEL, STAGE_GROUPS, groupOf, fmtDateTime, fmtMoney, type Status,
} from "@/lib/labels";
import { moveOrderForm, addComment, registerClientChange, raiseUrgency } from "@/app/actions/orders";
import { createTask } from "@/app/actions/tasks";
import TaskCard from "@/components/TaskCard";
import { PaymentForm, CostForm } from "@/components/MoneyForms";
import { moneyByOrder } from "@/lib/finance";
import { usd, money, fmtDay, todayCaracas, PAYMENT_METHODS } from "@/lib/money";
import { deletePayment, deleteCost, markCostPaid } from "@/app/actions/finance";
import { createApprovalLink, cancelApprovalLink } from "@/app/actions/client-links";
import { baseUrl } from "@/lib/url";
import CopyLink from "@/components/CopyLink";

export const dynamic = "force-dynamic";
const TZ = "America/Caracas";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { number: true, title: true } }).catch(() => null);
  return { title: o ? `#${o.number} ${o.title}` : "Orden" };
}

// El siguiente paso más común según la etapa actual.
function quickMoves(s: Status, director: boolean, owner: string | null, rounds: string): { to: Status; label: string; primary?: boolean }[] {
  switch (s) {
    case "RECIBIDO": return [{ to: "BRIEF_REVISION", label: "Revisar brief", primary: true }];
    case "BRIEF_REVISION": return [{ to: "EN_PRODUCCION", label: "Pasar a producción", primary: true }];
    case "EN_PRODUCCION": return [{ to: "REVISION_INTERNA", label: "Enviar a revisión interna", primary: true }];
    case "REVISION_INTERNA": return director
      ? [{ to: "ENVIADO_CLIENTE", label: "Aprobar y enviar al cliente", primary: true }, { to: "EN_PRODUCCION", label: owner ? `Pedir cambios a ${owner}` : "Pedir cambios" }]
      : [];
    case "ENVIADO_CLIENTE": return [{ to: "APROBADO", label: "El cliente aprobó", primary: true }, { to: "AJUSTES", label: `El cliente pidió cambios (${rounds})` }];
    case "AJUSTES": return [{ to: "REVISION_INTERNA", label: "Ajustes listos: a revisión interna", primary: true }];
    case "APROBADO": return [{ to: "ENTREGADO", label: "Marcar publicado o entregado", primary: true }];
    case "ENTREGADO": return [{ to: "FACTURADO", label: "Marcar facturado", primary: true }];
    case "FACTURADO": return [{ to: "PAGO_PROVEEDORES", label: "Proveedores pagados: cerrar orden", primary: true }];
    default: return [];
  }
}

const AVATAR = ["bg-cyan text-ink", "bg-yellow text-ink", "bg-bad text-white", "bg-ink text-paper"];
const avatarTone = (name: string) => AVATAR[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
const initials = (name: string) => name.replace(/\(.*?\)/g, "").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const longDate = (d: Date | null) => d ? d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }) : "Sin fecha";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  if (!(await canAccessOrder(u, id))) notFound();

  const o = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { client: true, owner: true } });
  if (!o) notFound();
  const [taskRows, commentRows, history, people] = await Promise.all([
    db.query.tasks.findMany({ where: eq(tasks.orderId, id), with: { assignee: true }, orderBy: [asc(tasks.createdAt)] }),
    db.query.comments.findMany({ where: eq(comments.orderId, id), with: { author: true }, orderBy: [asc(comments.createdAt)] }),
    db.query.statusChanges.findMany({ where: eq(statusChanges.orderId, id), with: { user: true }, orderBy: [desc(statusChanges.createdAt)] }),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ]);

  const seeMoney = canSeeMoney(u.role);
  const [payRows, costRows, supplierList, moneyMap]: [
    (typeof payments.$inferSelect)[],
    ((typeof costs.$inferSelect) & { supplier: (typeof suppliers.$inferSelect) | null })[],
    { id: string; name: string; kind: string }[],
    Awaited<ReturnType<typeof moneyByOrder>>,
  ] = seeMoney
    ? await Promise.all([
        db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.paidOn)),
        db.query.costs.findMany({ where: eq(costs.orderId, id), with: { supplier: true }, orderBy: [asc(costs.createdAt)] }),
        db.select({ id: suppliers.id, name: suppliers.name, kind: suppliers.kind }).from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.name)),
        moneyByOrder([{ id: o.id, budget: o.budget, currency: o.currency }]),
      ])
    : [[], [], [], new Map()];
  const om = moneyMap.get(id);
  const links = u.role === "FREELANCER" ? [] : await db.select().from(approvalLinks).where(eq(approvalLinks.orderId, id)).orderBy(desc(approvalLinks.createdAt));
  const activeLink = links.find((l) => l.status === "PENDIENTE");
  const base = await baseUrl();
  const manager = canManage(u.role);
  const freelancer = u.role === "FREELANCER";
  const idx = STATUSES.indexOf(o.status);
  const current = groupOf(o.status);
  const currentGroupIdx = STAGE_GROUPS.findIndex((g) => g.key === current.key);
  const withinGroup = (current.statuses as readonly string[]).indexOf(o.status);
  const ownerFirst = o.owner?.name.split(" ")[0] ?? null;
  const roundsText = `ronda ${o.revisionRoundsUsed + 1} de ${o.revisionRoundsIncluded}`;
  const moves = freelancer ? [] : quickMoves(o.status, isDirector(u.role), ownerFirst, roundsText);
  const visibleTasks = freelancer ? taskRows.filter((t) => t.assigneeId === u.id) : taskRows;
  const late = o.dueDate && o.dueDate < new Date() && idx < STATUSES.indexOf("ENTREGADO");
  const overRounds = o.revisionRoundsUsed > o.revisionRoundsIncluded;

  return (
    <div className="grid gap-7">
      <header className="grid gap-3.5">
        <Link href={freelancer ? "/tareas" : "/ordenes"} className="eyebrow w-fit hover:text-ink">← {freelancer ? "Mis tareas" : "Tablero"} · orden #{o.number}</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <h1 className="h1">{o.title}</h1>
            <p className="text-base text-muted">
              {manager ? <Link href={`/clientes/${o.clientId}`} className="font-semibold text-ink underline decoration-2 underline-offset-2">{o.client.name}</Link> : o.client.name}
              {" · "}{SERVICE_LABEL[o.serviceType]}
              {" · "}{late ? <b className="text-bad">venció el {longDate(o.dueDate)}</b> : <>entrega <b className="text-ink">{longDate(o.dueDate)}</b></>}
              {o.priority === "URGENTE" && <span className="tag ml-2 bg-magenta text-white align-middle">Urgente</span>}
            </p>
          </div>
          {manager && <Link href={`/ordenes/${id}/editar`} className="btn">Editar</Link>}
        </div>
      </header>

      {error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{error}</p>}

      <section aria-label="Etapa de la orden" className="card grid gap-5 px-6 py-6">
        <div className="grid grid-cols-4 gap-1.5">
          {STAGE_GROUPS.map((g, gi) => {
            const done = gi < currentGroupIdx;
            const isCur = gi === currentGroupIdx;
            const pct = isCur ? ((withinGroup + 1) / g.statuses.length) * 100 : done ? 100 : 0;
            return (
              <div key={g.key} className="grid gap-2">
                <span className={`relative h-2.5 overflow-hidden rounded-full ${g.soft}`}>
                  <span className={`absolute inset-y-0 left-0 rounded-full ${g.bar}`} style={{ width: `${pct}%` }} />
                </span>
                <span className={`text-[13px] leading-tight ${isCur ? "font-bold" : "text-muted"}`}>
                  {g.label}{isCur && <span className="hidden sm:inline"> · {STATUS_LABEL[o.status].toLowerCase()}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-sm font-bold sm:hidden">Ahora: {STATUS_LABEL[o.status]}</p>
        {!freelancer && (
          <div className="flex flex-wrap items-center gap-3">
            {moves.map((m) => (
              <form key={m.to} action={moveOrderForm.bind(null, id)}>
                <input type="hidden" name="to" value={m.to} />
                <button className={m.primary ? "btn-primary px-6 py-3 text-[15px]" : "btn px-5 py-2.5 text-[15px]"}>{m.label}</button>
              </form>
            ))}
            {o.status === "REVISION_INTERNA" && !isDirector(u.role) && <p className="text-sm text-muted">Esperando la aprobación de dirección.</p>}
            {o.status === "PAGO_PROVEEDORES" && <p className="text-sm font-semibold">Orden cerrada.</p>}
            <span className={`ml-auto font-mono text-[13px] ${overRounds ? "font-semibold text-bad" : "text-muted"}`}>
              Rondas del cliente: {o.revisionRoundsUsed} de {o.revisionRoundsIncluded}{overRounds && " · se pasó del límite"}
            </span>
          </div>
        )}
        {!freelancer && (
          <details className="text-sm">
            <summary className="w-fit cursor-pointer text-muted underline decoration-dotted underline-offset-4 hover:text-ink">Mover a otra etapa</summary>
            <form action={moveOrderForm.bind(null, id)} className="mt-3 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="to">Etapa</label>
              <select id="to" name="to" defaultValue={o.status} className="input w-auto">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <label className="sr-only" htmlFor="note">Motivo</label>
              <input id="note" name="note" placeholder="Motivo (opcional)" className="input w-56" />
              <button className="btn">Mover</button>
            </form>
          </details>
        )}
      </section>

      {!freelancer && (o.status === "ENVIADO_CLIENTE" || links.length > 0) && (
        <section id="cliente" aria-labelledby="cliente-t" className="card grid scroll-mt-24 gap-4 px-6 py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="cliente-t" className="h2">Aprobación del cliente</h2>
            <span className="text-sm text-muted">El cliente responde desde un enlace, sin cuenta</span>
          </div>
          {o.status === "ENVIADO_CLIENTE" && (activeLink ? (
            <div className="grid gap-3 rounded-2xl bg-yellow/30 p-4">
              <p className="text-sm"><b>Enlace listo (ronda {activeLink.round}).</b> Envíaselo al cliente desde el WhatsApp o el correo de la empresa. Cuando responda, la orden cambia de etapa sola y te avisamos.</p>
              <CopyLink url={`${base}/aprobar/${activeLink.token}`} />
              <form action={cancelApprovalLink.bind(null, activeLink.id, id)}><button className="text-xs text-muted hover:text-bad">Anular este enlace</button></form>
            </div>
          ) : (
            <form action={createApprovalLink.bind(null, id)} className="grid gap-3 rounded-2xl bg-canvas p-4">
              <div><label className="label" htmlFor="pieceUrl">Enlace a la pieza (Drive, Dropbox, imagen…)</label><input id="pieceUrl" name="pieceUrl" type="url" placeholder="https://drive.google.com/…" className="input" /></div>
              <div><label className="label" htmlFor="message">Mensaje para el cliente (opcional)</label><textarea id="message" name="message" rows={2} placeholder="Ej.: Aquí está la versión final del banner. ¿Nos confirmas?" className="input" /></div>
              <div><button className="btn-primary">Crear enlace de aprobación</button></div>
            </form>
          ))}
          {links.filter((l) => l.status !== "PENDIENTE").length > 0 && (
            <ul className="grid gap-1.5 text-sm">
              {links.filter((l) => l.status !== "PENDIENTE").map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-4 py-2.5">
                  <span className={`tag py-0.5 ${l.status === "APROBADO" ? "bg-yellow text-ink" : l.status === "CAMBIOS" ? "bg-bad text-white" : "bg-ink/10 text-ink"}`}>{l.status === "APROBADO" ? "Aprobó" : l.status === "CAMBIOS" ? "Pidió cambios" : "Anulado"}</span>
                  <span className="min-w-0 flex-1">Ronda {l.round}{l.clientName ? ` · ${l.clientName}` : ""}{l.clientComment ? ` · “${l.clientComment.slice(0, 80)}${l.clientComment.length > 80 ? "…" : ""}”` : ""}</span>
                  <span className="font-mono text-[13px] text-muted">{fmtDateTime(l.respondedAt ?? l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="grid min-w-0 flex-[999_1_420px] gap-5">
          <section aria-labelledby="brief" className="card grid gap-3 px-6 py-6">
            <h2 id="brief" className="h2">Brief</h2>
            {o.brief ? <p className="max-w-[62ch] whitespace-pre-line text-[15px] leading-relaxed">{o.brief}</p> : <p className="text-muted">Todavía no hay brief.</p>}
            {o.copy && <div className="grid gap-1"><p className="label">Copy / textos</p><p className="max-w-[62ch] whitespace-pre-line text-[15px]">{o.copy}</p></div>}
            {(o.platform || o.formats) && <p className="font-mono text-[13px] text-muted">{[o.platform, o.formats].filter(Boolean).join(" · ")}</p>}
            {o.referenceLinks && (
              <ul className="grid gap-1 text-sm">{o.referenceLinks.split(/\s+/).filter(Boolean).map((l, i) => (
                <li key={i} className="truncate">{/^https?:\/\//.test(l) ? <a href={l} target="_blank" rel="noreferrer" className="font-semibold underline">{l}</a> : l}</li>
              ))}</ul>
            )}
          </section>

          <section id="tareas" aria-labelledby="tareas-t" className="card grid scroll-mt-24 gap-3.5 px-6 py-6">
            <div className="flex items-baseline justify-between">
              <h2 id="tareas-t" className="h2">Tareas</h2>
              <span className="font-mono text-[13px] text-muted">{visibleTasks.filter((t) => t.status === "LISTA").length} de {visibleTasks.length} listas</span>
            </div>
            {visibleTasks.length ? (
              <ul className="grid gap-2.5">
                {visibleTasks.map((t) => (
                  <TaskCard key={t.id} canDelete={manager} t={{
                    id: t.id, title: t.title, notes: t.notes, status: t.status, dueDate: t.dueDate?.toISOString() ?? null,
                    checklist: t.checklist, assignee: t.assignee?.name ?? null, mine: t.assigneeId === u.id,
                  }} />
                ))}
              </ul>
            ) : <p className="text-muted">Esta orden todavía no tiene tareas.</p>}
            {!freelancer && (
              <details className="group">
                <summary className="w-fit cursor-pointer font-bold hover:underline">+ Agregar tarea</summary>
                <form action={createTask.bind(null, id)} className="mt-4 grid gap-3 rounded-2xl bg-canvas p-4">
                  <div><label className="label" htmlFor="t-title">Tarea</label><input id="t-title" name="title" required placeholder="Ej.: Arte final para imprenta" className="input" /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="t-assignee">Responsable</label>
                      <select id="t-assignee" name="assigneeId" className="input" defaultValue="">
                        <option value="">Sin asignar</option>
                        {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role === "FREELANCER" ? " (freelancer)" : ""}</option>)}
                      </select>
                    </div>
                    <div><label className="label" htmlFor="t-due">Fecha límite</label><input id="t-due" name="dueDate" type="date" className="input" /></div>
                  </div>
                  <div><label className="label" htmlFor="t-check">Pasos, uno por línea (opcional)</label><textarea id="t-check" name="checklist" rows={3} className="input" placeholder={"Boceto\nVersión final\nExportar formatos"} /></div>
                  <div><label className="label" htmlFor="t-notes">Notas</label><textarea id="t-notes" name="notes" rows={2} className="input" /></div>
                  <p className="text-xs text-muted">Si se la asignas a un freelancer, tendrá que aceptarla antes de empezar.</p>
                  <div><button className="btn-primary">Agregar tarea</button></div>
                </form>
              </details>
            )}
          </section>

          {seeMoney && om && (
            <section id="dinero" aria-labelledby="dinero-t" className="card grid scroll-mt-24 gap-5 px-6 py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="dinero-t" className="h2">Dinero</h2>
                <span className="text-sm text-muted">Montos en USD</span>
              </div>
              {!o.budget && <p className="rounded-[14px] bg-yellow/30 px-4 py-3 text-sm">Esta orden no tiene precio. <Link href={`/ordenes/${id}/editar`} className="font-bold underline">Agrégalo</Link> para calcular lo que falta por cobrar y el margen.</p>}
              <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Fig label="Precio" value={usd(om.price)} />
                <Fig label="Cobrado" value={usd(om.collected)} />
                <Fig label="Por cobrar" value={usd(om.pending)} strong={om.pending > 0} />
                <Fig label={`Margen${om.price ? ` · ${Math.round((om.margin / om.price) * 100)}%` : ""}`} value={usd(om.margin)} bad={om.margin < 0} />
              </dl>

              <div className="grid gap-2">
                <h3 className="eyebrow">Cobros</h3>
                {payRows.length ? (
                  <ul className="grid gap-1.5 text-sm">
                    {payRows.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-4 py-2.5">
                        <span className="font-mono text-[13px]">{fmtDay(p.paidOn)}</span>
                        <span className="min-w-0 flex-1">{p.method}{p.reference && <span className="text-muted"> · Ref. {p.reference}</span>}</span>
                        <span className="font-mono font-semibold">{money(p.amount, p.currency)}</span>
                        <form action={deletePayment.bind(null, p.id, `/ordenes/${id}#dinero`)}><button className="text-xs text-muted hover:text-bad" aria-label="Eliminar cobro">✕</button></form>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">Todavía no hay cobros.</p>}
                <details>
                  <summary className="w-fit cursor-pointer text-sm font-bold hover:underline">+ Registrar cobro</summary>
                  <div className="mt-3 rounded-2xl bg-canvas p-4"><PaymentForm back={`/ordenes/${id}#dinero`} orderId={id} /></div>
                </details>
              </div>

              <div className="grid gap-2">
                <h3 className="eyebrow">Costos: proveedores, freelancers y gastos</h3>
                {costRows.length ? (
                  <ul className="grid gap-1.5 text-sm">
                    {costRows.map((c) => (
                      <li key={c.id} className="grid gap-2 rounded-xl bg-canvas px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`tag py-0.5 ${c.status === "PAGADO" ? "bg-ink text-paper" : "bg-yellow text-ink"}`}>{c.status === "PAGADO" ? "Pagado" : "Por pagar"}</span>
                          <span className="min-w-0 flex-1">{c.concept}{c.supplier && <span className="text-muted"> · {c.supplier.name}</span>}</span>
                          <span className="font-mono font-semibold">{money(c.amount, c.currency)}</span>
                        </div>
                        {c.status === "PENDIENTE" ? (
                          <details>
                            <summary className="w-fit cursor-pointer text-xs font-bold underline decoration-dotted underline-offset-4">Marcar como pagado</summary>
                            <form action={markCostPaid.bind(null, c.id)} className="mt-2 flex flex-wrap items-end gap-2">
                              <input type="hidden" name="back" value={`/ordenes/${id}#dinero`} />
                              <input name="date" type="date" defaultValue={todayCaracas()} className="input w-40" aria-label="Fecha de pago" />
                              <select name="method" className="input w-40" aria-label="Método">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
                              <input name="reference" placeholder="Referencia" className="input w-36" aria-label="Referencia" />
                              <button className="btn btn-sm">Guardar</button>
                              <button formAction={deleteCost.bind(null, c.id, `/ordenes/${id}#dinero`)} className="ml-auto text-xs text-muted hover:text-bad">Eliminar</button>
                            </form>
                          </details>
                        ) : <p className="text-xs text-muted">Pagado el {fmtDay(c.paidOn)}{c.method ? ` · ${c.method}` : ""}{c.reference ? ` · Ref. ${c.reference}` : ""}</p>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">Sin costos registrados.</p>}
                <details>
                  <summary className="w-fit cursor-pointer text-sm font-bold hover:underline">+ Agregar costo</summary>
                  <div className="mt-3 rounded-2xl bg-canvas p-4"><CostForm back={`/ordenes/${id}#dinero`} orderId={id} suppliers={supplierList} /></div>
                </details>
              </div>
            </section>
          )}

          <section id="comentarios" aria-labelledby="conv" className="card grid scroll-mt-24 gap-4 px-6 py-6">
            <h2 id="conv" className="h2">Conversación</h2>
            {commentRows.length ? (
              <ul className="grid gap-4">
                {commentRows.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <span className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[13px] font-bold ${avatarTone(c.author.name)}`} aria-hidden="true">{initials(c.author.name)}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-muted">
                        <b className="text-ink">{c.author.name}</b> · {fmtDateTime(c.createdAt)}
                        {c.kind === "urgencia" && <span className="tag ml-2 bg-magenta py-0.5 text-white">Urgencia</span>}
                        {c.kind === "cambio_cliente" && <span className="tag ml-2 bg-bad py-0.5 text-white">Cambio del cliente</span>}
                      </p>
                      <p className="whitespace-pre-line text-[15px]">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted">Todavía no hay mensajes. Las dudas sobre esta orden se hablan aquí, no por WhatsApp.</p>}
            <form action={addComment.bind(null, id)} className="flex flex-wrap items-end gap-2.5">
              <label className="sr-only" htmlFor="body">Mensaje</label>
              <textarea id="body" name="body" rows={1} required className="input min-h-[48px] flex-[1_1_260px] rounded-[24px] px-5 py-3" placeholder="Escribe aquí. Usa @nombre para avisar a alguien." />
              <button className="btn-primary h-12 px-6">Enviar</button>
            </form>
          </section>
        </div>

        <aside className="grid min-w-0 flex-[1_1_260px] gap-4">
          <section aria-label="Datos de la orden" className="card-ink grid gap-4 p-6 text-sm">
            <Datum label="Responsable">{o.owner?.name ?? "Sin asignar"}</Datum>
            <Datum label="Entrega"><span className={late ? "text-[#FF6BB5]" : ""}>{longDate(o.dueDate)}</span></Datum>
            {canSeeMoney(u.role) && (
              <>
                <Datum label="Presupuesto"><span className="font-mono text-[22px] font-semibold text-yellow">{fmtMoney(o.budget, o.currency)}</span></Datum>
                <Datum label="Factura">{o.invoiceNumber ?? "Sin factura"}</Datum>
              </>
            )}
            {o.isRecurring && <Datum label="Tipo">Recurrente (iguala)</Datum>}
            {o.internalNotes && !freelancer && <Datum label="Notas internas"><span className="whitespace-pre-line text-[15px] font-normal">{o.internalNotes}</span></Datum>}
            {!freelancer && (
              <details>
                <summary className="w-fit cursor-pointer text-canvas/70 underline decoration-dotted underline-offset-4 hover:text-canvas">Ver historial de cambios</summary>
                <ul className="mt-3 grid gap-2.5 text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="grid gap-0.5">
                      <span><b>{h.user.name}</b> {h.from ? <>movió a <b className="text-yellow">{STATUS_LABEL[h.to]}</b></> : "creó la orden"}</span>
                      <span className="text-canvas/60">{fmtDateTime(h.createdAt)}{h.note && h.from ? ` · ${h.note}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {!freelancer && (
            <>
              <details className="card group overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-bold">Registrar cambio del cliente <span aria-hidden="true" className="transition-transform group-open:rotate-90">→</span></summary>
                <form action={registerClientChange.bind(null, id)} className="grid gap-2.5 px-5 pb-5">
                  <label className="sr-only" htmlFor="chg">Qué pidió el cliente</label>
                  <textarea id="chg" name="body" rows={3} required className="input" placeholder="Lo que pidió el cliente, aunque haya sido en persona o por llamada" />
                  <p className="text-xs text-muted">Crea una tarea para {ownerFirst ?? "el responsable"} y le avisa.</p>
                  <div><button className="btn-primary">Registrar cambio</button></div>
                </form>
              </details>
              <details className="group overflow-hidden rounded-[18px] bg-magenta text-white">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-bold">Reportar una urgencia <span aria-hidden="true" className="transition-transform group-open:rotate-90">→</span></summary>
                <form action={raiseUrgency.bind(null, id)} className="grid gap-2.5 px-5 pb-5">
                  <label className="sr-only" htmlFor="urg">Qué pasó</label>
                  <textarea id="urg" name="body" rows={3} required className="input border-white" placeholder="Qué pasó" />
                  <p className="text-xs text-white/85">Avisa de inmediato a dirección, que decide a qué área va.</p>
                  <div><button className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-bad hover:bg-white/90">Avisar a dirección</button></div>
                </form>
              </details>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fig({ label, value, strong, bad }: { label: string; value: string; strong?: boolean; bad?: boolean }) {
  return (
    <div className={`grid gap-0.5 rounded-[14px] px-4 py-3 ${strong ? "bg-yellow" : "bg-canvas"}`}>
      <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd className={`font-mono text-base font-semibold tabular ${bad ? "text-bad" : ""}`}>{value}</dd>
    </div>
  );
}

function Datum({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-canvas/60">{label}</span>
      <span className="text-base font-bold">{children}</span>
    </div>
  );
}
