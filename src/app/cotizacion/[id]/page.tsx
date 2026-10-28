import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, quotes, quoteItems } from "@/db";
import { requireRole } from "@/lib/auth";
import { money, fmtDay } from "@/lib/money";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cotización" };

// Vista limpia para imprimir o guardar como PDF desde el navegador.
export default async function PrintQuote({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { id } = await params;
  const q = await db.query.quotes.findFirst({ where: eq(quotes.id, id), with: { client: true, items: { orderBy: [asc(quoteItems.position)] } } });
  if (!q) notFound();
  const total = q.items.reduce((a, it) => a + Number(it.qty) * Number(it.unitPrice), 0);
  const created = q.createdAt.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Caracas" });
  return (
    <main className="mx-auto max-w-[820px] bg-paper px-6 py-10 print:px-0 print:py-0 sm:px-12">
      <style>{`@media print { @page { margin: 18mm } body { background: #fff } .no-print { display: none } }`}</style>
      <div className="no-print mb-8 flex justify-end"><p className="text-sm text-muted">Usa Imprimir (Ctrl + P) y elige “Guardar como PDF”.</p></div>
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-4 border-ink pb-6">
        <Logo size={44} light={false} />
        <div className="text-right">
          <p className="eyebrow">Cotización</p>
          <p className="font-mono text-2xl font-semibold">C-{q.number}</p>
          <p className="text-sm text-muted">{created}</p>
        </div>
      </header>
      <section className="grid gap-1 py-6">
        <p className="eyebrow">Para</p>
        <p className="text-lg font-bold">{q.client.name}</p>
        {q.client.taxId && <p className="text-sm text-muted">RIF {q.client.taxId}</p>}
        {q.client.contactName && <p className="text-sm text-muted">Atención: {q.client.contactName}</p>}
      </section>
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]" style={{ fontStretch: "112%" }}>{q.title}</h1>
      <table className="mt-6 w-full text-sm">
        <thead className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
          <tr className="border-b-2 border-ink"><th className="py-2 font-semibold">Descripción</th><th className="py-2 text-right font-semibold">Cant.</th><th className="py-2 text-right font-semibold">Precio</th><th className="py-2 text-right font-semibold">Subtotal</th></tr>
        </thead>
        <tbody>
          {q.items.map((it) => (
            <tr key={it.id} className="border-b border-line">
              <td className="py-3 pr-4">{it.description}</td>
              <td className="py-3 text-right font-mono tabular">{Number(it.qty).toLocaleString("es-VE")}</td>
              <td className="py-3 text-right font-mono tabular">{money(it.unitPrice, q.currency)}</td>
              <td className="py-3 text-right font-mono tabular">{money(Number(it.qty) * Number(it.unitPrice), q.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <p className="rounded-xl bg-yellow px-5 py-3 text-lg"><span className="font-bold">Total </span><span className="font-mono font-semibold">{money(total, q.currency)}</span></p>
      </div>
      {q.notes && <section className="mt-8 grid gap-1"><p className="eyebrow">Condiciones</p><p className="whitespace-pre-line text-sm">{q.notes}</p></section>}
      {q.validUntil && <p className="mt-6 text-sm text-muted">Esta cotización es válida hasta el {fmtDay(q.validUntil)}.</p>}
    </main>
  );
}
