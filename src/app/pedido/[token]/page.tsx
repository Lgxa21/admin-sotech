import { eq } from "drizzle-orm";
import { db, clients } from "@/db";
import { submitClientRequest } from "@/app/actions/client-links";
import { SERVICES, SERVICE_LABEL } from "@/lib/labels";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hacer un pedido", robots: { index: false } };

export default async function Request({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const c = await db.query.clients.findFirst({ where: eq(clients.requestToken, token) });
  if (!c || !c.active) {
    return <PublicShell><div className="card grid gap-2 px-6 py-8"><h1 className="h1 text-3xl">Este enlace ya no está activo</h1><p className="text-muted">Pídenos uno nuevo.</p></div></PublicShell>;
  }
  if (sp.ok) {
    return (
      <PublicShell>
        <section className="grid gap-3 rounded-[18px] bg-yellow px-6 py-8" role="status">
          <h1 className="h1 text-3xl">¡Pedido recibido!</h1>
          <p>Lo revisamos y te escribimos para confirmar los detalles y la fecha.</p>
          <a href={`/pedido/${token}`} className="btn w-fit border-ink">Hacer otro pedido</a>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell>
      <div className="grid gap-2">
        <p className="eyebrow">Pedidos de {c.name}</p>
        <h1 className="h1">¿Qué necesitas?</h1>
        <p className="text-muted">Cuéntanos lo esencial. Si falta algo, te escribimos.</p>
      </div>
      {sp.error && <p role="alert" className="card px-5 py-3 text-sm font-semibold text-bad">{sp.error}</p>}
      <form action={submitClientRequest.bind(null, token)} className="card grid gap-4 px-6 py-6">
        <div className="hidden" aria-hidden="true"><label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div><label className="label" htmlFor="title">Qué necesitas</label><input id="title" name="title" required maxLength={200} placeholder="Ej.: Post para el lanzamiento del nuevo producto" className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="serviceType">Tipo de trabajo</label>
            <select id="serviceType" name="serviceType" className="input" defaultValue="REDES_SOCIALES">{SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="dueDate">Para cuándo lo necesitas</label><input id="dueDate" name="dueDate" type="date" className="input" /></div>
        </div>
        <div><label className="label" htmlFor="brief">Descripción</label><textarea id="brief" name="brief" required rows={5} placeholder="Objetivo, mensaje principal, textos, a quién va dirigido…" className="input" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="platform">Dónde se va a usar</label><input id="platform" name="platform" placeholder="Instagram, impreso, web…" className="input" /></div>
          <div><label className="label" htmlFor="name">Tu nombre</label><input id="name" name="name" autoComplete="name" className="input" /></div>
        </div>
        <div><label className="label" htmlFor="references">Referencias (enlaces, opcional)</label><textarea id="references" name="references" rows={2} placeholder="https://…" className="input" /></div>
        <div><button className="btn-primary px-7 py-3 text-[15px]">Enviar pedido</button></div>
      </form>
    </PublicShell>
  );
}
