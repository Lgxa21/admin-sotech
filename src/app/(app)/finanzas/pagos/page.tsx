import Link from "next/link";
import { asc, desc, eq, ne } from "drizzle-orm";
import { db, costs, orders, clients, suppliers, users } from "@/db";
import { usd, money, fmtDay, todayCaracas, PAYMENT_METHODS } from "@/lib/money";
import { markCostPaid, deleteCost, createSupplier } from "@/app/actions/finance";
import { CostForm } from "@/components/MoneyForms";

export const metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

export default async function Costs() {
  const back = "/finanzas/pagos";
  const sel = {
    id: costs.id, kind: costs.kind, concept: costs.concept, amount: costs.amount, currency: costs.currency, amountUsd: costs.amountUsd,
    status: costs.status, paidOn: costs.paidOn, method: costs.method, reference: costs.reference, supplier: suppliers.name,
    orderId: orders.id, orderNumber: orders.number, orderTitle: orders.title, client: clients.name,
  };
  const base = () => db.select(sel).from(costs).innerJoin(orders, eq(orders.id, costs.orderId)).innerJoin(clients, eq(clients.id, orders.clientId)).leftJoin(suppliers, eq(suppliers.id, costs.supplierId));
  const [pending, paid, supplierList, orderList, freelancers] = await Promise.all([
    base().where(eq(costs.status, "PENDIENTE")).orderBy(asc(costs.createdAt)),
    base().where(eq(costs.status, "PAGADO")).orderBy(desc(costs.paidOn)).limit(25),
    db.select({ id: suppliers.id, name: suppliers.name, kind: suppliers.kind, contact: suppliers.contact }).from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.name)),
    db.select({ id: orders.id, number: orders.number, title: orders.title, client: clients.name }).from(orders).innerJoin(clients, eq(clients.id, orders.clientId)).where(ne(orders.status, "PAGO_PROVEEDORES")).orderBy(asc(clients.name), desc(orders.number)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "FREELANCER")).orderBy(asc(users.name)),
  ]);
  const pendingTotal = pending.reduce((a, c) => a + Number(c.amountUsd), 0);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="pend" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pend" className="h2">Pendientes de pago</h2>
          <span className="font-mono text-lg font-semibold">{usd(pendingTotal)}</span>
        </div>
        {pending.length ? (
          <ul className="grid gap-2.5">
            {pending.map((c) => (
              <li key={c.id} className="card grid gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`tag ${c.kind === "GASTO" ? "bg-cyan text-ink" : "bg-yellow text-ink"}`}>{c.kind === "GASTO" ? "Gasto" : "Proveedor"}</span>
                  <div className="min-w-0 flex-[1_1_220px]">
                    <p className="font-bold">{c.concept}{c.supplier && <span className="font-normal text-muted"> · {c.supplier}</span>}</p>
                    <Link href={`/ordenes/${c.orderId}#dinero`} className="text-[13px] text-muted hover:underline">{c.client} · #{c.orderNumber} {c.orderTitle}</Link>
                  </div>
                  <span className="font-mono font-semibold">{money(c.amount, c.currency)}</span>
                </div>
                <details>
                  <summary className="w-fit cursor-pointer text-sm font-bold underline decoration-dotted underline-offset-4">Marcar como pagado</summary>
                  <form action={markCostPaid.bind(null, c.id)} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="back" value={back} />
                    <div><label className="label" htmlFor={`d-${c.id}`}>Fecha</label><input id={`d-${c.id}`} name="date" type="date" defaultValue={todayCaracas()} className="input w-40" /></div>
                    <div><label className="label" htmlFor={`m-${c.id}`}>Método</label><select id={`m-${c.id}`} name="method" className="input w-40">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
                    <div><label className="label" htmlFor={`r-${c.id}`}>Referencia</label><input id={`r-${c.id}`} name="reference" className="input w-40" /></div>
                    <button className="btn-primary">Guardar</button>
                    <button formAction={deleteCost.bind(null, c.id, back)} className="ml-auto text-xs text-muted hover:text-bad">Eliminar</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="card px-6 py-6 text-muted">No hay pagos pendientes.</p>}
      </section>

      <details className="card group">
        <summary className="flex cursor-pointer items-center justify-between px-6 py-5 font-bold">+ Agregar un costo a una orden <span aria-hidden="true" className="transition-transform group-open:rotate-90">→</span></summary>
        <div className="px-6 pb-6"><CostForm back={back} suppliers={supplierList} orders={orderList.map((o) => ({ id: o.id, label: `#${o.number} ${o.title}`, client: o.client }))} /></div>
      </details>

      <section aria-labelledby="hechos" className="grid gap-3">
        <h2 id="hechos" className="h2">Pagados recientemente</h2>
        {paid.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                <tr className="border-b border-line"><th className="px-5 py-3 font-semibold">Fecha</th><th className="px-2 font-semibold">Concepto</th><th className="px-2 font-semibold">Método</th><th className="px-5 text-right font-semibold">En USD</th></tr>
              </thead>
              <tbody>
                {paid.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-mono text-[13px] tabular">{fmtDay(c.paidOn)}</td>
                    <td className="px-2"><span className="font-bold">{c.concept}</span>{c.supplier && <span className="text-muted"> · {c.supplier}</span>}<Link href={`/ordenes/${c.orderId}#dinero`} className="block text-[13px] text-muted hover:underline">#{c.orderNumber} {c.orderTitle}</Link></td>
                    <td className="px-2">{c.method ?? "—"}{c.reference && <span className="block text-[13px] text-muted">Ref. {c.reference}</span>}</td>
                    <td className="px-5 text-right font-mono font-semibold tabular">{usd(c.amountUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted">Todavía no hay pagos registrados.</p>}
      </section>

      <section aria-labelledby="prov" className="grid gap-3">
        <h2 id="prov" className="h2">Proveedores y freelancers</h2>
        {supplierList.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {supplierList.map((s) => <li key={s.id} className="rounded-full bg-paper px-4 py-2 text-sm"><b>{s.name}</b>{s.kind === "FREELANCER" && <span className="text-muted"> · freelancer</span>}{s.contact && <span className="text-muted"> · {s.contact}</span>}</li>)}
          </ul>
        )}
        <form action={createSupplier} className="card flex flex-wrap items-end gap-2 px-5 py-4">
          <input type="hidden" name="back" value={back} />
          <div className="flex-[1_1_180px]"><label className="label" htmlFor="s-name">Nombre</label><input id="s-name" name="name" required placeholder="Ej.: Imprenta Gráficas Caribe" className="input" /></div>
          <div><label className="label" htmlFor="s-kind">Tipo</label><select id="s-kind" name="kind" className="input w-36"><option value="PROVEEDOR">Proveedor</option><option value="FREELANCER">Freelancer</option></select></div>
          {freelancers.length > 0 && (
            <div><label className="label" htmlFor="s-user">Cuenta en el sistema</label><select id="s-user" name="userId" className="input w-44" defaultValue=""><option value="">Ninguna</option>{freelancers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          )}
          <div className="flex-[1_1_160px]"><label className="label" htmlFor="s-contact">Contacto</label><input id="s-contact" name="contact" placeholder="Teléfono o correo" className="input" /></div>
          <button className="btn">Agregar</button>
        </form>
      </section>
    </div>
  );
}
