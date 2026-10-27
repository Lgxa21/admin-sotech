import { requireRole } from "@/lib/auth";
import { createClient } from "@/app/actions/clients";
import ClientForm from "@/components/ClientForm";

export const metadata = { title: "Nuevo cliente" };

export default async function NewClient({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireRole("DIRECCION", "ADMINISTRACION");
  const { next } = await searchParams;
  return (
    <div className="grid gap-5">
      <h1 className="h1">Nuevo cliente</h1>
      <ClientForm action={createClient} submit="Guardar cliente" cancelHref={next === "orden" ? "/ordenes/nueva" : "/clientes"} next={next} />
    </div>
  );
}
