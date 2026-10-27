"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveOrder } from "@/app/actions/orders";
import { STATUSES, STATUS_LABEL, PRIORITY_LABEL, fmtDate, groupOf, type Status, type PriorityT } from "@/lib/labels";

export type Card = { id: string; number: number; title: string; client: string; status: Status; dueDate: string | null; priority: PriorityT; owner: string | null };

const DONE: Status[] = ["ENTREGADO", "FACTURADO", "PAGO_PROVEEDORES"];

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
      {error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{error}</p>}
      <div className="flex snap-x gap-3 overflow-x-auto pb-3">
        {STATUSES.map((s) => {
          const col = items.filter((c) => c.status === s);
          const g = groupOf(s);
          return (
            <section key={s} aria-label={STATUS_LABEL[s]}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, s); }}
              className={`w-[272px] shrink-0 snap-start rounded-[18px] p-2.5 transition-colors ${over === s ? "bg-yellow/30" : "bg-[#E9E7E0]"}`}>
              <h2 className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-[13px] font-bold">
                <span className={`h-3 w-3 rounded-full ${g.bar}`} aria-hidden="true" />
                <span className="flex-1">{STATUS_LABEL[s]}</span>
                <span className="font-mono text-muted tabular">{col.length}</span>
              </h2>
              <ul className="grid min-h-16 gap-2">
                {col.map((c) => {
                  const late = c.dueDate && new Date(c.dueDate) < new Date() && !DONE.includes(c.status);
                  return (
                    <li key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                      className="card relative grid cursor-grab gap-2 rounded-[14px] p-3.5 active:cursor-grabbing">
                      <Link href={`/ordenes/${c.id}`} className="font-bold leading-snug hover:underline">{c.title}</Link>
                      <p className="text-[13px] text-muted">{c.client}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {(c.priority === "URGENTE" || c.priority === "ALTA") && (
                          <span className={`tag py-0.5 ${c.priority === "URGENTE" ? "bg-magenta text-white" : "bg-yellow text-ink"}`}>{PRIORITY_LABEL[c.priority]}</span>
                        )}
                        <span className={`ml-auto font-mono ${late ? "font-semibold text-bad" : "text-muted"}`}>{late ? "Vencida" : fmtDate(c.dueDate)}</span>
                      </div>
                      {c.owner && <p className="truncate text-xs text-muted">{c.owner}</p>}
                      <label className="sr-only" htmlFor={`mv-${c.id}`}>Mover a</label>
                      <select id={`mv-${c.id}`} value={c.status} onChange={(e) => move(c.id, e.target.value as Status)}
                        className="input rounded-full py-1 text-xs md:hidden">
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
