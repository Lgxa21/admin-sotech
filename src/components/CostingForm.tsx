"use client";

import { useActionState, useRef, useState } from "react";
import type { CostingState } from "@/app/actions/costings";
import { calculateCosting, costingLineCents, MAX_COSTING_LABEL_LENGTH, MAX_COSTING_LINES, type Costing, type CostingLine } from "@/lib/costing";
import { money } from "@/lib/money";

type FormLine = CostingLine & { key: number };

export default function CostingForm({ action, initial, suppliers }: {
  action: (previous: CostingState, form: FormData) => Promise<CostingState>;
  initial: Costing;
  suppliers: { id: string; name: string }[];
}) {
  const [state, submit, pending] = useActionState(action, undefined);
  const [changed, setChanged] = useState(false);
  const [currency, setCurrency] = useState(initial.currency);
  const [lines, setLines] = useState<FormLine[]>(() => initial.lines.map((line, key) => ({ ...line, key })));
  const [chargeLabel, setChargeLabel] = useState(initial.chargeLabel);
  const [chargePercent, setChargePercent] = useState(initial.chargePercent);
  const [profitPercent, setProfitPercent] = useState(initial.profitPercent);
  const nextKey = useRef(lines.length);
  const amounts = calculateCosting({ currency, lines, chargeLabel, chargePercent, profitPercent });

  function updateLine(key: number, field: keyof CostingLine, value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  function addLine() {
    const key = nextKey.current++;
    setLines((current) => [...current, { key, supplier: "", quantity: "1", unitPrice: "" }]);
    setChanged(true);
  }

  return (
    <form action={submit} onChange={() => setChanged(true)} onSubmit={() => setChanged(false)}>
      <fieldset disabled={pending} className="grid min-w-0 gap-4">
        <section className="card grid gap-4 p-4 sm:p-6" aria-labelledby="proveedores-costeo">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="proveedores-costeo" className="h2">Proveedores</h2>
            <div>
              <label className="label" htmlFor="costeo-moneda">Moneda del costeo</label>
              <select id="costeo-moneda" name="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value === "VES" ? "VES" : "USD")}>
                <option value="USD">USD</option>
                <option value="VES">Bolívares</option>
              </select>
            </div>
          </div>
          <datalist id="costeo-proveedores">
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}
          </datalist>
          <div className="grid gap-2">
            {lines.map((line, index) => {
              const lineCents = costingLineCents(line);
              const id = `costeo-${line.key}`;
              return (
                <fieldset key={line.key} className="min-w-0 rounded-xl bg-canvas px-3 pb-3">
                  <legend className="px-1 text-xs font-semibold text-muted">Línea {index + 1}</legend>
                  <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <label className="label" htmlFor={`${id}-proveedor`}>Proveedor</label>
                      <input id={`${id}-proveedor`} name="supplier" className="input" list="costeo-proveedores" required maxLength={MAX_COSTING_LABEL_LENGTH} value={line.supplier} onChange={(e) => updateLine(line.key, "supplier", e.target.value)} />
                    </div>
                    <div className="min-w-0">
                      <label className="label" htmlFor={`${id}-cantidad`}>Cantidad</label>
                      <input id={`${id}-cantidad`} name="quantity" className="input tabular" inputMode="decimal" required maxLength={20} value={line.quantity} onChange={(e) => updateLine(line.key, "quantity", e.target.value)} />
                    </div>
                    <div className="min-w-0">
                      <label className="label" htmlFor={`${id}-unitario`}>Precio unitario</label>
                      <input id={`${id}-unitario`} name="unitPrice" className="input tabular" inputMode="decimal" required maxLength={20} placeholder="0,00" value={line.unitPrice} onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)} />
                    </div>
                    <div className="self-center pt-2">
                      <span className="label">Total de línea</span>
                      <output htmlFor={`${id}-cantidad ${id}-unitario`} className="font-mono text-sm font-semibold tabular">{lineCents === null ? "—" : money(Number(lineCents) / 100, currency)}</output>
                    </div>
                    <button type="button" className="btn btn-sm justify-self-end" aria-label={`Quitar línea ${index + 1}`} disabled={lines.length === 1} onClick={() => {
                      setLines((current) => current.filter((item) => item.key !== line.key));
                      setChanged(true);
                    }}>Quitar</button>
                  </div>
                </fieldset>
              );
            })}
          </div>
          <button type="button" className="btn btn-sm w-fit" disabled={lines.length >= MAX_COSTING_LINES} onClick={addLine}>+ Agregar proveedor</button>
        </section>

        <section className="card grid gap-4 p-4 sm:p-6" aria-labelledby="total-costeo">
          <h2 id="total-costeo" className="h2">Resumen del costeo</h2>
          <p className="text-sm text-muted">El cargo adicional y la ganancia se calculan sobre el subtotal de proveedores.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="costeo-cargo">Concepto del cargo adicional</label>
              <input id="costeo-cargo" name="chargeLabel" className="input" maxLength={MAX_COSTING_LABEL_LENGTH} value={chargeLabel} onChange={(e) => setChargeLabel(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="costeo-porcentaje-cargo">Cargo adicional (%)</label>
              <input id="costeo-porcentaje-cargo" name="chargePercent" className="input tabular" inputMode="decimal" maxLength={20} placeholder="0" value={chargePercent} onChange={(e) => setChargePercent(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="costeo-ganancia">Ganancia Sotech (%)</label>
              <input id="costeo-ganancia" name="profitPercent" className="input tabular" inputMode="decimal" maxLength={20} placeholder="0" value={profitPercent} onChange={(e) => setProfitPercent(e.target.value)} />
            </div>
          </div>
          <dl className="grid gap-2 rounded-xl bg-canvas p-4 text-sm">
            <Amount label="Subtotal de proveedores" value={amounts.subtotal} currency={currency} />
            <Amount label={chargeLabel.trim() || "Cargo adicional"} value={amounts.charge} currency={currency} />
            <Amount label="Ganancia Sotech" value={amounts.profit} currency={currency} />
            <Amount label="Total del costeo" value={amounts.total} currency={currency} total />
          </dl>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" aria-busy={pending}>{pending ? "Guardando…" : "Guardar costeo"}</button>
          {!changed && !pending && state?.error && <p role="alert" className="text-sm font-semibold text-bad">{state.error}</p>}
          {!changed && !pending && state?.saved && <p role="status" className="text-sm font-semibold">Costeo guardado.</p>}
        </div>
      </fieldset>
    </form>
  );
}

function Amount({ label, value, currency, total }: { label: string; value: number | undefined; currency: Costing["currency"]; total?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${total ? "border-t border-line pt-2 text-base font-bold" : ""}`}>
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="shrink-0 font-mono tabular">{value === undefined ? "—" : money(value, currency)}</dd>
    </div>
  );
}
