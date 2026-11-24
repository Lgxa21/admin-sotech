"use client";

import { useState } from "react";
import Link from "next/link";
import { SERVICES, SERVICE_LABEL, PRIORITIES, PRIORITY_LABEL, toInputDate } from "@/lib/labels";
import OrderPiecesFields, { ReferenceField } from "./OrderPiecesFields";
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES, type OrderPiece, type OrderReference } from "@/lib/order-pieces";
import SubmitButton from "./SubmitButton";

type Opt = { id: string; name: string };
type Values = Partial<{
  id: string; pieces: OrderPiece[]; title: string; clientId: string; serviceType: string; priority: string; brief: string | null; copy: string | null;
  platform: string | null; formats: string | null; referenceLinks: string | null; dueDate: Date | null; ownerId: string | null;
  budget: string | null; currency: string; revisionRoundsIncluded: number; invoiceNumber: string | null; internalNotes: string | null; isRecurring: boolean;
}>;

export default function OrderForm({ action, clients, people, values = {}, references = [], money, submit, cancelHref }: {
  action: (f: FormData) => Promise<void>; clients: Opt[]; people: Opt[]; values?: Values; references?: OrderReference[]; money: boolean; submit: string; cancelHref: string;
}) {
  const v = values;
  const [error, setError] = useState("");
  return (
    <form action={action} className="grid max-w-3xl gap-5" onSubmit={(event) => {
      const files = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="file"]'))
        .flatMap((input) => Array.from(input.files ?? []));
      let message = "";
      if (files.some((file) => file.size > MAX_IMAGE_BYTES) || files.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_BYTES) {
        message = "Las fotos deben pesar hasta 5 MB cada una y 15 MB en total por guardado.";
      } else if (files.length > 30) {
        message = "Adjunta hasta 30 fotos por guardado.";
      } else if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
        message = "Selecciona imágenes JPG, PNG o WebP.";
      }
      setError(message);
      if (message) event.preventDefault();
    }}>
      <section className="card p-5 grid gap-4">
        <h2 className="h2">Datos del pedido</h2>
        <Field label="Título de la orden" id="title"><input id="title" name="title" required defaultValue={v.title} placeholder="Ej. Exhibidor para punto de venta" className="input" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cliente" id="clientId">
            <select id="clientId" name="clientId" required defaultValue={v.clientId ?? ""} className="input">
              <option value="" disabled>Elige un cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Link href="/clientes/nuevo?next=orden" className="mt-1 inline-block text-xs font-semibold text-ink underline">+ Cliente nuevo</Link>
          </Field>
          <Field label="Tipo de servicio" id="serviceType">
            <select id="serviceType" name="serviceType" defaultValue={v.serviceType ?? ""} required className="input">
              <option value="" disabled>Elige un servicio</option>
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
        </div>
      </section>

      <OrderPiecesFields initial={v.pieces ?? []} references={references} orderId={v.id} />

      <details className="card p-5" open={v.brief || v.copy || v.platform || v.formats || v.referenceLinks || references.some((file) => !file.pieceId) ? true : undefined}>
        <summary className="cursor-pointer font-bold">Indicaciones y referencias generales</summary>
        <div className="mt-4 grid gap-4">
          <Field label="¿Qué debe saber el equipo sobre todo el pedido?" id="brief">
            <textarea id="brief" name="brief" rows={3} maxLength={12000} defaultValue={v.brief ?? ""} className="input" placeholder="Ej. Va en el pasillo principal. Respetar los colores de cada marca." />
          </Field>
          <ReferenceField field="order" orderId={v.id} references={references.filter((file) => !file.pieceId)} />
          <Field label="Enlaces de referencia" id="referenceLinks"><textarea id="referenceLinks" name="referenceLinks" rows={2} defaultValue={v.referenceLinks ?? ""} placeholder="https://drive.google.com/…" className="input" /></Field>
          {v.copy && <Field label="Textos generales" id="copy"><textarea id="copy" name="copy" rows={2} defaultValue={v.copy} className="input" /></Field>}
          {v.platform && <Field label="Plataforma" id="platform"><input id="platform" name="platform" defaultValue={v.platform} className="input" /></Field>}
          {v.formats && <Field label="Formatos y medidas generales" id="formats"><input id="formats" name="formats" defaultValue={v.formats} className="input" /></Field>}
        </div>
      </details>

      <details className="card p-5">
        <summary className="cursor-pointer font-bold">Administración y notas internas</summary>
        <div className="mt-4 grid gap-4">
          <Field label="Rondas de revisión incluidas" id="revisionRoundsIncluded"><input id="revisionRoundsIncluded" name="revisionRoundsIncluded" type="number" min={0} max={10} defaultValue={v.revisionRoundsIncluded ?? 2} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRecurring" defaultChecked={v.isRecurring} /> Es parte de una iguala</label>
        {money && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Presupuesto / precio" id="budget"><input id="budget" name="budget" inputMode="decimal" defaultValue={v.budget?.replace(".", ",") ?? ""} placeholder="0,00" className="input tabular" /></Field>
            <Field label="Moneda" id="currency">
              <select id="currency" name="currency" defaultValue={v.currency ?? "USD"} className="input"><option value="USD">USD</option><option value="VES">Bolívares</option></select>
            </Field>
            <Field label="Número de factura" id="invoiceNumber"><input id="invoiceNumber" name="invoiceNumber" defaultValue={v.invoiceNumber ?? ""} className="input" /></Field>
          </div>
        )}
        <Field label="Notas internas (el cliente no las ve)" id="internalNotes"><textarea id="internalNotes" name="internalNotes" rows={3} defaultValue={v.internalNotes ?? ""} className="input" /></Field>
        </div>
      </details>

      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
      <div className="flex gap-2"><SubmitButton pendingLabel="Guardando…">{submit}</SubmitButton><Link href={cancelHref} className="btn">Cancelar</Link></div>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label className="label" htmlFor={id}>{label}</label>{children}</div>;
}
