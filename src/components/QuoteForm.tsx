import Link from "next/link";
import QuoteItems from "./QuoteItems";

type Opt = { id: string; name: string };
type V = { clientId?: string; title?: string; currency?: "USD" | "VES"; validUntil?: string | null; notes?: string | null; items?: { description: string; qty: string; unitPrice: string }[] };

export default function QuoteForm({ action, clients, values = {}, submit, cancelHref }: { action: (f: FormData) => Promise<void>; clients: Opt[]; values?: V; submit: string; cancelHref: string }) {
  return (
    <form action={action} className="grid max-w-4xl gap-5">
      <section className="card grid gap-4 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="clientId">Cliente</label>
            <select id="clientId" name="clientId" required defaultValue={values.clientId ?? ""} className="input"><option value="" disabled>Elige un cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="validUntil">Válida hasta</label><input id="validUntil" name="validUntil" type="date" defaultValue={values.validUntil ?? ""} className="input" /></div>
        </div>
        <div><label className="label" htmlFor="title">Título</label><input id="title" name="title" required defaultValue={values.title} placeholder="Ej.: Campaña de lanzamiento de verano" className="input" /></div>
      </section>
      <section className="card grid gap-4 px-6 py-6">
        <h2 className="h2">Líneas</h2>
        <QuoteItems initial={values.items ?? []} currency={values.currency ?? "USD"} />
      </section>
      <section className="card grid gap-2 px-6 py-6">
        <label className="label" htmlFor="notes">Condiciones y notas (las ve el cliente)</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={values.notes ?? ""} placeholder="Ej.: Incluye 2 rondas de cambios. 50% al aprobar y 50% al entregar." className="input" />
      </section>
      <div className="flex gap-2"><button className="btn-primary">{submit}</button><Link href={cancelHref} className="btn">Cancelar</Link></div>
    </form>
  );
}
