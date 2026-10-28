import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, clients, orders, payments, retainers } from "@/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, SERVICE_LABEL } from "@/lib/labels";
import { usd, money } from "@/lib/money";
import { moneyByOrder } from "@/lib/finance";
import { baseUrl } from "@/lib/url";
import { enableRequestLink, disableRequestLink } from "@/app/actions/client-links";
import StatusBadge from "@/components/StatusBadge";
import CopyLink from "@/components/CopyLink";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { id } = await params;
  const c = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!c) notFound();
  const [list, [paid], deals, base] = await Promise.all([
    db.select().from(orders).where(eq(orders.clientId, id)).orderBy(desc(orders.number)),
    db.select({ t: sql<string>`coalesce(sum(${payments.amountUsd}), 0)` }).from(payments).where(eq(payments.clientId, id)),
    db.select().from(retainers).where(and(eq(retainers.clientId, id), eq(retainers.active, true))),
    baseUrl(),
  ]);
  const mm = await moneyByOrder(list.filter((o) => ["APROBADO", "ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES"].includes(o.status) && o.budget));
  const pending = [...mm.values()].reduce((a, m) => a + m.pending, 0);
  const D = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><p className="label mb-0.5">{label}</p><div className="whitespace-pre-line break-words text-sm">{children || "—"}</div></div>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <Link href="/clientes" className="eyebrow w-fit hover:text-ink">← Clientes</Link>
          <h1 className="h1">{c.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/clientes/${id}/editar`} className="btn">Editar</Link>
          <Link href={`/finanzas/cotizaciones/nueva?cliente=${id}`} className="btn">Cotizar</Link>
          <Link href={`/ordenes/nueva?cliente=${id}`} className="btn-primary">+ Nueva orden</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
        <div className="card grid gap-1 border-t-[6px] border-cyan px-5 py-4"><span className="font-mono text-xl font-semibold">{usd(paid.t)}</span><span className="text-xs text-muted sm:text-sm">cobrado en total</span></div>
        <div className="card grid gap-1 border-t-[6px] border-magenta px-5 py-4"><span className="font-mono text-xl font-semibold">{usd(pending)}</span><span className="text-xs text-muted sm:text-sm">por cobrar</span></div>
        <div className="card col-span-2 grid gap-1 border-t-[6px] border-yellow px-5 py-4 sm:col-span-1">
          {deals.length ? deals.map((r) => <span key={r.id} className="text-sm"><b className="font-mono">{money(r.amount, r.currency)}</b>/mes · {r.title}</span>) : <span className="text-sm text-muted">Sin iguala activa</span>}
          <Link href={`/finanzas/igualas${deals.length ? "" : `?cliente=${id}`}`} className="text-xs font-semibold underline">{deals.length ? "Ver igualas" : "Crear iguala"}</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <section className="card grid content-start gap-3 p-6">
            <D label="Contacto">{[c.contactName, c.contactPhone, c.contactEmail].filter(Boolean).join("\n")}</D>
            <D label="RIF">{c.taxId}</D>
            <D label="Renovación">{c.renewalDate ? fmtDate(c.renewalDate) : null}</D>
            <D label="Manual de marca">{c.brandManualUrl ? <a href={c.brandManualUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Abrir</a> : null}</D>
            <D label="Contrato y servicios">{c.contractNotes}</D>
            <D label="Redes">{c.socialNotes}</D>
            <D label="Notas">{c.notes}</D>
          </section>
          <section id="pedidos" aria-labelledby="pedidos-t" className="card grid scroll-mt-24 gap-3 p-6">
            <h2 id="pedidos-t" className="h2">Enlace de pedidos</h2>
            <p className="text-sm text-muted">El cliente hace sus pedidos con un formulario corto, sin cuenta. Cada pedido llega como orden nueva y te avisamos.</p>
            {c.requestToken ? (
              <>
                <CopyLink url={`${base}/pedido/${c.requestToken}`} />
                <form action={disableRequestLink.bind(null, id)}><button className="text-xs text-muted hover:text-bad">Desactivar enlace</button></form>
              </>
            ) : <form action={enableRequestLink.bind(null, id)}><button className="btn-primary">Crear enlace de pedidos</button></form>}
          </section>
        </div>

        <section className="card grid min-w-0 content-start gap-3 p-6">
          <h2 className="h2">Órdenes</h2>
          {list.length ? (
            <ul className="grid gap-1">
              {list.map((o) => (
                <li key={o.id}>
                  <Link href={`/ordenes/${o.id}`} className="flex flex-wrap items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
                    <span className="font-mono text-xs text-muted tabular">#{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{o.title} <span className="text-muted">· {SERVICE_LABEL[o.serviceType]}</span></span>
                    <StatusBadge status={o.status} />
                    <span className="w-16 text-right font-mono text-xs text-muted tabular">{fmtDate(o.dueDate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Sin órdenes todavía.</p>}
        </section>
      </div>
    </div>
  );
}
