import { addPayment, addCost } from "@/app/actions/finance";
import { PAYMENT_METHODS, todayCaracas } from "@/lib/money";

type Opt = { id: string; name: string };
type OrderOpt = { id: string; label: string; client: string };

function AmountFields({ prefix }: { prefix: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <div><label className="label" htmlFor={`${prefix}-amount`}>Monto</label><input id={`${prefix}-amount`} name="amount" inputMode="decimal" required placeholder="0,00" className="input tabular" /></div>
      <div><label className="label" htmlFor={`${prefix}-cur`}>Moneda</label>
        <select id={`${prefix}-cur`} name="currency" className="input w-28" defaultValue="USD"><option value="USD">USD</option><option value="VES">Bs.</option></select>
      </div>
    </div>
  );
}

function PaidFields({ prefix }: { prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="label" htmlFor={`${prefix}-date`}>Fecha</label><input id={`${prefix}-date`} name="date" type="date" defaultValue={todayCaracas()} className="input" /></div>
      <div><label className="label" htmlFor={`${prefix}-method`}>Método</label>
        <select id={`${prefix}-method`} name="method" className="input">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
      </div>
      <div><label className="label" htmlFor={`${prefix}-ref`}>Referencia</label><input id={`${prefix}-ref`} name="reference" placeholder="N.º de operación" className="input" /></div>
    </div>
  );
}

export function PaymentForm({ back, orderId, clients, orders }: { back: string; orderId?: string; clients?: Opt[]; orders?: OrderOpt[] }) {
  const byClient = new Map<string, OrderOpt[]>();
  for (const o of orders ?? []) byClient.set(o.client, [...(byClient.get(o.client) ?? []), o]);
  return (
    <form action={addPayment} className="grid gap-3">
      <input type="hidden" name="back" value={back} />
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="p-client">Cliente</label>
            <select id="p-client" name="clientId" className="input" defaultValue=""><option value="">Elige el cliente</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="p-order">Orden (opcional)</label>
            <select id="p-order" name="orderId" className="input" defaultValue="">
              <option value="">Sin orden: abono o iguala</option>
              {[...byClient.entries()].map(([client, list]) => (
                <optgroup key={client} label={client}>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
              ))}
            </select>
          </div>
        </div>
      )}
      <AmountFields prefix="p" />
      <PaidFields prefix="p" />
      <p className="text-xs text-muted">Si es en bolívares, se convierte a USD con la tasa de esa fecha. Al elegir una orden, el cliente se toma de ella.</p>
      <div><button className="btn-primary">Registrar cobro</button></div>
    </form>
  );
}

export function CostForm({ back, orderId, orders, suppliers }: { back: string; orderId?: string; orders?: OrderOpt[]; suppliers: (Opt & { kind: string })[] }) {
  return (
    <form action={addCost} className="grid gap-3">
      <input type="hidden" name="back" value={back} />
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : (
        <div><label className="label" htmlFor="c-order">Orden</label>
          <select id="c-order" name="orderId" required className="input" defaultValue=""><option value="" disabled>Elige la orden</option>{orders?.map((o) => <option key={o.id} value={o.id}>{o.client} · {o.label}</option>)}</select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div><label className="label" htmlFor="c-kind">Tipo</label>
          <select id="c-kind" name="kind" className="input sm:w-44"><option value="PROVEEDOR">Pago a proveedor o freelancer</option><option value="GASTO">Gasto (pauta, impresión…)</option></select>
        </div>
        <div><label className="label" htmlFor="c-concept">Concepto</label><input id="c-concept" name="concept" required placeholder="Ej.: Arte final, impresión de lona" className="input" /></div>
      </div>
      <div><label className="label" htmlFor="c-supplier">A quién (opcional)</label>
        <select id="c-supplier" name="supplierId" className="input" defaultValue=""><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.kind === "FREELANCER" ? " (freelancer)" : ""}</option>)}</select>
      </div>
      <AmountFields prefix="c" />
      <div className="grid gap-3 rounded-[14px] bg-canvas px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="paid" className="h-4 w-4 accent-[#111111]" />Ya está pagado</label>
        <PaidFields prefix="c" />
        <p className="text-xs text-muted">Si no lo marcas, queda como pago pendiente y la fecha, el método y la referencia se ignoran.</p>
      </div>
      <div><button className="btn-primary">Agregar costo</button></div>
    </form>
  );
}
