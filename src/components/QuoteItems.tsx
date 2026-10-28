"use client";
import { useState } from "react";
import { parseAmount } from "@/lib/money";

type Row = { key: number; description: string; qty: string; price: string };

// Líneas editables de una cotización, con el total calculado mientras se escribe.
export default function QuoteItems({ initial, currency }: { initial: { description: string; qty: string; unitPrice: string }[]; currency: "USD" | "VES" }) {
  const [rows, setRows] = useState<Row[]>(
    (initial.length ? initial : [{ description: "", qty: "1", unitPrice: "" }]).map((r, i) => ({
      key: i, description: r.description, qty: String(Number(r.qty)).replace(".", ","), price: r.unitPrice ? String(Number(r.unitPrice)).replace(".", ",") : "",
    })),
  );
  const [cur, setCur] = useState(currency);
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const total = rows.reduce((a, r) => a + (parseAmount(r.qty) ?? 0) * (parseAmount(r.price) ?? 0), 0);
  const fmt = (v: number) => (cur === "USD" ? "US$ " : "Bs. ") + v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid gap-3">
      <div className="w-40">
        <label className="label" htmlFor="currency">Moneda</label>
        <select id="currency" name="currency" value={cur} onChange={(e) => setCur(e.target.value as "USD" | "VES")} className="input"><option value="USD">USD</option><option value="VES">Bolívares</option></select>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_80px_130px_110px_32px] gap-2 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted sm:grid">
        <span>Descripción</span><span>Cant.</span><span>Precio unit.</span><span className="text-right">Subtotal</span><span />
      </div>
      <ul className="grid gap-2">
        {rows.map((r, i) => {
          const sub = (parseAmount(r.qty) ?? 0) * (parseAmount(r.price) ?? 0);
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)_32px] items-center gap-2 rounded-xl bg-canvas p-2 sm:grid-cols-[minmax(0,1fr)_80px_130px_110px_32px] sm:bg-transparent sm:p-0">
              <input name="desc" value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} placeholder="Ej.: Diseño de 12 piezas para Instagram" aria-label={`Descripción de la línea ${i + 1}`} className="input col-span-4 sm:col-span-1" />
              <input name="qty" value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value })} inputMode="decimal" aria-label={`Cantidad de la línea ${i + 1}`} className="input tabular" />
              <input name="price" value={r.price} onChange={(e) => set(r.key, { price: e.target.value })} inputMode="decimal" placeholder="0,00" aria-label={`Precio unitario de la línea ${i + 1}`} className="input tabular" />
              <span className="hidden text-right font-mono text-sm tabular sm:block">{fmt(sub)}</span>
              <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))} aria-label={`Quitar la línea ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-paper hover:text-bad">✕</button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((x) => x.key)) + 1, description: "", qty: "1", price: "" }])} className="font-bold hover:underline">+ Agregar línea</button>
        <p className="text-lg"><span className="text-muted">Total </span><b className="font-mono">{fmt(total)}</b></p>
      </div>
    </div>
  );
}
