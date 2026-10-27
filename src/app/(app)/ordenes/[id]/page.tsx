import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, orders, users, comments, statusChanges, tasks } from "@/db";
import { requireUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/access";
import { canManage, canSeeMoney, isDirector } from "@/lib/perm";
import {
  STATUSES, STATUS_LABEL, SERVICE_LABEL, PRIORITY_LABEL, PRIORITY_TONE, fmtDate, fmtDateTime, fmtMoney, type Status,
} from "@/lib/labels";
import { moveOrderForm, addComment, registerClientChange, raiseUrgency } from "@/app/actions/orders";
import { createTask } from "@/app/actions/tasks";
import StatusBadge from "@/components/StatusBadge";
import TaskCard from "@/components/TaskCard";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { number: true, title: true } }).catch(() => null);
  return { title: o ? `#${o.number} ${o.title}` : "Orden" };
}

// Siguientes pasos más comunes según la etapa actual.
function quickMoves(s: Status, director: boolean, rounds: string): { to: Status; label: string; primary?: boolean }[] {
  switch (s) {
    case "RECIBIDO": return [{ to: "BRIEF_REVISION", label: "Revisar brief", primary: true }];
    case "BRIEF_REVISION": return [{ to: "EN_PRODUCCION", label: "Pasar a producción", primary: true }];
    case "EN_PRODUCCION": return [{ to: "REVISION_INTERNA", label: "Enviar a revisión interna", primary: true }];
    case "REVISION_INTERNA": return director
      ? [{ to: "ENVIADO_CLIENTE", label: "Aprobar y enviar al cliente", primary: true }, { to: "EN_PRODUCCION", label: "Pedir cambios" }]
      : [];
    case "ENVIADO_CLIENTE": return [{ to: "APROBADO", label: "El cliente aprobó", primary: true }, { to: "AJUSTES", label: `El cliente pidió cambios (${rounds})` }];
    case "AJUSTES": return [{ to: "REVISION_INTERNA", label: "Ajustes listos: a revisión interna", primary: true }];
    case "APROBADO": return [{ to: "ENTREGADO", label: "Marcar publicado / entregado", primary: true }];
    case "ENTREGADO": return [{ to: "FACTURADO", label: "Marcar facturado", primary: true }];
    case "FACTURADO": return [{ to: "PAGO_PROVEEDORES", label: "Proveedores pagados: cerrar", primary: true }];
    default: return [];
  }
}

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

  const manager = canManage(u.role);
  const freelancer = u.role === "FREELANCER";
  const idx = STATUSES.indexOf(o.status);
  const nextRound = o.revisionRoundsUsed + 1;
  const roundsText = `ronda ${nextRound} de ${o.revisionRoundsIncluded}`;
  const moves = freelancer ? [] : quickMoves(o.status, isDirector(u.role), roundsText);
  const visibleTasks = freelancer ? taskRows.filter((t) => t.assigneeId === u.id) : taskRows;
  const late = o.dueDate && o.dueDate < new Date() && idx < STATUSES.indexOf("ENTREGADO");

  return (
    <div className="grid gap-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            <Link href="/ordenes" className="hover:text-ink">Órdenes</Link> / #{o.number}
          </p>
          <h1 className="h1 mt-1">{o.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={o.status} />
            <span className={PRIORITY_TONE[o.priority]}>Prioridad {PRIORITY_LABEL[o.priority].toLowerCase()}</span>
            <span className="text-muted">·</span>
            {manager ? <Link href={`/clientes/${o.clientId}`} className="text-accent">{o.client.name}</Link> : <span>{o.client.name}</span>}
            <span className="text-muted">· {SERVICE_LABEL[o.serviceType]}</span>
            <span className={late ? "text-bad font-semibold" : "text-muted"}>· {late ? "Vencida el " : "Entrega "}{fmtDate(o.dueDate)}</span>
          </div>
        </div>
        {manager && <Link href={`/ordenes/${id}/editar`} className="btn"><Icon name="edit" />Editar</Link>}
      </div>

      {error && <p role="alert" className="card border-bad/40 bg-bad/5 px-4 py-2 text-sm text-bad">{error}</p>}

      {/* Etapas */}
      <section className="card p-4 grid gap-4">
        <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Etapas de la orden">
          {STATUSES.map((s, i) => (
            <li key={s} className="min-w-[88px] flex-1">
              <span className={`block h-1.5 rounded-full ${i < idx ? "bg-accent/50" : i === idx ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 block text-[11px] leading-tight ${i === idx ? "font-semibold text-ink" : "text-muted"}`} aria-current={i === idx ? "step" : undefined}>{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
        {!freelancer && (
          <div className="flex flex-wrap items-center gap-2">
            {moves.map((m) => (
              <form key={m.to} action={moveOrderForm.bind(null, id)}>
                <input type="hidden" name="to" value={m.to} />
                <button className={m.primary ? "btn-primary" : "btn"}>{m.label}</button>
              </form>
            ))}
            {o.status === "REVISION_INTERNA" && !isDirector(u.role) && <p className="text-sm text-muted">Esperando la aprobación de dirección.</p>}
            <details className="ml-auto">
              <summary className="cursor-pointer text-sm text-muted hover:text-ink">Mover a otra etapa</summary>
              <form action={moveOrderForm.bind(null, id)} className="mt-2 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="to">Etapa</label>
                <select id="to" name="to" defaultValue={o.status} className="input w-auto">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <label className="sr-only" htmlFor="note">Motivo</label>
                <input id="note" name="note" placeholder="Motivo (opcional)" className="input w-56" />
                <button className="btn">Mover</button>
              </form>
            </details>
          </div>
        )}
        <p className={`text-xs ${o.revisionRoundsUsed > o.revisionRoundsIncluded ? "text-bad font-semibold" : "text-muted"}`}>
          Rondas de cambios del cliente: {o.revisionRoundsUsed} de {o.revisionRoundsIncluded} incluidas
          {o.revisionRoundsUsed > o.revisionRoundsIncluded && " (se pasó del límite)"}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5 min-w-0 content-start">
          <section className="card p-5 grid gap-3">
            <h2 className="h2">Brief</h2>
            {o.brief ? <p className="whitespace-pre-line text-sm">{o.brief}</p> : <p className="text-sm text-muted">Sin brief todavía.</p>}
            {o.copy && <Detail label="Copy / textos"><p className="whitespace-pre-line">{o.copy}</p></Detail>}
            <div className="grid gap-3 sm:grid-cols-2">
              {o.platform && <Detail label="Plataforma">{o.platform}</Detail>}
              {o.formats && <Detail label="Formatos y medidas">{o.formats}</Detail>}
            </div>
            {o.referenceLinks && (
              <Detail label="Referencias">
                <ul className="grid gap-1">{o.referenceLinks.split(/\s+/).filter(Boolean).map((l, i) => (
                  <li key={i} className="truncate">{/^https?:\/\//.test(l) ? <a href={l} target="_blank" rel="noreferrer" className="text-accent">{l}</a> : l}</li>
                ))}</ul>
              </Detail>
            )}
          </section>

          <section id="tareas" className="card p-5 grid gap-3 scroll-mt-20">
            <div className="flex items-baseline justify-between"><h2 className="h2">Tareas</h2><span className="text-xs text-muted tabular">{visibleTasks.filter((t) => t.status === "LISTA").length}/{visibleTasks.length} listas</span></div>
            {visibleTasks.length ? (
              <ul className="grid gap-2">
                {visibleTasks.map((t) => (
                  <TaskCard key={t.id} canDelete={manager} t={{
                    id: t.id, title: t.title, notes: t.notes, status: t.status, dueDate: t.dueDate?.toISOString() ?? null,
                    checklist: t.checklist, assignee: t.assignee?.name ?? null, mine: t.assigneeId === u.id,
                  }} />
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Esta orden todavía no tiene tareas.</p>}
            {!freelancer && (
              <details className="rounded-lg border border-dashed border-line p-3">
                <summary className="cursor-pointer text-sm font-medium text-accent">+ Agregar tarea</summary>
                <form action={createTask.bind(null, id)} className="mt-3 grid gap-3">
                  <div><label className="label" htmlFor="t-title">Tarea</label><input id="t-title" name="title" required placeholder="Ej.: Diseño de 4 piezas para feed" className="input" /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="t-assignee">Responsable</label>
                      <select id="t-assignee" name="assigneeId" className="input" defaultValue="">
                        <option value="">Sin asignar</option>
                        {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role === "FREELANCER" ? " (freelancer)" : ""}</option>)}
                      </select>
                    </div>
                    <div><label className="label" htmlFor="t-due">Fecha límite</label><input id="t-due" name="dueDate" type="date" className="input" /></div>
                  </div>
                  <div><label className="label" htmlFor="t-check">Pasos (uno por línea, opcional)</label><textarea id="t-check" name="checklist" rows={3} className="input" placeholder={"Boceto\nVersión final\nExportar formatos"} /></div>
                  <div><label className="label" htmlFor="t-notes">Notas</label><textarea id="t-notes" name="notes" rows={2} className="input" /></div>
                  <p className="text-xs text-muted">Si se la asignas a un freelancer, tendrá que aceptarla antes de empezar.</p>
                  <div><button className="btn-primary">Agregar tarea</button></div>
                </form>
              </details>
            )}
          </section>

          <section id="comentarios" className="card p-5 grid gap-4 scroll-mt-20">
            <h2 className="h2">Conversación</h2>
            {commentRows.length ? (
              <ul className="grid gap-3">
                {commentRows.map((c) => (
                  <li key={c.id} className={`rounded-lg p-3 text-sm ${c.kind === "urgencia" ? "bg-bad/10 border border-bad/30" : c.kind === "cambio_cliente" ? "bg-warn/10 border border-warn/30" : "bg-canvas"}`}>
                    <p className="mb-1 text-xs text-muted">
                      <span className="font-medium text-ink">{c.author.name}</span> · {fmtDateTime(c.createdAt)}
                      {c.kind === "urgencia" && <span className="ml-2 font-semibold text-bad">Urgencia</span>}
                      {c.kind === "cambio_cliente" && <span className="ml-2 font-semibold text-warn">Cambio pedido por el cliente</span>}
                    </p>
                    <p className="whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Todavía no hay mensajes. Las dudas sobre esta orden se hablan aquí, no por WhatsApp.</p>}
            <form action={addComment.bind(null, id)} className="grid gap-2">
              <label className="sr-only" htmlFor="body">Mensaje</label>
              <textarea id="body" name="body" rows={3} required className="input" placeholder="Escribe un mensaje. Usa @Nombre para avisarle a alguien." />
              <div><button className="btn-primary">Enviar</button></div>
            </form>
          </section>
        </div>

        <aside className="grid gap-5 content-start">
          <section className="card p-5 grid gap-3 text-sm">
            <h2 className="h2">Datos</h2>
            <Detail label="Responsable">{o.owner?.name ?? "Sin asignar"}</Detail>
            <Detail label="Solicitada">{fmtDate(o.requestedAt)}</Detail>
            <Detail label="Entrega">{fmtDate(o.dueDate)}</Detail>
            {o.isRecurring && <Detail label="Tipo">Recurrente (iguala)</Detail>}
            {canSeeMoney(u.role) && (
              <>
                <Detail label="Presupuesto">{fmtMoney(o.budget, o.currency)}</Detail>
                <Detail label="Factura">{o.invoiceNumber ?? "—"}</Detail>
              </>
            )}
            {o.internalNotes && !freelancer && <Detail label="Notas internas"><p className="whitespace-pre-line">{o.internalNotes}</p></Detail>}
          </section>

          {!freelancer && (
            <section className="card p-5 grid gap-4">
              <h2 className="h2">Acciones rápidas</h2>
              <details>
                <summary className="cursor-pointer text-sm font-medium">Registrar un cambio del cliente</summary>
                <form action={registerClientChange.bind(null, id)} className="mt-2 grid gap-2">
                  <label className="sr-only" htmlFor="chg">Qué pidió el cliente</label>
                  <textarea id="chg" name="body" rows={3} required className="input" placeholder="Lo que pidió el cliente, aunque haya sido en persona o por llamada" />
                  <p className="text-xs text-muted">Crea una tarea para el responsable y le avisa.</p>
                  <div><button className="btn">Registrar cambio</button></div>
                </form>
              </details>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-bad">Reportar una urgencia</summary>
                <form action={raiseUrgency.bind(null, id)} className="mt-2 grid gap-2">
                  <label className="sr-only" htmlFor="urg">Qué pasó</label>
                  <textarea id="urg" name="body" rows={3} required className="input" placeholder="Qué pasó" />
                  <p className="text-xs text-muted">Avisa de inmediato a dirección, que decide a qué área va.</p>
                  <div><button className="btn-danger">Avisar a dirección</button></div>
                </form>
              </details>
            </section>
          )}

          {!freelancer && (
            <section className="card p-5 grid gap-2">
              <h2 className="h2">Historial</h2>
              <ul className="grid gap-2 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="grid gap-0.5">
                    <span><span className="font-medium">{h.user.name}</span> {h.from ? <>movió a <b>{STATUS_LABEL[h.to]}</b></> : "creó la orden"}</span>
                    <span className="text-muted">{fmtDateTime(h.createdAt)}{h.note && h.from ? ` · ${h.note}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="text-sm"><p className="label mb-0.5">{label}</p><div>{children}</div></div>;
}
