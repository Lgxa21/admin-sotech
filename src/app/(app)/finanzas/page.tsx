import Link from "next/link";
import { and, asc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, orders, clients, payments, costs } from "@/db";
import { moneyByOrder } from "@/lib/finance";
import { usd, todayCaracas } from "@/lib/money";
import type { Status } from "@/lib/labels";

export const metadata = { title: "Finanzas" };
export const dynamic = "force-dynamic";

// Desde que el cliente aprueba, el trabajo se puede cobrar.
const BILLABLE: Status[] = ["APROBADO", "ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default async function FinanceSummary({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const today = todayCaracas();
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const nextMonth = next.slice(0, 7);
  const startTs = new Date(`${start}T00:00:00-04:00`);
  const nextTs = new Date(`${next}T00:00:00-04:00`);

  const [[inMonth], [outMonth], [pendingCosts], billable, monthOrders] = await Promise.all([
    db.select({ t: sql<string>`coalesce(sum(${payments.amountUsd}), 0)` }).from(payments).where(and(gte(payments.paidOn, start), lt(payments.paidOn, next))),
    db.select({ t: sql<string>`coalesce(sum(${costs.amountUsd}), 0)` }).from(costs).where(and(eq(costs.status, "PAGADO"), gte(costs.paidOn, start), lt(costs.paidOn, next))),
    db.select({ t: sql<string>`coalesce(sum(${costs.amountUsd}), 0)`, n: sql<number>`count(*)`.mapWith(Number) }).from(costs).where(eq(costs.status, "PENDIENTE")),
    db.select({ id: orders.id, number: orders.number, title: orders.title, budget: orders.budget, currency: orders.currency, status: orders.status, client: clients.name, clientId: clients.id, statusChangedAt: orders.statusChangedAt })
      .from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(and(inArray(orders.status, BILLABLE), isNotNull(orders.budget))).orderBy(asc(orders.statusChangedAt)),
    db.select({ id: orders.id, budget: orders.budget, currency: orders.currency, client: clients.name, clientId: clients.id })
      .from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
      .where(and(gte(orders.requestedAt, startTs), lt(orders.requestedAt, nextTs), isNotNull(orders.budget))),
  ]);

  const billMoney = await moneyByOrder(billable);
  const receivable = billable.map((o) => ({ ...o, m: billMoney.get(o.id)! })).filter((o) => o.m.pending > 0.009);
  const receivableTotal = receivable.reduce((a, o) => a + o.m.pending, 0);

  const monthMoney = await moneyByOrder(monthOrders);
  const byClient = new Map<string, { id: string; name: string; price: number; costs: number; n: number }>();
  for (const o of monthOrders) {
    const mm = monthMoney.get(o.id)!;
    const c = byClient.get(o.clientId) ?? { id: o.clientId, name: o.client, price: 0, costs: 0, n: 0 };
    c.price += mm.price; c.costs += mm.costs; c.n += 1;
    byClient.set(o.clientId, c);
  }
  const clientsRows = [...byClient.values()].sort((a, b) => b.price - b.costs - (a.price - a.costs));
  const totPrice = clientsRows.reduce((a, c) => a + c.price, 0);
  const totCosts = clientsRows.reduce((a, c) => a + c.costs, 0);
  const net = Number(inMonth.t) - Number(outMonth.t);
  const monthName = `${MONTHS[m - 1]} ${y}`;

  return (
    <div className="grid gap-8">
      <section aria-labelledby="mes" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mes" className="h2 first-letter:uppercase">{monthName}</h2>
          <div className="flex flex-wrap gap-2">
            <a href={`/exportar/finanzas?mes=${month}`} className="btn btn-sm">Excel</a>
            <Link href={`/reporte?mes=${month}`} target="_blank" className="btn btn-sm">PDF</Link>
            <Link href={`/finanzas?mes=${prevMonth}`} className="btn btn-sm" aria-label="Mes anterior">←</Link>
            {month !== today.slice(0, 7) && <Link href="/finanzas" className="btn btn-sm">Este mes</Link>}
            <Link href={`/finanzas?mes=${nextMonth}`} className="btn btn-sm" aria-label="Mes siguiente">→</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-4">
          <Tile label="Cobrado" value={usd(inMonth.t)} bar="border-cyan" />
          <Tile label="Pagado a proveedores y gastos" value={usd(outMonth.t)} bar="border-magenta" />
          <Tile label="Queda en caja" value={usd(net)} bar="border-ink" tone={net < 0 ? "text-bad" : ""} />
          <Tile label="Margen de las órdenes del mes" value={usd(totPrice - totCosts)} bar="border-yellow" hint={totPrice ? `${Math.round(((totPrice - totCosts) / totPrice) * 100)}% del precio` : undefined} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-labelledby="cobrar" className="card grid content-start gap-4 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="cobrar" className="h2">Por cobrar</h2>
            <span className="font-mono text-lg font-semibold">{usd(receivableTotal)}</span>
          </div>
          {receivable.length ? (
            <ul className="grid gap-2">
              {receivable.slice(0, 12).map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-canvas px-4 py-3">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <Link href={`/ordenes/${o.id}#dinero`} className="font-bold hover:underline">{o.title}</Link>
                    <p className="text-[13px] text-muted">{o.client} · cobrado {usd(o.m.collected)} de {usd(o.m.price)}</p>
                  </div>
                  <span className="font-mono font-semibold">{usd(o.m.pending)}</span>
                  <Link href={`/ordenes/${o.id}#dinero`} className="btn btn-sm">Registrar cobro</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">No hay trabajos aprobados pendientes de cobro.</p>}
          <p className="text-xs text-muted">Incluye las órdenes aprobadas por el cliente o ya entregadas cuyo precio no se ha cobrado completo.</p>
        </section>

        <section aria-labelledby="pagar" className="card-ink grid content-start gap-3 p-6">
          <h2 id="pagar" className="h2">Por pagar a proveedores</h2>
          <p><span className="font-mono text-[32px] font-semibold text-yellow">{usd(pendingCosts.t)}</span></p>
          <p className="text-sm text-canvas/70">{pendingCosts.n} {pendingCosts.n === 1 ? "pago pendiente" : "pagos pendientes"} entre freelancers, proveedores y gastos.</p>
          <Link href="/finanzas/pagos" className="w-fit rounded-full bg-yellow px-5 py-2.5 text-sm font-bold text-ink">Ver pagos pendientes</Link>
        </section>
      </div>

      <section aria-labelledby="rent" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rent" className="h2">Rentabilidad por cliente</h2>
          <span className="text-sm text-muted">Órdenes solicitadas en {monthName}</span>
        </div>
        {clientsRows.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr className="border-b border-line"><th className="px-5 py-3 font-semibold">Cliente</th><th className="px-2 text-right font-semibold">Órdenes</th><th className="px-2 text-right font-semibold">Precio</th><th className="px-2 text-right font-semibold">Costos</th><th className="px-5 text-right font-semibold">Margen</th></tr>
              </thead>
              <tbody>
                {clientsRows.map((c) => {
                  const mg = c.price - c.costs;
                  const pct = c.price ? Math.round((mg / c.price) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3"><Link href={`/clientes/${c.id}`} className="font-bold hover:underline">{c.name}</Link></td>
                      <td className="px-2 text-right font-mono tabular">{c.n}</td>
                      <td className="px-2 text-right font-mono tabular">{usd(c.price)}</td>
                      <td className="px-2 text-right font-mono tabular">{usd(c.costs)}</td>
                      <td className={`px-5 text-right font-mono font-semibold tabular ${mg < 0 ? "text-bad" : ""}`}>{usd(mg)} <span className="text-xs font-normal text-muted">{pct}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="card px-6 py-6 text-muted">No hay órdenes con precio en este mes.</p>}
      </section>
    </div>
  );
}

function Tile({ label, value, bar, tone = "", hint }: { label: string; value: string; bar: string; tone?: string; hint?: string }) {
  return (
    <div className={`card grid content-start gap-1.5 border-t-[6px] ${bar} px-4 py-4 sm:px-6 sm:py-5`}>
      <span className={`font-mono text-lg font-semibold leading-tight tabular sm:text-2xl ${tone}`}>{value}</span>
      <span className="text-xs text-muted sm:text-sm">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
