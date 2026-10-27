import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, clients, orders } from "@/db";
import { requireRole } from "@/lib/auth";
import { fmtDate, SERVICE_LABEL } from "@/lib/labels";
import StatusBadge from "@/components/StatusBadge";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { id } = await params;
  const c = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!c) notFound();
  const list = await db.select().from(orders).where(eq(orders.clientId, id)).orderBy(desc(orders.number));
  const D = ({ label, children }: { label: string; children: React.ReactNode }) => <div><p className="label mb-0.5">{label}</p><div className="text-sm whitespace-pre-line break-words">{children || "—"}</div></div>;
  return (
    <div className="grid gap-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-muted"><Link href="/clientes" className="hover:text-ink">Clientes</Link></p><h1 className="h1">{c.name}</h1></div>
        <div className="flex gap-2">
          <Link href={`/clientes/${id}/editar`} className="btn"><Icon name="edit" />Editar</Link>
          <Link href={`/ordenes/nueva?cliente=${id}`} className="btn-primary">+ Nueva orden</Link>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="card p-5 grid gap-3 content-start">
          <D label="Contacto">{[c.contactName, c.contactPhone, c.contactEmail].filter(Boolean).join("\n")}</D>
          <D label="RIF">{c.taxId}</D>
          <D label="Renovación">{c.renewalDate ? fmtDate(c.renewalDate) : null}</D>
          <D label="Manual de marca">{c.brandManualUrl ? <a href={c.brandManualUrl} target="_blank" rel="noreferrer" className="text-accent">Abrir</a> : null}</D>
          <D label="Contrato y servicios">{c.contractNotes}</D>
          <D label="Redes">{c.socialNotes}</D>
          <D label="Notas">{c.notes}</D>
        </section>
        <section className="card p-5 grid gap-3 content-start min-w-0">
          <h2 className="h2">Órdenes</h2>
          {list.length ? (
            <ul className="grid gap-1">
              {list.map((o) => (
                <li key={o.id}>
                  <Link href={`/ordenes/${o.id}`} className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2 hover:bg-canvas">
                    <span className="font-mono text-xs text-muted tabular">#{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{o.title} <span className="text-muted">· {SERVICE_LABEL[o.serviceType]}</span></span>
                    <StatusBadge status={o.status} />
                    <span className="w-16 text-right text-xs text-muted tabular">{fmtDate(o.dueDate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Sin órdenes todavía.</p>}
        </section>
      </div>
    </div>
  );
}
