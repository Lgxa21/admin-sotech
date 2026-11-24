import Link from "next/link";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, clients, orders } from "@/db";
import { requireRole } from "@/lib/auth";
import { money, todayCaracas } from "@/lib/money";
import { monthRange } from "@/lib/reports";

export const metadata = { title: "Comisiones" };
export const dynamic = "force-dynamic";

const COMMISSION_RATE = 0.015;
const COMMISSION_LABEL = COMMISSION_RATE.toLocaleString("es-VE", { style: "percent", maximumFractionDigits: 1 });
const CURRENCIES = ["USD", "VES"] as const;

export default async function Commissions({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireRole("DIRECCION");
  const { mes } = await searchParams;
  const currentMonth = todayCaracas().slice(0, 7);
  const month = typeof mes === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(mes) && mes !== "9999-12" ? mes : currentMonth;
  const range = monthRange(month);
  const previous = new Date(range.startTs);
  previous.setUTCDate(0);

  const rows = await db.select({
    id: orders.id,
    number: orders.number,
    title: orders.title,
    client: clients.name,
    currency: orders.currency,
    price: orders.budget,
    commission: sql<string | null>`round(${orders.budget} * ${COMMISSION_RATE}::numeric, 2)`,
  }).from(orders).innerJoin(clients, eq(clients.id, orders.clientId))
    .where(and(gte(orders.requestedAt, range.startTs), lt(orders.requestedAt, range.nextTs)))
    .orderBy(desc(orders.requestedAt), desc(orders.number));

  const totals = new Map<(typeof CURRENCIES)[number], number>();
  for (const row of rows) {
    if (row.commission === null) continue;
    const cents = Math.round(Number(row.commission) * 100);
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + cents);
  }

  return (
    <section aria-labelledby="comisiones" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="comisiones" className="h2">Comisiones · <span className="capitalize">{range.label}</span></h2>
          <p className="mt-1 text-sm text-muted">{COMMISSION_LABEL} del precio registrado de cada orden solicitada en el mes, en su moneda original.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {month !== "1000-01" && <Link href={`/finanzas/comisiones?mes=${previous.toISOString().slice(0, 7)}`} className="btn btn-sm" aria-label="Mes anterior">←</Link>}
          {month !== currentMonth && <Link href="/finanzas/comisiones" className="btn btn-sm">Este mes</Link>}
          {month !== "9999-11" && <Link href={`/finanzas/comisiones?mes=${range.next.slice(0, 7)}`} className="btn btn-sm" aria-label="Mes siguiente">→</Link>}
        </div>
      </div>

      {totals.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {CURRENCIES.filter((currency) => totals.has(currency)).map((currency) => (
            <div key={currency} className="card border-t-[5px] border-t-yellow px-5 py-4">
              <p className="eyebrow">Comisión calculada en {currency === "USD" ? "dólares" : "bolívares"}</p>
              <p className="mt-1 font-mono text-xl font-semibold tabular">{money((totals.get(currency) ?? 0) / 100, currency)}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm" aria-label="Comisión por orden">
            <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-3 font-semibold">Orden y cliente</th>
                <th scope="col" className="px-2 text-right font-semibold">Precio</th>
                <th scope="col" className="px-5 text-right font-semibold">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/ordenes/${row.id}`} className="font-bold hover:underline">#{row.number} {row.title}</Link>
                    <p className="text-[13px] text-muted">{row.client}</p>
                  </td>
                  <td className="whitespace-nowrap px-2 text-right font-mono tabular">{row.price === null ? "Sin precio" : money(row.price, row.currency)}</td>
                  <td className="whitespace-nowrap px-5 text-right font-mono font-semibold tabular">{row.commission === null ? "Por calcular" : money(row.commission, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="card px-5 py-6 text-muted">No hay órdenes solicitadas en este mes.</p>}
    </section>
  );
}
