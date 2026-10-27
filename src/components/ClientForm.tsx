import Link from "next/link";
import { toInputDate } from "@/lib/labels";

type V = Partial<{ name: string; contactName: string | null; contactPhone: string | null; contactEmail: string | null; taxId: string | null;
  brandManualUrl: string | null; socialNotes: string | null; contractNotes: string | null; renewalDate: Date | null; notes: string | null }>;

export default function ClientForm({ action, values = {}, submit, cancelHref, next }: { action: (f: FormData) => Promise<void>; values?: V; submit: string; cancelHref: string; next?: string }) {
  const v = values;
  const F = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => <div><label className="label" htmlFor={id}>{label}</label>{children}</div>;
  return (
    <form action={action} className="grid gap-5 max-w-3xl">
      {next && <input type="hidden" name="next" value={next} />}
      <section className="card p-5 grid gap-4">
        <h2 className="h2">Cliente</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <F id="name" label="Nombre o marca"><input id="name" name="name" required defaultValue={v.name} className="input" /></F>
          <F id="taxId" label="RIF"><input id="taxId" name="taxId" defaultValue={v.taxId ?? ""} placeholder="J-12345678-9" className="input" /></F>
          <F id="contactName" label="Persona de contacto"><input id="contactName" name="contactName" defaultValue={v.contactName ?? ""} className="input" /></F>
          <F id="contactPhone" label="Teléfono"><input id="contactPhone" name="contactPhone" type="tel" defaultValue={v.contactPhone ?? ""} className="input" /></F>
          <F id="contactEmail" label="Correo"><input id="contactEmail" name="contactEmail" type="email" defaultValue={v.contactEmail ?? ""} className="input" /></F>
          <F id="renewalDate" label="Fecha de renovación del contrato"><input id="renewalDate" name="renewalDate" type="date" defaultValue={toInputDate(v.renewalDate)} className="input" /></F>
        </div>
      </section>
      <section className="card p-5 grid gap-4">
        <h2 className="h2">Marca y contrato</h2>
        <F id="brandManualUrl" label="Manual de marca, logos y colores (enlace)"><input id="brandManualUrl" name="brandManualUrl" defaultValue={v.brandManualUrl ?? ""} placeholder="https://drive.google.com/…" className="input" /></F>
        <F id="contractNotes" label="Contrato y servicios incluidos"><textarea id="contractNotes" name="contractNotes" rows={3} defaultValue={v.contractNotes ?? ""} placeholder="Ej.: iguala mensual de 12 posts + 4 historias, 2 rondas de cambios" className="input" /></F>
        <F id="socialNotes" label="Redes sociales que manejamos"><textarea id="socialNotes" name="socialNotes" rows={2} defaultValue={v.socialNotes ?? ""} placeholder="Cuentas y usuarios. No guardes contraseñas aquí: usa un gestor de contraseñas." className="input" /></F>
        <F id="notes" label="Notas (tono con el cliente, preferencias…)"><textarea id="notes" name="notes" rows={2} defaultValue={v.notes ?? ""} className="input" /></F>
      </section>
      <div className="flex gap-2"><button className="btn-primary">{submit}</button><Link href={cancelHref} className="btn">Cancelar</Link></div>
    </form>
  );
}
