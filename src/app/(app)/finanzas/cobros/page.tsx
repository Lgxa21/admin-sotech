import Link from "next/link";
import { and, asc, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db, payments, clients, orders } from "@/db";
import { usd, money, rateText, fmtDay, todayCaracas } from "@/lib/money";
import { deletePayment } from "@/app/actions/finance";
import { PaymentForm } from "@/components/MoneyForms";

export const metadata = { title: "Cobros" };
export const dynamic = "force-dynamic";

export default async function Payments({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayCaracas().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const [rows, clientList, orderList] = await Promise.all([
    db.select({
      id: payments.id, amount: payments.amount, currency: payments.currency, rate: payments.rate, amountUsd: payments.amountUsd,
      method: payments.method, reference: payments.reference, paidOn: payments.paidOn, client: clients.name, orderId: payments.orderId,
      orderNumber: orders.number, orderTitle: orders.title,
    }).from(payments).innerJoin(clients, eq(clients.id, payments.clientId)).leftJoin(orders, eq(orders.id, payments.orderId))
      .where(and(gte(payments.paidOn, `${month}-01`), lt(payments.paidOn, next))).orderBy(desc(payments.paidOn), desc(payments.createdAt)),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.active, true)).orderBy(asc(clients.name)),
    db.select({ id: orders.id, number: orders.number, title: orders.title, client: clients.name }).from(orders)
      .innerJoin(clients, eq(clients.id, orders.clientId)).where(ne(orders.status, "PAGO_PROVEEDORES")).orderBy(asc(clients.name), desc(orders.number)),
  ]);
  const total = rows.reduce((a, r) => a + Number(r.amountUsd), 0);
  const back = `/finanzas/cobros${sp.mes ? `?mes=${month}` : ""}`;
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="grid gap-6">
      <details className="card group" open={rows.length === 0}>
        <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-bold">+ Registrar un cobro <span aria-hidden="true" className="transition-transform group-open:rotate-90">→</span></summary>
        <div className="px-6 pb-6">
          <PaymentForm back={back} clients={clientList} orders={orderList.map((o) => ({ id: o.id, label: `#${o.number} ${o.title}`, client: o.client }))} />
        </div>
      </details>

      <section aria-labelledby="lista" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="lista" className="h2 first-letter:uppercase">{label} · <span className="font-mono">{usd(total)}</span></h2>
          <div className="flex gap-2">
            <Link href={`/finanzas/cobros?mes=${prev}`} className="btn btn-sm" aria-label="Mes anterior">←</Link>
            <Link href={`/finanzas/cobros?mes=${next.slice(0, 7)}`} className="btn btn-sm" aria-label="Mes siguiente">→</Link>
          </div>
        </div>
        {rows.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr className="border-b border-line"><th className="px-5 py-3 font-semibold">Fecha</th><th className="px-2 font-semibold">Cliente y orden</th><th className="px-2 font-semibold">Método</th><th className="px-2 text-right font-semibold">Monto</th><th className="px-2 text-right font-semibold">En USD</th><th className="px-5"><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-mono text-[13px] tabular">{fmtDay(r.paidOn)}</td>
                    <td className="px-2">
                      <span className="font-bold">{r.client}</span>
                      {r.orderId ? <Link href={`/ordenes/${r.orderId}#dinero`} className="block text-[13px] text-muted hover:underline">#{r.orderNumber} {r.orderTitle}</Link> : <span className="block text-[13px] text-muted">Sin orden</span>}
                    </td>
                    <td className="px-2">{r.method}{r.reference && <span className="block text-[13px] text-muted">Ref. {r.reference}</span>}</td>
                    <td className="px-2 text-right font-mono tabular">{money(r.amount, r.currency)}{r.rate && <span className="block text-[11px] text-muted">tasa {rateText(r.rate)}</span>}</td>
                    <td className="px-2 text-right font-mono font-semibold tabular">{usd(r.amountUsd)}</td>
                    <td className="px-5 text-right">
                      <form action={deletePayment.bind(null, r.id, back)}><button className="text-xs text-muted hover:text-bad">Eliminar</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="card px-6 py-6 text-muted">No hay cobros registrados en este mes.</p>}
      </section>
    </div>
  );
}
