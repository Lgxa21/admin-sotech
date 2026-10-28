import { asc, eq } from "drizzle-orm";
import { db, clients } from "@/db";
import { saveQuote } from "@/app/actions/quotes";
import QuoteForm from "@/components/QuoteForm";

export const metadata = { title: "Nueva cotización" };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const sp = await searchParams;
  const list = await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.active, true)).orderBy(asc(clients.name));
  return (
    <div className="grid gap-4">
      <h2 className="h2 text-[22px]">Nueva cotización</h2>
      <QuoteForm action={saveQuote.bind(null, null)} clients={list} values={{ clientId: sp.cliente }} submit="Guardar cotización" cancelHref="/finanzas/cotizaciones" />
    </div>
  );
}
