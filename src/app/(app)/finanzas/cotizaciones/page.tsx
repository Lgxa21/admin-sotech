import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, quotes, quoteItems, clients } from "@/db";
import { money, fmtDay } from "@/lib/money";
import { QUOTE_STATUS } from "@/lib/labels";

export const metadata = { title: "Cotizaciones" };
export const dynamic = "force-dynamic";


export default async function Quotes() {
  const rows = await db.select({
    id: quotes.id, number: quotes.number, title: quotes.title, status: quotes.status, currency: quotes.currency, validUntil: quotes.validUntil,
    client: clients.name, orderId: quotes.orderId, total: sql<string>`coalesce(sum(${quoteItems.qty} * ${quoteItems.unitPrice}), 0)`,
  }).from(quotes).innerJoin(clients, eq(clients.id, quotes.clientId)).leftJoin(quoteItems, eq(quoteItems.quoteId, quotes.id))
    .groupBy(quotes.id, clients.name).orderBy(desc(quotes.number));
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><Link href="/finanzas/cotizaciones/nueva" className="btn-primary">+ Nueva cotización</Link></div>
      {rows.length ? (
        <ul className="grid gap-2.5">
          {rows.map((q) => {
            const st = QUOTE_STATUS[q.status];
            return (
              <li key={q.id}>
                <Link href={`/finanzas/cotizaciones/${q.id}`} className="card flex flex-wrap items-center gap-4 px-5 py-4 transition-transform hover:-translate-y-0.5">
                  <span className="font-mono text-[13px] text-muted">C-{q.number}</span>
                  <div className="min-w-0 flex-[1_1_220px]">
                    <p className="font-bold">{q.title}</p>
                    <p className="text-[13px] text-muted">{q.client}{q.validUntil && q.status === "ENVIADA" ? ` · válida hasta ${fmtDay(q.validUntil)}` : ""}{q.orderId ? " · convertida en orden" : ""}</p>
                  </div>
                  <span className={`tag ${st.tone}`}>{st.label}</span>
                  <span className="w-32 text-right font-mono font-semibold tabular">{money(q.total, q.currency)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
          <p className="text-muted">Todavía no hay cotizaciones.</p>
          <Link href="/finanzas/cotizaciones/nueva" className="btn-primary">Crear la primera</Link>
        </div>
      )}
    </div>
  );
}
