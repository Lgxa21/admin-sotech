import Link from "next/link";
import { SERVICES, SERVICE_LABEL, PRIORITIES, PRIORITY_LABEL, toInputDate } from "@/lib/labels";

type Opt = { id: string; name: string };
type Values = Partial<{
  title: string; clientId: string; serviceType: string; priority: string; brief: string | null; copy: string | null;
  platform: string | null; formats: string | null; referenceLinks: string | null; dueDate: Date | null; ownerId: string | null;
  budget: string | null; currency: string; revisionRoundsIncluded: number; invoiceNumber: string | null; internalNotes: string | null; isRecurring: boolean;
}>;

export default function OrderForm({ action, clients, people, values = {}, money, submit, cancelHref }: {
  action: (f: FormData) => Promise<void>; clients: Opt[]; people: Opt[]; values?: Values; money: boolean; submit: string; cancelHref: string;
}) {
  const v = values;
  return (
    <form action={action} className="grid gap-5 max-w-3xl">
      <section className="card p-5 grid gap-4">
        <h2 className="h2">Lo básico</h2>
        <Field label="Título de la orden" id="title"><input id="title" name="title" required defaultValue={v.title} placeholder="Ej.: 12 posts de noviembre" className="input" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" id="clientId">
            <select id="clientId" name="clientId" required defaultValue={v.clientId ?? ""} className="input">
              <option value="" disabled>Elige un cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Link href="/clientes/nuevo?next=orden" className="mt-1 inline-block text-xs text-accent">+ Cliente nuevo</Link>
          </Field>
          <Field label="Tipo de servicio" id="serviceType">
            <select id="serviceType" name="serviceType" defaultValue={v.serviceType ?? "REDES_SOCIALES"} className="input">
              {SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Responsable" id="ownerId">
            <select id="ownerId" name="ownerId" defaultValue={v.ownerId ?? ""} className="input">
              <option value="">Sin asignar</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Prioridad" id="priority">
            <select id="priority" name="priority" defaultValue={v.priority ?? "MEDIA"} className="input">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </Field>
          <Field label="Fecha de entrega" id="dueDate"><input id="dueDate" name="dueDate" type="date" defaultValue={toInputDate(v.dueDate)} className="input" /></Field>
          <Field label="Rondas de revisión incluidas" id="revisionRoundsIncluded"><input id="revisionRoundsIncluded" name="revisionRoundsIncluded" type="number" min={0} max={10} defaultValue={v.revisionRoundsIncluded ?? 2} className="input" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRecurring" defaultChecked={v.isRecurring} className="h-4 w-4 accent-[rgb(var(--accent))]" />Es parte de un trabajo recurrente (iguala)</label>
      </section>

      <section className="card p-5 grid gap-4">
        <h2 className="h2">Brief</h2>
        <Field label="Descripción del pedido" id="brief"><textarea id="brief" name="brief" rows={5} defaultValue={v.brief ?? ""} placeholder="Qué pidió el cliente, objetivo, público, mensajes clave…" className="input" /></Field>
        <Field label="Copy / textos" id="copy"><textarea id="copy" name="copy" rows={3} defaultValue={v.copy ?? ""} className="input" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Red social o plataforma" id="platform"><input id="platform" name="platform" defaultValue={v.platform ?? ""} placeholder="Instagram, TikTok, impresión…" className="input" /></Field>
          <Field label="Formatos y medidas" id="formats"><input id="formats" name="formats" defaultValue={v.formats ?? ""} placeholder="1080×1350, historia, 60×90 cm…" className="input" /></Field>
        </div>
        <Field label="Archivos de referencia (enlaces, uno por línea)" id="referenceLinks"><textarea id="referenceLinks" name="referenceLinks" rows={2} defaultValue={v.referenceLinks ?? ""} placeholder="https://drive.google.com/…" className="input" /></Field>
      </section>

      <section className="card p-5 grid gap-4">
        <h2 className="h2">Interno</h2>
        {money && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Presupuesto / precio" id="budget"><input id="budget" name="budget" inputMode="decimal" defaultValue={v.budget ?? ""} placeholder="0,00" className="input tabular" /></Field>
            <Field label="Moneda" id="currency">
              <select id="currency" name="currency" defaultValue={v.currency ?? "USD"} className="input"><option value="USD">USD</option><option value="VES">Bolívares</option></select>
            </Field>
            <Field label="Número de factura" id="invoiceNumber"><input id="invoiceNumber" name="invoiceNumber" defaultValue={v.invoiceNumber ?? ""} className="input" /></Field>
          </div>
        )}
        <Field label="Notas internas (el cliente no las ve)" id="internalNotes"><textarea id="internalNotes" name="internalNotes" rows={3} defaultValue={v.internalNotes ?? ""} className="input" /></Field>
      </section>

      <div className="flex gap-2"><button className="btn-primary">{submit}</button><Link href={cancelHref} className="btn">Cancelar</Link></div>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label className="label" htmlFor={id}>{label}</label>{children}</div>;
}
