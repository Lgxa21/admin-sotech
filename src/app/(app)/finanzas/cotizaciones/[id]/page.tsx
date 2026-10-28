import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, quotes, quoteItems, clients } from "@/db";
import { money, fmtDay } from "@/lib/money";
import { SERVICES, SERVICE_LABEL, QUOTE_STATUS } from "@/lib/labels";
import { saveQuote, setQuoteStatus, convertQuote, deleteQuote } from "@/app/actions/quotes";
import QuoteForm from "@/components/QuoteForm";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const q = await db.query.quotes.findFirst({ where: eq(quotes.id, id), with: { client: true, items: { orderBy: [asc(quoteItems.position)] } } });
  if (!q) notFound();
  const total = q.items.reduce((a, it) => a + Number(it.qty) * Number(it.unitPrice), 0);
  const st = QUOTE_STATUS[q.status];

  if (sp.editar && !q.orderId) {
    const list = await db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name));
    return (
      <div className="grid gap-4">
        <h2 className="h2 text-[22px]">Editar cotización C-{q.number}</h2>
        <QuoteForm action={saveQuote.bind(null, id)} clients={list} values={{ ...q, items: q.items }} submit="Guardar cambios" cancelHref={`/finanzas/cotizaciones/${id}`} />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Link href="/finanzas/cotizaciones" className="eyebrow w-fit hover:text-ink">← Cotizaciones</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <p className="font-mono text-[13px] text-muted">C-{q.number} · {q.client.name}</p>
          <h2 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em]" style={{ fontStretch: "112%" }}>{q.title}</h2>
          <div className="flex flex-wrap items-center gap-2"><span className={`tag ${st.tone}`}>{st.label}</span>{q.validUntil && <span className="text-sm text-muted">Válida hasta {fmtDay(q.validUntil)}</span>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/cotizacion/${id}`} target="_blank" className="btn">Ver para imprimir o PDF</Link>
          {!q.orderId && <Link href={`/finanzas/cotizaciones/${id}?editar=1`} className="btn">Editar</Link>}
        </div>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
            <tr className="border-b border-line"><th className="px-6 py-3 font-semibold">Descripción</th><th className="px-2 text-right font-semibold">Cant.</th><th className="px-2 text-right font-semibold">Precio</th><th className="px-6 text-right font-semibold">Subtotal</th></tr>
          </thead>
          <tbody>
            {q.items.map((it) => (
              <tr key={it.id} className="border-b border-line">
                <td className="px-6 py-3">{it.description}</td>
                <td className="px-2 text-right font-mono tabular">{Number(it.qty).toLocaleString("es-VE")}</td>
                <td className="px-2 text-right font-mono tabular">{money(it.unitPrice, q.currency)}</td>
                <td className="px-6 text-right font-mono tabular">{money(Number(it.qty) * Number(it.unitPrice), q.currency)}</td>
              </tr>
            ))}
            <tr><td colSpan={3} className="px-6 py-4 text-right font-bold">Total</td><td className="px-6 text-right font-mono text-lg font-semibold tabular">{money(total, q.currency)}</td></tr>
          </tbody>
        </table>
      </section>
      {q.notes && <p className="card whitespace-pre-line px-6 py-5 text-sm">{q.notes}</p>}

      {q.orderId ? (
        <p className="card-ink flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <span className="font-bold">Aprobada y convertida en orden.</span>
          <Link href={`/ordenes/${q.orderId}`} className="rounded-full bg-yellow px-5 py-2.5 text-sm font-bold text-ink">Ver la orden</Link>
        </p>
      ) : (
        <section className="card grid gap-4 px-6 py-6">
          <h3 className="h2">¿Qué dijo el cliente?</h3>
          <form action={convertQuote.bind(null, id)} className="flex flex-wrap items-end gap-2">
            <div><label className="label" htmlFor="serviceType">Tipo de servicio de la orden</label>
              <select id="serviceType" name="serviceType" className="input w-56">{SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}</select>
            </div>
            <button className="btn-primary">Aprobó: crear la orden</button>
          </form>
          <div className="flex flex-wrap gap-2 text-sm">
            {q.status !== "ENVIADA" && <form action={setQuoteStatus.bind(null, id, "ENVIADA")}><button className="btn btn-sm">Marcar como enviada</button></form>}
            {q.status !== "RECHAZADA" && <form action={setQuoteStatus.bind(null, id, "RECHAZADA")}><button className="btn btn-sm">La rechazó</button></form>}
            {q.status === "RECHAZADA" && <form action={setQuoteStatus.bind(null, id, "BORRADOR")}><button className="btn btn-sm">Volver a borrador</button></form>}
            <form action={deleteQuote.bind(null, id)} className="ml-auto"><button className="text-xs text-muted hover:text-bad">Eliminar cotización</button></form>
          </div>
        </section>
      )}
    </div>
  );
}
