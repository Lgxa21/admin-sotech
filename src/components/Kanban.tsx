"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveOrder } from "@/app/actions/orders";
import { STATUSES, STATUS_LABEL, PRIORITY_TONE, PRIORITY_LABEL, fmtDate, type Status, type PriorityT } from "@/lib/labels";

export type Card = { id: string; number: number; title: string; client: string; status: Status; dueDate: string | null; priority: PriorityT; owner: string | null };

export default function Kanban({ cards }: { cards: Card[] }) {
  const [items, setItems] = useOptimistic(cards, (state, m: { id: string; to: Status }) => state.map((c) => (c.id === m.id ? { ...c, status: m.to } : c)));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  const move = (id: string, to: Status) => {
    setError(null);
    start(async () => {
      setItems({ id, to });
      const r = await moveOrder(id, to);
      if (r && "error" in r && r.error) setError(r.error);
    });
  };

  return (
    <div className="grid gap-3">
      {error && <p role="alert" className="card border-bad/40 bg-bad/5 px-4 py-2 text-sm text-bad">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
        {STATUSES.map((s) => {
          const col = items.filter((c) => c.status === s);
          return (
            <section key={s}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, s); }}
              className={`snap-start w-[264px] shrink-0 rounded-xl border p-2 ${over === s ? "border-accent bg-accent/5" : "border-line bg-canvas"}`}>
              <h2 className="flex items-center justify-between px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {STATUS_LABEL[s]} <span className="tabular">{col.length}</span>
              </h2>
              <ul className="grid gap-2 min-h-16">
                {col.map((c) => {
                  const late = c.dueDate && new Date(c.dueDate) < new Date() && !["ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES"].includes(c.status);
                  return (
                    <li key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                      className="relative card p-3 cursor-grab active:cursor-grabbing grid gap-1.5">
                      <Link href={`/ordenes/${c.id}`} className="text-sm font-medium leading-snug hover:text-accent">{c.title}</Link>
                      <p className="text-xs text-muted">#{c.number} · {c.client}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</span>
                        <span className={`tabular ${late ? "text-bad font-semibold" : "text-muted"}`}>{late ? "Vencida" : fmtDate(c.dueDate)}</span>
                      </div>
                      {c.owner && <p className="text-xs text-muted truncate">{c.owner}</p>}
                      <label className="sr-only" htmlFor={`mv-${c.id}`}>Mover a</label>
                      <select id={`mv-${c.id}`} value={c.status} onChange={(e) => move(c.id, e.target.value as Status)}
                        className="input py-1 text-xs md:hidden">
                        {STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted">Arrastra una tarjeta para cambiarla de etapa. En el celular, usa el selector de cada tarjeta.</p>
    </div>
  );
}
