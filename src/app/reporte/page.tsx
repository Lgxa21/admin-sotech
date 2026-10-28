import { requireRole } from "@/lib/auth";
import { monthReport } from "@/lib/reports";
import { usd, money, fmtDay, todayCaracas } from "@/lib/money";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reporte mensual" };

// Reporte del mes listo para imprimir o guardar en PDF desde el navegador.
export default async function MonthReport({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayCaracas().slice(0, 7);
  const r = await monthReport(month);
  const t = r.totals;
  const th = "py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted";
  return (
    <main className="mx-auto max-w-[900px] bg-paper px-6 py-10 text-[13px] print:px-0 print:py-0 sm:px-10">
      <style>{`@media print { @page { margin: 14mm } body { background: #fff } .no-print { display: none } section { break-inside: avoid } }`}</style>
      <p className="no-print mb-6 text-right text-sm text-muted">Usa Imprimir (Ctrl + P) y elige “Guardar como PDF”.</p>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-5">
        <Logo size={40} light={false} />
        <div className="text-right"><p className="eyebrow">Reporte financiero</p><p className="font-display text-2xl font-extrabold first-letter:uppercase">{r.label}</p></div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Cobrado", t.in, "border-cyan"], ["Pagado", t.out, "border-magenta"], ["Queda en caja", t.net, "border-ink"], ["Por cobrar", t.receivable, "border-yellow"]].map(([l, v, b]) => (
          <div key={l as string} className={`rounded-xl border-t-[5px] bg-canvas px-4 py-3 ${b}`}><p className="font-mono text-lg font-semibold">{usd(v as number)}</p><p className="text-muted">{l}</p></div>
        ))}
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="h2">Rentabilidad por cliente</h2>
        <p className="text-muted">Órdenes solicitadas en el mes. Margen total {usd(t.price - t.costs)}{t.price ? ` (${Math.round(((t.price - t.costs) / t.price) * 100)}%)` : ""}.</p>
        <table className="w-full">
          <thead><tr className="border-b-2 border-ink"><th className={th}>Cliente</th><th className={`${th} text-right`}>Órdenes</th><th className={`${th} text-right`}>Precio</th><th className={`${th} text-right`}>Costos</th><th className={`${th} text-right`}>Margen</th></tr></thead>
          <tbody>{r.profit.map((c) => (
            <tr key={c.name} className="border-b border-line"><td className="py-2">{c.name}</td><td className="text-right font-mono">{c.n}</td><td className="text-right font-mono">{usd(c.price)}</td><td className="text-right font-mono">{usd(c.costs)}</td><td className="text-right font-mono font-semibold">{usd(c.price - c.costs)}</td></tr>
          ))}</tbody>
        </table>
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="h2">Por cobrar</h2>
        {r.receivable.length ? (
          <table className="w-full">
            <thead><tr className="border-b-2 border-ink"><th className={th}>Orden</th><th className={th}>Cliente</th><th className={`${th} text-right`}>Precio</th><th className={`${th} text-right`}>Cobrado</th><th className={`${th} text-right`}>Pendiente</th></tr></thead>
            <tbody>{r.receivable.map((o) => (
              <tr key={o.id} className="border-b border-line"><td className="py-2">#{o.number} {o.title}</td><td>{o.client}</td><td className="text-right font-mono">{usd(o.m.price)}</td><td className="text-right font-mono">{usd(o.m.collected)}</td><td className="text-right font-mono font-semibold">{usd(o.m.pending)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="text-muted">No hay montos pendientes.</p>}
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="h2">Cobros del mes</h2>
        {r.cobros.length ? (
          <table className="w-full">
            <thead><tr className="border-b-2 border-ink"><th className={th}>Fecha</th><th className={th}>Cliente</th><th className={th}>Método</th><th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>USD</th></tr></thead>
            <tbody>{r.cobros.map((c, i) => (
              <tr key={i} className="border-b border-line"><td className="py-2 font-mono">{fmtDay(c.paidOn)}</td><td>{c.client}{c.orderNumber ? ` · #${c.orderNumber}` : ""}</td><td>{c.method}{c.reference ? ` · ${c.reference}` : ""}</td><td className="text-right font-mono">{money(c.amount, c.currency)}</td><td className="text-right font-mono">{usd(c.amountUsd)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="text-muted">Sin cobros.</p>}
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="h2">Pagos a proveedores y gastos</h2>
        {r.pagos.length ? (
          <table className="w-full">
            <thead><tr className="border-b-2 border-ink"><th className={th}>Fecha</th><th className={th}>Concepto</th><th className={th}>Orden</th><th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>USD</th></tr></thead>
            <tbody>{r.pagos.map((c, i) => (
              <tr key={i} className="border-b border-line"><td className="py-2 font-mono">{fmtDay(c.paidOn)}</td><td>{c.concept}{c.supplier ? ` · ${c.supplier}` : ""}</td><td>{c.client} · #{c.orderNumber}</td><td className="text-right font-mono">{money(c.amount, c.currency)}</td><td className="text-right font-mono">{usd(c.amountUsd)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="text-muted">Sin pagos.</p>}
      </section>
      <p className="mt-8 text-[11px] text-muted">Montos en USD. Los movimientos en bolívares se convierten con la tasa registrada el día de cada movimiento.</p>
    </main>
  );
}
